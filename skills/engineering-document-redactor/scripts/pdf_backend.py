"""Local PDF/image redaction with deterministic masks and fresh PDF export.

No model or remote service is contacted. Raster is the default because a freshly
constructed image-only PDF cannot retain the original PDF objects. Detection is
bounded by supplied terms, regions, and the selected local OCR engine; a mask
does not prove that every identifying fact in a document was found.
"""
from __future__ import annotations

import csv
import hashlib
import io
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unicodedata
from typing import Any

import fitz
from PIL import Image, ImageDraw, ImageOps


MAX_PAGES = 250
MAX_PAGE_PIXELS = 45_000_000
MAX_IMAGE_PIXELS = 45_000_000
SUPPORTED_IMAGES = {".png", ".jpg", ".jpeg", ".webp"}


class RedactionError(ValueError):
    """A safe error code that never embeds source document content."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _private_dir(path: Path) -> Path:
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    try:
        path.chmod(0o700)
    except OSError:
        pass
    return path


def _output_guard(source: Path, output: Path) -> None:
    if source.resolve() == output.resolve():
        raise RedactionError("OUTPUT_EQUALS_INPUT")
    if output.exists() or output.is_symlink():
        raise RedactionError("OUTPUT_ALREADY_EXISTS")
    output.parent.mkdir(parents=True, exist_ok=True)


def _write_exclusive(path: Path, data: bytes) -> None:
    # Exclusive creation closes the exists()/write race, including symlinks.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def _normalise(text: str, case_sensitive: bool = False) -> str:
    out = []
    for original in text:
        for char in unicodedata.normalize("NFKC", original):
            if char.isspace() or unicodedata.category(char) == "Cf":
                continue
            out.append(char if case_sensitive else char.casefold())
    return "".join(out)


def _normalised_chars(chars: list[tuple[str, tuple, Any]], case_sensitive=False):
    normalised, positions = [], []
    for char, box, group in chars:
        for item in unicodedata.normalize("NFKC", char):
            if item.isspace() or unicodedata.category(item) == "Cf":
                continue
            for folded in item if case_sensitive else item.casefold():
                normalised.append(folded)
                positions.append((box, group))
    return "".join(normalised), positions


def _terms(policy: dict) -> list[dict]:
    result = []
    for index, entry in enumerate(policy.get("terms", [])):
        if not isinstance(entry, dict) or not isinstance(entry.get("text"), str):
            raise RedactionError("INVALID_TERM")
        text = _normalise(entry["text"], policy.get("case_sensitive", False))
        if not text:
            raise RedactionError("EMPTY_TERM")
        result.append({"index": index, "normalised": text,
                       "category": str(entry.get("category", "CUSTOM"))})
    return result


def _matches(chars: list, terms: list[dict], case_sensitive=False):
    text, positions = _normalised_chars(chars, case_sensitive)
    found = []
    for term in terms:
        start = 0
        while True:
            at = text.find(term["normalised"], start)
            if at < 0:
                break
            groups: dict[Any, fitz.Rect] = {}
            for box, group in positions[at:at + len(term["normalised"])]:
                if box is None:
                    continue
                rect = fitz.Rect(box)
                if not all(math.isfinite(x) for x in rect) or rect.is_empty:
                    raise RedactionError("INVALID_TEXT_COORDINATES")
                groups[group] = (groups[group] | rect) if group in groups else rect
            if not groups:
                raise RedactionError("MATCH_WITHOUT_COORDINATES")
            found.append({"term_index": term["index"], "category": term["category"],
                          "boxes": [tuple(r) for r in groups.values()]})
            # Non-overlapping occurrences of one term; different terms may overlap.
            start = at + max(1, len(term["normalised"]))
    return text, found


def _pdf_chars(page: fitz.Page):
    flags = fitz.TEXTFLAGS_RAWDICT & ~fitz.TEXT_PRESERVE_IMAGES
    chars = []
    blocks = page.get_text("rawdict", flags=flags).get("blocks", [])
    for b, block in enumerate(blocks):
        if block.get("type") != 0:
            continue
        for l, line in enumerate(block.get("lines", [])):
            for span in line.get("spans", []):
                for char in span.get("chars", []):
                    chars.append((char.get("c", ""), char["bbox"], (b, l)))
            chars.append(("\n", None, (b, l)))
    return chars


def _open_pdf(path: Path):
    try:
        doc = fitz.open(path)
    except Exception as exc:
        raise RedactionError("PDF_OPEN_FAILED") from exc
    if doc.needs_pass:
        doc.close()
        raise RedactionError("PDF_PASSWORD_REQUIRED")
    if not doc.is_pdf or len(doc) == 0 or len(doc) > MAX_PAGES:
        doc.close()
        raise RedactionError("PDF_PAGE_LIMIT_OR_FORMAT")
    return doc


def _render(page: fitz.Page, dpi: int) -> Image.Image:
    if (page.rect.width * dpi / 72) * (page.rect.height * dpi / 72) > MAX_PAGE_PIXELS:
        raise RedactionError("PAGE_PIXEL_LIMIT")
    pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csRGB, alpha=False, annots=True)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def _ocr_chars(image: Image.Image, workdir: Path, lang: str, tessdata=None):
    if not isinstance(lang, str) or not re.fullmatch(r"[A-Za-z0-9_+-]+", lang):
        raise RedactionError("INVALID_OCR_LANGUAGE")
    executable = shutil.which("tesseract")
    if not executable:
        raise RedactionError("OCR_ENGINE_UNAVAILABLE")
    env = os.environ.copy()
    if tessdata is not None:
        if not Path(tessdata).is_dir():
            raise RedactionError("OCR_TESSDATA_UNAVAILABLE")
        env["TESSDATA_PREFIX"] = str(Path(tessdata).resolve())
    try:
        listed = subprocess.run([executable, "--list-langs"], env=env,
                                capture_output=True, text=True, timeout=15)
        available = set(listed.stdout.splitlines()[1:])
        if listed.returncode or any(x not in available for x in lang.split("+")):
            raise RedactionError("OCR_LANGUAGE_UNAVAILABLE")
        with tempfile.TemporaryDirectory(prefix="ocr-", dir=workdir) as tmp:
            source = Path(tmp) / "page.png"
            image.save(source)
            # Set the output flag directly. A private tessdata directory may
            # contain model files only, with no system configs/tsv file.
            run = subprocess.run([executable, str(source), "stdout", "-l", lang,
                                  "--psm", "11", "-c", "tessedit_create_tsv=1"], env=env,
                                 capture_output=True, timeout=90)
        if run.returncode:
            raise RedactionError("OCR_FAILED")
        tsv = run.stdout.decode("utf-8", errors="strict")
    except subprocess.TimeoutExpired as exc:
        raise RedactionError("OCR_TIMEOUT") from exc
    except (OSError, UnicodeError) as exc:
        raise RedactionError("OCR_FAILED") from exc
    if not tsv.startswith("level\tpage_num\t"):
        raise RedactionError("OCR_TSV_INVALID")
    chars, words = [], []
    for row in csv.DictReader(io.StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
        if row.get("level") != "5" or not row.get("text", "").strip():
            continue
        try:
            left, top = int(row["left"]), int(row["top"])
            width, height = int(row["width"]), int(row["height"])
            if width <= 0 or height <= 0:
                continue
        except (ValueError, KeyError) as exc:
            raise RedactionError("OCR_COORDINATES_INVALID") from exc
        box = (left, top, left + width, top + height)
        group = (row.get("block_num"), row.get("par_num"), row.get("line_num"))
        words.append(row["text"])
        chars.extend((char, box, group) for char in row["text"])
        chars.append((" ", None, group))
    return chars, " ".join(words)


def _color(value: Any) -> tuple[int, int, int]:
    if value == "black" or value is None:
        return (0, 0, 0)
    if value == "white":
        return (255, 255, 255)
    raise RedactionError("COLOR_MUST_BE_BLACK_OR_WHITE")


def _regions(policy: dict, page_number: int, page_count: int):
    result = []
    for item in policy.get("regions", []):
        if not isinstance(item, dict) or type(item.get("page")) is not int:
            raise RedactionError("INVALID_REGION_PAGE")
        if not 1 <= item["page"] <= page_count:
            raise RedactionError("REGION_PAGE_OUT_OF_RANGE")
        box = item.get("box")
        if not isinstance(box, (list, tuple)) or len(box) != 4:
            raise RedactionError("INVALID_REGION_BOX")
        if any(type(x) not in (int, float) or not math.isfinite(x) for x in box):
            raise RedactionError("INVALID_REGION_COORDINATES")
        x0, y0, x1, y1 = box
        if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
            raise RedactionError("REGION_MUST_BE_NORMALISED")
        color = _color(item.get("color", "black"))
        if item["page"] == page_number:
            result.append((tuple(box), color))
    return result


def _pixel_box(box, size, pad=2):
    width, height = size
    x0, y0, x1, y1 = box
    if x1 <= 0 or y1 <= 0 or x0 >= width or y0 >= height:
        raise RedactionError("MATCH_OUTSIDE_PAGE")
    return (max(0, math.floor(x0) - pad), max(0, math.floor(y0) - pad),
            min(width - 1, math.ceil(x1) + pad), min(height - 1, math.ceil(y1) + pad))


def _display_box(page, box):
    rect = fitz.Rect(box) * page.rotation_matrix
    return (rect.x0 - page.rect.x0, rect.y0 - page.rect.y0,
            rect.x1 - page.rect.x0, rect.y1 - page.rect.y0)


def _pdf_pixel_box(page, box, size):
    x0, y0, x1, y1 = _display_box(page, box)
    sx, sy = size[0] / page.rect.width, size[1] / page.rect.height
    return _pixel_box((x0 * sx, y0 * sy, x1 * sx, y1 * sy), size)


def _deduplicate_ocr(page, text_matches, ocr_matches, image_size):
    """Count once when OCR confirms an already located selectable-text span."""
    existing = []
    for match in text_matches:
        union = None
        for box in match["boxes"]:
            rect = fitz.Rect(_pdf_pixel_box(page, box, image_size))
            union = rect if union is None else union | rect
        existing.append((match["term_index"], union))
    unique = []
    for match in ocr_matches:
        union = None
        for box in match["boxes"]:
            rect = fitz.Rect(box)
            union = rect if union is None else union | rect
        duplicate = any(index == match["term_index"] and union is not None and rect is not None
                        and min(union.get_area(), rect.get_area()) > 0
                        and (union & rect).get_area() / min(union.get_area(), rect.get_area()) >= 0.5
                        for index, rect in existing)
        if not duplicate:
            unique.append(match)
    return unique


def _annot_matches(page, terms, case_sensitive=False):
    found = []
    for widget in page.widgets() or []:
        value = _normalise(str(widget.field_value or ""), case_sensitive)
        for term in terms:
            if term["normalised"] in value:
                found.append({"term_index": term["index"], "category": term["category"],
                              "boxes": [tuple(widget.rect)]})
    for annot in page.annots() or []:
        value = _normalise(str(annot.info.get("content", "")), case_sensitive)
        for term in terms:
            if term["normalised"] in value:
                found.append({"term_index": term["index"], "category": term["category"],
                              "boxes": [tuple(annot.rect)]})
    return found


def _residuals(text, terms, location, case_sensitive=False):
    value = _normalise(text, case_sensitive)
    return [{"location": location, "category": t["category"], "term_index": t["index"]}
            for t in terms if t["normalised"] in value]


def inspect_pdf(input_path: Path, workdir: Path, ocr=False,
                ocr_lang="chi_tra+eng", tessdata=None) -> dict:
    workdir = _private_dir(workdir)
    blocks, media, pages, warnings = [], [], [], []
    with _open_pdf(Path(input_path)) as doc:
        for number, page in enumerate(doc, 1):
            text = page.get_text()
            image = _render(page, 120 if not ocr else 180)
            preview = workdir / f"page-{number}.png"
            image.save(preview)
            preview.chmod(0o600)
            blocks.append({"location": f"page:{number}", "text": text, "page": number})
            for index, widget in enumerate(page.widgets() or []):
                value = str(widget.field_value or "")
                if value:
                    blocks.append({"location": f"page:{number}:widget:{index}",
                                   "text": value, "page": number})
            for index, annot in enumerate(page.annots() or []):
                value = str(annot.info.get("content", ""))
                if value:
                    blocks.append({"location": f"page:{number}:annotation:{index}",
                                   "text": value, "page": number})
            has_images = bool(page.get_image_info())
            if ocr:
                _, ocr_text = _ocr_chars(image, workdir, ocr_lang, tessdata)
                blocks.append({"location": f"page:{number}:ocr", "text": ocr_text,
                               "page": number})
                if not ocr_text.strip():
                    warnings.append(f"OCR_NO_TEXT_PAGE_{number}")
            elif has_images:
                warnings.append(f"IMAGE_TEXT_REQUIRES_REVIEW_PAGE_{number}")
            if not text.strip() and not ocr:
                warnings.append(f"NO_SELECTABLE_TEXT_PAGE_{number}")
            media.append({"id": f"page-{number}", "path": str(preview.resolve()),
                          "width": image.width, "height": image.height, "kind": "page"})
            pages.append({"page": number, "width": page.rect.width,
                          "height": page.rect.height, "text_chars": len(text),
                          "has_images": has_images, "has_drawings": bool(page.get_drawings())})
    return {"text_blocks": blocks, "media": media, "pages": pages,
            "warnings": list(dict.fromkeys(warnings))}


def redact_pdf(input_path: Path, output_path: Path, policy: dict, workdir: Path) -> dict:
    source, output = Path(input_path), Path(output_path)
    _output_guard(source, output)
    if output.suffix.lower() != ".pdf":
        raise RedactionError("OUTPUT_MUST_BE_PDF")
    workdir = _private_dir(workdir)
    mode = policy.get("pdf_mode", "raster")
    if mode not in ("raster", "text"):
        raise RedactionError("INVALID_PDF_MODE")
    dpi = policy.get("dpi", 180)
    if type(dpi) is not int or not 72 <= dpi <= 400:
        raise RedactionError("DPI_MUST_BE_72_TO_400")
    use_ocr = bool(policy.get("ocr", False))
    case_sensitive = bool(policy.get("case_sensitive", False))
    terms = _terms(policy)
    counts = {"text_replacements": 0, "regions_applied": 0, "pages": 0}
    warnings, residuals, unmatched = [], [], set(range(len(terms)))
    image_coverage_unverified = False
    with _open_pdf(source) as doc, fitz.open() as fresh:
        if mode == "text" and doc.get_ocgs():
            raise RedactionError("TEXT_MODE_OPTIONAL_LAYERS_REQUIRE_RASTER")
        for number, page in enumerate(doc, 1):
            regions = _regions(policy, number, len(doc))
            chars = _pdf_chars(page)
            normalised, matches = _matches(chars, terms, case_sensitive)
            visible_text = page.get_text()
            for term in terms:
                if term["normalised"] in _normalise(visible_text, case_sensitive) and not any(
                        item["term_index"] == term["index"] for item in matches):
                    raise RedactionError("TEXT_MATCH_NOT_LOCATED")
            matches.extend(_annot_matches(page, terms, case_sensitive))
            has_images = bool(page.get_image_info())
            has_widgets = bool(list(page.widgets() or []))
            has_annots = bool(list(page.annots() or []))
            has_visual = has_images or has_widgets or has_annots or bool(page.get_drawings())
            if has_visual and terms and not visible_text.strip() and not use_ocr:
                raise RedactionError("SCANNED_PDF_REQUIRES_OCR")
            if has_images and not use_ocr:
                image_coverage_unverified = True
                warnings.append(f"IMAGE_TEXT_REQUIRES_REVIEW_PAGE_{number}")
            image = _render(page, dpi)
            ocr_matches = []
            if use_ocr:
                ocr_chars, ocr_text = _ocr_chars(image, workdir,
                    policy.get("ocr_lang", "chi_tra+eng"), policy.get("tessdata"))
                _, ocr_matches = _matches(ocr_chars, terms, case_sensitive)
                ocr_matches = _deduplicate_ocr(page, matches, ocr_matches, image.size)
                if not ocr_text.strip() and has_images:
                    image_coverage_unverified = True
                    warnings.append(f"OCR_NO_TEXT_PAGE_{number}")
                warnings.append("OCR_WORD_BOXES_REQUIRE_VISUAL_REVIEW")
            for match in matches + ocr_matches:
                unmatched.discard(match["term_index"])
            # Detections confirmed by both PDF extraction and OCR are counted once.
            counts["text_replacements"] += len(matches) + len(ocr_matches)
            counts["regions_applied"] += len(regions)
            counts["pages"] += 1
            if mode == "text":
                if has_images or has_widgets or has_annots or use_ocr:
                    raise RedactionError("TEXT_MODE_REQUIRES_PLAIN_TEXT_PDF_USE_RASTER")
                for match in matches:
                    for box in match["boxes"]:
                        rect = fitz.Rect(box) + (-0.5, -0.5, 0.5, 0.5)
                        page.add_redact_annot(rect, fill=(0, 0, 0))
                for box, color in regions:
                    display = fitz.Rect(box[0] * page.rect.width, box[1] * page.rect.height,
                                        box[2] * page.rect.width, box[3] * page.rect.height)
                    rect = display * page.derotation_matrix
                    page.add_redact_annot(rect, fill=tuple(x / 255 for x in color))
                page.apply_redactions(images=2, graphics=2, text=0)
                for link in page.get_links():
                    page.delete_link(link)
                residuals.extend(_residuals(page.get_text(), terms, f"page:{number}",
                                            case_sensitive))
            else:
                draw = ImageDraw.Draw(image)
                painted = []
                for match in matches:
                    for box in match["boxes"]:
                        pixels = _pdf_pixel_box(page, box, image.size)
                        draw.rectangle(pixels, fill=(0, 0, 0))
                        painted.append((pixels, (0, 0, 0)))
                for match in ocr_matches:
                    for box in match["boxes"]:
                        pixels = _pixel_box(box, image.size)
                        draw.rectangle(pixels, fill=(0, 0, 0))
                        painted.append((pixels, (0, 0, 0)))
                for box, color in regions:
                    pixels = _pixel_box((box[0] * image.width, box[1] * image.height,
                                         box[2] * image.width, box[3] * image.height), image.size)
                    draw.rectangle(pixels, fill=color)
                    painted.append((pixels, color))
                for box, color in painted:
                    extrema = image.crop((box[0], box[1], box[2] + 1, box[3] + 1)).getextrema()
                    if any(low != expected or high != expected
                           for (low, high), expected in zip(extrema, color)):
                        # Overlapping black/white user regions can intentionally differ.
                        # A new opposite-color rectangle still contains no source pixels.
                        palette = image.crop((box[0], box[1], box[2] + 1, box[3] + 1)).getcolors(
                            maxcolors=3)
                        if palette is None or any(c not in ((0, 0, 0), (255, 255, 255))
                                                  for _, c in palette):
                            raise RedactionError("MASK_PIXEL_VERIFICATION_FAILED")
                if use_ocr and terms:
                    _, remaining = _ocr_chars(image, workdir,
                        policy.get("ocr_lang", "chi_tra+eng"), policy.get("tessdata"))
                    residuals.extend(_residuals(remaining, terms, f"page:{number}:ocr",
                                                case_sensitive))
                blob = io.BytesIO()
                image.save(blob, format="PNG")
                outpage = fresh.new_page(width=page.rect.width, height=page.rect.height)
                outpage.insert_image(outpage.rect, stream=blob.getvalue())
        if residuals:
            raise RedactionError("KNOWN_TERM_RESIDUAL_AFTER_REDACTION")
        if mode == "text":
            # Copy only cleaned pages into a new catalogue: no source metadata,
            # attachments, outlines, JavaScript, annotations, widgets or links.
            doc.scrub(attached_files=True, clean_pages=True, embedded_files=True,
                      hidden_text=True, javascript=True, metadata=True, redactions=True,
                      redact_images=2, remove_links=True, reset_fields=True,
                      reset_responses=True, thumbnails=True, xml_metadata=True)
            fresh.insert_pdf(doc, links=False, annots=False, widgets=False)
        fresh.set_metadata({})
        fresh.del_xml_metadata()
        payload = fresh.tobytes(garbage=4, deflate=True, clean=True)
    with fitz.open(stream=payload, filetype="pdf") as check:
        if check.embfile_count() or check.get_xml_metadata():
            raise RedactionError("OUTPUT_EXTRAS_VERIFICATION_FAILED")
        for number, page in enumerate(check, 1):
            residuals.extend(_residuals(page.get_text(), terms, f"page:{number}", case_sensitive))
            if list(page.annots() or []) or list(page.widgets() or []):
                raise RedactionError("OUTPUT_ANNOTATION_VERIFICATION_FAILED")
            if mode == "raster" and page.get_text().strip():
                raise RedactionError("RASTER_HAS_UNEXPECTED_TEXT_LAYER")
        if residuals:
            raise RedactionError("KNOWN_TERM_RESIDUAL_AFTER_REDACTION")
    _write_exclusive(output, payload)
    if unmatched:
        warnings.append("SOME_TERMS_NOT_DETECTED")
    return {"counts": counts, "warnings": list(dict.fromkeys(warnings)),
            "verification": {"known_terms_absent": not terms or not image_coverage_unverified,
                             "text_targets_checked": len(terms) if not image_coverage_unverified else 0,
                             "unknown_text_detection_performed": False,
                             "raster_rebuilt": mode == "raster",
                             "detected_masks_applied": True,
                             "original_objects_removed": mode == "raster",
                             "visual_review_required": True,
                             "ocr_used": use_ocr},
            "residuals": residuals, "unmatched_term_indices": sorted(unmatched)}


def _open_image(path: Path):
    if path.suffix.lower() not in SUPPORTED_IMAGES:
        raise RedactionError("UNSUPPORTED_IMAGE_FORMAT")
    try:
        with Image.open(path) as source:
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise RedactionError("IMAGE_PIXEL_LIMIT")
            if getattr(source, "n_frames", 1) != 1:
                raise RedactionError("MULTIFRAME_IMAGE_UNSUPPORTED")
            oriented = ImageOps.exif_transpose(source)
            rgba = oriented.convert("RGBA")
            base = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            base.alpha_composite(rgba)
            return base.convert("RGB")
    except RedactionError:
        raise
    except Exception as exc:
        raise RedactionError("IMAGE_OPEN_FAILED") from exc


def inspect_image(input_path: Path, workdir: Path, ocr=False,
                  ocr_lang="chi_tra+eng", tessdata=None) -> dict:
    source, workdir = Path(input_path), _private_dir(workdir)
    image = _open_image(source)
    preview = workdir / "page-1.png"
    image.save(preview)
    preview.chmod(0o600)
    text, warnings = "", []
    if ocr:
        _, text = _ocr_chars(image, workdir, ocr_lang, tessdata)
        if not text.strip():
            warnings.append("OCR_NO_TEXT_PAGE_1")
    else:
        warnings.append("IMAGE_TEXT_REQUIRES_REVIEW_PAGE_1")
    return {"text_blocks": [{"location": "image:1:ocr", "text": text, "page": 1}],
            "media": [{"id": "page-1", "path": str(preview.resolve()),
                       "width": image.width, "height": image.height, "kind": "image",
                       "sha256": hashlib.sha256(source.read_bytes()).hexdigest()}],
            "pages": [{"page": 1, "width": image.width, "height": image.height,
                       "text_chars": len(text), "has_images": True}], "warnings": warnings}


def redact_image(input_path: Path, output_path: Path, policy: dict, workdir: Path) -> dict:
    source, output = Path(input_path), Path(output_path)
    _output_guard(source, output)
    if output.suffix.lower() not in SUPPORTED_IMAGES:
        raise RedactionError("UNSUPPORTED_IMAGE_OUTPUT")
    workdir = _private_dir(workdir)
    image = _open_image(source)
    terms, regions = _terms(policy), _regions(policy, 1, 1)
    use_ocr = bool(policy.get("ocr", False))
    if terms and not use_ocr:
        raise RedactionError("IMAGE_TEXT_REDACTION_REQUIRES_OCR")
    matches, residuals, warnings = [], [], []
    if use_ocr:
        chars, text = _ocr_chars(image, workdir, policy.get("ocr_lang", "chi_tra+eng"),
                                 policy.get("tessdata"))
        _, matches = _matches(chars, terms, policy.get("case_sensitive", False))
        if not text.strip():
            warnings.append("OCR_NO_TEXT_PAGE_1")
        warnings.append("OCR_WORD_BOXES_REQUIRE_VISUAL_REVIEW")
    draw = ImageDraw.Draw(image)
    for match in matches:
        for box in match["boxes"]:
            draw.rectangle(_pixel_box(box, image.size), fill=(0, 0, 0))
    for box, color in regions:
        pixels = (box[0] * image.width, box[1] * image.height,
                  box[2] * image.width, box[3] * image.height)
        draw.rectangle(_pixel_box(pixels, image.size), fill=color)
    if use_ocr and terms:
        _, after = _ocr_chars(image, workdir, policy.get("ocr_lang", "chi_tra+eng"),
                             policy.get("tessdata"))
        residuals = _residuals(after, terms, "image:1:ocr", policy.get("case_sensitive", False))
        if residuals:
            raise RedactionError("KNOWN_TERM_RESIDUAL_AFTER_REDACTION")
    # Re-encode a clean RGB image, without original EXIF, comments or profiles.
    clean = Image.new("RGB", image.size)
    clean.paste(image)
    buffer = io.BytesIO()
    suffix = output.suffix.lower()
    if suffix in (".jpg", ".jpeg"):
        clean.save(buffer, format="JPEG", quality=95, subsampling=0)
    elif suffix == ".webp":
        clean.save(buffer, format="WEBP", lossless=True)
    else:
        clean.save(buffer, format="PNG")
    _write_exclusive(output, buffer.getvalue())
    return {"counts": {"text_replacements": len(matches), "regions_applied": len(regions),
                       "pages": 1}, "warnings": warnings,
            "verification": {"known_terms_absent": not terms or (
                                 use_ocr and "OCR_NO_TEXT_PAGE_1" not in warnings),
                             "text_targets_checked": len(terms) if use_ocr else 0,
                             "unknown_text_detection_performed": False,
                             "raster_rebuilt": True, "original_objects_removed": True,
                             "visual_review_required": True, "ocr_used": use_ocr},
            "residuals": residuals}
