import { bigint, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const importRuns = mysqlTable("import_runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceType: varchar("sourceType", { length: 32 }).notNull(),
  sourceName: varchar("sourceName", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("processing"),
  rowCount: int("rowCount").notNull().default(0),
  acceptedCount: int("acceptedCount").notNull().default(0),
  rejectedCount: int("rejectedCount").notNull().default(0),
  errorSummary: text("errorSummary"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  completedAt: bigint("completedAt", { mode: "number" }),
}, table => ({ userCreatedIdx: index("import_runs_user_created_idx").on(table.userId, table.createdAt) }));

export const ledgerUnits = mysqlTable("ledger_units", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  imei: varchar("imei", { length: 32 }).notNull(),
  sku: varchar("sku", { length: 180 }),
  modelFamily: varchar("modelFamily", { length: 120 }),
  color: varchar("color", { length: 80 }),
  lot: varchar("lot", { length: 180 }),
  location: varchar("location", { length: 100 }),
  currentState: varchar("currentState", { length: 64 }),
  qualityScore: int("qualityScore").notNull().default(0),
  riskScore: int("riskScore").notNull().default(0),
  lastEventAt: bigint("lastEventAt", { mode: "number" }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ imeiUserUnique: index("ledger_units_user_imei_idx").on(table.userId, table.imei), stateIdx: index("ledger_units_state_idx").on(table.userId, table.currentState) }));

export const ledgerEvents = mysqlTable("ledger_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  unitId: int("unitId").notNull(),
  importRunId: int("importRunId"),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  eventAt: bigint("eventAt", { mode: "number" }),
  state: varchar("state", { length: 64 }),
  location: varchar("location", { length: 100 }),
  party: varchar("party", { length: 180 }),
  courier: varchar("courier", { length: 100 }),
  sourceSheet: varchar("sourceSheet", { length: 180 }),
  rawEvidence: text("rawEvidence"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
}, table => ({ unitEventIdx: index("ledger_events_unit_event_idx").on(table.userId, table.unitId, table.eventAt) }));

export const signalQueue = mysqlTable("signal_queue", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  severity: varchar("severity", { length: 24 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  evidence: text("evidence").notNull(),
  recommendedAction: text("recommendedAction").notNull(),
  score: int("score").notNull().default(0),
  status: varchar("status", { length: 24 }).notNull().default("open"),
  ownerName: varchar("ownerName", { length: 120 }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ signalIdx: index("signal_queue_user_status_idx").on(table.userId, table.status, table.score) }));

export const syncSources = mysqlTable("sync_sources", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  label: varchar("label", { length: 180 }).notNull(),
  externalId: varchar("externalId", { length: 180 }),
  spreadsheetUrl: text("spreadsheetUrl"),
  status: varchar("status", { length: 32 }).notNull().default("configured"),
  authMode: varchar("authMode", { length: 32 }).notNull().default("public_csv"),
  accessTokenEnc: text("accessTokenEnc"),
  refreshTokenEnc: text("refreshTokenEnc"),
  tokenExpiresAt: bigint("tokenExpiresAt", { mode: "number" }),
  lastSyncedAt: bigint("lastSyncedAt", { mode: "number" }),
  rowCount: int("rowCount").notNull().default(0),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({ syncUserIdx: index("sync_sources_user_idx").on(table.userId, table.provider, table.status) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ImportRun = typeof importRuns.$inferSelect;
export type LedgerUnit = typeof ledgerUnits.$inferSelect;
export type LedgerEvent = typeof ledgerEvents.$inferSelect;
export type SyncSource = typeof syncSources.$inferSelect;
