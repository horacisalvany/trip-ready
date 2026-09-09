# The "New item..." field stays in view

**Depends on [F09](F09-track-rows-on-update.md).** Without `trackBy` on the sections `*ngFor`, every
section card is rebuilt on every emission, so the element this feature captures to scroll is a
detached node by the time it would be scrolled. F09 must land first — see *Why F09 comes first*.

## Problem

On the list view, once a list has enough sections and items to fill the screen, the bottommost
visible row is usually a section's "New item..." field — it sits at the end of the last section
card. Adding an item there pushes the field out of sight: the page grows taller but the scroll
position does not follow, so the new item takes the space the field was occupying and the field
itself ends up just below the fold. Adding a handful of items to that section means scrolling
down again after every single one.

The groups view has the same "New item..." row at the end of every group card, and the same
problem.

## Expected behavior

After adding an item, the field you just typed into is still on screen, so several items can be
added one after another without touching the scrollbar.

Separately, the app gets a small footer at the end of the page, showing the app name and the
year.

## Requirements

- After an item is added to a section (list view) or to a group (groups view), that section's or
  group's "New item..." row is scrolled into view if it is not fully visible.
- If the row is already fully visible, nothing scrolls. Adding an item to a section in the middle
  of a long page must leave the page exactly where it was — a page that jumps on every add is
  worse than one that occasionally needs a scroll.
- The correction is instant, not animated. It is a few dozen pixels of adjustment, not a
  navigation.
- When the item is added with the Enter key, the input keeps its focus (and its cleared value), so
  the next item can be typed straight away. On the list view this is F09's doing, not this
  feature's. Adding with the `+` button moves focus to the button, as it does today — that is
  unchanged.
- A footer is shown at the end of the page content on **every** view, including login.
  - Text: `© <current year> TripReady`, with the year taken from the current date so it does not
    go stale.
  - Centred, small, muted grey.
  - It scrolls with the page; it is **not** fixed to the bottom of the viewport. A pinned footer
    would permanently cost ~28&nbsp;px of a phone screen, and screen height is precisely what is
    scarce here.
- The footer's vertical padding gives the last section a little breathing room at the end of the
  page. That is a side effect, not the mechanism: the padding alone would only absorb one item's
  worth of growth, and the next add would push the field off screen again.

## Acceptance criteria

- [ ] Adding an item to the bottommost section of a full list leaves that section's
      "New item..." field visible.
- [ ] Several items can be added to that section in a row without scrolling manually.
- [ ] Adding an item to a section that is already fully visible does not scroll the page.
- [ ] The same three hold on the groups view.
- [ ] The input keeps focus after an item is added with the Enter key.
- [ ] The footer shows `© <year> TripReady` at the end of the page.

## Technical notes

### Keeping the row in view

One shared helper, `keepInView(el)` in `src/app/views/keep-in-view.ts`, calling
`el.scrollIntoView({ block: 'nearest' })`.

`block: 'nearest'` carries the whole requirement: it performs the minimum scroll needed to bring
the element into the visible area and does nothing at all when the element is already fully
visible. No measuring, no comparing rectangles, no scroll maths in the component. The default
(instant) behaviour is kept.

Both templates give their `.add-item-row` a template ref and pass the element to the add handler,
alongside the input they already pass.

### The two views resolve the DOM update at different times

- `GroupComponent.onAdd` pushes onto the local `group.items` array and then writes to Firebase, so
  the row is in the DOM by the end of change detection. It can call the helper directly after the
  push.
- `ListComponent.onAddItemToSection` does **not** touch the local array — it builds the new array,
  writes it, and waits for `valueChanges()` to re-emit. The new item appears asynchronously, so the
  scroll has to happen after that emission has rendered.

The asynchrony is self-correcting, which is what keeps this simple: the field can only have been
pushed off screen once the new item has actually rendered. If the emission has not arrived yet,
nothing has moved and there is nothing to correct. So the list view scrolls on the render that
follows the add, and a late emission costs a late correction rather than a wrong one.

### Why F09 comes first

`ListService.parseSections` builds brand-new `Section` objects on every emission, and no `*ngFor` in
the app uses `trackBy`. Angular therefore tracks by object identity and tears down and rebuilds
**every** section card on every write to the list.

That defeats this feature on the list view: the `.add-item-row` element captured at add time is
destroyed before the scroll would run, so `scrollIntoView` fires on a detached node and does
nothing. It is also why adding an item on the list view loses focus today, while the groups view —
which mutates its local array — does not.

Tracking sections by `section.id` is exactly what [F09](F09-track-rows-on-update.md) specifies, so
this feature does not restate it and does not implement a narrower version of it. F09 lands first;
this one assumes a section card's DOM survives an emission.

The groups view needs nothing from F09: `onAdd` mutates the local array, so the row is never
rebuilt out from under the scroll.

### Known limitation: the on-screen keyboard

`scrollIntoView` reasons about the layout viewport. On iOS the keyboard overlays the page without
shrinking that viewport, so a row can be "visible" to `nearest` while sitting behind the
keyboard. This is pre-existing and untouched here: the problem being fixed is the row falling
below the *layout* viewport, which `nearest` does handle. Because focus never leaves the input,
Safari's own focused-element scrolling continues to deal with the keyboard. Reading
`window.visualViewport` to do better is deliberately out of scope.

### Rejected alternatives

- **Move the "New item..." field to the top of each section**, under the title, where it can
  never be displaced. No scroll logic at all — but you would type at the top while the item
  lands at the bottom of a growing list, so the thing you just added is the thing you cannot see.
  It also inverts the convention every checklist app uses.
- **A tall spacer at the end of the page and nothing else.** Cheapest change, but it does not
  scroll anything: it buys its own height in slack once and then the field disappears as before.
- **Extracting a shared `add-item-row` component.** The row is duplicated verbatim across the two
  views, so this is tempting. Rejected as too large for the payload: it means restructuring two
  templates and their specs to give four lines of behaviour a home. One tested helper function is
  the smaller change. Worth revisiting if a third view grows the same row.

### The footer

A `<footer role="contentinfo">` in `app.component.html`, placed after `<router-outlet>` so it
lands at the end of the page content of whichever view is active. Static markup and one
`currentYear` getter on `AppComponent` — no component of its own, since there is nothing to
configure and nothing to reuse.

### Files

- `src/app/views/keep-in-view.ts` (new) + spec
- `src/app/views/list/list.component.ts` / `.html` — the scroll on add (`trackBy` comes from F09)
- `src/app/views/group/group.component.ts` / `.html`
- `src/app/app.component.ts` / `.html` / `.scss` — footer markup, styles, `currentYear`
- `docs/specs/spec.md` — one bullet under **Interaction** for the scroll behaviour (it covers both
  views), and one for the footer

### Tests

- `keepInView`: calls `scrollIntoView` with `block: 'nearest'`; no-ops when given no element.
- `ListComponent`: adding an item scrolls that section's `.add-item-row` into view once the list
  re-emits, and not before; the input keeps focus across that emission (which is F09's guarantee,
  asserted here because this feature depends on it).
- `GroupComponent`: adding an item scrolls that group's `.add-item-row` into view.
- `AppComponent`: the footer renders `© <current year> TripReady`.
- `yarn build` as well as `yarn test` — Karma does not type-check templates, and both templates
  change.
