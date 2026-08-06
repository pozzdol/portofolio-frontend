/**
 * Inject `<lastmod>` into the generated sitemap.
 *
 * Why a post-build step and not `sitemap({ serialize })`:
 *
 * `astro.config.mjs` is evaluated before the build, where neither `astro:content`
 * nor `astro:env` exists — so the config cannot reach the posts or the database
 * credential. Writing the dates to a file from the loader and importing that file
 * in the config *looks* cleaner but is stale by one build, because the config is
 * read before the loader runs. A step that runs after `astro build` reads the same
 * database the build just read and is correct on every build, including the first
 * one on a fresh clone.
 *
 * `lastmod` is the primary input to Google's recrawl scheduling. It matters more
 * here than on most sites because this content lives in Postgres and is edited in
 * place: without it, a corrected article waits for the crawler's own cadence,
 * which on a low-authority domain is weeks.
 *
 * Chained into `bun run build`, not only `verify`, so a CI job that calls the
 * build directly still gets it.
 *
 * ponytail: string surgery on generated XML, deliberately — the file is one line,
 * the URLs are known, and a real XML parser for two dozen `<loc>` elements is a
 * dependency with nothing to show for it. Bail loudly rather than half-write.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import postgres from "postgres";

const DIST = "dist";

const url = readFileSync(".env", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
if (!url) {
  console.error("sitemap-lastmod: DATABASE_URL not found in .env — skipping");
  process.exit(0);
}

const sql = postgres(url.trim().replace(/^["']|["']$/g, ""), {
  max: 1,
  idle_timeout: 5,
});

/** Path (no trailing slash) -> ISO date. Only rows the build actually rendered. */
const lastmod = new Map<string, string>();

try {
  const posts = await sql<{ slug: string; updated_at: Date }[]>`
    select slug, updated_at
    from posts
    where published_at is not null and published_at <= now()
  `;
  for (const post of posts) {
    lastmod.set(`/articles/${post.slug}`, post.updated_at.toISOString());
  }

  // The index is as fresh as its newest post; with no posts it has no date to
  // claim, so it gets none rather than a fabricated one.
  const newest = posts
    .map((post) => post.updated_at.getTime())
    .sort((a, b) => b - a)[0];
  if (newest !== undefined) {
    lastmod.set("/articles", new Date(newest).toISOString());
  }
} finally {
  await sql.end();
}

if (lastmod.size === 0) {
  console.log("sitemap-lastmod: nothing published — sitemap left unchanged");
  process.exit(0);
}

const sitemaps = existsSync(DIST)
  ? readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f))
  : [];

if (sitemaps.length === 0) {
  console.error(
    `sitemap-lastmod: no sitemap-N.xml in ${DIST}/ — run \`astro build\` first`,
  );
  process.exit(1);
}

let injected = 0;

for (const file of sitemaps) {
  const path = `${DIST}/${file}`;
  let xml = readFileSync(path, "utf8");

  for (const [pathname, iso] of lastmod) {
    // Match the exact <loc> for this path, tolerating a trailing slash, and only
    // when it has no <lastmod> already (re-running must be a no-op).
    const loc = new RegExp(
      `(<loc>[^<]*${pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?</loc>)(?!<lastmod>)`,
    );
    if (loc.test(xml)) {
      xml = xml.replace(loc, `$1<lastmod>${iso}</lastmod>`);
      injected += 1;
    }
  }

  writeFileSync(path, xml);
}

// A silent zero here means the paths stopped matching the sitemap — a route
// rename would otherwise quietly drop every date.
if (injected === 0) {
  console.error(
    `sitemap-lastmod: matched 0 of ${lastmod.size} URL(s) — did the article route change?`,
  );
  process.exit(1);
}

console.log(
  `sitemap-lastmod: ${injected} lastmod injected across ${sitemaps.length} sitemap file(s)`,
);
