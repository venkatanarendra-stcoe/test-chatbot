"""initial schema, roles' grants, masked view and row-level security

Revision ID: 0001
Revises:
"""
from alembic import op

from app.db.base import Base
from app.models import db as _models  # noqa: F401

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

RLS_TABLES = ("customers", "policies", "claims", "payments")
RLS_EXPR = "customer_id = current_setting('app.customer_id', true) OR current_setting('app.is_admin', true) = 'true'"

GRANTS = """
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, ia_app, ia_tools;
GRANT USAGE ON SCHEMA public TO ia_app, ia_tools;

-- ia_app (the API): no DDL; identity columns are immutable for it (column-level UPDATE privileges)
GRANT SELECT ON users, customers, policies, claims, payments TO ia_app;
GRANT UPDATE (password_hash, is_active) ON users TO ia_app;                       -- NOT role / customer_id / username
GRANT UPDATE (full_name, email, phone, date_of_birth, city, state) ON customers TO ia_app;   -- NOT customer_id / pan / account_reference
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO ia_app;
GRANT SELECT, INSERT, DELETE ON messages TO ia_app;
GRANT SELECT, INSERT ON agent_logs, revoked_tokens TO ia_app;                      -- append-only

-- ia_tools (agent tools ONLY): read-only; no users / conversations / messages / agent_logs / revoked_tokens; no customers.pan
GRANT SELECT ON policies, claims, payments TO ia_tools;
GRANT SELECT (customer_id, full_name, email, phone, date_of_birth, city, state, account_reference, created_at, pan_masked) ON customers TO ia_tools;
GRANT SELECT ON customers_masked TO ia_tools;
"""


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    op.execute("""
        CREATE VIEW customers_masked WITH (security_invoker = true) AS
        SELECT customer_id, full_name, email, phone, date_of_birth, city, state, pan_masked, account_reference, created_at
        FROM customers
    """)
    sql = "\n".join(l.split("--")[0] for l in GRANTS.splitlines())  # drop comments, then run statement by statement
    for stmt in filter(None, (s.strip() for s in sql.split(";"))):
        op.execute(stmt)
    for t in RLS_TABLES:
        op.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
        # tools: only the authenticated customer's rows (or everything for an admin context); both settings come from the auth context
        op.execute(f"CREATE POLICY tools_rls ON {t} FOR SELECT TO ia_tools USING ({RLS_EXPR})")
        # the API role keeps normal access; its tenancy is enforced by the repositories
        op.execute(f"CREATE POLICY app_all ON {t} FOR ALL TO ia_app USING (true) WITH CHECK (true)")


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS customers_masked")
    Base.metadata.drop_all(bind=op.get_bind())
