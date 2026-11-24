// Demo data for local testing:  npm run db:seed
try { process.loadEnvFile(".env.local"); } catch {}
import { db } from "../src/lib/db";
import { offers, salons, services, staffUsers, workerServices, workers } from "../src/lib/schema";
import { scrypt, randomBytes } from "node:crypto";
const hashPassword = (pw: string) => new Promise<string>((res, rej) => { const salt = randomBytes(16); scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => e ? rej(e) : res(`s1.${salt.toString("base64url")}.${k.toString("base64url")}`)); });

async function main() {
  const salonId = crypto.randomUUID();
  const hours = JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ closed: i === 0, open: 540, close: 1140 })));
  await db.insert(salons).values({
    id: salonId, slug: "glam-cuts", name: "Glam Cuts", tagline: "Premium cuts in Colombo", city: "Colombo",
    description: "Modern barber shop and beauty salon.", phone: "0771234567", whatsapp: "0771234567", address: "12 Galle Road, Colombo 03",
    primaryColor: "#1f2937", accentColor: "#e9b872", hours, autoConfirm: false,
  });
  await db.insert(staffUsers).values({ salonId, username: "glam-owner", displayName: "Glam Owner", role: "owner", passwordHash: await hashPassword("Demo-Owner-2026") });
  const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
  await db.insert(workers).values([{ id: a, salonId, name: "Kasun", bio: "Fade specialist" }, { id: b, salonId, name: "Nimal", bio: "Beard & shave" }]);
  const [s1, s2, s3] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  await db.insert(services).values([
    { id: s1, salonId, name: "Haircut", price: 1500, durationMin: 30 },
    { id: s2, salonId, name: "Beard trim", price: 800, durationMin: 20 },
    { id: s3, salonId, name: "Haircut + Beard", price: 2100, durationMin: 50 },
  ]);
  await db.insert(workerServices).values([
    { workerId: a, serviceId: s1 }, { workerId: a, serviceId: s3 }, { workerId: b, serviceId: s2 }, { workerId: b, serviceId: s3 },
  ]);
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(offers).values({ salonId, title: "Weekend Special", discountPercent: 10, serviceId: s1, startsOn: today, endsOn: "2099-12-31" });
  console.log("Seeded demo salon: /glam-cuts   staff login: glam-owner / Demo-Owner-2026");
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
