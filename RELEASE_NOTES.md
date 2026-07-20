## What's New

- **Duration field & per-task locks** — the edit popup now has a Days field alongside Start/End, and each of the three has a padlock toggle (stored as `ganttLocks` in frontmatter). Locks pin sides of the start + duration = end triangle and every operation respects them: locked bars can't be dragged or resized past their pins, disabled fields in the popup, and schedule fixes route around locks — a start fix with a locked end shrinks the duration, an end fix with a locked duration shifts the whole task, and violations that locks make unsatisfiable show as 🔒 Locked and are skipped by Apply All (with a count in the notice). Locked bars carry a small 🔒 badge.

- **Circular dependency detection** — the Fix Schedule panel now lists circular chains (`A ← B ← A`) as their own kind of problem, shown above date violations. Cycles can't be satisfied by any date fix and previously surfaced only as confusing one-sided suggestions; now the panel names every task in the loop and tells you to remove a link. Tasks in a cycle get the ⚠ badge, and the toolbar count includes them.
- **Full-chain hover highlighting** — hovering a bar now highlights its entire dependency chain: every transitive predecessor and successor is outlined and all the arrows along the paths light up, not just direct links. Great for tracing what actually drives a date.
- **Short group labels** — grouping by folder now shows just the folder name instead of the full path from the vault root; the full path appears as a tooltip. Same-named folders in different places stay independent (collapse state and identity still use the full path).
- **Clearer dependency editing** (from 1.3.x follow-ups) — dependency rows in the edit popup read as a sentence: "starts after [Task 2]", "finishes with [Docs]", with tooltips naming the underlying frontmatter field.

No changes to frontmatter format, settings, or vault data.
