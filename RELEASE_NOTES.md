## What's New

- **Layered architecture** — source restructured into pure `core/` logic (testable, DOM-free), `ui/` rendering, and `settings/` modules
- **Correctness fixes**
  - Copy TSV no longer mangles week/month/quarter column headers
  - Bars stay aligned with the column grid across DST transitions
  - Milestone detection works with an empty `timeEstimate` field
  - Dependency wikilinks with folder paths (`[[Projects/Note]]`) now resolve
- **Unified dependency logic** — FS/SS/FF/SF constraint checking is now a single implementation shared by the dependency arrows and the Fix Schedule panel
- **Test suite & CI** — 58 unit tests over the core modules, run in multiple timezones on GitHub Actions
- **Release automation** — pushing a version tag now builds and publishes the release automatically

No changes to frontmatter format, settings, or vault data.
