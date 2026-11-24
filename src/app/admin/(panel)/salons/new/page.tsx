import ActionForm, { Submit } from "@/components/ActionForm";
import { createSalon } from "@/actions/admin";
import { Field, SalonProfileFields } from "@/components/shared";

export default function NewSalon() {
  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Create salon</h1>
      <ActionForm action={createSalon} className="space-y-4">
        <section className="card space-y-3">
          <h2 className="font-semibold">Public URL and owner login</h2>
          <Field label="URL name (yoursite.com/name)"><input name="slug" className="input" required pattern="[a-z0-9\-]{3,40}" placeholder="glam-cuts" autoCapitalize="none" /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Owner name"><input name="ownerName" className="input" required maxLength={60} /></Field>
            <Field label="Owner username"><input name="ownerUsername" className="input" required autoCapitalize="none" autoComplete="off" /></Field>
            <Field label="Owner password"><input name="ownerPassword" type="text" className="input" required minLength={10} autoComplete="off" /></Field>
          </div>
          <p className="text-xs text-muted">Share the password securely. The owner can add more staff accounts from their dashboard.</p>
        </section>
        <section className="card"><h2 className="mb-3 font-semibold">Salon profile</h2><SalonProfileFields /></section>
        <Submit className="btn btn-brand w-full">Create salon</Submit>
      </ActionForm>
    </>
  );
}
