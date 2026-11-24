import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import ActionForm, { Submit } from "@/components/ActionForm";
import { createStaffAdmin, resetStaffPasswordAdmin, toggleStaffAdmin, updateSalonAdmin } from "@/actions/admin";
import { db } from "@/lib/db";
import { salons, staffUsers } from "@/lib/schema";
import { idSchema } from "@/lib/validation";
import { Field, SalonProfileFields } from "@/components/shared";

export default async function EditSalon({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const salon = await db.select().from(salons).where(eq(salons.id, id)).get();
  if (!salon) notFound();
  const staff = await db.select().from(staffUsers).where(eq(staffUsers.salonId, id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{salon.name}</h1>
        <Link href={`/${salon.slug}`} target="_blank" className="btn btn-ghost btn-sm">View public page ↗</Link>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">Accounts</h2>
        {staff.map((u) => (
          <div key={u.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-semibold">{u.displayName} <span className="chip bg-black/5">{u.role}</span> {!u.active && <span className="chip bg-red-100 text-red-700">disabled</span>}</p>
              <p className="text-xs text-muted">@{u.username}</p>
            </div>
            <ActionForm action={resetStaffPasswordAdmin} reset className="flex gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <input name="password" type="text" placeholder="New password" minLength={10} className="input !min-h-9 w-40 text-sm" autoComplete="off" />
              <Submit className="btn btn-ghost btn-sm">Reset</Submit>
            </ActionForm>
            <ActionForm action={toggleStaffAdmin}>
              <input type="hidden" name="userId" value={u.id} />
              <Submit className="btn btn-ghost btn-sm">{u.active ? "Disable" : "Enable"}</Submit>
            </ActionForm>
          </div>
        ))}
        <details>
          <summary className="cursor-pointer text-sm font-semibold">+ Add account</summary>
          <ActionForm action={createStaffAdmin} reset className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="salonId" value={salon.id} />
            <Field label="Name"><input name="displayName" className="input" required /></Field>
            <Field label="Username"><input name="username" className="input" required autoCapitalize="none" autoComplete="off" /></Field>
            <Field label="Password"><input name="password" className="input" required minLength={10} autoComplete="off" /></Field>
            <Field label="Role"><select name="role" className="input"><option value="manager">Manager</option><option value="owner">Owner</option></select></Field>
            <div className="sm:col-span-2"><Submit>Create account</Submit></div>
          </ActionForm>
        </details>
      </section>

      <ActionForm action={updateSalonAdmin} className="space-y-4">
        <input type="hidden" name="id" value={salon.id} />
        <section className="card space-y-3">
          <h2 className="font-semibold">Status and URL</h2>
          <Field label="URL name"><input name="slug" className="input" defaultValue={salon.slug} required pattern="[a-z0-9\-]{3,40}" /></Field>
          <p className="text-xs text-amber-700">Changing the URL name breaks existing links to this salon.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={salon.active} className="size-4" /> Salon is active (public page, staff login and bookings enabled)</label>
        </section>
        <section className="card"><h2 className="mb-3 font-semibold">Profile</h2><SalonProfileFields salon={salon} /></section>
        <Submit className="btn btn-brand w-full">Save changes</Submit>
      </ActionForm>
    </div>
  );
}
