# Gantt Bases View

A Gantt chart view for [Obsidian Bases](https://obsidian.md/bases). Works with [TaskNotes](https://github.com/callumalpass/tasknotes) frontmatter out of the box.

## Installation

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat): `jortscity/gantt`

## Frontmatter

Uses `scheduled`, `due`, `status`, and `priority` by default. Start/end date properties are configurable in plugin settings.

### Dependencies

Wikilink arrays, same pattern as TaskNotes' `blockedBy`:

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
- **Fix Schedule** — shows dependency violations with suggested fixes; start-date fixes preserve task duration, and **Apply All** cascades through dependent tasks until the schedule is consistent
- **Copy TSV** — export for pasting into spreadsheets

## Editing

Click any bar or sidebar label to edit dates, status, priority, and dependencies inline, or open the note.

Drag a bar to move the task in time, or drag its left/right edge to change just the start or end date — snapped to whole days and written straight to frontmatter. Dependency arrows run predecessor → successor (FS connects the predecessor's finish to the successor's start) and light up when you hover a connected bar.

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
