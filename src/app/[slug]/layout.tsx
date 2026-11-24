import Link from "next/link";
import { notFound } from "next/navigation";
import { getSalonBySlug } from "@/lib/booking";
import { getCustomer } from "@/lib/auth";
import { Logo, themeStyle } from "@/components/shared";
import CustomerMenu from "@/components/CustomerMenu";

export default async function SalonLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const salon = await getSalonBySlug(slug);
  if (!salon || !salon.active) notFound();
  const customer = await getCustomer(salon.id);

  return (
    <div style={themeStyle(salon)} className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 bg-brand text-onbrand">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 p-3">
          <Link href={`/${salon.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Logo salon={salon} size={36} />
            <span className="truncate font-bold">{salon.name}</span>
          </Link>
          {customer ? <CustomerMenu slug={salon.slug} name={customer.name} /> : (
            <Link href={`/${salon.slug}/login`} className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold">Sign in</Link>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">{children}</main>
      <footer className="mx-auto w-full max-w-3xl p-4 pb-8 text-center text-xs text-muted">
        © {salon.name} · Online booking powered by <Link href="/" className="underline">Salon Booking Sri Lanka</Link>
      </footer>
    </div>
  );
}
