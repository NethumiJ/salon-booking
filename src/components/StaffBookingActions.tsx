"use client";
import { useState } from "react";
import ActionForm, { Submit } from "./ActionForm";
import SlotPicker, { type Pick } from "./SlotPicker";
import { rescheduleByStaff, setBookingStatus, staffSlots } from "@/actions/staff";

export default function StaffBookingActions({
  id, status, dates,
}: { id: string; status: string; dates: { date: string; closed: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Pick>(null);
  if (status !== "pending" && status !== "confirmed") return null;

  const btn = (action: string, label: string, cls: string, confirm?: string) => (
    <ActionForm action={setBookingStatus} confirm={confirm}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <Submit className={`btn btn-sm ${cls}`}>{label}</Submit>
    </ActionForm>
  );

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        {status === "pending" && btn("confirm", "Accept", "btn-brand")}
        {btn("complete", "Done", "btn-ghost")}
        {btn("no_show", "No-show", "btn-ghost", "Mark as no-show?")}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>Reschedule</button>
        {btn("cancel", "Cancel", "btn-danger", "Cancel this booking?")}
      </div>
      {open && (
        <ActionForm action={rescheduleByStaff} className="space-y-3 rounded-xl bg-paper p-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="date" value={pick?.date ?? ""} />
          <input type="hidden" name="startMin" value={pick?.start ?? ""} />
          <SlotPicker dates={dates} value={pick} onChange={setPick} loadSlots={(d) => staffSlots(id, d)} />
          {pick && <Submit>Confirm new time</Submit>}
        </ActionForm>
      )}
    </div>
  );
}
