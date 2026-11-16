"""Alembic runs as the schema owner (ia_owner) via MIGRATIONS_DATABASE_URL. Tests pass their own URL via -x url=..."""
from alembic import context
from sqlalchemy import create_engine

from app.config import get_settings
from app.models import db as _models  # noqa: F401  (register tables)
from app.db.base import Base

target_metadata = Base.metadata


def _url() -> str:
    return context.get_x_argument(as_dictionary=True).get("url") or get_settings().migrations_database_url


def run_migrations_online() -> None:
    engine = create_engine(_url())
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run_migrations_online()
