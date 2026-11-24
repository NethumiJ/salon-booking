"use server";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { salons, staffUsers } from "@/lib/schema";
import { clearSession, requireAdmin, setSession } from "@/lib/auth";
import { clientIp, hashPassword, rateLimit, verifyPassword } from "@/lib/security";
import { saveProfile } from "@/lib/profile";
import {
  done, fail, firstError, idSchema, nameSchema, parseHoursForm, passwordSchema, readLogo,
  salonProfileSchema, slugSchema, usernameSchema, type State,
} from "@/lib/validation";

export async function adminLogin(_: State, fd: FormData): Promise<State> {
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = await clientIp();
  if (!(await rateLimit(`admin-login:ip:${ip}`, 10, 900)) || !(await rateLimit("admin-login:global", 60, 900))) {
    return fail("Too many attempts. Try again in a few minutes.");
  }
  const okUser = !!process.env.ADMIN_USERNAME && username === process.env.ADMIN_USERNAME.toLowerCase();
  const okPass = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (!okUser || !okPass) return fail("Invalid username or password");
  await setSession("admin", { sub: process.env.ADMIN_USERNAME! });
  redirect("/admin");
}

export async function adminLogout() {
  await clearSession("admin");
  redirect("/admin/login");
}

const isUnique = (e: unknown) => /UNIQUE|constraint/i.test(String((e as Error)?.message ?? "") + String((e as { cause?: Error })?.cause?.message ?? ""));

export async function createSalon(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const slug = slugSchema.safeParse(fd.get("slug"));
  if (!slug.success) return fail(firstError(slug.error));
  const profile = salonProfileSchema.safeParse(Object.fromEntries(fd));
  if (!profile.success) return fail(firstError(profile.error));
  const username = usernameSchema.safeParse(fd.get("ownerUsername"));
  if (!username.success) return fail("Owner username: " + firstError(username.error));
  const password = passwordSchema.safeParse(fd.get("ownerPassword"));
  if (!password.success) return fail("Owner password: " + firstError(password.error));
  const ownerName = nameSchema.safeParse(fd.get("ownerName"));
  if (!ownerName.success) return fail("Owner name is required");
  const hours = parseHoursForm(fd);
  if (typeof hours === "string") return fail(hours);
  const logo = await readLogo(fd.get("logo"));
  if (typeof logo === "string") return fail(logo);

  const salonId = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(salons).values({
        id: salonId, slug: slug.data, ...profile.data, hours: JSON.stringify(hours),
        autoConfirm: fd.get("autoConfirm") === "on",
        ...(logo ? { logoData: logo.data, logoMime: logo.mime, logoVersion: 1 } : {}),
      }),
      db.insert(staffUsers).values({
        salonId, username: username.data, displayName: ownerName.data, role: "owner",
        passwordHash: await hashPassword(password.data),
      }),
    ]);
  } catch (e) {
    return fail(isUnique(e) ? "That URL name or owner username is already taken" : "Could not create salon");
  }
  revalidatePath("/admin");
  redirect(`/admin/salons/${salonId}`);
}

export async function updateSalonAdmin(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return fail("Invalid salon");
  const slug = slugSchema.safeParse(fd.get("slug"));
  if (!slug.success) return fail(firstError(slug.error));
  try {
    await db.update(salons).set({ slug: slug.data, active: fd.get("active") === "on" }).where(eq(salons.id, id.data));
  } catch (e) {
    return fail(isUnique(e) ? "That URL name is already taken" : "Could not update");
  }
  return saveProfile(id.data, fd);
}

export async function resetStaffPasswordAdmin(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const id = idSchema.safeParse(fd.get("userId"));
  const pw = passwordSchema.safeParse(fd.get("password"));
  if (!id.success) return fail("Invalid user");
  if (!pw.success) return fail(firstError(pw.error));
  await db.update(staffUsers).set({ passwordHash: await hashPassword(pw.data) }).where(eq(staffUsers.id, id.data));
  return done("Password updated");
}

export async function createStaffAdmin(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const salonId = idSchema.safeParse(fd.get("salonId"));
  const username = usernameSchema.safeParse(fd.get("username"));
  const pw = passwordSchema.safeParse(fd.get("password"));
  const name = nameSchema.safeParse(fd.get("displayName"));
  if (!salonId.success || !username.success || !pw.success || !name.success) return fail("Check username, name and password (10+ chars, letters & numbers)");
  const role = fd.get("role") === "owner" ? "owner" : "manager";
  try {
    await db.insert(staffUsers).values({ salonId: salonId.data, username: username.data, displayName: name.data, role, passwordHash: await hashPassword(pw.data) });
  } catch (e) {
    return fail(isUnique(e) ? "Username already taken" : "Could not create account");
  }
  revalidatePath(`/admin/salons/${salonId.data}`);
  return done("Account created");
}

export async function toggleStaffAdmin(_: State, fd: FormData): Promise<State> {
  await requireAdmin();
  const id = idSchema.safeParse(fd.get("userId"));
  if (!id.success) return fail("Invalid user");
  const u = await db.select().from(staffUsers).where(eq(staffUsers.id, id.data)).get();
  if (!u) return fail("Not found");
  await db.update(staffUsers).set({ active: !u.active }).where(and(eq(staffUsers.id, u.id)));
  revalidatePath(`/admin/salons/${u.salonId}`);
  return done(u.active ? "Disabled" : "Enabled");
}

