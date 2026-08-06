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
import { existsSync, readFileSync, readdirSync } from "node:fs";

const staticPages = [
  "dist/index.html",
  "dist/resume/index.html",
  "dist/certificates/index.html",
  "dist/404.html",
];

/**
 * Discovered, not listed.
 *
 * `/articles` shipped with a placeholder title and an Indonesian post declared as
 * English because the hand-maintained array above did not include it, and this
 * file reported "all assertions passed" the whole time. A route added without a
 * matching line here is a route with no guard, so the posts are enumerated from
 * the build output instead.
 */
const articlePages = existsSync("dist/articles")
  ? [
      "dist/articles/index.html",
      ...readdirSync("dist/articles", { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `dist/articles/${entry.name}/index.html`),
    ].filter(existsSync)
  : [];

const posts = articlePages.filter(
  (page) => page !== "dist/articles/index.html",
);

const pages = [...staticPages, ...articlePages];

const missing = staticPages.filter((page) => !existsSync(page));
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
    at("template placeholder text (en)"),
  );
  /**
   * Placeholder text has now shipped twice on this site: once in English from the
   * page templates, once in Indonesian from the admin panel while its edit form
   * was being tested. The English patterns above could not see the second one, so
   * both languages are checked.
   */
  refute(
    html,
    /judul diubah|lewat form edit|coba[- ]coba|isi dummy|contoh (judul|artikel)|test(ing)?[- ](post|artikel|judul)|inline[- ]test/i,
    at("development placeholder text (id)"),
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
  // The reading layout names its landmark `article`; both are valid skip targets.
  assert.match(
    html,
    /id="(main|article)"[^>]*tabindex="-1"/,
    at("skip target"),
  );

  // ---- the property worth defending mechanically ------------------------
  refute(
    html,
    /<script(?![^>]*type="application\/ld\+json")[^>]*>/,
    at("a script tag appeared — this site ships zero JavaScript"),
  );
}

// ---- the nav must not promise an empty page -----------------------------
// A tab leading to "nothing here yet" is a broken promise the reader only
// discovers by clicking. Both sections are gated the same way in `sections.ts`,
// so both are checked here — certificates was, articles was not.
for (const section of [
  {
    path: "dist/certificates/index.html",
    href: "/certificates",
    empty: /No certifications published yet/,
  },
  {
    path: "dist/articles/index.html",
    href: "/articles",
    empty: /Nothing published yet/,
  },
]) {
  if (!existsSync(section.path)) continue;

  const html = readFileSync(section.path, "utf8");
  const isEmpty = section.empty.test(html);
  const linkedFrom = pages
    .filter((page) => page !== section.path)
    .filter((page) =>
      new RegExp(`href="${section.href}"`).test(readFileSync(page, "utf8")),
    );

  if (isEmpty) {
    assert.equal(
      linkedFrom.length,
      0,
      `${section.href} is empty but still linked from: ${linkedFrom.join(", ")}`,
    );
    assert.match(
      html,
      /<meta name="robots" content="noindex/,
      `an empty ${section.href} must not be indexable`,
    );
  } else {
    assert.ok(
      linkedFrom.length > 0,
      `${section.href} has content but nothing links to it`,
    );
  }
}

// ---- declared language must match the prose -----------------------------
/**
 * The bug this exists for: an Indonesian article served as `<html lang="en">`.
 * That is offered to English queries where it is useless, forfeits the Indonesian
 * SERP entirely, and is read aloud by an English speech engine.
 *
 * Chrome regions carry their own `lang`, so they are stripped before counting —
 * otherwise the English nav would drag an Indonesian page's ratio down.
 */
const ID_MARKERS =
  /\b(yang|dengan|untuk|tidak|adalah|karena|kenapa|dari|pada|akan|bisa|sudah|ini|itu|di|ke|saya|juga|tapi|atau|lebih)\b/gi;

