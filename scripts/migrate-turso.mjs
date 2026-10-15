import { createClient } from "@libsql/client";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationsPath = resolve(root, "drizzle");
const sourcePath = resolve(root, "absensi-pengajian.sqlite");
const tableNames = [
  "admins",
  "events",
  "villages",
  "groups",
  "attendances",
  "event_groups",
  "event_group_members",
  "login_attempts",
  "rate_limits",
];

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN harus diisi di .env.local.");
}

const target = createClient({ url, authToken });
let source;

try {
  await target.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const migrationFiles = readdirSync(migrationsPath)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort();
  for (const name of migrationFiles) {
    const applied = await target.execute({ sql: "SELECT name FROM schema_migrations WHERE name = ?", args: [name] });
    if (applied.rows.length) continue;

    const migration = readFileSync(resolve(migrationsPath, name), "utf8");
    for (const rawStatement of migration.split(";")) {
      const statement = rawStatement.trim();
      if (!statement || /^PRAGMA\b/i.test(statement)) continue;
      await target.execute(statement);
    }
    await target.execute({ sql: "INSERT INTO schema_migrations (name) VALUES (?)", args: [name] });
    console.log(`Migrasi ${name} diterapkan.`);
  }

  if (existsSync(sourcePath)) {
    source = createClient({ url: `file:${sourcePath.replaceAll("\\", "/")}` });
    for (const table of tableNames) {
      const result = await source.execute(`SELECT * FROM "${table}"`);
      if (!result.rows.length) continue;

      const columns = result.columns;
      const sql = `INSERT OR IGNORE INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
      const statements = result.rows.map((row) => ({
        sql,
        args: columns.map((column) => row[column]),
      }));

      for (let offset = 0; offset < statements.length; offset += 250) {
        await target.batch(statements.slice(offset, offset + 250), "write");
      }
      console.log(`${table}: ${result.rows.length} baris dari SQLite lokal disalin.`);
    }
  } else {
    const seed = readFileSync(resolve(root, "scripts/seed-villages.sql"), "utf8");
    for (const statement of seed.split(";")) {
      if (statement.trim()) await target.execute(statement);
    }
    console.log("Database SQLite lokal tidak ditemukan; data desa awal dimasukkan.");
  }

  const counts = [];
  for (const table of tableNames) {
    const result = await target.execute(`SELECT COUNT(*) AS total FROM "${table}"`);
    counts.push(`${table}=${result.rows[0].total}`);
  }
  console.log(`Jumlah baris di Turso: ${counts.join(", ")}`);
} finally {
  await source?.close();
  await target.close();
}
