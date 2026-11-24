"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import SlotPicker, { type Pick } from "./SlotPicker";
import { createBooking, getSlots } from "@/actions/customer";
import { fmtDate, fmtPrice, fmtTime } from "@/lib/time";

export type WizService = {
  id: string; name: string; description: string; price: number; durationMin: number;
  workers: { id: string; name: string; bio: string }[];
};
type Quote = { price: number; originalPrice: number; offerTitle: string | null };

export default function BookingWizard({
  slug, services, dates, autoConfirm,
}: { slug: string; services: WizService[]; dates: { date: string; closed: boolean }[]; autoConfirm: boolean }) {
  const [service, setService] = useState<WizService | null>(null);
  const [worker, setWorker] = useState<WizService["workers"][number] | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ status: string } | null>(null);
  const [pending, start] = useTransition();

  const step = !service ? 1 : !worker ? 2 : !pick ? 3 : 4;

  if (result) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-4xl">{result.status === "confirmed" ? "✅" : "⏳"}</p>
        <h1 className="text-xl font-bold">{result.status === "confirmed" ? "Booking confirmed!" : "Request sent!"}</h1>
        <p className="text-sm text-muted">
          {fmtDate(pick!.date)} at {fmtTime(pick!.start)} · {service!.name} with {worker!.name}.
          {result.status !== "confirmed" && " The salon will confirm your booking shortly."}
        </p>
        <Link href={`/${slug}/appointments`} className="btn btn-brand w-full">View my appointments</Link>
      </div>
    );
  }

  const back = () => { setError(""); if (pick) setPick(null); else if (worker) setWorker(null); else setService(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {step > 1 && <button onClick={back} className="btn btn-ghost btn-sm" aria-label="Back">←</button>}
        <h1 className="text-xl font-bold">{["", "Choose a service", "Choose your barber", "Pick date & time", "Confirm booking"][step]}</h1>
        <span className="ml-auto text-xs text-muted">Step {step}/4</span>
      </div>

      {step === 1 && (
        <div className="space-y-2">
          {services.map((s) => (
            <button key={s.id} onClick={() => setService(s)} className="card flex w-full items-center justify-between gap-3 text-left hover:border-brand">
              <span><b>{s.name}</b><br /><span className="text-xs text-muted">{s.durationMin} min{s.description ? ` · ${s.description}` : ""}</span></span>
              <span className="shrink-0 font-semibold">{fmtPrice(s.price)}</span>
            </button>
          ))}
          {!services.length && <p className="card text-sm text-muted">No services are available for online booking yet.</p>}
        </div>
      )}

      {step === 2 && service && (
        <div className="grid gap-2 sm:grid-cols-2">
          {service.workers.map((w) => (
            <button key={w.id} onClick={() => setWorker(w)} className="card flex items-center gap-3 text-left hover:border-brand">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-onbrand">{w.name.charAt(0)}</span>
              <span><b>{w.name}</b>{w.bio && <><br /><span className="text-xs text-muted">{w.bio}</span></>}</span>
            </button>
          ))}
        </div>
      )}

      {step === 3 && service && worker && (
        <SlotPicker
          dates={dates} value={pick} onChange={setPick}
          loadSlots={async (date) => {
            const r = await getSlots(slug, { serviceId: service.id, workerId: worker.id, date });
            if (!r.ok) return { error: r.error };
            setQuote({ price: r.price, originalPrice: r.originalPrice, offerTitle: r.offerTitle });
            return { slots: r.slots };
          }}
        />
      )}

      {step === 4 && service && worker && pick && (
        <div className="space-y-4">
          <div className="card space-y-2 text-sm">
            <Row k="Service" v={service.name} />
            <Row k="Barber" v={worker.name} />
            <Row k="Date" v={fmtDate(pick.date)} />
            <Row k="Time" v={`${fmtTime(pick.start)} (${service.durationMin} min)`} />
            <Row k="Price" v={quote && quote.offerTitle
              ? <><s className="text-muted">{fmtPrice(quote.originalPrice)}</s> <b>{fmtPrice(quote.price)}</b> <span className="chip bg-accent/30">{quote.offerTitle}</span></>
              : <b>{fmtPrice(quote?.price ?? service.price)}</b>} />
          </div>
          <label className="block"><span className="label">Note for the salon (optional)</span>
            <textarea className="input min-h-20 py-2" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {!autoConfirm && <p className="text-xs text-muted">This salon confirms each booking manually — you’ll see the status in “My appointments”.</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn btn-brand w-full text-base" disabled={pending} onClick={() => {
            setError("");
            start(async () => {
              const r = await createBooking(slug, { serviceId: service.id, workerId: worker.id, date: pick.date, startMin: pick.start, note });
              if (r.ok) setResult({ status: r.status }); else { setError(r.error); }
            });
          }}>{pending ? "Booking…" : "Confirm booking"}</button>
        </div>
      )}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3"><span className="text-muted">{k}</span><span className="text-right">{v}</span></div>
);
