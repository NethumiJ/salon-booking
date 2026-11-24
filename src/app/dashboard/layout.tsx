import type { Metadata } from "next";
import Link from "next/link";
import { staffLogout } from "@/actions/staff";
import { requireStaff } from "@/lib/auth";
import { Logo, themeStyle } from "@/components/shared";
import DashNav from "@/components/DashNav";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { salon, user } = await requireStaff();
  return (
    <div style={themeStyle(salon)} className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-brand text-onbrand">
        <div className="mx-auto flex max-w-5xl items-center gap-3 p-3">
          <Logo salon={salon} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{salon.name}</p>
            <p className="truncate text-xs opacity-70">{user.displayName} · {user.role}</p>
          </div>
          <Link href={`/${salon.slug}`} target="_blank" className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold">Public page ↗</Link>
          <form action={staffLogout}><button className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold">Log out</button></form>
        </div>
        <DashNav owner={user.role === "owner"} />
      </header>
      <main className="mx-auto max-w-5xl p-4 pb-24">{children}</main>
    </div>
  );
}
