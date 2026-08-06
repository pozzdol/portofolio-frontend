import { DATABASE_URL } from "astro:env/server";
import postgres from "postgres";

/**
 * One connection for the whole build, shared by the portfolio queries and the
 * blog content loader.
 *
 * `max: 1` on purpose: a static build issues a handful of queries in sequence,
 * so a pool would open sockets it never uses — and the read-only role has a
 * connection budget on a small server.
 *
 * The role is read-only (see .env.example). "The frontend only reads" is
 * enforced by the database, not by convention: INSERT, UPDATE and DELETE all
 * return `permission denied` on this credential.
 */
export const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 });
