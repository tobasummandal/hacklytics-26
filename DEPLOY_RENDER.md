# Deploy Backend On Render

This repo includes a Render Blueprint at `render.yaml` that deploys:

- `vectoraidb` (private service, Docker image)
- `archivist-backend` (FastAPI web service)

## 1. Push latest code

Push this branch to GitHub/GitLab so Render can read `render.yaml`.

## 2. Create Blueprint in Render

1. In Render dashboard, click **New +** -> **Blueprint**.
2. Connect your repo.
3. Render will detect `render.yaml` and show two services.
4. Click **Apply**.

## 3. Set required secret

After creation, open service `archivist-backend` -> **Environment** and set:

- `GEMINI_API_KEY=<your_key>`

Then redeploy `archivist-backend`.

## 4. Verify deployment

Use the backend URL from Render:

- `GET /health`
- `GET /health?probe_gemini=true`

Expected:

- `"vectorai":{"connected":true}`
- `"gemini":{"key_configured":true,...}`

## Notes

- `VECTORAI_HOST` is set to `vectoraidb` in the Blueprint.
- Backend installs the local Actian wheel during build.
- `vectoraidb` includes a persistent disk mounted at `/data`.
