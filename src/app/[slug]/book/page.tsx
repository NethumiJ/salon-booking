import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { services, workerServices, workers } from "@/lib/schema";
import { getSalonBySlug } from "@/lib/booking";
import { getCustomer } from "@/lib/auth";
import { bookableDates, parseHours } from "@/lib/time";
import BookingWizard, { type WizService } from "@/components/BookingWizard";

export const metadata: Metadata = { title: "Book an appointment", robots: { index: false, follow: true } };

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const salon = await getSalonBySlug((await params).slug);
  if (!salon || !salon.active) notFound();
  if (!(await getCustomer(salon.id))) redirect(`/${salon.slug}/login?next=book`);

  const [svc, ws, links] = await Promise.all([
    db.select().from(services).where(and(eq(services.salonId, salon.id), eq(services.active, true))).orderBy(services.name),
    db.select().from(workers).where(and(eq(workers.salonId, salon.id), eq(workers.active, true))),
    db.select().from(workerServices),
  ]);
  const list: WizService[] = svc
    .map((s) => ({
      id: s.id, name: s.name, description: s.description, price: s.price, durationMin: s.durationMin,
      workers: ws.filter((w) => links.some((l) => l.serviceId === s.id && l.workerId === w.id)).map((w) => ({ id: w.id, name: w.name, bio: w.bio })),
    }))
    .filter((s) => s.workers.length > 0);

  return <BookingWizard slug={salon.slug} services={list} dates={bookableDates(parseHours(salon.hours), salon.maxAdvanceDays)} autoConfirm={salon.autoConfirm} />;
}
