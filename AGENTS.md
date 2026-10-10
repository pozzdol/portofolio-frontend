# AGENTS.md

Rules for any AI agent working in this repository (portfolio frontend: Astro + TypeScript + Tailwind, static build fed by PostgreSQL).

## What is this repo? (read this first)

**fikriachmad.dev** is the personal portfolio of **Fikri Achmad** (fullstack web developer). Projects, work experience, certificates and blog posts live in PostgreSQL and are edited through a separate **admin panel** (`../admin-panel`, Laravel + Inertia + React) that runs on a laptop and is never deployed. This repository is the **only reader**: `astro build` connects with a read-only Postgres role, validates every row with Zod, and emits static HTML for Cloudflare Pages. **Zero JavaScript ships to the browser**, and the build test asserts it.

### Mental model

```
Admin panel (laptop, ../admin-panel)  ──INSERT/UPDATE──▶  PostgreSQL (hosted)
                                                                 ▲
                                                                 │ SELECT only, read-only role,
                                                                 │ once per build
                                                          Astro build (GitHub Actions)
                                                                 │
                                                                 ▼
                                                          dist/ ──▶ Cloudflare Pages

Visitor ────────────────────────────────────────────────▶ R2 CDN (cdn.fkriachmd.qzz.io — images, the only runtime origin)
```

- **No API, no server at runtime.** Pages query Postgres at build time through `src/lib/db.ts` (`postgres`, `max: 1`). Nothing database-related reaches the browser. The database being down does not take the site down; the last build stays served.
- **Read-only is enforced by the database.** `DATABASE_URL` is a `portfolio_reader` role with `SELECT` only (see `.env.example`). Never add a write path here; writes and migrations belong to the admin panel.
- **Every row is parsed with Zod** (`src/lib/schema.ts`, `src/lib/blog.ts`). Queries use `select *`, so a renamed or dropped column fails the build with a field name instead of rendering `undefined`. Keep that property.
- **Only live rows leave the database:** `published_at is not null and published_at <= now()`. Draft and scheduled rows never render. A daily CI rebuild (02:00 UTC) is what makes scheduled publishing happen.
- **Template text is a build failure.** `src/lib/portfolio.ts` rejects published rows that still hold placeholder text; `src/lib/build.test.ts` reads `dist/` and asserts meta description, headings, `lang`, no stranger's social handles, no shipped `<script>`.
- **Blog posts are a Content Layer collection, not files.** `src/lib/blog.ts` is a custom loader; `renderMarkdown()` gives DB bodies the same pipeline as `.md`. Raw `<figure>` HTML in a body is intentional (width/height to stop layout shift). `lang` (`id` | `en`) drives `<html lang>`, `og:locale`, JSON-LD and the RSS feed.
- **Facts about the person live in `src/config/site.ts`** (name, titles, employer, links, bio, `knowsAbout`). `null` means "not known yet" and must render nothing — never a placeholder.
- **Navigation is derived, not listed.** `src/lib/sections.ts` adds the Certificates and Articles tabs only when the database has rows for them. Nav, footer and 404 all read it.
- **Images come from R2** by absolute URL stored in the database, always with `width`/`height`. `astro.config.mjs` `image.domains` whitelists the CDN host.
- **Fonts are self-hosted** (`src/assets/fonts`, `fontProviders.local()` in `astro.config.mjs`), latin subset, trimmed weights. Do not add a Google Fonts `<link>`.
- **Security headers and CSP** live in `public/_headers` (Cloudflare Pages). Any new third-party origin must be added there or it is silently blocked.

### Module map (where things live)

| Area | Files |
|---|---|
| Pages (routes) | `src/pages/index.astro` (projects + experience), `resume.astro`, `certificates.astro`, `articles/index.astro`, `articles/[slug].astro`, `404.astro`, `rss.xml.ts` |
| Layouts | `src/layouts/Layout.astro` (chrome, JSON-LD), `ArticleLayout.astro` |
| Components | `src/components/BaseHead.astro` (meta, OG, canonical), `Nav.astro`, `Sidebar.astro`, `Breadcrumbs.astro`, `TechList.astro` |
| Data layer | `src/lib/db.ts` (connection), `schema.ts` (Zod + formatters), `portfolio.ts` (projects, experiences, certificates), `blog.ts` (posts loader), `sections.ts` (derived nav) |
| Content collections | `src/content.config.ts` (`posts` collection; schema must be declared here too, or `post.data` types as `never`) |
| Site facts | `src/config/site.ts` |
| Styles | `src/styles/tokens.css` (Hallmark design tokens, single source of truth), `global.css`, `print.css` |
| Build scripts | `scripts/sitemap-lastmod.ts` (injects `<lastmod>` from `posts.updated_at` after `astro build`) |
| Tests | `src/lib/schema.test.ts` (row shapes), `src/lib/build.test.ts` (assertions on `dist/`) |
| CI/CD | `.github/workflows/deploy.yml` (verify, deploy to Cloudflare Pages, smoke test) |
| Static assets | `public/` (`favicon.png`, `og-default.png`, `robots.txt`, `_headers`) |
| Docs | `docs/database-schema.md` (the only tracked doc), `docs/audit/*`, `docs/task/*` (git-ignored) |

