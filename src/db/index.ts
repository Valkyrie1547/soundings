import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * The HTTP driver. Each query is one fetch. This is the correct shape for
 * serverless route handlers that do short request and response work.
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
