"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Bookings" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/offers", label: "Offers" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/settings", label: "Settings", owner: true },
  { href: "/dashboard/accounts", label: "Accounts" },
];

export default function DashNav({ owner }: { owner: boolean }) {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2" aria-label="Dashboard">
      {ITEMS.filter((i) => !i.owner || owner).map((i) => {
        const on = i.href === "/dashboard" ? path === i.href : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${on ? "bg-white text-ink" : "text-onbrand/80 hover:bg-white/10"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
