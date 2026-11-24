import type { Metadata } from "next";
import ActionForm, { Submit } from "@/components/ActionForm";
import { staffLogin } from "@/actions/staff";
import { Field } from "@/components/shared";

export const metadata: Metadata = { title: "Salon staff login", robots: { index: false, follow: false } };

export default function StaffLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center p-5">
      <h1 className="mb-1 text-2xl font-bold">Salon login</h1>
      <p className="mb-6 text-sm text-muted">For salon owners and managers.</p>
      <ActionForm action={staffLogin} className="card space-y-4">
        <Field label="Username"><input name="username" className="input" autoComplete="username" autoCapitalize="none" required /></Field>
        <Field label="Password"><input name="password" type="password" className="input" autoComplete="current-password" required /></Field>
        <Submit className="btn btn-brand w-full">Sign in</Submit>
      </ActionForm>
    </main>
  );
}
