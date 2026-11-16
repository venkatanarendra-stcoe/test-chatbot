"""let the API role renew a policy (limited columns) and record the premium payment

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("GRANT UPDATE (status, end_date, details) ON policies TO ia_app")  # NOT customer_id / sums / premium / policy_number
    op.execute("GRANT INSERT ON payments TO ia_app")                              # append-only: no UPDATE / DELETE


def downgrade() -> None:
    op.execute("REVOKE UPDATE (status, end_date, details) ON policies FROM ia_app")
    op.execute("REVOKE INSERT ON payments FROM ia_app")
