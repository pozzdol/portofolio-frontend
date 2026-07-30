import assert from "node:assert/strict";
import * as S from "./schema";

// ponytail: one runnable check, no framework. `bun src/lib/schema.test.ts`.
// Fixtures mirror the rows currently in the admin panel's database, so a schema
// drift in the admin shows up here before it shows up as an empty page.

const tech = [{ slug: "astro", label: "Astro", icon: "tabler:brand-astro" }];

// A project row as `select *` returns it, R2 URL included.
const project = S.Project.parse({
  id: "019fb159-041a-72ca-8be2-b07df0c26a5d",
  slug: "waluh-studio",
  title: "Waluh Studio",
  summary: "The site for my own studio.",
  live_url: "https://waluh.web.id",
  repo_url: null,
  sort_order: 0,
  published_at: new Date(),
  tech,
});
assert.equal(project.title, "Waluh Studio");
assert.equal(project.tech[0].icon, "tabler:brand-astro");

const image = S.Image.parse({
  image_path: "https://cdn.fkriachmd.qzz.io/projects/waluh-studio-Z93TcxiR.webp",
  image_alt: "Waluh Studio homepage",
  image_width: "1444",
  image_height: "537",
});
assert.equal(image?.width, 1444, "numeric strings from the driver must coerce");
assert.equal(image?.height, 537);

// No upload yet, and the width/height columns may not exist at all.
assert.equal(S.Image.parse({ image_path: null }), null);
assert.equal(S.Image.parse({}), null);

// Missing alt must not render the string "null" into the page.
assert.equal(S.Image.parse({ image_path: "/x.webp" })?.alt, "");

// A tech chip with no icon (Zustand) is valid; a missing icon key is not.
assert.doesNotThrow(() => S.Tech.parse({ slug: "z", label: "Zustand", icon: null }));
assert.throws(() => S.Tech.parse({ slug: "z", label: "Zustand" }));

const job = S.Experience.parse({
  slug: "example-role",
  role: "Example Role",
  company: "Example Company",
  company_url: null,
  started_on: "2024-01-01",
  ended_on: null,
  blurb: null,
  highlights: ["First", "Second"],
  tech: [],
});
assert.equal(S.period(job.started_on, job.ended_on), "2024 - Present");
assert.equal(S.period(new Date("2020-03-01"), new Date("2025-06-30")), "2020 - 2025");

const cert = S.Certificate.parse({
  slug: "example-certificate",
  title: "Example Certificate",
  issuer: "Issuing Organisation",
  issuer_url: "https://example.com",
  issued_on: "2026-01-15",
  expires_on: null,
  credential_id: "CERT-0000-0000",
  credential_url: null,
  note: null,
  tech: [],
});
assert.equal(S.year(cert.issued_on), "2026");

// A dropped or renamed column must fail loudly, naming the field.
assert.throws(
  () => S.Project.parse({ slug: "x", title: "X", live_url: null, repo_url: null, tech: [] }),
  /summary/,
);

console.log("schema.test.ts: all assertions passed");
