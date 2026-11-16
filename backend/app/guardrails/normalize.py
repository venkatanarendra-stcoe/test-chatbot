"""§5.4.1: normalized copies of text for scanning. The original text is what gets stored (after redaction)."""
import base64
import binascii
import re
import unicodedata
from dataclasses import dataclass, field
from urllib.parse import unquote

_INVISIBLE = re.compile("[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]")
_B64 = re.compile(r"[A-Za-z0-9+/_-]{16,}={0,2}")
_HEX = re.compile(r"(?:[0-9a-fA-F]{2}){8,}")
_PCT = re.compile(r"(?:%[0-9a-fA-F]{2})+")

# Common Cyrillic / Greek look-alikes -> Latin
_HOMOGLYPHS = str.maketrans({
    "а": "a", "в": "b", "е": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c", "т": "t", "у": "y", "х": "x",
    "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ɡ": "g", "ӏ": "l",
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "У": "Y", "Х": "X",
    "І": "I", "Ј": "J", "Ѕ": "S",
    "α": "a", "ε": "e", "ι": "i", "κ": "k", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "ν": "v", "χ": "x",
    "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H", "Ι": "I", "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P",
    "Τ": "T", "Υ": "Y", "Χ": "X",
})


def clean(text: str) -> str:
    """NFKC, strip invisible/bidi controls, fold homoglyphs, collapse whitespace. Case is preserved."""
    t = unicodedata.normalize("NFKC", text)
    t = _INVISIBLE.sub("", t).translate(_HOMOGLYPHS)
    return re.sub(r"\s+", " ", t).strip()


def normalize(text: str) -> str:
    return clean(text).lower()


def compact(text: str) -> str:
    """Alphanumerics only, upper-case. Used ONLY for identifier matching (C U S T 0 0 2, CUST-002, "CUST00" + "2")."""
    return re.sub(r"[^A-Za-z0-9]", "", clean(text)).upper()


def _printable(b: bytes) -> str | None:
    try:
        s = b.decode("utf-8")
    except UnicodeDecodeError:
        return None
    if len(s) < 4 or sum(c.isprintable() or c in "\n\t" for c in s) / len(s) < 0.95:
        return None
    return s


def _decode_once(text: str) -> list[str]:
    out = []
    for m in _B64.finditer(text):
        seg = m.group(0)
        try:
            raw = base64.b64decode(seg.replace("-", "+").replace("_", "/") + "=" * (-len(seg) % 4), validate=False)
        except (binascii.Error, ValueError):
            continue
        if (s := _printable(raw)):
            out.append(s)
    for m in _HEX.finditer(text):
        try:
            if (s := _printable(bytes.fromhex(m.group(0)))):
                out.append(s)
        except ValueError:
            continue
    if _PCT.search(text):
        dec = unquote(text)
        if dec != text:
            out.append(dec)
    return out


def decoded_variants(text: str, levels: int = 2) -> list[str]:
    """Base64 / hex / URL-encoded segments decoded up to 2 levels deep. Never sent to the LLM."""
    found, frontier = [], [text]
    for _ in range(levels):
        nxt = []
        for t in frontier:
            for d in _decode_once(t):
                if d not in found and d != text:
                    found.append(d)
                    nxt.append(d)
        frontier = nxt
    return found


@dataclass
class Scan:
    """All the views of a message that detectors look at."""
    original: str
    cleaned: list[str] = field(default_factory=list)      # case-preserved, original + decoded
    normalized: list[str] = field(default_factory=list)   # lower-cased, original + decoded
    compacted: list[str] = field(default_factory=list)    # alnum-only upper, original + decoded
    decoded: list[str] = field(default_factory=list)


def build_scan(text: str) -> Scan:
    dec = decoded_variants(text)
    views = [text, *dec]
    return Scan(text, [clean(v) for v in views], [normalize(v) for v in views], [compact(v) for v in views], dec)
