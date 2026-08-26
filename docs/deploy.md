# Deployment

TripReady is deployed to **Firebase Hosting**, using the same Firebase project as the app's Realtime Database (`ready4trip-5d3f6`). Hosting is configured in [`firebase.json`](../firebase.json) and [`.firebaserc`](../.firebaserc).

## Prerequisites

- Node 18 (the version this project is built/tested with)
- Yarn
- A Google account with access to the `ready4trip-5d3f6` Firebase project

## One-time setup

Log in to Firebase from the CLI:

```bash
npx firebase-tools@13 login
```

This opens a browser to authenticate and stores credentials locally. You only need to do this once per machine.

> **Why `firebase-tools@13` via `npx` instead of a project dependency?**
> Newer `firebase-tools` versions pull in a transitive dependency (`universal-analytics`) that requires Node ≥22. This project runs on Node 18, so `firebase-tools` is intentionally **not** in `package.json` — `npx` fetches version `13` (which supports Node 18) on demand instead.

### Known issue: login fails on the corporate network

On the work laptop/network, `firebase login` (with or without `--no-localhost`) fails immediately with:

```
Error: Failed to make request to https://auth.firebase.tools/attest
```

This means the corporate network is blocking `auth.firebase.tools` outright — it's not a `localhost` callback problem, credentials issue, or something fixable via CLI flags.

**To do (pending):**

1. From a **personal laptop/home network** (not blocked), run:
   ```bash
   npx firebase-tools@13 login
   ```
2. Then either:
   - Run `yarn deploy` directly from that machine, **or**
   - Generate a long-lived CI token there with:
     ```bash
     npx firebase-tools@13 login:ci
     ```
     and use it to deploy from the work laptop without an interactive login:
     ```bash
     yarn build:prod && npx firebase-tools@13 deploy --only hosting --token <token>
     ```

## Deploying

```bash
yarn deploy
```

This runs `yarn build:prod` (Angular production build into `dist/tripReady`) followed by `firebase deploy --only hosting`, which uploads that folder to Firebase Hosting.

The first `npx firebase-tools@13 ...` invocation on a machine downloads the CLI package tree, which can take a few minutes. Subsequent deploys are faster since it's cached by `npx`.

## Deploying the database rules

The Realtime Database security rules live in [`database.rules.json`](../database.rules.json) and deploy separately from hosting:

```bash
yarn deploy:rules
```

**The repo is the source of truth — do not edit the rules in the Firebase Console.** A console edit is invisible to git, so the next `yarn deploy:rules` silently overwrites it, and in the meantime the committed file no longer describes what's actually enforced.

This matters because the rules decide which paths the app is allowed to read. When client code changes which paths it touches (as in PR #21), the rules are the other half of that change, and a reviewer can only check the two against each other if both are in the diff.

> **Note:** `yarn deploy:rules` needs a working `firebase login`, which is currently blocked on the corporate network (see above). Until that's resolved, the committed file is the reviewable record of the rules but has to be applied from an unblocked machine or with a `--token`.

## How it's configured

- **`firebase.json`** — sets `dist/tripReady` (Angular's build output) as the public directory, and rewrites all routes to `/index.html` so Angular's client-side router handles navigation (deep links, page refresh) correctly. Also points `database.rules` at `database.rules.json`.
- **`.firebaserc`** — pins the default Firebase project to `ready4trip-5d3f6`, so `firebase deploy` doesn't prompt you to pick a project.
- **`database.rules.json`** — the Realtime Database security rules, committed verbatim from the console as the starting baseline.

## Verifying a deploy

After `yarn deploy` finishes, the CLI prints the Hosting URL (typically `https://ready4trip-5d3f6.web.app` or `https://ready4trip-5d3f6.firebaseapp.com`). Open it and confirm the app loads and you can log in.

## Rollback

Firebase Hosting keeps a history of previous releases. To roll back:

1. Go to the [Firebase Console](https://console.firebase.google.com/) → your project → **Hosting**.
2. Find the previous release in the deployment history and select **Rollback**.
