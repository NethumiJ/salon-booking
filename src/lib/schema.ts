import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const pk = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer("created_at").notNull().$defaultFn(() => Date.now());

export const salons = sqliteTable("salons", {
  id: pk(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  phone: text("phone").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  primaryColor: text("primary_color").notNull().default("#111827"),
  accentColor: text("accent_color").notNull().default("#d4a373"),
  logoData: text("logo_data"), // base64, validated by magic bytes, <=200KB
  logoMime: text("logo_mime"),
  logoVersion: integer("logo_version").notNull().default(0),
  hours: text("hours").notNull(), // JSON: 7 x {closed, open, close} (Sun..Sat, minutes)
  slotStep: integer("slot_step").notNull().default(30),
  autoConfirm: integer("auto_confirm", { mode: "boolean" }).notNull().default(false),
  cancelCutoffHours: integer("cancel_cutoff_hours").notNull().default(2),
  maxAdvanceDays: integer("max_advance_days").notNull().default(30),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const staffUsers = sqliteTable("staff_users", {
  id: pk(),
  salonId: text("salon_id").notNull().references(() => salons.id, { onDelete: "cascade" }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["owner", "manager"] }).notNull().default("manager"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const workers = sqliteTable("workers", {
  id: pk(),
  salonId: text("salon_id").notNull().references(() => salons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index("workers_salon_idx").on(t.salonId)]);

export const services = sqliteTable("services", {
  id: pk(),
  salonId: text("salon_id").notNull().references(() => salons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(), // LKR
  durationMin: integer("duration_min").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index("services_salon_idx").on(t.salonId)]);

export const workerServices = sqliteTable("worker_services", {
  workerId: text("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.workerId, t.serviceId] })]);

export const workerLeaves = sqliteTable("worker_leaves", {
  id: pk(),
  workerId: text("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  salonId: text("salon_id").notNull().references(() => salons.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  reason: text("reason").notNull().default(""),
}, (t) => [uniqueIndex("leave_unique").on(t.workerId, t.date)]);

export const offers = sqliteTable("offers", {
  id: pk(),
  salonId: text("salon_id").notNull().references(() => salons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  discountPercent: integer("discount_percent").notNull(),
  serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }), // null = all services
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (t) => [index("offers_salon_idx").on(t.salonId)]);

export const customers = sqliteTable("customers", {
  id: pk(),
  salonId: text("salon_id").notNull().references(() => salons.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(), // +947XXXXXXXX
  name: text("name").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("customer_phone_unique").on(t.salonId, t.phone)]);

export const otpCodes = sqliteTable("otp_codes", {
  id: pk(),
  salonId: text("salon_id").notNull(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("otp_lookup").on(t.salonId, t.phone)]);

export const bookings = sqliteTable("bookings", {
  id: pk(),
  salonId: text("salon_id").notNull().references(() => salons.id, { onDelete: "cascade" }),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  workerId: text("worker_id").notNull().references(() => workers.id),
  serviceId: text("service_id").notNull().references(() => services.id),
  serviceName: text("service_name").notNull(),
  workerName: text("worker_name").notNull(),
  originalPrice: integer("original_price").notNull(),
  price: integer("price").notNull(),
  offerTitle: text("offer_title"),
  durationMin: integer("duration_min").notNull(),
  date: text("date").notNull(),
  startMin: integer("start_min").notNull(),
  endMin: integer("end_min").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "cancelled", "completed", "no_show"] }).notNull(),
  cancelledBy: text("cancelled_by", { enum: ["customer", "salon"] }),
  note: text("note").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [
  index("bookings_salon_date").on(t.salonId, t.date),
  index("bookings_customer").on(t.customerId),
  // Hard guarantee against double-booking the exact same slot (overlaps are checked in a transaction)
  uniqueIndex("bookings_slot_unique").on(t.workerId, t.date, t.startMin).where(sql`status IN ('pending','confirmed')`),
]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(),
});

export type Salon = typeof salons.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
