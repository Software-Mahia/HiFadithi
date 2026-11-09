# HiFadithi deployment troubleshooting

## Current symptom

The UI changes are present in GitHub but are not visible in the current mobile build or the web deployment. The configured production service is:

`https://hifadithi-api.onrender.com`

The expected health check is:

`https://hifadithi-api.onrender.com/healthz/`

It should return HTTP 200 with `{"status":"ok"}`. A host-not-found/DNS response means the service URL is not currently resolving; this is different from the normal Render free-tier cold start.

## What has already been confirmed

- The UI and 3D viewer work was merged into GitHub.
- Production is configured to deploy from the `prod` branch.
- Render builds the Expo web export from `mobile/` during the Docker build.
- The local root `dist/` directory is untracked and is not the Render deployment artifact. Opening `file:///.../dist/index.html` does not verify the live web deployment.
- An installed Android APK does not update when GitHub changes are merged. A new EAS build must be generated and installed.

## Render checks

1. Open the Render dashboard and locate `hifadithi-api`.
2. Confirm that the service still exists, is not suspended, and is using its current public URL.
3. Confirm the repository is `Software-Mahia/HiFadithi` and the deployment branch is `prod`.
4. Review **Events** and **Deploys** for a failed or cancelled deployment.
5. Select **Manual Deploy → Deploy latest commit**.
6. Wait until the service is marked **Live**.
7. Test `/healthz/`, then test the service root `/` in a private browser window.

If the service URL changed, update `PUBLIC_BASE_URL` in Render and the mobile build API URL before testing again. Do not recreate the service unless the existing URL and integrations have been accounted for; changing the URL can break media links, Meshy webhooks, polling, and mobile configuration.

## Production variables to verify

Confirm that the deployed service still has its required secrets and values, especially:

- `DATABASE_URL`
- `SECRET_KEY`
- `USE_SUPABASE_STORAGE`
- `SUPABASE_S3_ENDPOINT`
- `SUPABASE_S3_REGION`
- `SUPABASE_S3_ACCESS_KEY_ID`
- `SUPABASE_S3_SECRET_ACCESS_KEY`
- `PUBLIC_BASE_URL` (the active Render URL, without a trailing slash)
- `ENGINE`, `MESHY_API_KEY`, `MESHY_AI_MODEL`, and `MESHY_WEBHOOK_TOKEN`

## Mobile verification

After the Render API is healthy, create a new Android preview APK from `mobile/`:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Install the newly generated APK. Existing APKs continue to show the bundle they were built with and will not receive GitHub changes automatically.

## Completion criteria

The issue is resolved when:

1. Render `/healthz/` returns HTTP 200.
2. Render `/` shows the current welcome and web UI.
3. The new Android preview APK installs and shows the current UI.
4. The mobile and web clients can authenticate and call the same healthy API.
