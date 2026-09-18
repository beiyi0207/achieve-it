# Achievement Tracker — Project Spec

A mobile-first PWA for one adult (parent or teacher) to record and review achievements for multiple children. No accounts, no server, no child logins. Data lives in the browser; the user exports backups.

## Tech stack

- **Vite + Preact + TypeScript.** No React. Hash-based routing, hand-rolled (no router lib).
- **Storage:** IndexedDB via `idb` (or Dexie). Not localStorage.
- **PWA:** `vite-plugin-pwa` (Workbox). Precache the app shell; installable; works offline.
- **Markdown:** `marked` + `DOMPurify`. Always sanitize before rendering.
- **Avatars:** `@dicebear/core` + 2–3 style packages (prefer CC0 styles such as `lorelei`, `notionists`; check each style's license). Avatars are stored as a small config object, never as an image.
- **Hosting:** any static host over HTTPS (GitHub Pages, Netlify, Cloudflare Pages).
- **Data layer behind one interface** (`db.ts`) so IndexedDB can later be swapped for a synced backend without touching the UI.

## Data model

```ts
type Child = {
  id: string;            // uuid
  firstName: string;
  lastName: string;
  avatar: AvatarConfig;
  createdAt: string;     // ISO
};

type AvatarConfig = {
  style: string;         // dicebear style name
  seed?: string;
  skin: string;
  hair: string;
  hairColor: string;
  eyes: string;
  mouth: string;
  extras?: string;       // glasses, crown, etc. or "none"
  background: string;    // also used as the child's accent color across the app
};

type Achievement = {
  id: string;
  childId: string;
  title: string;
  description: string;   // markdown
  date: string;          // ISO date (YYYY-MM-DD)
  tags: string[];        // tag ids
  templateId?: string;   // template used at creation; may point to a deleted template
  templateVersion?: number;
  batchId?: string;      // shared by records saved together in class mode
  source?: "user" | "claude";  // absent means "user"; set by the connector
  createdAt: string;
  updatedAt: string;
};

type Template = {        // see "Templates and class mode"
  id: string;
  name: string;          // unique, case-insensitive
  icon: string;          // key into the curated icon set
  color: string;         // tag palette id
  tagIds: string[];
  titlePattern: string;  // "Chinese: {topic}"; empty = plain title
  body: string;          // markdown with [[hints]]
  suggestOnTag: boolean;
  version: number;       // bumps only when titlePattern or body changes
  history?: { version: number; titlePattern: string; body: string; changedAt: string }[];
  starterKey?: string;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type Tag = {
  id: string;
  name: string;
  color: string;         // from a fixed palette; consistent everywhere
};

type Settings = {
  defaultRecordView: { sort: "date" | "child" | "tag"; direction: "asc" | "desc" };
  groupBy: "date" | "child" | "tag" | "none";
  appearance: "system" | "light" | "dark";
  backupReminderDays: number;   // default 14
  lastExportAt?: string;
  termDates?: { name: string; start: string; end: string }[];
};
```

## Navigation

Bottom tab bar: **Kids · Records · [+] · Stats · Settings**. The center `+` is a floating action button that opens "New achievement".

## Screens

### 1. Kids (cohort home)
- Header: "Your kids", search icon, add-kid icon.
- Two metric cards: number of kids, achievements this month.
- List rows: avatar, full name, "N achievements", chevron.
- Swipe left on a row to delete. Deleting a child asks what to do with their records (delete or keep as orphaned) — never silently.
- Empty state invites adding the first kid.

### 2. Child profile
- Back and edit icons. Large avatar, name, achievement count.
- Tag chips with per-tag counts for this child.
- Timeline of this child's achievements grouped by month; each row has a colored left accent bar (tag color), title, date, tag chip.
- Button: "Add achievement for {name}" — opens the editor with this child preselected.
- Edit child: first name, last name, avatar (opens avatar builder).

### 3. Records (all achievements)
- Header: "Records", sort icon, filter icon.
- Search field: matches title and description.
- Filter chips: child (multi-select), tag (multi-select), date range (presets: this week, this month, this term, this year, all, custom). Active chips are highlighted with an × to clear.
- Segmented control for group-by: Date · Child · Tag · None. Always one tap away, not in a menu.
- Grouped sections show a colored header with the group name and count.
- Row: small avatar, title, "child · date · tag chips". Tap to open detail; detail has an edit button.

### 4. Add / edit achievement
- Header: Cancel · "New achievement" / "Edit achievement" · Save.
- Child picker: row of avatars (not a dropdown). Preselect when opened from a child's profile.
- Title (required), Date (defaults to today), Tags (chip input with autocomplete from existing tags; can create new inline).
- Description: markdown editor with **Write / Preview** toggle and a toolbar (h1, h2, bold, italic, bullet list, numbered list, link) that inserts markdown syntax.
- Edit mode only: "Delete record" at the bottom, with confirmation.
- Validate: title required, child required.

### 5. Settings
- **Backup warning banner** at the top when last export is older than the reminder interval: "Last backup was N days ago. Your data only lives in this browser. Back up now."
- **Your data:** Export data (opens export sheet), Import backup (JSON only — say so in the UI; confirm before replacing/merging), Backup reminder interval.
- **Tags:** Manage tags — rename, recolor, delete, and **merge** one tag into another.
- **App:** Install app (triggers PWA install prompt; hidden if already installed), Appearance (system/light/dark), Default record view, Term dates (for teachers; used by the "Term" range in Stats).
- **Danger zone:** Erase all data — requires typing "erase" to confirm.
- Footer: version, kid count, record count.

### 6. Export sheet (bottom sheet)
- Options: **Full backup (JSON)** — default, everything, used for restore. **Spreadsheet (CSV)** — records only, flattened; not importable.
- Include chips: All kids / selected kids, All dates / range, Avatars (JSON only).
- Buttons: Share (Web Share API when available) and Download.
- On export, update `lastExportAt`.

### 7. Stats (cohort)
- Header: "Stats", child filter chip (All kids by default).
- Range segmented control: Month · Term · Year · All.
- Metric cards (2-column grid): total achievements (with delta vs previous period), tags used, most active month, average per kid.
- Bar chart: achievements per month for the range.
- By tag: horizontal bars with counts.
- By kid: **alphabetical, not ranked** — no leaderboard.
- Quiet-kid nudge: highlight any child with no records in the last 30 days.
- Every bar/tag/kid is tappable and navigates to Records with that filter applied.

### 8. Stats (single child)
- Same layout with the child chip active.
- Metrics: total in range, monthly streak (consecutive months with ≥1 record).
- Growth by tag vs previous period.
- "Firsts" list: records carrying the `first` tag.

### 9. Avatar builder
- Header: Cancel · "{name}'s avatar" · Done.
- Large live preview pinned at the top; option rows scroll beneath it.
- Buttons: Shuffle (random config within the current style) and Undo.
- Style: segmented control limited to 2–3 curated DiceBear styles.
- Rows: Skin, Hair, Hair color, Eyes, Mouth, Extras, Background. Each option is rendered visually (swatch or mini-preview), never as a text label.
- Background color doubles as the child's accent color throughout the app (list avatars, chips, stats).
- New child gets a random avatar seeded from their name.
- Store only the config; render SVG on demand; never cache the SVG.

## Cross-cutting rules

- Tag colors are consistent everywhere (list, editor, stats, profile). Tags come from a fixed palette.
- Tag autocomplete on entry to avoid "Sport"/"Sports"/"sprots". Merge tool in Settings for cleanup.
- All destructive actions confirm. Erase-all requires typed confirmation.
- Sentence case for all UI text. No emoji in UI chrome.
- Dark mode supported via system preference and manual override.
- Touch targets ≥ 44px. Single column layout; max two columns for cards.
- Offline: all screens function without a network after first load.

## Templates and class mode

Specified in "Feature Spec: Templates and Class Mode" (Claude Doc) and built. In short: a template stamps a record with linked tags, a title pattern with `{tokens}` and a markdown body with `[[hints]]`; untouched hints, and the empty items, rows and sections they leave behind, are stripped on save. Class mode saves one record per selected kid from one form, with per-kid notes under a "Notes" heading and a shared `batchId`. Templates are stamps, not links: a record keeps the `templateVersion` it was made with and is never rewritten.

## Connector plan (MCP)

Goal: let Claude read the data to summarise it, and later create and update records, but never delete.

Decisions

- The **backup JSON is the contract** between the app and anything outside the browser. It is versioned (`version` field), documented in `docs/data-format.md`, and every export carries `settings` (labels and term dates) because summaries need them.
- **Pure logic lives in `src/core/`** and imports nothing from the DOM, Preact, IndexedDB, DiceBear or the markdown renderer. The connector runs the same hint stripping, filters, stats and backup parsing as the app. A test enforces the boundary.
- Records created or changed by Claude carry `source: "claude"`; the app shows "Added by Claude" and can filter on it.
- Templates keep a `history` of earlier title patterns and bodies so records made with older versions can still be grouped by section.
- Age was removed from the child model: it goes stale and summaries cannot rely on it.
- Claude never deletes. There is no delete tool, and the credential it uses must not permit deletes server-side once there is a server.

Step 1 (done with this spec): the format and core clean-up plus a **local, file-based MCP server** in `mcp/`. It reads an exported backup and answers `list_children`, `list_tags`, `list_templates`, `list_achievements`, `get_achievement` and `get_stats`. `add_achievement` and `update_achievement` write a changes file in backup format that the user imports with Merge. Runs with Claude Desktop or Claude Code on the same machine; no auth, no server.

Step 2 (later): a hosted backend so claude.ai on a phone can use the connector. Cloudflare Workers plus D1 as the source of truth, a `DataStore` implementation in the PWA that syncs (offline queue, last-writer-wins by `updatedAt`, tombstones so the user's own deletions propagate), a login for the single adult user, and OAuth for the connector. The tools stay the same.

## Non-goals (v1)

- User authentication or multi-device sync (planned for connector step 2).
- Child-facing views or logins.
- Photo/image uploads.
- Push notifications.

## Suggested build order

1. Scaffold Vite + Preact + TS, PWA plugin, hash router, tab bar shell.
2. `db.ts` with IndexedDB stores: children, achievements, tags, settings. Seed dev data.
3. Kids list + add/edit/delete child (with initials avatar as placeholder).
4. Achievement editor with markdown Write/Preview.
5. Records list with search, filters, sort, group-by.
6. Child profile.
7. Export/Import JSON + CSV; backup reminder.
8. Avatar builder with DiceBear.
9. Stats.
10. Settings polish, manage tags with merge, erase-all, install prompt.
