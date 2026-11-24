import { eq } from "drizzle-orm";
import ActionForm, { Submit } from "@/components/ActionForm";
import { changeOwnPassword, createManager, manageStaffAccount } from "@/actions/staff";
import { db } from "@/lib/db";
import { staffUsers } from "@/lib/schema";
import { requireStaff } from "@/lib/auth";
import { Field } from "@/components/shared";

export default async function AccountsPage() {
  const { salon, user } = await requireStaff();
  const owner = user.role === "owner";
  const staff = owner ? await db.select().from(staffUsers).where(eq(staffUsers.salonId, salon.id)) : [];

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="mb-3 font-semibold">Change my password</h2>
        <ActionForm action={changeOwnPassword} reset className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <Field label="Current password"><input name="current" type="password" className="input" required autoComplete="current-password" /></Field>
          <Field label="New password (10+ chars)"><input name="password" type="password" className="input" required minLength={10} autoComplete="new-password" /></Field>
          <Submit>Update</Submit>
        </ActionForm>
      </section>
      {owner && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Staff logins</h2>
          {staff.map((u) => (
            <div key={u.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold">{u.displayName} <span className="chip bg-black/5">{u.role}</span> {!u.active && <span className="chip bg-red-100 text-red-700">disabled</span>}</p>
                <p className="text-xs text-muted">@{u.username}</p>
              </div>
              {u.role === "manager" && (
                <>
                  <ActionForm action={manageStaffAccount} reset className="flex gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input name="password" placeholder="New password" minLength={10} className="input !min-h-9 w-40 text-sm" autoComplete="off" required />
                    <Submit className="btn btn-ghost btn-sm">Reset</Submit>
                  </ActionForm>
                  <ActionForm action={manageStaffAccount}>
                    <input type="hidden" name="id" value={u.id} />
                    <Submit className="btn btn-ghost btn-sm">{u.active ? "Disable" : "Enable"}</Submit>
                  </ActionForm>
                </>
              )}
            </div>
          ))}
          <details>
            <summary className="cursor-pointer text-sm font-semibold">+ Add manager login</summary>
            <ActionForm action={createManager} reset className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Name"><input name="displayName" className="input" required /></Field>
              <Field label="Username"><input name="username" className="input" required autoCapitalize="none" autoComplete="off" /></Field>
              <Field label="Password"><input name="password" className="input" required minLength={10} autoComplete="off" /></Field>
              <div className="sm:col-span-3"><Submit>Create</Submit></div>
            </ActionForm>
          </details>
        </section>
      )}
    </div>
  );
}
