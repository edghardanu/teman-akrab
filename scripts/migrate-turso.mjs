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
  "event_villages",
  "groups",
  "attendances",
  "event_groups",
  "event_group_members",
  "login_attempts",
  "rate_limits",
];

function normalizePersonName(name) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

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
      if (table === "event_villages") {
        const existing = await source.execute({ sql: "SELECT name FROM sqlite_master WHERE type = ? AND name = ?", args: ["table", table] });
        if (!existing.rows.length) continue;
      }
      const result = await source.execute(`SELECT * FROM "${table}"`);
      if (!result.rows.length) continue;

      const columns = [...result.columns];
      if (table === "attendances" && !columns.includes("normalized_full_name")) {
        columns.push("normalized_full_name");
      }
      const sql = `INSERT OR IGNORE INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
      const statements = result.rows.map((row) => ({
        sql,
        args: columns.map((column) => column === "normalized_full_name" ? normalizePersonName(String(row.full_name)) : row[column]),
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

  await target.execute(`INSERT OR IGNORE INTO event_villages (event_id, village_id)
    SELECT events.id, villages.id
    FROM events CROSS JOIN villages
    WHERE villages.is_active = 1
      AND NOT EXISTS (SELECT 1 FROM event_villages WHERE event_villages.event_id = events.id)`);

  const attendanceNames = await target.execute("SELECT id, full_name FROM attendances");
  const normalizedNames = attendanceNames.rows.map((row) => ({
    sql: "UPDATE attendances SET normalized_full_name = ? WHERE id = ?",
    args: [normalizePersonName(String(row.full_name)), row.id],
  }));
  for (let offset = 0; offset < normalizedNames.length; offset += 250) {
    await target.batch(normalizedNames.slice(offset, offset + 250), "write");
  }
  await target.execute(`CREATE UNIQUE INDEX IF NOT EXISTS attendances_no_duplicates
    ON attendances(event_id, normalized_full_name, village_id, group_id)`);

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
