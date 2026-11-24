import { eq } from "drizzle-orm";
import ActionForm, { Submit } from "@/components/ActionForm";
import { saveOffer, toggleOffer } from "@/actions/staff";
import { db } from "@/lib/db";
import { offers, services } from "@/lib/schema";
import { requireStaff } from "@/lib/auth";
import { colomboNow, fmtDate } from "@/lib/time";
import { Field } from "@/components/shared";

export default async function OffersPage() {
  const { salon } = await requireStaff();
  const list = await db.select().from(offers).where(eq(offers.salonId, salon.id)).orderBy(offers.startsOn);
  const svc = await db.select({ id: services.id, name: services.name }).from(services).where(eq(services.salonId, salon.id));
  const today = colomboNow().date;

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="mb-3 font-semibold">New offer / sale</h2>
        <ActionForm action={saveOffer} reset className="grid gap-3 sm:grid-cols-2">
          <Field label="Title"><input name="title" className="input" required maxLength={60} placeholder="New Year Sale" /></Field>
          <Field label="Discount %"><input name="discountPercent" type="number" min={1} max={90} className="input" required inputMode="numeric" /></Field>
          <Field label="Starts"><input type="date" name="startsOn" className="input" required defaultValue={today} /></Field>
          <Field label="Ends"><input type="date" name="endsOn" className="input" required defaultValue={today} /></Field>
          <Field label="Applies to">
            <select name="serviceId" className="input"><option value="">All services</option>{svc.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </Field>
          <Field label="Description"><input name="description" className="input" maxLength={200} /></Field>
          <div className="sm:col-span-2"><Submit>Create offer</Submit></div>
        </ActionForm>
      </section>
      {list.map((o) => {
        const live = o.active && o.startsOn <= today && o.endsOn >= today;
        return (
          <section key={o.id} className="card flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{o.title} <span className="chip bg-accent/30">{o.discountPercent}% off</span> {live && <span className="chip bg-emerald-100 text-emerald-800">live</span>}</p>
              <p className="text-sm text-muted">{fmtDate(o.startsOn)} → {fmtDate(o.endsOn)} · {svc.find((s) => s.id === o.serviceId)?.name ?? "All services"}</p>
            </div>
            <ActionForm action={toggleOffer}><input type="hidden" name="id" value={o.id} /><Submit className="btn btn-ghost btn-sm">{o.active ? "Pause" : "Resume"}</Submit></ActionForm>
            <ActionForm action={toggleOffer} confirm="Delete this offer?"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="delete" value="1" /><Submit className="btn btn-danger btn-sm">Delete</Submit></ActionForm>
          </section>
        );
      })}
    </div>
  );
}
