# Deployment

## Backend (Render — Docker)

Use [`render.yaml`](../render.yaml) at repo root **or** [`mychair-backend/render.yaml`](../mychair-backend/render.yaml).

**Critical:** Runtime must be **Docker**, not native Python.

| Dashboard setting | Value |
|-------------------|--------|
| Runtime | Docker |
| Root Directory | `mychair-backend` |
| Dockerfile Path | `Dockerfile` |
| Health check | `/health` |

Clear custom **Build Command** / **Start Command** so the Dockerfile `CMD` is used (Python 3.11).

1. Create a Render Docker web service with root `mychair-backend/`
2. Set production secrets in the dashboard (`MONGODB_URI`, `REDIS_URI`, `JWT_SECRET`, CORS, URLs, email)
3. Set `ENVIRONMENT=production`
4. Verify `GET /health` and `GET /health/deep`

Local Docker Compose (`mychair-backend/docker-compose.yml`) is for **UAT only** (api, worker, mongodb, redis). Do not use compose for production.

### Worker (optional)

The ARQ worker uses the same Docker image:

```bash
python -m app.workers.run_worker
```

Provision as a separate Render worker if background jobs are required.

## Frontend (Render)

Use [`mychair-frontend/render.yaml`](../mychair-frontend/render.yaml) — **SPA only**.

1. Docker web service with context `mychair-frontend/`
2. Set `VITE_API_BASE_URL` to the backend API prefix (`https://…/api/v1`) at build time
3. Deploy and confirm the SPA loads

Nginx serves static files only; the browser calls the API via `VITE_API_BASE_URL`.

## Rollback

1. Render → service → Deploys → previous successful deploy → Rollback
2. Re-check health / SPA
