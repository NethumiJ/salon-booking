import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, customers } from "@/lib/schema";
import { requireStaff } from "@/lib/auth";
import { bookableDates, colomboNow, fmtDate, fmtPrice, fmtTime, parseHours } from "@/lib/time";
import StatusChip from "@/components/StatusChip";
import StaffBookingActions from "@/components/StaffBookingActions";

const VIEWS = [
  ["pending", "Pending"], ["today", "Today"], ["upcoming", "Upcoming"], ["past", "History"],
] as const;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { salon } = await requireStaff();
  const { view: v } = await searchParams;
  const view = VIEWS.some(([k]) => k === v) ? v! : "pending";
  const today = colomboNow().date;
  const open = inArray(bookings.status, ["pending", "confirmed"]);

  const where =
    view === "pending" ? and(eq(bookings.status, "pending"), gte(bookings.date, today))
    : view === "today" ? and(eq(bookings.date, today), open)
    : view === "upcoming" ? and(open, gte(bookings.date, today))
    : or(lt(bookings.date, today), inArray(bookings.status, ["completed", "cancelled", "no_show"]));

  const rows = await db.select({ b: bookings, c: customers }).from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(and(eq(bookings.salonId, salon.id), where))
    .orderBy(view === "past" ? desc(bookings.date) : asc(bookings.date), asc(bookings.startMin))
    .limit(100);

  const pendingCount = (await db.select({ id: bookings.id }).from(bookings)
    .where(and(eq(bookings.salonId, salon.id), eq(bookings.status, "pending"), gte(bookings.date, today)))).length;
  const dates = bookableDates(parseHours(salon.hours), salon.maxAdvanceDays);

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {VIEWS.map(([k, label]) => (
          <Link key={k} href={`/dashboard?view=${k}`} className={`btn btn-sm shrink-0 ${view === k ? "btn-brand" : "btn-ghost"}`}>
            {label}{k === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Link>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(({ b, c }) => (
          <article key={b.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{fmtDate(b.date)} · {fmtTime(b.startMin)}</p>
                <p className="text-sm text-muted">{b.serviceName} with {b.workerName}</p>
              </div>
              <StatusChip status={b.status} />
            </div>
            <p className="mt-2 text-sm"><b>{c.name}</b> · <a className="underline" href={`tel:${c.phone}`}>{c.phone}</a></p>
            <p className="text-sm text-muted">
              {fmtPrice(b.price)}{b.offerTitle && <> <s>{fmtPrice(b.originalPrice)}</s> ({b.offerTitle})</>} · {b.durationMin} min
              {b.cancelledBy && ` · cancelled by ${b.cancelledBy}`}
            </p>
            {b.note && <p className="mt-1 rounded-lg bg-paper p-2 text-sm">“{b.note}”</p>}
            <StaffBookingActions id={b.id} status={b.status} dates={dates} />
          </article>
        ))}
        {!rows.length && <p className="card text-sm text-muted md:col-span-2">Nothing here.</p>}
      </div>
    </>
  );
}
