/*
  Scrolls an element back into view once the DOM has caught up with the change
  that is about to push it off screen — the "New item..." row of a list section
  or a group card, after an item has been added to it.

  `block: 'nearest'` carries the whole requirement: it performs the minimum
  scroll needed and nothing at all when the element is already fully visible, so
  adding an item to a section in the middle of a long page leaves the page
  exactly where it is. A page that jumps on every add is worse than one that
  occasionally needs a scroll.

  The setTimeout is not optional. Every caller runs from an event handler or a
  stream callback, before Angular has rendered the new item, so at call time the
  element has not moved yet and there would be nothing to correct.
 */
export function keepInView(el: HTMLElement | null | undefined): void {
  if (!el) return;
  setTimeout(() => el.scrollIntoView({ block: 'nearest' }));
}
