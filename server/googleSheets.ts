import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { getSyncSource, markSourceSynced, NormalizedLedgerRow, saveGoogleTokens, upsertUser, getUserByOpenId } from "./db";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
const oauthSecret = () => crypto.createHash("sha256").update(process.env.JWT_SECRET || "development-only-secret").digest();
const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

export function encryptToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", oauthSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptToken(payload: string) {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted token");
  const decipher = crypto.createDecipheriv("aes-256-gcm", oauthSecret(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function createGoogleState(userId: number, sourceId: number) {
  const payload = `${userId}:${sourceId}:${Date.now() + 10 * 60 * 1000}:${crypto.randomBytes(12).toString("hex")}`;
  const signature = crypto.createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  return `${encode(payload)}.${signature}`;
}

export function readGoogleState(state: string) {
  const [payloadValue, signature] = state.split(".");
  if (!payloadValue || !signature) throw new Error("Invalid OAuth state");
  const payload = decode(payloadValue);
  const expected = crypto.createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("OAuth state signature mismatch");
  const [userId, sourceId, expiresAt] = payload.split(":");
  if (!userId || !sourceId || !expiresAt || Number(expiresAt) < Date.now()) throw new Error("OAuth state expired");
  return { userId: Number(userId), sourceId: Number(sourceId) };
}

export function createGoogleAuthState() {
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const payload = `${expiresAt}:${crypto.randomBytes(12).toString("hex")}`;
  const signature = crypto.createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  return `${encode(payload)}.${signature}`;
}

export function readGoogleAuthState(state: string) {
  const [payloadValue, signature] = state.split(".");
  if (!payloadValue || !signature) throw new Error("Invalid OAuth state");
  const payload = decode(payloadValue);
  const expected = crypto.createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("OAuth state signature mismatch");
  const [expiresAt, nonce] = payload.split(":");
  if (!expiresAt || !nonce || Number(expiresAt) < Date.now()) throw new Error("OAuth state expired");
  return { nonce, expiresAt: Number(expiresAt) };
}

function redirectUri(req: Request) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const host = req.get("host");
  return `${req.protocol}://${host}/api/google/callback`;
}

export function buildGoogleAuthUrl(req: Request, state: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri(req), response_type: "code", access_type: "offline", prompt: "consent", scope: SHEETS_SCOPE, state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(req: Request, code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri(req), grant_type: "authorization_code" }) });
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status})`);
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>;
}

async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Google user info failed (${response.status})`);
  return response.json() as Promise<{ sub?: string; email?: string | null; name?: string | null }>;
}

async function refreshAccessToken(source: { accessTokenEnc: string | null; refreshTokenEnc: string | null; tokenExpiresAt: number | null }) {
  if (!source.refreshTokenEnc) return source.accessTokenEnc ? decryptToken(source.accessTokenEnc) : null;
  if (source.accessTokenEnc && source.tokenExpiresAt && source.tokenExpiresAt > Date.now() + 60_000) return decryptToken(source.accessTokenEnc);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: decryptToken(source.refreshTokenEnc), grant_type: "refresh_token" }) });
  if (!response.ok) throw new Error(`Google token refresh failed (${response.status})`);
  const token = await response.json() as { access_token: string; expires_in?: number };
  return token.access_token;
}

