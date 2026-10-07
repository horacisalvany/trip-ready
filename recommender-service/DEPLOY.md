# Deploying recommender-service

Automatic: merging to `main` with changes under `recommender-service/` builds, tests, and
deploys to Cloud Run via `.github/workflows/recommender-deploy.yml`. Nothing manual needed
after the one-time setup below.

## One-time GCP setup (must be done before the first deploy)

1. Enable APIs: Cloud Run, Artifact Registry, Secret Manager.
2. Create two dedicated service accounts — not Owner/Editor, and not the Compute Engine default:
   - `recommender-deploy` (used by CI): `roles/run.admin` and `roles/artifactregistry.writer` on
     the project, plus `roles/iam.serviceAccountUser` on `recommender-runtime` only. Store its
     key as the GitHub secret `GCP_SERVICE_ACCOUNT_RECOMMENDER_DEPLOY`.
   - `recommender-runtime` (the identity the Cloud Run service runs as): no project roles.
3. Create an Artifact Registry Docker repository named `recommender-service` in `europe-west1`.
4. Create a Secret Manager secret named `gemini-api-key` holding the real Gemini key, and grant
   `roles/secretmanager.secretAccessor` on that secret to `recommender-runtime`. Cloud Run reads
   secrets as the service's runtime identity, not as the account that deploys it.

## Manual smoke test after the first deploy

The token request below uses this project's Web API key (public, already in
`src/environments/environment.ts`), not a leaked secret:

```bash
SERVICE_URL=$(gcloud run services describe recommender-service --region europe-west1 --project ready4trip-5d3f6 --format='value(status.url)')

ID_TOKEN=$(curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAO5g0mlYLZ2lU7Rxgxen9sbhKudZPiL4Y" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD","returnSecureToken":true}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["idToken"])')

curl -s -X POST "$SERVICE_URL/api/recommendations" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "listTitle": "Japan trip",
    "tripNote": "2 weeks in Japan in November, with a toddler",
    "sections": [
      { "name": "Clothing", "items": ["socks", "t-shirts"] },
      { "name": "Documents", "items": ["passport"] }
    ]
  }' | python3 -m json.tool
```

Confirms the deployed service is reachable, authenticates correctly, and the Secret-Manager-held
key works at runtime — the same checks slice 1's local smoke test ran, now against the real
deployed URL.
