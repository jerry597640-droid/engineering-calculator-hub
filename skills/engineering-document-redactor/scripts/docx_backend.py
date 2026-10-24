"""Local DOCX inspection and irreversible redaction of selected content.

Original implementation for engineering-document-redactor. No cloud calls.
The text verifier covers OOXML, not unidentified text inside images. Images
therefore require an explicit disposition and a separate visual review.
"""

from __future__ import annotations

import hashlib
import io
import math
import os
import posixpath
import re
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

from lxml import etree
from PIL import Image, ImageDraw, ImageOps


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
M = "http://schemas.openxmlformats.org/officeDocument/2006/math"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
XML = "http://www.w3.org/XML/1998/namespace"
TEXT_TAGS = {f"{{{W}}}t", f"{{{W}}}delText", f"{{{A}}}t", f"{{{M}}}t"}
PARA_TAGS = {f"{{{W}}}p", f"{{{A}}}p"}
SUPPORTED_RASTER = {"PNG", "JPEG", "BMP", "GIF", "TIFF", "WEBP"}
MAX_PARTS = 10000
MAX_UNCOMPRESSED = 256 * 1024 * 1024
MAX_IMAGE_PIXELS = 60_000_000


class DocxError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _xml(data: bytes) -> etree._Element:
    if re.search(br"<!\s*(DOCTYPE|ENTITY)\b", data, re.I):
        raise DocxError("DOCX_UNSUPPORTED_XML_DTD")
    parser = etree.XMLParser(
        resolve_entities=False, no_network=True, load_dtd=False,
        remove_comments=True, remove_pis=True, huge_tree=False,
    )
    try:
        return etree.fromstring(data, parser)
    except (etree.XMLSyntaxError, ValueError) as exc:
        raise DocxError("DOCX_INVALID_XML") from exc


def _dump(root: etree._Element) -> bytes:
    return etree.tostring(root, encoding="UTF-8", xml_declaration=True, standalone=True)


def _read_package(path: Path) -> dict[str, bytes]:
    path = Path(path)
    if not path.is_file():
        raise DocxError("DOCX_INPUT_NOT_FILE")
    try:
        with zipfile.ZipFile(path) as archive:
            info = archive.infolist()
            if len(info) > MAX_PARTS or sum(p.file_size for p in info) > MAX_UNCOMPRESSED:
                raise DocxError("DOCX_PACKAGE_TOO_LARGE")
            names = [p.filename for p in info if not p.is_dir()]
            if len(set(names)) != len(names):
                raise DocxError("DOCX_DUPLICATE_PACKAGE_PART")
            for item in info:
                name = item.filename
                if "\\" in name or name.startswith("/") or ".." in PurePosixPath(name).parts:
                    raise DocxError("DOCX_UNSAFE_PACKAGE_PATH")
                if item.flag_bits & 1:
                    raise DocxError("DOCX_ENCRYPTED_PACKAGE")
                if item.file_size > 10 * 1024 * 1024 and item.compress_size and item.file_size / item.compress_size > 1000:
                    raise DocxError("DOCX_SUSPICIOUS_COMPRESSION")
            parts = {name: archive.read(name) for name in names}
    except (zipfile.BadZipFile, RuntimeError) as exc:
        raise DocxError("DOCX_INVALID_PACKAGE") from exc
    if "[Content_Types].xml" not in parts or "word/document.xml" not in parts:
        raise DocxError("DOCX_MISSING_MAIN_DOCUMENT")
    types = _xml(parts["[Content_Types].xml"])
    if any("macroEnabled" in child.get("ContentType", "") for child in types):
        raise DocxError("DOCX_MACRO_ENABLED_UNSUPPORTED")
    return parts


def _rel_owner(name: str) -> str | None:
    if name == "_rels/.rels":
        return None
    directory, filename = posixpath.split(name)
    if not directory.endswith("_rels") or not filename.endswith(".rels"):
        raise DocxError("DOCX_INVALID_RELATIONSHIP_PART")
    return posixpath.join(posixpath.dirname(directory), filename[:-5])


