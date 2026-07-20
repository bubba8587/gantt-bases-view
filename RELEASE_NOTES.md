## What's New

- **Standard Gantt date semantics** — end dates are now inclusive, matching MS Project and every mainstream Gantt tool: a task due Aug 14 occupies Aug 14 (bars are one day wider than before), duration Aug 1–14 counts as 14 days, a same-day start/due is a 1-day task rather than a milestone, and an FS successor starts the day *after* its predecessor finishes (milestones are zero-duration, so same-day starts after a milestone are fine). Week columns now start on Monday, matching their ISO week labels.

- **Drag to reschedule** — drag a bar to move a task in time, or drag its left/right edge to change just the start or end date. Deltas snap to whole days, a tooltip shows the dates while you drag, and the result is written straight to frontmatter. Milestones drag too.
- **Dependency arrows fixed** — arrows now run predecessor → successor and connect the correct bar edges (FS: finish → start, SF: start → finish). Previously FS and SF arrows swept between the wrong ends of the bars.
- **Hover highlighting** — hovering a bar highlights the dependency arrows connected to it.
- **Smarter Fix Schedule**
  - Fixes that move a start date now shift the end date with it, preserving the task's duration (no more fixes that push a start past its own due date)
  - **Apply All cascades**: fixing one task ripples through the tasks that depend on it until the whole schedule is consistent, with circular dependencies detected and reported
  - Milestones and estimate-only tasks now constrain their successors (a task `blockedBy` a milestone is checked against the milestone's date)
- **Year zooms fit the window** — 1Y/2Y/3Y now scale to your viewport so exactly that many years are visible at once (previously a wide window showed ~3× the years, e.g. 6 years at "2Y")
- **Weekend shading** at day and week zoom, with weekend day headers dimmed
- **Bar tooltips** — hover any bar or milestone for its title, dates, status, and priority

22 new unit tests cover the drag math, cascading fixes, and arrow geometry. No changes to frontmatter format, settings, or vault data.
