import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { offers, services, workers } from "@/lib/schema";
import { getSalonBySlug } from "@/lib/booking";
import { colomboNow, fmtPrice, parseHours } from "@/lib/time";
import { SITE } from "@/lib/site";
import { Logo } from "@/components/shared";

type P = { params: Promise<{ slug: string }> };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hm = (m: number) => `${String(Math.floor(m / 60) % 12 || 12)}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const salon = await getSalonBySlug((await params).slug);
  if (!salon || !salon.active) return { title: "Salon not found", robots: { index: false } };
  const place = salon.city || "Sri Lanka";
  const title = `${salon.name} – Book Online | Salon in ${place}`;
  const description = (salon.tagline || salon.description || `Book your appointment at ${salon.name} online.`).slice(0, 155)
    + ` Online salon booking in ${place}, Sri Lanka.`;
  return {
    title, description,
    keywords: [salon.name, `${salon.name} ${place}`, `salon ${place}`, "salon Sri Lanka", "book salon online", "online booking", "haircut", "barber", "beauty salon"],
    alternates: { canonical: `/${salon.slug}` },
    openGraph: {
      title, description, url: `${SITE}/${salon.slug}`, type: "website", locale: "en_LK",
      ...(salon.logoData ? { images: [`${SITE}/api/salons/${salon.slug}/logo?v=${salon.logoVersion}`] } : {}),
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function SalonPage({ params }: P) {
  const salon = await getSalonBySlug((await params).slug);
  if (!salon || !salon.active) notFound();
  const [svc, team, deals] = await Promise.all([
    db.select().from(services).where(and(eq(services.salonId, salon.id), eq(services.active, true))).orderBy(services.name),
    db.select().from(workers).where(and(eq(workers.salonId, salon.id), eq(workers.active, true))),
    db.select().from(offers).where(and(eq(offers.salonId, salon.id), eq(offers.active, true))),
  ]);
  const today = colomboNow().date;
  const live = deals.filter((o) => o.startsOn <= today && o.endsOn >= today);
  const hours = parseHours(salon.hours);
  const waDigits = salon.whatsapp.replace(/\D/g, "").replace(/^0/, "94");

  const jsonLd = {
    "@context": "https://schema.org", "@type": "HairSalon", name: salon.name, url: `${SITE}/${salon.slug}`,
    description: salon.description || salon.tagline, telephone: salon.phone || undefined,
    address: { "@type": "PostalAddress", streetAddress: salon.address, addressLocality: salon.city, addressCountry: "LK" },
    ...(salon.logoData ? { image: `${SITE}/api/salons/${salon.slug}/logo?v=${salon.logoVersion}` } : {}),
    priceRange: "Rs.",
    openingHoursSpecification: hours.map((h, i) => h.closed ? null : ({
      "@type": "OpeningHoursSpecification", dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i],
      opens: `${String(Math.floor(h.open / 60)).padStart(2, "0")}:${String(h.open % 60).padStart(2, "0")}`,
      closes: `${String(Math.floor(h.close / 60)).padStart(2, "0")}:${String(h.close % 60).padStart(2, "0")}`,
    })).filter(Boolean),
  };

  return (
    <div className="space-y-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="card flex flex-col items-center gap-3 text-center">
        <Logo salon={salon} size={80} />
        <h1 className="text-2xl font-bold">{salon.name}</h1>
        {salon.tagline && <p className="text-muted">{salon.tagline}</p>}
        {(salon.city || salon.address) && <p className="text-sm text-muted">📍 {[salon.address, salon.city].filter(Boolean).join(", ")}</p>}
        <Link href={`/${salon.slug}/book`} className="btn btn-brand w-full max-w-xs text-base">Book an appointment</Link>
        <div className="flex gap-2">
          {salon.phone && <a href={`tel:${salon.phone.replace(/[^\d+]/g, "")}`} className="btn btn-ghost btn-sm">Call</a>}
          {waDigits && <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">WhatsApp</a>}
        </div>
      </section>

      {live.length > 0 && (
        <section className="space-y-2" aria-label="Offers">
          {live.map((o) => (
            <div key={o.id} className="rounded-2xl bg-accent p-4 text-ink">
              <p className="font-bold">🎉 {o.title} — {o.discountPercent}% off</p>
              {o.description && <p className="text-sm">{o.description}</p>}
            </div>
          ))}
        </section>
      )}

      {salon.description && <section className="card"><h2 className="mb-2 font-semibold">About</h2><p className="whitespace-pre-line text-sm text-muted">{salon.description}</p></section>}

      <section className="card">
        <h2 className="mb-3 font-semibold">Services</h2>
        <ul className="divide-y divide-line">
          {svc.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted">{s.durationMin} min{s.description ? ` · ${s.description}` : ""}</p></div>
              <p className="shrink-0 font-semibold">{fmtPrice(s.price)}</p>
            </li>
          ))}
          {!svc.length && <li className="py-3 text-sm text-muted">Services coming soon.</li>}
        </ul>
      </section>

      {team.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Our team</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {team.map((w) => (
              <div key={w.id} className="rounded-xl bg-paper p-3 text-center">
                <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-brand text-lg font-bold text-onbrand">{w.name.charAt(0)}</span>
                <p className="text-sm font-semibold">{w.name}</p>
                {w.bio && <p className="text-xs text-muted">{w.bio}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">Opening hours</h2>
        <ul className="space-y-1 text-sm">
          {hours.map((h, i) => <li key={i} className="flex justify-between"><span>{DAYS[i]}</span><span className="text-muted">{h.closed ? "Closed" : `${hm(h.open)} – ${hm(h.close)}`}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