def _target(owner: str | None, raw: str) -> str | None:
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc:
        return None
    raw = unquote(parsed.path)
    base = posixpath.dirname(owner) if owner else ""
    full = posixpath.normpath(raw.lstrip("/") if raw.startswith("/") else posixpath.join(base, raw))
    if full.startswith("../") or full == ".." or "\\" in full:
        raise DocxError("DOCX_UNSAFE_RELATIONSHIP_TARGET")
    return full


def _paragraph_nodes(root: etree._Element):
    """Yield text nodes once, keeping nested text boxes in their own paragraph."""
    seen: set[etree._Element] = set()
    for paragraph in root.iter():
        if paragraph.tag not in PARA_TAGS:
            continue
        nodes = []
        for node in paragraph.iter():
            if node.tag not in TEXT_TAGS:
                continue
            closest = next((p for p in node.iterancestors() if p.tag in PARA_TAGS), None)
            if closest is paragraph:
                nodes.append(node)
                seen.add(node)
        if nodes:
            yield nodes
    for node in root.iter():
        if node.tag in TEXT_TAGS and node not in seen:
            yield [node]


def _media_locations(parts: dict[str, bytes]) -> dict[str, list[str]]:
    locations: dict[str, list[str]] = {}
    for name, data in parts.items():
        if not name.endswith(".rels"):
            continue
        owner = _rel_owner(name)
        for rel in _xml(data):
            if rel.get("TargetMode") == "External":
                continue
            target = _target(owner, rel.get("Target", ""))
            if target and target.startswith("word/media/"):
                locations.setdefault(target, []).append(owner or "package")
    return {name: sorted(set(values)) for name, values in locations.items()}


def _load_image(data: bytes) -> Image.Image:
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format not in SUPPORTED_RASTER:
                raise DocxError("DOCX_UNSUPPORTED_MEDIA")
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise DocxError("DOCX_IMAGE_TOO_LARGE")
            source.seek(0)
            result = ImageOps.exif_transpose(source).convert("RGBA")
            result.load()
            return result
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise DocxError("DOCX_IMAGE_TOO_LARGE") from exc
    except (OSError, SyntaxError) as exc:
        raise DocxError("DOCX_UNSUPPORTED_MEDIA") from exc


def inspect_docx(input_path: Path, workdir: Path) -> dict:
    """Return local text blocks and image files for an explicit review stage."""
    parts = _read_package(Path(input_path))
    workdir = Path(workdir)
    if workdir.is_symlink():
        raise DocxError("DOCX_UNSAFE_WORKDIR")
    media_dir = workdir / "docx-media"
    media_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    if media_dir.is_symlink():
        raise DocxError("DOCX_UNSAFE_WORKDIR")
    blocks, media, warnings = [], [], []
    for name, data in parts.items():
        if not name.endswith(".xml") or not (name.startswith("word/") or name.startswith("docProps/")):
            continue
        root = _xml(data)
        for index, nodes in enumerate(_paragraph_nodes(root), 1):
            text = "".join(n.text or "" for n in nodes)
            if text.strip():
                blocks.append({"location": f"{name}:paragraph:{index}", "text": text})
        if name.startswith("docProps/"):
            for index, node in enumerate(root.iter(), 1):
                if len(node) == 0 and node.text and node.text.strip():
                    blocks.append({"location": f"{name}:property:{index}", "text": node.text})
        for index, node in enumerate(root.iter(), 1):
            for key in ("descr", "title", "name"):
                if node.get(key):
                    blocks.append({"location": f"{name}:attribute:{index}:{key}", "text": node.get(key)})
    locations = _media_locations(parts)
    for name in sorted(n for n in parts if n.startswith("word/media/")):
        data = parts[name]
        digest = hashlib.sha256(data).hexdigest()
        suffix = Path(name).suffix.lower() or ".bin"
        dest = media_dir / f"{digest}{suffix}"
        if dest.exists():
            if dest.is_symlink() or dest.read_bytes() != data:
                raise DocxError("DOCX_MEDIA_PREVIEW_CONFLICT")
        else:
            with dest.open("xb") as stream:
                stream.write(data)
            dest.chmod(0o600)
        try:
            picture = _load_image(data)
            width, height, kind = picture.width, picture.height, "raster"
        except ValueError:
            width, height, kind = None, None, "unsupported"
            warnings.append("UNSUPPORTED_MEDIA_REQUIRES_CONVERSION")
        media.append({
            "id": name, "path": str(dest.resolve()), "sha256": digest,
            "width": width, "height": height, "kind": kind,
            "locations": locations.get(name, []),
        })
    if media:
        warnings.append("EMBEDDED_IMAGES_REQUIRE_VISUAL_REVIEW")
    if any(n.startswith(("word/embeddings/", "customXml/", "word/activeX/")) for n in parts):
        warnings.append("EMBEDDED_DATA_WILL_BE_REMOVED")
    if any(b'TargetMode="External"' in d or b"TargetMode='External'" in d for n, d in parts.items() if n.endswith(".rels")):
        warnings.append("EXTERNAL_LINKS_WILL_BE_REMOVED")
    return {"text_blocks": blocks, "media": media, "warnings": sorted(set(warnings))}


