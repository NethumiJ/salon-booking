import type { CSSProperties } from "react";
import { parseHours, type DayHours } from "@/lib/time";
import { readableOn } from "@/lib/validation";
import type { Salon } from "@/lib/schema";

export const themeStyle = (s: Pick<Salon, "primaryColor" | "accentColor">): CSSProperties =>
  ({ "--brand": s.primaryColor, "--on-brand": readableOn(s.primaryColor), "--accent": s.accentColor }) as CSSProperties;

export function Logo({ salon, size = 48 }: { salon: Pick<Salon, "slug" | "name" | "logoData" | "logoVersion">; size?: number }) {
  const s = { width: size, height: size };
  return salon.logoData ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/salons/${salon.slug}/logo?v=${salon.logoVersion}`} alt={`${salon.name} logo`} style={s} className="rounded-xl bg-white object-cover" />
  ) : (
    <span style={s} className="flex items-center justify-center rounded-xl bg-accent text-lg font-bold text-ink" aria-hidden>
      {salon.name.charAt(0).toUpperCase()}
    </span>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function HoursFields({ hours }: { hours: DayHours[] }) {
  return (
    <div className="space-y-2">
      {hours.map((h, i) => (
        <div key={i} className="grid grid-cols-[88px_1fr_1fr] items-center gap-2 sm:grid-cols-[110px_1fr_1fr_auto]">
          <span className="text-sm font-medium">{DAYS[i].slice(0, 3)}<span className="hidden sm:inline">{DAYS[i].slice(3)}</span></span>
          <input type="time" name={`open${i}`} defaultValue={hhmm(h.open)} className="input" aria-label={`${DAYS[i]} opens`} required />
          <input type="time" name={`close${i}`} defaultValue={hhmm(h.close)} className="input" aria-label={`${DAYS[i]} closes`} required />
          <label className="col-span-3 flex items-center gap-2 text-xs text-muted sm:col-span-1">
            <input type="checkbox" name={`closed${i}`} defaultChecked={h.closed} className="size-4" /> Closed
          </label>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

/** All salon profile inputs (used by admin create/edit and the salon settings page). */
export function SalonProfileFields({ salon }: { salon?: Salon }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Salon name"><input name="name" className="input" defaultValue={salon?.name} required maxLength={60} /></Field>
        <Field label="Tagline"><input name="tagline" className="input" defaultValue={salon?.tagline} maxLength={100} placeholder="Premium cuts in Colombo" /></Field>
      </div>
      <Field label="About"><textarea name="description" className="input min-h-24 py-2" defaultValue={salon?.description} maxLength={1000} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone"><input name="phone" className="input" defaultValue={salon?.phone} maxLength={20} inputMode="tel" /></Field>
        <Field label="WhatsApp"><input name="whatsapp" className="input" defaultValue={salon?.whatsapp} maxLength={20} inputMode="tel" /></Field>
        <Field label="Address"><input name="address" className="input" defaultValue={salon?.address} maxLength={200} /></Field>
        <Field label="City"><input name="city" className="input" defaultValue={salon?.city} maxLength={60} placeholder="Colombo" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand colour"><input type="color" name="primaryColor" defaultValue={salon?.primaryColor ?? "#111827"} className="input p-1" /></Field>
        <Field label="Accent colour"><input type="color" name="accentColor" defaultValue={salon?.accentColor ?? "#d4a373"} className="input p-1" /></Field>
      </div>
      <Field label="Logo (PNG, JPEG or WebP, max 200 KB)">
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="input py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-1" />
      </Field>
      {salon?.logoData && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removeLogo" className="size-4" /> Remove current logo</label>}
      <div>
        <span className="label">Opening hours (Sri Lanka time)</span>
        <HoursFields hours={salon ? parseHours(salon.hours) : parseHours("")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Time slot step">
          <select name="slotStep" className="input" defaultValue={salon?.slotStep ?? 30}>
            <option value="15">15 min</option><option value="30">30 min</option><option value="60">60 min</option>
          </select>
        </Field>
        <Field label="Cancel/reschedule until (hours before)"><input type="number" name="cancelCutoffHours" min={0} max={72} className="input" defaultValue={salon?.cancelCutoffHours ?? 2} /></Field>
        <Field label="Book up to (days ahead)"><input type="number" name="maxAdvanceDays" min={1} max={90} className="input" defaultValue={salon?.maxAdvanceDays ?? 30} /></Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="autoConfirm" defaultChecked={salon?.autoConfirm} className="mt-0.5 size-4" />
        <span>Auto-accept bookings <span className="text-muted">(otherwise each booking waits for your approval)</span></span>
      </label>
    </div>
  );
}
