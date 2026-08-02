# fikriachmad.dev

Personal portfolio for **Fikri Achmad** — fullstack web developer.

Content lives in PostgreSQL and is edited through an admin panel that runs on a
laptop and is never deployed. This repository is the only reader: the Astro build
connects with a read-only Postgres role, validates every row, and emits static
HTML. Visitors hit a CDN; the database is never in the request path.

**Zero JavaScript is shipped to the browser.** That property is asserted in
`src/lib/build.test.ts` rather than merely intended.

## Architecture

```
Admin panel (laptop)  ──INSERT/UPDATE──▶  PostgreSQL (hosted)
                                                 ▲
                                                 │ SELECT, read-only role,
                                                 │ once per build
                                          Astro build (CI)
                                                 │
                                                 ▼
                                          Static HTML ──▶ Cloudflare Pages

Visitor ─────────────────────────────────▶ R2 (images — the only runtime origin)
```

Three consequences worth stating, because they were the point:

- **The database can go down without taking the site with it.** The last build
  stays served.
- **There is no internet-facing write surface.** The admin panel is not deployed
  anywhere, so there is nothing to attack.
- **A leaked `DATABASE_URL` is equivalent to a public GET endpoint.** The role
  holds `SELECT` and nothing else — the constraint is enforced by Postgres, not
  by convention.

The full reasoning, including the conditions under which a separate API layer
*would* be worth building, is in [docs/database-schema.md](./docs/database-schema.md).

## Running it

```sh
bun install
cp .env.example .env     # point DATABASE_URL at the read-only role
bun run dev
```

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server on `localhost:4321` |
| `bun run build` | Static build to `dist/` |
| `bun run check` | `astro check` — TypeScript across `.astro` files |
| `bun run test` | Schema-layer assertions (`src/lib/schema.test.ts`) |
| `bun run test:build` | Assertions against the built HTML in `dist/` |
| `bun run verify` | check → test → build → test:build. What CI runs. |

## Layout

| Path | Contents |
| --- | --- |
| `src/config/site.ts` | Every fact about the person: title, location, links, availability. Single source for the head tags, sidebar, footer and JSON-LD. `null` means "not known yet" and renders as nothing. |
| `src/lib/portfolio.ts` | Build-time queries. Read-only, `published_at` filtering in SQL, tech aggregated in one pass to avoid N+1. |
| `src/lib/schema.ts` | Zod schemas. `select *` is deliberate and paired with parsing, so a renamed column fails the build naming the field instead of rendering blank text. |
| `src/layouts/Layout.astro` | The whole page shell: head, `Person` + `WebSite` JSON-LD, sidebar, nav, footer. |
| `src/styles/tokens.css` | Portable palette, type stack, motion and radii. Copy this one file to carry the design system elsewhere. |
| `src/assets/fonts/` | Self-hosted woff2, latin subset. No third-party font origin, and the build does not depend on Google being reachable. |
| `src/assets/og-default.svg` | Source for the social card; regeneration steps are in the file header. |

## Deploying

`.github/workflows/deploy.yml` runs `bun run verify`, deploys `dist/` to
Cloudflare Pages, and smoke-tests all three routes for a 200.

It also runs nightly. Rows carry a `published_at` that can be set in the future,
and without a scheduled rebuild a scheduled post would never appear. For
immediate publishing, have the admin panel call the Pages deploy hook after a
write.

Required secrets: `DATABASE_URL`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`.

## Licence

MIT — see [LICENSE](./LICENSE).
