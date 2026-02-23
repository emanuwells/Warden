# Secrets Directory

This folder contains sensitive configuration files (DB credentials, API keys, etc.).

**Rules:**
- **NEVER** commit real secrets to version control.
- Use `.example` files as templates.
- Copy `database.json.example` → `database.json` and fill with real values.
- The `.gitignore` excludes `database.json` and `slack.json` automatically.
