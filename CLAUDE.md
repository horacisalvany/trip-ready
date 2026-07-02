# TripReady

Web application to help users prepare their trips by organizing travel checklists.

## Tech Stack

- **Framework**: Angular 16
- **UI Library**: Angular Material 16
- **Backend**: Firebase Realtime Database
- **Package Manager**: Yarn
- **Testing**: Karma + Jasmine

## Project Structure

```
src/app/
├── app.module.ts          # Main module with Firebase setup
├── app-routing.module.ts  # Application routes
├── material.module.ts     # Angular Material imports
└── views/
    ├── main-menu/         # Main navigation menu
    ├── lists/             # Lists overview (travel lists)
    ├── list/              # Single list view with items
    └── group/             # Item aggregation within lists
    
```

## Product Specification

See [`docs/spec.md`](docs/spec.md) for the expected behavior of the application. Before implementing a feature or fixing a bug, read the relevant section. If the spec doesn't cover the case, ask the user to clarify and update the spec before writing code.

## New code
All new code added must be tested somehow in a unit test.

## Commands

```bash
yarn install      # Install dependencies
yarn start        # Start dev server (ng serve)
yarn build        # Build for development
yarn build:prod   # Build for production
yarn test         # Run tests
yarn test:prod    # Run tests headless with coverage
```

## Key Patterns

- Components follow Angular standalone pattern with `.component.ts`, `.component.html`, `.component.scss`, `.component.spec.ts`
- Services are provided at component level or in `app.module.ts`
- Firebase configuration is in `src/environments/environment.ts`
- Dialog components are nested within their parent view folders (e.g., `dialog-add-list/`)

## Critical Pattern: `take(1)` on write operations

Any service method that **writes** to Firebase and sources the user path from `authService.user$` (via `userPath()`) **must** include `take(1)` before the `switchMap`:

```ts
// CORRECT
someWriteMethod(): Observable<void> {
  return this.userPath().pipe(
    take(1),           // <-- required on all writes
    switchMap((path) => { ... })
  );
}

// WRONG — missing take(1)
someWriteMethod(): Observable<void> {
  return this.userPath().pipe(
    switchMap((path) => { ... })
  );
}
```

**Why this matters:** `authService.user$` is a long-lived observable that emits every time the auth state changes (login, logout, user switch). Without `take(1)`, the subscription stays open after the write completes. When a different user logs in, `user$` emits their UID, `switchMap` re-triggers the write under the new user's path — silently duplicating or corrupting data across user accounts.

**Rule of thumb:**
- Write operations (`add`, `update`, `delete`) → always use `take(1)`
- Read/stream operations (`get`, `list`) → do NOT use `take(1)`, they need to stay alive

This was discovered as a real bug: lists and groups created by one user were being cloned into other users' accounts on login.

## Development Notes

- Uses SCSS for styling with a custom theme in `src/theme.scss`
- Drag and drop functionality via `@angular/cdk/drag-drop`
- Mock data available in `.mock.ts` files for testing/development

## Firebase Authentication - Implementation Complete

### New Files Created

- `src/app/services/auth.service.ts` - Auth logic (login, register, Google sign-in, logout)
- `src/app/guards/auth.guard.ts` - Route protection
- `src/app/views/login/login.component.ts` - Login UI component
- `src/app/views/login/login.component.html` - Login template
- `src/app/views/login/login.component.scss` - Login styles
- `src/app/views/login/login.component.spec.ts` - Tests

### Modified Files

- `src/app/app.module.ts` - Added `provideAuth()` and `BrowserAnimationsModule`
- `src/app/material.module.ts` - Added form field modules
- `src/app/app-routing.module.ts` - Added AuthGuard to all routes, login route
- `src/app/views/main-menu/main-menu.component.ts` - Added logout
- `src/app/views/main-menu/main-menu.component.html` - Added user header with logout
- `src/app/views/main-menu/main-menu.component.scss` - Added user header styles

### To Test

```bash
npm install   # or yarn install
npm start     # or yarn start
```

Then navigate to `http://localhost:4200` - you should be redirected to `/login`.
