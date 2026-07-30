import { DATABASE_URL } from "astro:env/server";
import postgres from "postgres";
import * as S from "./schema";

/**
 * Build-time data layer.
 *
 * The admin panel runs on a laptop and owns every write; this file only reads,
 * and only while `astro build` runs on the server. Nothing here reaches the
 * browser — the output is plain HTML. The connection uses a read-only role, so
 * "frontend hanya GET" is enforced by the database, not by convention.
 */

const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 });

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

export async function getProjects(): Promise<S.Project[]> {
  const rows = await sql`
    select p.*, ${techAgg("project_tech", "project_id", "p")}
    from projects p
    where ${live("p")}
    order by p.sort_order, p.id
  `;
  return rows.map((row) => ({
    ...S.Project.parse(row),
    image: S.Image.parse(row),
  }));
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
  return rows.map((row) => S.Experience.parse(row));
}

export async function getCertificates(): Promise<S.Certificate[]> {
  const rows = await sql`
    select c.*, ${techAgg("certificate_tech", "certificate_id", "c")}
    from certificates c
    where ${live("c")}
    order by c.issued_on desc, c.id desc
  `;
  return rows.map((row) => ({
    ...S.Certificate.parse(row),
    image: S.Image.parse(row),
  }));
}
