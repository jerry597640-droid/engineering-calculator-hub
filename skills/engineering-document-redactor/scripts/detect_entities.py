"""Local, conservative candidates for Traditional-Chinese engineering documents.

This is a rule-based *candidate* detector, not a completeness guarantee or an NER
model. It makes no network requests, downloads no model, and does not modify input.
Candidate values contain the original sensitive text: if a cloud agent reads the
result, that agent sees those values. Local execution alone is not cloud isolation.

Checksum references, checked 2026-10-25:
* Taiwan business ID (new modulo-5 rule and seventh-digit-7 exception):
  https://www.fia.gov.tw/singlehtml/3?cntId=c4d9cff38c8642ef8872774ee9987283
* National ID format/checksum, NHI's published declaration specification:
  https://www.nhi.gov.tw/ch/dl-91014-0ef6af7e64894c00acba8cecc6bddd3e-1.pdf
Passing a checksum does not establish that an identifier was actually issued.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
import unicodedata


CATEGORIES = (
    "PROJECT", "ORG", "PERSON", "EMAIL", "TW_MOBILE", "TW_PHONE",
    "TW_NATIONAL_ID", "TW_BUSINESS_ID", "ADDRESS",
)

_ID_LETTER_VALUES = dict(zip(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    (10, 11, 12, 13, 14, 15, 16, 17, 34, 18, 19, 20, 21,
     22, 35, 23, 24, 25, 26, 27, 28, 29, 32, 30, 31, 33),
))
_HAN = r"\u3400-\u9fff\U00020000-\U0002FA1F"
_LABELS = {
    "PROJECT": ["工程名稱", "工程名", "專案名稱", "專案名", "計畫名稱", "案件名稱", "案名", "工程", "Project name", "Project"],
    "ORG": ["公司名稱", "公司全名", "業主名稱", "業主", "起造人", "設計單位", "設計公司", "監造單位", "監造公司", "監造", "營造單位", "營造廠商", "營造公司", "營造廠", "承攬廠商", "承包廠商", "承包商", "分包商", "顧問公司", "廠商名稱", "廠商", "所屬單位", "單位名稱", "公司", "Company name", "Company", "Client", "Contractor", "Consultant"],
    "PERSON": ["聯絡人姓名", "聯絡人", "承辦人員", "承辦人", "承辦", "技師姓名", "建築師姓名", "負責人姓名", "負責人", "工地主任", "專案經理", "監工姓名", "姓名", "技師", "建築師", "Contact person", "Contact name", "Prepared by", "Engineer", "Name"],
    "EMAIL": ["電子郵件", "電子信箱", "信箱", "E-mail", "Email"],
    "TW_MOBILE": ["行動電話", "手機號碼", "手機", "Mobile", "Cell"],
    "TW_PHONE": ["聯絡電話", "連絡電話", "電話號碼", "市話", "電話", "傳真", "Phone", "Telephone", "Tel", "Fax"],
    "TW_NATIONAL_ID": ["身分證統一編號", "身份證統一編號", "身分證字號", "身份證字號", "身分證號碼", "身份證號碼", "身分證", "身份證", "National ID"],
    "TW_BUSINESS_ID": ["營利事業統一編號", "公司統一編號", "統一編號", "統編號", "統編", "Business ID", "Tax ID"],
    "ADDRESS": ["工程地址", "工地地址", "工址", "工程地點", "基地位置", "通訊地址", "聯絡地址", "公司地址", "地址", "Site address", "Mailing address", "Address"],
}
_LABEL_CATEGORY = {label.casefold(): cat for cat, labels in _LABELS.items() for label in labels}
def _label_pattern(label: str) -> str:
    if re.fullmatch("[" + _HAN + "]+", label):
        return "[ \\t]*".join(re.escape(char) for char in label)
    return re.escape(label)


def _canonical_label(label: str) -> str:
    if re.search("[" + _HAN + "]", label):
        label = re.sub(r"[ \t]+", "", label)
    return label.casefold()


_LABEL_ALTERNATION = "|".join(_label_pattern(x) for x in sorted(_LABEL_CATEGORY, key=len, reverse=True))
_FIELD = re.compile(
    r"(?<![A-Za-z0-9" + _HAN + r"])(?P<label>" + _LABEL_ALTERNATION + r")"
    r"(?:[ \t]*[:=][ \t]*|[ \t]*\n[ \t]*|[ \t]{1,})", re.I,
)
_EMAIL = re.compile(r"(?<![A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.\-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,24}(?![A-Za-z0-9\-])")
_MOBILE = re.compile(r"(?<![A-Za-z0-9])(?:09\d{2}|\+886[ \t\-]?9\d{2})[ \t\-]?\d{3}[ \t\-]?\d{3}(?![A-Za-z0-9])")
_PHONE = re.compile(
    r"(?<![A-Za-z0-9])(?:\(0[2-8]\d{0,2}\)|0[2-8]\d{0,2}|\+886[ \t\-]?[2-8]\d{0,2})"
    r"[ \t\-]?\d{3,4}[ \t\-]?\d{3,4}"
    r"(?:[ \t]*(?:分機|ext\.?|#)[ \t]*\d{1,6})?(?![A-Za-z0-9])", re.I,
)
_NATIONAL_ID = re.compile(r"(?<![A-Za-z0-9])[A-Za-z][12]\d{8}(?![A-Za-z0-9])")
_ORG_SUFFIX = r"(?:股份有限公司|有限公司|有限責任公司|建築師事務所|技師事務所|聯合事務所|事務所|企業社|公司)"
_CHINESE_ORG = re.compile(r"(?<![" + _HAN + r"A-Za-z0-9])([" + _HAN + r"A-Za-z0-9·‧&.\-]{2,64}?" + _ORG_SUFFIX + r")")
_ENGLISH_ORG = re.compile(r"(?<![A-Za-z0-9])(?:[A-Z][A-Za-z0-9&'\-]*[ \t]+){1,7}(?:Co\.,?[ \t]*Ltd\.?|Ltd\.?|Inc\.?|Corporation|LLC|Limited)(?![A-Za-z0-9])")
_PROJECT_END = re.compile(r"^.{3,96}(?:新建|統包|改建|增建|補強|拆除|改善|整建|修繕)工程$")
_PLACEHOLDER = re.compile(r"^(?:無|不詳|未知|未填|未定|待定|待填|N/?A|None|null|[-_—–□○\s]+|\[[^\]]*\])$", re.I)
_ENGINEERING_VALUE = re.compile(r"^(?:[A-Za-z]+\d+(?:[-/]\w+)?|\d+(?:\.\d+)?(?:[x×*]\d+(?:\.\d+)?)*(?:\s*(?:mm|cm|m|kg|tf|kN|MPa|kPa|kg/cm2|t/m2))?)$", re.I)
_STRIP = " \t\r\n:：=;；|，,。\"'「」『』"
_EXTENSION = re.compile(r"[ \t]*(?:分機|ext\.?|#)[ \t]*\d{1,6}$", re.I)


def validate_tw_national_id(value: str) -> bool:
    """Check ROC national-ID syntax/checksum, not existence or ownership."""
    value = unicodedata.normalize("NFKC", value).upper()
    if not re.fullmatch(r"[A-Z][12][0-9]{8}", value):
        return False
    n = _ID_LETTER_VALUES[value[0]]
    digits = [n // 10, n % 10] + [int(x) for x in value[1:]]
    return sum(a * b for a, b in zip(digits, (1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1))) % 10 == 0


def validate_tw_business_id(value: str) -> bool:
    """Use the 2023-compatible modulo-5 check, including digit-seven=7."""
    value = unicodedata.normalize("NFKC", value)
    if not re.fullmatch(r"[0-9]{8}", value) or value == "00000000":
        return False
    products = [int(n) * w for n, w in zip(value, (1, 2, 1, 2, 1, 2, 4, 1))]
    total = sum(n // 10 + n % 10 for n in products)
    return total % 5 == 0 or (value[6] == "7" and (total + 1) % 5 == 0)


def _normalise_with_map(value: str) -> tuple[str, list[int]]:
    chars, positions = [], []
    for i, char in enumerate(value):
        for normal in unicodedata.normalize("NFKC", char):
            chars.append(normal)
            positions.append(i)
    return "".join(chars), positions


def _phone_kind(value: str) -> str | None:
    plain = _EXTENSION.sub("", value)
    digits = re.sub(r"[^0-9]", "", plain)
    if plain.lstrip().startswith("+886"):
        digits = "0" + digits[3:]
    if re.fullmatch(r"09[0-9]{8}", digits):
        return "TW_MOBILE"
    lengths = {"02": (8,), "03": (7,), "037": (6,), "04": (7, 8), "049": (7,),
               "05": (7,), "06": (7,), "07": (7,), "08": (7,), "082": (6,),
               "0826": (5,), "0836": (5,), "089": (6,)}
    for area in sorted(lengths, key=len, reverse=True):
        if digits.startswith(area) and len(digits) - len(area) in lengths[area]:
            return "TW_PHONE"
    return None


@dataclass
class _Occurrence:
    category: str
    start: int
    end: int
    confidence: str
    reason: str


def _trim_span(text: str, start: int, end: int) -> tuple[int, int]:
    while start < end and text[start] in _STRIP:
        start += 1
    while end > start and text[end - 1] in _STRIP:
        end -= 1
    return start, end


def _valid_name(value: str) -> bool:
    compact = re.sub(r"[ \t]+", "", value)
    if re.fullmatch(r"[" + _HAN + r"·‧・]{2,12}", compact):
        return not re.search(_ORG_SUFFIX + r"$|(?:單位|人員|工程|技師|建築師|負責人)$", compact)
    return bool(re.fullmatch(r"[A-Za-z][A-Za-z'\-]*(?:[ \t]+[A-Za-z][A-Za-z.'\-]*){1,5}", value))


def _label_occurrences(text: str) -> list[_Occurrence]:
    fields = list(_FIELD.finditer(text))
    found: list[_Occurrence] = []
    for i, field in enumerate(fields):
        label = _canonical_label(field.group("label"))
        category = _LABEL_CATEGORY[label]
        start = field.end()
        end = text.find("\n", start)
        if end < 0:
            end = len(text)
        if i + 1 < len(fields):
            end = min(end, fields[i + 1].start())
        # Semicolon and table-pipe delimit fields. Commas belong to English names.
        cut = re.search(r"[;；|]", text[start:end])
        if cut:
            end = start + cut.start()
        start, end = _trim_span(text, start, end)
        value = text[start:end]
        if not value or len(value) > 160 or _PLACEHOLDER.fullmatch(value):
            continue
        confidence = "high"
        reason = "explicit_label:" + field.group("label")
        if category == "PERSON":
            # Separate multiple explicitly labelled people, never guess unlabelled names.
            for match in re.finditer(r"[^、,，/／&＆]+", value):
                a, b = _trim_span(text, start + match.start(), start + match.end())
                name = text[a:b]
                title = re.search(r"[ \t]+(?:技師|建築師|先生|女士|小姐|經理)$", name)
                if title:
                    b = a + title.start()
                    name = text[a:b]
                if _valid_name(name):
                    found.append(_Occurrence(category, a, b, confidence, reason))
            continue
        if category in ("TW_NATIONAL_ID", "TW_BUSINESS_ID"):
            pattern = r"[A-Za-z][0-9]{9}" if category == "TW_NATIONAL_ID" else r"[0-9]{8}"
            match = re.fullmatch(pattern, value)
            if not match:
                continue
            valid = validate_tw_national_id(value) if category == "TW_NATIONAL_ID" else validate_tw_business_id(value)
            confidence = "high" if valid else "review"
            reason += ";checksum_" + ("valid" if valid else "invalid_review_original")
        elif category in ("TW_PHONE", "TW_MOBILE"):
            if not re.fullmatch(r"[+()0-9 \t\-]+(?:(?:分機|ext\.?|#)[ \t]*\d{1,6})?", value, re.I):
                continue
            kind = _phone_kind(value)
            if kind:
                category = kind
            elif len(re.sub(r"\D", "", value)) < 7:
                continue
            else:
                confidence = "review"
                reason += ";unconfirmed_phone_format"
        elif category == "EMAIL":
            if not _EMAIL.fullmatch(value):
                continue
        elif category == "ORG":
            # A Chinese name followed by an English name in parentheses is two aliases.
            alias = re.search(r"[ \t]*\((?=[^)]*[A-Za-z])([^)]{3,100})\)$", value)
            if alias:
                alias_a, alias_b = start + alias.start(1), start + alias.end(1)
                found.append(_Occurrence(category, alias_a, alias_b, "review", reason + ";parenthesized_alias"))
                end = start + alias.start()
                start, end = _trim_span(text, start, end)
                value = text[start:end]
            if len(value) < 2 or _ENGINEERING_VALUE.fullmatch(value):
                continue
        elif category == "PROJECT":
            if len(value) < 3 or _ENGINEERING_VALUE.fullmatch(value):
                continue
        elif category == "ADDRESS":
            if len(value) < 4 or _ENGINEERING_VALUE.fullmatch(value):
                continue
            confidence = "high" if re.search(r"[縣市區鄉鎮路街號巷弄]|\b(?:Road|Rd|Street|St|Avenue|Ave)\b", value, re.I) else "review"
        found.append(_Occurrence(category, start, end, confidence, reason))
    return found


def detect_candidates(text_blocks: list[dict]) -> list[dict]:
    """Return deduplicated candidate values and locations for human/agent review.

    Output item keys: category, value, confidence (high/review), reason, locations.
    All values are original input slices, including fullwidth letters and digits.
    Eight-digit numbers are only business-ID candidates when explicitly labelled;
    this intentionally avoids flagging quantities, dates and engineering codes.
    """
    if not isinstance(text_blocks, list):
        raise TypeError("text_blocks must be a list")
    merged: dict[tuple[str, str], dict] = {}
    previous_label: str | None = None
    for index, block in enumerate(text_blocks):
        if not isinstance(block, dict) or not isinstance(block.get("text"), str):
            raise TypeError("each text block must contain a string text")
        original = block["text"]
        text, positions = _normalise_with_map(original)
        location = str(block.get("location") or ("block-" + str(index + 1)))
        occurrences = _label_occurrences(text)
        if previous_label and text.strip():
            # Word table cells may be emitted as distinct blocks. Adjacency is a
            # suggestion only: do not label it high confidence without layout data.
            prefix = previous_label + ": "
            first_line = text.splitlines()[0] if text.splitlines() else text
            for item in _label_occurrences(prefix + first_line):
                if item.start >= len(prefix) and item.reason.startswith("explicit_label:" + previous_label):
                    occurrences.append(_Occurrence(item.category, item.start - len(prefix),
                                                   item.end - len(prefix), "review",
                                                   "adjacent_label_candidate:" + previous_label))
        current_label = _canonical_label(text.strip().rstrip(":=").strip())
        previous_label = current_label if current_label in _LABEL_CATEGORY else None
        for match in _EMAIL.finditer(text):
            occurrences.append(_Occurrence("EMAIL", *match.span(), "high", "email_format"))
        for match in _MOBILE.finditer(text):
            if _phone_kind(match.group()) == "TW_MOBILE":
                occurrences.append(_Occurrence("TW_MOBILE", *match.span(), "high", "taiwan_mobile_format"))
        for match in _PHONE.finditer(text):
            value = match.group()
            if _phone_kind(value) == "TW_PHONE" and re.search(r"[() +\-]", value):
                occurrences.append(_Occurrence("TW_PHONE", *match.span(), "high", "taiwan_landline_format"))
        for match in _NATIONAL_ID.finditer(text):
            if validate_tw_national_id(match.group()):
                occurrences.append(_Occurrence("TW_NATIONAL_ID", *match.span(), "high", "taiwan_national_id_checksum"))
        for pattern in (_CHINESE_ORG, _ENGLISH_ORG):
            for match in pattern.finditer(text):
                occurrences.append(_Occurrence("ORG", *match.span(), "review", "organisation_suffix_candidate"))
        # Only standalone project-like lines; do not infer names from narrative prose.
        line_start = 0
        for line in text.splitlines(keepends=True):
            a, b = _trim_span(text, line_start, line_start + len(line))
            if _PROJECT_END.fullmatch(text[a:b]) and not re.search(r"[:=;；|]", text[a:b]):
                occurrences.append(_Occurrence("PROJECT", a, b, "review", "standalone_project_title"))
            line_start += len(line)
        # Prefer explicit labels over suffix guesses, and maximal same-category spans.
        accepted: list[_Occurrence] = []
        for item in sorted(occurrences, key=lambda o: (o.confidence != "high", -(o.end - o.start), o.start)):
            if item.end <= item.start:
                continue
            if any(old.category == item.category and old.start < item.end and item.start < old.end for old in accepted):
                continue
            accepted.append(item)
        for item in sorted(accepted, key=lambda o: (o.start, o.end, o.category)):
            value = original[positions[item.start]:positions[item.end - 1] + 1].strip()
            if not value or _PLACEHOLDER.fullmatch(unicodedata.normalize("NFKC", value)):
                continue
            key = (item.category, value)
            if key not in merged:
                merged[key] = {"category": item.category, "value": value, "confidence": item.confidence,
                               "reason": item.reason, "locations": [location]}
            else:
                record = merged[key]
                if location not in record["locations"]:
                    record["locations"].append(location)
                if record["confidence"] == "review" and item.confidence == "high":
                    record["confidence"] = "high"
                    record["reason"] = item.reason
    return list(merged.values())
