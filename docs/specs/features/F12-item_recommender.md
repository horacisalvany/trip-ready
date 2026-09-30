# Suggest items a list might be missing

**Depends on the recommender service being deployed and reachable at the configured URL** (see
`/recommender-service`). Without it there is nothing for this feature to call — the service is
built and deployed first, in its own two PRs, and evaluated for suggestion quality before any of
the following is built.

This doc itself ships across two further PRs — see *Two PRs, one doc* below. The second depends
on the first for the field it displays.

## Problem

A TripReady list is only as complete as the user's memory at the moment they wrote it. Nothing in
the app has an opinion about what belongs on a list, so a user packing for a cold-weather trip who
forgets gloves gets no signal from the app — the list looks finished, because "finished" only
means "nothing left to type".

Groups partly address this, but a group only contains what the user already thought to put in it,
so it repeats their blind spots rather than filling them.

## Expected behavior

From a list, a user can ask for suggestions of items they might have forgotten. The app shows a
short list of candidates, each assigned to a section and each with a one-line reason. The user
picks which ones they want; only those become real items on the list.

## Requirements

- A button (`auto_awesome`) on the list header, immediately before the `+` button, opens the
  suggestions dialog. It is available on private and shared lists alike, to anyone who can edit
  the list — the owner and every recipient.
- The **trip note** has its own affordance on the list header, independent of the suggestions
  dialog: a `notes` icon, with a short preview of the note once one is set. Tapping it opens a
  dialog pre-filled with the current note — the same tap-to-edit pattern already used for renaming
  a section or a group. Unlike a section or group title, a blank note is allowed and clears the
  stored note rather than being rejected. Capped at 200 characters.
- The suggestions dialog shows the current trip note read-only, with a pencil that opens the same
  edit dialog the header affordance uses, so there is exactly one place the note is edited.
- A "Suggest items" action sends the list's title, sections, items and trip note to the
  recommender service. While the request is in flight the dialog shows a spinner that always
  resolves, on success or failure — it never spins indefinitely, matching the rule already in
  place for the share dialog's spinner.
- Each suggestion returned is shown with: its name, the section it would go into, a one-line
  reason, and a checkbox. Every suggestion starts checked.
  - The section is matched against the list's own section names, trimmed and case-insensitively.
    A match means the item would be added to that existing section; no match means a new section,
    named after the suggestion's section, would be created.
- No suggestions is a valid, successful result — it means the list looks complete — and is shown
  as "Nothing obvious missing.", not as an error.
- A suggestion never repeats an item already on the list (case-insensitive comparison). At most 10
  suggestions are ever shown.
- Confirming adds every still-checked suggestion to the list, each to its matched or newly created
  section, then closes the dialog. Added items are unmarked, exactly like any other new item —
  checklist mode is unaffected.
- Unchecking a suggestion and confirming adds none of the unchecked ones; nothing is added for a
  suggestion the user never wanted.
- Requests are capped at 10 per signed-in user per day. Beyond the cap, the dialog shows "You've
  used today's suggestions. Try again tomorrow." and stays open — the cap is not an error, and the
  dialog does not lock the user out of anything else.
- Any other failure (network, timeout, a service error) shows "Could not get suggestions. Please
  try again." and stays open, so the request can be retried without reopening the dialog. This
  follows the share dialog's exception to the **Saving** section — a message behind a closed
  dialog is no use — rather than the closed-dialog-plus-snackbar pattern every other write uses.
- Saving the trip note and saving the accepted items both follow the normal **Saving** rules: a
  failed write is reported by name ("Could not save the new note.", or the item's own message) and
  nothing on screen becomes read-only or blocks a retry.
- Signed out — the request is never sent; the user is already on their way to `/login`, per the
  existing rule for writes attempted while signed out.

## Acceptance criteria

- [ ] The trip note affordance shows a preview once a note is set, and nothing (beyond the
      unset-state icon) when it is not.
- [ ] Editing the note from the header affordance and reopening the suggestions dialog shows the
      updated note there.
- [ ] Saving a blank note clears a previously saved one.
- [ ] Requesting suggestions on a list with no missing items shows "Nothing obvious missing."
- [ ] A returned suggestion whose section name matches an existing section (any case, any
      surrounding whitespace) is added to that section, not a new one.
- [ ] A returned suggestion whose section name matches nothing existing creates a new section with
      that name.
- [ ] Unchecking a suggestion before confirming does not add it.
- [ ] An added suggestion appears unmarked, including on a list with checklist mode on.
- [ ] A suggestion for an item already on the list (any case) is never shown.
- [ ] No more than 10 suggestions are ever shown at once.
- [ ] Making an 11th request in a day (for a low, test-configured cap) shows the daily-limit
      message and leaves the dialog open.
- [ ] A failed request shows its message and leaves the dialog open, retryable without
      reopening it.
- [ ] The spinner never spins indefinitely, on either a successful or a failed request.
- [ ] The same behavior holds on a shared list, for both the owner and a recipient.

## Technical notes

### Two PRs, one doc

This doc describes the whole feature, but it ships as the last two of four PRs — full table and
branch names in the design doc's *Delivery* section. In short: `feature/F12-trip-note` (the note
field, its header affordance and edit dialog — independently useful, no dependency on anything
below), then `feature/F12-suggestions-dialog` (the button, the dialog, the call to the
recommender service, the accept flow), which depends on the note PR for the field it reads and
displays.

