import { getCollection } from "astro:content";
import { getCertificates } from "./portfolio";

/**
 * The site's sections, as they exist *for this build*.
 *
 * Navigation is a promise about what is behind it, so a section only appears
 * once there is something behind it. Publishing a certificate in the admin
 * panel makes the tab appear on the next build; nothing in this repository has
 * to change.
 *
 * The nav, the footer and the 404 page all read this, because three lists that
 * are supposed to agree will not stay in agreement by hand — the build test
 * caught exactly that on the 404 page.
 */
export async function getSections(): Promise<
  Array<{ href: string; label: string }>
> {
  const hasCertificates = (await getCertificates()).length > 0;
  const hasPosts = (await getCollection("posts")).length > 0;

  return [
    { href: "/", label: "Projects" },
    { href: "/resume", label: "Resumé" },
    ...(hasCertificates
      ? [{ href: "/certificates", label: "Certificates" }]
      : []),
    // Same rule as certificates: the tab appears on the next build after the
    // first post is published, and nothing in this repository has to change.
    ...(hasPosts ? [{ href: "/articles", label: "Articles" }] : []),
  ];
}
