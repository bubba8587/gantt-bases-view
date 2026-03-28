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
- **Fix Schedule** — shows dependency violations with suggested fixes
- **Copy TSV** — export for pasting into spreadsheets

## Editing

Click any bar or sidebar label to edit dates, status, priority, and dependencies inline, or open the note.

## Example Notes

**Settings > Create examples** generates a `Gantt Examples/` folder with sample tasks covering all dependency types.
