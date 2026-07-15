# Jenkins setup for MyChair

## Prerequisites

- Jenkins with Pipeline plugin
- Agents with:
  - Python 3.11+ (`python3`, `venv`)
  - Node.js 22+ and npm
  - `curl` (for optional Render deploy)

## Create the job

1. **New Item** → Pipeline
2. Pipeline definition: **Pipeline script from SCM**
3. SCM: this Git repository
4. Script path: `Jenkinsfile`

## Optional Render deploy

1. In the Render dashboard, open **mychair-api** → **Settings** → **Deploy Hook**
2. Copy the hook URL
3. In Jenkins, add an environment variable (or secret text credential exported as env):
   - `RENDER_DEPLOY_HOOK_URL=<hook url>`
4. When running a build, check **RENDER_DEPLOY** = true

Without `RENDER_DEPLOY=true`, the pipeline only builds and validates — it never deploys.

## Manual pipeline equivalent

```bash
./scripts/backend-build.sh
./scripts/backend-test.sh
./scripts/frontend-build.sh
./scripts/frontend-test.sh
RENDER_DEPLOY=true RENDER_DEPLOY_HOOK_URL=... ./scripts/deploy-render.sh
```