class _Matcher:
    def __init__(self, policy: dict):
        self.terms = []
        for index, item in enumerate(policy.get("terms", [])):
            if not isinstance(item, dict) or not isinstance(item.get("text"), str) or not item["text"].strip():
                raise DocxError("DOCX_INVALID_TERM")
            replacement = item.get("replacement", "[已遮蔽]")
            if not isinstance(replacement, str) or len(item["text"]) > 4096:
                raise DocxError("DOCX_INVALID_TERM")
            self.terms.append({**item, "replacement": replacement, "index": index})
        self.flags = 0 if policy.get("case_sensitive", False) else re.IGNORECASE
        ordered = sorted(self.terms, key=lambda x: len(x["text"]), reverse=True)
        self.regex = re.compile("|".join(re.escape(t["text"]) for t in ordered), self.flags) if ordered else None
        self.count = 0

    def term_for(self, value: str) -> dict:
        for item in self.terms:
            if re.fullmatch(re.escape(item["text"]), value, self.flags):
                return item
        raise DocxError("DOCX_INTERNAL_MATCH_ERROR")

    def replace_string(self, value: str) -> str:
        if not value or not self.regex:
            return value
        def repl(match):
            self.count += 1
            return self.term_for(match.group())["replacement"]
        return self.regex.sub(repl, value)

    def replace_nodes(self, nodes: list[etree._Element]) -> None:
        if not self.regex:
            return
        positions, full = [], ""
        for node in nodes:
            start = len(full)
            full += node.text or ""
            positions.append((start, len(full), node))
        for match in reversed(list(self.regex.finditer(full))):
            selected = [p for p in positions if p[1] > match.start() and p[0] < match.end()]
            if not selected:
                continue
            first, last = selected[0], selected[-1]
            start = match.start() - first[0]
            end = match.end() - last[0]
            replacement = self.term_for(match.group())["replacement"]
            if first[2] is last[2]:
                text = first[2].text or ""
                first[2].text = text[:start] + replacement + text[end:]
            else:
                first[2].text = (first[2].text or "")[:start] + replacement
                for _, _, node in selected[1:-1]:
                    node.text = ""
                last[2].text = (last[2].text or "")[end:]
            self.count += 1
        for node in nodes:
            value = node.text or ""
            if value.startswith((" ", "\t", "\n")) or value.endswith((" ", "\t", "\n")):
                node.set(f"{{{XML}}}space", "preserve")


def _remove(node: etree._Element) -> None:
    parent = node.getparent()
    if parent is not None:
        parent.remove(node)


def _unwrap(node: etree._Element) -> None:
    parent = node.getparent()
    if parent is None:
        return
    index = parent.index(node)
    for child in list(node):
        parent.insert(index, child)
        index += 1
    parent.remove(node)


def _accept_changes_and_scrub(root: etree._Element) -> None:
    drop_names = {
        "del", "moveFrom", "commentRangeStart", "commentRangeEnd", "commentReference",
        "moveFromRangeStart", "moveFromRangeEnd", "moveToRangeStart", "moveToRangeEnd",
        "bookmarkStart", "bookmarkEnd", "proofErr", "docVars", "dataBinding", "mailMerge",
        "attachedTemplate", "trackRevisions", "documentProtection", "writeProtection",
        "instrText", "delInstrText", "fldChar", "altChunk", "object", "control",
        "annotationRef", "rsids", "docId", "alias", "tag",
    }
    for node in list(root.iter()):
        if not isinstance(node.tag, str):
            continue
        namespace, _, local = node.tag[1:].partition("}") if node.tag.startswith("{") else ("", "", node.tag)
        if namespace == W and (local in drop_names or local.endswith("PrChange")):
            _remove(node)
        elif namespace == W and local in {"ins", "moveTo", "fldSimple"}:
            _unwrap(node)
        if local in {"docPr", "cNvPr"}:
            node.attrib.pop("descr", None)
            node.attrib.pop("title", None)
            if "name" in node.attrib:
                node.set("name", "Image")
        for attribute in list(node.attrib):
            key = etree.QName(attribute).localname
            if key.lower().startswith("rsid") or key in {"author", "userId", "date", "dateUtc", "durableId"}:
                del node.attrib[attribute]
            if key in {"href", "src"}:
                del node.attrib[attribute]


