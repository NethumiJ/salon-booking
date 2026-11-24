import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { salons } from "@/lib/schema";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const list = await db.select({ slug: salons.slug }).from(salons).where(eq(salons.active, true));
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    ...list.map((s) => ({ url: `${SITE}/${s.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
