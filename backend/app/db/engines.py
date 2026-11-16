"""Three engines, three roles: ia_app (API), ia_tools (agent tools, read-only + RLS), ia_owner (migrations/seed)."""
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings


@lru_cache
def app_engine():
    return create_engine(get_settings().database_url, pool_pre_ping=True, pool_size=10)


@lru_cache
def tools_engine():
    # every connection of this engine is opened READ ONLY (BEGIN READ ONLY); RLS context is set per call
    return create_engine(get_settings().tools_database_url, pool_pre_ping=True, pool_size=5,
                         execution_options={"postgresql_readonly": True})


@lru_cache
def owner_engine():
    return create_engine(get_settings().migrations_database_url, pool_pre_ping=True)


@lru_cache
def _session_factory():
    return sessionmaker(bind=app_engine(), autoflush=False, expire_on_commit=False)


def SessionLocal():
    return _session_factory()()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
