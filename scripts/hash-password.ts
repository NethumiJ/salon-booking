// Usage: npm run hash-password -- "your-admin-password"
// Paste the output into ADMIN_PASSWORD_HASH (Vercel env var / .env.local).
import { scrypt, randomBytes } from "node:crypto";

const pw = process.argv[2];
if (!pw || pw.length < 12) { console.error("Provide a password of 12+ characters"); process.exit(1); }
const salt = randomBytes(16);
scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => {
  if (e) throw e;
  console.log(`s1.${salt.toString("base64url")}.${k.toString("base64url")}`);
});
