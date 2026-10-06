# Deploying recommender-service

Automatic: merging to `main` with changes under `recommender-service/` builds, tests, and
deploys to Cloud Run via `.github/workflows/recommender-deploy.yml`. Nothing manual needed
after the one-time setup below.

## One-time GCP setup (already done, recorded here for anyone who needs to redo it)

1. Enable APIs: Cloud Run, Cloud Build, Artifact Registry, Secret Manager.
2. Create a dedicated `recommender-deploy` service account with `run.admin`,
   `artifactregistry.writer`, `secretmanager.secretAccessor`, and `iam.serviceAccountUser` —
   not Owner/Editor. Store its key as the GitHub secret
   `GCP_SERVICE_ACCOUNT_RECOMMENDER_DEPLOY`.
3. Create an Artifact Registry Docker repository named `recommender-service` in `europe-west1`.
4. Create a Secret Manager secret named `gemini-api-key` holding the real Gemini key, and grant
   the deploy service account read access to it.

## Manual smoke test after the first deploy

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
