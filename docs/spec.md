# TripReady — Product Specification

This document describes the expected behavior of the application. It is the source of truth for product decisions. When implementing a feature or fixing a bug, verify that behavior matches this spec.

---

## Authentication

- Users can register with email and password.
- Users can log in with email/password or Google.
- On every login or registration, the user's email is registered in a lookup table (`userEmails/`) so other users can find them by email when sharing lists.
- Unauthenticated users are redirected to `/login`.
- All data is scoped to the authenticated user — one user cannot access another user's private data.

---

## Groups

Groups are reusable templates of items that can be added to lists as sections.

- A user can create a group with a title and zero or more items.
- A user can add items to a group.
- A user can delete a group via drag-and-drop to the trash.
- Groups are private to the user who created them.
- When a group is added to a list, its items are copied into a new section on that list. Changes to the group after that do not affect the list section.

---

## Lists

Lists are travel checklists. Each list has one or more sections.

- A user can create a list with a title.
- Every list always has a default section called **Ungrouped** where items can be added directly (without a group).
- A user can add a group to a list, which creates a new section with the group's items.
- A user can add items to any section.
- A user can drag items between sections within the same list.
- A user can delete an item by dragging it to the trash.
- A user can delete a section (except Ungrouped) by dragging it to the trash.
- A user can delete a list by dragging it to the trash on the lists overview screen.
- Lists are private to the user who created them, unless shared.

---

## Interaction

Drag-and-drop is the primary way to move and delete things, and on a phone almost every
touchable pixel belongs to a draggable element. To keep those screens scrollable:

- On touch devices, a drag starts on **press-and-hold** (about a quarter of a second). A
  quick swipe scrolls the page and never picks anything up.
- On pointer devices, a drag starts immediately on press-and-move.
- This applies to every draggable: items, group cards, list sections, and list cards.
- Text inside a draggable is not selectable, so a long press starts a drag instead of
  selecting text. Text fields are exempt — they keep normal editing, including paste.

---

## Shared Lists

Sharing turns a private list into a collaborative document with a single source of truth.

### Sharing a list

- Only the list owner can share a list.
- The owner shares a list by entering another registered user's email address.
- The target user must have logged in at least once (so their email is in the lookup table).
- On share:
  - The list is published to a shared node (`sharedLists/{id}`) that both users read from.
  - The list is removed from the owner's private lists.
  - Both the owner and the recipient get a reference in their `sharedListIds`.
- The shared list appears in the **Shared** section of the lists overview for both the owner and the recipient.

### Collaborative editing

- Any edit made by either the owner or a recipient is immediately visible to all participants (real-time, same Firebase node).
- Both owner and recipient can add/remove items, add/remove sections.

### Deleting a shared list

- Only the owner can delete a shared list. Non-owners see a notification if they try.
- On delete:
  - The shared list node is removed from Firebase.
  - The list is restored to the owner's private lists (with its current content).
  - All participants lose access (their `sharedListIds` references are removed).

### Visibility rules

| User role | Where the list appears |
|---|---|
| Owner | Shared section (not private lists) |
| Recipient | Shared section |

---

## Navigation

- `/` — Main menu
- `/list` — Lists overview (private + shared)
- `/list/:id` — Single private list view
- `/list/shared/:id` — Single shared list view
- `/group` — Groups overview
- `/login` — Login / registration
