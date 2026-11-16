import json

import pytest
from sqlalchemy import text

from tests.conftest import ALICE_CONV, CLAIMS, CUSTOMER_IDS, CUSTOMERS, POLICIES, last_log

ADMIN_GETS = ["/api/admin/stats", "/api/admin/customers", "/api/admin/customers/CUST-1001", "/api/admin/policies", "/api/admin/claims",
              "/api/admin/logs", "/api/admin/lockouts", "/api/admin/system"]


def test_me_masks_pan(client, login):
    r = client.get("/api/me", headers=login("aarav"))
    p = r.json()["profile"]
    assert p["pan_masked"] == "******1001" and p["account_reference"] == "REF-AARAV-7F3A" and "FAKE-PAN" not in r.text


def test_patch_me_allowed_fields(client, login):
    r = client.patch("/api/me", json={"phone": "+91 98765 43210", "email": "aarav.new@example.com", "city": "Warangal", "state": "Telangana"}, headers=login("aarav"))
    assert r.status_code == 200 and r.json()["profile"]["city"] == "Warangal" and r.json()["profile"]["phone"] == "+91 98765 43210"


@pytest.mark.parametrize("body", [{"phone": "12345"}, {"phone": "+1 555 555 5555"}, {"email": "not-an-email"}, {"city": ""}, {"city": 5}])
def test_patch_me_validation(client, login, body):
    assert client.patch("/api/me", json=body, headers=login("aarav")).status_code == 422


@pytest.mark.parametrize("field", ["role", "customer_id", "username", "id", "pan", "account_reference", "date_of_birth", "full_name"])
def test_patch_me_forbidden_fields(client, login, db, field):
    r = client.patch("/api/me", json={field: "x"}, headers=login("aarav"))
    assert r.status_code == 403
    log = last_log(db)
    assert log.authorization_result == "denied" and log.blocked_by == "forbidden_field_update"
    me = client.get("/api/me", headers=login("aarav")).json()
    assert me["role"] == "customer" and me["profile"]["customer_id"] == "CUST-1001"


@pytest.mark.parametrize("route", ADMIN_GETS)
@pytest.mark.parametrize("user", CUSTOMERS)
def test_customers_get_403_on_admin_routes(client, login, user, route):
    assert client.get(route, headers=login(user)).status_code == 403


@pytest.mark.parametrize("user", CUSTOMERS)
def test_customers_cannot_clear_lockouts(client, login, user):
    assert client.delete("/api/admin/lockouts/aarav", headers=login(user)).status_code == 403


def test_unauthenticated_everywhere(client):
    for path in ["/api/me", "/api/dashboard/summary", "/api/my-policies", "/api/my-policies/POL-HL-100001", "/api/my-claims", "/api/my-claims/CLM-2026-0001",
                 "/api/my-payments", "/api/claims-info", "/api/faq?q=x", "/api/conversations", *ADMIN_GETS]:
        assert client.get(path).status_code == 401, path


# ---- cross-user REST access: every customer vs every other customer's identifiers (all 10 active customers)
@pytest.mark.parametrize("attacker", CUSTOMERS)
def test_cross_customer_policy_and_claim_ids_are_404(client, login, attacker):
    h = login(attacker)
    own = POLICIES.get(attacker, []) + CLAIMS.get(attacker, [])
    foreign = [x for u in CUSTOMERS if u != attacker for x in POLICIES.get(u, []) + CLAIMS.get(u, [])]
    assert foreign
    bodies = set()
    for ident in foreign + ["POL-HL-999999", "CLM-2026-9999"]:
        path = f"/api/my-policies/{ident}" if ident.startswith("POL") else f"/api/my-claims/{ident}"
        r = client.get(path, headers=h)
        assert r.status_code == 404, (attacker, ident)
        bodies.add(json.dumps({"s": r.status_code, "b": r.json()["detail"], "p": ident[:3]}))
    assert len(bodies) == 2                       # one body per resource type: "not owned" and "not found" are identical
    for ident in own:
        path = f"/api/my-policies/{ident}" if ident.startswith("POL") else f"/api/my-claims/{ident}"
        assert client.get(path, headers=h).status_code == 200


@pytest.mark.parametrize("user,expected", [(u, v) for u, v in POLICIES.items()])
def test_my_policies_scoped_and_customer_id_param_ignored(client, login, user, expected):
    r = client.get("/api/my-policies?customer_id=CUST-1002", headers=login(user))
    assert sorted(p["policy_number"] for p in r.json()["policies"]) == sorted(expected)


