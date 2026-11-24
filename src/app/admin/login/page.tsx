import type { Metadata } from "next";
import ActionForm, { Submit } from "@/components/ActionForm";
import { adminLogin } from "@/actions/admin";
import { Field } from "@/components/shared";

export const metadata: Metadata = { title: "Admin login", robots: { index: false, follow: false } };

export default function AdminLogin() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center p-5">
      <h1 className="mb-1 text-2xl font-bold">Platform admin</h1>
      <p className="mb-6 text-sm text-muted">Sign in to manage salons.</p>
      <ActionForm action={adminLogin} className="card space-y-4">
        <Field label="Username"><input name="username" className="input" autoComplete="username" required /></Field>
        <Field label="Password"><input name="password" type="password" className="input" autoComplete="current-password" required /></Field>
        <Submit className="btn btn-brand w-full">Sign in</Submit>
      </ActionForm>
    </main>
  );
}
