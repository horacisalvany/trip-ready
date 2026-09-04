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
- Every new list starts with a default section called **Ungrouped** where items can be added directly (without a group). Like any other section, it can be deleted; once deleted it is not recreated automatically.
- A user can create a new, empty section by typing a title. The title must be at least one character (leading and trailing whitespace is ignored); a blank title simply creates nothing. Duplicate titles are allowed.
- A user can add a group to a list, which creates a new section with the group's items.
- Creating a section from a title and adding sections from groups happen in the same dialog (the `+` button on the list), and can be done together in one go. Existing sections are never modified.
- A user can rename any section, including Ungrouped, by tapping its title, which opens a dialog with the current title pre-filled. A faint pencil glyph inside the title marks it as editable. The dialog rejects a blank title with an error and stays open. A title equal to the current one closes without writing. Titles are capped at 40 characters and duplicates are allowed, as they are when a section is created. The section keeps its id and its items.
- A user can add items to any section.
- A user can collapse or expand every section of a list at once with a single button on the list header, placed between the share and the `+` buttons. The button always shows the action it performs: `unfold_less` (collapse) while the sections are expanded, `unfold_more` (expand) while they are collapsed. Collapsed sections keep their title visible and hide their items and their "new item" field. The state is a view preference only — it is not stored, so reopening the list shows every section expanded.
- A user can drag items between sections within the same list.
- A user can delete an item by dragging it to the trash.
- A user can delete a section, including Ungrouped, by dragging it to the trash.
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

- Only the list owner can share a list. Recipients cannot add further recipients, and the share button is hidden from them.
- The owner shares a list by entering another registered user's email address.
- The target user must have logged in at least once (so their email is in the lookup table).
- A list can be shared with any number of recipients, added one at a time.
- **First share** — the list becomes collaborative:
  - The list is published to a shared node (`sharedLists/{id}`) that all participants read from.
  - The list is removed from the owner's private lists.
  - Both the owner and the recipient get a reference in their `sharedListIds`.
- **Subsequent shares** — the list is already collaborative:
  - The new recipient is added to `sharedWith`; existing recipients are preserved.
  - The new recipient gets a reference in their `sharedListIds`.
  - The list content is not republished, and ownership is unchanged.
- Sharing with someone who is already a recipient succeeds and changes nothing.
- The shared list appears in the **Shared** section of the lists overview for the owner and every recipient.
- The owner sees an info icon next to the list title naming who the list is shared with.

### When sharing fails

- Unregistered email: the dialog shows "User not found. They must have logged in at least once." and stays open.
- Non-owner attempting to share an already-shared list: the dialog shows "Only the list owner can share this list." and nothing is written.
- Lookup or write failure: the dialog shows an error, stops its spinner, and stays open so the owner can retry. Nothing is written.
- The dialog never closes, and never spins indefinitely, on failure.

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

---

## Install / home-screen shortcut

- Adding the site to a phone's home screen shows the TripReady bag logo (the
  same glyph as the toolbar) on the purple-to-indigo toolbar gradient — never a
  browser-generated letter tile.
- The shortcut opens the app standalone (no browser chrome), titled `TripReady`.
- Icons live in `src/assets/img/` and are declared in `src/manifest.webmanifest`
  (Android/Chrome) and via `apple-touch-icon` in `src/index.html` (iOS).
