"use server";
import { and, eq, gt, gte, inArray, ne, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { bookings, customers, otpCodes, workerServices, workers } from "@/lib/schema";
import { clearSession, getCustomer, readToken, setSession, signToken } from "@/lib/auth";
import { bestOffer, computeSlots, getBookableService, getSalonBySlug } from "@/lib/booking";
import { clientIp, generateOtp, hmac, rateLimit, safeEqualHex } from "@/lib/security";
import { sendWhatsAppOtp } from "@/lib/whatsapp";
import { colomboNow, minutesUntil } from "@/lib/time";
import { dateSchema, idSchema, nameSchema, phoneSchema, slugSchema } from "@/lib/validation";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function activeSalon(slug: string) {
  const s = slugSchema.safeParse(slug);
  if (!s.success) return null;
  const salon = await getSalonBySlug(s.data);
  return salon?.active ? salon : null;
}

// ---------------- OTP login ----------------
export async function requestOtp(slug: string, phoneRaw: string): Promise<R<{ devCode?: string }>> {
  const salon = await activeSalon(slug);
  const phone = phoneSchema.safeParse(phoneRaw);
  if (!salon) return bad("Salon not found");
  if (!phone.success) return bad(phone.error.issues[0].message);
  const ip = await clientIp();
  if (!(await rateLimit(`otp:ip:${ip}`, 10, 3600)) || !(await rateLimit(`otp:phone:${salon.id}:${phone.data}`, 3, 600))) {
    return bad("Too many codes requested. Please wait a few minutes.");
  }
  const code = generateOtp();
  await db.delete(otpCodes).where(and(eq(otpCodes.salonId, salon.id), eq(otpCodes.phone, phone.data)));
  await db.insert(otpCodes).values({
    salonId: salon.id, phone: phone.data, codeHash: hmac(`${salon.id}:${phone.data}:${code}`), expiresAt: Date.now() + 5 * 60_000,
  });
  const sent = await sendWhatsAppOtp(phone.data, code, salon.name);
  if (!sent.ok) return bad("Could not send the WhatsApp code right now. Please try again later.");
  return { ok: true, devCode: sent.devCode };
}

export async function verifyOtp(slug: string, phoneRaw: string, codeRaw: string): Promise<R<{ next: "done" | "name"; token?: string }>> {
  const salon = await activeSalon(slug);
  const phone = phoneSchema.safeParse(phoneRaw);
  if (!salon || !phone.success) return bad("Invalid request");
  if (!/^\d{6}$/.test(codeRaw)) return bad("Enter the 6-digit code");
  if (!(await rateLimit(`otpv:ip:${await clientIp()}`, 20, 900))) return bad("Too many attempts. Try again later.");

  const row = await db.select().from(otpCodes)
    .where(and(eq(otpCodes.salonId, salon.id), eq(otpCodes.phone, phone.data), gt(otpCodes.expiresAt, Date.now()))).get();
  if (!row) return bad("Code expired. Request a new one.");
  if (row.attempts >= 5) {
    await db.delete(otpCodes).where(eq(otpCodes.id, row.id));
    return bad("Too many wrong attempts. Request a new code.");
  }
  await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
  if (!safeEqualHex(row.codeHash, hmac(`${salon.id}:${phone.data}:${codeRaw}`))) return bad("Incorrect code");
  await db.delete(otpCodes).where(eq(otpCodes.id, row.id)); // single use

  const existing = await db.select().from(customers).where(and(eq(customers.salonId, salon.id), eq(customers.phone, phone.data))).get();
  if (existing) {
    await setSession("customer", { sub: existing.id, salon: salon.id });
    return { ok: true, next: "done" };
  }
  return { ok: true, next: "name", token: await signToken("reg", { salon: salon.id, phone: phone.data }) };
}

export async function completeRegistration(slug: string, token: string, nameRaw: string): Promise<R> {
  const salon = await activeSalon(slug);
  const p = await readToken(token, "reg");
  const name = nameSchema.safeParse(nameRaw);
  if (!salon || !p || p.salon !== salon.id) return bad("Session expired. Please start again.");
  if (!name.success) return bad("Please enter your name");
  await db.insert(customers).values({ salonId: salon.id, phone: p.phone, name: name.data }).onConflictDoNothing();
  const c = await db.select().from(customers).where(and(eq(customers.salonId, salon.id), eq(customers.phone, p.phone))).get();
  if (!c) return bad("Could not create account");
  await setSession("customer", { sub: c.id, salon: salon.id });
  return { ok: true };
}

export async function customerLogout() {
  await clearSession("customer");
}

// ---------------- Availability ----------------
const slotArgs = z.object({ serviceId: idSchema, workerId: idSchema, date: dateSchema });

async function workerOffersService(salonId: string, workerId: string, serviceId: string) {
  return db.select({ id: workers.id, name: workers.name }).from(workers)
    .innerJoin(workerServices, eq(workerServices.workerId, workers.id))
    .where(and(eq(workers.id, workerId), eq(workers.salonId, salonId), eq(workers.active, true), eq(workerServices.serviceId, serviceId))).get();
}

export async function getSlots(slug: string, input: unknown): Promise<R<{ slots: number[]; price: number; originalPrice: number; offerTitle: string | null }>> {
  const salon = await activeSalon(slug);
  const a = slotArgs.safeParse(input);
  if (!salon || !a.success) return bad("Invalid request");
  if (!(await rateLimit(`slots:${await clientIp()}`, 120, 600))) return bad("Too many requests");
  const service = await getBookableService(salon.id, a.data.serviceId);
  const worker = service && (await workerOffersService(salon.id, a.data.workerId, service.id));
  if (!service || !worker) return bad("Not available");
  const slots = await computeSlots(salon, worker.id, service.durationMin, a.data.date);
  const offer = await bestOffer(salon.id, service.id, service.price, a.data.date);
  return { ok: true, slots, originalPrice: service.price, price: offer?.price ?? service.price, offerTitle: offer?.title ?? null };
}

// ---------------- Bookings ----------------
const bookArgs = slotArgs.extend({
  startMin: z.number().int().min(0).max(1439),
  note: z.string().max(200).transform((s) => s.replace(/[\u0000-\u0008\u000B-\u001F]/g, "").trim()).default(""),
});

const overlaps = async (ex: typeof db, workerId: string, date: string, s: number, e: number, excludeId?: string) =>
  (await ex.select({ s: bookings.startMin, e: bookings.endMin }).from(bookings).where(and(
    eq(bookings.workerId, workerId), eq(bookings.date, date), inArray(bookings.status, ["pending", "confirmed"]),
    excludeId ? ne(bookings.id, excludeId) : undefined,
  ))).some((b) => s < b.e && e > b.s);

export async function createBooking(slug: string, input: unknown): Promise<R<{ id: string; status: string }>> {
  const salon = await activeSalon(slug);
  const a = bookArgs.safeParse(input);
  if (!salon) return bad("Salon not found");
  if (!a.success) return bad("Invalid booking details");
  const customer = await getCustomer(salon.id);
  if (!customer) return bad("Please sign in first");
  if (!(await rateLimit(`book:${customer.id}`, 10, 3600))) return bad("Too many bookings. Try again later.");

  const service = await getBookableService(salon.id, a.data.serviceId);
  const worker = service && (await workerOffersService(salon.id, a.data.workerId, service.id));
  if (!service || !worker) return bad("This service/barber combination is not available");

  const now = colomboNow();
  const [{ n }] = await db.select({ n: count() }).from(bookings).where(and(
    eq(bookings.customerId, customer.id), inArray(bookings.status, ["pending", "confirmed"]), gte(bookings.date, now.date),
  ));
  if (n >= 5) return bad("You already have 5 upcoming appointments. Cancel one to book another.");

  const slots = await computeSlots(salon, worker.id, service.durationMin, a.data.date);
  if (!slots.includes(a.data.startMin)) return bad("Sorry, that time is no longer available");
  const offer = await bestOffer(salon.id, service.id, service.price, a.data.date);
  const id = crypto.randomUUID();
  const status = salon.autoConfirm ? "confirmed" : "pending";
  try {
    await db.transaction(async (tx) => {
      if (await overlaps(tx as unknown as typeof db, worker.id, a.data.date, a.data.startMin, a.data.startMin + service.durationMin)) throw new Error("taken");
      await tx.insert(bookings).values({
        id, salonId: salon.id, customerId: customer.id, workerId: worker.id, serviceId: service.id,
        serviceName: service.name, workerName: worker.name, originalPrice: service.price, price: offer?.price ?? service.price,
        offerTitle: offer?.title ?? null, durationMin: service.durationMin, date: a.data.date,
        startMin: a.data.startMin, endMin: a.data.startMin + service.durationMin, status, note: a.data.note,
      });
    });
  } catch {
    return bad("Sorry, that time was just taken. Please pick another.");
  }
  revalidatePath(`/${salon.slug}/appointments`);
  return { ok: true, id, status };
}

async function ownBooking(salonId: string, customerId: string, bookingId: string) {
  const id = idSchema.safeParse(bookingId);
  if (!id.success) return null;
  // IDOR guard: booking must belong to this salon AND this customer
  return (await db.select().from(bookings).where(and(eq(bookings.id, id.data), eq(bookings.salonId, salonId), eq(bookings.customerId, customerId))).get()) ?? null;
}

export async function cancelBooking(slug: string, bookingId: string): Promise<R> {
  const salon = await activeSalon(slug);
  if (!salon) return bad("Salon not found");
  const customer = await getCustomer(salon.id);
  if (!customer) return bad("Please sign in");
  const b = await ownBooking(salon.id, customer.id, bookingId);
  if (!b || !["pending", "confirmed"].includes(b.status)) return bad("Booking not found");
  if (minutesUntil(b.date, b.startMin) < salon.cancelCutoffHours * 60) {
    return bad(`Bookings can be cancelled up to ${salon.cancelCutoffHours}h before the appointment. Please call the salon.`);
  }
  await db.update(bookings).set({ status: "cancelled", cancelledBy: "customer" }).where(eq(bookings.id, b.id));
  revalidatePath(`/${salon.slug}/appointments`);
  return { ok: true };
}

export async function rescheduleBooking(slug: string, bookingId: string, date: string, startMin: number): Promise<R> {
  const salon = await activeSalon(slug);
  const d = dateSchema.safeParse(date);
  const s = z.number().int().min(0).max(1439).safeParse(startMin);
  if (!salon || !d.success || !s.success) return bad("Invalid request");
  const customer = await getCustomer(salon.id);
  if (!customer) return bad("Please sign in");
  if (!(await rateLimit(`resched:${customer.id}`, 10, 3600))) return bad("Too many changes. Try again later.");
  const b = await ownBooking(salon.id, customer.id, bookingId);
  if (!b || !["pending", "confirmed"].includes(b.status)) return bad("Booking not found");
  if (minutesUntil(b.date, b.startMin) < salon.cancelCutoffHours * 60) {
    return bad(`Bookings can be changed up to ${salon.cancelCutoffHours}h before the appointment. Please call the salon.`);
  }
  const slots = await computeSlots(salon, b.workerId, b.durationMin, d.data, b.id);
  if (!slots.includes(s.data)) return bad("That time is not available");
  const status = salon.autoConfirm ? "confirmed" : "pending";
  try {
    await db.transaction(async (tx) => {
      if (await overlaps(tx as unknown as typeof db, b.workerId, d.data, s.data, s.data + b.durationMin, b.id)) throw new Error("taken");
      await tx.update(bookings).set({ date: d.data, startMin: s.data, endMin: s.data + b.durationMin, status }).where(eq(bookings.id, b.id));
    });
  } catch {
    return bad("That time was just taken. Please pick another.");
  }
  revalidatePath(`/${salon.slug}/appointments`);
  return { ok: true };
}
