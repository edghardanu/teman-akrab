import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/schema";

type RuntimeEnv = Record<string, string | undefined>;

function getRuntimeEnv(): RuntimeEnv {
  try {
    return getCloudflareContext().env as unknown as RuntimeEnv;
  } catch {
    return {};
  }
}

export function getDb() {
  const env = getRuntimeEnv();
  const url = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const authToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN belum dikonfigurasi.");
  }

  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export function getSecret(name: "AUTH_SECRET") {
  const env = getRuntimeEnv();
  const value = env[name] || process.env[name];
  if (!value) throw new Error(`Secret ${name} belum dikonfigurasi.`);
  return value;
}