for (const page of posts) {
  const html = readFileSync(page, "utf8");
  const declared = html.match(/<html lang="([^"]+)"/)?.[1];
  assert.ok(declared, `${page}: no lang on <html>`);

  const prose = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<([a-z]+)[^>]*\blang="en"[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const words = prose.split(/\s+/).filter(Boolean).length;
  const hits = (prose.match(ID_MARKERS) ?? []).length;
  const ratio = words > 0 ? hits / words : 0;

  if (ratio > 0.06) {
    assert.equal(
      declared,
      "id",
      `${page}: prose reads Indonesian (${hits}/${words} marker words) but ` +
        `<html lang="${declared}"> — the Bahasa radio on this post is set to English`,
    );
  }

  // og:locale is derived from the same value; a drift here means the two
  // code paths disagreed, which no single-page inspection would reveal.
  const locale = html.match(/property="og:locale" content="([^"]+)"/)?.[1];
  assert.equal(
    locale,
    declared === "id" ? "id_ID" : "en_US",
    `${page}: og:locale ${locale} contradicts <html lang="${declared}">`,
  );
}

// ---- article metadata ----------------------------------------------------
for (const page of posts) {
  const html = readFileSync(page, "utf8");
  const at = (what: string) => `${page}: ${what}`;

  assert.match(html, /property="og:type" content="article"/, at("og:type"));
  assert.match(
    html,
    /property="article:published_time" content="\d{4}-\d{2}-\d{2}T/,
    at("article:published_time — the unfurl is undated without it"),
  );
  assert.match(html, /property="article:author"/, at("article:author"));
  assert.match(html, /"@type":"BlogPosting"/, at("BlogPosting JSON-LD"));
  assert.match(html, /"@type":"BreadcrumbList"/, at("BreadcrumbList JSON-LD"));
  assert.match(html, /rel="author"/, at("visible byline"));

  /**
   * `wordCount` used to be `readingMinutes * 200`, so a 20-word post claimed 200.
   * A structured-data figure the page itself disproves is the kind of mismatch
   * that draws a manual action, so it is checked against the rendered prose.
   */
  const claimed = Number(html.match(/"wordCount":(\d+)/)?.[1] ?? -1);
  assert.ok(claimed >= 0, at("wordCount missing from JSON-LD"));

  const body = html.match(
    /<div class="prose[^"]*">([\s\S]*?)<\/div>\s*(?:<nav|<div class="mx-auto)/,
  );
  assert.ok(body, at("prose body not found — did the article markup change?"));
  const actual = body[1]
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  // Generous bound: the rendered figure excludes code and markdown syntax, and
  // headings and captions differ. A 10x gap is the bug, not a 30% one.
  assert.ok(
    claimed > 0 && actual / claimed > 0.4 && actual / claimed < 2.5,
    at(
      `wordCount ${claimed} does not match the ~${actual} words in the body — ` +
        `it must be the real count, never derived from readingMinutes`,
    ),
  );

  /**
   * Length is an editorial call, not a build failure — the author owns the
   * content. It is still worth saying out loud, because a thin first entry
   * teaches Google that `/articles/*` is a low-value URL pattern.
   */
  if (actual < 300) {
    console.warn(
      `  warning  ${page}: article body is ~${actual} words. Under ~300 reads as ` +
        `thin content; consider finishing it or unpublishing it.`,
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

// ---- the feed --------------------------------------------------------------
if (posts.length > 0) {
  const feed = readFileSync("dist/rss.xml", "utf8");
  assert.match(feed, /<language>/, "rss.xml: no channel language");
  assert.equal(
    (feed.match(/<dc:language>/g) ?? []).length,
    posts.length,
    "rss.xml: every item needs a dc:language — RSS 2.0 has no per-item language",
  );
  assert.match(
    feed,
    /xmlns:dc="http:\/\/purl\.org\/dc\/elements\/1\.1\/"/,
    "rss.xml: dc:language used without declaring the Dublin Core namespace",
  );
}

console.log(
  `build.test.ts: all assertions passed (${pages.length} pages, ${posts.length} post(s))`,
);
