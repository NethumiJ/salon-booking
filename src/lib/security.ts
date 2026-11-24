import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import { rateLimits } from "./schema";

export function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return s;
}

const scryptAsync = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((res, rej) =>
    scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))),
  );

/** Format: s1.<salt>.<hash> (no "$" so it is safe in .env files) */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt);
  return `s1.${salt.toString("base64url")}.${key.toString("base64url")}`;
}

let dummy: Promise<string> | null = null;

/** Always does the same amount of work, even for unknown users (prevents timing-based user enumeration). */
export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  dummy ??= hashPassword("dummy-password-for-timing");
  const useDummy = !stored || !stored.startsWith("s1.");
  const [, saltB64, hashB64] = (useDummy ? await dummy : stored!).split(".");
  const expected = Buffer.from(hashB64 ?? "", "base64url");
  const actual = await scryptAsync(pw, Buffer.from(saltB64 ?? "", "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual) && !useDummy;
}

export const hmac = (data: string) => createHmac("sha256", secret()).update(data).digest("hex");

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** DB-backed fixed-window rate limiter (works on serverless, where memory is not shared). Returns true if allowed. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const k = createHash("sha256").update(key).digest("hex");
  const now = Date.now();
  const reset = now + windowSec * 1000;
  await db.run(sql`INSERT INTO rate_limits (key, count, reset_at) VALUES (${k}, 1, ${reset})
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN reset_at <= ${now} THEN 1 ELSE count + 1 END,
      reset_at = CASE WHEN reset_at <= ${now} THEN ${reset} ELSE reset_at END`);
  const row = await db.select().from(rateLimits).where(eq(rateLimits.key, k)).get();
  if (Math.random() < 0.02) await db.delete(rateLimits).where(sql`reset_at < ${now}`); // housekeeping
  return (row?.count ?? 1) <= limit;
}
