"""§5.4.2: deterministic input guards. Every detector runs; the pipeline picks the response by precedence."""
import hashlib
import json
import re
from dataclasses import dataclass
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.context import Principal
from app.config import APP_DIR
from app.guardrails.normalize import Scan
from app.models import db as m


_STAGES = {"input", "prompt", "tool", "output"}


def sha_prefix(value: str) -> str:
    """Redacted secrets are logged only as a SHA-256 prefix, never as values."""
    return "sha256:" + hashlib.sha256(value.encode()).hexdigest()[:12]


@dataclass
class Finding:
    layer: str                 # input | prompt | tool | output | system (system is logged as its nearest stage)
    name: str                  # internal category: cross_user, injection, system_prompt, out_of_scope, redact, ...
    severity: str = "info"
    detail: str | None = None
    resource: str | None = None
    rule_id: str | None = None
    action: str = "flag"       # block | flag | redact

    def as_dict(self) -> dict:
        """Log shape: {stage, rule_id, severity, action, detail}."""
        stage = self.layer if self.layer in _STAGES else "prompt"
        return {"stage": stage, "rule_id": self.rule_id or self.name, "severity": self.severity, "action": self.action, "detail": self.detail}


@lru_cache
def patterns() -> dict:
    d = json.loads((APP_DIR / "guardrails" / "patterns.json").read_text(encoding="utf-8"))
    d["injection"] = [{**p, "_re": re.compile(p["regex"], re.I)} for p in d["injection"]]
    d["scope_deny"] = [{**p, "_re": re.compile(p["regex"], re.I)} for p in d["scope_deny"]]
    d["trivia_re"] = re.compile(d["trivia"], re.I)
    for k in ("redact", "secrets", "internal_details"):
        d[k] = [{**p, "_re": re.compile(p["regex"], re.I if k != "redact" else 0)} for p in d[k]]
    return d


# POL-HL-100001 / CLM-2026-0001 / CUST-1001 / PAY-2026-000001 / REF-AARAV-7F3A
ID_RE = re.compile(r"\b(POL-[A-Z]{2}-\d{6}|CLM-\d{4}-\d{4}|CUST-\d{4}|PAY-\d{4}-\d{6}|REF-[A-Z]+-[0-9A-F]{4})\b", re.I)
_COMPACT_ID = re.compile(r"(CUST\d{4}|POL[A-Z]{2}\d{6}|CLM\d{8}|PAY\d{10})")
_GROUP_RE = re.compile(
    r"\b(?:(?:other|another|different)\s+(?:customers?|users?|persons?|people|clients?|policyholders?|accounts?)"
    r"|someone\s+else)\b", re.I)
_APOS = "['’`]"


