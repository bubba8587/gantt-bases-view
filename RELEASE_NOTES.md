## What's New

- **Circular dependency detection** — the Fix Schedule panel now lists circular chains (`A ← B ← A`) as their own kind of problem, shown above date violations. Cycles can't be satisfied by any date fix and previously surfaced only as confusing one-sided suggestions; now the panel names every task in the loop and tells you to remove a link. Tasks in a cycle get the ⚠ badge, and the toolbar count includes them.
- **Full-chain hover highlighting** — hovering a bar now highlights its entire dependency chain: every transitive predecessor and successor is outlined and all the arrows along the paths light up, not just direct links. Great for tracing what actually drives a date.
- **Clearer dependency editing** (from 1.3.x follow-ups) — dependency rows in the edit popup read as a sentence: "starts after [Task 2]", "finishes with [Docs]", with tooltips naming the underlying frontmatter field.

No changes to frontmatter format, settings, or vault data.
