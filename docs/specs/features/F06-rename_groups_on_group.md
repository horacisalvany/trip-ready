# Group should be renameable

## Problem

If user wants to change the name of a group he can't.

## Expected behavior

Tapping a group 's title on the groups view opens a small dialog with the current
title in a text field. Confirming renames the group; cancelling leaves it
untouched. A faint pencil glyph after the title marks it as editable.

Similarly of what we did for sections on F05.


## Requirements

- Every group title shows a faint pencil glyph inside the title pill, after the
  text, and is tappable.
- Tapping the title opens a "Rename group" dialog with the current title
  pre-filled and the field focused.
- Confirming with a changed, valid title writes the new title to Firebase.
- Cancelling writes nothing.
- A title that is blank or whitespace-only is rejected: the dialog shows an error
  and stays open.
- A title equal to the current one (after trimming) closes the dialog without
  writing.
- Titles are limited to 40 characters
- Duplicate titles are allowed, matching F01.
- The group keeps its id and its items. No other group is touched.
- Tapping the title must not interfere with dragging the group to the trash,
  or with scrolling the list on a phone.

## Acceptance criteria

- [x] User can rename any group
- [x] The dialog opens pre-filled with the current title.
- [x] Cancelling changes nothing.
- [x] A blank title is rejected and the dialog stays open.
- [x] The renamed group keeps its items.
- [x] Other group remain untouched.
- [x] Sections already created from the group on a list are left unchanged.
- [x] Dragging a group to the trash does not open the rename dialog.
- [x] Swiping to scroll the list does not open the rename dialog.

## Technical notes

Reused, as asked. F05's `DialogRenameSectionComponent` became
`DialogRenameComponent` (`views/dialog-rename/`), shared by both views: it takes
`{ entity, title }` and closes with the trimmed new title, or `undefined` on
cancel. `entity` is the only thing that differs on screen — the heading
("Rename section" / "Rename group"), the field's `aria-label` and the blank-title
error. The field, the 40-character cap, the trim, the unchanged-title no-op and
the styling are one implementation for both.

- `GroupService.renameGroup(id, title)` updates `users/{uid}/groups/{id}` with
  `take(1)`, per the write rule in `CLAUDE.md`. It uses `update({ title })` so
  `items` survives the rename, and the Firebase key — the group id — is untouched.
- Groups are private to their owner (see `spec.md`), so unlike sections there is
  no shared counterpart to write.
- Renaming a group does not touch any list: a section created from a group gets a
  copy of its items and title, and the two are independent from then on.
- The view refreshes on its own: the groups view renders a live
  `snapshotChanges()` stream, so nothing is mutated locally and no other group
  can be disturbed.
- The title markup mirrors the list sections: an `h2` with `role="button"`,
  `tabindex="0"` and an `aria-label`, holding a `.group-title-text` span and the
  pencil `mat-icon`, rather than a real `<button>` — a focusable button nested
  inside the `cdkDragHandle` competes with the press-and-hold gesture. The
  reasoning for putting the pencil inside the title instead of giving it its own
  icon button is in F05 and applies unchanged here.
- The glyph's styling is a `rename-hint($header)` SCSS mixin
  (`views/_rename-hint.scss`) included by both views.

### Why taps and drags do not collide

Same problem and same answer as F05, now extracted into `TapGuard`
(`views/tap-guard.ts`) and used by both views. It records the pointer position on
`mousedown` on the title and rejects a click that lands more than
`TAP_MOVE_TOLERANCE_PX` (5px, the threshold CDK uses) away, which is the only
gap CDK leaves: `preventDefault()` on `mousemove` does not suppress the following
`click`, so a short mouse drag of a header would otherwise open the dialog. The
press is consumed by the click it vouched for, and a call with no event —
keyboard activation — is always a tap.

The check is stateless on purpose: a flag set on `cdkDragStarted` and cleared on
`cdkDragEnded` would stay stuck if the card is removed from the DOM by the drop
before `cdkDragEnded` fires, silently killing renames afterwards. Dragging a group
to the trash is exactly that case.

On touch there is nothing to do: `DRAG_START_DELAY.touch` is 250ms and CDK
abandons a drag when the pointer moves past 5px before the delay elapses, so a
swipe scrolls and the browser cancels the click; once a touch drag does start, CDK
prevents the default on the move, which suppresses the click at the end.