import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { importRuns, InsertUser, ledgerEvents, ledgerUnits, signalQueue, syncSources, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export type NormalizedLedgerRow = {
  imei: string;
  sku?: string;
  modelFamily?: string;
  color?: string;
  lot?: string;
  location?: string;
  currentState?: string;
  eventType?: string;
  eventAt?: number;
  party?: string;
  courier?: string;
  sourceSheet?: string;
  rawEvidence?: string;
};

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date(); updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createImportRun(userId: number, sourceType: string, sourceName: string, rowCount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const now = Date.now();
  const result = await db.insert(importRuns).values({ userId, sourceType, sourceName, rowCount, createdAt: now });
  return Number((result as unknown as { insertId: number }).insertId);
}

export async function ingestLedgerRows(userId: number, importRunId: number, rows: NormalizedLedgerRow[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  let acceptedCount = 0;
  let rejectedCount = 0;
  const rejected: string[] = [];
  const now = Date.now();
  for (const row of rows.slice(0, 5000)) {
    const imei = row.imei.replace(/\D/g, "");
    if (imei.length < 10 || imei.length > 20) { rejectedCount++; rejected.push(row.imei.slice(0, 24)); continue; }
    const qualityScore = Math.min(100, 40 + (row.sku ? 15 : 0) + (row.color ? 10 : 0) + (row.lot ? 10 : 0) + (row.location ? 15 : 0) + (row.currentState ? 10 : 0));
    const riskScore = /#ref|repair|damage|return|unknown|unsold/i.test(`${row.currentState} ${row.location} ${row.rawEvidence}`) ? 70 : row.currentState ? 25 : 45;
    const existing = await db.select().from(ledgerUnits).where(and(eq(ledgerUnits.userId, userId), eq(ledgerUnits.imei, imei))).limit(1);
    let unitId: number;
    if (existing[0]) {
      unitId = existing[0].id;
      await db.update(ledgerUnits).set({ sku: row.sku ?? existing[0].sku, modelFamily: row.modelFamily ?? existing[0].modelFamily, color: row.color ?? existing[0].color, lot: row.lot ?? existing[0].lot, location: row.location ?? existing[0].location, currentState: row.currentState ?? existing[0].currentState, qualityScore: Math.max(qualityScore, existing[0].qualityScore), riskScore: Math.max(riskScore, existing[0].riskScore), lastEventAt: row.eventAt ?? existing[0].lastEventAt, updatedAt: now }).where(eq(ledgerUnits.id, unitId));
    } else {
      const result = await db.insert(ledgerUnits).values({ userId, imei, sku: row.sku, modelFamily: row.modelFamily, color: row.color, lot: row.lot, location: row.location, currentState: row.currentState, qualityScore, riskScore, lastEventAt: row.eventAt, createdAt: now, updatedAt: now });
      unitId = Number((result as unknown as { insertId: number }).insertId);
    }
    await db.insert(ledgerEvents).values({ userId, unitId, importRunId, eventType: row.eventType ?? "observed", eventAt: row.eventAt, state: row.currentState, location: row.location, party: row.party, courier: row.courier, sourceSheet: row.sourceSheet, rawEvidence: row.rawEvidence, createdAt: now });
    acceptedCount++;
  }
  await db.update(importRuns).set({ status: "completed", acceptedCount, rejectedCount, errorSummary: rejected.length ? rejected.slice(0, 25).join(", ") : null, completedAt: Date.now() }).where(eq(importRuns.id, importRunId));
  return { acceptedCount, rejectedCount, rejected: rejected.slice(0, 25) };
}

export async function getLedgerSummary(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [totals, states, quality, imports, signals] = await Promise.all([
    db.select({ units: sql<number>`count(*)`, atRisk: sql<number>`sum(case when ${ledgerUnits.riskScore} >= 60 then 1 else 0 end)`, avgQuality: sql<number>`round(avg(${ledgerUnits.qualityScore}))` }).from(ledgerUnits).where(eq(ledgerUnits.userId, userId)),
    db.select({ state: ledgerUnits.currentState, count: sql<number>`count(*)` }).from(ledgerUnits).where(eq(ledgerUnits.userId, userId)).groupBy(ledgerUnits.currentState).orderBy(desc(sql`count(*)`)).limit(8),
    db.select({ perfect: sql<number>`sum(case when ${ledgerUnits.qualityScore} >= 90 then 1 else 0 end)`, weak: sql<number>`sum(case when ${ledgerUnits.qualityScore} < 60 then 1 else 0 end)` }).from(ledgerUnits).where(eq(ledgerUnits.userId, userId)),
    db.select().from(importRuns).where(eq(importRuns.userId, userId)).orderBy(desc(importRuns.createdAt)).limit(8),
    db.select().from(signalQueue).where(and(eq(signalQueue.userId, userId), eq(signalQueue.status, "open"))).orderBy(desc(signalQueue.score)).limit(8),
  ]);
  return { totals: totals[0], states, quality: quality[0], imports, signals };
}

export async function listSyncSources(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(syncSources).where(eq(syncSources.userId, userId)).orderBy(desc(syncSources.updatedAt));
}

export async function createSyncSource(userId: number, input: { provider: string; label: string; spreadsheetUrl?: string; externalId?: string; authMode: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const now = Date.now();
  const result = await db.insert(syncSources).values({ userId, provider: input.provider, label: input.label, spreadsheetUrl: input.spreadsheetUrl, externalId: input.externalId, authMode: input.authMode, createdAt: now, updatedAt: now });
  return { sourceId: Number((result as unknown as { insertId: number }).insertId), sources: await listSyncSources(userId) };
}

export async function getSyncSource(userId: number, sourceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const result = await db.select().from(syncSources).where(and(eq(syncSources.userId, userId), eq(syncSources.id, sourceId))).limit(1);
  return result[0];
}

export async function saveGoogleTokens(sourceId: number, input: { accessTokenEnc: string; refreshTokenEnc?: string; tokenExpiresAt?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(syncSources).set({ accessTokenEnc: input.accessTokenEnc, refreshTokenEnc: input.refreshTokenEnc, tokenExpiresAt: input.tokenExpiresAt, status: "connected", authMode: "oauth", updatedAt: Date.now() }).where(eq(syncSources.id, sourceId));
}

export async function markSourceSynced(sourceId: number, rowCount: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(syncSources).set({ status: "synced", rowCount, lastSyncedAt: Date.now(), updatedAt: Date.now() }).where(eq(syncSources.id, sourceId));
}