def test_policy_detail_has_coverage_details_and_inr(client, login):
    p = client.get("/api/my-policies/POL-HL-100001", headers=login("aarav")).json()
    assert p["sum_insured_display"] == "₹10,00,000" and p["nominee"] == "Kavita Sharma" and p["details"]["ncb_percent"] == 10
    assert client.get("/api/my-policies/POL-TL-200002", headers=login("priya")).json()["sum_insured_display"] == "₹1,00,00,000"


def test_claims_filter_and_empty_result(client, login):
    assert client.get("/api/my-claims", headers=login("priya")).json()["claims"] == []
    ok = client.get("/api/my-claims?status=Settled", headers=login("aarav")).json()["claims"]
    assert [c["claim_number"] for c in ok] == ["CLM-2026-0002"]


def test_payments_and_failed_payment(client, login):
    pays = client.get("/api/my-payments", headers=login("rohan")).json()["payments"]
    assert {"PAY-2026-000019"} <= {p["payment_id"] for p in pays} and any(p["status"] == "Failed" for p in pays)
    assert client.get("/api/my-payments?status=Failed", headers=login("rohan")).json()["payments"][0]["policy_number"] == "POL-HL-100005"
    assert all(p["customer_id"] == "CUST-1001" for p in client.get("/api/my-payments", headers=login("aarav")).json()["payments"])


def test_dashboard_summary(client, login):
    d = client.get("/api/dashboard/summary", headers=login("rohan")).json()
    assert d["active_policies"] == 2 and d["open_claims"] == 1
    types = {a["type"] for a in d["alerts"]}
    assert {"grace_period", "failed_payment"} <= types
    assert any("POL-HL-100005" in a["message"] and "14 Nov 2026" in a["message"] for a in d["alerts"])
    a = client.get("/api/dashboard/summary", headers=login("aarav")).json()
    assert a["total_sum_insured"] == 1000000 and a["alerts"] == [] and a["next_renewal"]["policy_number"] == "POL-HL-100001"
    assert any(x["type"] == "lapsed" for x in client.get("/api/dashboard/summary", headers=login("ananya")).json()["alerts"])


def test_admin_has_no_policies(client, login):
    assert client.get("/api/my-policies", headers=login("admin")).json()["policies"] == []


def test_no_customer_id_endpoint(client, login):
    assert client.get("/api/policy?customer_id=CUST-1002", headers=login("aarav")).status_code == 404


def test_faq_and_claims_info(client, login):
    r = client.get("/api/faq?q=grace period", headers=login("aarav")).json()["results"]
    assert "grace period" in r[0]["question"].lower() and len(r) <= 3
    assert "Motor" in client.get("/api/claims-info?product=motor", headers=login("aarav")).json()["required_documents"]
    assert "joy" in client.get("/api/faq?q=joy ride covered motor", headers=login("aarav")).json()["results"][0]["answer"].lower()


# ---- admin
def test_admin_endpoints(client, login):
    h = login("admin")
    stats = client.get("/api/admin/stats", headers=h).json()
    assert stats["customers"] == 11 and len(stats["blocked_last_7_days"]) == 7 and {x["name"] for x in stats["policies_by_product"]} >= {"Health", "Motor"}
    page = client.get("/api/admin/customers?page=2&page_size=5&sort=-customer_id", headers=h).json()
    assert page["total"] == 11 and len(page["items"]) == 5 and page["items"][0]["customer_id"] == "CUST-1006"
    assert [c["customer_id"] for c in client.get("/api/admin/customers?q=priya", headers=h).json()["items"]] == ["CUST-1002", "CUST-1011"]
    d = client.get("/api/admin/customers/CUST-1003", headers=h).json()
    assert d["profile"]["pan_masked"] == "******1003" and len(d["policies"]) == 3 and d["payments"]
    assert client.get("/api/admin/customers/CUST-9999", headers=h).status_code == 404
    assert client.get("/api/admin/policies?status=Grace Period", headers=h).json()["total"] == 1
    assert client.get("/api/admin/claims?status=Rejected", headers=h).json()["total"] == 2
    assert client.get("/api/admin/logs?authorization=denied&page_size=5", headers=h).status_code == 200
    sysinfo = client.get("/api/admin/system", headers=h).json()
    assert sysinfo["llm_provider"] == "mock" and sysinfo["guardrails"]["degraded"] is False


