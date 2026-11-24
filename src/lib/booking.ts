import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { cache } from "react";
import { db } from "./db";
import { bookings, offers, salons, services, workerLeaves, workerServices, workers, type Salon } from "./schema";
import { addDays, colomboNow, parseHours, weekday } from "./time";

export const getSalonBySlug = cache(async (slug: string) =>
  (await db.select().from(salons).where(eq(salons.slug, slug)).get()) ?? null);

const MIN_LEAD_MIN = 30;

/** Valid start times (minutes) for a worker/service on a date. Single source of truth for both listing and booking. */
export async function computeSlots(
  salon: Salon, workerId: string, durationMin: number, date: string, excludeBookingId?: string,
): Promise<number[]> {
  const now = colomboNow();
  if (date < now.date || date > addDays(now.date, salon.maxAdvanceDays)) return [];

  const day = parseHours(salon.hours)[weekday(date)];
  if (!day || day.closed) return [];

  const onLeave = await db.select({ id: workerLeaves.id }).from(workerLeaves)
    .where(and(eq(workerLeaves.workerId, workerId), eq(workerLeaves.date, date))).get();
  if (onLeave) return [];

  const taken = (await db.select({ id: bookings.id, s: bookings.startMin, e: bookings.endMin }).from(bookings)
    .where(and(eq(bookings.workerId, workerId), eq(bookings.date, date), inArray(bookings.status, ["pending", "confirmed"]))))
    .filter((b) => b.id !== excludeBookingId);

  const out: number[] = [];
  const earliest = date === now.date ? now.minutes + MIN_LEAD_MIN : 0;
  for (let t = day.open; t + durationMin <= day.close; t += salon.slotStep) {
    if (t < earliest) continue;
    if (taken.some((b) => t < b.e && t + durationMin > b.s)) continue;
    out.push(t);
  }
  return out;
}

/** Best currently valid offer for a service (percentage discount). */
export async function bestOffer(salonId: string, serviceId: string, price: number, date: string) {
  const list = await db.select().from(offers).where(and(eq(offers.salonId, salonId), eq(offers.active, true)));
  const valid = list.filter((o) => o.startsOn <= date && o.endsOn >= date && (o.serviceId === null || o.serviceId === serviceId));
  if (!valid.length) return null;
  const best = valid.reduce((a, b) => (b.discountPercent > a.discountPercent ? b : a));
  return { title: best.title, price: Math.round(price * (100 - best.discountPercent) / 100) };
}

/** Active workers of a salon that perform a service. */
export async function workersForService(salonId: string, serviceId: string) {
  return db.select({ id: workers.id, name: workers.name, bio: workers.bio }).from(workers)
    .innerJoin(workerServices, eq(workerServices.workerId, workers.id))
    .where(and(eq(workers.salonId, salonId), eq(workers.active, true), eq(workerServices.serviceId, serviceId)));
}

export async function getBookableService(salonId: string, serviceId: string) {
  return (await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.salonId, salonId), eq(services.active, true))).get()) ?? null;
}

export async function otherActiveBookingsOverlap(workerId: string, date: string, start: number, end: number, excludeId?: string) {
  const rows = await db.select({ id: bookings.id, s: bookings.startMin, e: bookings.endMin }).from(bookings)
    .where(and(eq(bookings.workerId, workerId), eq(bookings.date, date), inArray(bookings.status, ["pending", "confirmed"]), excludeId ? ne(bookings.id, excludeId) : undefined));
  return rows.some((b) => start < b.e && end > b.s);
}
