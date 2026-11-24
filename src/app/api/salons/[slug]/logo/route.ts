import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { salons } from "@/lib/schema";

export async function GET(_: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return new Response("Not found", { status: 404 });
  const s = await db.select({ d: salons.logoData, m: salons.logoMime, a: salons.active }).from(salons).where(eq(salons.slug, slug)).get();
  if (!s?.d || !s.m || !s.a) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(s.d, "base64"), {
    headers: {
      "Content-Type": s.m, // only png/jpeg/webp are ever stored (magic-byte checked)
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "public, max-age=31536000, immutable", // URL is versioned with ?v=
    },
  });
}
