# MyChair

Salon ERP SaaS monorepo — standalone backend and frontend packages.

**Application behavior (APIs, auth, schema, UI, routing) is unchanged.**  
This repository is organized so each package can build and deploy independently.

---

## Layout

```text
mychair/
├── mychair-backend/     # FastAPI API (standalone)
├── mychair-frontend/    # React + Vite SPA (standalone)
├── docs/                # Architecture & deployment notes
└── README.md
```

| Package | Stack | Deploy |
|---------|--------|--------|
| [`mychair-backend/`](mychair-backend/) | FastAPI, Motor/Beanie, Redis, ARQ | Docker / Render (`render.yaml`) |
| [`mychair-frontend/`](mychair-frontend/) | React 19, TypeScript, Vite, Tailwind | Docker / Render (`render.yaml`) |

Each package has its own `Dockerfile`, `render.yaml`, `.env*.example`, and `README.md`.  
There is **no** root `docker-compose` or root `render.yaml`.

---

## Environments

Only two environments:

| Value | Use |
|-------|-----|
| `uat` | Local UAT — MongoDB/Redis on localhost |
| `production` | All critical config from environment variables |

Set `ENVIRONMENT=uat` or `ENVIRONMENT=production` (legacy `ENV` still works on the backend).

### UAT defaults (backend)

| Concern | Default |
|---------|---------|
| MongoDB | `mongodb://localhost:27017` |
| Redis | `redis://localhost:6379/0` |
| Backend | `http://localhost:8000` |
| Frontend | `http://localhost:5173` |

### Production

No production URLs or secrets are committed. Configure via Render / host env vars. See:

- [`mychair-backend/.env.production.example`](mychair-backend/.env.production.example)
- [`mychair-frontend/.env.production.example`](mychair-frontend/.env.production.example)

---

## Local setup

### Backend

```bash
cd mychair-backend
cp .env.uat.example .env
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
# Start MongoDB + Redis locally, or: docker compose up -d mongodb redis
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or full local stack: `cd mychair-backend && docker compose up --build`

### Frontend

```bash
cd mychair-frontend
cp .env.uat.example .env
npm ci
npm run dev    # http://localhost:5173
```

---

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Backend README](mychair-backend/README.md)
- [Frontend README](mychair-frontend/README.md)

---

## Rollback

- **Render:** previous deploy → Rollback → verify `/health` (API) and SPA load
- **Git:** revert the restructuring commit if needed
