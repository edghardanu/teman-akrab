import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";

const username = (process.env.ADMIN_SEED_USERNAME ?? "").trim().toLowerCase();
const password = process.env.ADMIN_SEED_PASSWORD ?? "";
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!username || password.length < 10) {
  throw new Error("Isi ADMIN_SEED_USERNAME dan ADMIN_SEED_PASSWORD (minimal 10 karakter) di .env.local.");
}
if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN harus diisi di .env.local.");
}

const client = createClient({ url, authToken });
try {
  const existing = await client.execute("SELECT id FROM admins LIMIT 1");
  if (existing.rows.length) {
    console.log("Akun admin sudah ada; tidak ada perubahan.");
  } else {
    const iterations = 180_000;
    const salt = randomBytes(16);
    const digest = pbkdf2Sync(password, salt, iterations, 32, "sha256");
    const hash = `pbkdf2$${iterations}$${salt.toString("base64url")}$${digest.toString("base64url")}`;
    await client.execute({
      sql: "INSERT INTO admins (username, password_hash, must_change_password) VALUES (?, ?, 1)",
      args: [username, hash],
    });
    console.log("Akun admin awal dibuat di Turso.");
  }
} finally {
  await client.close();
}