def _drop_part(name: str) -> bool:
    return (
        name.startswith(("customXml/", "_xmlsignatures/", "word/embeddings/", "word/activeX/", "word/printerSettings/"))
        or name.startswith("docProps/thumbnail")
        or name in {"docProps/custom.xml", "word/people.xml", "word/person.xml"}
        or bool(re.match(r"word/comments[^/]*\.xml$", name))
        or name.startswith(("word/vba", "word/attachedToolbars", "word/fonts/"))
    )


def _scrub_removed_references(root: etree._Element, removed: set[str]) -> None:
    for node in list(root.iter()):
        if not isinstance(node.tag, str):
            continue
        bad = [a for a, v in node.attrib.items() if etree.QName(a).namespace in {R, "urn:schemas-microsoft-com:office:office"} and v in removed]
        if not bad:
            continue
        if etree.QName(node).localname in {"embedRegular", "embedBold", "embedItalic", "embedBoldItalic"}:
            _remove(node)
            continue
        if node.tag == f"{{{W}}}hyperlink":
            _unwrap(node)
            continue
        container = next((p for p in [node, *node.iterancestors()] if p.tag in {f"{{{W}}}drawing", f"{{{W}}}pict", f"{{{W}}}object", f"{{{W}}}control"}), None)
        if container is not None:
            _remove(container)
        else:
            for attribute in bad:
                del node.attrib[attribute]


def _validate_region(region) -> tuple[float, float, float, float]:
    if not isinstance(region, (list, tuple)) or len(region) != 4:
        raise DocxError("DOCX_INVALID_MEDIA_REGION")
    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in region):
        raise DocxError("DOCX_INVALID_MEDIA_REGION")
    x0, y0, x1, y1 = map(float, region)
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        raise DocxError("DOCX_INVALID_MEDIA_REGION")
    return x0, y0, x1, y1


def _transform_media(parts: dict[str, bytes], policy: dict) -> tuple[dict[str, bytes], dict[str, str], int, bool, list[str]]:
    media_names = sorted(n for n in parts if n.startswith("word/media/"))
    choices = {}
    for item in policy.get("media", []):
        if not isinstance(item, dict) or item.get("id") not in media_names or item["id"] in choices:
            raise DocxError("DOCX_INVALID_MEDIA_SELECTION")
        choices[item["id"]] = item
    transformed, renamed, modified, all_reviewed, warnings = {}, {}, 0, True, []
    for number, name in enumerate(media_names, 1):
        picture = _load_image(parts[name])  # Unsupported binary/vector images fail closed.
        item = choices.get(name)
        if item is None:
            all_reviewed = False
            warnings.append("UNREVIEWED_EMBEDDED_IMAGE")
        else:
            action = item.get("action")
            if action == "keep":
                if item.get("reviewed") is not True:
                    raise DocxError("DOCX_KEEP_IMAGE_NOT_REVIEWED")
            elif action in {"blank", "regions"}:
                color = item.get("color", "black")
                if color not in {"black", "white"}:
                    raise DocxError("DOCX_INVALID_MEDIA_COLOR")
                rgba = (0, 0, 0, 255) if color == "black" else (255, 255, 255, 255)
                draw = ImageDraw.Draw(picture)
                if action == "blank":
                    draw.rectangle((0, 0, picture.width, picture.height), fill=rgba)
                else:
                    regions = item.get("regions")
                    if not isinstance(regions, list) or not regions:
                        raise DocxError("DOCX_INVALID_MEDIA_REGION")
                    for region in regions:
                        x0, y0, x1, y1 = _validate_region(region)
                        box = (math.floor(x0 * picture.width), math.floor(y0 * picture.height), min(picture.width - 1, math.ceil(x1 * picture.width) - 1), min(picture.height - 1, math.ceil(y1 * picture.height) - 1))
                        draw.rectangle(box, fill=rgba)
                modified += 1
            else:
                raise DocxError("DOCX_INVALID_MEDIA_ACTION")
        # Fresh PNG removes EXIF, image comments, later animation frames, and old pixels.
        output = io.BytesIO()
        picture.info.clear()
        picture.save(output, format="PNG", optimize=True)
        clean_name = f"word/media/redacted-media-{number:04d}.png"
        transformed[clean_name] = output.getvalue()
        renamed[name] = clean_name
    return transformed, renamed, modified, all_reviewed, warnings


