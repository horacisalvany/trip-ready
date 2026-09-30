# recommender-service

Suggests items a TripReady list might be missing. See
`docs/specs/features/F12-item_recommender.md` for the user-facing behaviour, and
`docs/superpowers/specs/2026-09-18-item-recommender-design.md` for the full design.

This PR (slice 1 of F12) is the service itself: one endpoint, authenticated, callable with
`curl`. It is not deployed and the Angular app does not call it yet — see the design doc's
`Delivery` table for what the later PRs add.

## Running locally

Requires Java 17+ and Maven.

1. Get a free Gemini API key from <https://aistudio.google.com/app/apikey>.
2. `cd recommender-service`
3. `GEMINI_API_KEY=your-key mvn spring-boot:run -Dspring-boot.run.profiles=local`
4. The service listens on `http://localhost:8080`.

## Running the tests

```bash
cd recommender-service
mvn test
```

No test calls a real LLM or a real network endpoint — `ChatClient` is mocked throughout, and the
JWT tests exercise the audience-validation logic directly rather than Google's real token
endpoint.

## Manual smoke test

The endpoint needs a real Firebase ID token. Get one straight from Firebase's own REST API,
using this project's Web API key (public, already in `src/environments/environment.ts`) and an
account that has logged into TripReady at least once:

```bash
ID_TOKEN=$(curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAO5g0mlYLZ2lU7Rxgxen9sbhKudZPiL4Y" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD","returnSecureToken":true}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["idToken"])')
```

Then call the endpoint with a real-looking list:

```bash
curl -s -X POST http://localhost:8080/api/recommendations \
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

Try a few different lists and trip notes — with and without a note, with a list that already
looks complete, with an unusual destination — and read the suggestions. This is the evaluation
gate for the whole feature: if they're not worth having, say so before PR 2 (deploy) or anything
Angular-side gets built.
