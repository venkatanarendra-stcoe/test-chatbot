from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import Principal, get_current_user
from app.db.engines import get_db
from app.repositories import claims, payments, policies
from app.services.formatting import dmy, inr

router = APIRouter(prefix="/api")
OPEN_CLAIMS = {"Submitted", "Documents Pending", "Under Review"}


def _short(product: str) -> str:
    return product.split("–")[-1].strip()


@router.get("/dashboard/summary")
def summary(p: Principal = Depends(get_current_user), db: Session = Depends(get_db)):
    pols, cls, pays = policies.list_for(db, p), claims.list_for(db, p), payments.list_for(db, p)
    live = [x for x in pols if x["status"] in ("Active", "Grace Period")]
    today = date.today()
    upcoming = sorted((x for x in live if date.fromisoformat(x["end_date"]) >= today), key=lambda x: x["end_date"])
    nxt = upcoming[0] if upcoming else None
    alerts = []
    for x in pols:
        if x["status"] == "Grace Period":
            until = x.get("grace_until_display") or x["end_date_display"]
            alerts.append({"type": "grace_period", "severity": "warning", "policy_number": x["policy_number"],
                           "message": f"Your {_short(x['product'])} {x['policy_number']} is in its grace period. Renew by {until}."})
        elif x["status"] == "Lapsed":
            alerts.append({"type": "lapsed", "severity": "destructive", "policy_number": x["policy_number"],
                           "message": f"Your {_short(x['product'])} {x['policy_number']} has lapsed. Contact support to revive it."})
    for pay in pays:
        if pay["status"] == "Failed":
            alerts.append({"type": "failed_payment", "severity": "destructive", "policy_number": pay["policy_number"],
                           "message": f"Your premium payment {pay['payment_id']} of {pay['amount_display']} on {pay['paid_on_display']} failed."})
    return {
        "active_policies": sum(1 for x in pols if x["status"] == "Active"),
        "total_sum_insured": sum(x["sum_insured"] for x in live), "total_sum_insured_display": inr(sum(x["sum_insured"] for x in live)),
        "open_claims": sum(1 for c in cls if c["status"] in OPEN_CLAIMS),
        "next_renewal": ({"policy_number": nxt["policy_number"], "date": nxt["end_date"], "date_display": dmy(nxt["end_date"]),
                          "days_left": (date.fromisoformat(nxt["end_date"]) - today).days} if nxt else None),
        "alerts": alerts,
    }
