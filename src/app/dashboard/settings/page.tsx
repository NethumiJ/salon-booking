import ActionForm, { Submit } from "@/components/ActionForm";
import { updateProfile } from "@/actions/staff";
import { requireOwner } from "@/lib/auth";
import { SalonProfileFields } from "@/components/shared";

export default async function SettingsPage() {
  const { salon } = await requireOwner();
  return (
    <ActionForm action={updateProfile} className="space-y-4">
      <section className="card"><h2 className="mb-3 font-semibold">Salon profile and booking rules</h2><SalonProfileFields salon={salon} /></section>
      <Submit className="btn btn-brand w-full">Save settings</Submit>
    </ActionForm>
  );
}
