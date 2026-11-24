"use client";
import { useEffect, useRef, useState } from "react";
import { fmtTime } from "@/lib/time";

type Loader = (date: string) => Promise<{ slots: number[] } | { error: string }>;
export type Pick = { date: string; start: number } | null;

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function SlotPicker({
  dates, loadSlots, value, onChange, onDateSlots,
}: {
  dates: { date: string; closed: boolean }[];
  loadSlots: Loader;
  value: Pick;
  onChange: (v: Pick) => void;
  onDateSlots?: (date: string, res: { slots: number[] } | { error: string }) => void;
}) {
  const [date, setDate] = useState<string | null>(value?.date ?? null);
  const [slots, setSlots] = useState<number[] | null>(null);
  const [error, setError] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    if (!date) return;
    const my = ++seq.current;
    loadSlots(date).then((res) => {
      if (my !== seq.current) return; // ignore stale responses
      if ("error" in res) setError(res.error); else setSlots(res.slots);
      onDateSlots?.(date, res);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Choose a date">
        {dates.map(({ date: d, closed }) => {
          const dt = new Date(d + "T00:00:00Z");
          const on = d === date;
          return (
            <button
              key={d} type="button" disabled={closed} aria-pressed={on}
              onClick={() => { setDate(d); setSlots(null); setError(""); onChange(null); }}
              className={`flex h-[72px] w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-xs transition ${on ? "border-brand bg-brand text-onbrand" : "border-line bg-white"} ${closed ? "opacity-40" : "hover:border-brand"}`}
            >
              <span>{DOW[dt.getUTCDay()]}</span>
              <span className="text-lg font-bold leading-tight">{dt.getUTCDate()}</span>
              <span>{MON[dt.getUTCMonth()]}</span>
            </button>
          );
        })}
      </div>
      {date && (
        <div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && slots === null && <p className="text-sm text-muted">Loading times…</p>}
          {slots && !slots.length && <p className="text-sm text-muted">No free times on this day. Try another date.</p>}
          {slots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((s) => {
                const on = value?.date === date && value.start === s;
                return (
                  <button key={s} type="button" onClick={() => onChange({ date, start: s })}
                    className={`min-h-11 rounded-xl border text-sm font-medium transition ${on ? "border-brand bg-brand text-onbrand" : "border-line bg-white hover:border-brand"}`}>
                    {fmtTime(s)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
