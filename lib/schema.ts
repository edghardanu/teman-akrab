import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time").notNull(),
  location: text("location").notNull(),
  description: text("description"),
  status: text("status", { enum: ["draft", "active", "finished"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const villages = sqliteTable("villages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const eventVillages = sqliteTable("event_villages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  villageId: integer("village_id").notNull().references(() => villages.id),
}, (table) => ({ eventVillageUnique: uniqueIndex("event_villages_unique").on(table.eventId, table.villageId), villageIdx: index("event_villages_village_idx").on(table.villageId) }));

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  villageId: integer("village_id").notNull().references(() => villages.id),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
}, (table) => ({ villageNameUnique: uniqueIndex("groups_village_name_unique").on(table.villageId, table.name), villageIdx: index("groups_village_idx").on(table.villageId) }));

export const attendances = sqliteTable("attendances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull().references(() => events.id),
  fullName: text("full_name").notNull(),
  normalizedFullName: text("normalized_full_name").notNull().default(""),
  villageId: integer("village_id").notNull().references(() => villages.id),
  groupId: integer("group_id").notNull().references(() => groups.id),
  age: integer("age"),
  gender: text("gender", { enum: ["male", "female", "unknown"] }).notNull().default("unknown"),
  occupation: text("occupation").notNull(),
  additionalNotes: text("additional_notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueAttendance: uniqueIndex("attendances_no_duplicates").on(table.eventId, table.normalizedFullName, table.villageId, table.groupId),
  eventIdx: index("attendances_event_idx").on(table.eventId),
  villageIdx: index("attendances_village_idx").on(table.villageId),
  groupIdx: index("attendances_group_idx").on(table.groupId),
}));

export const eventGroups = sqliteTable("event_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const eventGroupMembers = sqliteTable("event_group_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventGroupId: integer("event_group_id").notNull().references(() => eventGroups.id, { onDelete: "cascade" }),
  attendanceId: integer("attendance_id").notNull().unique().references(() => attendances.id, { onDelete: "cascade" }),
});

export const loginAttempts = sqliteTable("login_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ipHash: text("ip_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({ ipTimeIdx: index("login_attempts_ip_time_idx").on(table.ipHash, table.createdAt) }));

export const rateLimits = sqliteTable("rate_limits", {
  key: text("rate_key").notNull(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => ({ primary: uniqueIndex("rate_limits_key_window").on(table.key, table.windowStart) }));
