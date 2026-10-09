# Deploying recommender-service

Automatic: merging to `main` with changes under `recommender-service/` builds, tests, and
deploys to Cloud Run via `.github/workflows/recommender-deploy.yml`. Nothing manual needed
after the one-time setup below.

## One-time GCP setup (done 2026-10-09; recorded here in case it needs redoing)

0. Link a billing account to the project (Firebase's Blaze plan). The APIs below refuse to
   enable without one. Usage stays within the free tiers at this volume; a €1 budget alert on
   the project emails before anything real is charged. Budgets alert, they don't cap — the
   actual limits are the Firebase-auth requirement, the per-user daily quota, and
   `--max-instances 1` on the deploy.
1. Enable APIs: Cloud Run, Artifact Registry, Secret Manager.
2. Create two dedicated service accounts — not Owner/Editor, and not the Compute Engine default:
   - `recommender-deploy` (used by CI): `roles/run.admin` and `roles/artifactregistry.writer` on
     the project, plus `roles/iam.serviceAccountUser` on `recommender-runtime` only. Store its
     key as the GitHub secret `GCP_SERVICE_ACCOUNT_RECOMMENDER_DEPLOY`.
   - `recommender-runtime` (the identity the Cloud Run service runs as): no project roles.
3. Create an Artifact Registry Docker repository named `recommender-service` in `europe-west1`,
   with two cleanup policies: a **Delete** policy matching every image (`tagState: any`) and a
   **Keep** policy for the 3 most recent versions. Both are needed: a Keep policy only exempts
   images from Delete policies, so on its own it deletes nothing.
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
