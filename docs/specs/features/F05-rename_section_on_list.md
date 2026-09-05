# Sections should be renameable

## Problem

A section takes its title either from the group it was created from or from the
title typed in the add-sections dialog, and that title can never be changed. A
typo, or a section that outgrows its name, can only be fixed by deleting the
section and adding it again — which throws away every item in it.

## Expected behavior

Tapping a section's title on the list view opens a small dialog with the current
title in a text field. Confirming renames the section; cancelling leaves it
untouched. A faint pencil glyph after the title marks it as editable.

Every section behaves the same way, `Ungrouped` included: F04 made it deletable,
so it is an ordinary section now, and singling it out here would mean a user could
destroy it but not correct its name.

## Why the title and not an icon button

On a 390px phone a section card is ~181px wide (Bootstrap `col-6`) and the title
pill has ~157px of that. An icon button in its own column would take ~24px of it
— 15% of the card — pushing a long title such as "Electronics and chargers" from
three lines to four and leaving the two columns misaligned. A ~20px icon is also
a poor touch target.

Putting the pencil *inside* the `h2`, in the text flow, costs no layout width: it
wraps after the last word. The tap target is then the whole pill (~157 × 29px)
rather than the glyph, and the glyph is a hint, not a button.

Editing happens in a dialog rather than inline because a 40-character title in a
~155px inline input can only ever show about 16 characters at a time. A dialog
gives the field the full screen width, and its Cancel button makes a stray tap
harmless. It is also the idiom already used for adding lists, sections and
shares.

## Requirements

- Every section title shows a faint pencil glyph inside the title pill, after the
  text, and is tappable.
- Tapping the title opens a "Rename section" dialog with the current title
  pre-filled and the field focused.
- Confirming with a changed, valid title writes the new title to Firebase.
- Cancelling writes nothing.
- A title that is blank or whitespace-only is rejected: the dialog shows an error
  and stays open.
- A blank title is the only rejection. `Ungrouped` is accepted like any other
  name, matching the add-sections dialog, which has always allowed it.
- A title equal to the current one (after trimming) closes the dialog without
  writing.
- Titles are limited to 40 characters, like the add-section field.
- Duplicate titles are allowed, matching F01.
- Renaming works the same on private and shared lists.
- The section keeps its id and its items. No other section is touched.
- Tapping the title must not interfere with dragging the section to the trash,
  or with scrolling the list on a phone.

## Acceptance criteria

- [x] User can rename any section, `Ungrouped` included.
- [x] The dialog opens pre-filled with the current title.
- [x] Cancelling changes nothing.
- [x] A blank title is rejected and the dialog stays open.
- [x] The renamed section keeps its items.
- [x] Other sections remain untouched.
- [x] Renaming works on a shared list and is visible to every participant.
- [x] Dragging a section to the trash does not open the rename dialog.
- [x] Swiping to scroll the list does not open the rename dialog.

## Technical notes

- The dialog takes `{ title }` and closes with the trimmed new title, or
  `undefined` on cancel. Validation lives in the dialog and follows the share
  dialog's idiom: set `errorMessage` and stay open. (Originally
  `DialogRenameSectionComponent` in `dialog-rename-section/`; F06 generalised it
  into the shared `DialogRenameComponent` in `views/dialog-rename/`, which takes
  `{ entity, title }`.)
- `ListService.renameSection(listId, sectionId, title)` updates
  `users/{uid}/lists/{listId}/sections/{sectionId}` with `take(1)`, per the write
  rule in `CLAUDE.md`. `renameSharedSection(...)` does the same under
  `sharedLists/{listId}/sections/{sectionId}`, which needs no `take(1)` because
  it never reads `user$`.
- Both use `update({ title })` rather than `set`, so `items` and `sourceGroupId`
  survive the rename.
- The view refreshes on its own: the list renders a live `valueChanges()` stream,
  so no local mutation is needed and other sections cannot be disturbed.
- The title stays an `h2` with `role="button"`, `tabindex="0"` and an
  `aria-label`, so it is reachable by keyboard, rather than becoming a real
  `<button>` — a focusable button nested inside the `cdkDragHandle` competes with
  the press-and-hold gesture.
- The title text moves into a `.section-title-text` span so that the pencil's
  ligature text does not leak into assertions on the title.

### Why taps and drags do not collide

`DRAG_START_DELAY.touch` is 250ms, and CDK abandons a drag when the pointer moves
past its 5px threshold before the delay elapses, so a swipe scrolls and the
browser cancels the click. CDK deliberately never calls `preventDefault()` on
`touchstart` — only on `mousedown` — precisely so that taps still produce click
events on touch devices. Once a touch drag does start, CDK prevents the default
on the move, which suppresses the click at the end of the gesture.

That leaves one desktop-only gap: `preventDefault()` on `mousemove` does not
suppress the following `click`, so a short mouse drag that starts and ends on the
header would open the dialog. The component records the pointer position on
`mousedown` on the title and ignores a click that lands more than
`TAP_MOVE_TOLERANCE_PX` (5px, the same threshold CDK uses) from it. The check is
stateless on purpose — a flag set on `cdkDragStarted` and cleared on
`cdkDragEnded` would stay stuck if the section is removed from the DOM by the
drop before `cdkDragEnded` fires, silently killing renames afterwards. (F06 moved
this into `TapGuard` in `views/tap-guard.ts`, shared with the groups view.)

Collapsing sections is a toolbar button (F03), not a per-section gesture, so
there is no other tap handler on the header to conflict with.
