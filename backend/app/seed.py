"""Idempotent seed. `python -m app.seed [--reset] [--extra N]`. Runs as the schema owner (MIGRATIONS_DATABASE_URL)."""
import argparse
import json
import uuid
from datetime import date, datetime

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth.passwords import hash_password
from app.config import APP_DIR
from app.db.engines import owner_engine
from app.models import db as m

NAMESPACE = uuid.UUID("6f1c2d0e-5b7a-4c1e-9f3a-0a1b2c3d4e5f")
MODES = ["UPI", "Net Banking", "Credit Card", "Auto-debit"]
TABLES = "revoked_tokens, agent_logs, messages, conversations, payments, claims, policies, users, customers"


def load() -> dict:
    return json.loads((APP_DIR / "data" / "seed_data.json").read_text(encoding="utf-8"))


def _add_years(d: date, n: int) -> date:
    try:
        return d.replace(year=d.year + n)
    except ValueError:  # 29 Feb
        return d.replace(year=d.year + n, day=28)


def generate_payments(data: dict) -> list[dict]:
    """§2.4: one premium payment per policy year up to the seed's as-of date (last 3 kept); Pending policies have none."""
    as_of = date.fromisoformat(data["as_of"])
    rows, mode_i = [], 0
    for p in data["policies"]:
        if p["status"] == "Pending":
            continue
        start, end = date.fromisoformat(p["start_date"]), date.fromisoformat(p["end_date"])
        dates, k = [], 0
        while (d := _add_years(start, k)) <= min(as_of, end):
            dates.append(d)
            k += 1
        for d in dates[-3:]:
            rows.append(dict(customer_id=p["customer_id"], policy_number=p["policy_number"], amount=p["annual_premium"], paid_on=d,
                             mode=MODES[mode_i % 4], status="Success"))
            mode_i += 1
    for f in data.get("failed_payments", []):  # explains POL-HL-100005's grace period
        p = next(x for x in data["policies"] if x["policy_number"] == f["policy_number"])
        rows.append(dict(customer_id=p["customer_id"], policy_number=p["policy_number"], amount=p["annual_premium"],
                         paid_on=date.fromisoformat(f["paid_on"]), mode=f["mode"], status="Failed"))
    for i, r in enumerate(rows, 1):
        r["payment_id"] = f"PAY-2026-{i:06d}"
    return rows


def _ins(db: Session, model, rows: list[dict], key: str):
    if rows:
        db.execute(insert(model).values(rows).on_conflict_do_nothing(index_elements=[key]))


def _to_date(v):
    return date.fromisoformat(v) if isinstance(v, str) else v


def seed(db: Session, reset: bool = False, extra: int = 0, rounds: int | None = None) -> None:
    if reset:
        db.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
    data = load()
    _ins(db, m.Customer, [{**c, "date_of_birth": _to_date(c["date_of_birth"])} for c in data["customers"]], "customer_id")
    have = set(db.scalars(select(m.User.username)))
    users = []
    for u in data["users"]:
        if u["username"] not in have:  # hash only new users (bcrypt is slow)
            u = dict(u)
            users.append(dict(id=uuid.uuid5(NAMESPACE, u["username"]), password_hash=hash_password(u.pop("password")), **u))
    _ins(db, m.User, users, "username")
    _ins(db, m.Policy, [{**p, "start_date": _to_date(p["start_date"]), "end_date": _to_date(p["end_date"]),
                         "id": uuid.uuid5(NAMESPACE, p["policy_number"])} for p in data["policies"]], "policy_number")
    _ins(db, m.Claim, [{**c, "filed_date": _to_date(c["filed_date"]), "id": uuid.uuid5(NAMESPACE, c["claim_number"])} for c in data["claims"]], "claim_number")
    pays = generate_payments(data)
    _ins(db, m.Payment, [{**p, "id": uuid.uuid5(NAMESPACE, p["payment_id"])} for p in pays], "payment_id")
    for conv in data["conversations"]:
        owner = db.scalar(select(m.User).where(m.User.username == conv["username"]))
        cid = uuid.UUID(conv["id"])
        db.execute(insert(m.Conversation).values(
            id=cid, user_id=owner.id, session_id=conv["session_id"], title=conv["title"],
            created_at=datetime.fromisoformat(conv["created_at"]), updated_at=datetime.fromisoformat(conv["updated_at"])
        ).on_conflict_do_nothing(index_elements=["id"]))
        if not db.scalar(select(m.Message.id).where(m.Message.conversation_id == cid).limit(1)):
            for msg in conv["messages"]:
                db.add(m.Message(conversation_id=cid, role=msg["role"], content=msg["content"],
                                 created_at=datetime.fromisoformat(msg["created_at"])))
    if extra:
        _seed_extra(db, extra, rounds)
    db.commit()