def collapse(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", s).upper()


def owned_identifiers(db: Session, ctx: Principal) -> set[str]:
    """Identifiers owned by the caller, upper-case, in their canonical dashed form."""
    out: set[str] = set()
    if ctx.customer_id:
        out.add(ctx.customer_id)
        c = db.get(m.Customer, ctx.customer_id)
        if c:
            out.add(c.account_reference)
        out.update(db.scalars(select(m.Policy.policy_number).where(m.Policy.customer_id == ctx.customer_id)))
        out.update(db.scalars(select(m.Claim.claim_number).where(m.Claim.customer_id == ctx.customer_id)))
        out.update(db.scalars(select(m.Payment.payment_id).where(m.Payment.customer_id == ctx.customer_id)))
    return {x.upper() for x in out}


def known_identifiers(db: Session) -> set[str]:
    ids: set[str] = set()
    for c in db.scalars(select(m.Customer)):
        ids.update((c.customer_id, c.account_reference))
    ids.update(db.scalars(select(m.Policy.policy_number)))
    ids.update(db.scalars(select(m.Claim.claim_number)))
    ids.update(db.scalars(select(m.Payment.payment_id)))
    return {x.upper() for x in ids}


@lru_cache
def faq_words() -> frozenset[str]:
    from app.services.knowledge import load

    words: set[str] = set()
    for item in load("faq.json"):
        words.update(re.findall(r"[a-z]+", (item["question"] + " " + " ".join(item["keywords"])).lower()))
    return frozenset(words)


_COMMON_WORD_FOLLOWERS = r"(?:periods?|days?|window|rides?|riding)"


def _name_regexes(name: str) -> list[re.Pattern]:
    """Word-boundary name references: "priya's", "for priya". "priya" never matches "priyanka" (\\b).
    A first name that is also an insurance word ("joy" in "joy ride", "grace" in "grace period") is not matched there."""
    e = re.escape(name)
    tail = rf"\b(?!\s+{_COMMON_WORD_FOLLOWERS}\b)" if name.lower() in faq_words() else r"\b"
    return [re.compile(rf"\b{e}{_APOS}s\b", re.I), re.compile(rf"\b(?:for|of|about)\s+{e}{tail}", re.I)]


def cross_user_resource(db: Session, ctx: Principal, scan: Scan, names: bool = True) -> str | None:
    """The other customer's identifier/name the text refers to, or None. Customers only (callers skip admins)."""
    owned = owned_identifiers(db, ctx)
    owned_c = {collapse(x) for x in owned}
    rows = list(db.execute(select(m.Customer, m.User.username).join(m.User, m.User.customer_id == m.Customer.customer_id, isouter=True)))

    # identifiers: raw, normalized, compact (obfuscated) and decoded forms
    for view in [*scan.cleaned, *scan.normalized]:
        for mt in ID_RE.finditer(view):
            if mt.group(1).upper() not in owned:
                return mt.group(1).upper()
    known = known_identifiers(db)
    for comp in scan.compacted:
        for mt in _COMPACT_ID.finditer(comp):
            if mt.group(1) not in owned_c:
                return mt.group(1)
        for ident in known:
            if collapse(ident) not in owned_c and collapse(ident) in comp:
                return ident
    if not names:
        return None

    # names / email / phone: never matched on the compact form
    for c, uname in rows:
        if c.customer_id == ctx.customer_id:
            continue
        digits = re.sub(r"\D", "", c.phone)
        phone_re = re.compile(rf"{digits[-10:-5]}[\s.\-]?{digits[-5:]}") if len(digits) >= 10 else None
        first = c.full_name.split()[0]
        for view, low in zip(scan.cleaned, scan.normalized):
            if re.search(rf"\b{re.escape(c.full_name.lower())}\b", low):
                return c.full_name
            if c.email.lower() in low:
                return c.email.lower()
            if phone_re and phone_re.search(low):
                return c.phone
            for n in {uname, first} - {None}:
                if n.lower() == ctx.username.lower():
                    continue
                if any(rx.search(view) for rx in _name_regexes(n)):
                    return n.lower()
    for low in scan.normalized:
        if (g := _GROUP_RE.search(low)):
            return g.group(0)
    return None


def detect_injection(scan: Scan) -> tuple[list[Finding], bool]:
    """Returns (findings, blocked). Any high match blocks; two or more distinct medium matches also block."""
    findings: list[Finding] = []
    for i, view in enumerate(scan.normalized):
        for p in patterns()["injection"]:
            if p["_re"].search(view) and not any(x.rule_id == p["id"] for x in findings):
                findings.append(Finding(
                    "input", "system_prompt" if p["category"] == "system_prompt_extraction" else "injection", p["severity"],
                    p["category"] + (" (decoded)" if i else ""), rule_id=p["id"], action="block" if p["severity"] == "high" else "flag"))
    mediums = [f for f in findings if f.severity == "medium"]
    blocked = any(f.severity == "high" for f in findings) or len(mediums) >= 2
    if len(mediums) >= 2:
        for f in mediums:
            f.action = "block"
    return findings, blocked


def detect_out_of_scope(scan: Scan) -> Finding | None:
    p = patterns()
    for low in scan.normalized[:1]:
        for rule in p["scope_deny"]:
            if rule["_re"].search(low):
                return Finding("input", "out_of_scope", "medium", "deny_list", rule_id=f'scope_{rule["id"]}', action="block")
        if p["trivia_re"].search(low) and not any(t in low for t in p["insurance_terms"]):
            return Finding("input", "out_of_scope", "medium", "no insurance terms", rule_id="scope_trivia", action="block")
    return None


def _luhn(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2:
            n = n * 2 - 9 if n * 2 > 9 else n * 2
        total += n
    return total % 10 == 0


_CARD = re.compile(r"(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])")


def redact(text: str) -> tuple[str, list[Finding]]:
    """Luhn-valid card numbers, JWTs, sk- keys, FAKE-PAN values and Aadhaar-like numbers -> [REDACTED].
    Events carry rule_id + hash prefix only."""
    events: list[Finding] = []

    def card(mt: re.Match) -> str:
        d = re.sub(r"\D", "", mt.group(0))
        if 13 <= len(d) <= 19 and _luhn(d):
            events.append(Finding("input", "redact", "info", sha_prefix(d), rule_id="redact_card_number", action="redact"))
            return "[REDACTED]"
        return mt.group(0)

    text = _CARD.sub(card, text)  # first, so a card number is not mistaken for an Aadhaar-like number
    for p in patterns()["redact"]:
        def sub(mt, p=p):
            events.append(Finding("input", "redact", "info", sha_prefix(mt.group(0)), rule_id=f'redact_{p["id"]}', action="redact"))
            return "[REDACTED]"
        text = p["_re"].sub(sub, text)
    return text, events


def classify_with_llm(llm, message: str) -> Finding | None:
    """§5.4.2g: optional tool-less classifier. It can only add a block; errors fall back to the rules."""
    try:
        res = llm.classify(message)
    except Exception as e:  # noqa: BLE001 - classifier failure must not weaken or break the rules
        return Finding("input", "classifier_error", "info", type(e).__name__, rule_id="classifier_error")
    if not res or res.get("label") in (None, "safe") or float(res.get("confidence", 0)) < 0.5:
        return None
    label = {"injection": "injection", "cross_user": "cross_user", "out_of_scope": "out_of_scope"}.get(res["label"])
    return Finding("input", label, "high", f'{res["label"]} {res.get("confidence")}', rule_id="llm_classifier", action="block") if label else None