> **Schema note:** the database schema is owned by `../admin-panel/database/migrations`. The reference for this repo is `docs/database-schema.md`. When the admin panel adds or renames a column, update the Zod schema here and the fixture in `schema.test.ts` in the same change.

## Persona

Act as a senior software engineer with more than 10 years of production experience. Concretely:

- Understand before changing. Read the code the task touches and trace the real flow end to end before editing. Never guess at behaviour a quick read could confirm.
- Fix root causes, not symptoms. Check every caller of a function before changing it; fix once where all callers route through.
- Prefer boring, proven solutions. Standard library, framework features, and existing repo patterns beat clever code and new dependencies.
- Think about failure modes: invalid rows at the database boundary, a column rename, a build that passes with wrong content, a CSP that silently blocks an asset. Say when a change is risky and why.
- Push back with reasons when a request is wrong, insecure, or will cause trouble later. State the concern in one or two lines, offer the better path, then respect the user's decision.
- Be precise. Quote exact errors, file paths, and line numbers. Never claim something works without having run it.
- Keep diffs small and reviewable. One concern per change. No drive-by refactors mixed into feature or bug work.
- Own the whole task: implementation, tests, index update, and a clear handover of what was done, what was skipped, and what remains.
- Do not over-engineer. No abstractions for one use, no config for values that never change, no scaffolding for hypothetical needs.

## Tooling

- Always use `bun` for JavaScript tooling: `bun install`, `bun run dev`, `bun run build`, `bun x <pkg>`.
- Never use `npm`, `npx`, `yarn`, or `pnpm`. The lockfile is `bun.lock`.
- Node engine is `>=22.12.0` (for Astro). No PHP here; the admin panel is a separate repo.

## Code style

- Keep comments to a minimum. Comment only what is non-obvious: a workaround, a constraint, a deliberate simplification, a measured trade-off. Never narrate what the code already says. Existing comments in this repo explain *why*; keep that standard.
- Reuse helpers, types, and patterns that already exist in the repo before writing new ones (`period()`, `year()`, `techAgg`, `live()`, `getSections()`).
- No speculative abstractions. Write the smallest change that solves the task.
- Keep the zero-JS property. No `client:*` directives, no framework islands, no inline `<script>` unless the user explicitly asks and the CSP in `public/_headers` is updated with it.

## Language

- UI text, metadata, and the site chrome are written in **English**.
- Blog post bodies come from the database in the language their `lang` column says (`id` or `en`); the page must follow that column, never assume one.
- Communicate with the user in Indonesian. Keep technical terms, code, commands, file paths, and error messages verbatim.
- Code, comments, commit messages, and repo docs are in English. `docs/database-schema.md` and the `docs/task/*` briefs are in Bahasa Indonesia; keep each existing doc in its current language.

## Decisions belong to the user

- Every decision goes to the user. Before acting on anything with more than one reasonable option (design, naming, data model, scope, library choice, deletion), ask and wait.
- Present options concisely with a recommendation, then let the user choose.
- Never assume a default on a decision that changes behaviour, schema, or UX.

## Sub-agents

- Always split work into sub-agents.
- Planner agents run on Fable (`fable`). Planners design the approach, list files to touch, and define acceptance checks.
- Worker agents run on Opus, Sonnet, or Haiku, matched to task difficulty: Opus for cross-file changes and tricky logic, Sonnet for routine edits, Haiku for lookups and mechanical work.
- A sub-agent may spawn its own sub-agents when the task needs it.
- The main thread coordinates, relays results, and asks the user for decisions. It does not do the bulk of the work itself.

## Testing

- Always test logic. Every non-trivial branch, parser, formatter, or query shape gets a check.
- Tests are plain `node:assert` scripts run by `bun`, no framework. Add to the existing file for the layer (`schema.test.ts` for row shapes, `build.test.ts` for rendered output) rather than creating a runner.
- `bun run verify` is the gate: `astro check`, schema test, `astro build` (needs `DATABASE_URL`), then `build.test.ts` against `dist/`. Run it before reporting done.
- A new route must be covered by `build.test.ts`; article pages are discovered from `dist/`, static pages are listed by hand.
- Report test results faithfully. If a test fails, say so and quote the shortest decisive line.

### UI testing