def _seed_extra(db: Session, n: int, rounds: int | None) -> None:
    """Synthetic Indian customers (Faker en_IN, fixed seed): CUST-1012.. with user `customerNNNN`, password `Test@1234`."""
    from faker import Faker

    fake = Faker("en_IN")
    Faker.seed(1234)
    fake.seed_instance(1234)
    states = ["Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Telangana", "Rajasthan", "Kerala", "West Bengal"]
    for i in range(n):
        num = 1012 + i
        cid, first = f"CUST-{num}", fake.first_name()
        last = fake.last_name()
        cust = dict(customer_id=cid, full_name=f"{first} {last}", email=f"{first}.{last}.{num}@example.com".lower().replace(" ", ""),
                    phone=f"+91 90000 {10000 + num % 90000:05d}", date_of_birth=fake.date_of_birth(minimum_age=21, maximum_age=70),
                    city=fake.city(), state=fake.random_element(states), pan=f"FAKE-PAN-{num}",
                    account_reference=f"REF-{first.upper().replace(' ', '')}-{num:04X}")
        _ins(db, m.Customer, [cust], "customer_id")
        db.flush()
        if not db.scalar(select(m.User.id).where(m.User.username == f"customer{num}")):
            db.add(m.User(id=uuid.uuid5(NAMESPACE, f"customer{num}"), username=f"customer{num}", password_hash=hash_password("Test@1234"),
                          role="customer", customer_id=cid, is_active=True))
        _ins(db, m.Policy, [dict(id=uuid.uuid5(NAMESPACE, f"POL-HL-9{i:05d}"), policy_number=f"POL-HL-9{i:05d}", customer_id=cid,
                                 product="Health – Individual", policy_type="Health", status="Active",
                                 sum_insured=fake.random_element([300000, 500000, 1000000]), annual_premium=fake.random_int(6000, 25000),
                                 deductible=0, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), nominee=None, details={})],
             "policy_number")


def reset_runtime(db: Session) -> None:
    """Test helper: put mutable tables back to the seeded state (fast alternative to a full reseed)."""
    db.execute(text("DELETE FROM messages"))
    db.execute(text("DELETE FROM conversations"))
    db.execute(text("TRUNCATE agent_logs, revoked_tokens"))
    db.execute(text("DELETE FROM payments WHERE payment_id LIKE 'PAY-R-%'"))  # renewal payments made by tests
    for pol in load()["policies"]:
        db.execute(text("UPDATE policies SET status=:status, end_date=:end_date, details=CAST(:details AS jsonb) WHERE policy_number=:policy_number"),
                   {"status": pol["status"], "end_date": _to_date(pol["end_date"]), "details": json.dumps(pol["details"]), "policy_number": pol["policy_number"]})
    db.execute(text("UPDATE users SET is_active = (username <> 'sneha')"))
    for c in load()["customers"]:
        db.execute(text("UPDATE customers SET phone=:phone, email=:email, city=:city, state=:state WHERE customer_id=:customer_id"), c)
    db.commit()
    seed(db)  # re-creates the seeded conversation


def main() -> None:
    ap = argparse.ArgumentParser(description="Seed the database")
    ap.add_argument("--reset", action="store_true", help="truncate all tables first")
    ap.add_argument("--extra", type=int, default=0, help="add N synthetic Indian customers (Faker en_IN, fixed seed)")
    args = ap.parse_args()
    with Session(owner_engine()) as db:
        seed(db, reset=args.reset, extra=args.extra)
    print("Seed complete.")


if __name__ == "__main__":
    main()
