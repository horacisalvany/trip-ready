# Sections should be addeable

## Problem

Currently, sections can only by created through selecting a prexisting group
## Expected behavior

Users should be able to create a new section on the view's list

## Requirements

- When user clicks on + icon on view's list, show a new field to create a new section.
- The field requires at least 1 character.
- When user clicks on OK -> Add the section in Firebase.
- Update the UI immediately after clicks on OK creating a new section on view's list.
- Do not affect other sections.
- Do not validate if the name already exist

## Acceptance criteria

- [ ] User can create a section.
- [ ] System validates that the section has at least 1 character as a title.
- [ ] Other sections remain untouched.

## Technical notes