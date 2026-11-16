"""Display formatting shared by tools and the mock LLM: INR with Indian digit grouping, dates as DD MMM YYYY."""
from datetime import date, datetime
from decimal import Decimal


def inr(value) -> str:
    """₹10,00,000 (Indian grouping, no decimals unless needed)."""
    d = Decimal(str(value))
    neg = d < 0
    d = abs(d)
    whole, _, frac = f"{d:.2f}".partition(".")
    head, tail = whole[:-3], whole[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    out = ",".join([*groups, tail])
    if frac != "00":
        out += "." + frac
    return ("-" if neg else "") + "₹" + out


def dmy(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = date.fromisoformat(value[:10])
    if isinstance(value, datetime):
        value = value.date()
    return value.strftime("%d %b %Y")


def num(value) -> float:
    return float(value)
