/*
  Nothing in this app tells Angular how to recognise a row it has already drawn,
  so it falls back to tracking by object identity — and ListService rebuilds
  every Section and every Item from the Firebase snapshot on each emission. The
  differ therefore sees an entirely new set of rows and destroys and recreates
  all of them, even when one character changed in one item.

  The visible cost is on the list view: each section card holds its own
  "New item..." input, and that input is plain DOM holding whatever the user has
  typed. Rebuilding the card throws the text away.
 */

/** The part of an entity these functions key on. */
interface Keyed {
  id: string;
}

/*
  Sections, lists and groups all carry their Firebase key as `id`. It is stable
  for the life of the thing and unaffected by a rename, so one function serves
  all of them.
 */
export function trackById(_index: number, entity: Keyed): string {
  return entity.id;
}

/*
  A section's items are keyed by position, because an item has no stored
  identity and position is the only key that is stable across emissions.

  Not by name: two items in one section may share one — onAddItemToSection only
  trims and rejects empty, so "Socks" twice is allowed and reasonable on a
  packing list, and parseItems rewrites any unusable name to `Untitled`, so a
  section repaired from bad data can hold several rows keyed alike. Angular's
  differ tolerates duplicate keys rather than throwing, which is worse than an
  error here: it pairs each row with an arbitrary one of the duplicates, so a
  mark can appear to jump between two identically named items.

  Not by a minted id either: a value created on read differs on every emission,
  which is the situation being fixed. Persisting one is a data-model change whose
  only payoff is the tracking a position already provides — see the spec.
 */
export function trackByIndex(index: number): number {
  return index;
}
