Scan all source files, built output, and config files for sensitive or personal data before deploying.

Use the Grep tool to search the following paths for sensitive patterns:
- `src/` (all .ts files)
- `main.js`
- `README.md`
- `styles.css`
- `manifest.json`
- `package.json`

Search for these patterns (case-insensitive):
1. The user's name or username (check .vault-path for clues if needed)
2. Absolute filesystem paths (e.g. `C:\\Users`, `/home/`, `/Users/`)
3. Vault names or folder paths that look personal (e.g. `CAPEX`, `Documents`)
4. API keys, tokens, secrets
5. Email addresses

If ANY matches are found:
- List each match with file, line number, and the matched content
- Do NOT proceed — ask the user to confirm or fix

If clean:
- Report "No sensitive data found" and confirm safe to proceed
