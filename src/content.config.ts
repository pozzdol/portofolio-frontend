import { defineCollection } from "astro:content";
import { postsLoader, postSchema } from "./lib/blog";

/**
 * One collection, loaded from the admin panel's Postgres rather than from files.
 *
 * The schema is declared HERE and not only on the loader: Astro's type generator
 * reads `defineCollection`, so a schema attached to the loader alone validates at
 * runtime but leaves `post.data` typed as `never` in every page that uses it.
 */
export const collections = {
  posts: defineCollection({
    loader: postsLoader(),
    schema: postSchema,
  }),
};
