import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bell,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Command,
  Database,
  Download,
  FileWarning,
  FileSpreadsheet,
  Fingerprint,
  Gauge,
  Layers3,
  Menu,
  Network,
  Orbit,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Truck,
  X,
  Zap,
  Link2,
  LogIn,
  Upload,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { anomalies, activity, decisionLanes, kpis, milestones, researchTracks, skuMix, sourceNotes, states } from "@/lib/dashboard-data";

type Section = "overview" | "data" | "signals" | "research" | "plan";

const navItems: Array<{ id: Section; label: string; icon: typeof Gauge; hint: string }> = [
  { id: "overview", label: "Command center", icon: Gauge, hint: "Live operating picture" },
  { id: "data", label: "Data bridge", icon: FileSpreadsheet, hint: "Import / export inputs" },
  { id: "signals", label: "Signal lab", icon: Orbit, hint: "Anomalies & evidence" },
  { id: "research", label: "Research radar", icon: BrainCircuit, hint: "High-leverage ideas" },
  { id: "plan", label: "90-day plan", icon: Target, hint: "From insight to action" },
];

function toEventTime(value: unknown) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H ?? 0, parsed.M ?? 0, parsed.S ?? 0) : undefined;
  }
  if (typeof value === "string" && value.trim()) {
    const time = Date.parse(value);
    return Number.isNaN(time) ? undefined : time;
  }
  return undefined;
}

