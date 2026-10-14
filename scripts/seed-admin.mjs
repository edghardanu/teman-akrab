import { pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const varsPath = resolve(root, ".dev.vars");
const vars = new Map();
if (existsSync(varsPath)) {
  for (const line of readFileSync(varsPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    vars.set(trimmed.slice(0, separator).trim(), value);
  }
}

const username = (process.env.ADMIN_SEED_USERNAME ?? vars.get("ADMIN_SEED_USERNAME") ?? "").trim().toLowerCase();
const password = process.env.ADMIN_SEED_PASSWORD ?? vars.get("ADMIN_SEED_PASSWORD") ?? "";
const target = process.argv.includes("--remote") ? "--remote" : "--local";
if (!username || password.length < 10) {
  console.error("Set ADMIN_SEED_USERNAME and ADMIN_SEED_PASSWORD (minimum 10 characters) in .dev.vars or the process environment.");
  process.exit(1);
}

const iterations = 180_000;
const salt = randomBytes(16);
const digest = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const hash = `pbkdf2$${iterations}$${salt.toString("base64url")}$${digest.toString("base64url")}`;
const escapeSql = (value) => value.replace(/'/g, "''");
const statement = `INSERT INTO admins (username, password_hash, must_change_password) SELECT '${escapeSql(username)}', '${hash}', 1 WHERE NOT EXISTS (SELECT 1 FROM admins);`;
const wrangler = resolve(root, "node_modules", "wrangler", "bin", "wrangler.js");
if (!existsSync(wrangler)) {
  console.error("Wrangler is not installed. Run npm install first.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [wrangler, "d1", "execute", "absensi-pengajian", target, "--command", statement], { cwd: root, stdio: "inherit", env: process.env });
if (result.error) {
  console.error(`Unable to start Wrangler: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
