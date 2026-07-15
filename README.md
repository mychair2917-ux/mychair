# MyChair

Salon ERP SaaS — FastAPI backend, React frontend, MongoDB, Redis/ARQ workers.

**Business logic, APIs, auth, and schema are frozen.** This repo’s DevOps layer adds CI/CD, logging, scripts, and docs without changing application behavior.

---

## Architecture

```text
Vercel (Frontend SPA) ──► Render API (FastAPI) ──► MongoDB Atlas
                                │
                                ├── Redis (cache / ARQ queue)
                                └── Render Worker (ARQ)
```

Details: [docs/architecture.md](docs/architecture.md) · Deploy: [docs/deployment.md](docs/deployment.md)

---

## Folder structure

```text
/
├── Backend/                 # FastAPI app (Python 3.11 Docker image)
│   ├── app/                 # Application code
│   ├── tests/               # Pytest suite
│   ├── requirements.txt     # Production deps
│   ├── requirements-dev.txt # Lint + test deps
│   ├── Dockerfile
│   └── .env.example
├── Frontend/                # React 19 + Vite + TypeScript
│   ├── src/
│   ├── Dockerfile
│   └── .env.example
├── scripts/                 # Reusable build / test / deploy scripts
├── jenkins/                 # Jenkins job notes
├── docs/                    # Architecture & deployment docs
├── .github/workflows/       # GitHub Actions CI
├── Jenkinsfile              # Jenkins declarative pipeline
├── render.yaml              # Render Blueprint (API + worker + Redis)
├── docker-compose.yml       # Local full stack
└── .env.example             # Combined env reference (no secrets)
```

Directory names `Backend/` and `Frontend/` are kept intentionally so existing Render/Docker paths stay valid.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ (3.11 in production Docker) |
| Node.js | 22+ |
| npm | comes with Node |
| Docker / Compose | optional local stack |
| MongoDB | local or Atlas |
| Redis | local or Render Key Value |

---

## Local setup

```bash
git clone <repo-url> mychair
cd mychair
cp .env.example Backend/.env   # then edit secrets
cp Frontend/.env.example Frontend/.env
```

### MongoDB setup

**Option A — Docker Compose (recommended)**

```bash
docker compose up mongodb redis -d
```

Compose sets `MONGODB_URI=mongodb://mongodb:27017` inside containers. From the host use `mongodb://localhost:27017`.

**Option B — Atlas**

Set `MONGO_URL` in `Backend/.env` to your `mongodb+srv://…` URI (URL-encode special characters in the password).

### Backend setup

```bash
./scripts/backend-build.sh
# or manually:
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # if not already
```

Start API:

```bash
./scripts/backend-start.sh
# or: cd Backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Worker (optional locally):

```bash
cd Backend && source .venv/bin/activate
python -m app.workers.run_worker
```

Health:

- http://localhost:8000/health  
- http://localhost:8000/health/deep  
- http://localhost:8000/docs  

### Frontend setup

```bash
./scripts/frontend-build.sh          # install + production build
# or for day-to-day development:
cd Frontend
cp .env.example .env
npm ci
npm run dev                          # Vite (port 3000 in vite.config)
```

Set `VITE_API_BASE_URL` to `http://localhost:8000/api/v1` for local API.

### Full stack via Docker

```bash
docker compose up --build
```

With `docker-compose.override.yml`, frontend Vite is on `http://127.0.0.1:8082`.

---

## Environment variables

Templates (no real secrets):

| File | Purpose |
|------|---------|
| [`.env.example`](.env.example) | Combined reference |
| [`Backend/.env.example`](Backend/.env.example) | API / worker |
| [`Frontend/.env.example`](Frontend/.env.example) | Vite `VITE_*` |

### Critical backend variables

