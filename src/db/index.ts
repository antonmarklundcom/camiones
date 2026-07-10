import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

/**
 * Single pool for the whole app. Hostinger MySQL allows a limited number of
 * concurrent connections per user — keep the pool small; Next.js server
 * components share it across requests.
 */
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 8,
  timezone: "Z",
});

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
