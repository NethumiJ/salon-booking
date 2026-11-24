import { and, eq, like, or, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, customers } from "@/lib/schema";
import { requireStaff } from "@/lib/auth";
import { fmtDate } from "@/lib/time";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { salon } = await requireStaff();
  const q = ((await searchParams).q ?? "").slice(0, 40).replace(/[%_\\]/g, "").trim();
  const search = q ? or(like(customers.name, `%${q}%`), like(customers.phone, `%${q.replace(/^0/, "+94")}%`), like(customers.phone, `%${q}%`)) : undefined;

  const rows = await db.select({
    c: customers,
    total: sql<number>`count(${bookings.id})`,
    last: sql<string | null>`max(${bookings.date})`,
  }).from(customers).leftJoin(bookings, eq(bookings.customerId, customers.id))
    .where(and(eq(customers.salonId, salon.id), search)).groupBy(customers.id).orderBy(desc(customers.createdAt)).limit(100);

  return (
    <>
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search by name or phone" className="input" type="search" />
        <button className="btn btn-brand">Search</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ c, total, last }) => (
          <div key={c.id} className="card">
            <p className="font-semibold">{c.name}</p>
            <a href={`tel:${c.phone}`} className="text-sm underline">{c.phone}</a>
            <p className="mt-1 text-xs text-muted">{total} booking{total === 1 ? "" : "s"}{last ? ` · last ${fmtDate(last)}` : ""}</p>
          </div>
        ))}
        {!rows.length && <p className="card text-sm text-muted sm:col-span-2">No customers found.</p>}
      </div>
    </>
  );
}
