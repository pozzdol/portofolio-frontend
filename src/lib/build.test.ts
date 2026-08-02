/**
 * Assertions against the built HTML, not against source intent.
 *
 * Every check here corresponds to a finding that actually shipped to production
 * on this site: a missing meta description, a stranger's social handle, template
 * text on two of three pages, a heading level skip. Source review missed all of
 * them for months; thirty lines reading `dist/` would have caught them on the
 * first build.
 *
 * Run after `astro build` — `bun run verify` chains both.
 * ponytail: node:assert, no framework. There is nothing here a runner improves.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const pages = [
  "dist/index.html",
  "dist/resume/index.html",
  "dist/certificates/index.html",
  "dist/404.html",
];

const missing = pages.filter((page) => !existsSync(page));
assert.equal(
  missing.length,
  0,
  `build output missing: ${missing.join(", ")} — run \`bun run build\` first`,
);

/**
 * assert.doesNotMatch dumps the entire haystack on failure — 40KB of minified
 * HTML, in which the actual problem is invisible. Report the match and where it
 * is instead.
 */
function refute(html: string, pattern: RegExp, message: string) {
  const found = html.match(pattern);
  if (!found) return;
  const at = found.index ?? 0;
  const context = html.slice(Math.max(0, at - 60), at + 90).replace(/\s+/g, " ");
  assert.fail(`${message} — found "${found[0]}" at offset ${at}: …${context}…`);
}

for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const at = (what: string) => `${page}: ${what}`;

  // ---- head -------------------------------------------------------------
  assert.match(
    html,
    /<meta name="description" content="[^"]{50,300}"/,
    at("meta description missing or too short"),
  );
  assert.match(html, /<link rel="canonical"/, at("canonical link"));
  assert.match(html, /<meta property="og:image"/, at("og:image"));
  assert.match(html, /<meta name="twitter:card"/, at("twitter:card"));
  assert.match(html, /application\/ld\+json/, at("JSON-LD"));
  assert.match(html, /Fikri Achmad/, at("name not present"));
  assert.match(
    html,
    /<meta name="viewport" content="width=device-width, initial-scale=1"/,
    at("viewport initial-scale"),
  );

  // ---- content that must never ship -------------------------------------
  refute(
    html,
    /Example (Role|Company|Certificate)|replace this entry|Issuing Organisation/i,
    at("template placeholder text"),
  );
  refute(html, /imathis/, at("wrong social handle"));
  refute(html, /lorem ipsum/i, at("lorem ipsum"));
  // The config uses `null` for unknown facts precisely so they render as
  // nothing; a literal TODO reaching HTML means something bypassed that.
  refute(html, /\bTODO\b/, at("unfilled TODO reached the page"));

  // ---- structure --------------------------------------------------------
  const h1s = html.match(/<h1[\s>]/g) ?? [];
  assert.equal(h1s.length, 1, at(`expected exactly one <h1>, found ${h1s.length}`));

  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  levels.reduce((prev, cur) => {
    assert.ok(cur <= prev + 1, at(`heading level skip: h${prev} -> h${cur}`));
    return cur;
  }, 0);

  assert.match(html, /class="skip-link"/, at("skip link"));
  assert.match(html, /id="main"[^>]*tabindex="-1"/, at("main skip target"));

  // ---- the property worth defending mechanically ------------------------
  refute(
    html,
    /<script(?![^>]*type="application\/ld\+json")[^>]*>/,
    at("a script tag appeared — this site ships zero JavaScript"),
  );
}

// ---- the nav must not promise an empty page -----------------------------
// A tab leading to "nothing here yet" is a broken promise the reader only
// discovers by clicking. The tab is driven by the database, so this asserts the
// two stay in step in whichever state the build happened to be in.
{
  const certificates = readFileSync("dist/certificates/index.html", "utf8");
  const isEmpty = /No certifications published yet/.test(certificates);
  const linksToCertificates = pages
    .filter((page) => !page.endsWith("certificates/index.html"))
    .filter((page) => /href="\/certificates"/.test(readFileSync(page, "utf8")));

  if (isEmpty) {
    assert.equal(
      linksToCertificates.length,
      0,
      `certificates page is empty but still linked from: ${linksToCertificates.join(", ")}`,
    );
    assert.match(
      certificates,
      /<meta name="robots" content="noindex/,
      "an empty certificates page must not be indexable",
    );
  } else {
    assert.ok(
      linksToCertificates.length > 0,
      "certificates page has content but nothing links to it",
    );
  }
}

// ---- crawl infrastructure -----------------------------------------------
for (const file of ["dist/robots.txt", "dist/sitemap-index.xml", "dist/_headers"]) {
  assert.ok(existsSync(file), `${file} missing from build output`);
}
assert.match(
  readFileSync("dist/robots.txt", "utf8"),
  /User-agent: GPTBot/,
  "robots.txt: AI crawlers are not explicitly allowed",
);

console.log(`build.test.ts: all assertions passed (${pages.length} pages)`);
