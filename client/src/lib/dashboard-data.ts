export type Severity = "critical" | "watch" | "opportunity";

export const kpis = [
  { label: "Unit-level rows", value: "3,471", delta: "+12.4%", note: "across active stock tabs", tone: "lime" },
  { label: "Order quantity", value: "5,577", delta: "754 orders", note: "22 May → 09 Jul 2025", tone: "cyan" },
  { label: "Marked sold", value: "90.2%", delta: "3,132 units", note: "location field = Sold", tone: "amber" },
  { label: "Exception surface", value: "7", delta: "high-value signals", note: "needs a canonical ledger", tone: "coral" },
];

export const activity = [
  { label: "06 May", value: 8, detail: "first receiving signal" },
  { label: "12 May", value: 42, detail: "PPad / withdrawal cluster" },
  { label: "22 May", value: 460, detail: "MI 14 intake" },
  { label: "31 May", value: 96, detail: "customized lot" },
  { label: "18 Jun", value: 234, detail: "peak order date in MI 14" },
  { label: "25 Jun", value: 839, detail: "customized receiving burst" },
  { label: "01 Jul", value: 1_049, detail: "7.07 receiving burst" },
  { label: "09 Jul", value: 754, detail: "latest order window" },
];

export const skuMix = [
  { label: "Honor 400 Pro 12/512", count: 771, share: 22.2, color: "#d7ff55" },
  { label: "Honor 400 12/512", count: 521, share: 15.0, color: "#6ee7f5" },
  { label: "Honor 400 Lite 12/256", count: 644, share: 18.6, color: "#ffb86b" },
  { label: "Honor X9c / X9C", count: 507, share: 14.6, color: "#ff8066" },
  { label: "Redmi 14 Pro family", count: 703, share: 20.3, color: "#bba7ff" },
  { label: "Other Honor", count: 325, share: 9.4, color: "#9ba7b7" },
];

export const states = [
  { label: "Sold", count: 3_132, share: 90.2, color: "#d7ff55", description: "explicitly marked Sold across MI 14, Customized, and 7.07" },
  { label: "Alpana / Alpn", count: 279, share: 8.0, color: "#ffb86b", description: "held or routed through Alpana; spelling drift creates a false split" },
  { label: "HO", count: 60, share: 1.7, color: "#6ee7f5", description: "head-office / central holding location" },
  { label: "Unresolved", count: 0, share: 0.1, color: "#ff8066", description: "blank or non-standard state; small count, high risk" },
];

export const anomalies: Array<{ id: string; title: string; severity: Severity; impact: string; evidence: string; action: string; score: number }> = [
  { id: "identity", title: "One identity, multiple realities", severity: "critical", impact: "High", evidence: "The same SKU family appears in Received, Customized, 7.07, withdrawal, and order contexts with no single event spine.", action: "Build a canonical IMEI / SKU event ledger before calculating sell-through or aging.", score: 98 },
  { id: "taxonomy", title: "Alpana / Alpn split", severity: "watch", impact: "Medium", evidence: "The Location field uses both ‘Alpana’ and ‘Alpn’, turning one operational state into two categories.", action: "Normalize location and status dictionaries; retain original text as raw evidence.", score: 86 },
  { id: "future", title: "Order date is not delivery date", severity: "critical", impact: "High", evidence: "Several tabs contain order dates, out dates, delivery dates, and courier states side-by-side.", action: "Use a transition clock: ordered → picked → couriered → delivered, with separate timestamps.", score: 82 },
  { id: "refs", title: "Broken withdrawal references", severity: "critical", impact: "High", evidence: "The ‘19.03 - Withdraw Adam Int’ sheet contains #REF! cells in the item linkage column.", action: "Quarantine formula errors and re-key the withdrawal list against IMEI.", score: 79 },
  { id: "burst", title: "1,049-unit receiving burst", severity: "opportunity", impact: "Very high", evidence: "The 7.07 tab records a single ‘1049 Units - 01.07.2025’ lot, a natural stress test for inbound controls.", action: "Compare inbound burst to order velocity, holding time, and exception rate.", score: 74 },
  { id: "returns", title: "Return loop hiding in lot labels", severity: "watch", impact: "Medium", evidence: "The 7.07 tab includes ‘Sales Return’ and ‘Sales return’ as separate raw labels.", action: "Create a returns state with reason, source order, and re-entry timestamp.", score: 68 },
];

export const researchTracks = [
  {
    id: "graph",
    index: "01",
    title: "The IMEI Event Graph",
    subtitle: "Turn sheets into a state machine",
    description: "Resolve every unit to one identity and draw the sequence of receiving, movement, reservation, courier handoff, delivery, return, damage, and repair.",
    payoff: "Stops false inventory totals",
    effort: "2–4 days",
    tag: "Foundational",
    color: "lime",
  },
  {
    id: "aging",
    index: "02",
    title: "Aging × Margin Radar",
    subtitle: "Find the inventory that is quietly getting expensive",
    description: "Combine receiving date, current state, model family, and sell-through speed to rank units by cash trapped per day.",
    payoff: "Turns ‘old stock’ into a money number",
    effort: "1 week",
    tag: "Commercial",
    color: "amber",
  },
  {
    id: "flow",
    index: "03",
    title: "Operational Friction Map",
    subtitle: "Measure the invisible touches",
    description: "Count how often a unit changes location, owner, courier path, or status before delivery. High-touch units reveal process drag.",
    payoff: "Shows where cycle time actually leaks",
    effort: "3–5 days",
    tag: "Process",
    color: "cyan",
  },
  {
    id: "pulse",
    index: "04",
    title: "Demand Pulse Engine",
    subtitle: "Separate real demand from batch noise",
    description: "Decompose order quantity into SKU, party, date, and delivery route to see what is repeatable versus one-off wholesale pull.",
    payoff: "Improves next-buy decisions",
    effort: "1 week",
    tag: "Planning",
    color: "coral",
  },
];

export const milestones = [
  { day: "Today", title: "Freeze raw evidence", copy: "Keep every original value, including typos, #REF!, blank dates, and mixed status labels." },
  { day: "48h", title: "Create the identity spine", copy: "IMEI first. SKU, color, lot, and party become attributes, not competing identities." },
  { day: "7d", title: "Ship the exception queue", copy: "Every unresolved unit gets an owner, reason, next action, and aging clock." },
  { day: "30d", title: "Close the learning loop", copy: "Turn delivery, returns, and service outcomes into the next buying signal." },
];

export const decisionLanes = [
  { id: "aging", label: "Aging exposure", value: "279", unit: "held / routed units", detail: "Alpana / Alpn state needs a true aging clock", status: "Needs event spine", tone: "amber" },
  { id: "sla", label: "Delivery SLA", value: "—", unit: "not yet reliable", detail: "Order, out, courier, and delivery dates must be separated", status: "Data contract first", tone: "cyan" },
  { id: "returns", label: "Returns loop", value: "24+", unit: "return-labeled rows", detail: "‘Sales Return’ and ‘Sales return’ are currently split", status: "Normalize now", tone: "coral" },
  { id: "service", label: "Service cost", value: "—", unit: "not present in source", detail: "Add parts, labor, and turnaround fields to quantify leakage", status: "Instrument next", tone: "lime" },
];

export const sourceNotes = [
  "Derived from Logistics_ Un_CP.xlsx and supplied summary notes.",
  "Counts are directional until IMEI-level deduplication is complete.",
  "‘Sold’ means the raw Location value is Sold; it does not prove customer delivery.",
];
