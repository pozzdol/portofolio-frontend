# CLAUDE.md

@AGENTS.md

Claude Code specifics on top of the shared rules in AGENTS.md — read AGENTS.md first and follow it exactly.

## 30-second orientation

**fikriachmad.dev** is Fikri Achmad's portfolio: projects, résumé, certificates and articles, rendered as static HTML by Astro from PostgreSQL at build time.

- **Stack (real):** Astro 7 + TypeScript 6 + Tailwind 4, static output, **zero JS in the browser** (asserted by `src/lib/build.test.ts`). Data via `postgres` + Zod in `src/lib/`; blog posts are a Content Layer collection loaded from the `posts` table.
- **Writes live elsewhere:** `../admin-panel` (Laravel + Inertia + React) owns every INSERT/UPDATE and every migration. This repo holds a read-only role; never add a write path.
- **Data rules:** `select *` then Zod parse; `published_at is not null and <= now()` is the only live filter; template text in a published row fails the build; images are absolute R2 URLs with `width`/`height`.
- **Chrome facts** (name, bio, links) are in `src/config/site.ts`; `null` renders nothing. Nav tabs are derived in `src/lib/sections.ts`.
- **Deploy:** push to `main` runs `bun run verify` then Cloudflare Pages deploy then a smoke test. Daily rebuild at 02:00 UTC publishes scheduled rows.
- **Docs:** `docs/database-schema.md` is tracked; the rest of `docs/`, `.plan/` and `.docs/` are local.

AGENTS.md covers the persona, tooling (`bun` only), decisions-belong-to-the-user, sub-agents, testing and UI-testing rules, codebase memory, git flow, change tracking, tech stack, commands, data conventions and testing safety rules.

## Development

Start the dev server in background mode:

```
astro dev --background
```

Manage it with `astro dev stop`, `astro dev status`, and `astro dev logs`. `astro build` needs `DATABASE_URL` in `.env` (read-only role); without it the build fails at `astro:env`.

## Every vibe update — quick reminder

1. `.plan/<timestamp>-<title>.md` — goal, approach, files to touch (`date "+%Y-%m-%d-%H%M"`).
2. Implement with sub-agents; test (`bun run verify`, manual/`/remote-browser` checks at desktop and 375px).
3. `.docs/<timestamp>-<title>.md` — what changed, how to test; plus `.docs/<timestamp>-laporan-pengujian-<title>.md` after a testing session.
4. Re-index codebase memory (`index_repository`).
5. Commit only when asked. Never push unless asked; a push to `main` is a deploy.

## Sub-agent models

- Planner: `Agent` with `model: "fable"` (or `subagent_type: "Plan"` with `model: "fable"`).
- Workers: `Agent` with `model: "opus"`, `"sonnet"`, or `"haiku"` by difficulty.
- Workers may call `Agent` again for nested sub-tasks.

## Skills to invoke

- `/codebase-memory` before exploring code; re-index after edits. Find files and symbols with `search_graph` / `search_code`, not `grep` or `Glob`.
- `/frontend-design:frontend-design` for any UI work, inside the existing tokens in `src/styles/tokens.css`; `/hallmark` only for an area with no tokens, and ask first.
- `/remote-browser` for UI testing, only after the user says yes.

## Astro references

Consult before related work: [routing](https://docs.astro.build/en/guides/routing/) · [components](https://docs.astro.build/en/basics/astro-components/) · [content collections](https://docs.astro.build/en/guides/content-collections/) · [styling / Tailwind](https://docs.astro.build/en/guides/styling/) · [i18n](https://docs.astro.build/en/guides/internationalization/).

## Conversation

- Reply to the user in Indonesian. UI strings and code stay English.
- Ask before every decision; never pick a default on behaviour, schema, or UX.
- Package manager is `bun` only. Never `npm`/`npx`.
