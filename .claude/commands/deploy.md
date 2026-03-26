Run the deploy script to build the plugin and copy it to the local Obsidian vault.

Use the Bash tool to run: `bash deploy.sh`

If `.vault-path` doesn't exist yet, prompt the user for their vault path, write it to `.vault-path`, then run `bash deploy.sh`.

After a successful deploy, remind the user to reload the plugin in Obsidian: Settings → Community plugins → toggle Gantt Bases View off and back on (or use the "Reload app without saving" command).
