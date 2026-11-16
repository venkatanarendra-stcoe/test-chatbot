"""Phase 1: roles, column grants, masked view, RLS and the seed."""
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from tests.conftest import CUSTOMER_IDS


def tools_conn(customer_id="", admin=False):
    eng = create_engine(os.environ["TOOLS_DATABASE_URL"], execution_options={"postgresql_readonly": True})
    conn = eng.connect()
    conn.execute(text("SELECT set_config('app.customer_id', :c, true), set_config('app.is_admin', :a, true)"),
                 {"c": customer_id, "a": "true" if admin else "false"})
    return conn


def app_conn():
    return create_engine(os.environ["DATABASE_URL"]).connect()


def test_seed_counts(owner_db):
    q = lambda t: owner_db.execute(text(f"SELECT count(*) FROM {t}")).scalar()  # noqa: E731
    assert (q("customers"), q("users"), q("policies"), q("claims"), q("payments")) == (11, 12, 15, 11, 19)


def test_seed_is_idempotent(owner_db):
    from app.seed import seed
    seed(owner_db)
    seed(owner_db)
    assert owner_db.execute(text("SELECT count(*) FROM payments")).scalar() == 19
    assert owner_db.execute(text("SELECT count(*) FROM users")).scalar() == 12


def test_payments_rules(owner_db):
    rows = owner_db.execute(text("SELECT payment_id, policy_number, status, mode FROM payments ORDER BY payment_id")).all()
    assert rows[0][0] == "PAY-2026-000001" and rows[-1][0] == "PAY-2026-000019"
    failed = [r for r in rows if r[2] == "Failed"]
    assert failed == [("PAY-2026-000019", "POL-HL-100005", "Failed", "UPI")]
    assert not any(r[1] == "POL-TL-200008" for r in rows)                           # Pending policy: no payments
    assert sum(r[1] == "POL-TL-200013" for r in rows) == 3                          # last 3 policy years only


def test_extra_customers_are_deterministic(owner_db):
    from app.seed import seed
    seed(owner_db, extra=3)
    a = owner_db.execute(text("SELECT customer_id, full_name FROM customers WHERE customer_id >= 'CUST-1012' ORDER BY 1")).all()
    owner_db.execute(text("DELETE FROM policies WHERE customer_id >= 'CUST-1012'"))
    owner_db.execute(text("DELETE FROM users WHERE customer_id >= 'CUST-1012'"))
    owner_db.execute(text("DELETE FROM customers WHERE customer_id >= 'CUST-1012'"))
    owner_db.commit()
    seed(owner_db, extra=3)
    b = owner_db.execute(text("SELECT customer_id, full_name FROM customers WHERE customer_id >= 'CUST-1012' ORDER BY 1")).all()
    for stmt in ("policies", "users", "customers"):  # leave the shared test database as seeded
        owner_db.execute(text(f"DELETE FROM {stmt} WHERE customer_id >= 'CUST-1012'"))
    owner_db.commit()
    assert len(a) == 3 and a == b


def test_pan_is_stored_but_view_masks_it(owner_db):
    assert owner_db.execute(text("SELECT pan FROM customers WHERE customer_id='CUST-1001'")).scalar() == "FAKE-PAN-1001"
    assert owner_db.execute(text("SELECT pan_masked FROM customers_masked WHERE customer_id='CUST-1001'")).scalar() == "******1001"


# ---- ia_tools: read-only + RLS
@pytest.mark.parametrize("user", [u for u in CUSTOMER_IDS if u != "sneha"])
def test_rls_limits_tools_to_own_rows(user):
    cid = CUSTOMER_IDS[user]
    with tools_conn(cid) as c:
        for t in ("policies", "claims", "payments"):
            owners = {r[0] for r in c.execute(text(f"SELECT customer_id FROM {t}"))}
            assert owners <= {cid}, (t, owners)
        assert {r[0] for r in c.execute(text("SELECT customer_id FROM customers"))} == {cid}
        assert {r[0] for r in c.execute(text("SELECT customer_id FROM customers_masked"))} == {cid}


def test_rls_select_star_policies_aarav_only():
    with tools_conn("CUST-1001") as c:
        assert [r[0] for r in c.execute(text("SELECT policy_number FROM policies"))] == ["POL-HL-100001"]


def test_rls_without_context_returns_nothing():
    with tools_conn("") as c:
        assert c.execute(text("SELECT count(*) FROM policies")).scalar() == 0
        assert c.execute(text("SELECT count(*) FROM claims")).scalar() == 0


def test_rls_admin_context_sees_everything():
    with tools_conn("", admin=True) as c:
        assert c.execute(text("SELECT count(*) FROM policies")).scalar() == 15
        assert c.execute(text("SELECT count(*) FROM customers_masked")).scalar() == 11


def test_rls_cannot_be_widened_by_a_where_clause():
    with tools_conn("CUST-1001") as c:
        assert c.execute(text("SELECT count(*) FROM claims WHERE customer_id = 'CUST-1003'")).scalar() == 0
        assert c.execute(text("SELECT count(*) FROM claims WHERE 1=1 OR customer_id = 'CUST-1003'")).scalar() == 2


@pytest.mark.parametrize("sql", ["SELECT * FROM users", "SELECT * FROM agent_logs", "SELECT * FROM conversations", "SELECT * FROM messages",
                                 "SELECT * FROM revoked_tokens", "SELECT pan FROM customers", "SELECT * FROM customers"])
def test_tools_role_cannot_read_forbidden_objects(sql):
    with tools_conn("CUST-1001", admin=True) as c, pytest.raises(DBAPIError):
        c.execute(text(sql))


@pytest.mark.parametrize("sql", ["UPDATE policies SET status='Active'", "DELETE FROM claims", "INSERT INTO payments (id) VALUES (gen_random_uuid())",
                                 "UPDATE customers SET city='x'", "TRUNCATE policies", "CREATE TABLE evil (x int)"])
def test_tools_role_writes_fail(sql):
    with tools_conn("", admin=True) as c, pytest.raises(DBAPIError):
        c.execute(text(sql))


def test_tools_transaction_is_read_only_even_for_set_local_tricks():
    with tools_conn("CUST-1001") as c, pytest.raises(DBAPIError):
        c.execute(text("SET TRANSACTION READ WRITE"))
        c.execute(text("UPDATE policies SET status='Lapsed'"))


# ---- ia_app: no DDL, immutable identity columns
@pytest.mark.parametrize("sql", ["UPDATE users SET role='admin' WHERE username='aarav'", "UPDATE users SET customer_id='CUST-1002' WHERE username='aarav'",
                                 "UPDATE users SET username='x' WHERE username='aarav'", "UPDATE customers SET pan='X' WHERE customer_id='CUST-1001'",
                                 "UPDATE customers SET account_reference='REF-X' WHERE customer_id='CUST-1001'",
                                 "UPDATE customers SET customer_id='CUST-9999' WHERE customer_id='CUST-1001'",
                                 "UPDATE policies SET sum_insured=1", "UPDATE policies SET customer_id='CUST-1002'", "UPDATE payments SET amount=1", "DELETE FROM payments",
                                 "DELETE FROM claims", "CREATE TABLE evil (x int)", "DROP TABLE users",
                                 "DELETE FROM agent_logs", "UPDATE agent_logs SET query='x'"])
def test_app_role_privilege_boundaries(sql):
    with app_conn() as c, pytest.raises(DBAPIError):
        c.execute(text(sql))


def test_app_role_can_update_contact_columns():
    with app_conn() as c:
        c.execute(text("UPDATE customers SET city='Pune' WHERE customer_id='CUST-1001'"))
        c.rollback()
