Run the predeploy sensitive data check, then build and deploy the plugin.

## Step 1: Predeploy check

Use Grep to scan `src/`, `main.js`, `README.md`, `styles.css`, `manifest.json`, and `package.json` for sensitive patterns (case-insensitive):
- Personal names or usernames (check `.vault-path` for hints)
- Absolute filesystem paths (`C:\\Users`, `/home/`, `/Users/`)
- Personal folder names (`CAPEX`, `Documents`, or anything from `.vault-path`)
- API keys, tokens, secrets
- Email addresses

If ANY match is found, list it and STOP. Do not deploy until the user confirms or fixes.

## Step 2: Deploy

If the check passes, use the Bash tool to run: `bash deploy.sh`

If `.vault-path` doesn't exist yet, prompt the user for their vault path, write it to `.vault-path`, then run `bash deploy.sh`.

## Step 3: Remind

After a successful deploy, remind the user to reload the plugin in Obsidian: Settings > Community plugins > toggle Gantt Bases View off and back on.
