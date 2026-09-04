# Sections should be addeable

## Problem

Currently, if I want to have a quick overview of the the sections of a list, I have to scroll down all the sections.

## Expected behavior

List need to have a new icon to expand/collapse all the current sections of that list. If the sections are expanded then the icon shown is the to collapse one. And other way: if sections are collapsed then the icon shown is the to expand.

## Requirements

- When user clicks on this new icon it expands/collapse depend on the logic described before.
- This new icon is placed between existing ones of sharing and adding.
- It isn't needed to store current state of expand/collapse on Firebase.

## Acceptance criteria

- [x] User can expand sections.
- [x] User can collapse sections.


## Technical notes

- The toggle is a single `sectionsCollapsed` boolean on `ListComponent`; nothing is written to
  Firebase, so reopening the list shows every section expanded again.
- Collapsing removes the item list and the "new item" row from the DOM (`*ngIf`) instead of
  hiding them with CSS, so the CDK drop lists of hidden sections are unregistered while
  collapsed and cannot receive drops.
- The section header (and its drag handle) stays visible, so a section can still be dragged to
  the trash while collapsed.

