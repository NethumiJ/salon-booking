import { z } from "zod";
import { isValidDate, type DayHours } from "./time";

// Strips control characters, trims, bounds length. React escapes on output (XSS); Drizzle parameterises queries (SQLi).
const clean = (max: number, min = 0) =>
  z.string().transform((s) => s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim()).pipe(z.string().min(min).max(max));

export const RESERVED_SLUGS = new Set([
  "admin", "api", "login", "logout", "dashboard", "_next", "static", "public", "assets", "robots.txt",
  "sitemap.xml", "manifest.webmanifest", "favicon.ico", "book", "salon", "salons", "s", "www", "app", "help",
  "support", "about", "privacy", "terms", "contact", "register", "signup", "auth", "images", "img",
]);

export const slugSchema = z
  .string().trim().toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "3–40 chars: letters, numbers and hyphens")
  .refine((s) => !s.includes("--") && !RESERVED_SLUGS.has(s), "This URL name is not allowed");

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, "3–32 chars: letters, numbers . _ -");
export const passwordSchema = z.string().min(10, "At least 10 characters").max(128).refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and numbers");
export const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1a2b3c");
const id = z.string().regex(/^[0-9a-f-]{36}$/i, "Invalid id");
export const idSchema = id;
export const dateSchema = z.string().refine(isValidDate, "Invalid date");

export function normalizePhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, "");
  if (/^0\d{9}$/.test(d)) d = "+94" + d.slice(1);
  else if (/^94\d{9}$/.test(d)) d = "+" + d;
  else if (/^\+94\d{9}$/.test(d)) { /* ok */ }
  else return null;
  return /^\+947\d{8}$/.test(d) ? d : null; // Sri Lankan mobile numbers
}
export const phoneSchema = z.string().transform((s, ctx) => {
  const p = normalizePhone(s);
  if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid Sri Lankan mobile number (07X XXX XXXX)" });
  return p ?? "";
});

export const salonProfileSchema = z.object({
  name: clean(60, 2),
  tagline: clean(100),
  description: clean(1000),
  phone: clean(20),
  whatsapp: clean(20),
  address: clean(200),
  city: clean(60),
  primaryColor: hexColor,
  accentColor: hexColor,
  slotStep: z.coerce.number().refine((n) => [15, 30, 60].includes(n), "Invalid"),
  cancelCutoffHours: z.coerce.number().int().min(0).max(72),
  maxAdvanceDays: z.coerce.number().int().min(1).max(90),
});

export const serviceSchema = z.object({
  name: clean(60, 2),
  description: clean(300),
  price: z.coerce.number().int().min(0).max(1_000_000),
  durationMin: z.coerce.number().int().min(5).max(480),
});

export const workerSchema = z.object({ name: clean(60, 2), bio: clean(200) });

export const offerSchema = z.object({
  title: clean(60, 2),
  description: clean(200),
  discountPercent: z.coerce.number().int().min(1).max(90),
  startsOn: dateSchema,
  endsOn: dateSchema,
});

export const nameSchema = clean(60, 2);

export function parseHoursForm(fd: FormData): DayHours[] | string {
  const out: DayHours[] = [];
  for (let i = 0; i < 7; i++) {
    const closed = fd.get(`closed${i}`) === "on";
    const open = timeToMin(String(fd.get(`open${i}`) ?? ""));
    const close = timeToMin(String(fd.get(`close${i}`) ?? ""));
    if (open === null || close === null) return "Invalid opening hours";
    if (!closed && close <= open) return "Closing time must be after opening time";
    out.push({ closed, open, close });
  }
  return out;
}

export function timeToMin(s: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Validates an uploaded logo by size AND magic bytes (never trusts the client MIME/extension). SVG is rejected on purpose. */
export async function readLogo(file: FormDataEntryValue | null): Promise<{ data: string; mime: string } | null | string> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 200 * 1024) return "Logo must be 200 KB or smaller";
  const buf = Buffer.from(await file.arrayBuffer());
  let mime: string | null = null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) mime = "image/png";
  else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) mime = "image/jpeg";
  else if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") mime = "image/webp";
  if (!mime) return "Logo must be a PNG, JPEG or WebP image";
  return { data: buf.toString("base64"), mime };
}

export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
}

export type State = { ok?: boolean; error?: string; message?: string };
export const fail = (error: string): State => ({ error });
export const done = (message = "Saved"): State => ({ ok: true, message });
export const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";
