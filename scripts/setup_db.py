#!/usr/bin/env python3
"""One-time PostgreSQL setup. Creates the roles and databases and PRINTS the connection settings to the console.

    python scripts/setup_db.py --user postgres            # asks for the superuser password (or set PGPASSWORD)

Copy the printed block into backend/.env. Nothing secret is written to disk by this script; the passwords it generates
appear only in the console. Running it again resets the three role passwords and prints new ones.
Run it with the backend virtualenv active (it needs psycopg).
"""
import argparse
import getpass
import os
import secrets
import sys
from urllib.parse import quote

import psycopg
from psycopg import sql

ROLES = ("ia_owner", "ia_app", "ia_tools")
DBS = ("insurance_agent", "insurance_agent_test")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default=os.environ.get("PGHOST", "localhost"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("PGPORT", 5432)))
    ap.add_argument("--user", default=os.environ.get("PGUSER", "postgres"), help="PostgreSQL superuser")
    ap.add_argument("--password", default=os.environ.get("PGPASSWORD"), help="superuser password (prompted when omitted and needed)")
    ap.add_argument("--dbname", default="postgres", help="maintenance database to connect to first")
    a = ap.parse_args()

    def connect(db: str, password: str | None):
        return psycopg.connect(host=a.host, port=a.port, user=a.user, password=password, dbname=db, autocommit=True, connect_timeout=5)

    try:
        admin = connect(a.dbname, a.password)
    except psycopg.OperationalError as e:
        if "password" not in str(e).lower() or a.password is not None:
            print(f"Cannot connect to PostgreSQL at {a.host}:{a.port} as {a.user}: {e}", file=sys.stderr)
            return 1
        a.password = getpass.getpass(f"Password for PostgreSQL user {a.user}: ")
        admin = connect(a.dbname, a.password)

    pw = {r: secrets.token_urlsafe(24) for r in ROLES}
    with admin:
        for r in ROLES:
            exists = admin.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (r,)).fetchone()
            verb = "ALTER" if exists else "CREATE"
            admin.execute(sql.SQL("{} ROLE {} LOGIN PASSWORD {}").format(sql.SQL(verb), sql.Identifier(r), sql.Literal(pw[r])))
        for d in DBS:
            if not admin.execute("SELECT 1 FROM pg_database WHERE datname = %s", (d,)).fetchone():
                admin.execute(sql.SQL("CREATE DATABASE {} OWNER ia_owner ENCODING 'UTF8'").format(sql.Identifier(d)))
    for d in DBS:  # connection privileges only; table, column and row-level-security grants come from the Alembic migrations
        with connect(d, a.password) as c:
            c.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
            c.execute(sql.SQL("REVOKE ALL ON DATABASE {} FROM PUBLIC").format(sql.Identifier(d)))
            c.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO ia_app, ia_tools, ia_owner").format(sql.Identifier(d)))

    url = lambda role, db: f"postgresql+psycopg://{role}:{quote(pw[role], safe='')}@{a.host}:{a.port}/{db}"  # noqa: E731
    bar = "=" * 78
    print(f"\nDatabase setup complete.\n\n{bar}\nCopy these lines into backend/.env (replace the existing values):\n{bar}\n")
    print(f"DATABASE_URL={url('ia_app', DBS[0])}")
    print(f"TOOLS_DATABASE_URL={url('ia_tools', DBS[0])}")
    print(f"MIGRATIONS_DATABASE_URL={url('ia_owner', DBS[0])}")
    print(f"TEST_DATABASE_URL={url('ia_owner', DBS[1])}")
    print(f"JWT_SECRET={secrets.token_urlsafe(48)}")
    print(f"SYSTEM_PROMPT_CANARY=CANARY-{secrets.token_hex(6)}")
    print(f"\n{bar}\nThese passwords are shown only now. Next: alembic upgrade head && python -m app.seed\n{bar}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
