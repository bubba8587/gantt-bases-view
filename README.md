# Gantt Bases View

A Gantt chart custom view for [Obsidian Bases](https://obsidian.md/bases). Uses TaskNotes frontmatter by default — no changes needed to existing notes.

## Installation

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat): `jortscity/gantt`

## Frontmatter

Standard TaskNotes fields (`scheduled`, `due`, `status`, `priority`) work automatically.

### Dependencies

Each dependency type has its own frontmatter field — all plain wikilink arrays, same pattern as TaskNotes' `blockedBy`.

| Field | Type | Meaning |
|-------|------|---------|
| `blockedBy` | FS | This task starts after the predecessor **finishes** |
| `syncStart` | SS | This task starts when the predecessor **starts** |
| `syncFinish` | FF | This task finishes when the predecessor **finishes** |
| `finishAfterStart` | SF | This task finishes after the predecessor **starts** |

```yaml
blockedBy:
  - "[[Task A]]"          # FS — I can't start until Task A is done

syncStart:
  - "[[Task B]]"          # SS — I start when Task B starts

syncFinish:
  - "[[Task C]]"          # FF — I finish when Task C finishes

finishAfterStart:
  - "[[Task D]]"          # SF — I finish after Task D has started
```

Multiple predecessors per field are fine. A note can use any combination of fields.

TaskNotes' `blocking` field is not read (it's the reverse direction — use `blockedBy` on the successor instead).

## View Options

| Option | Values | Default |
|--------|--------|---------|
| Start date property | any property | `scheduled` |
| End date property | any property | `due` |
| Group by | none / projects / status / priority / contexts | none |
| Zoom | Day / Week / Month (also in toolbar) | Week |
| Color by | status / priority | status |
| Show dependencies | toggle | on |
| Show today marker | toggle | on |

## Toolbar

- **Day / Week / Month** — switch zoom level without opening settings
- **Today** — scroll timeline to today
- **⚠ Fix Schedule (N)** — appears when dependency constraints are violated; shows suggested fixes
- **Copy TSV** — tab-separated table for pasting into Excel

## Clicking tasks

Click any task bar or the task name in the left column to edit dates, status, and priority, or open the note.

## Example notes

**Settings > Gantt Bases View > Create examples** generates a `Gantt Examples/` folder with 5 linked notes covering all four dependency types. Create a Base pointing at that folder and switch to Gantt view.
