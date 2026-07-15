# Deployment

## Render (API + worker + Redis)

Infrastructure is declared in [`render.yaml`](../render.yaml):

| Service | Type | Notes |
|---------|------|--------|
| `mychair-redis` | Key Value | Deploy first |
| `mychair-api` | Web (Docker) | `Backend/Dockerfile`, health `/health` |
| `mychair-worker` | Worker (Docker) | `python -m app.workers.run_worker` |

Shared secrets live in the `mychair-shared` env group (`MONGO_URL`, `JWT_SECRET`, `REFRESH_SECRET_KEY`).

### Post-deploy checks

1. Compare JWT fingerprint in API vs worker logs — must match
2. `curl https://<api>/health/deep` — mongodb and redis both `ok`
3. Confirm CORS includes the Vercel frontend origin

### Rollback on Render

1. Open the service → **Events** / **Deploys**
2. Select the previous successful deploy → **Rollback**
3. Re-verify `/health` and `/health/deep`

## Vercel (Frontend)

The SPA is typically deployed from `Frontend/` with:

- `VITE_API_BASE_URL` pointing at the Render API (`…/api/v1`)

Build command: `npm run build`  
Output directory: `dist`

## Jenkins → Render

Use a **Deploy Hook** (see [`jenkins/README.md`](../jenkins/README.md)).  
Set `RENDER_DEPLOY=true` only when you intend to ship.

## Local Docker Compose

From repo root:

```bash
docker compose up --build
```

Override for hot reload: `docker-compose.override.yml` (Vite on host port 8082).
