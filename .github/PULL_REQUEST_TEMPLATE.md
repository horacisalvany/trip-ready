<!--
  Title format: RIBMP-1234: lowercase imperative summary
  Use RIBMP-0000 when there is no ticket.
-->

## Story

<!-- Link the spec this implements, e.g. docs/specs/features/F01-add_section_on_list.md -->
<!-- Behaviour not covered by a spec? Add it to docs/specs/spec.md in this PR. -->

## What

<!-- What changes for the user, and why. What was wrong or missing before? -->

## How

<!-- The technical shape of the change: new services/components, data model or
     Firebase paths touched, anything a reviewer would otherwise have to
     reverse-engineer from the diff. Call out decisions you are unsure about. -->

## Checklist

- [ ] `yarn test:prod` passes
- [ ] `yarn build` passes
- [ ] New code is covered by unit tests
- [ ] Behaviour change is reflected in `docs/specs/spec.md`
- [ ] Verified in the browser, not just in tests
- [ ] Firebase writes sourcing `userPath()` use `take(1)` *(if applicable)*
- [ ] No read of `sharedLists/{id}` used to decide whether it may be used *(if applicable)*

<!-- Add anything else that must happen before merge: migrations, rules deploys,
     follow-up tickets, coordinated releases. -->
