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

## Setup commands

The exact commands used on 2026-10-09, in order. Run them on a machine with `gcloud` and `gh`
installed (`brew install --cask gcloud-cli`, `brew install gh`) and outside a TLS-intercepting
corporate network.

### Step 0: log in and select the project

```bash
gcloud auth login
gcloud config set project ready4trip-5d3f6
gcloud auth list                  # your account marked *
gcloud config get-value project   # ready4trip-5d3f6
gh auth status                    # logged in to github.com
```

### Step 1: billing, budget alert, APIs

Billing is linked in the console, not the CLI:

1. Link a billing account at
   `https://console.cloud.google.com/billing/linkedaccount?project=ready4trip-5d3f6`.
2. Create a budget at `https://console.cloud.google.com/billing/budgets`: scope
   `ready4trip-5d3f6`, all services, specified amount €1, alerts at 50/90/100% actual plus 100%
   forecasted, emails to billing admins.

Then enable the APIs (fails with `UREQ_PROJECT_BILLING_NOT_FOUND` until billing is linked):

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project=ready4trip-5d3f6
```

### Step 2: service accounts and permissions

```bash
gcloud iam service-accounts create recommender-runtime \
  --project=ready4trip-5d3f6 \
  --display-name="recommender-service Cloud Run runtime"

gcloud iam service-accounts create recommender-deploy \
  --project=ready4trip-5d3f6 \
  --display-name="recommender-service Cloud Run deploy"

for ROLE in roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding ready4trip-5d3f6 \
    --member="serviceAccount:recommender-deploy@ready4trip-5d3f6.iam.gserviceaccount.com" \
    --role="$ROLE" \
    --condition=None
done

gcloud iam service-accounts add-iam-policy-binding \
  recommender-runtime@ready4trip-5d3f6.iam.gserviceaccount.com \
  --project=ready4trip-5d3f6 \
  --member="serviceAccount:recommender-deploy@ready4trip-5d3f6.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts list --project=ready4trip-5d3f6
```

`--condition=None` stops `gcloud` from prompting interactively for an IAM condition. Each
binding prints the project's whole policy as YAML; only an `ERROR` line matters.

### Step 3: deploy key as a GitHub secret

```bash
gcloud iam service-accounts keys create recommender-deploy-key.json \
  --iam-account=recommender-deploy@ready4trip-5d3f6.iam.gserviceaccount.com

jq -c . recommender-deploy-key.json | gh secret set GCP_SERVICE_ACCOUNT_RECOMMENDER_DEPLOY --repo horacisalvany/trip-ready

rm recommender-deploy-key.json

gh secret list --repo horacisalvany/trip-ready
```

Without `jq`, replace the middle command with
`python3 -c 'import json; print(json.dumps(json.load(open("recommender-deploy-key.json"))))' | gh secret set GCP_SERVICE_ACCOUNT_RECOMMENDER_DEPLOY --repo horacisalvany/trip-ready`.

### Step 4: Artifact Registry and image cleanup

```bash
gcloud artifacts repositories create recommender-service \
  --repository-format=docker \
  --location=europe-west1 \
  --project=ready4trip-5d3f6

cat > /tmp/cleanup-policy.json <<'EOF'
[
  {
    "name": "delete-everything-by-default",
    "action": {"type": "Delete"},
    "condition": {"tagState": "any"}
  },
  {
    "name": "keep-last-3",
    "action": {"type": "Keep"},
    "mostRecentVersions": {"keepCount": 3}
  }
]
EOF

gcloud artifacts repositories set-cleanup-policies recommender-service \
  --location=europe-west1 \
  --project=ready4trip-5d3f6 \
  --policy=/tmp/cleanup-policy.json \
  --no-dry-run

rm /tmp/cleanup-policy.json

gcloud artifacts repositories describe recommender-service --location=europe-west1 --project=ready4trip-5d3f6
```

### Step 5: Gemini key in Secret Manager

Create the secret empty first, then add the value as a separate step, so a failed paste can't
leave a half-created secret that looks done:

```bash
gcloud secrets create gemini-api-key --project=ready4trip-5d3f6 --replication-policy=automatic
```

Copy the key from `https://aistudio.google.com/apikey`, and copy nothing else until it's pasted.
Put it in a temporary file (`nano`: Cmd+V, then Ctrl+O, Enter, Ctrl+X):

```bash
nano /tmp/gk
```

```bash
tr -d '\n' < /tmp/gk | wc -c   # about 39; 0 means the paste didn't land
```

```bash
tr -d '\n' < /tmp/gk | gcloud secrets versions add gemini-api-key --project=ready4trip-5d3f6 --data-file=-
rm /tmp/gk

gcloud secrets add-iam-policy-binding gemini-api-key \
  --project=ready4trip-5d3f6 \
  --member="serviceAccount:recommender-runtime@ready4trip-5d3f6.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets versions list gemini-api-key --project=ready4trip-5d3f6   # version 1, enabled
```

`tr -d '\n'` strips the trailing newline `nano` adds, which would otherwise become part of the
key. A temp file is used rather than `read -s` because pasting into a hidden prompt silently
captured nothing on the setup machine.

## Manual smoke test after the first deploy

The token request below uses this project's Web API key (public, already in
`src/environments/environment.ts`), not a leaked secret:

```bash
SERVICE_URL=$(gcloud run services describe recommender-service --region europe-west1 --project ready4trip-5d3f6 --format='value(status.url)')

ID_TOKEN=$(curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAO5g0mlYLZ2lU7Rxgxen9sbhKudZPiL4Y" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD","returnSecureToken":true}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["idToken"])')

echo "Token length: ${#ID_TOKEN}"   # a real ID token is ~900+ characters

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

The login step needs an email/password account. An account that only uses "Sign in with Google"
has no password, so `signInWithPassword` can't issue a token for it.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `UREQ_PROJECT_BILLING_NOT_FOUND` when enabling APIs | No billing account linked | Step 1: link billing in the console, then re-run |
| Deploy fails: `Secret .../gemini-api-key/versions/latest was not found` | The secret exists but has no version (the value never got stored) | `gcloud secrets versions list gemini-api-key --project=ready4trip-5d3f6`; if empty, redo the `nano` part of step 5 |
| Deploy fails: `Permission denied on secret` | `recommender-runtime` lacks `secretAccessor` on the secret | Re-run the `gcloud secrets add-iam-policy-binding` command in step 5 |
| Smoke test returns `401`, token length well under ~900 | The login failed, so no real token was sent | Re-run the login request without the `python3` part to see Firebase's error (e.g. `INVALID_LOGIN_CREDENTIALS`) |
| Smoke test returns `401` with a real-length token | The backend rejected the token | Add `-i` to the `curl` and read the `WWW-Authenticate` header's `error_description` |
| A fixed setup problem after a failed deploy | — | Re-run just the failed job, no new merge needed: `gh run rerun <run-id> --failed --repo horacisalvany/trip-ready` |