def _rewrite_relationships(parts: dict[str, bytes], removed_parts: set[str], renamed: dict[str, str]) -> tuple[dict[str, bytes], dict[str, set[str]], int]:
    result, removed_ids, external_count = {}, {}, 0
    forbidden = ("comments", "people", "person", "customXml", "oleObject", "package", "control", "activeX", "printerSettings", "attachedTemplate", "thumbnail", "vbaProject", "digital-signature", "font")
    available = (set(parts) - removed_parts - set(renamed)) | set(renamed.values())
    for name, data in parts.items():
        if not name.endswith(".rels"):
            continue
        owner = _rel_owner(name)
        if owner and owner in removed_parts:
            removed_parts.add(name)
            continue
        root = _xml(data)
        for rel in list(root):
            target = _target(owner, rel.get("Target", ""))
            kind = rel.get("Type", "").rsplit("/", 1)[-1]
            external = rel.get("TargetMode") == "External" or target is None
            if external or kind in forbidden or kind.startswith("comments") or target in removed_parts or (target not in parts and target not in available):
                removed_ids.setdefault(owner or "", set()).add(rel.get("Id", ""))
                root.remove(rel)
                external_count += int(external)
            elif target in renamed:
                rel.set("Target", posixpath.relpath(renamed[target], posixpath.dirname(owner) if owner else ""))
        result[name] = _dump(root)
    return result, removed_ids, external_count


def _clean_properties(name: str, data: bytes) -> bytes:
    root = _xml(data)
    root.clear(keep_tail=False)
    # Empty core/application property roots are valid; original values are removed.
    return _dump(root)


def _update_content_types(data: bytes, parts: dict[str, bytes]) -> bytes:
    root = _xml(data)
    for item in list(root):
        if etree.QName(item).localname == "Override" and unquote(item.get("PartName", "")).lstrip("/") not in parts:
            root.remove(item)
    png = next((x for x in root if etree.QName(x).localname == "Default" and x.get("Extension", "").lower() == "png"), None)
    if png is None:
        png = etree.SubElement(root, f"{{{CT}}}Default")
        png.set("Extension", "png")
    png.set("ContentType", "image/png")
    # A source may have used a per-part image override; fresh PNG parts use Default.
    for item in list(root):
        if etree.QName(item).localname == "Override" and item.get("PartName", "").startswith("/word/media/"):
            item.set("ContentType", "image/png")
    return _dump(root)


def _remove_unreachable(parts: dict[str, bytes]) -> tuple[dict[str, bytes], int]:
    reachable = {"[Content_Types].xml", "_rels/.rels"}
    queue = [None]
    while queue:
        owner = queue.pop()
        relationship_name = "_rels/.rels" if owner is None else posixpath.join(posixpath.dirname(owner), "_rels", posixpath.basename(owner) + ".rels")
        if relationship_name not in parts:
            continue
        reachable.add(relationship_name)
        for rel in _xml(parts[relationship_name]):
            if rel.get("TargetMode") == "External":
                continue
            target = _target(owner, rel.get("Target", ""))
            if target in parts and target not in reachable:
                reachable.add(target)
                queue.append(target)
    if "word/document.xml" not in reachable:
        raise DocxError("DOCX_MAIN_DOCUMENT_UNREACHABLE")
    return {n: d for n, d in parts.items() if n in reachable}, len(set(parts) - reachable)