| Variable | Description |
|----------|-------------|
| `ENV` | `development` or `production` |
| `MONGO_URL` / `MONGODB_URI` | Mongo connection string |
| `REDIS_URL` / `REDIS_URI` | Redis connection string |
| `JWT_SECRET` / `SECRET_KEY` | Access-token signing key |
| `REFRESH_SECRET_KEY` | Refresh-token signing key |
| `BACKEND_CORS_ORIGINS` | JSON array of allowed origins |
| `FRONTEND_URL` | SPA URL (emails / redirects) |
| `BACKEND_PUBLIC_URL` | Public API URL (asset links) |

Production startup **validates** that secrets and remote URIs are set (see `Backend/app/core/config.py`). Logs never print raw secrets — only fingerprints / masked URIs.

### Critical frontend variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | API prefix, e.g. `https://…/api/v1` |
| `VITE_APP_NAME` | Display name |

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/backend-build.sh` | Create venv + install prod deps |
| `scripts/backend-test.sh` | Ruff (optional strict) + pytest |
| `scripts/backend-start.sh` | Production-style uvicorn |
| `scripts/frontend-build.sh` | `npm ci` + `npm run build` |
| `scripts/frontend-test.sh` | ESLint; `npm test` only if defined |
| `scripts/deploy-render.sh` | Optional Deploy Hook (`RENDER_DEPLOY=true`) |

---

## Jenkins setup

1. Create a Pipeline job → **Pipeline script from SCM** → Script path `Jenkinsfile`
2. Agent must have Python 3.11+, Node 22+, npm, curl
3. Optional: set `RENDER_DEPLOY_HOOK_URL` on the job
4. Build with **RENDER_DEPLOY=false** (default) for CI-only; set **true** to deploy

More detail: [jenkins/README.md](jenkins/README.md)

### Pipeline stages

1. **Checkout** — SCM
2. **Display Environment** — tool versions
3. **Backend Setup** — venv + `pip install`
4. **Backend Validation** — lint + tests
5. **Frontend Setup** — `npm ci`
6. **Frontend Build** — `npm run build`
7. **Frontend Validation** — lint (+ tests if present)
8. **Archive Artifacts** — `Frontend/dist/**`
9. **Trigger Render Deployment** — only when `RENDER_DEPLOY=true`

The pipeline fails immediately on stage errors (`set -e` in scripts).

---

## Render deployment

Blueprint: [`render.yaml`](render.yaml)

1. Connect the repo in Render → Blueprint  
2. Fill `MONGO_URL`, `BACKEND_PUBLIC_URL`, Resend keys, etc. (`sync: false` vars)  
3. Deploy Redis → API → Worker  
4. Verify fingerprints and `/health/deep`  

Optional Jenkins trigger uses a **Deploy Hook** (does not embed secrets in the repo).

Frontend stays on **Vercel** in the current production topology.

---

## Logging

Structured Python logging (`Backend/app/core/logging_config.py`):

- Timestamped INFO / WARNING / ERROR / EXCEPTION  
- Startup / shutdown banners  
- Mongo / Redis connection logs (URIs masked)  
- HTTP request logs (method, path, status, duration — no headers/bodies/tokens)  

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| API won’t start in production | `MONGO_URL`, `REDIS_URL`, `JWT_SECRET`, `REFRESH_SECRET_KEY` set; `ENV=production` |
| CORS errors | `BACKEND_CORS_ORIGINS` includes the exact SPA origin |
| Worker auth weirdness | JWT fingerprint in API vs worker logs must match (shared env group) |
| `/health/deep` degraded | Atlas IP allowlist / Redis URL / network |
| Frontend calls wrong host | `VITE_API_BASE_URL` at **build** time |
| Jenkins deploy skipped | `RENDER_DEPLOY` must be `true` **and** `RENDER_DEPLOY_HOOK_URL` set |
| Local `.env` ignored by git | Correct — never commit secrets; use `.env.example` only |

---

## Rollback

**Render:** Service → Deploys → select previous → Rollback → re-check `/health/deep`.

**Frontend (Vercel):** Promote previous deployment in the Vercel dashboard.

**Git:** `git revert` / redeploy the last known-good commit (do not force-push `main` unless explicitly intended).

---

## License / product

Internal MyChair / Salon ERP SaaS application.
