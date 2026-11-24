import { and, eq, gte } from "drizzle-orm";
import ActionForm, { Submit } from "@/components/ActionForm";
import { addLeave, removeLeave, saveWorker, toggleWorker } from "@/actions/staff";
import { db } from "@/lib/db";
import { workerLeaves, workers } from "@/lib/schema";
import { requireStaff } from "@/lib/auth";
import { colomboNow, fmtDate } from "@/lib/time";
import { Field } from "@/components/shared";

export default async function TeamPage() {
  const { salon } = await requireStaff();
  const list = await db.select().from(workers).where(eq(workers.salonId, salon.id)).orderBy(workers.name);
  const leaves = await db.select().from(workerLeaves)
    .where(and(eq(workerLeaves.salonId, salon.id), gte(workerLeaves.date, colomboNow().date))).orderBy(workerLeaves.date);

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="mb-3 font-semibold">Add team member</h2>
        <ActionForm action={saveWorker} reset className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <Field label="Name"><input name="name" className="input" required maxLength={60} /></Field>
          <Field label="Short bio (optional)"><input name="bio" className="input" maxLength={200} placeholder="Fade specialist, 8 yrs" /></Field>
          <Submit>Add</Submit>
        </ActionForm>
      </section>
      {list.map((w) => {
        const mine = leaves.filter((l) => l.workerId === w.id);
        return (
          <section key={w.id} className={`card space-y-3 ${w.active ? "" : "opacity-60"}`}>
            <ActionForm action={saveWorker} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <input type="hidden" name="id" value={w.id} />
              <Field label="Name"><input name="name" className="input" defaultValue={w.name} required maxLength={60} /></Field>
              <Field label="Bio"><input name="bio" className="input" defaultValue={w.bio} maxLength={200} /></Field>
              <Submit className="btn btn-ghost">Save</Submit>
            </ActionForm>
            <div>
              <p className="label">Leave days</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {mine.map((l) => (
                  <ActionForm key={l.id} action={removeLeave} className="inline">
                    <input type="hidden" name="id" value={l.id} />
                    <button className="chip bg-amber-100 text-amber-900" title="Remove leave">{fmtDate(l.date)} ✕</button>
                  </ActionForm>
                ))}
                {!mine.length && <span className="text-sm text-muted">No upcoming leave</span>}
              </div>
              <ActionForm action={addLeave} reset className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="workerId" value={w.id} />
                <Field label="From"><input type="date" name="from" className="input" required min={colomboNow().date} /></Field>
                <Field label="To (optional)"><input type="date" name="to" className="input" min={colomboNow().date} /></Field>
                <Submit className="btn btn-ghost">Add leave</Submit>
              </ActionForm>
            </div>
            <ActionForm action={toggleWorker}>
              <input type="hidden" name="id" value={w.id} />
              <Submit className="btn btn-ghost btn-sm">{w.active ? "Hide from booking" : "Show for booking"}</Submit>
            </ActionForm>
          </section>
        );
      })}
    </div>
  );
}