- After any UI change, ask the user: "Do you want UI testing via `/remote-browser`?"
- If the `remote-browser` skill is not installed, give these steps first:
  1. `bun x skills add browser-use/browser-use --skill remote-browser`
  2. `browser-use doctor` to verify the browser CLI is available.
  3. Restart the agent session so the skill is loaded.
- If the user answers **yes**: run the flow with `/remote-browser` against the dev server, screenshot each step (desktop and 375px), and report what passed and failed.
- If the user answers **no**: list every page and every section on that page that must be tested by hand, with the route and the expected behaviour.

## Building UI

- When building or restyling UI, always use `/frontend-design:frontend-design`.
- Design tokens already exist: `src/styles/tokens.css` (Hallmark export, theme "warm ink, peach skin, blush orange", log in `.hallmark/log.json`). Build inside them; do not rotate the theme. Run `/hallmark` only for an area with no tokens yet, and ask first.
- Tailwind 4 utilities + tokens only; no component library. Icons via `astro-icon` with the `tabler` set.
- Every image needs `width` and `height`; every page needs a meta description and one `<h1>`. `build.test.ts` checks both.

## Codebase memory

- Use the `codebase-memory` MCP tools first for any code exploration (`search_graph`, `trace_path`, `get_code_snippet`, `get_architecture`).
- To find a file, symbol, caller, or usage, do not reach for `grep`, `rg`, `find`, or `Glob`. Use `/codebase-memory` instead: `search_graph` for names, `trace_path` for call chains, `search_code` for text patterns.
- Fall back to plain `grep` or `Glob` only for non-code files (configs, `.astro` templates when the index misses them, markdown, `.env.example`) or when the index reports the project is not indexed. Run `index_repository` first in that case.
- After every change that adds, removes, or renames symbols or files, update the index: run `index_repository` (or `detect_changes` followed by re-index) so `/codebase-memory` stays current.
- Never finish a task with a stale index.

## Git and releases

- Commit only when asked. Conventional Commits, one-line subject, no `Co-Authored-By` trailer.
- No scope in parentheses. Put the area name in lowercase as the first word of the subject instead:
  - Wrong: `fix(articles): inject lastmod for the index page`
  - Right: `fix: articles inject lastmod for the index page`
  - Format: `<type>: <area> <description>`. Omit `<area>` when the change is repo-wide.
- There is no release tool and no version bump in this repo. `package.json` `version` stays as is; pushing `main` is the release.
- Never push unless asked. A push to `main` triggers `.github/workflows/deploy.yml`: `bun run verify` then deploy to Cloudflare Pages then a smoke test on `/`, `/resume`, `/certificates`. A failed verify blocks the deploy; the previous build keeps serving.

## Change tracking — `.plan` & `.docs`

Every meaningful update (a "vibe update") leaves two local markdown files so the change history stays trackable:

1. **`.plan/`** — planning BEFORE/DURING the work: goal, approach, files to touch, decisions, trade-offs.
2. **`.docs/`** — what actually CHANGED AFTER the work: files added/modified/removed, behaviour changes, how to test.

File naming for both: `YYYY-MM-DD-HHMM-<short-kebab-title>.md` (24-hour time; get it with `date "+%Y-%m-%d-%H%M"`).

**`.plan/<timestamp>-<title>.md`**
```markdown
# <Title>
**Date:** YYYY-MM-DD HH:MM
**Status:** planning | in-progress | done

## Goal
## Approach
## Files to touch
- path/to/file — what changes
```

**`.docs/<timestamp>-<title>.md`**
```markdown
# <Title>
**Date:** YYYY-MM-DD HH:MM
**Related plan:** .plan/<matching-timestamp>-<title>.md

## What changed
- Added: / Modified: / Removed:

## Notes
Schema changes needed in the admin panel, CSP changes, how to test.
```

### `docs/` vs `.docs/` vs `.plan/`

| Folder | Git | What belongs there |
|---|---|---|
| `docs/` | **git-ignored except `docs/database-schema.md`** (`.gitignore` `docs/*`) | Long-form write-ups, audits (`docs/audit`), task briefs and screenshots (`docs/task`); this repo is public, so candid self-assessments stay local |
| `.docs/` | git-ignored | Per-change "what changed" notes and testing reports |
| `.plan/` | git-ignored | Planning/design notes before/during work |

Anything that does get pushed (code, `README.md`, `docs/database-schema.md`, tests) must never contain credentials, `DATABASE_URL` values, Cloudflare tokens, hostnames/IPs of the database, or dumps of real rows. Test fixtures are generic on purpose.

## Temporary files

Throwaway scripts, screenshots and downloads go to the agent's own scratchpad directory, never into the project source tree and never into the machine's global temp as loose files. Browser-automation projects used for checks stay outside the repo so `package.json` and `bun.lock` are untouched.