def _verify_terms(parts: dict[str, bytes], matcher: _Matcher) -> list[dict]:
    residuals = []
    for name, data in parts.items():
        values = [name]
        if name.endswith((".xml", ".rels")):
            root = _xml(data)
            values.extend("".join(n.text or "" for n in group) for group in _paragraph_nodes(root))
            values.extend(node.text or "" for node in root.iter())
            values.extend(node.tail or "" for node in root.iter())
            values.extend(value for node in root.iter() for value in node.attrib.values())
        for item in matcher.terms:
            if any(re.search(re.escape(item["text"]), value, matcher.flags) for value in values):
                residuals.append({"location": name, "category": item.get("category", "CUSTOM"), "term_index": item["index"]})
    return residuals


def redact_docx(input_path: Path, output_path: Path, policy: dict, workdir: Path) -> dict:
    """Write a new DOCX; return text/selected-image checks, never source terms."""
    input_path, output_path = Path(input_path), Path(output_path)
    if input_path.resolve() == output_path.resolve() or output_path.exists() or output_path.is_symlink():
        raise DocxError("DOCX_OUTPUT_MUST_BE_NEW")
    if policy.get("sanitize", True) is not True:
        raise DocxError("DOCX_SANITIZATION_REQUIRED")
    if policy.get("accept_revisions", True) is not True:
        raise DocxError("DOCX_ONLY_ACCEPT_REVISIONS_SUPPORTED")
    parts = _read_package(input_path)
    matcher = _Matcher(policy)
    images, renamed, modified, media_verified, warnings = _transform_media(parts, policy)
    removed = {name for name in parts if _drop_part(name)}
    for name in parts:
        if name in removed or name in renamed or name.endswith((".xml", ".rels")):
            continue
        raise DocxError("DOCX_UNSUPPORTED_BINARY_PART")
    rels, removed_ids, external_count = _rewrite_relationships(parts, removed, renamed)
    clean = {}
    for name, data in parts.items():
        if name in removed or name in renamed:
            continue
        if name.endswith(".rels"):
            if name in rels:
                clean[name] = rels[name]
            continue
        if name.startswith("docProps/"):
            clean[name] = _clean_properties(name, data)
            continue
        root = _xml(data)
        _accept_changes_and_scrub(root)
        _scrub_removed_references(root, removed_ids.get(name, set()))
        grouped = set()
        for nodes in _paragraph_nodes(root):
            matcher.replace_nodes(nodes)
            grouped.update(nodes)
        for node in root.iter():
            if node.text and node not in grouped:
                node.text = matcher.replace_string(node.text)
            if node.tail:
                node.tail = matcher.replace_string(node.tail)
            # Descriptions and visible aliases may also identify the document.
            for key, value in list(node.attrib.items()):
                if etree.QName(key).localname in {"descr", "title", "name", "val", "tooltip"}:
                    node.set(key, matcher.replace_string(value))
        clean[name] = _dump(root)
    clean.update(images)
    clean["[Content_Types].xml"] = _update_content_types(clean["[Content_Types].xml"], clean)
    clean, unreachable_count = _remove_unreachable(clean)
    clean["[Content_Types].xml"] = _update_content_types(clean["[Content_Types].xml"], clean)
    residuals = _verify_terms(clean, matcher)
    if residuals:
        # Refuse to create an output with known text still present in package parts.
        raise DocxError("DOCX_KNOWN_TERM_REMAINS")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("xb") as stream:
        os.chmod(output_path, 0o600)
        try:
            with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for name in sorted(clean):
                    archive.writestr(name, clean[name])
        except Exception:
            stream.close()
            output_path.unlink(missing_ok=True)
            raise
    # Reopen and verify the exact serialized file rather than trusting the in-memory copy.
    written = _read_package(output_path)
    if _verify_terms(written, matcher):
        output_path.unlink(missing_ok=True)
        raise DocxError("DOCX_POSTWRITE_VERIFICATION_FAILED")
    return {
        "counts": {
            "text_replacements": matcher.count, "media_modified": modified,
            "media_reencoded": len(images), "parts_removed": len(removed) + unreachable_count,
            "external_links_removed": external_count,
        },
        "warnings": sorted(set(warnings)),
        "verification": {"known_terms_absent": True, "media_verified": media_verified},
        "residuals": [],
    }
