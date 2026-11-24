"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { customerLogout } from "@/actions/customer";

export default function CustomerMenu({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      <Link href={`/${slug}/appointments`} className="rounded-lg bg-white/15 px-3 py-2">{name.split(" ")[0]} · My bookings</Link>
      <button className="rounded-lg bg-white/15 px-3 py-2"
        onClick={async () => { await customerLogout(); router.push(`/${slug}`); router.refresh(); }}>
        Log out
      </button>
    </div>
  );
}
