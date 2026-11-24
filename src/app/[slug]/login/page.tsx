import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSalonBySlug } from "@/lib/booking";
import { getCustomer } from "@/lib/auth";
import CustomerLogin from "@/components/CustomerLogin";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function CustomerLoginPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const salon = await getSalonBySlug((await params).slug);
  if (!salon || !salon.active) notFound();
  // Only allow redirects to known internal pages (no open redirect)
  const want = (await searchParams).next;
  const next = want === "appointments" ? `/${salon.slug}/appointments` : `/${salon.slug}/book`;
  if (await getCustomer(salon.id)) redirect(next);
  return <CustomerLogin slug={salon.slug} next={next} />;
}
