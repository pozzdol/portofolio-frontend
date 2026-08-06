import { sql } from "./db";
import * as S from "./schema";

/**
 * Build-time data layer.
 *
 * The admin panel runs on a laptop and owns every write; this file only reads,
 * and only while `astro build` runs on the server. Nothing here reaches the
 * browser — the output is plain HTML. The connection uses a read-only role, so
 * "frontend hanya GET" is enforced by the database, not by convention.
 */


export { period, year } from "./schema";
export type { Tech, Image, Project, Experience, Certificate } from "./schema";

/**
 * Ordered tech chips for one entity as a JSON array. `sort_order` on the pivot
 * is what the admin panel's checkbox order writes.
 */
const techAgg = (pivot: string, fk: string, alias: string) => sql`
  coalesce((
    select json_agg(json_build_object('slug', t.slug, 'label', t.label, 'icon', t.icon)
                    order by pt.sort_order)
    from ${sql(pivot)} pt
    join tech t on t.id = pt.tech_id
    where pt.${sql(fk)} = ${sql(alias)}.id
  ), '[]'::json) as tech
`;

/** Draft and scheduled rows must never leave the database. */
const live = (alias: string) => sql`
  ${sql(alias)}.published_at is not null and ${sql(alias)}.published_at <= now()
`;

/**
 * Template debris is the same class of bug the Zod parsing exists to catch:
 * structurally valid, silently wrong output. A renamed column already fails the
 * build by name; a published row still reading "Example Role — replace this
 * entry" should too, because shipping it is worse than shipping an empty page.
 */
const PLACEHOLDER =
  /example (role|company|certificate)|issuing organisation|replace this entry|lorem ipsum|CERT-0000/i;

function assertNoPlaceholders<T>(rows: T[], where: string): T[] {
  const bad = rows.filter((row) => PLACEHOLDER.test(JSON.stringify(row)));
  if (bad.length > 0) {
    throw new Error(
      `${where}: ${bad.length} published row(s) still contain template text. ` +
        `Write real content, or set published_at = null, before building.`,
    );
  }
  return rows;
}

export async function getProjects(): Promise<S.Project[]> {
  const rows = await sql`
    select p.*, ${techAgg("project_tech", "project_id", "p")}
    from projects p
    where ${live("p")}
    order by p.sort_order, p.id
  `;
  return assertNoPlaceholders(
    rows.map((row) => ({
      ...S.Project.parse(row),
      image: S.Image.parse(row),
    })),
    "getProjects",
  );
}

export async function getExperiences(): Promise<S.Experience[]> {
  const rows = await sql`
    select e.*,
           coalesce((
             select json_agg(h.body order by h.sort_order)
             from experience_highlights h
             where h.experience_id = e.id
           ), '[]'::json) as highlights,
           ${techAgg("experience_tech", "experience_id", "e")}
    from experiences e
    where ${live("e")}
    order by e.started_on desc, e.id desc
  `;
  return assertNoPlaceholders(
    rows.map((row) => S.Experience.parse(row)),
    "getExperiences",
  );
}

/**
 * Cached for the life of the build. The nav asks "are there any certificates?"
 * on every page to decide whether the tab exists at all, and the answer cannot
 * change midway through a build — so this is one query, not one per page.
 */
let certificates: Promise<S.Certificate[]> | null = null;

export function getCertificates(): Promise<S.Certificate[]> {
  return (certificates ??= loadCertificates());
}

async function loadCertificates(): Promise<S.Certificate[]> {
  const rows = await sql`
    select c.*, ${techAgg("certificate_tech", "certificate_id", "c")}
    from certificates c
    where ${live("c")}
    order by c.issued_on desc, c.id desc
  `;
  return assertNoPlaceholders(
    rows.map((row) => ({
      ...S.Certificate.parse(row),
      image: S.Image.parse(row),
    })),
    "getCertificates",
  );
}
