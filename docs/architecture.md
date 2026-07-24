# Architecture

```text
┌──────────────────────┐     HTTPS      ┌──────────────────────────┐
│  mychair-frontend    │ ─────────────► │  mychair-backend (API)   │
│  (Vite / React SPA)  │   /api/v1/*    │  FastAPI                 │
└──────────────────────┘                └───────────┬──────────────┘
                                                    │
                         ┌──────────────────────────┼──────────────────────────┐
                         ▼                          ▼                          ▼
                  MongoDB Atlas / local      Redis (cache/queue)         ARQ worker
                  (MONGODB_URI)               (REDIS_URI)            (same image, optional)
```

## Packages

| Directory | Responsibility |
|-----------|----------------|
| `mychair-backend/` | REST API, auth, domain services, workers |
| `mychair-frontend/` | Browser SPA |
| `docs/` | Cross-cutting documentation |

Each package is **standalone** (own Docker/Render/env). No runtime dependency on the repository root.

## Backend layers (unchanged)

- `app/api` — HTTP routers / dependencies
- `app/services` — business logic
- `app/repositories` — data access
- `app/models` — Beanie documents
- `app/schemas` — Pydantic request/response models
- `app/core` — config, security, logging
- `app/workers` — ARQ background jobs

## Frontend layers (unchanged)

- `src/pages` — route screens
- `src/redux` — RTK Query APIs + auth session
- `src/components` — UI
- `src/routes` — React Router

## Health endpoints

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness |
| `GET /health/deep` | Mongo + Redis readiness |

## Environments

- `ENVIRONMENT=uat` — local defaults (localhost Mongo/Redis)
- `ENVIRONMENT=production` — require env vars (no committed production URLs)
