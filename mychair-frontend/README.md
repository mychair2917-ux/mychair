# MyChair Frontend

Standalone React 19 + TypeScript + Vite SPA for MyChair.

## Environments

| Mode | Typical API URL |
|------|-----------------|
| UAT / local | `http://localhost:8000/api/v1` |
| Production | Set `VITE_API_BASE_URL` at **build** time (no hardcoded URLs) |

## Quick start (UAT)

```bash
cp .env.uat.example .env
npm ci
npm run dev
```

Dev server: http://localhost:5173

## Build

```bash
cp .env.production.example .env.production   # edit API URL
npm ci
npm run build
npm run preview
```

## Environment files

| File | Use |
|------|-----|
| `.env.example` | Generic reference |
| `.env.uat.example` | Local / UAT |
| `.env.production.example` | Production placeholders |

### Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API prefix ending in `/api/v1` |
| `VITE_APP_NAME` | Display name |

## Docker

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://your-api.example.com/api/v1 \
  --build-arg VITE_APP_NAME=MyChair \
  -t mychair-frontend .
docker run --rm -p 8080:80 mychair-frontend
```

Nginx serves the static SPA only. The browser calls the API using `VITE_API_BASE_URL` (no hardcoded backend proxy).

## Render deployment

Blueprint: [`render.yaml`](render.yaml) — frontend service only.

1. Point Render at this directory / Dockerfile.
2. Set `VITE_API_BASE_URL` (and optional `VITE_APP_NAME`) in the dashboard.
3. Deploy and verify the SPA loads and calls the API.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

## Layout

```text
src/
  pages/        # route screens
  components/   # UI
  redux/        # RTK Query + auth
  routes/       # React Router
public/
Dockerfile
nginx.conf
render.yaml
```
