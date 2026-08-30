# Sections should be deletable

## Problem

Currently, sections can be created and edited, but users cannot delete them.

## Expected behavior

Users should be able to delete a section from the section menu.

## Requirements

- Show a delete action in the section menu.
- Ask for confirmation before deleting.
- Remove the section from Firebase.
- Update the UI immediately after deletion.
- Do not affect other sections.

## Acceptance criteria

- [ ] User can delete a section.
- [ ] Confirmation is displayed.
- [ ] Deleted section disappears from the UI.
- [ ] Refreshing the page does not restore the section.
- [ ] Other sections remain untouched.

## Technical notes

- Update `SectionService`.
- Update the section component.
- Add tests for deletion.