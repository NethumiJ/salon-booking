import type { Metadata } from "next";
import Link from "next/link";
import { adminLogout } from "@/actions/admin";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-3">
          <Link href="/admin" className="font-bold">Salon admin</Link>
          <form action={adminLogout}><button className="btn btn-ghost btn-sm">Log out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4">{children}</main>
    </div>
  );
}
