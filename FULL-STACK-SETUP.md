# Logistics Intelligence — full-system setup

## What is included

This release upgrades the command center from a static workbook view into a full-stack intelligence system:

1. **Canonical IMEI ledger.** Excel, CSV, public Google Sheets, and private Google Sheets observations are normalized into a durable unit-and-event model. Repeated IMEIs are merged, evidence is preserved, and each import produces an auditable run record.
2. **Decision analytics.** The dashboard now separates directional workbook signals from metrics that require stronger event data. Aging exposure, delivery SLA, returns, and service-cost readiness are presented as decision lanes rather than false-precision charts.
3. **Private Google Sheets connector.** Users can authorize read-only access through Google OAuth. Access and refresh tokens are encrypted server-side with AES-256-GCM and are never sent to the browser. A successful OAuth callback automatically refreshes the selected source into the canonical ledger.
4. **Export and handoff.** The existing intelligence workbook export remains available for review and planning.

## Recommended deployment

The complete version is a Node.js + Express + MySQL/TiDB application. Use the managed WebDev deployment or another Node-capable host. InfinityFree shared hosting is suitable only for the static preview because it does not provide the Node server and database runtime required by the protected ledger and OAuth routes.

### Local or Node-capable host

```bash
pnpm install
pnpm db:push
pnpm check
pnpm build
pnpm start
```

The production server listens on `PORT` or the first available port after 3000.

### Required environment variables

The WebDev deployment supplies the Manus application and database variables. Do not hard-code or commit them.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session signing and OAuth-token encryption key material |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend |
| `VITE_OAUTH_PORTAL_URL` | Browser login portal |
| `GOOGLE_CLIENT_ID` | Google OAuth web application client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret; server-only |
| `GOOGLE_REDIRECT_URI` | Exact callback URL, normally `https://your-host.example/api/google/callback` |

The `GOOGLE_*` variables are optional until private Sheets OAuth is needed. Public CSV import and local workbook import do not need them.

## Google Sheets private OAuth setup

1. Create or select a Google Cloud project.
2. Enable the Google Sheets API.
3. Configure the OAuth consent screen and add the application support email.
4. Create an OAuth client with application type **Web application**.
5. Add the exact redirect URI ending in `/api/google/callback`. Google requires an exact match.
6. Add the client ID and secret to the server environment. Never place the secret in `VITE_*` variables.
7. In the dashboard, sign in, paste the private spreadsheet URL, and choose **Authorize private sheet**.
8. Approve the read-only Sheets scope. The callback stores encrypted tokens and refreshes the selected sheet into the ledger.

The adapter requests only `https://www.googleapis.com/auth/spreadsheets.readonly` and reads the `A:ZZ` range from the selected spreadsheet ID. The server converts the worksheet into IMEI observations and stores raw evidence on each event.

## Database migration

The project includes two reviewed Drizzle migrations:

- `drizzle/0000_lively_lilith.sql` creates users, import runs, ledger units, ledger events, signal queue, and sync sources.
- `drizzle/0001_large_tempest.sql` adds encrypted token columns for private Google OAuth.

The managed database was applied with equivalent non-destructive `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements. For another host, run `pnpm db:push` after setting `DATABASE_URL`.

## Operational workflow

1. Sign in from the top-right of the command center.
2. Import a workbook or connect a public/private Google Sheet.
3. Review the accepted and rejected observation counts.
4. Use **Signal lab** for evidence-backed exceptions.
5. Use **Decision analytics** to see which operational questions are measurable now and which fields must be instrumented before assigning a dollar value.
6. Export the intelligence workbook for a planning meeting or handoff.

The current source workbook does not contain dependable service-cost or complete delivery timestamps. The dashboard deliberately labels those lanes as data-contract work instead of inventing values.

## InfinityFree static package

Use the separately delivered `logistics-intelligence-infinityfree.zip` only for a static preview on InfinityFree. Upload its contents to `public_html` using the hosting file manager or FTP. The package includes:

- the compiled dashboard UI;
- `.htaccess` SPA routing;
- `install-check.php`, a non-destructive health-check page;
- `README-INFINITYFREE.md` with upload and troubleshooting steps.

The static package can display the research and workbook-local bridge, but browser-to-server protected ledger ingestion and private Google OAuth require the full-stack deployment. Do not upload OAuth secrets to InfinityFree static hosting.

## Verification

The final release is checked with:

```bash
pnpm check
pnpm build
pnpm test
```

The test suite covers the Manus logout cookie contract plus Google token encryption, signed OAuth state, and worksheet normalization.

## Official Google references

- [Google Sheets Node.js quickstart](https://developers.google.com/workspace/sheets/api/quickstart/nodejs)
- [OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Sheets `spreadsheets.values.get` reference](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get)