Splitting it this way is why the note is not edited inside the suggestions dialog: doing so would
make the note PR ship a Firebase field with no way to set it, since its only edit surface would
belong to the PR that comes after it.

### Why the note gets its own header affordance rather than living only in the dialog

A permanent, always-shown field would cost screen space on a phone for something most visits to a
list never touch — hence a small icon that only expands into a preview once a note exists, rather
than a persistent text row. The dialog then reuses that one edit surface instead of duplicating it,
so there remains exactly one place the note is written.

### Why accepted items close the dialog rather than staying open for more

Every other add-flow dialog in the app (`dialog-add-group` on the list, `dialog-add-list`) closes
once its action completes. A user who wants more suggestions after accepting some can reopen the
dialog; the note they entered is stored, so it is not retyped.

### Section matching is a pure function

Comparing a suggestion's `section` against the list's section names (trim, lower-case, compare) is
a small pure function with no Angular dependencies, so it is unit tested directly against a table
of names rather than through the dialog.

### The dialog talks to `RecommenderService`, not `ListService`

A new Angular service wraps the HTTP call to the recommender: attaches the current user's ID token
(sourced with `take(1)`, per the `take(1)` rule in `CLAUDE.md` — this is a one-shot read of
`authService.user$` for a single request, not a live stream), sends the request body, and maps
each failure status to the message it produces. `ListService` is untouched by the call itself; it
is only used afterwards, by the existing write paths, to save the note and to add accepted items.

### Files

**`feature/F12-trip-note`**

- `src/app/services/list.service.ts` — the trip note field alongside `title` on the stored list,
  read and write (write via `take(1)`, per `CLAUDE.md`)
- `src/app/views/list/dialog-edit-note/` (new) — edit dialog, reusing the tap-to-edit pattern of
  `dialog-rename` but allowing a blank value
- `src/app/views/list/list.component.ts` / `.html` — the header affordance, its preview state
- `docs/specs/spec.md` — the trip note bullet under **Lists**, and the note-related bullets of
  **Item Recommender**

**`feature/F12-suggestions-dialog`**

- `src/app/services/recommender.service.ts` (new) + spec — the HTTP call and error mapping
- `src/app/views/list/dialog-suggest-items/` (new) — dialog component, template, styles, spec;
  opens `dialog-edit-note` for its pencil rather than re-implementing note editing
- `src/app/views/list/list.component.ts` / `.html` — the `auto_awesome` button, wiring accepted
  suggestions into the existing add-item and add-section paths
- `docs/specs/spec.md` — the remaining bullets of **Item Recommender**

### Tests

**`feature/F12-trip-note`**

- `ListService`: the note is read and written alongside the title; a write uses `take(1)`.
- The edit dialog: pre-fills the current note; a blank value is accepted and clears it (unlike
  `dialog-rename`); a value over 200 characters is rejected.
- `ListComponent`: the header affordance shows a preview once a note is set, and the unset state
  otherwise.

**`feature/F12-suggestions-dialog`**

- `RecommenderService`: request shape (title, sections, items, note), the ID token attached, and
  each response status (`200`, `429`, other error) mapped to its outcome.
- The section-matching function: exact match, case-differing, whitespace-differing, and no match.
- The dialog: shows the current note read-only; toggling a suggestion's checkbox before confirming
  adds only the checked ones; the empty-result message; each error message; the spinner
  terminating on both a successful and a failed request.
- `ListComponent`: the button opens the dialog; accepted suggestions land in the right section,
  unmarked, through the existing write paths (so their own failure-reporting is exercised
  unchanged).
- `yarn build` as well as `yarn test` on both PRs — Karma does not type-check templates, and the
  list template changes in each.
