import "server-only";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { salons } from "./schema";
import { done, fail, firstError, parseHoursForm, readLogo, salonProfileSchema, type State } from "./validation";

/** Shared by the admin panel and the salon owner's settings page. Always scoped by salonId. */
export async function saveProfile(salonId: string, fd: FormData): Promise<State> {
  const parsed = salonProfileSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(firstError(parsed.error));
  const hours = parseHoursForm(fd);
  if (typeof hours === "string") return fail(hours);
  const logo = await readLogo(fd.get("logo"));
  if (typeof logo === "string") return fail(logo);

  const current = await db.select({ v: salons.logoVersion }).from(salons).where(eq(salons.id, salonId)).get();
  if (!current) return fail("Salon not found");

  const removeLogo = fd.get("removeLogo") === "on";
  await db.update(salons).set({
    ...parsed.data,
    autoConfirm: fd.get("autoConfirm") === "on",
    hours: JSON.stringify(hours),
    ...(logo ? { logoData: logo.data, logoMime: logo.mime, logoVersion: current.v + 1 }
      : removeLogo ? { logoData: null, logoMime: null, logoVersion: current.v + 1 } : {}),
  }).where(eq(salons.id, salonId));

  revalidatePath("/", "layout");
  return done("Profile saved");
}
