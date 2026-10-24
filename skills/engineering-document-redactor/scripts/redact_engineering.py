#!/usr/bin/env python3
"""Local engineering-document redaction: inspect, review, apply, verify.

No network calls. Private review files may contain source data. CLI receipts do not.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from datetime import datetime, timezone

VERSION = "0.1.0"
SUPPORTED = {".docx": "docx", ".pdf": "pdf", ".png": "image", ".jpg": "image", ".jpeg": "image"}
MAX_INPUT_BYTES = 100 * 1024 * 1024
MAX_POLICY_BYTES = 2 * 1024 * 1024


class RedactionError(Exception):
    def __init__(self, code: str, message: str):
        self.code, self.message = code, message
        super().__init__(message)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def private_json(path: Path, value: dict | list) -> None:
    if path.exists() or path.is_symlink():
        raise RedactionError("EXISTING_FILE", "Choose a new work directory or output name.")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_json(path: Path, maximum: int = MAX_POLICY_BYTES):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > maximum:
        raise RedactionError("INVALID_JSON_FILE", "The JSON file must be a regular, bounded local file.")
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def source_path(value: str) -> Path:
    p = Path(value).expanduser()
    if p.is_symlink() or not p.is_file():
        raise RedactionError("INVALID_SOURCE", "The source must be a regular local file, not a symlink.")
    p = p.resolve()
    if p.suffix.lower() not in SUPPORTED:
        raise RedactionError("UNSUPPORTED_FORMAT", "Use DOCX, PDF, PNG or JPEG. Legacy DOC, CAD and other formats need an explicit conversion step.")
    if not 0 < p.stat().st_size <= MAX_INPUT_BYTES:
        raise RedactionError("INPUT_SIZE_LIMIT", "The source must be nonempty and at most 100 MiB.")
    return p


def new_workdir(value: str) -> Path:
    p = Path(value).expanduser()
    if p.exists() or p.is_symlink():
        raise RedactionError("EXISTING_WORKDIR", "Use a new work directory; existing review data is never overwritten.")
    p.mkdir(parents=True, mode=0o700)
    try:
        p.chmod(0o700)
    except OSError:
        pass
    return p.resolve()


def valid_box(box) -> list[float]:
    if not isinstance(box, list) or len(box) != 4:
        raise RedactionError("INVALID_REGION", "A region must contain four normalized coordinates.")
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in box):
        raise RedactionError("INVALID_REGION", "Region coordinates must be finite numbers.")
    if not (0 <= box[0] < box[2] <= 1 and 0 <= box[1] < box[3] <= 1):
        raise RedactionError("INVALID_REGION", "Region coordinates must satisfy 0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1.")
    return [float(v) for v in box]


def normalize_terms(items) -> list[dict]:
    if not isinstance(items, list) or len(items) > 2000:
        raise RedactionError("INVALID_TERMS", "terms must be a list of at most 2000 entries.")
    seen, result = {}, []
    for item in items:
        if isinstance(item, str):
            item = {"text": item}
        if not isinstance(item, dict):
            raise RedactionError("INVALID_TERM", "Every term must be a string or an object.")
        term = item.get("text", item.get("value", ""))
        replacement = item.get("replacement", "[已遮蔽]")
        category = item.get("category", "CUSTOM")
        if not isinstance(term, str) or not term.strip() or len(term) > 1000:
            raise RedactionError("INVALID_TERM", "A term must contain 1 to 1000 characters.")
        if not isinstance(replacement, str) or len(replacement) > 1000:
            raise RedactionError("INVALID_REPLACEMENT", "Replacement text must be a string of at most 1000 characters.")
        if term.casefold() in replacement.casefold():
            raise RedactionError("REPLACEMENT_LEAK", "Replacement text must not contain the original term.")
        key = term.casefold()
        if key in seen and seen[key] != replacement:
            raise RedactionError("CONFLICTING_TERMS", "The same term has conflicting replacements.")
        if key not in seen:
            seen[key] = replacement
            result.append({"text": term, "replacement": replacement, "category": str(category)[:80]})
    return sorted(result, key=lambda x: len(x["text"]), reverse=True)


def validate_policy(policy: dict, src: Path, require_review: bool = True) -> dict:
    if not isinstance(policy, dict) or policy.get("version") != 1:
        raise RedactionError("POLICY_VERSION", "Use a version 1 policy generated by inspect.")
    if policy.get("source_sha256") != sha256(src):
        raise RedactionError("SOURCE_CHANGED", "The policy does not match the current source bytes. Inspect again.")
    if policy.get("kind") != SUPPORTED[src.suffix.lower()]:
        raise RedactionError("POLICY_KIND", "The policy format does not match the input format.")
    review = policy.get("review", {})
    if require_review and (review.get("text_checked") is not True or review.get("visual_checked") is not True):
        raise RedactionError("REVIEW_REQUIRED", "Review both the text candidates and the page/image previews, then export a reviewed policy.")
    policy = dict(policy)
    policy["terms"] = normalize_terms(policy.get("terms", []))
    if policy.get("case_sensitive", False) not in (True, False):
        raise RedactionError("INVALID_CASE_OPTION", "case_sensitive must be boolean.")
    if policy.get("pdf_mode", "raster") not in ("raster", "text"):
        raise RedactionError("INVALID_PDF_MODE", "pdf_mode must be raster or text.")
    dpi = policy.get("dpi", 180)
    if isinstance(dpi, bool) or not isinstance(dpi, int) or not 100 <= dpi <= 300:
        raise RedactionError("INVALID_DPI", "Choose an integer PDF DPI from 100 through 300.")
    regions = policy.get("regions", [])
    media = policy.get("media", [])
    if not isinstance(regions, list) or len(regions) > 10000 or not isinstance(media, list) or len(media) > 2000:
        raise RedactionError("INVALID_REGION_LIST", "Regions and media must be bounded lists.")
    for r in regions:
        if not isinstance(r, dict) or isinstance(r.get("page"), bool) or not isinstance(r.get("page"), int) or r["page"] < 1:
            raise RedactionError("INVALID_PAGE", "Every region requires a one-based page number.")
        valid_box(r.get("box"))
        if r.get("color", "black") not in ("black", "white"):
            raise RedactionError("INVALID_COLOR", "Use an opaque black or white fill.")
    for m in media:
        if not isinstance(m, dict) or not isinstance(m.get("id"), str) or m.get("action") not in ("blank", "regions", "keep"):
            raise RedactionError("INVALID_MEDIA_ACTION", "A media action must be blank, regions or reviewed keep.")
        if m["action"] == "keep" and m.get("reviewed") is not True:
            raise RedactionError("MEDIA_REVIEW_REQUIRED", "Every retained image must have reviewed=true.")
        if m.get("color", "black") not in ("black", "white"):
            raise RedactionError("INVALID_COLOR", "Use an opaque black or white fill.")
        if m["action"] == "regions":
            if not isinstance(m.get("regions"), list) or not m["regions"]:
                raise RedactionError("EMPTY_IMAGE_REGIONS", "A region action needs at least one region.")
            for box in m["regions"]:
                valid_box(box)
    if not policy["terms"] and not regions and not any(m.get("action") != "keep" for m in media):
        raise RedactionError("NO_TARGETS", "No removal targets were selected. An unchanged file will not be labeled redacted.")
    return policy


def set_ocr_env(tessdata: str | None):
    if tessdata:
        p = Path(tessdata).expanduser().resolve()
        if not p.is_dir():
            raise RedactionError("TESSDATA_MISSING", "The configured Tesseract language directory does not exist.")
        os.environ["TESSDATA_PREFIX"] = str(p)


def inspect_source(src: Path, work: Path, ocr: bool, lang: str) -> dict:
    kind = SUPPORTED[src.suffix.lower()]
    if kind == "docx":
        if ocr:
            raise RedactionError("DOCX_OCR_UNSUPPORTED", "DOCX embedded-image OCR is not implemented. Review each embedded image, or explicitly convert a copy to PDF for OCR.")
        from docx_backend import inspect_docx
        return inspect_docx(src, work)
    from pdf_backend import inspect_pdf, inspect_image
    if kind == "pdf":
        return inspect_pdf(src, work, ocr=ocr, ocr_lang=lang)
    return inspect_image(src, work, ocr=ocr, ocr_lang=lang)


def inspect_command(args) -> dict:
    from detect_entities import detect_candidates
    from review_ui import write_review
    src = source_path(args.input)
    work = new_workdir(args.workdir)
    set_ocr_env(args.tessdata)
    original_hash = sha256(src)
    content = inspect_source(src, work / "previews", args.ocr, args.ocr_lang)
    if sha256(src) != original_hash:
        raise RedactionError("SOURCE_CHANGED", "Source bytes changed while inspecting.")
    candidates = detect_candidates(content.get("text_blocks", []))
    supplied = []
    if args.terms:
        obj = load_json(Path(args.terms))
        supplied = normalize_terms(obj if isinstance(obj, list) else obj.get("terms", []))
    draft = {
        "version": 1, "source_sha256": original_hash,
        "kind": SUPPORTED[src.suffix.lower()],
        "terms": supplied,
        "media": [], "regions": [], "pdf_mode": "raster", "dpi": 180,
        "ocr": args.ocr, "ocr_lang": args.ocr_lang,
        "case_sensitive": False, "sanitize": True, "accept_revisions": True,
        "review": {"text_checked": False, "visual_checked": False},
    }
    if args.tessdata:
        draft["tessdata"] = str(Path(args.tessdata).expanduser().resolve())
    manifest = {
        "version": VERSION, "classification": "PRIVATE_SOURCE_REVIEW",
        "source_sha256": original_hash, "kind": draft["kind"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "candidates": candidates, "inspection": content,
        "notes": ["This review contains original source text and images. Keep it local.",
                  "Candidate detection is rule based; unlabelled names and logos require visual review."]
    }
    private_json(work / "manifest.private.json", manifest)
    private_json(work / "policy.draft.json", draft)
    write_review(work / "review.private.html", manifest, draft)
    return {"status": "REVIEW_REQUIRED", "version": VERSION,
            "candidate_count": len(candidates), "preview_count": len(content.get("media", [])),
            "review_path": str(work / "review.private.html"),
            "manifest_path": str(work / "manifest.private.json"),
            "policy_draft_path": str(work / "policy.draft.json"),
            "warning_count": len(content.get("warnings", [])),
            "privacy": "Review files contain original data; stdout contains no candidate values."}


def apply_command(args) -> dict:
    src = source_path(args.input)
    policy = validate_policy(load_json(Path(args.policy)), src)
    out = Path(args.output).expanduser()
    if out.is_symlink() or out.exists() or out.resolve() == src:
        raise RedactionError("OUTPUT_EXISTS", "Choose a new output path. Source files and existing outputs are never overwritten.")
    if out.suffix.lower() != src.suffix.lower():
        raise RedactionError("OUTPUT_FORMAT", "Output extension must match the source extension.")
    out.parent.mkdir(parents=True, exist_ok=True)
    out = out.absolute()
    report_path = Path(str(out) + ".report.json")
    if report_path.exists() or report_path.is_symlink():
        raise RedactionError("REPORT_EXISTS", "Choose a new output/report name.")
    source_hash = sha256(src)
    set_ocr_env(policy.get("tessdata"))
    with tempfile.TemporaryDirectory(prefix="redaction-", dir=out.parent) as tmp:
        work = Path(tmp)
        staged = work / ("redacted" + out.suffix.lower())
        if policy["kind"] == "docx":
            from docx_backend import redact_docx
            result = redact_docx(src, staged, policy, work / "processing")
        else:
            from pdf_backend import redact_pdf, redact_image
            backend = redact_pdf if policy["kind"] == "pdf" else redact_image
            result = backend(src, staged, policy, work / "processing")
        verification = result.get("verification", {})
        if verification.get("known_terms_absent") is not True or result.get("residuals"):
            raise RedactionError("RESIDUAL_CHECK_FAILED", "Selected sensitive terms remain or verification could not complete. No deliverable was released.")
        if policy["kind"] == "docx" and verification.get("media_verified") is not True:
            raise RedactionError("MEDIA_REVIEW_REQUIRED", "Review every embedded image, including images to retain.")
        if not staged.is_file() or staged.stat().st_size == 0:
            raise RedactionError("NO_OUTPUT", "The backend produced no valid output.")
        counts = result.get("counts", {})
        if not any(counts.get(key, 0) > 0 for key in ("text_replacements", "media_modified", "regions_applied")):
            raise RedactionError("NO_MATCHED_TARGETS", "No selected text or visual removal target was applied. Review the source, spelling and regions.")
        if sha256(src) != source_hash:
            raise RedactionError("SOURCE_CHANGED", "Source bytes changed during processing; no output was released.")
        report = {
            "status": "SELECTED_TARGET_CHECKS_PASSED", "version": VERSION,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source_sha256": source_hash, "output_sha256": sha256(staged),
            "policy_sha256": sha256(Path(args.policy)),
            "kind": policy["kind"], "counts": result.get("counts", {}),
            "verification": verification,
            "text_review_recorded": True, "visual_review_recorded": True,
            "warning_count": len(result.get("warnings", [])),
            "warnings": [w for w in result.get("warnings", []) if isinstance(w, str) and re.fullmatch(r"[A-Z0-9_]{3,120}", w)],
            "unmatched_term_indices": result.get("unmatched_term_indices", []),
            "scope": "Only selected terms and regions plus supported package sanitization were verified. Unknown identifiers and semantic re-identification are outside this result.",
        }
        # Exclusive copy prevents overwriting a concurrently created path.
        fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "wb") as dest, staged.open("rb") as f:
                shutil.copyfileobj(f, dest)
            private_json(report_path, report)
        except Exception:
            out.unlink(missing_ok=True)
            raise
    return {"status": report["status"], "version": VERSION, "output_path": str(out),
            "report_path": str(report_path), "counts": report["counts"],
            "warning_count": report["warning_count"], "scope": report["scope"]}


def folded(text: str) -> str:
    return "".join(unicodedata.normalize("NFKC", text).split()).casefold()


def verify_command(args) -> dict:
    out = source_path(args.input)
    policy = load_json(Path(args.policy))
    terms = normalize_terms(policy.get("terms", []))
    set_ocr_env(args.tessdata or policy.get("tessdata"))
    with tempfile.TemporaryDirectory(prefix="redaction-verify-") as tmp:
        content = inspect_source(out, Path(tmp), args.ocr, args.ocr_lang)
        blocks = content.get("text_blocks", [])
        residual_indices = [i for i, t in enumerate(terms) if any(folded(t["text"]) in folded(b.get("text", "")) for b in blocks)]
        kind = SUPPORTED[out.suffix.lower()]
        coverage_warnings = []
        if not terms:
            coverage_warnings.append("NO_TEXT_TARGETS_SELECTED")
        if kind == "docx" and content.get("media"):
            coverage_warnings.append("DOCX_EMBEDDED_IMAGE_TEXT_NOT_CHECKED")
        if kind == "image" and not args.ocr:
            coverage_warnings.append("IMAGE_TEXT_REQUIRES_OCR")
        if kind == "pdf" and not args.ocr:
            if any(p.get("has_images") or p.get("has_drawings") for p in content.get("pages", [])):
                coverage_warnings.append("PDF_VISUAL_CONTENT_REQUIRES_OCR")
            if any(not p.get("text_chars") for p in content.get("pages", [])):
                coverage_warnings.append("PDF_PAGE_WITHOUT_SELECTABLE_TEXT")
        if args.ocr and any(str(w).startswith("OCR_NO_TEXT_PAGE_") for w in content.get("warnings", [])):
            coverage_warnings.append("OCR_EMPTY_PAGE_REQUIRES_VISUAL_REVIEW")
        result = {"status": "FAIL" if residual_indices else "INCONCLUSIVE" if coverage_warnings else "KNOWN_TEXT_TARGETS_ABSENT",
                  "output_sha256": sha256(out), "residual_term_indices": residual_indices,
                  "text_targets_checked": len(terms), "text_blocks_checked": len(blocks),
                  "ocr_used": bool(args.ocr and kind in ("pdf", "image")),
                  "coverage_warnings": coverage_warnings,
                  "known_terms_absent_in_checked_text": not residual_indices if terms else None,
                  "scope": "Text/OCR check of known terms only. This does not prove all identifiers or logos were detected; inspect the rendered output."}
    if args.report:
        private_json(Path(args.report), result)
    return result


def doctor_command(args) -> dict:
    set_ocr_env(args.tessdata)
    modules = {name: importlib.util.find_spec(name) is not None for name in ("fitz", "PIL", "lxml")}
    tesseract = shutil.which("tesseract")
    langs = []
    if tesseract:
        p = subprocess.run([tesseract, "--list-langs"], capture_output=True, text=True, timeout=20)
        langs = [s.strip() for s in p.stdout.splitlines()[1:] if s.strip()]
    return {"version": VERSION, "status": "READY" if all(modules.values()) else "DEPENDENCIES_MISSING",
            "python": sys.version.split()[0], "modules": modules, "tesseract_available": bool(tesseract),
            "ocr_languages": langs, "traditional_chinese_ocr_ready": "chi_tra" in langs and "eng" in langs,
            "network_required_for_processing": False,
            "note": "Install dependencies and OCR language data separately before disconnected operation."}


def parser():
    p = argparse.ArgumentParser(description="工程文件遮蔽 — 本地候選檢查、Word/PDF/影像實際移除與驗證")
    p.add_argument("--version", action="version", version=VERSION)
    sub = p.add_subparsers(dest="command", required=True)
    d = sub.add_parser("doctor", help="Check dependencies; never installs or sends documents anywhere")
    d.add_argument("--tessdata")
    i = sub.add_parser("inspect", help="Create a private local review with candidate names and image/page previews")
    i.add_argument("input")
    i.add_argument("--workdir", required=True)
    i.add_argument("--terms", help="Optional JSON terms list")
    i.add_argument("--ocr", action="store_true")
    i.add_argument("--ocr-lang", default="chi_tra+eng")
    i.add_argument("--tessdata")
    a = sub.add_parser("apply", help="Apply a reviewed, source-bound policy; never overwrites")
    a.add_argument("input")
    a.add_argument("--policy", required=True)
    a.add_argument("--output", required=True)
    v = sub.add_parser("verify", help="Independently search the output for selected terms; images need OCR")
    v.add_argument("input")
    v.add_argument("--policy", required=True)
    v.add_argument("--report")
    v.add_argument("--ocr", action="store_true")
    v.add_argument("--ocr-lang", default="chi_tra+eng")
    v.add_argument("--tessdata")
    return p


def main(argv=None) -> int:
    args = parser().parse_args(argv)
    try:
        result = {"inspect": inspect_command, "apply": apply_command,
                  "verify": verify_command, "doctor": doctor_command}[args.command](args)
        print(json.dumps(result, ensure_ascii=False))
        return 1 if result["status"] in ("FAIL", "INCONCLUSIVE", "DEPENDENCIES_MISSING") else 0
    except RedactionError as e:
        print(json.dumps({"status": "ERROR", "code": e.code, "message": e.message}, ensure_ascii=False))
        return 2
    except Exception as e:
        # No raw exception text: parsers/OCR may include original document content.
        backend_code = getattr(e, "code", "PROCESSING_FAILED")
        if not isinstance(backend_code, str) or not re.fullmatch(r"[A-Z0-9_]{3,120}", backend_code):
            backend_code = "PROCESSING_FAILED"
        print(json.dumps({"status": "ERROR", "code": backend_code, "error_type": type(e).__name__,
                          "message": "Processing stopped. No complete result is claimed. Check dependencies, policy and supported format limits; do not expose private source logs."}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
