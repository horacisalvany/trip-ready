# Items should be checkable

## Problem

A list is always a plain list of items; the user can't check/mark each item to know if the item
is ready. Say you are preparing the list of food to buy in a supermarket: you open the list
"buy supermarket" and have to remember whether you still need something or not (eggs may be on
the list but you already have them). Or you want to go through a travel list and mark what is
already in your luggage and what is missing.

## Expected behavior

The user can activate checklist view mode, where items can be picked/ready or not. Once it is
activated, they can go through the items of each section one by one and tap one so the item is
marked. Tapping it again unmarks it. The marks are saved, so the list opens next time showing
the same progress.

## Requirements

- A new button on the list header enables/disables checklist view mode.
  - Icon `playlist_add_check`, placed between the collapse-all button and the `+`.
  - Unlike collapse-all, the button shows **state** rather than the next action: plain while the
    mode is off, filled while it is on, with `aria-pressed` reflecting it. A mode you are in is
    not the same thing as an action you can take.
- While checklist mode is **on**, tapping an item toggles its mark: an unmarked item becomes
  marked, a marked item becomes unmarked.
- While checklist mode is **off**, tapping an item does nothing, and the marks stay visible.
  Marks are saved data, not a view preference — a packing list must not claim nothing is packed.
- A marked item is shown as a light green row with bold dark-green text. Nothing else is drawn:
  no checkbox and no tick, because on a phone a section card is only ~181&nbsp;px wide, item text
  is centre-aligned, and long item names are already truncated. A glyph or a checkbox column
  would make that worse.
- By default all the items of a list are unmarked. A new item is always unmarked, and a section
  created from a group starts fully unmarked — groups are templates and carry no marks.
- Marks are stored in Firebase, so reopening the list shows the same marked/unmarked state.
- On a shared list the marks are shared: every participant sees every other participant's marks
  in real time, like any other edit to a shared list.
- Checklist mode itself is **not** stored, in line with F03 and F07: reopening a list starts with
  the mode off (and the marks still visible).
- The user can clear every mark on the list at once.
  - A `remove_done` button appears on the header only while checklist mode is on **and** at least
    one item of the list is marked. There is nothing to reset otherwise, and the header keeps to
    four buttons at most the rest of the time (four for the owner of a list, three for a recipient
    of a shared list, who gets no share button).
  - It asks for confirmation first: the heading "Unmark all items?", the message
    "12 items are marked as ready." naming the count, and "Unmark all" on the confirming button.
    The count lives in the message rather than the heading so that only one of the two strings has
    a plural form, and so the heading does not wrap in a 300&nbsp;px dialog. This departs from the
    app's drag-to-trash-without-confirmation habit on purpose: a drag is hard to perform by
    accident, a single tap that wipes thirty marks with no undo is not.
  - Dismissing the dialog — backdrop or Escape — changes nothing, exactly as Cancel does.

## Acceptance criteria

- [x] User can enable checklist mode, and the button shows that it is on.
- [x] User can disable checklist mode.
- [x] User can mark an item.
- [x] User can unmark an item.
- [x] Marks survive a reload of the list.
- [x] With the mode off, marks are still visible and tapping an item changes nothing.
- [x] An item added after some marking starts unmarked.
- [x] A section added from a group starts unmarked.
- [x] An item keeps its mark when dragged to another section.
- [x] "Unmark all" clears every mark on the list after confirmation, and is absent while the
      mode is off or while nothing is marked.
- [x] A recipient of a shared list sees the marks made by the owner.

## Known gap

A mark is conveyed visually only. An item row carries no `role`, no `tabindex` and no
`aria-checked`, and cannot be marked without a pointer — so a screen-reader user hears the item's
name with no indication of whether it is ready, and a keyboard-only user cannot mark anything at
all. This is not a regression: item rows were never focusable, since the app's other item
operations are all drag-and-drop. Fixing it properly means giving rows a checkbox role and a
keyboard path, which is a change to how every item row works rather than to checklist mode, so it
is deferred to its own feature. The mode toggle and the unmark-all button are themselves
labelled and operable by keyboard.

## Technical notes

### Data model

Items are plain strings today (`items: ["Passport", "Charger"]`), so a mark has nowhere to live.
An item becomes an object:

```ts
export interface Item {
  name: string;
  checked: boolean;
}
```

`Section.items` becomes `Item[]`. `Group.items` stays `string[]`: a group is a template and has
no marks, so the groups view is untouched.

Nothing is migrated. `ListService.parseSections` (and the copy in `ShareService`) normalises
whatever is stored — a bare string becomes `{ name, checked: false }`, an object is taken as is,
and a Firebase node returned as a keyed object rather than an array is read through
`Object.values`. Writes always use the new shape, so data heals itself as it is touched.

### Writing a mark

A toggle writes **only that item**, with `set` on `sections/{sectionId}/items/{index}`:

- `update({ checked })` would corrupt legacy data: the node still holds a bare string, and
  `update` on it replaces the string with `{ checked: true }`, losing the name. `set` of the
  whole `{ name, checked }` object heals the legacy string instead.
- Rewriting the entire `items` array — what every existing edit does — would clobber concurrent
  edits on a shared list: writing back a stale array resurrects an item another participant just
  deleted. A mark is the one edit frequent enough for that to matter.

Both the private and the shared variant are needed, and the private one takes `take(1)` before
its `switchMap` per the write rule in CLAUDE.md.

"Unmark all" writes one whole-array update per section that has a marked item, which also
normalises any legacy strings in those sections.

### Interaction

- Items are draggable, so the click that ends a press-and-hold drag would toggle the item it was
  dropped on. The item tap reuses `TapGuard`, exactly as the section title does: record the press
  on `mousedown`, and toggle only if `isTap()` agrees.
- Drag-and-drop, drag-to-trash and reordering need no changes: `transferArrayItem`,
  `moveItemInArray` and `splice` move the whole object, so a mark travels with its item.
- `_shared-card.scss` sets `mat-list-item:hover { background-color: lightblue }`. The marked style
  has to win over that hover, or a marked row loses its green under the pointer.
- A collapsed section has no items in the DOM, so there is nothing to tap; the two toggles are
  independent.

### Files

- `src/app/views/list/item.ts` (new), `section.ts`
- `src/app/views/list/list.service.ts` — `parseSections`, item-level write methods, `Item[]`
  signatures, group-to-section mapping
- `src/app/views/list/list.component.ts` / `.html` / `.scss` — mode toggle, item tap, marked
  style, unmark-all
- `src/app/views/dialog-confirm/` (new) — small confirmation dialog, sibling of `dialog-rename`
- `src/app/services/share.service.ts` — its `parseSections` calls the same normaliser as
  `ListService.parseSections`, so a bare legacy string reads as unmarked here too
- `docs/specs/spec.md` — two bullets under **Lists**: checklist mode, and unmark-all

### Tests

- `ListService`: a section stored with string items parses as unmarked `Item`s; a section stored
  with objects keeps its marks; a toggle writes `{ name, checked }` at the item's index; the
  shared variants do the same on `sharedLists`.
- `ListComponent`: the button flips the mode and its `aria-pressed`; a tap marks and persists
  while the mode is on and does nothing while it is off; a drag-end click does not toggle; a new
  item and a group-derived section start unmarked; unmark-all is hidden unless the mode is on and
  something is marked, and clears every section after confirmation.
