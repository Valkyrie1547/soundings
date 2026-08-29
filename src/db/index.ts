import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * HTTP driver: each query is one fetch, which is the right shape for
 * serverless route handlers doing short request/response work.
 */
function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

let cached: ReturnType<typeof connect> | undefined;

export function db() {
  cached ??= connect();
  return cached;
}