export async function readPrivateSheet(userId: number, sourceId: number) {
  const source = await getSyncSource(userId, sourceId);
  if (!source?.externalId || !source.accessTokenEnc) throw new Error("Google Sheet source is not connected");
  const token = await refreshAccessToken(source);
  if (!token) throw new Error("No Google access token available");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(source.externalId)}/values/A:ZZ?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Google Sheets read failed (${response.status})`);
  const body = await response.json() as { values?: unknown[][] };
  const rows = body.values ?? [];
  await markSourceSynced(sourceId, rows.length);
  return rows;
}

export function normalizeSheetMatrix(matrix: unknown[][], sourceName: string): NormalizedLedgerRow[] {
  const headerIndex = matrix.findIndex(row => row.some(cell => /imei|imie/i.test(String(cell))));
  if (headerIndex < 0) return [];
  const headers = (matrix[headerIndex] ?? []).map(cell => String(cell).trim().toLowerCase());
  const indexOf = (patterns: RegExp[]) => headers.findIndex(header => patterns.some(pattern => pattern.test(header)));
  const imeiIndex = indexOf([/imei|imie/]);
  const skuIndex = indexOf([/sku|variant|product|model/]);
  const statusIndex = indexOf([/status|state|stats/]);
  const locationIndex = indexOf([/location|loc/]);
  const dateIndex = indexOf([/date|dt/]);
  if (imeiIndex < 0) return [];
  return matrix.slice(headerIndex + 1).flatMap(row => {
    const imei = String(row[imeiIndex] ?? "").replace(/\D/g, "");
    if (imei.length < 10 || imei.length > 20) return [];
    const dateValue = String(dateIndex >= 0 ? row[dateIndex] ?? "" : "");
    const eventAt = dateValue ? Date.parse(dateValue) : undefined;
    return [{ imei, sku: skuIndex >= 0 ? String(row[skuIndex] ?? "").trim() : undefined, location: locationIndex >= 0 ? String(row[locationIndex] ?? "").trim() : undefined, currentState: statusIndex >= 0 ? String(row[statusIndex] ?? "").trim() : undefined, eventType: "google_sheets_observation", eventAt: eventAt && !Number.isNaN(eventAt) ? eventAt : undefined, sourceSheet: sourceName, rawEvidence: row.map(cell => String(cell ?? "")).filter(Boolean).slice(0, 18).join(" | ") }];
  }).slice(0, 5000);
}

export function registerGoogleSheetsRoutes(app: Express) {
  app.get("/api/auth/google/start", async (req, res) => {
    try {
      const sourceId = Number(req.query.sourceId || 0);
      if (!sourceId) {
        const state = createGoogleAuthState();
        res.redirect(buildGoogleAuthUrl(req, state));
        return;
      }
      const user = await sdk.authenticateRequest(req);
      if (!user) return res.status(401).send("Sign in and choose a sync source first");
      const source = await getSyncSource(user.id, sourceId);
      if (!source) return res.status(404).send("Sync source not found");
      res.redirect(buildGoogleAuthUrl(req, createGoogleState(user.id, sourceId)));
    } catch (error) { res.status(500).send(error instanceof Error ? error.message : "OAuth configuration error"); }
  });

  app.get("/api/google/callback", async (req: Request, res: Response) => {
    try {
      const sourceId = Number(req.query.sourceId || 0);
      const code = String(req.query.code || "");
      if (!code) return res.status(400).send("Google authorization code missing");
      if (!sourceId) {
        const authState = readGoogleAuthState(String(req.query.state || ""));
        const token = await exchangeCode(req, code);
        const googleUser = await getGoogleUserInfo(token.access_token);
        const userRecord = await upsertUser({
          openId: googleUser.sub ?? "",
          name: googleUser.name ?? null,
          email: googleUser.email ?? null,
          loginMethod: "google",
          lastSignedIn: new Date(),
        });
        const user = await getUserByOpenId(googleUser.sub ?? "");
        const sessionToken = await sdk.createSessionToken(user?.openId ?? googleUser.sub ?? "", { name: googleUser.name || "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        res.redirect("/");
        return;
      }
      const state = readGoogleState(String(req.query.state || ""));
      const source = await getSyncSource(state.userId, state.sourceId);
      if (!source) return res.status(404).send("Sync source not found");
      const token = await exchangeCode(req, code);
      await saveGoogleTokens(state.sourceId, { accessTokenEnc: encryptToken(token.access_token), refreshTokenEnc: token.refresh_token ? encryptToken(token.refresh_token) : source.refreshTokenEnc ?? undefined, tokenExpiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined });
      res.redirect("/?google=connected#data");
    } catch (error) { res.status(400).send(error instanceof Error ? error.message : "Google OAuth callback failed"); }
  });
}