def test_pan_never_appears_in_any_response(client, login):
    h = login("admin")
    blob = "".join(client.get(p, headers=h).text for p in ["/api/admin/customers", "/api/admin/customers/CUST-1001", "/api/admin/stats", "/api/admin/logs", "/api/me"])
    assert "FAKE-PAN" not in blob


# ---- session isolation
@pytest.mark.parametrize("user", [u for u in CUSTOMERS if u != "aarav"] + ["admin"])
def test_seeded_conversation_isolated(client, login, chat, user):
    h = login(user)
    assert client.get(f"/api/conversations/{ALICE_CONV}/messages", headers=h).status_code == 404
    assert client.delete(f"/api/conversations/{ALICE_CONV}", headers=h).status_code == 404
    assert chat(user, "What is my policy number?", ALICE_CONV).status_code == 404
    assert ALICE_CONV not in [c["id"] for c in client.get("/api/conversations", headers=h).json()]
    assert client.get(f"/api/conversations/{ALICE_CONV}/messages", headers=login("aarav")).status_code == 200


def test_malformed_conversation_id_is_404(client, login, chat):
    assert client.get("/api/conversations/not-a-uuid/messages", headers=login("aarav")).status_code == 404
    assert chat("aarav", "hi", "../../etc/passwd").status_code == 404


def test_seeded_conversation_content(client, login):
    msgs = client.get(f"/api/conversations/{ALICE_CONV}/messages", headers=login("aarav")).json()
    assert [m["content"] for m in msgs] == ["What is my policy number?", "Your policy number is POL-HL-100001."]


def test_delete_own_conversation_only(client, login, chat):
    cid = chat("priya", "What is my policy number?").json()["conversation_id"]
    assert client.delete(f"/api/conversations/{cid}", headers=login("aarav")).status_code == 404
    assert client.delete(f"/api/conversations/{cid}", headers=login("priya")).status_code == 200
    assert client.get(f"/api/conversations/{cid}/messages", headers=login("priya")).status_code == 404


# ---- policy renewal
def test_renew_extends_policy_and_records_payment(client, login):
    h = login("aarav")
    before = client.get("/api/my-policies/POL-HL-100001", headers=h).json()
    r = client.post("/api/my-policies/POL-HL-100001/renew", json={"mode": "Net Banking"}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["policy"]["status"] == "Active" and body["policy"]["end_date"] > before["end_date"]
    assert body["payment"]["status"] == "Success" and body["payment"]["mode"] == "Net Banking" and body["payment"]["amount"] == before["annual_premium"]
    pays = client.get("/api/my-payments?policy_number=POL-HL-100001", headers=h).json()["payments"]
    assert any(p["payment_id"] == body["payment"]["payment_id"] for p in pays)


def test_renew_grace_policy_clears_grace(client, login):
    h = login("rohan")
    grace = next(p for p in client.get("/api/my-policies", headers=h).json()["policies"] if p["status"] == "Grace Period")
    r = client.post(f"/api/my-policies/{grace['policy_number']}/renew", json={}, headers=h)
    assert r.status_code == 200 and r.json()["policy"]["status"] == "Active" and "grace_until" not in r.json()["policy"]


def test_renew_other_customers_or_unknown_policy_is_404(client, login):
    h = login("aarav")
    for n in ("POL-HL-100005", "POL-HL-999999"):
        assert client.post(f"/api/my-policies/{n}/renew", headers=h).status_code == 404


def test_renew_expired_policy_is_409_and_bad_input_422(client, login):
    h = login("vikram")
    expired = next(p for p in client.get("/api/my-policies", headers=h).json()["policies"] if p["status"] == "Expired")
    assert client.post(f"/api/my-policies/{expired['policy_number']}/renew", headers=h).status_code == 409
    h = login("aarav")
    assert client.post("/api/my-policies/POL-HL-100001/renew", json={"mode": "Cash"}, headers=h).status_code == 422
    assert client.post("/api/my-policies/POL-HL-100001/renew", json={"amount": 1}, headers=h).status_code == 422


def test_renew_requires_auth_and_admin_has_no_policies(client, login):
    assert client.post("/api/my-policies/POL-HL-100001/renew").status_code == 401
    assert client.post("/api/my-policies/POL-HL-100001/renew", headers=login("admin")).status_code == 404
