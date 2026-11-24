import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { customers, salons, staffUsers } from "./schema";
import { secret } from "./security";

type Kind = "admin" | "staff" | "customer" | "reg";
const prod = process.env.NODE_ENV === "production";
// __Host- prefix: Secure, Path=/, no Domain → cannot be overwritten by sibling subdomains
const COOKIE: Record<"admin" | "staff" | "customer", string> = {
  admin: prod ? "__Host-sa" : "sa",
  staff: prod ? "__Host-ss" : "ss",
  customer: prod ? "__Host-sc" : "sc",
};
const TTL = { admin: 2 * 3600, staff: 8 * 3600, customer: 30 * 86400, reg: 600 };

const key = () => new TextEncoder().encode(secret());

export async function signToken(kind: Kind, claims: Record<string, string>): Promise<string> {
  return new SignJWT({ ...claims, k: kind })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setIssuer("salon").setExpirationTime(`${TTL[kind]}s`)
    .sign(key());
}

export async function readToken(token: string | undefined, kind: Kind): Promise<(JWTPayload & Record<string, string>) | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer: "salon" });
    return payload.k === kind ? (payload as JWTPayload & Record<string, string>) : null;
  } catch {
    return null;
  }
}

export async function setSession(kind: "admin" | "staff" | "customer", claims: Record<string, string>) {
  (await cookies()).set(COOKIE[kind], await signToken(kind, claims), {
    httpOnly: true, secure: prod, sameSite: kind === "customer" ? "lax" : "strict", path: "/", maxAge: TTL[kind],
  });
}

export async function clearSession(kind: "admin" | "staff" | "customer") {
  (await cookies()).delete(COOKIE[kind]);
}

// ---- Platform admin (single account configured via env) ----
export const getAdmin = cache(async () => {
  const p = await readToken((await cookies()).get(COOKIE.admin)?.value, "admin");
  return p && p.sub && p.sub === process.env.ADMIN_USERNAME ? { username: p.sub } : null;
});
export async function requireAdmin() {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  return a;
}

// ---- Salon staff (owner/manager). Re-validated against the DB on every request. ----
export const getStaff = cache(async () => {
  const p = await readToken((await cookies()).get(COOKIE.staff)?.value, "staff");
  if (!p?.sub) return null;
  const row = await db
    .select({ user: staffUsers, salon: salons })
    .from(staffUsers)
    .innerJoin(salons, eq(salons.id, staffUsers.salonId))
    .where(and(eq(staffUsers.id, p.sub), eq(staffUsers.active, true), eq(salons.active, true)))
    .get();
  return row ?? null;
});
export async function requireStaff() {
  const s = await getStaff();
  if (!s) redirect("/login");
  return s;
}
export async function requireOwner() {
  const s = await requireStaff();
  if (s.user.role !== "owner") redirect("/dashboard");
  return s;
}

// ---- Customers (bound to exactly one salon) ----
export async function getCustomer(salonId: string) {
  const p = await readToken((await cookies()).get(COOKIE.customer)?.value, "customer");
  if (!p?.sub || p.salon !== salonId) return null;
  return (await db.select().from(customers).where(and(eq(customers.id, p.sub), eq(customers.salonId, salonId))).get()) ?? null;
}
