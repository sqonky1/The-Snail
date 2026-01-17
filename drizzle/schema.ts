import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Game profiles extending user data with game-specific fields.
 * Each user has one profile with salt balance and home zone coordinates.
 */
export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  salt: int("salt").default(0).notNull(),
  homeCoords: text("home_coords").notNull(), // JSON string: {lat: number, lng: number}
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

/**
 * Snails represent game pieces moving between players.
 * Each snail has a sender, receiver, route (encoded polyline), and status.
 */
export const snails = mysqlTable("snails", {
  id: int("id").autoincrement().primaryKey(),
  senderId: int("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: int("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  encodedPolyline: text("encoded_polyline").notNull(), // Google Encoded Polyline
  startTime: timestamp("start_time").notNull(), // Unix timestamp when snail was deployed
  status: mysqlEnum("status", ["active", "captured", "breached"]).default("active").notNull(),
  capturedBy: int("captured_by").references(() => users.id, { onDelete: "set null" }),
  capturedAt: timestamp("captured_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Snail = typeof snails.$inferSelect;
export type InsertSnail = typeof snails.$inferInsert;

/**
 * Friendships table for managing friend relationships.
 */
export const friendships = mysqlTable("friendships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  friendId: int("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;