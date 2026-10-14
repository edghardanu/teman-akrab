import "server-only";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { admins, loginAttempts, rateLimits } from "@/lib/schema";
import { getDb, getSecret } from "@/lib/db";
import { sql } from "drizzle-orm";

const encoder = new TextEncoder();
const COOKIE = "teman-akrab-session";
const ITERATIONS = 180_000;

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function hmacKey() {
  return crypto.subtle.importKey("raw", encoder.encode(getSecret("AUTH_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function digestIp(ip: string) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(ip))));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256));
  return `pbkdf2$${ITERATIONS}$${b64url(salt)}$${b64url(bits)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationText, saltText, digestText] = stored.split("$");
  if (algorithm !== "pbkdf2" || !iterationText || !saltText || !digestText) return false;
  const iterations = Number(iterationText);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const candidate = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64url(saltText), iterations }, key, 256));
  const expected = fromB64url(digestText);
  if (candidate.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < candidate.length; index++) difference |= candidate[index] ^ expected[index];
  return difference === 0;
}

export async function createSession(adminId: number, username: string) {
  const header = b64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64url(encoder.encode(JSON.stringify({ sub: adminId, username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 })));
  const body = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body)));
  return `${body}.${b64url(signature)}`;
}

export async function readSession(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]))) as { sub?: number; username?: string; exp?: number };
    if (!payload.sub || !payload.username || !payload.exp || payload.exp < Date.now() / 1000) return null;
    return { id: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure: boolean) {
  return `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 12}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
export function clearSessionCookie(secure: boolean) {
  return `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export async function requireAdmin(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  const session = await readSession(cookie?.slice(COOKIE.length + 1));
  if (!session) return null;
  const [admin] = await getDb().select({ id: admins.id, username: admins.username, mustChangePassword: admins.mustChangePassword }).from(admins).where(eq(admins.id, session.id)).limit(1);
  return admin ?? null;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function loginAdmin(username: string, password: string, ip: string) {
  const db = getDb();
  const ipHash = await digestIp(ip);
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString().replace("T", " ").slice(0, 19);
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, cutoff));
  const attempts = await db.select({ value: count() }).from(loginAttempts).where(and(eq(loginAttempts.ipHash, ipHash), gte(loginAttempts.createdAt, cutoff)));
  if ((attempts[0]?.value ?? 0) >= 5) return { ok: false as const, locked: true };
  const [admin] = await db.select().from(admins).where(eq(admins.username, username)).limit(1);
  const valid = admin ? await verifyPassword(password, admin.passwordHash) : false;
  if (!admin || !valid) {
    await db.insert(loginAttempts).values({ ipHash });
    return { ok: false as const, locked: false };
  }
  await db.delete(loginAttempts).where(eq(loginAttempts.ipHash, ipHash));
  return { ok: true as const, admin };
}

export async function consumeRateLimit(key: string, ip: string, limit: number, windowMs: number) {
  const db = getDb();
  const ipHash = await digestIp(ip);
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, Date.now() - 24 * 60 * 60_000));
  await db.insert(rateLimits).values({ key: `${key}:${ipHash}`, windowStart, count: 1 }).onConflictDoUpdate({
    target: [rateLimits.key, rateLimits.windowStart],
    set: { count: sql`${rateLimits.count} + 1` },
  });
  const [row] = await db.select({ count: rateLimits.count }).from(rateLimits).where(and(eq(rateLimits.key, `${key}:${ipHash}`), eq(rateLimits.windowStart, windowStart))).limit(1);
  return (row?.count ?? limit + 1) <= limit;
}

export { COOKIE as SESSION_COOKIE };
