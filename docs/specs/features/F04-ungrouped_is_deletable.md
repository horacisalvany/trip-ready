# Sections should be addeable

## Problem

Currently, the default section 'Ungrouped' isn't deletable
## Expected behavior

I can drag and drop to the trash the ungrouped section.

## Requirements

- When user drop the Ungrouped section on trash it gets deleted

## Acceptance criteria

- [x] User can delete Ungrouped section of a list.


## Technical notes

- `list.component.html`/`.ts` special-case the Ungrouped section: drag is disabled (`cdkDragDisabled`), the drag handle icon is hidden, and `dropTrash()` early-returns for it. Remove all three so Ungrouped is draggable and deletable exactly like any other section.
- `isUngroupedSection()` becomes unused once those guards are removed; delete it along with the now-unneeded `UNGROUPED_SECTION_TITLE` import in the component (the service still needs it for sort order and list creation).
- Once deleted, Ungrouped is not recreated automatically — it behaves like any other section going forward. `docs/specs/spec.md` updated accordingly.
- No Firebase/service change needed: `removeSectionFromList`/`removeSharedSectionFromList` already operate by section id regardless of title.

