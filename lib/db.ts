import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/schema";

export function getDb() {
  const { env } = getCloudflareContext();
  if (!env.DB) throw new Error("Binding D1 DB belum dikonfigurasi.");
  return drizzle(env.DB, { schema });
}

export function getSecret(name: "AUTH_SECRET") {
  const { env } = getCloudflareContext();
  const value = env[name] || process.env[name];
  if (!value) throw new Error(`Secret ${name} belum dikonfigurasi.`);
  return value;
}
