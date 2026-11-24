import { and, eq } from "drizzle-orm";
import ActionForm, { Submit } from "@/components/ActionForm";
import { saveService, toggleService } from "@/actions/staff";
import { db } from "@/lib/db";
import { services, workerServices, workers } from "@/lib/schema";
import { requireStaff } from "@/lib/auth";
import { fmtPrice } from "@/lib/time";
import { Field } from "@/components/shared";

type W = { id: string; name: string };

function ServiceForm({ s, ws, assigned }: { s?: typeof services.$inferSelect; ws: W[]; assigned: Set<string> }) {
  return (
    <ActionForm action={saveService} reset={!s} className="space-y-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Service name"><input name="name" className="input" defaultValue={s?.name} required maxLength={60} placeholder="Haircut" /></Field>
        <Field label="Price (LKR)"><input name="price" type="number" min={0} className="input" defaultValue={s?.price} required inputMode="numeric" /></Field>
        <Field label="Duration (minutes)"><input name="durationMin" type="number" min={5} max={480} step={5} className="input" defaultValue={s?.durationMin ?? 30} required inputMode="numeric" /></Field>
      </div>
      <Field label="Description"><input name="description" className="input" defaultValue={s?.description} maxLength={300} /></Field>
      <fieldset>
        <legend className="label">Who performs this service?</legend>
        <div className="flex flex-wrap gap-2">
          {ws.map((w) => (
            <label key={w.id} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm">
              <input type="checkbox" name="workerIds" value={w.id} defaultChecked={assigned.has(w.id)} className="size-4" /> {w.name}
            </label>
          ))}
          {!ws.length && <p className="text-sm text-muted">Add team members first.</p>}
        </div>
      </fieldset>
      <Submit>{s ? "Save" : "Add service"}</Submit>
    </ActionForm>
  );
}

export default async function ServicesPage() {
  const { salon } = await requireStaff();
  const list = await db.select().from(services).where(eq(services.salonId, salon.id)).orderBy(services.name);
  const ws = await db.select({ id: workers.id, name: workers.name }).from(workers).where(and(eq(workers.salonId, salon.id), eq(workers.active, true)));
  const links = await db.select({ w: workerServices.workerId, s: workerServices.serviceId }).from(workerServices)
    .innerJoin(services, eq(services.id, workerServices.serviceId)).where(eq(services.salonId, salon.id));
  const by = (id: string) => new Set(links.filter((l) => l.s === id).map((l) => l.w));

  return (
    <div className="space-y-4">
      <section className="card"><h2 className="mb-3 font-semibold">Add a service</h2><ServiceForm ws={ws} assigned={new Set()} /></section>
      {list.map((s) => (
        <section key={s.id} className={`card ${s.active ? "" : "opacity-60"}`}>
          <details>
            <summary className="flex cursor-pointer items-center justify-between gap-2">
              <span><b>{s.name}</b> <span className="text-sm text-muted">· {fmtPrice(s.price)} · {s.durationMin} min · {by(s.id).size} staff</span></span>
              {!s.active && <span className="chip bg-zinc-200">hidden</span>}
            </summary>
            <div className="mt-4 space-y-3">
              <ServiceForm s={s} ws={ws} assigned={by(s.id)} />
              <ActionForm action={toggleService}>
                <input type="hidden" name="id" value={s.id} />
                <Submit className="btn btn-ghost btn-sm">{s.active ? "Hide from customers" : "Show to customers"}</Submit>
              </ActionForm>
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
