# Architecture overview

See also the root [README.md](../README.md).

## System diagram

```text
┌─────────────────┐     HTTPS      ┌──────────────────────┐
│  Vercel SPA     │ ─────────────► │  Render Web Service  │
│  (Frontend/)    │   /api/v1/*    │  FastAPI (Backend/)  │
└─────────────────┘                └──────────┬───────────┘
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     │                        │                        │
                     ▼                        ▼                        ▼
              MongoDB Atlas              Render Redis            ARQ Worker
              (MONGO_URL)               (REDIS_URL)         (same Backend image)
```

## Backend layers (unchanged by DevOps work)

- `app/api` — HTTP routers / dependencies
- `app/services` — business logic
- `app/repositories` — data access
- `app/models` — Beanie documents
- `app/schemas` — Pydantic request/response models
- `app/core` — config, security, logging
- `app/workers` — ARQ background jobs

## Frontend layers

- `src/pages` — route screens
- `src/redux` — RTK Query APIs + auth session
- `src/components` — UI
- `src/routes` — React Router v7

## Health endpoints

| Path | Purpose |
|------|---------|
| `GET /health` | Liveness (Render health check) |
| `GET /health/deep` | Mongo + Redis readiness |
