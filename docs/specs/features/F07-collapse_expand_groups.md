# Sections should be addeable

## Problem

Currently, if I want to have a quick overview of the the group's view, I have to scroll down all the groups.

## Expected behavior

List need to have a new icon to expand/collapse all the current groups of the view. If the groups are expanded then the icon shown is the to collapse one. And other way: if groups are collapsed then the icon shown is the to expand. Same concept as F03 implementation.

## Requirements

- When user clicks on this new icon it expands/collapse depend on the logic described before.
- This new icon is placed between existing ones of sharing and adding.
- It isn't needed to store current state of expand/collapse on Firebase.

## Acceptance criteria

- [x] User can expand groups.
- [x] User can collapse groups.

## Technical notes

- The toggle is a single `groupsCollapsed` boolean on `GroupComponent`; nothing is written to
  Firebase, so reopening the groups view shows every group expanded again.
- The groups header has no share button, so "between sharing and adding" resolves to
  immediately before the `+`.
- Collapsing removes the `mat-list` of every group from the DOM (`*ngIf`) instead of hiding it
  with CSS, so the CDK drop lists of hidden groups are unregistered while collapsed and cannot
  receive drops. The "new item" row lives inside that list, so it goes with it.
- The group header (and its drag handle) stays visible, so a group can still be dragged to the
  trash — or renamed — while collapsed.

