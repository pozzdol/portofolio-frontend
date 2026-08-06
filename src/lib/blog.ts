import type { Loader } from "astro/loaders";
import { z } from "zod";
import { sql } from "./db";

/**
 * Content Layer loader for posts held in the admin panel's Postgres.
 *
 * There are no `.md` files. `renderMarkdown()` on the loader context runs the
 * *same* Markdown pipeline as Astro's built-in `glob()` loader, so a body stored
 * in a database column gets identical treatment to one stored in a file —
 * syntax highlighting, heading ids, smart quotes. Files would only have bought
 * git history for the prose, at the cost of keeping two writable copies in sync.
 *
 * Raw `<figure>` blocks in the body survive untouched. That is the whole reason
 * the admin panel inserts HTML rather than `![alt](url)`: markdown image syntax
 * emits an `<img>` with no width/height, and every such image shifts the page as
 * it loads.
 */

export const postSchema = z.object({
  slug: z.string(),
  /**
   * BCP-47, drives `<html lang>`, `og:locale`, JSON-LD `inLanguage` and the feed.
   * Required here on purpose: the loader must always resolve one, so forgetting
   * to is a build error rather than a page that quietly claims English.
   */
  lang: z.enum(["id", "en"]),
  title: z.string(),
  excerpt: z.string().nullable(),
  image: z
    .object({
      src: z.string(),
      alt: z.string(),
      width: z.number().nullable(),
      height: z.number().nullable(),
    })
    .nullable(),
  publishedAt: z.date(),
  updatedAt: z.date(),
  tech: z.array(
    z.object({
      slug: z.string(),
      label: z.string(),
      icon: z.string().nullable(),
    }),
  ),
  /** Rounded up, floor of 1. Shown on the card and under the title. */
  readingMinutes: z.number(),
  /**
   * Actual body words. Never reconstruct this from `readingMinutes` — that is
   * lossy in one direction only, so the result is always the rounded-up ceiling
   * (a 20-word post reports 200), and `wordCount` in JSON-LD is a claim the page
   * itself disproves.
   */
  wordCount: z.number(),
});

/**
 * Body words, for reading time and for the JSON-LD `wordCount`.
 *
 * Code fences go first and whole: a 40-line sample is not prose, and counting it
 * overstates the reading time of exactly the technical posts this blog is for.
 * Markdown syntax goes next, so `**bold**` and `## Heading` do not each add a
 * token. `filter(Boolean)` because `"".split(/\s+/)` is `[""]`, i.e. length 1 —
 * an empty body must count 0, not 1.
 */
function countWords(body: string): number {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`\[\]()!|-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function postsLoader(): Loader {
  return {
    name: "posts-postgres",
    schema: postSchema,

    async load({ store, renderMarkdown, logger }) {
      const rows = await sql<
        {
          slug: string;
          /** `not null default 'id'`, `check (lang in ('id','en'))` — always set. */
          lang: "id" | "en";
          title: string;
          excerpt: string | null;
          body: string;
          image_path: string | null;
          image_alt: string | null;
          image_width: number | null;
          image_height: number | null;
          published_at: Date;
          updated_at: Date;
          tech: { slug: string; label: string; icon: string | null }[];
        }[]
      >`
        select p.*,
               coalesce((
                 select json_agg(json_build_object('slug', t.slug, 'label', t.label, 'icon', t.icon)
                                 order by pt.sort_order)
                 from post_tech pt
                 join tech t on t.id = pt.tech_id
                 where pt.post_id = p.id
               ), '[]'::json) as tech
        from posts p
        where p.published_at is not null and p.published_at <= now()
        order by p.published_at desc
      `;

      store.clear();

      for (const row of rows) {
        const words = countWords(row.body);

        store.set({
          id: row.slug,
          data: {
            slug: row.slug,
            lang: row.lang,
            title: row.title,
            excerpt: row.excerpt,
            image: row.image_path
              ? {
                  src: row.image_path,
                  alt: row.image_alt ?? "",
                  width: row.image_width ?? null,
                  height: row.image_height ?? null,
                }
              : null,
            publishedAt: row.published_at,
            updatedAt: row.updated_at,
            tech: row.tech,
            readingMinutes: Math.max(1, Math.ceil(words / 200)),
            wordCount: words,
          },
          // Assigning `rendered` is what makes render() and <Content /> work.
          rendered: await renderMarkdown(row.body),
        });
      }

      logger.info(`${rows.length} published post(s) loaded from Postgres`);
    },
  };
}
