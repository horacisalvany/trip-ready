# Deployment

TripReady is deployed to **Firebase Hosting**, using the same Firebase project as the app's Realtime Database (`ready4trip-5d3f6`). Hosting is configured in [`firebase.json`](../firebase.json) and [`.firebaserc`](../.firebaserc).

**Deploys are automatic.** Merging to `main` deploys the live site from GitHub Actions; no local login and no manual step are involved. The manual route below is a fallback.

## Continuous deployment

[`.github/workflows/node.js.yml`](../.github/workflows/node.js.yml) builds, tests and deploys. Which deploy happens depends on the event:

| Event | Job | Result |
| --- | --- | --- |
| Pull request | `deploy-preview` | A temporary preview URL, posted as a PR comment. Expires after 7 days. |
| Merge to `main` | `deploy-live` | The live site at `https://ready4trip-5d3f6.web.app`. |

Exactly one of the two runs per event; seeing the other reported as *skipped* is expected, not a failure.

Two properties are worth knowing, because they are the reason the workflow is shaped the way it is:

- **A failing test suite blocks the deploy.** Both deploy jobs declare `needs: build`, so neither starts unless `yarn test:prod` passed.
- **What ships is what was tested.** The `build` job uploads the production bundle as an artifact and the deploy jobs download it, rather than building a second time. Production therefore gets the exact bytes the tests ran against, not a rebuild that ought to be identical. (Bundles are not byte-reproducible across platforms — a build on macOS and one on the Linux runner differ by a few percent — so "rebuild and compare hashes" would not be a meaningful check anyway.)

Deploy scope is **hosting only**, matching what `yarn deploy` has always done. Database rules are still applied by hand; see below.

### Authentication

The workflow authenticates as a **service account** — an identity belonging to the Firebase project rather than to a person — whose key is stored in the repository secret `FIREBASE_SERVICE_ACCOUNT_READY4TRIP_5D3F6`.

The secret is write-only: GitHub's UI and API expose its name and timestamp but never its value, and workflow logs mask it. It cannot be recovered, only replaced.

To rotate or revoke it, delete the service account under [IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=ready4trip-5d3f6) in the Google Cloud console (a Firebase project *is* a Google Cloud project — service accounts live in the Cloud half), create a fresh key, then:

```bash
gh secret set FIREBASE_SERVICE_ACCOUNT_READY4TRIP_5D3F6 < new-key.json
```

Personal Firebase logins are unaffected by this, which is the point of using a service account rather than a personal token.

> Do **not** use `firebase login:ci` and `--token` for CI. That mechanism is deprecated in current `firebase-tools` and grants CI the full authority of your own account, where a service account can be scoped to Hosting deploys alone.

### Recreating the credential from scratch

Only needed if the secret is lost or the service account is deleted. Run from a machine logged in to Firebase with access to the project:

```bash
npx firebase-tools@13 init hosting:github
```

It creates the service account, grants it the Hosting roles, and pushes the secret to the repository. Two things to get right:

- **Decline** any offer to overwrite `firebase.json`, `database.rules.json` or `dist/tripReady` — those are already correct, and the rules file is a security boundary.
- **Answer no** to "set up automatic deployment when a PR is merged", and delete the workflow files it scaffolds (`firebase-hosting-merge.yml`, `firebase-hosting-pull-request.yml`). The jobs in `node.js.yml` already do this; leaving them would deploy twice per merge. They are inert while uncommitted, so deleting them locally is enough.

Confirm the result with `gh secret list`.

### Verifying a deploy

Per-job outcomes for a run:

```bash
gh run view <run-id> --json jobs -q '.jobs[] | "\(.conclusion)\t\(.name)"'
```

That the live site is serving the deploy — `last-modified` should match the time the deploy job finished:

```bash
curl -sSI https://ready4trip-5d3f6.web.app | grep -i last-modified
```

For a pull request, the preview URL is posted as a comment on the PR itself.

## Deploying manually

Still supported, and the only way to deploy something that is not on `main`. Requires the prerequisites below.

```bash
yarn deploy
```

This runs `yarn build:prod` (Angular production build into `dist/tripReady`) followed by `firebase deploy --only hosting`, which uploads that folder.

### Prerequisites

- Node 18 (the version this project is built and tested with)
- Yarn
- A Google account with access to the `ready4trip-5d3f6` Firebase project
- A Firebase CLI login:

```bash
npx firebase-tools@13 login
```

This opens a browser to authenticate and stores credentials locally, once per machine.

> **Why `firebase-tools@13` via `npx` instead of a project dependency?**
> Newer `firebase-tools` versions pull in a transitive dependency (`universal-analytics`) that requires Node ≥22. This project runs on Node 18, so `firebase-tools` is intentionally **not** in `package.json` — `npx` fetches version `13` (which supports Node 18) on demand instead.

The first `npx firebase-tools@13 ...` invocation on a machine downloads the CLI package tree, which can take a few minutes. Later runs are faster, since `npx` caches it.

### The corporate network blocks the Firebase login

On the work laptop/network, `firebase login` (with or without `--no-localhost`) fails immediately with:

```
Error: Failed to make request to https://auth.firebase.tools/attest
```

The corporate network is blocking `auth.firebase.tools` outright — this is not a `localhost` callback problem, a credentials issue, or something fixable with CLI flags.

This is why deploys used to require a second machine, and it is what continuous deployment solves: **GitHub Actions holds its own credential, so no interactive login is needed anywhere.** Manual deploys still have to run from an unblocked machine.

## Deploying the database rules

The Realtime Database security rules live in [`database.rules.json`](../database.rules.json) and deploy separately from hosting — CD does **not** deploy them:

```bash
yarn deploy:rules
```

**The repo is the source of truth — do not edit the rules in the Firebase Console.** A console edit is invisible to git, so the next `yarn deploy:rules` silently overwrites it, and in the meantime the committed file no longer describes what's actually enforced.

This matters because the rules decide which paths the app is allowed to read. When client code changes which paths it touches (as in PR #21), the rules are the other half of that change, and a reviewer can only check the two against each other if both are in the diff.

> **Caveat:** because hosting deploys have always excluded the rules, and `yarn deploy:rules` needs a login the corporate network blocks, the live rules may have drifted from the committed file. Worth diffing against the console before relying on either.

## How it's configured

- **`firebase.json`** — sets `dist/tripReady` (Angular's build output) as the public directory, and rewrites all routes to `/index.html` so Angular's client-side router handles navigation (deep links, page refresh) correctly. Also points `database.rules` at `database.rules.json`.
- **`.firebaserc`** — pins the default Firebase project to `ready4trip-5d3f6`, so `firebase deploy` doesn't prompt you to pick a project.
- **`database.rules.json`** — the Realtime Database security rules, committed verbatim from the console as the starting baseline.
- **`.github/workflows/node.js.yml`** — CI and CD: install, build, test, then deploy to a preview channel or to live.

## Rollback

Firebase Hosting keeps a history of previous releases. To roll back:

1. Go to the [Firebase Console](https://console.firebase.google.com/project/ready4trip-5d3f6/hosting/sites) → **Hosting**.
2. Find the previous release in the deployment history and select **Rollback**.

Rolling back does not change `main`, so the next merge redeploys the newer code. Revert the offending commit as well if the rollback needs to stick.
