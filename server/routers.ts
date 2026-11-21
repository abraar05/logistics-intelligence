import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createImportRun, createSyncSource, getLedgerSummary, ingestLedgerRows, listSyncSources, markSourceSynced } from "./db";
import { buildGoogleAuthUrl, createGoogleState, normalizeSheetMatrix, readPrivateSheet } from "./googleSheets";

const ledgerRowSchema = z.object({
  imei: z.string().min(1).max(40),
  sku: z.string().max(180).optional(),
  modelFamily: z.string().max(120).optional(),
  color: z.string().max(80).optional(),
  lot: z.string().max(180).optional(),
  location: z.string().max(100).optional(),
  currentState: z.string().max(64).optional(),
  eventType: z.string().max(64).optional(),
  eventAt: z.number().int().optional(),
  party: z.string().max(180).optional(),
  courier: z.string().max(100).optional(),
  sourceSheet: z.string().max(180).optional(),
  rawEvidence: z.string().max(4000).optional(),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  ledger: router({
    summary: protectedProcedure.query(({ ctx }) => getLedgerSummary(ctx.user.id)),
    ingest: protectedProcedure.input(z.object({ sourceType: z.enum(["excel", "csv", "google_sheets"]), sourceName: z.string().min(1).max(255), rows: z.array(ledgerRowSchema).max(5000) })).mutation(async ({ ctx, input }) => {
      const importRunId = await createImportRun(ctx.user.id, input.sourceType, input.sourceName, input.rows.length);
      const result = await ingestLedgerRows(ctx.user.id, importRunId, input.rows);
      return { importRunId, ...result };
    }),
    syncSources: protectedProcedure.query(({ ctx }) => listSyncSources(ctx.user.id)),
    connectSource: protectedProcedure.input(z.object({ provider: z.enum(["google_sheets", "excel_upload"]), label: z.string().min(1).max(180), spreadsheetUrl: z.string().url().optional(), externalId: z.string().max(180).optional(), authMode: z.enum(["public_csv", "oauth_ready", "local_file"]) })).mutation(({ ctx, input }) => createSyncSource(ctx.user.id, input)),
    prepareGoogleOAuth: protectedProcedure.input(z.object({ sourceId: z.number().int() })).mutation(async ({ ctx, input }) => buildGoogleAuthUrl(ctx.req, createGoogleState(ctx.user.id, input.sourceId))),
    syncPrivateSource: protectedProcedure.input(z.object({ sourceId: z.number().int() })).mutation(async ({ ctx, input }) => {
      const rows = normalizeSheetMatrix(await readPrivateSheet(ctx.user.id, input.sourceId), `Google source ${input.sourceId}`);
      const importRunId = await createImportRun(ctx.user.id, "google_sheets", `Private Google source ${input.sourceId}`, rows.length);
      const result = await ingestLedgerRows(ctx.user.id, importRunId, rows);
      await markSourceSynced(input.sourceId, result.acceptedCount);
      return { importRunId, ...result };
    }),
  }),
});

export type AppRouter = typeof appRouter;
