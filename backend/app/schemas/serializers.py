"""Row -> dict serializers shared by REST and tools. Money is returned both raw and preformatted (INR), dates both ISO and DD MMM YYYY.
Never reads `customers.pan`: only the generated `pan_masked`."""
from app.services.formatting import dmy, inr, num


def profile_dict(c) -> dict:
    return {
        "customer_id": c.customer_id, "full_name": c.full_name, "email": c.email, "phone": c.phone,
        "date_of_birth": c.date_of_birth.isoformat(), "date_of_birth_display": dmy(c.date_of_birth),
        "city": c.city, "state": c.state, "pan_masked": c.pan_masked, "account_reference": c.account_reference,
    }


def policy_dict(p, full: bool = False) -> dict:
    d = {
        "policy_number": p.policy_number, "customer_id": p.customer_id, "product": p.product, "policy_type": p.policy_type, "status": p.status,
        "sum_insured": num(p.sum_insured), "sum_insured_display": inr(p.sum_insured),
        "annual_premium": num(p.annual_premium), "annual_premium_display": inr(p.annual_premium),
        "deductible": num(p.deductible), "deductible_display": inr(p.deductible),
        "start_date": p.start_date.isoformat(), "start_date_display": dmy(p.start_date),
        "end_date": p.end_date.isoformat(), "end_date_display": dmy(p.end_date), "nominee": p.nominee,
    }
    det = p.details or {}
    if det.get("grace_until"):
        d["grace_until"], d["grace_until_display"] = det["grace_until"], dmy(det["grace_until"])
    if full:
        d["details"] = det
    return d


def claim_dict(c) -> dict:
    return {
        "claim_number": c.claim_number, "customer_id": c.customer_id, "policy_number": c.policy_number, "claim_type": c.claim_type,
        "amount": num(c.amount), "amount_display": inr(c.amount), "status": c.status,
        "filed_date": c.filed_date.isoformat(), "filed_date_display": dmy(c.filed_date), "description": c.description,
    }


def payment_dict(p) -> dict:
    return {
        "payment_id": p.payment_id, "customer_id": p.customer_id, "policy_number": p.policy_number,
        "amount": num(p.amount), "amount_display": inr(p.amount), "paid_on": p.paid_on.isoformat(), "paid_on_display": dmy(p.paid_on),
        "mode": p.mode, "status": p.status,
    }
