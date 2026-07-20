# Gantt Bases View

A Gantt chart view for [Obsidian Bases](https://obsidian.md/bases). Works with [TaskNotes](https://github.com/callumalpass/tasknotes) frontmatter out of the box.

## Installation

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat): `jortscity/gantt`

## Frontmatter

Uses `scheduled`, `due`, `status`, and `priority` by default. Start/end date properties are configurable in plugin settings.

Dates are **inclusive** all-day dates, per standard Gantt convention: a task with `due: 2026-08-14` occupies Aug 14 and finishes at the end of it, so a `blockedBy` successor can start Aug 15. A task scheduled and due the same day is a 1-day task; a note with only a start date (and no `timeEstimate`) is a zero-duration milestone, and tasks blocked by a milestone may start the same day it happens.

### Locks

`ganttLocks` pins sides of the start + duration = end triangle:

```yaml
ganttLocks:
  - start      # any of: start, end, duration
```

Every operation respects locks: locked bars can't be dragged or resized past their pins, the edit popup disables pinned fields (with padlock toggles to change them), and schedule fixes route around locks — a start fix with a locked end shrinks the duration instead, an end fix with a locked duration shifts the whole task, and a task whose locks make its violation unsatisfiable is shown as 🔒 Locked and skipped by Apply All.

### Dependencies

Wikilink arrays, same pattern as TaskNotes' `blockedBy`. Dependencies are declared on the **successor** — the linked notes are its **predecessors**. `blockedBy: [[Task A]]` in Task B means *Task B starts after Task A finishes*, and the arrow draws from Task A's finish to Task B's start.

| Field | Type | Meaning |
|-------|------|---------|
| `blockedBy` | FS | Starts after predecessor finishes |
| `syncStart` | SS | Starts when predecessor starts |
| `syncFinish` | FF | Finishes when predecessor finishes |
| `finishAfterStart` | SF | Finishes after predecessor starts |

Multiple predecessors per field are supported.

## Settings

**Settings > Gantt Bases View**

- **Start/end date property** — which frontmatter fields to use (defaults: `scheduled` / `due`)
- **Status & priority options** — comma-separated lists for the edit popup dropdowns
- **Sync from TaskNotes** — imports statuses, priorities, and their colors from TaskNotes automatically

Values already used in your vault are appended to the dropdowns automatically.

## Toolbar

- **Zoom** — Day / Week / Month / 1Y / 2Y / 3Y
- **Today** — scroll to today
- **Color** — color bars by status, priority, or none (colors sync from TaskNotes)
- **Fix Schedule** — shows dependency violations with suggested fixes; start-date fixes preserve task duration, and **Apply All** cascades through dependent tasks until the schedule is consistent. Circular dependency chains are detected and listed by name — no date fix can satisfy them, so remove a link instead
- **Copy TSV** — export for pasting into spreadsheets

## Editing

Click any bar or sidebar label to edit dates, duration, status, priority, and dependencies inline, or open the note. Each of start, end, and duration has a padlock toggle; the duration field keeps the three consistent as you edit (with duration locked, moving one date drags the other along).

Drag a bar to move the task in time, or drag its left/right edge to change just the start or end date — snapped to whole days and written straight to frontmatter. Dependency arrows run predecessor → successor (FS connects the predecessor's finish to the successor's start); hovering a bar highlights its full dependency chain — every transitive predecessor and successor, with the arrows along the way.

## Example Notes

**Settings > Create examples** generates a `Gantt Examples/` folder with sample tasks covering all dependency types.

## Development

```bash
npm install
npm run dev        # watch build
npm run build      # typecheck + production build (main.js)
npm test           # unit tests (vitest)
```

The source is split into three layers:

- `src/core/` — pure, DOM-free logic: task model (`model.ts`), frontmatter parsing (`parse.ts`, `extract.ts`), timeline/date math (`timeline.ts`), dependency-constraint checking (`schedule.ts`), and TSV/Markdown export (`export.ts`). Everything here is covered by the unit tests in `tests/`.
- `src/ui/` — the Bases view and its DOM rendering: `gantt-view.ts` (view class), `scaffold.ts`, `toolbar.ts`, `task-bar.ts`, `dependency-arrows.ts`, `popup-editor.ts`, `violation-panel.ts`.
- `src/settings/` — the settings tab, TaskNotes sync, and the example-vault generator.

Dependency semantics live in one place, `src/core/schedule.ts`: the task declaring a dependency is the *successor*, the linked note the *predecessor*, and each of FS/SS/FF/SF binds one successor date to one predecessor date. Both the arrow renderer and the Fix Schedule panel use that single implementation.
