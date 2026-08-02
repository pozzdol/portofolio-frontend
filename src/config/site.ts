/**
 * Every fact about the person this site is about, in one place.
 *
 * The head tags, sidebar, footer, JSON-LD, robots.txt and print stylesheet all
 * read from here, so filling in a detail is one edit instead of six.
 *
 * `null` means "not known yet". Nothing renders a null — a missing city simply
 * does not appear rather than printing a placeholder. That is deliberate: the
 * failure mode this site was audited for was shipping template text, so an
 * unfilled field must be invisible, never visible-and-wrong.
 *
 * Content that changes often (projects, roles, certificates) lives in
 * PostgreSQL and is owned by the admin panel. This file is only the handful of
 * facts the *chrome* needs, which the database does not model.
 */

export const site = {
  /** No trailing slash. Astro's `site` config mirrors this. */
  url: "https://fikriachmad.dev",

  // ---- identity ---------------------------------------------------------
  name: "Fikri Achmad",
  givenName: "Fikri",
  familyName: "Achmad",
  /**
   * Two titles, deliberately. `jobTitle` is what recruiters and search engines
   * look for; `employmentTitle` is what the employer calls the role. Neither is
   * a lie, and showing both is what stops the searchable one reading as spin.
   */
  jobTitle: "Fullstack Web Developer",
  employmentTitle: "Business Integration Staff",

  /** Current employer — a primary entity disambiguator for search and for LLMs. */
  employer: "PT Tata Metal Lestari",
  employerUrl: "https://tatametal.com",

  // ---- where ------------------------------------------------------------
  /** TODO: your city — a hard filter in every recruiter and client workflow. */
  city: null as string | null,
  country: "Indonesia",
  /** ISO 3166-1 alpha-2, for schema.org PostalAddress. */
  countryCode: "ID",
  timezone: "WIB (UTC+7)",

  /** TODO: first year of professional work. Drives the "N years" line. */
  careerStartYear: null as number | null,

  // ---- reaching you -----------------------------------------------------
  email: "developer@fikriachmad.dev",
  /** TODO: international format, digits only — e.g. "6281234567890". */
  whatsapp: null as string | null,
  /** Shown under the buttons. Answers the real hesitation, not the stated one. */
  responseTime: "I reply within one working day",

  // ---- elsewhere (drives rel="me" and schema.org sameAs) ----------------
  github: "https://github.com/pozzdol",
  linkedin: "https://www.linkedin.com/in/fikriachmadanshori/",

  // ---- assets -----------------------------------------------------------
  /** 1200x630, used by every OG and Twitter card. */
  ogImage: "/og-default.png",
  /** TODO: swap for a real photograph; the favicon is a favicon. */
  avatar: "/favicon.png",
  /** TODO: set once a CV exists — the download button hides itself until then. */
  cv: null as string | null,

  /**
   * TODO: keep current or set back to null. A stale "available from March" read
   * in September proves the site is unmaintained, which costs more than saying
   * nothing.
   */
  availability: null as string | null,

  /**
   * The sidebar bio and the JSON-LD `description` both read this. Names the
   * stack in prose because chips are not indexed as skills, and names the
   * infrastructure because owning both the application and the deployment is
   * the actual differentiator.
   */
  bio: "I build internal web applications end to end — Laravel with Inertia and React on PostgreSQL — and I own the deployment path: Ubuntu, Nginx, Docker, Cloudflare, and CI/CD. I use Python and Flask when a service is better kept separate, and IoT when the work touches hardware. Outside of work, I regularly build personal projects to sharpen my skills and experiment with new technologies.",

  /**
   * schema.org `knowsAbout`. Every entry here is something in the shipped work,
   * not something read about. Each one invites a question in an interview.
   */
  knowsAbout: [
    "Fullstack Web Development",
    "Laravel",
    "PHP",
    "Inertia.js",
    "React",
    "TypeScript",
    "Python",
    "Flask",
    "PostgreSQL",
    "MySQL",
    "REST API design",
    "OAuth 2.0",
    "Role-based access control",
    "Docker",
    "Nginx",
    "Ubuntu",
    "Linux server administration",
    "CI/CD",
    "Cloudflare",
    "IoT",
    "Astro",
    "Tailwind CSS",
    "Game development",
  ],
} as const;

/** Years of professional experience, or null while `careerStartYear` is unset. */
export const years = site.careerStartYear
  ? new Date().getUTCFullYear() - site.careerStartYear
  : null;

/** "Bandung, Indonesia · 6 years" — with each half dropped if unknown. */
export const locationLine = [
  [site.city, site.country].filter(Boolean).join(", "),
  years && `${years} years`,
]
  .filter(Boolean)
  .join(" · ");

/** "Business Integration Staff at PT Tata Metal Lestari" — the honesty half of the headline. */
export const employmentLine = `${site.employmentTitle} at ${site.employer}`;

/**
 * Profiles that assert the same identity. Order is stable for diffing.
 *
 * Personal projects deliberately do not appear here. `sameAs` is an identity
 * claim, not a link list — every entry is a profile a reader can use to confirm
 * this is the same person, and side projects come and go faster than that.
 */
export const sameAs = [site.github, site.linkedin];

/** `wa.me` deep link, or null while the number is unset. */
export const whatsappUrl = site.whatsapp
  ? `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(
      `Hi ${site.givenName}, I saw your portfolio`,
    )}`
  : null;

export const mailto = (subject: string) =>
  `mailto:${site.email}?subject=${encodeURIComponent(subject)}`;
