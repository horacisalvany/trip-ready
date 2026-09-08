/*
  One entry of a list section. Items were plain strings until F08 gave them a
  mark; nothing was migrated, so Firebase still holds strings for lists
  written before that. Every write that builds an items array from scratch —
  a new item, a group's items, a toggle — uses this shape, so a section heals
  as it is touched. parseItems (below) normalises whatever shape is already
  stored back into this one on read. Sharing and unsharing copy a list's
  sections verbatim, so a legacy string can still survive that round trip;
  it normalises again the next time anyone reads it.
 */
export interface Item {
  name: string;
  checked: boolean;
}

/*
  Fresh items from plain names, all starting unmarked — used for a group's
  items (a group is a template and carries no marks) and anywhere else a
  batch of names needs the same shape. A single freshly typed item is built
  inline instead: destructuring one element out of an array to call this
  would read worse than the literal.
 */
export function unmarkedItems(names: string[]): Item[] {
  return names.map((name) => ({ name, checked: false }));
}

/*
  A stored item is either a bare string (written before F08) or an
  { name, checked } object. Firebase's SDK renders a list as a JSON array only
  while its integer keys are dense enough, and falls back to a keyed object
  below that threshold; a scalar means the node holds neither. Almost every
  write in this app replaces the whole items array in one shot, so it never
  produces a sparse array or a keyed-object node — except updateItemAt and
  updateSharedItemAt, which set one item at its index and can leave a hole or
  a sparse tail if that index is past the end of a shorter, concurrently
  edited array. The fallback below is what makes such a node readable at all:
  without it a hole surfaces as an undefined row and reading its name throws.
  It is not a repair, though — compacting the holes away is exactly what
  decouples a position in this array from the Firebase key it came from, so an
  index-based write afterwards can land on the wrong item. See updateItemAt
  for that race and why it is still the better trade. Both ListService and
  ShareService read the same `sharedLists/{id}` shape, so both call this
  rather than keeping their own copy.
 */
export function parseItems(itemsObj: any): Item[] {
  if (!itemsObj || typeof itemsObj !== 'object') return [];
  const stored = Array.isArray(itemsObj) ? itemsObj : Object.values(itemsObj);
  return stored
    .filter((item) => item !== null && item !== undefined)
    .map((item) =>
      typeof item === 'string'
        ? { name: item, checked: false }
        : {
            name: typeof item.name === 'string' && item.name ? item.name : 'Untitled',
            checked: !!item.checked,
          }
    );
}
