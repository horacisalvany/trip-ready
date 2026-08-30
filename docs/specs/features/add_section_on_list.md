# Sections should be addeable

## Problem

Currently, sections can only by created through selecting a prexisting group
## Expected behavior

Users should be able to create a new section on the view's list

## Requirements

- When user clicks on + icon on view's list, show a new option to create a new section.
- Add the section in Firebase.
- Update the UI immediately after clicks on OK.
- Do not affect other sections.
- Do not validate if the name already exist

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