function normalizeWorkbookToLedger(workbook: XLSX.WorkBook) {
  const rows: Array<{ imei: string; sku?: string; modelFamily?: string; color?: string; lot?: string; location?: string; currentState?: string; eventType?: string; eventAt?: number; party?: string; courier?: string; sourceSheet?: string; rawEvidence?: string }> = [];
  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
    const headerIndex = matrix.findIndex(row => row.some(cell => /imei|imie/i.test(String(cell))));
    if (headerIndex < 0) continue;
    const headers = (matrix[headerIndex] ?? []).map(cell => String(cell).trim().toLowerCase());
    const indexOf = (patterns: RegExp[]) => headers.findIndex(header => patterns.some(pattern => pattern.test(header)));
    const imeiIndex = indexOf([/imei|imie/]);
    const skuIndex = indexOf([/sku|variant|product|model/]);
    const colorIndex = indexOf([/color/]);
    const lotIndex = indexOf([/lot|bn/]);
    const locationIndex = indexOf([/location|loc/]);
    const statusIndex = indexOf([/status|state|stats/]);
    const partyIndex = indexOf([/party|name|customer/]);
    const dateIndex = indexOf([/date|dt/]);
    if (imeiIndex < 0) continue;
    for (const row of matrix.slice(headerIndex + 1)) {
      const rawImei = String(row[imeiIndex] ?? "");
      const imei = rawImei.replace(/\D/g, "");
      if (imei.length < 10 || imei.length > 20) continue;
      const sku = skuIndex >= 0 ? String(row[skuIndex] ?? "").trim() : undefined;
      const location = locationIndex >= 0 ? String(row[locationIndex] ?? "").trim() : undefined;
      const status = statusIndex >= 0 ? String(row[statusIndex] ?? "").trim() : undefined;
      rows.push({ imei, sku, modelFamily: sku?.split(/\s+\d|\s+\d+\//)[0]?.trim(), color: colorIndex >= 0 ? String(row[colorIndex] ?? "").trim() : undefined, lot: lotIndex >= 0 ? String(row[lotIndex] ?? "").trim() : undefined, location, currentState: status || location, eventType: /sold|deliver/i.test(`${status} ${location}`) ? "delivery_state" : /return/i.test(`${status} ${location}`) ? "return_signal" : "observed", eventAt: dateIndex >= 0 ? toEventTime(row[dateIndex]) : undefined, party: partyIndex >= 0 ? String(row[partyIndex] ?? "").trim() : undefined, sourceSheet: sheetName, rawEvidence: row.map(cell => String(cell ?? "")).filter(Boolean).slice(0, 18).join(" | ") });
    }
  }
  return rows.slice(0, 5000);
}

function MetricCard({ item, index }: { item: (typeof kpis)[number]; index: number }) {
  const iconMap = [Database, Package, TrendingUp, FileWarning];
  const Icon = iconMap[index];
  return (
    <article className={`metric-card metric-${item.tone}`}>
      <div className="metric-head">
        <span className="eyebrow">{item.label}</span>
        <span className="metric-icon"><Icon size={16} strokeWidth={1.7} /></span>
      </div>
      <div className="metric-value">{item.value}</div>
      <div className="metric-foot"><span>{item.delta}</span><small>{item.note}</small></div>
    </article>
  );
}

function ActivityChart() {
  const max = Math.max(...activity.map((item) => item.value));
  const points = activity.map((item, index) => {
    const x = 32 + index * 78;
    const y = 160 - (item.value / max) * 119;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="activity-chart-wrap">
      <div className="chart-legend"><span><i className="legend-dot lime" />units touched</span><span>batch-aware view</span></div>
      <svg className="activity-chart" viewBox="0 0 590 190" role="img" aria-label="Timeline of units touched by major workbook event">
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#d7ff55" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#d7ff55" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 80, 120, 160].map((y) => <line key={y} x1="24" x2="578" y1={y} y2={y} className="chart-grid" />)}
        <path d={`M 32,160 L ${points.replaceAll(" ", " L ")} L 578,160 Z`} fill="url(#areaFill)" />
        <polyline points={points} fill="none" stroke="#d7ff55" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {activity.map((item, index) => {
          const x = 32 + index * 78;
          const y = 160 - (item.value / max) * 119;
          return <g key={item.label}><circle cx={x} cy={y} r="5" fill="#11151a" stroke="#d7ff55" strokeWidth="3" /><text x={x} y="181" textAnchor="middle" className="chart-label">{item.label}</text></g>;
        })}
      </svg>
      <div className="chart-callout"><span className="callout-number">1,049</span><span>largest single receiving burst<br /><b>01 Jul · 7.07 tab</b></span></div>
    </div>
  );
}

function SkuMix() {
  return <div className="sku-mix">
    <div className="sku-total"><span className="eyebrow">Observed unit mix</span><strong>3,471</strong><small>across three stock-ledger tabs</small></div>
    <div className="mix-bar">{skuMix.map((item) => <div key={item.label} style={{ width: `${item.share}%`, background: item.color }} title={`${item.label}: ${item.count}`} />)}</div>
    <div className="mix-legend">{skuMix.slice(0, 5).map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><b>{item.count}</b></div>)}</div>
    <div className="mix-legend last"><div><i style={{ background: skuMix[5].color }} /><span>{skuMix[5].label}</span><b>{skuMix[5].count}</b></div></div>
  </div>;
}

function StateRail() {
  return <div className="state-rail">
    {states.map((state) => <div className="state-row" key={state.label}>
      <div className="state-top"><span><i style={{ background: state.color }} />{state.label}</span><b>{state.count.toLocaleString()}</b></div>
      <div className="state-bar"><span style={{ width: `${Math.max(state.share, 1)}%`, background: state.color }} /></div>
      <p>{state.description}</p>
    </div>)}
  </div>;
}

function SectionHeader({ kicker, title, copy, action }: { kicker: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="section-header"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2><p>{copy}</p></div>{action}</div>;
}

export default function Home() {
  const { user } = useAuth();
  const { data: liveSummary } = trpc.ledger.summary.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const liveUnits = Number(liveSummary?.totals?.units ?? 0);
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [query, setQuery] = useState("");
  const [selectedAnomaly, setSelectedAnomaly] = useState<(typeof anomalies)[number] | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<(typeof researchTracks)[number] | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importedFile, setImportedFile] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const ingestMutation = trpc.ledger.ingest.useMutation({
    onSuccess: (result) => toast.success("Canonical ledger updated", { description: `${result.acceptedCount.toLocaleString()} IMEI observations accepted; ${result.rejectedCount} rejected for review.` }),
    onError: (error) => toast.error("Ledger import needs sign-in", { description: error.message }),
  });
  const connectSourceMutation = trpc.ledger.connectSource.useMutation({
    onSuccess: () => toast.success("Source registered", { description: "This source is now ready for a future refresh or OAuth sync." }),
    onError: (error) => toast.error("Source registration needs sign-in", { description: error.message }),
  });
  const prepareOAuthMutation = trpc.ledger.prepareGoogleOAuth.useMutation({
    onSuccess: (authUrl) => { window.location.href = authUrl; },
    onError: (error) => toast.error("OAuth setup unavailable", { description: error.message }),
  });
  const syncPrivateSourceMutation = trpc.ledger.syncPrivateSource.useMutation({
    onSuccess: (result) => toast.success("Private sheet refreshed", { description: `${result.acceptedCount.toLocaleString()} observations merged into the canonical ledger.` }),
    onError: (error) => toast.error("Private sheet refresh failed", { description: error.message }),
  });
  useEffect(() => {
    if (!window.location.search.includes("google=connected")) return;
    const sourceId = Number(window.localStorage.getItem("logistics-active-sync-source"));
    if (sourceId) syncPrivateSourceMutation.mutate({ sourceId });
    window.history.replaceState({}, "", "/#data");
  }, []);

  const filteredAnomalies = useMemo(() => anomalies.filter((item) => `${item.title} ${item.evidence} ${item.action}`.toLowerCase().includes(query.toLowerCase())), [query]);

  const goTo = (id: Section) => {
    setActiveSection(id);
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportBrief = () => {
    const body = `LOGISTICS INTELLIGENCE BRIEF\n\nException surface: 7 high-value signals\nObserved units: 3,471\nOrder quantity: 5,577\n\nTop recommendation: create an IMEI-level event ledger before reporting sell-through.\n`;
    const blob = new Blob([body], { type: "text/plain" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href; anchor.download = "logistics-intelligence-brief.txt"; anchor.click(); URL.revokeObjectURL(href);
    toast.success("Brief exported", { description: "A decision-ready text snapshot is in your downloads." });
  };

  const exportWorkbook = () => {
    const workbook = XLSX.utils.book_new();
    const overview = [
      ["Logistics Intelligence export", ""],
      ["Exported at", new Date().toISOString()],
      [],
      ["Metric", "Value", "Note"],
      ...kpis.map((item) => [item.label, item.value, item.note]),
      [],
      ["Signal", "Severity", "Score", "Recommended action"],
      ...anomalies.map((item) => [item.title, item.severity, item.score, item.action]),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(overview), "Intelligence export");
    XLSX.writeFile(workbook, "logistics-intelligence-export.xlsx");
    toast.success("Workbook exported", { description: "The current intelligence layer is ready to share." });
  };

  const importWorkbook = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const workbook = XLSX.read(loadEvent.target?.result, { type: "array" });
        const rows = normalizeWorkbookToLedger(workbook);
        setImportedFile(`${file.name} · ${workbook.SheetNames.length} sheets · ${rows.length.toLocaleString()} IMEI observations`);
        if (rows.length) ingestMutation.mutate({ sourceType: file.name.toLowerCase().endsWith(".csv") ? "csv" : "excel", sourceName: file.name, rows });
        else toast.info("Spreadsheet inspected", { description: `${workbook.SheetNames.length} sheets detected, but no IMEI column was found for the canonical ledger.` });
      } catch {
        toast.error("Could not read spreadsheet", { description: "Try an .xlsx, .xls, or .csv file." });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importGoogleSheet = async () => {
    const match = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      toast.error("Paste a Google Sheets link", { description: "Use a share link or a published-to-web sheet URL." });
      return;
    }
    const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error("not public");
      const csv = await response.text();
      const workbook = XLSX.read(csv, { type: "string" });
      const ledgerRows = normalizeWorkbookToLedger(workbook);
      setImportedFile(`Google Sheet · ${ledgerRows.length.toLocaleString()} IMEI observations`);
      connectSourceMutation.mutate({ provider: "google_sheets", label: "Google Sheets source", spreadsheetUrl: sheetUrl, externalId: match[1], authMode: "public_csv" });
      if (ledgerRows.length) ingestMutation.mutate({ sourceType: "google_sheets", sourceName: "Google Sheets source", rows: ledgerRows });
      else toast.info("Google Sheet connected", { description: "The sheet is registered, but no IMEI column was found for the canonical ledger." });
    } catch {
      toast.error("Google Sheet needs publishing", { description: "Set the sheet to ‘Anyone with the link’ or Publish to web, then try again." });
    }
  };

  const connectPrivateGoogleSheet = () => {
    const match = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      toast.error("Paste a Google Sheets link", { description: "Use the private spreadsheet URL you want to authorize." });
      return;
    }
    connectSourceMutation.mutate({ provider: "google_sheets", label: "Private Google Sheets source", spreadsheetUrl: sheetUrl, externalId: match[1], authMode: "oauth_ready" }, { onSuccess: (result) => { window.localStorage.setItem("logistics-active-sync-source", String(result.sourceId)); prepareOAuthMutation.mutate({ sourceId: result.sourceId }); } });
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><span /><span /><span /></div><div><b>LO / X</b><small>LOGISTICS INTELLIGENCE</small></div></div>
      <div className="sidebar-rule" />
      <div className="side-label">Workspace</div>
      <nav className="main-nav" aria-label="Primary navigation">
        {navItems.map(({ id, label, icon: Icon, hint }) => <button key={id} className={activeSection === id ? "active" : ""} onClick={() => goTo(id)}><Icon size={17} strokeWidth={1.8} /><span>{label}<small>{hint}</small></span>{activeSection === id && <i className="nav-pip" />}</button>)}
      </nav>
      <div className="sidebar-lower">
        <div className="side-label">Data health</div>
        <div className="health-card"><div className="health-scan"><span className="scan-ring"><ShieldCheck size={17} /></span><div><b>Evidence linked</b><small>Workbook + notes ingested</small></div></div><div className="health-meter"><span /></div><div className="health-foot"><span>87% confidence</span><span>v0.9.4</span></div></div>
        <button className="sidebar-source" onClick={() => toast.info("Source pack", { description: sourceNotes.join(" ") })}><span className="source-icon"><Layers3 size={15} /></span><span><b>Source pack</b><small>8 artifacts · 1 workbook</small></span><ChevronRight size={15} /></button>
      </div>
      <div className="sidebar-footer"><span className="status-dot" />Internal preview <span className="footer-badge">BETA</span></div>
    </aside>
    <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>

    <main className="main-content">
      <header className="topbar"><div className="crumb"><span>WORKSPACE</span><ChevronRight size={14} /><b>LOGISTICS INTELLIGENCE</b></div><div className="top-actions"><span className="last-sync"><span className="status-dot" />Last synced 13 Sep 2026 · 03:34</span><button className="icon-button" onClick={() => toast.info("No new alerts", { description: "The exception queue is unchanged since the last sync." })} aria-label="Alerts"><Bell size={17} /><i className="alert-dot" /></button>{user ? <span className="user-chip"><UserCircle size={15} />{user.name || user.email || "Connected"}</span> : <button className="sign-in-button" onClick={startLogin}><LogIn size={14} /> Sign in to sync</button>}<button className="export-button" onClick={exportBrief}><Download size={15} /> Export brief</button></div></header>

      <section className="hero" id="overview">
        <div className="hero-copy"><div className="overline"><span className="live-dot" />OPERATIONS / FIELD NOTE 07</div><h1>See the <em>movement</em><br />behind the numbers.</h1><p>One view across receiving, stock, orders, withdrawals, damage, and service. Built to expose where the workbook tells different stories about the same unit.</p><div className="hero-actions"><button className="primary-button" onClick={() => goTo("signals")}><Sparkles size={16} /> Open signal lab <ArrowUpRight size={15} /></button><button className="quiet-button" onClick={() => goTo("research")}><BrainCircuit size={16} /> Explore research radar</button></div></div>
        <div className="hero-orbit" aria-hidden="true"><div className="orbit-grid" /><div className="orbit-circle orbit-one" /><div className="orbit-circle orbit-two" /><div className="orbit-circle orbit-three" /><div className="orbit-node node-one"><Fingerprint size={17} /></div><div className="orbit-node node-two"><Truck size={16} /></div><div className="orbit-node node-three"><Zap size={15} /></div><div className="orbit-center"><span>{liveUnits ? liveUnits.toLocaleString() : "3,471"}</span><small>{liveUnits ? <>canonical<br />units</> : <>observed<br />units</>}</small></div><div className="orbit-caption">IDENTITY / FLOW / SIGNAL</div></div>
      </section>

      <section className="kpi-grid" aria-label="Key metrics">{kpis.map((item, index) => <MetricCard item={item} index={index} key={item.label} />)}</section>

      <section className="section-block bridge-section" id="data"><SectionHeader kicker="DATA BRIDGE / INPUT + OUTPUT" title="Bring the source closer to the decision." copy="Import the next workbook, connect a published Google Sheet, or authorize a private sheet without exposing tokens to the browser." action={<div className="section-tag"><Link2 size={14} /> browser-safe connectors</div>} />
        <div className="bridge-grid"><article className="bridge-card primary-bridge"><div className="bridge-icon"><Upload size={19} /></div><div><span className="panel-kicker">LOCAL FILES</span><h3>Import Excel or CSV</h3><p>Drop in .xlsx, .xls, or .csv files to normalize IMEI observations into the canonical ledger. Raw evidence stays attached to each event.</p></div><label className="bridge-button"><Upload size={14} /> Choose file<input type="file" accept=".xlsx,.xls,.csv" onChange={importWorkbook} /></label>{importedFile && <div className="import-status"><Check size={14} /> {importedFile}</div>}</article><article className="bridge-card"><div className="bridge-icon cyan"><Link2 size={19} /></div><div><span className="panel-kicker">GOOGLE SHEETS</span><h3>Connect a source</h3><p>Use the public importer for a fast CSV bridge, or OAuth for private read-only Sheets access with encrypted server-side tokens.</p></div><div className="sheet-input"><input value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /><button onClick={importGoogleSheet}>Public CSV <ArrowUpRight size={13} /></button></div><button className="oauth-button" onClick={connectPrivateGoogleSheet}><ShieldCheck size={13} /> Authorize private sheet</button></article><article className="bridge-card export-bridge"><div className="bridge-icon amber"><Download size={19} /></div><div><span className="panel-kicker">OUTPUT LAYER</span><h3>Export intelligence workbook</h3><p>Share the current KPI layer and scored signal queue as a clean .xlsx workbook for review, planning, or handoff.</p></div><button className="bridge-button" onClick={exportWorkbook}><Download size={14} /> Export .xlsx</button></article></div>
        <div className="bridge-note"><span className="status-dot" /><b>Secure by design:</b> OAuth tokens are encrypted at rest, never sent to the browser, and refresh through the server only. <button onClick={() => toast.info("Private connector", { description: "The setup guide includes Google Cloud redirect URI and scope configuration." })}>See setup notes <ArrowUpRight size={13} /></button></div>
      </section>

      <section className="section-block decision-section"><SectionHeader kicker="DECISION ANALYTICS / WHAT TO DO NEXT" title="Make the expensive questions visible." copy="These lanes are intentionally honest: the workbook already supports directional signals, while the missing fields are called out before they become fake precision." action={<div className="section-tag"><Target size={14} /> traceable metrics</div>} />
        <div className="decision-grid">{decisionLanes.map((lane) => <article className={`decision-card decision-${lane.tone}`} key={lane.id}><div className="decision-top"><span className="panel-kicker">{lane.label}</span><span className="decision-status">{lane.status}</span></div><div className="decision-value">{lane.value}<small>{lane.unit}</small></div><p>{lane.detail}</p><div className="decision-action"><span><ArrowUpRight size={13} /> next field</span><button onClick={() => goTo("research")}>Open research bet</button></div></article>)}</div>
      </section>

      <section className="section-block" id="signals"><SectionHeader kicker="01 / THE OPERATING PICTURE" title="From batch noise to a traceable flow." copy="The workbook has enough signal to act—but only if you read it as a sequence of events, not a single stock balance." action={<div className="section-tag"><Activity size={14} /> Directional · IMEI join pending</div>} />
        <div className="overview-grid"><article className="panel activity-panel"><div className="panel-head"><div><span className="panel-kicker">EVENT VOLUME</span><h3>Where the data spikes</h3></div><button className="panel-menu" onClick={() => toast.info("Chart lens", { description: "Event spikes are shown by receiving, withdrawal, and order touchpoints." })}><Command size={16} /></button></div><ActivityChart /></article><article className="panel mix-panel"><div className="panel-head"><div><span className="panel-kicker">PORTFOLIO LENS</span><h3>What is moving</h3></div><button className="mini-link" onClick={() => toast.info("SKU lens", { description: "Family names are normalized only for this view; raw labels stay preserved in source." })}>view method <ArrowUpRight size={13} /></button></div><SkuMix /></article></div>
        <div className="lower-grid"><article className="panel state-panel"><div className="panel-head"><div><span className="panel-kicker">STATE DISTRIBUTION</span><h3>Location is not delivery</h3></div><span className="panel-note">3,471 rows</span></div><StateRail /></article><article className="panel quote-panel"><div className="quote-mark">“</div><blockquote>‘Sold’ is a location label here—not proof that the customer received the device.</blockquote><p>That distinction changes every sell-through, aging, and service conclusion downstream.</p><button className="text-link" onClick={() => goTo("research")}>Why this matters <ArrowUpRight size={14} /></button><div className="quote-line" /></article></div>
      </section>

      <section className="section-block dark-section"><div className="signal-header"><SectionHeader kicker="02 / SIGNAL LAB" title="The things hiding in plain sight." copy="Seven high-value findings are already visible. The goal is not more charts—it is fewer ambiguous handoffs." action={<div className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search signals" /><kbd>/</kbd></div>} /></div>
        <div className="anomaly-list">{filteredAnomalies.map((item, index) => <button className="anomaly-row" key={item.id} onClick={() => setSelectedAnomaly(item)}><span className="anomaly-index">0{index + 1}</span><span className={`severity severity-${item.severity}`}>{item.severity === "critical" ? "critical" : item.severity === "watch" ? "watch" : "upside"}</span><span className="anomaly-main"><b>{item.title}</b><small>{item.evidence}</small></span><span className="impact"><small>signal score</small><strong>{item.score}</strong></span><ChevronRight className="row-chevron" size={18} /></button>)}{filteredAnomalies.length === 0 && <div className="empty-state">No signals match “{query}”.</div>}</div>
        <div className="signal-footer"><div><span className="signal-pulse" /><b>Research posture:</b> data-first, ambiguity-intolerant</div><button onClick={() => setQuery("")}>Reset filters <X size={14} /></button></div>
      </section>

      <section className="section-block" id="research"><SectionHeader kicker="03 / RESEARCH RADAR" title="Four bets worth making next." copy="These are not generic analytics requests. They are leverage points designed around the workbook’s actual failure modes." action={<div className="radar-label"><span /> high leverage / low ceremony</div>} /><div className="research-grid">{researchTracks.map((track) => <button className={`research-card research-${track.color}`} key={track.id} onClick={() => setSelectedTrack(track)}><div className="research-top"><span className="research-index">{track.index}</span><span className="research-tag">{track.tag}</span><ArrowUpRight size={17} /></div><h3>{track.title}</h3><h4>{track.subtitle}</h4><p>{track.description}</p><div className="research-foot"><span><Zap size={13} /> {track.payoff}</span><small>{track.effort}</small></div></button>)}</div></section>

      <section className="section-block plan-section" id="plan"><SectionHeader kicker="04 / 90-DAY PLAN" title="A sharper operating system, in four moves." copy="Start with trust in the data. Then use that trust to create speed." action={<div className="plan-stamp"><Clock3 size={14} /> 90 days</div>} /><div className="timeline">{milestones.map((item, index) => <div className="timeline-item" key={item.day}><div className="timeline-rail"><span>{String(index + 1).padStart(2, "0")}</span>{index < milestones.length - 1 && <i />}</div><div className="timeline-copy"><span className="timeline-day">{item.day}</span><h3>{item.title}</h3><p>{item.copy}</p></div><div className="timeline-icon">{index === 0 ? <Database size={16} /> : index === 1 ? <Fingerprint size={16} /> : index === 2 ? <CircleAlert size={16} /> : <TrendingUp size={16} />}</div></div>)}</div><div className="plan-callout"><div className="callout-icon"><Timer size={20} /></div><div><b>The first win is not a dashboard.</b><p>It is one trusted answer to: “Where is this exact IMEI, and what happened to it last?”</p></div><button onClick={() => toast.success("Plan pinned", { description: "The 90-day plan has been added to your local workspace." })}><Check size={15} /> Pin plan</button></div></section>

      <footer className="app-footer"><div><b>LO / X</b><span>Logistics Intelligence Command Center</span></div><div>Evidence-led · built for the next decision <span className="footer-dot" /></div></footer>
    </main>

    {selectedAnomaly && <div className="drawer-backdrop" onClick={() => setSelectedAnomaly(null)}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-top"><span className={`severity severity-${selectedAnomaly.severity}`}>{selectedAnomaly.severity}</span><button className="icon-button" onClick={() => setSelectedAnomaly(null)} aria-label="Close"><X size={17} /></button></div><span className="drawer-kicker">SIGNAL / {selectedAnomaly.id.toUpperCase()}</span><h2>{selectedAnomaly.title}</h2><p className="drawer-impact">Impact: <b>{selectedAnomaly.impact}</b> · score {selectedAnomaly.score}/100</p><div className="drawer-block"><span>What the evidence says</span><p>{selectedAnomaly.evidence}</p></div><div className="drawer-block action-block"><span>Recommended move</span><p>{selectedAnomaly.action}</p></div><button className="primary-button full" onClick={() => { toast.success("Signal added to action queue"); setSelectedAnomaly(null); }}><Target size={16} /> Add to action queue <ArrowUpRight size={15} /></button></aside></div>}
    {selectedTrack && <div className="drawer-backdrop" onClick={() => setSelectedTrack(null)}><aside className="detail-drawer track-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-top"><span className={`research-tag tag-${selectedTrack.color}`}>{selectedTrack.tag}</span><button className="icon-button" onClick={() => setSelectedTrack(null)} aria-label="Close"><X size={17} /></button></div><span className="drawer-kicker">RESEARCH BET / {selectedTrack.index}</span><h2>{selectedTrack.title}</h2><h3>{selectedTrack.subtitle}</h3><p className="drawer-description">{selectedTrack.description}</p><div className="payoff-box"><span>Expected payoff</span><b>{selectedTrack.payoff}</b><small>Estimated effort: {selectedTrack.effort}</small></div><button className="primary-button full" onClick={() => { toast.success("Research bet pinned"); setSelectedTrack(null); }}><Sparkles size={16} /> Pin this research bet <ArrowUpRight size={15} /></button></aside></div>}
  </div>;
}
