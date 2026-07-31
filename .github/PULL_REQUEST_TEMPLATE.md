<!--
English or French, both are fine.

If this pull request is more than a typo or an obvious bug fix and there is no
issue behind it, please open one first — see CONTRIBUTING.md. It is not
bureaucracy: it avoids a refusal after you have already spent the weekend.
-->

Closes #

## What this does, and why

<!-- The problem, then the change. The "why" is what gets reviewed. -->

## How it was verified

<!-- What you ran, and what you saw. Not "tests pass" — which test, covering what. -->

- [ ] `pytest`
- [ ] `npm run lint`
- [ ] `npx tsc -b ui/tsconfig.json`
- [ ] Tried it in the running app

## Checklist

- [ ] Commits are signed off (`git commit -s`) — [DCO](https://developercertificate.org/), no CLA
- [ ] Commit subjects follow `type(scope): description`
- [ ] New user-facing text has keys in **all four** locales, with **no `defaultValue`**
- [ ] No fixed Tailwind colours — design-system tokens only
- [ ] Any new decimal input uses `DecimalInput`, not `<input type="number">`
- [ ] A regression test exists for the defect being fixed, and it is named after it

<!--
The last one matters more than it looks. Tests here are named after the defect
they prevent (TestTheTwoScreensAgree, TestSavingASplitNeverUndoesAReconciliation)
so that whoever breaks an invariant is told which one, and why it exists.
-->

## Anything the reviewer should push back on

<!-- Optional, and genuinely useful: the part you are least sure about. -->
