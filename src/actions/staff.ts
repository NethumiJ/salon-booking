"use server";
import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookings, offers, services, staffUsers, workerLeaves, workerServices, workers } from "@/lib/schema";
import { clearSession, requireOwner, requireStaff, setSession } from "@/lib/auth";
import { clientIp, hashPassword, rateLimit, verifyPassword } from "@/lib/security";
import { saveProfile } from "@/lib/profile";
import { computeSlots } from "@/lib/booking";
import {
  dateSchema, done, fail, firstError, idSchema, nameSchema, offerSchema, passwordSchema, serviceSchema,
  usernameSchema, workerSchema, type State,
} from "@/lib/validation";

const refresh = () => revalidatePath("/dashboard", "layout");

export async function staffLogin(_: State, fd: FormData): Promise<State> {
  const username = String(fd.get("username") ?? "").trim().toLowerCase().slice(0, 64);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  const ip = await clientIp();
  if (!(await rateLimit(`staff-login:ip:${ip}`, 15, 900)) || !(await rateLimit(`staff-login:user:${username}`, 8, 900))) {
    return fail("Too many attempts. Try again in a few minutes.");
  }
  const user = await db.select().from(staffUsers).where(eq(staffUsers.username, username)).get();
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok || !user.active) return fail("Invalid username or password");
  await setSession("staff", { sub: user.id });
  redirect("/dashboard");
}

export async function staffLogout() {
  await clearSession("staff");
  redirect("/login");
}

export async function changeOwnPassword(_: State, fd: FormData): Promise<State> {
  const { user } = await requireStaff();
  const current = String(fd.get("current") ?? "");
  const pw = passwordSchema.safeParse(fd.get("password"));
  if (!pw.success) return fail(firstError(pw.error));
  if (!(await verifyPassword(current, user.passwordHash))) return fail("Current password is incorrect");
  await db.update(staffUsers).set({ passwordHash: await hashPassword(pw.data) }).where(eq(staffUsers.id, user.id));
  return done("Password changed");
}

// ---------- Services ----------
export async function saveService(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const parsed = serviceSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(firstError(parsed.error));
  const workerIds = z.array(idSchema).safeParse(fd.getAll("workerIds"));
  if (!workerIds.success) return fail("Invalid worker selection");

  let serviceId = String(fd.get("id") ?? "");
  if (serviceId) {
    if (!idSchema.safeParse(serviceId).success) return fail("Invalid service");
    const res = await db.update(services).set(parsed.data).where(and(eq(services.id, serviceId), eq(services.salonId, salon.id))).returning({ id: services.id });
    if (!res.length) return fail("Service not found");
  } else {
    serviceId = crypto.randomUUID();
    await db.insert(services).values({ id: serviceId, salonId: salon.id, ...parsed.data });
  }
  // Only workers that belong to THIS salon can be assigned (IDOR guard)
  const valid = workerIds.data.length
    ? await db.select({ id: workers.id }).from(workers).where(and(eq(workers.salonId, salon.id), inArray(workers.id, workerIds.data)))
    : [];
  await db.delete(workerServices).where(eq(workerServices.serviceId, serviceId));
  if (valid.length) await db.insert(workerServices).values(valid.map((w) => ({ workerId: w.id, serviceId })));
  refresh();
  return done(fd.get("id") ? "Service updated" : "Service added");
}

export async function toggleService(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return fail("Invalid service");
  const s = await db.select().from(services).where(and(eq(services.id, id.data), eq(services.salonId, salon.id))).get();
  if (!s) return fail("Not found");
  await db.update(services).set({ active: !s.active }).where(eq(services.id, s.id));
  refresh();
  return done(s.active ? "Hidden from customers" : "Visible to customers");
}

// ---------- Team ----------
export async function saveWorker(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const parsed = workerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(firstError(parsed.error));
  const id = String(fd.get("id") ?? "");
  if (id) {
    if (!idSchema.safeParse(id).success) return fail("Invalid worker");
    const res = await db.update(workers).set(parsed.data).where(and(eq(workers.id, id), eq(workers.salonId, salon.id))).returning({ id: workers.id });
    if (!res.length) return fail("Worker not found");
  } else {
    await db.insert(workers).values({ salonId: salon.id, ...parsed.data });
  }
  refresh();
  return done(id ? "Updated" : "Worker added");
}

