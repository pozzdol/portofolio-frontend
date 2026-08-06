import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";
import { site } from "../config/site";

/**
 * Full-text feed, not excerpt-only: the point of a feed is to be readable in the
 * reader. `content` carries the rendered HTML, so the `<figure>` blocks with
 * their width and height survive into the feed too.
 *
 * Language is per item via Dublin Core. RSS 2.0 has exactly one channel
 * `<language>` and no per-item equivalent, and this archive is bilingual — so the
 * channel gets whichever language most posts are in, and `dc:language` carries the
 * truth for each one.
 */
export async function GET(context: APIContext) {
  const posts = await getCollection("posts");

  const indonesian = posts.filter((post) => post.data.lang === "id").length;
  const channelLang = indonesian * 2 > posts.length ? "id" : "en";

  return rss({
    title: `${site.name} — articles`,
    description:
      "Notes on building and running web applications — Laravel, Astro, PostgreSQL, and the decisions behind them.",
    site: context.site!,
    trailingSlash: false,
    xmlns: { dc: "http://purl.org/dc/elements/1.1/" },
    items: posts.map((post) => ({
      title: post.data.title,
      link: `/articles/${post.data.slug}`,
      pubDate: post.data.publishedAt,
      ...(post.data.excerpt && { description: post.data.excerpt }),
      content: post.rendered?.html,
      categories: post.data.tech.map((t) => t.label),
      author: `${site.email} (${site.name})`,
      customData: `<dc:language>${post.data.lang}</dc:language>`,
    })),
    customData: `<language>${channelLang}</language>`,
  });
}
