# MyChair Backend

Standalone FastAPI API for MyChair (Salon ERP SaaS).

Python **3.11** · MongoDB (Motor + Beanie) · Redis · ARQ worker

## Environments

Only two environments are supported:

| `ENVIRONMENT` | Purpose |
|---------------|---------|
| `uat` | Local / UAT — defaults to localhost MongoDB & Redis |
| `production` | All critical values must come from environment variables |

`ENV` is still accepted as a legacy alias for `ENVIRONMENT`.  
`development` / `dev` / `local` are normalized to `uat`.

## Quick start (UAT / local)

```bash
cp .env.uat.example .env
# edit secrets as needed

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

# Start MongoDB + Redis (or use docker compose below)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health:

- http://localhost:8000/health
- http://localhost:8000/health/deep
- http://localhost:8000/docs

Worker (optional):

```bash
python -m app.workers.run_worker
```

## Docker (local UAT only)

```bash
cp .env.uat.example .env
docker compose up --build
```

Services: `api`, `worker`, `mongodb`, `redis`.

Production does **not** use docker-compose — deploy with Render (or any Docker host) using the `Dockerfile`.

## Environment files

| File | Use |
|------|-----|
| `.env.example` | Full variable reference |
| `.env.uat.example` | Local / UAT template |
| `.env.production.example` | Production placeholders (no secrets) |

Copy the appropriate file to `.env`. Never commit `.env`.

### Critical variables

| Variable | Notes |
|----------|--------|
| `ENVIRONMENT` | `uat` or `production` |
| `MONGODB_URI` / `MONGO_URL` | Mongo connection string |
| `REDIS_URI` / `REDIS_URL` | Redis connection string |
| `JWT_SECRET` / `SECRET_KEY` | Access-token signing key |
| `REFRESH_SECRET_KEY` | Refresh-token signing key |
| `BACKEND_CORS_ORIGINS` | JSON array of allowed origins |
| `FRONTEND_URL` | SPA URL (emails / redirects) |
| `BACKEND_PUBLIC_URL` | Public API URL (asset links) |

UAT defaults (when unset): `mongodb://localhost:27017`, `redis://localhost:6379/0`, frontend `http://localhost:5173`, API `http://localhost:8000`.

## Render deployment

Blueprint: [`render.yaml`](render.yaml) — deploys the **API** only.

1. Create a Render Blueprint from this directory (or point the service at this repo path).
2. Fill `sync: false` secrets in the dashboard (`MONGODB_URI`, `REDIS_URI`, `JWT_SECRET`, CORS, URLs, email, etc.).
3. Verify `GET /health` and `GET /health/deep`.

Dockerfile is multi-stage and listens on `$PORT`.

## Scripts

```bash
./scripts/build.sh   # venv + pip install
./scripts/test.sh    # ruff + pytest
./scripts/start.sh   # uvicorn (production-style)
```

## Project layout

```text
app/
  api/          # HTTP routers
  services/     # business logic (do not change for ops work)
  models/       # Beanie documents
  schemas/      # request/response models
  core/         # config, security, logging
  workers/      # ARQ jobs
tests/
scripts/
Dockerfile
docker-compose.yml
render.yaml
requirements.txt
runtime.txt
```

## Configuration

Central module: `app/core/config.py` (`settings` singleton).  
Services continue to read `settings.*` as before — only organization and environment loading were improved.
