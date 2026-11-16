"""FAQ keyword search and claim information (static JSON knowledge base)."""
import json
import re
from functools import lru_cache

from app.config import APP_DIR


@lru_cache
def load(name: str):
    return json.loads((APP_DIR / "data" / name).read_text(encoding="utf-8"))


_STOP = {"a", "an", "the", "is", "are", "what", "how", "do", "does", "i", "my", "me", "of", "to", "in", "and", "or", "can", "for", "it", "if",
         "on", "about", "tell", "explain", "mean", "means", "s", "under", "from", "by", "with", "there", "any", "which"}


def tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOP]


def search_faq(query: str, limit: int = 3) -> list[dict]:
    toks = tokens(query)
    scored = []
    for item in load("faq.json"):
        q, kw, a = set(tokens(item["question"])), set(tokens(" ".join(item["keywords"]))), set(tokens(item["answer"]))
        score = sum(3 * (t in q) + 2 * (t in kw) + (t in a) for t in toks)
        if score > 0:
            scored.append((score, item))
    scored.sort(key=lambda s: (-s[0], s[1]["id"]))
    return [{"question": i["question"], "answer": i["answer"]} for _, i in scored[:limit]]


def claim_information(product: str | None = None) -> dict:
    info = load("claims_info.json")
    docs = info["required_documents"]
    if product:
        key = product.strip().lower()
        docs = {k: v for k, v in docs.items() if k.lower().startswith(key[:4]) or key.startswith(k.lower()[:4])}
    return {"steps": info["general_steps"], "required_documents": docs}
