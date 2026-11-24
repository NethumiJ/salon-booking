"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SlotPicker, { type Pick } from "./SlotPicker";
import StatusChip from "./StatusChip";
import { cancelBooking, getSlots, rescheduleBooking } from "@/actions/customer";
import { fmtDate, fmtPrice, fmtTime } from "@/lib/time";

export type Appt = {
  id: string; date: string; startMin: number; serviceName: string; workerName: string; workerId: string; serviceId: string;
  price: number; status: string; canChange: boolean;
};

export default function AppointmentCard({ slug, a, dates, cutoff }: { slug: string; a: Appt; dates: { date: string; closed: boolean }[]; cutoff: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Pick>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const active = a.status === "pending" || a.status === "confirmed";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError("");
    start(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? "Failed"); else { setOpen(false); router.refresh(); } });
  };

  return (
    <article className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{fmtDate(a.date)} · {fmtTime(a.startMin)}</p>
          <p className="text-sm text-muted">{a.serviceName} with {a.workerName} · {fmtPrice(a.price)}</p>
        </div>
        <StatusChip status={a.status} />
      </div>
      {active && (
        a.canChange ? (
          <div className="mt-3 flex gap-2 border-t border-line pt-3">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>Reschedule</button>
            <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => { if (confirm("Cancel this appointment?")) run(() => cancelBooking(slug, a.id)); }}>Cancel</button>
          </div>
        ) : <p className="mt-3 border-t border-line pt-3 text-xs text-muted">Changes are closed within {cutoff}h of the appointment — please call the salon.</p>
      )}
      {open && (
        <div className="mt-3 space-y-3 rounded-xl bg-paper p-3">
          <SlotPicker dates={dates} value={pick} onChange={setPick}
            loadSlots={async (date) => { const r = await getSlots(slug, { serviceId: a.serviceId, workerId: a.workerId, date }); return r.ok ? { slots: r.slots } : { error: r.error }; }} />
          {pick && <button className="btn btn-brand w-full" disabled={pending} onClick={() => run(() => rescheduleBooking(slug, a.id, pick.date, pick.start))}>
            {pending ? "Saving…" : `Move to ${fmtDate(pick.date)} ${fmtTime(pick.start)}`}</button>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </article>
  );
}
