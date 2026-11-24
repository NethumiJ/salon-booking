import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { salons } from "@/lib/schema";
import { Logo } from "@/components/shared";

export default async function AdminHome() {
  const list = await db.select().from(salons).orderBy(desc(salons.createdAt));
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Salons ({list.length})</h1>
        <Link href="/admin/salons/new" className="btn btn-brand">+ New salon</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s) => (
          <Link key={s.id} href={`/admin/salons/${s.id}`} className="card flex items-center gap-3 hover:border-brand">
            <Logo salon={s} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="truncate text-xs text-muted">/{s.slug}</p>
            </div>
            <span className={`chip ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{s.active ? "Active" : "Disabled"}</span>
          </Link>
        ))}
        {!list.length && <p className="card text-sm text-muted">No salons yet. Create the first one.</p>}
      </div>
    </>
  );
}
