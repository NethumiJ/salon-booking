import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { getSalonBySlug } from "@/lib/booking";
import { getCustomer } from "@/lib/auth";
import { bookableDates, colomboNow, minutesUntil, parseHours } from "@/lib/time";
import AppointmentCard from "@/components/AppointmentCard";

export const metadata: Metadata = { title: "My appointments", robots: { index: false, follow: false } };

export default async function AppointmentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const salon = await getSalonBySlug((await params).slug);
  if (!salon || !salon.active) notFound();
  const customer = await getCustomer(salon.id);
  if (!customer) redirect(`/${salon.slug}/login?next=appointments`);

  const rows = await db.select().from(bookings)
    .where(and(eq(bookings.salonId, salon.id), eq(bookings.customerId, customer.id)))
    .orderBy(desc(bookings.date), desc(bookings.startMin)).limit(60);
  const dates = bookableDates(parseHours(salon.hours), salon.maxAdvanceDays);
  const today = colomboNow().date;
  const mapped = rows.map((b) => ({
    id: b.id, date: b.date, startMin: b.startMin, serviceName: b.serviceName, workerName: b.workerName, workerId: b.workerId,
    serviceId: b.serviceId, price: b.price, status: b.status,
    canChange: minutesUntil(b.date, b.startMin) >= salon.cancelCutoffHours * 60,
  }));
  const upcoming = mapped.filter((b) => b.date >= today && ["pending", "confirmed"].includes(b.status)).reverse();
  const past = mapped.filter((b) => !upcoming.includes(b));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My appointments</h1>
        <Link href={`/${salon.slug}/book`} className="btn btn-brand btn-sm">+ Book</Link>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Upcoming</h2>
        {upcoming.map((a) => <AppointmentCard key={a.id} slug={salon.slug} a={a} dates={dates} cutoff={salon.cancelCutoffHours} />)}
        {!upcoming.length && <p className="card text-sm text-muted">No upcoming appointments.</p>}
      </section>
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">History</h2>
          {past.map((a) => <AppointmentCard key={a.id} slug={salon.slug} a={a} dates={dates} cutoff={salon.cancelCutoffHours} />)}
        </section>
      )}
    </div>
  );
}