export async function toggleWorker(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return fail("Invalid worker");
  const w = await db.select().from(workers).where(and(eq(workers.id, id.data), eq(workers.salonId, salon.id))).get();
  if (!w) return fail("Not found");
  await db.update(workers).set({ active: !w.active }).where(eq(workers.id, w.id));
  refresh();
  return done(w.active ? "Worker hidden" : "Worker active");
}

export async function addLeave(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const workerId = idSchema.safeParse(fd.get("workerId"));
  const from = dateSchema.safeParse(fd.get("from"));
  const to = dateSchema.safeParse(fd.get("to") || fd.get("from"));
  if (!workerId.success || !from.success || !to.success) return fail("Pick a valid date");
  if (to.data < from.data) return fail("End date is before start date");
  const w = await db.select().from(workers).where(and(eq(workers.id, workerId.data), eq(workers.salonId, salon.id))).get();
  if (!w) return fail("Worker not found");
  const reason = String(fd.get("reason") ?? "").slice(0, 100).replace(/[\u0000-\u001F]/g, "");

  const dates: string[] = [];
  for (let d = new Date(from.data + "T00:00:00Z"), i = 0; d.toISOString().slice(0, 10) <= to.data && i < 60; d.setUTCDate(d.getUTCDate() + 1), i++) {
    dates.push(d.toISOString().slice(0, 10));
  }
  await db.insert(workerLeaves).values(dates.map((date) => ({ workerId: w.id, salonId: salon.id, date, reason }))).onConflictDoNothing();
  const clash = await db.select({ id: bookings.id }).from(bookings).where(and(
    eq(bookings.workerId, w.id), inArray(bookings.date, dates), inArray(bookings.status, ["pending", "confirmed"]),
  ));
  refresh();
  return done(clash.length ? `Leave saved. ${clash.length} existing booking(s) fall on these dates — please reschedule or cancel them.` : "Leave saved");
}

export async function removeLeave(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return fail("Invalid");
  await db.delete(workerLeaves).where(and(eq(workerLeaves.id, id.data), eq(workerLeaves.salonId, salon.id)));
  refresh();
  return done("Removed");
}

// ---------- Offers ----------
export async function saveOffer(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const parsed = offerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(firstError(parsed.error));
  if (parsed.data.endsOn < parsed.data.startsOn) return fail("End date is before start date");
  let serviceId: string | null = null;
  const sid = String(fd.get("serviceId") ?? "");
  if (sid) {
    if (!idSchema.safeParse(sid).success) return fail("Invalid service");
    const s = await db.select({ id: services.id }).from(services).where(and(eq(services.id, sid), eq(services.salonId, salon.id))).get();
    if (!s) return fail("Service not found");
    serviceId = s.id;
  }
  await db.insert(offers).values({ salonId: salon.id, ...parsed.data, serviceId });
  refresh();
  return done("Offer created");
}

export async function toggleOffer(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return fail("Invalid");
  const o = await db.select().from(offers).where(and(eq(offers.id, id.data), eq(offers.salonId, salon.id))).get();
  if (!o) return fail("Not found");
  if (fd.get("delete") === "1") await db.delete(offers).where(eq(offers.id, o.id));
  else await db.update(offers).set({ active: !o.active }).where(eq(offers.id, o.id));
  refresh();
  return done("Updated");
}

// ---------- Settings & accounts (owner only) ----------
export async function updateProfile(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireOwner();
  return saveProfile(salon.id, fd);
}