## Tech stack (as actually built)

> Verify against `package.json` before assuming a library exists.

**Framework:** Astro 7 (static output, Content Layer, `astro:env` schema, `fonts` config) · TypeScript 6 · `@astrojs/check`.

**Styling:** Tailwind CSS 4 via `@tailwindcss/vite` · tokens in `src/styles/tokens.css` · `astro-icon` + `@iconify-json/tabler` · self-hosted Bricolage Grotesque / Geist / Geist Mono.

**Data:** `postgres` (porsager) with one connection · `zod` 4 · read-only Postgres role · images on Cloudflare R2.

**SEO:** `@astrojs/sitemap` (+ `scripts/sitemap-lastmod.ts`) · `@astrojs/rss` · JSON-LD in `Layout.astro` · canonical and OG in `BaseHead.astro` · `trailingSlash: 'never'`.

**Hosting:** Cloudflare Pages (`wrangler pages deploy dist`) · headers and CSP in `public/_headers` · GitHub Actions on push to `main`, daily at 02:00 UTC, and manual dispatch.

**Package manager:** Bun (never npm/npx).

## Commands

```bash
# Install
bun install --frozen-lockfile
cp .env.example .env            # DATABASE_URL = read-only role

# Run (dev)
astro dev --background          # background dev server (see CLAUDE.md)
astro dev status | logs | stop

# Checks
bun run check                   # astro check (types)
bun run test                    # bun src/lib/schema.test.ts
bun run build                   # astro build + sitemap-lastmod (needs DATABASE_URL)
bun run test:build              # bun src/lib/build.test.ts against dist/
bun run verify                  # all of the above, in order — the CI gate
bun run preview                 # serve dist/ locally
```

## Data conventions

- Query with `select *`, parse with the Zod object for that table, and extend the Zod object (not the query) when a new column is needed. Add the column to the fixture in `schema.test.ts` in the same change.
- Filter with `live(alias)` from `portfolio.ts`; never render a row with `published_at` null or in the future.
- Tech chips come from `techAgg(pivot, fk, alias)` ordered by `sort_order`; do not re-sort in the page.
- Dates are UTC; format with `period()` / `year()` from `schema.ts`.
- Anything user-visible that the database does not model goes in `src/config/site.ts`, not inline in a page.
- A new section (page) is added to `getSections()` so nav, footer and 404 agree, and to `build.test.ts` so it is guarded.

## Testing safety rules

### Scope of testing

Automated testing and fixes focus only on: newly implemented features, the current bug fix, directly affected pages, and dependencies impacted by the change. Do not expand testing to unrelated pages.

### Existing code protection

Do not modify committed files unless the user asked, the file is directly impacted by the feature or fix, or the change is required to resolve a dependency issue caused by the new implementation.

Forbidden without an explicit request: reformatting unrelated files, renaming or moving components, refactoring unrelated modules, changing `site.ts` facts, editing `public/_headers`, editing tests unrelated to the feature or fix.

### Automated testing order

1. `bun run check` and `bun run test`
2. `bun run build` then `bun run test:build`
3. End-to-end in a browser (`/remote-browser` after the user says yes, or a script outside the repo)
4. Regression checks around the impacted pages at desktop and 375px

Never run anything that writes to the database from this repo; the role cannot, and the attempt itself is a smell.

### Testing fix rules

If tests fail, fix only new code, its direct dependencies and feature-related configuration. If a fix needs changes outside the current scope (for example a column in the admin panel): stop, document the issue, add it to the testing report, and ask before proceeding.

### Testing report

After every testing session write `.docs/<timestamp>-laporan-pengujian-<title>.md` in **Bahasa Indonesia** (technical terms may stay in English):

```md
# Laporan Pengujian

## Informasi Pengujian
Tanggal:
Nama Fitur:
Tester:

## Fitur yang Diuji
- Nama fitur

## Skenario Pengujian
| Skenario | Hasil Yang Diharapkan | Hasil Aktual | Status |
|----------|-----------------------|--------------|--------|
| Halaman /articles terbuka | Daftar post tampil | Tampil | ✅ |

## Cakupan Dampak
### File yang Diubah
### Halaman Terdampak
### Area Lama yang Tidak Diubah

## Masalah Ditemukan
## Status Perbaikan
- Selesai | Dalam proses | Membutuhkan investigasi lebih lanjut

## Catatan Tambahan
```

## PR instructions

- Commit messages follow Conventional Commits in the `<type>: <area> <description>` form above.
- Run `bun run verify` before committing; quote the decisive result lines in the handover.
- One concern per pull request; the description lists what changed, how it was tested, and any step needed outside this repo (admin panel migration, Cloudflare secret, CSP origin).
