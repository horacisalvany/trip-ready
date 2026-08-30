# Sections should be addeable

## Problem

Currently, sections can only by created through selecting a prexisting group
## Expected behavior

Users should be able to create a new section on the view's list

## Requirements

- When user clicks on + icon on view's list, show a new field to create a new section.
- The field requires at least 1 character.
- When user clicks on OK -> Add the section in Firebase.
- Update the UI immediately after clicks on OK creating a new section on view's list.
- Do not affect other sections.
- Do not validate if the name already exist

## Acceptance criteria

- [x] User can create a section.
- [x] System validates that the section has at least 1 character as a title.
- [x] Other sections remain untouched.

## Technical notes

The `+` button on the list view already opened the "add groups" dialog, so the new
field lives in that same dialog, above the group picker. The dialog now returns
`{ groups, newSectionTitle }` instead of a bare `Group[]`.

- `ListService.addEmptySectionToList(listId, title)` pushes `{ title, items: [] }`
  under `users/{uid}/lists/{listId}/sections`.
- `ListService.addEmptySharedSectionToList(listId, title)` does the same under
  `sharedLists/{listId}/sections`, so the feature works on shared lists too.
- The UI refreshes on its own: the list view renders a live `valueChanges()`
  stream, so the pushed section appears as soon as Firebase acknowledges it. No
  local mutation, which is why the other sections cannot be disturbed.
- A blank or whitespace-only title creates nothing, so the same dialog can still
  be used for groups only.