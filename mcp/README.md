# Achievement tracker MCP server (local, file-based)

Lets Claude read your achievement records and draft new ones, using a backup file
exported from the app. Nothing leaves your machine and nothing is ever deleted.

## How it works

1. In the app: Settings → Export data → Full backup (JSON). Save the file somewhere stable, for example `~/Documents/achievements/backup.json`.
2. Point the server at that file (below). Every tool call re-reads it, so re-export whenever you want Claude to see new records.
3. When Claude adds or updates records, they are written to `achievements-changes.json` next to the backup (or wherever `--changes` points). Import that file in the app: Settings → Import backup → **Merge into existing data**. Then export a fresh backup so the server and the app agree again.

## Setup

```sh
cd mcp && npm install
```

Claude Code:

```sh
claude mcp add achieve-it -- npx tsx /path/to/achieve-it/mcp/server.ts --file ~/Documents/achievements/backup.json
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "achieve-it": {
      "command": "npx",
      "args": ["tsx", "/path/to/achieve-it/mcp/server.ts", "--file", "/Users/you/Documents/achievements/backup.json"]
    }
  }
}
```

Options: `--file <backup.json>` (required), `--changes <changes.json>` (default: `achievements-changes.json` beside the backup).

## Tools

| Tool | What it does |
|---|---|
| `list_children` | Children with record counts, plus your preferred labels ("kid"/"student") and term dates |
| `list_tags` | Tags with record counts |
| `list_templates` | Templates with their tags, title tokens, sections and body |
| `list_achievements` | Records, newest first; filter by child, tags, template, batch, source, date range or search |
| `get_achievement` | One record with its sections and the template sections it was made from |
| `get_stats` | Totals, change versus the previous period, per month, per tag, per child, quiet children, firsts |
| `add_achievement` | Create a record, optionally from a template; written to the changes file |
| `update_achievement` | Change title, date, description or tags of a record; written to the changes file |

There is no delete tool, and the changes format cannot express a deletion.

## Limits of the file-based approach

- Claude sees the backup as of its last export, plus its own pending changes.
- Merging a changes file cannot bump a template's usage count.
- A hosted version (Cloudflare Workers plus D1, with sign-in) is planned so the connector also works from claude.ai on a phone; see the connector plan in `SPEC.md`.

## Check

```sh
npm test
```

Starts the server on a sample backup, calls every tool through a real MCP client and verifies the changes file merges back cleanly.
