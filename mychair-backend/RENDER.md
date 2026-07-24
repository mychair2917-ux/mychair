# MyChair API — Render Docker service (manual setup checklist)
#
# If the service was created as "Python" (native), switch to Docker:
#
#   Settings → Runtime: Docker
#   Root Directory: mychair-backend
#   Dockerfile Path: Dockerfile
#   Docker Context: .   (default)
#
# Clear any custom Build Command / Start Command — the Dockerfile CMD runs uvicorn.
#
# Required env vars (Environment tab): see .env.production.example
#
# Image uses Python 3.11 (see Dockerfile). Do NOT use native Python 3.14 on Render.
