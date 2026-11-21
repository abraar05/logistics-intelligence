import { describe, expect, it } from "vitest";
import { createGoogleState, decryptToken, encryptToken, normalizeSheetMatrix, readGoogleState } from "./googleSheets";

describe("google sheets adapter", () => {
  it("round-trips encrypted tokens without exposing plaintext", () => {
    const token = "refresh-token-for-test";
    const encrypted = encryptToken(token);
    expect(encrypted).not.toContain(token);
    expect(decryptToken(encrypted)).toBe(token);
  });

  it("signs and reads state payloads", () => {
    const state = createGoogleState(7, 19);
    expect(readGoogleState(state)).toEqual({ userId: 7, sourceId: 19 });
  });

  it("normalizes an IMEI worksheet into ledger observations", () => {
    const rows = normalizeSheetMatrix([
      ["Model", "IMEI", "Location", "Status", "Date"],
      ["Pixel 8", "356789012345678", "Alpana", "stock", "2026-09-01"],
    ], "Inventory");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ imei: "356789012345678", location: "Alpana", currentState: "stock", sourceSheet: "Inventory" });
  });
});
