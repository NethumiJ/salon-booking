import type { Metadata } from "next";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { salons } from "@/lib/schema";
import { Logo } from "@/components/shared";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { title: "Online Salon Booking in Sri Lanka", description: "Book haircuts, beard trims and beauty appointments at salons across Sri Lanka.", url: SITE },
};

export default async function Home() {
  const list = await db.select().from(salons).where(eq(salons.active, true)).orderBy(desc(salons.createdAt)).limit(60);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "WebSite", name: "Salon Booking Sri Lanka", url: SITE, inLanguage: "en-LK",
  };
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="rounded-3xl bg-[#111827] px-5 py-10 text-center text-white sm:py-14">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Book your salon in Sri Lanka, online</h1>
        <p className="mx-auto mt-3 max-w-xl text-white/70">Pick a salon, choose your service and barber, and lock in a time in seconds. No calls, no waiting.</p>
      </section>
      <h2 className="mb-3 mt-8 text-lg font-bold">Salons on our platform</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s) => (
          <Link key={s.id} href={`/${s.slug}`} className="card flex items-center gap-3 hover:border-brand">
            <Logo salon={s} size={52} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="truncate text-sm text-muted">{s.tagline || s.city || "Book online"}</p>
            </div>
          </Link>
        ))}
        {!list.length && <p className="card text-sm text-muted sm:col-span-2">Salons will appear here soon.</p>}
      </div>
      <footer className="mt-10 flex justify-center gap-4 pb-6 text-xs text-muted">
        <Link href="/login" className="underline">Salon login</Link>
      </footer>
    </main>
  );
}
