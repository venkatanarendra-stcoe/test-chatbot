# Running the Insurance Portal on another machine

Everything runs locally; nothing is hosted. All people and data are fictional.

## 1. Install the prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.12 | `python3 --version` |
| Node.js + npm | 20+ | `node --version` |
| PostgreSQL | 16+ (18 also works) | `psql --version` |
| Ollama (only for the real LLM) | current | `ollama --version` |

Copy the project folder (without `backend/.venv`, `frontend/node_modules`, `backend/.env`) to the new machine.

## 2. Database (once)

Install the Python dependencies first (step 3 below, up to `pip install`), then from the project root run the setup script as a PostgreSQL superuser:

```bash
python scripts/setup_db.py --user postgres          # add --host / --port if PostgreSQL is not on localhost:5432
```

It asks for the superuser password (or reads `PGPASSWORD`), creates the roles `ia_owner`, `ia_app`, `ia_tools` with freshly generated random passwords, creates the databases `insurance_agent` and `insurance_agent_test`, and then **prints a block of settings to the console**:

```
DATABASE_URL=postgresql+psycopg://ia_app:<password>@localhost:5432/insurance_agent
TOOLS_DATABASE_URL=postgresql+psycopg://ia_tools:<password>@localhost:5432/insurance_agent
MIGRATIONS_DATABASE_URL=postgresql+psycopg://ia_owner:<password>@localhost:5432/insurance_agent
TEST_DATABASE_URL=postgresql+psycopg://ia_owner:<password>@localhost:5432/insurance_agent_test
JWT_SECRET=<random>
SYSTEM_PROMPT_CANARY=CANARY-<random>
```

Copy those lines into `backend/.env` (step 3). Nothing is written to disk by the script, and the passwords are shown only once; running it again resets the role passwords and prints new ones.

## 3. Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env                 # Windows: copy .env.example .env
```

Edit `backend/.env`:

| Variable | What to set |
|----------|-------------|
| `DATABASE_URL`, `TOOLS_DATABASE_URL`, `MIGRATIONS_DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`, `SYSTEM_PROMPT_CANARY` | paste the lines printed by `scripts/setup_db.py` in step 2 |
| `LLM_PROVIDER` | `ollama` (real model) or `mock` (no model needed) |
| `LLM_MODEL` | a model you have pulled, e.g. `qwen2.5:7b` |
| `HOST`, `PORT`, `RELOAD` | where the API listens (default `127.0.0.1`, `8000`, `false`). Use `HOST=0.0.0.0` to reach it from other devices, and set `FRONTEND_ORIGIN` to the frontend URL |

Create the tables and seed the data, then start the API:

```bash
alembic upgrade head
python -m app.seed
python -m app.main                   # uses HOST / PORT / RELOAD from .env
```

Check: <http://localhost:8000/api/health> returns `{"status":"ok"}`; API docs at `/docs`.

## 4. LLM (skip when `LLM_PROVIDER=mock`)

```bash
ollama pull qwen2.5:7b               # or the model named in LLM_MODEL
ollama serve                         # unless the desktop app is already running
```

If Ollama or the model is missing, the app still starts and chat returns an error reply until it is available.

## 5. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env                 # Windows: copy .env.example .env
npm run dev                          # http://localhost:5173, proxies /api to localhost:8000
```

If the backend runs on another host or port, change the proxy target in `frontend/vite.config.ts`.

Production-style build: `npm run build` then `npm run preview`.

## 6. Sign in

Open <http://localhost:5173>. Sign in with one of the [test accounts](#test-accounts-all-fictional) below (for example `aarav` / `Aarav@123`, or `admin` / `Admin@123`).

## 7. Verify

```bash
cd backend && LLM_PROVIDER=mock pytest          # needs PostgreSQL, no Ollama
python ../scripts/demo.py --mode mock           # backend running with LLM_PROVIDER=mock
cd ../frontend && npm run build && npm run lint
npx playwright install chromium && npm run screenshots   # optional visual QA, output in frontend/screenshots/
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `password authentication failed` | the URLs in `.env` are not the ones printed by the latest `scripts/setup_db.py` run |
| `connection refused` on the DB | wrong host/port in the three `*_DATABASE_URL` values, or PostgreSQL is not running |
| Port 8000 already in use | change `PORT` in `backend/.env` and the proxy target in `vite.config.ts` |
| Chat replies with an error | Ollama not running or model not pulled; or switch to `LLM_PROVIDER=mock` |
| Login works but pages show 401 | `JWT_SECRET` changed after login; sign in again |
| Reset sample data | `python -m app.seed --reset` |

## Test accounts (all fictional)

The login page no longer lists these. Seeded by `python -m app.seed`.

| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| aarav | Aarav@123 | Customer | Primary test user |
| priya | Priya@123 | Customer | No claims |
| rohan | Rohan@123 | Customer | 3 policies, one in grace period |
| ananya | Ananya@123 | Customer | Lapsed policy |
| vikram | Vikram@123 | Customer | Expired and pending policies |
| sneha | Sneha@123 | Customer | Disabled account (login is refused) |
| joy | Joy@123 | Customer | Name is a common word |
| arjun | Arjun@123 | Customer | Claim containing injected text |
| meera | Meera@123 | Customer | Family floater |
| sanjay | Sanjay@123 | Customer | High-value term life |
| priyanka | Priyanka@123 | Customer | Name overlaps "Priya" |
| admin | Admin@123 | Admin | Admin console |

These are test credentials for fictional users.
