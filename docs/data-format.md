# Data format

The backup JSON is the contract between the app and anything outside the browser: the
MCP connector reads it and writes changes in the same shape. This document is the
reference; the code that builds, parses and merges it is `src/core/backup.ts`.

## File

```json
{
  "app": "achieve-it",
  "version": 2,
  "exportedAt": "2026-09-17T20:00:00.000Z",
  "children": [],
  "achievements": [],
  "tags": [],
  "templates": [],
  "settings": {}
}
```

- `app` must be `"achieve-it"`. `children` and `achievements` must be arrays; everything else is optional and defaults to empty.
- `version` is an integer. Readers accept any version up to their own and refuse newer ones. Fields are only ever added; a field is removed (and ignored on read) only with a note here.
- Dates are ISO: `date` fields are `YYYY-MM-DD` in the user's local calendar; `*At` fields are full ISO timestamps in UTC.
- Ids are UUID strings and never change. Every cross-reference is by id.
- Partial exports (some kids, a date range) carry only the tags their records reference. `templates` and `settings` are always complete.

### Versions

| Version | Change |
|---|---|
| 1 | Original: children, achievements, tags, settings. |
| 2 | Adds `templates`; `templateId`, `templateVersion`, `batchId`, `source` on achievements; `history` on templates. Removes `age` from children and `showAges` from settings (both ignored on read). Settings are included in every export. |

## Child

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `firstName` | string | Required for display. |
| `lastName` | string | May be empty. |
| `avatar` | AvatarConfig | Only `background` matters to a non-visual reader: it is the child's accent colour (hex without `#`). If missing, the app generates one. |
| `createdAt` | timestamp | |

## Achievement

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `childId` | string | May point to a child that no longer exists (records can be kept when a child is deleted). |
| `title` | string | Plain text. |
| `description` | string | Markdown (GFM tables allowed). Template `[[hints]]` are never present in a saved record. |
| `date` | date | When it happened, not when it was recorded. |
| `tags` | string[] | Tag ids. Unknown ids are dropped on read. |
| `templateId` | string? | Template used at creation. May point to a template that has since been deleted. |
| `templateVersion` | number? | The template's `version` at creation. Records are never rewritten when a template changes. |
| `batchId` | string? | Shared by every record saved together in class mode. |
| `source` | `"user"` \| `"claude"`? | Who created or last changed it. Absent means the user. The connector sets `"claude"`. |
| `createdAt`, `updatedAt` | timestamp | On merge, the newer `updatedAt` wins. |

### Reading structure back

Records made from a template have `##` sections. `parseSections(description)` in
`src/core/sections.ts` splits a description into `{ heading, level, body }` and is what a
summariser should use. To know which sections a record *could* have had, look up the
template's body at `templateVersion` (current body, or the matching entry in `history`);
untouched sections were stripped on save, so a missing section means "nothing recorded".

## Tag

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `name` | string | Unique, case-insensitive. On merge an incoming tag with a known name is mapped to the existing id. |
| `color` | string | Palette id (`red`, `orange`, `amber`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `purple`, `pink`, `slate`). |

Convention: a tag named `First` marks a record as a first; Stats lists these under "Firsts".

## Template

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `name` | string | Unique, case-insensitive. On merge a clash with a different id is renamed `"{name} (imported)"`. |
| `icon` | string | Key into the app's icon set. Unknown keys fall back to a generic icon. |
| `color` | string | Palette id, as for tags. |
| `tagIds` | string[] | Applied to every record made with the template. |
| `titlePattern` | string | `{tokens}` become inputs; `{date}` and `{child}` fill in automatically. Empty means a plain title. |
| `body` | string | Markdown skeleton with `[[hints]]`. A literal `[[` is written `\[[`. |
| `suggestOnTag` | boolean | Offer the template when a linked tag is added to a new record. |
| `version` | number | Starts at 1; increments only when `titlePattern` or `body` changes. |
| `history` | Revision[]? | Earlier `{ version, titlePattern, body, changedAt }`, oldest first. |
| `starterKey` | string? | Set when created from a built-in starter. |
| `usageCount`, `lastUsedAt` | number, timestamp? | Counted once per record or per class-mode batch. |
| `createdAt`, `updatedAt` | timestamp | |

## Settings

Only these matter to a reader:

| Field | Notes |
|---|---|
| `labels` | `{ singular, plural }`: what the user calls the people tracked ("kid"/"kids", "student"/"students"). Use it in prose. |
| `termDates` | `{ name, start, end }[]` for teachers; the app's "This term" range. |

Other settings (`defaultRecordView`, `groupBy`, `appearance`, `backupReminderDays`, `lastExportAt`) are app preferences.

## Writing changes

A writer produces a file in this same format containing only what changed: the new or
updated achievements, plus every tag they reference (existing tags copied as-is, new tags
with fresh ids). `children` and `templates` may be empty arrays. The user imports it with
**Merge**, which adds what is missing and keeps the newer `updatedAt` of any record present
on both sides. Merging cannot delete, and it cannot increment a template's `usageCount`.

Rules a writer must follow, all available in `src/core`:

- Run `stripHints` on every description before writing it.
- Set `source: "claude"`, `templateId` and `templateVersion` when a template was used, and `updatedAt` to now.
- Never emit a delete. There is no representation for one.
