# The user should be told when a change was not saved

## Problem

A change that fails to save looks exactly like a change that saved. Every write in the app is
subscribed to without an error handler, so a rejected Firebase promise — no network, a security
rule refusing the write, a session that expired — produces nothing on screen: no message, no
retry, no sign that anything went wrong.

It is worse than a lost keystroke, because the screen actively lies. Most handlers change the
in-memory model before the write is attempted and then leave it alone: `toggleItemMark` sets
`checked`, `dropTrash` splices the item out, `dropItem` moves it to the other section. So a failed
write leaves the item looking marked, or deleted, or moved. Nothing corrects it either: the list is
a live Firebase stream, and a write that failed changed no node, so no new emission ever arrives to
overwrite the wrong state. The user finds out on the next visit, when the item is unmarked again or
back where it was.

Every write is affected. Twelve subscriptions across the three views pass no error handler at all
(`list.component.ts` ×6, `lists.component.ts` ×3, `group.component.ts` ×3 including the reorder
funnel). One of the twelve, `GroupComponent.updateFirebase`, does handle the error — by writing it
to `console.error`, which no user reads, through the deprecated positional `subscribe(next, error)`
form.

This is not an F08 problem; it is as old as the writes. F08 only added a fifth and sixth way to
reach it.

## Expected behavior

When a change cannot be saved, the app says so, and says which change, so the user knows what to
do again.

## Requirements

- Every write reports a failure to the user. That is: adding, renaming and deleting a list, a
  section, a group or an item; reordering items and moving them between sections; marking and
  unmarking an item; unmarking a whole list.
- The report is a `MatSnackBar` message, which the app already uses for the outcome of sharing a
  list and for refusing a delete on the lists view. It names the action that failed rather than the
  error, in the form `Could not save the new item. Please try again.` — the same voice as the
  existing `Could not share the list. Please try again.`
- Failures are reported once each. If unmark-all writes six sections and all six fail, the user
  gets one message, not six.
- The message is dismissible and does not block; nothing about the list becomes read-only after a
  failure. A retry is the user repeating the action.
- A write attempted while signed out stays silent, as it is today: `userPath()` yields no path and
  the write completes having done nothing. The auth guard is already routing the user to the login
  screen at that point, and a snackbar about an unsaved item on top of a login form would be noise.
- Nothing is logged to the console in place of telling the user.

## Acceptance criteria

- [ ] A failing write on each of the three views produces a snackbar naming the action.
- [ ] The message wording identifies the action, not the exception.
- [ ] A batch of writes that all fail produces one message.
- [ ] A successful write produces no message — this is failure feedback, not a save indicator.
- [ ] A write attempted with no signed-in user produces no message and no error.
- [ ] No write handler calls `console.log` or `console.error`.

## Technical notes

### One place, not twelve

The call sites differ only in the noun in the message, so the handling belongs in one helper rather
than copied twelve times — otherwise the thirteenth write ships without it, which is how the
current state came about.

Shape it as a single method taking the observable and the label, so a call site reads:

```ts
this.writeFeedback.report(obs, 'the new item');
```

and it subscribes, swallows the error and opens the snackbar. Returning nothing is deliberate: no
caller currently inspects a write result, and a helper that hands the error back invites each site
to handle it differently again.

Where a component fires several writes for one user action — `unmarkAll`, and the two writes
`dropItem` makes when an item crosses sections — the calls have to be combined before being
reported, or the "one message per action" requirement fails. `forkJoin` over the writes gives one
observable to hand the helper.

### Not a global error handler

Overriding Angular's `ErrorHandler` would catch these — an unhandled RxJS error surfaces there —
and is the wrong tool: it has no idea which action failed, so it can only produce a generic
message, and it would also catch errors from reads and from unrelated code.

### What this does not fix

The screen is still wrong after a failure. The handlers mutate the model in place before writing,
and this feature does not undo those mutations, so a failed mark still looks marked until the list
is reopened.

Rolling back is a larger change than it looks: the mutation happens in the handler before
`updateItems` is reached, so the snapshot has to be taken there, per handler, and for a move
between sections it spans two arrays. It also needs a decision about what the user sees when the
screen reverts under them a second after they acted. Telling the user is the part that turns a
silent loss into a recoverable one, and it stands on its own; the revert should be specced with
that decision made rather than bolted on here.

### Files

- `src/app/services/write-feedback.service.ts` (new) — the helper, injecting `MatSnackBar`
- `src/app/views/list/list.component.ts` — six write sites, and `forkJoin` in `unmarkAll` and
  `dropItem`
- `src/app/views/lists/lists.component.ts` — three write sites
- `src/app/views/group/group.component.ts` — three write sites; `updateFirebase` loses its console
  logging and, with it, its reason to exist as a separate method
- `src/app/views/list/dialog-share-list/dialog-share-list.component.ts` — left alone. It already
  reports its failures, and it reports them inline in the dialog rather than in a snackbar because
  the dialog stays open and has a message row; converting it would be a regression.

### Tests

A rejected write is easy to stage: the service mocks already return `of(undefined)`, so returning
`throwError(() => new Error('nope'))` instead is the whole setup.

- The helper: a failing observable opens the snackbar with the composed message; a succeeding one
  opens nothing.
- Each view: one spec per write that a failure opens a snackbar. These are cheap and they are the
  regression net — the reason the current code is silent is that nothing asserted otherwise.
- `ListComponent`: unmark-all with several failing sections opens the snackbar once; a failed
  cross-section drag opens it once.
- A write with no signed-in user opens nothing.
