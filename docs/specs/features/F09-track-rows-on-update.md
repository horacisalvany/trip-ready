# Rows should not be rebuilt on every update

## Problem

Nothing in the app tells Angular how to recognise a row it has already drawn. No `*ngFor` uses
`trackBy`, so Angular falls back to tracking by object identity — and every one of these lists is
rebuilt from scratch on every Firebase emission: `ListService.parseSections` and `parseItems`
create fresh objects each time the node changes, and the component then assigns a whole new `list`.
Angular therefore sees an entirely new set of rows and destroys and recreates every one of them,
even when a single character changed in a single item.

The most visible consequence is on the list view. Each section card contains its own
"New item..." input, and that input is plain DOM holding whatever the user has typed. Recreating
the card throws the text away. So:

1. Start typing an item name into one section's input.
2. Cause any write to the list before pressing Enter — mark an item in checklist mode, add an item
   to another section, or have a co-editor edit the shared list.
3. Firebase re-emits, every section card is rebuilt, and the half-typed name is gone.

The rest is cost rather than breakage: every item row, every drag handle and every card is torn
down and rebuilt on each emission, which is wasted work and drops any transient state the browser
was holding on those elements.

F08 made the item case worse. Items used to be plain strings, and identity tracking of a string
compares by value, so re-emitting `["Passport", "Charger"]` reused both rows. Items are now
`{ name, checked }` objects, freshly built by `parseItems` on every read, so no item row is ever
reused any more.

## Expected behavior

Editing one thing redraws that one thing. Text already typed into an input survives an update
somewhere else on the screen, whether the update came from this user or from a co-editor of a
shared list.

## Requirements

- Sections are tracked by `section.id`, the Firebase key, which is stable for the life of the
  section and unaffected by a rename. A section card is then reused across emissions, and its
  "New item..." input keeps what the user typed.
- Items are tracked by their position in the section. An item has no stored identity, and position
  is the only key available that is stable across emissions — see the technical notes for why the
  name is not usable and why an id is not being added.
- Lists on the lists view (both the private and the shared group) and group cards on the groups
  view are tracked by their Firebase key too. Same one-line fix, same rebuilt-on-every-emission
  cause; they have no input to lose, so this is about not doing pointless work rather than about a
  bug.
- The items of a group (groups view) are left alone: they are still plain strings, so identity
  tracking already compares them by value and reuses the rows.
- No behaviour changes. Marking, renaming, adding, deleting, reordering and dragging between
  sections all keep working exactly as they do now, including a drag that lands while a co-editor's
  write is in flight.

## Acceptance criteria

- [ ] Text typed into a section's "New item..." input survives marking an item in another section.
- [ ] Text typed into a section's "New item..." input survives adding an item to another section.
- [ ] On a shared list, text typed into an input survives an edit made by another participant.
- [ ] Marking an item still marks it, and the mark still survives a reload.
- [ ] Reordering items inside a section, and dragging an item to another section, still end with
      the items in the order the user dropped them.
- [ ] Dragging a section or an item to the trash still deletes it.
- [ ] Renaming a section still shows the new title.

## Technical notes

### Why not track items by name

Two items in the same section may share a name. `ListComponent.onAddItemToSection` only trims the
input and rejects an empty string, so "Socks" twice is allowed and is a reasonable thing for a
packing list to contain. `parseItems` also rewrites any stored item with no usable name to
`Untitled`, so a section repaired from bad data can hold several rows keyed alike.

Angular's differ tolerates duplicate keys rather than throwing, which is worse than an error here:
it pairs each row with an arbitrary one of the duplicates, so a mark can appear to jump between two
identically named items when the list re-emits.

### Why not give an item a stored id

An id would have to be persisted to be useful. A value minted on read is different on every
emission, which is exactly the situation being fixed.

Persisting one means changing the stored shape again, and its only payoff would be the tracking
that a position already provides. `Item` gained a field in F08 and nothing was migrated, so a
second such change should buy more than this.

### The same root cause, and what it does not fix

`ListService.updateItemAt` writes a mark to `sections/{sectionId}/items/{index}`, addressing the
item by its position in `parseItems`' output. That is the same missing identity seen from the write
side, and it carries a real race, documented at the method: if a co-editor deletes or reorders
items between this client's read and this write, the index lands on the wrong item, or past the end
of a shorter array and leaves a sparse node.

Tracking by index does not fix that, and is not meant to. Fixing it means addressing an item by
something other than its position, which means storing items as a keyed object
(`items: { <key>: { name, checked } }`) so a write can target `items/{key}`. That in turn needs the
order of the items stored explicitly, because a keyed object has no array order to drag things
around in, and it needs a read path for the arrays already out there. That is a data-model feature
of its own, and the race it removes is rare and self-healing — any add, delete, reorder or
unmark-all rewrites the whole array and repairs it.

### Files

- `src/app/views/list/list.component.html` — `trackBy` on the sections and the items `*ngFor`
- `src/app/views/list/list.component.ts` — the two track functions
- `src/app/views/lists/lists.component.html` / `.ts` — both `*ngFor`s and their track function
- `src/app/views/group/group.component.html` / `.ts` — the groups `*ngFor` and its track function

### Tests

Karma renders real DOM, so tracking is observable without any user simulation: hold a reference to
a rendered element, push a fresh emission through the mocked service, and assert the same element
is still there. A test written against the current code would fail, which is what makes it worth
having — assertions on the rendered text pass either way.

- `ListComponent`: the `HTMLInputElement` of one section is the same node after a new list is
  emitted, and keeps a value assigned before that emission; a section's `mat-list-item` elements
  are the same nodes after an emission that only changed another section.
- `ListsComponent`, `GroupComponent`: a card element survives a re-emission of the same data.
- The existing suites already cover marking, dragging, renaming and deleting; they must stay green
  rather than be adjusted, since the point of this change is that none of that behaviour moves.