export async function createManager(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireOwner();
  const username = usernameSchema.safeParse(fd.get("username"));
  const pw = passwordSchema.safeParse(fd.get("password"));
  const name = nameSchema.safeParse(fd.get("displayName"));
  if (!username.success) return fail(firstError(username.error));
  if (!pw.success) return fail(firstError(pw.error));
  if (!name.success) return fail("Name is required");
  try {
    await db.insert(staffUsers).values({ salonId: salon.id, username: username.data, displayName: name.data, role: "manager", passwordHash: await hashPassword(pw.data) });
  } catch {
    return fail("Username already taken");
  }
  refresh();
  return done("Account created");
}

export async function manageStaffAccount(_: State, fd: FormData): Promise<State> {
  const { salon, user: me } = await requireOwner();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return fail("Invalid");
  const target = await db.select().from(staffUsers).where(and(eq(staffUsers.id, id.data), eq(staffUsers.salonId, salon.id))).get();
  if (!target) return fail("Not found");
  if (target.role === "owner" || target.id === me.id) return fail("Owner accounts are managed by the platform admin");
  if (fd.get("password")) {
    const pw = passwordSchema.safeParse(fd.get("password"));
    if (!pw.success) return fail(firstError(pw.error));
    await db.update(staffUsers).set({ passwordHash: await hashPassword(pw.data) }).where(eq(staffUsers.id, target.id));
    return done("Password reset");
  }
  await db.update(staffUsers).set({ active: !target.active }).where(eq(staffUsers.id, target.id));
  refresh();
  return done(target.active ? "Disabled" : "Enabled");
}

// ---------- Bookings ----------
export async function setBookingStatus(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const id = idSchema.safeParse(fd.get("id"));
  const action = z.enum(["confirm", "cancel", "complete", "no_show"]).safeParse(fd.get("action"));
  if (!id.success || !action.success) return fail("Invalid request");
  const b = await db.select().from(bookings).where(and(eq(bookings.id, id.data), eq(bookings.salonId, salon.id))).get();
  if (!b) return fail("Booking not found");
  const open = b.status === "pending" || b.status === "confirmed";
  if (action.data === "confirm" && b.status !== "pending") return fail("Only pending bookings can be accepted");
  if (action.data !== "confirm" && !open) return fail("Booking is already closed");
  const next = { confirm: "confirmed", cancel: "cancelled", complete: "completed", no_show: "no_show" } as const;
  await db.update(bookings).set({ status: next[action.data], ...(action.data === "cancel" ? { cancelledBy: "salon" as const } : {}) })
    .where(eq(bookings.id, b.id));
  refresh();
  return done("Updated");
}

export async function rescheduleByStaff(_: State, fd: FormData): Promise<State> {
  const { salon } = await requireStaff();
  const id = idSchema.safeParse(fd.get("id"));
  const date = dateSchema.safeParse(fd.get("date"));
  const start = z.coerce.number().int().min(0).max(1439).safeParse(fd.get("startMin"));
  if (!id.success || !date.success || !start.success) return fail("Pick a date and time");
  const b = await db.select().from(bookings).where(and(eq(bookings.id, id.data), eq(bookings.salonId, salon.id))).get();
  if (!b || !["pending", "confirmed"].includes(b.status)) return fail("Booking cannot be rescheduled");
  const slots = await computeSlots(salon, b.workerId, b.durationMin, date.data, b.id);
  if (!slots.includes(start.data)) return fail("That time is not available");
  try {
    await db.update(bookings).set({ date: date.data, startMin: start.data, endMin: start.data + b.durationMin, status: "confirmed" }).where(eq(bookings.id, b.id));
  } catch {
    return fail("That time was just taken");
  }
  refresh();
  return done("Rescheduled");
}

export async function staffSlots(bookingId: string, date: string): Promise<{ slots: number[] } | { error: string }> {
  const { salon } = await requireStaff();
  const id = idSchema.safeParse(bookingId);
  const d = dateSchema.safeParse(date);
  if (!id.success || !d.success) return { error: "Invalid request" };
  const b = await db.select().from(bookings).where(and(eq(bookings.id, id.data), eq(bookings.salonId, salon.id))).get();
  if (!b) return { error: "Booking not found" };
  return { slots: await computeSlots(salon, b.workerId, b.durationMin, d.data, b.id) };
}
