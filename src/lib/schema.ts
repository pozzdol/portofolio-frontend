import { z } from "zod";

/**
 * Row shapes the admin panel's database returns, and the formatters the pages
 * use. Kept free of any database import so it can be checked on its own —
 * see schema.test.ts.
 *
 * Queries `select *`, so a renamed or dropped column surfaces as a Zod error
 * naming the field rather than as `undefined` rendered into the page.
 */

export const Tech = z.object({
  slug: z.string(),
  label: z.string(),
  icon: z.string().nullable(),
});

/** Absolute R2 URL plus the dimensions that reserve layout space. */
export const Image = z
  .object({
    image_path: z.string().nullable().optional(),
    image_alt: z.string().nullable().optional(),
    image_width: z.coerce.number().nullable().optional(),
    image_height: z.coerce.number().nullable().optional(),
  })
  .transform((row) =>
    row.image_path
      ? {
          src: row.image_path,
          alt: row.image_alt ?? "",
          width: row.image_width ?? null,
          height: row.image_height ?? null,
        }
      : null,
  );

export const Project = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  live_url: z.string().nullable(),
  repo_url: z.string().nullable(),
  tech: z.array(Tech),
});

export const Experience = z.object({
  slug: z.string(),
  role: z.string(),
  company: z.string(),
  company_url: z.string().nullable(),
  started_on: z.coerce.date(),
  ended_on: z.coerce.date().nullable(),
  blurb: z.string().nullable(),
  highlights: z.array(z.string()),
  tech: z.array(Tech),
});

export const Certificate = z.object({
  slug: z.string(),
  title: z.string(),
  issuer: z.string(),
  issuer_url: z.string().nullable(),
  issued_on: z.coerce.date(),
  expires_on: z.coerce.date().nullable(),
  credential_id: z.string().nullable(),
  credential_url: z.string().nullable(),
  note: z.string().nullable(),
  tech: z.array(Tech),
});

export type Tech = z.infer<typeof Tech>;
export type Image = NonNullable<z.infer<typeof Image>>;
export type Project = z.infer<typeof Project> & { image: Image | null };
export type Experience = z.infer<typeof Experience>;
export type Certificate = z.infer<typeof Certificate> & { image: Image | null };

/**
 * "2020 - 2025" · "2024 - Present" · "Mar - May 2025"
 *
 * Years alone are right for multi-year roles and wrong for short ones: a
 * three-month internship rendered "2025 - 2025", which reads like a formatting
 * bug and hides that it was three months. Same-year ranges get months.
 */
export function period(from: Date, to: Date | null): string {
  if (!to) return `${from.getUTCFullYear()} - Present`;

  const month = (d: Date) =>
    d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });

  return from.getUTCFullYear() === to.getUTCFullYear()
    ? `${month(from)} - ${month(to)} ${to.getUTCFullYear()}`
    : `${from.getUTCFullYear()} - ${to.getUTCFullYear()}`;
}

export function year(date: Date): string {
  return String(date.getUTCFullYear());
}
