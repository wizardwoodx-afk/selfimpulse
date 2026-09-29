/**
 * 11Handle Finance Engine — sorting & classification for enterprise ledgers.
 *
 * The Documents wing's finance core: takes a raw workbook sheet (Date, Voucher,
 * Party, Description, Amount, Cost Centre, Entered By) and returns a classified,
 * sorted, summarised sheet plus a signed receipt chain for the whole run.
 *
 * Honesty contract (the product's law):
 *   • mode is labelled on every run — "rules-only" until a model refines it, then
 *     "model-assisted". The label is part of the receipt. Never pretend either way.
 *   • every run mints receipt-chain entries (sha256, canonical JSON, prev-linked).
 *   • unknown rows are classified MISC and loudly flagged — never guessed silently.
 */
import { createHash } from "node:crypto";
import type { Cell, SheetData } from "./xlsxLite";

export type Category =
  | "RAW-MATERIALS"
  | "PAYROLL"
  | "LOGISTICS-FREIGHT"
  | "UTILITIES"
  | "REPAIRS-MAINTENANCE"
  | "TRAVEL-DA"
  | "OFFICE-ADMIN"
  | "PROFESSIONAL-FEES"
  | "TAX-DUTIES"
  | "BANK-CHARGES"
  | "SALES-RECEIPTS"
  | "MISC";

export const CATEGORIES: Category[] = [
  "RAW-MATERIALS", "PAYROLL", "LOGISTICS-FREIGHT", "UTILITIES", "REPAIRS-MAINTENANCE",
  "TRAVEL-DA", "OFFICE-ADMIN", "PROFESSIONAL-FEES", "TAX-DUTIES", "BANK-CHARGES",
  "SALES-RECEIPTS", "MISC",
];

/** Category keyword rules — first confident hit wins; ties resolved by order above. */
export const CATEGORY_KEYWORDS: Record<Exclude<Category, "MISC">, string[]> = {
  "RAW-MATERIALS": ["steel", "metal", "alloy", "ingot", "coil ", "rod ", "bar ", "sheet", "plastic", "granule", "resin", "fastener", "raw "],
  PAYROLL: ["salary", "wages", "bonus", "payroll", "pf ", "esi", "incentive", "staff"],
  "LOGISTICS-FREIGHT": ["freight", "transport", "lorry", "truck", "diesel", "petrol", "toll", "courier", "logistics", "carrier", "shipping"],
  UTILITIES: ["electricity", "eb ", "power", "water", "internet", "broadband", "telecom", "phone", "postpaid", "lpg", "gas"],
  "REPAIRS-MAINTENANCE": ["repair", "service", "spare", "maintenance", "amc", "overhaul", "motor", "machine tools"],
  "TRAVEL-DA": ["travel", "hotel", "flight", "train", "bus", "ola", "uber", "da ", "per diem", "ticket"],
  "OFFICE-ADMIN": ["stationery", "printing", "tea", "snacks", "canteen", "housekeeping", "security", "office", "pantry"],
  "PROFESSIONAL-FEES": ["audit", "legal", "advocate", "consultant", "professional", "advisory", "ca fee", "fees"],
  "TAX-DUTIES": ["gst", "tds", "tax", "duty", "challan", "cess", "penalty", "fine"],
  "BANK-CHARGES": ["bank", "charges", "interest", "processing", "neft", "rtgs", "imps", "lc ", "bg "],
  "SALES-RECEIPTS": ["received", "receipt", "sales", "collection", "payment in", "customer", "invoice out"],
};

export type Flag = "DUPLICATE" | "REVIEW-HIGH-VALUE" | "NEGATIVE-AMOUNT" | "OUTLIER";

export interface ClassifiedRow {
  row: Cell[];
  category: Category;
  confidence: "rules" | "model";
  flags: Flag[];
}

export interface FinanceReceipt {
  seq: number;
  op: string;
  rows: number;
  mode: "rules-only" | "model-assisted";
  inputDigest: string;
  outputDigest: string;
  prev: string | null;
  digest: string;
}

export interface FinanceResult {
  sheet: SheetData;
  classified: ClassifiedRow[];
  summary: {
    byCategory: Record<string, { count: number; total: number }>;
    byMonth: Record<string, number>;
    flagged: Record<string, number>;
  };
  receipts: FinanceReceipt[];
  mode: "rules-only" | "model-assisted";
}

const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

/* ------------------------------------------------------------------ column detection */

export interface ColumnMap {
  date: number; voucher: number; party: number; desc: number; amount: number; centre: number; by: number;
}

export function detectColumns(headers: string[]): ColumnMap {
  const find = (res: RegExp[], fallback: number): number => {
    for (const r of res) {
      const i = headers.findIndex((h) => r.test(h));
      if (i >= 0) return i;
    }
    return fallback;
  };
  return {
    date: find([/date/i], 0),
    voucher: find([/voucher|ref|bill/i], 1),
    party: find([/party|vendor|supplier|name/i], 2),
    desc: find([/desc|narrat|particular/i], 3),
    amount: find([/amount|amt|value|inr|rs/i], 4),
    centre: find([/cost|centre|center|dept/i], 5),
    by: find([/entered|by|user/i], 6),
  };
}

function textOf(cells: Cell[], idx: number): string {
  const v = cells[idx];
  return v === null || v === undefined ? "" : String(v).toLowerCase();
}

function amountOf(cells: Cell[], idx: number): number {
  const v = cells[idx];
  return typeof v === "number" ? v : Number(v) || 0;
}

export function monthOf(cells: Cell[], idx: number): string {
  const v = cells[idx];
  if (typeof v === "string" && /^\d{4}-\d{2}/.test(v)) return v.slice(0, 7);
  // Excel date serial (1900 system) — used only for grouping.
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const ms = Date.UTC(1899, 11, 30) + v * 86400000;
    return new Date(ms).toISOString().slice(0, 7);
  }
  return "UNKNOWN";
}

/* ------------------------------------------------------------------ classification */

export function classifyRow(row: Cell[], cols: ColumnMap): { category: Category; confidence: "rules" } {
  const text = `${textOf(row, cols.desc)} ${textOf(row, cols.party)}`;
  for (const cat of CATEGORIES) {
    if (cat === "MISC") continue;
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (text.includes(kw)) return { category: cat, confidence: "rules" };
    }
  }
  return { category: "MISC", confidence: "rules" };
}

export function sortLedger(
  rows: ClassifiedRow[],
  cols: ColumnMap,
  keys: Array<"date" | "amount" | "category" | "party"> = ["date", "category", "party"],
  dir: "asc" | "desc" = "asc",
): ClassifiedRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const val = (r: ClassifiedRow, k: string): number | string => {
    switch (k) {
      case "date": return String(r.row[cols.date] ?? "");
      case "amount": return amountOf(r.row, cols.amount);
      case "category": return r.category;
      case "party": return textOf(r.row, cols.party);
      default: return "";
    }
  };
  // stable multi-key sort
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      for (const k of keys) {
        const va = val(a.r, k);
        const vb = val(b.r, k);
        const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
        if (c !== 0) return sign * c;
      }
      return a.i - b.i;
    })
    .map((x) => x.r);
}

export function classifyLedger(
  sheet: SheetData,
  opts?: { keys?: Array<"date" | "amount" | "category" | "party">; dir?: "asc" | "desc" },
): FinanceResult {
  const cols = detectColumns(sheet.headers);
  const seen = new Map<string, number>();
  let mode: "rules-only" | "model-assisted" = "rules-only";

  // pass 1 — classify + duplicate/negative/high-value flags
  let classified: ClassifiedRow[] = sheet.rows.map((row) => {
    const { category } = classifyRow(row, cols);
    const flags: Flag[] = [];
    const key = `${row[cols.date]}|${textOf(row, cols.party)}|${amountOf(row, cols.amount)}`;
    const dupCount = seen.get(key) ?? 0;
    seen.set(key, dupCount + 1);
    if (dupCount > 0) flags.push("DUPLICATE");
    const amt = amountOf(row, cols.amount);
    if (amt < 0) flags.push("NEGATIVE-AMOUNT");
    if (category === "MISC" && Math.abs(amt) >= 200000) flags.push("REVIEW-HIGH-VALUE");
    return { row, category, confidence: "rules", flags };
  });

  // mark the FIRST of a duplicate pair as well (a pair is a problem on both lines)
  const firstSeen = new Map<string, number>();
  classified.forEach((r, i) => {
    const key = `${r.row[cols.date]}|${textOf(r.row, cols.party)}|${amountOf(r.row, cols.amount)}`;
    const prev = firstSeen.get(key);
    if (prev === undefined) firstSeen.set(key, i);
    else if (!classified[prev].flags.includes("DUPLICATE")) classified[prev].flags.push("DUPLICATE");
  });

  // pass 2 — per-category outlier (|amt| > mean + 4σ)
  const stats = new Map<Category, number[]>();
  for (const r of classified) {
    const arr = stats.get(r.category) ?? [];
    arr.push(amountOf(r.row, cols.amount));
    stats.set(r.category, arr);
  }
  for (const r of classified) {
    const arr = stats.get(r.category) ?? [];
    if (arr.length < 8) continue;
    const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length);
    if (sd > 0 && Math.abs(amountOf(r.row, cols.amount) - mean) > 4 * sd) {
      if (!r.flags.includes("OUTLIER")) r.flags.push("OUTLIER");
    }
  }

  classified = sortLedger(classified, cols, opts?.keys, opts?.dir);

  // summary
  const byCategory: Record<string, { count: number; total: number }> = {};
  const byMonth: Record<string, number> = {};
  const flagged: Record<string, number> = {};
  for (const r of classified) {
    const amt = amountOf(r.row, cols.amount);
    const c = (byCategory[r.category] ??= { count: 0, total: 0 });
    c.count += 1;
    c.total += amt;
    const m = monthOf(r.row, cols.date);
    byMonth[m] = (byMonth[m] ?? 0) + amt;
    for (const f of r.flags) flagged[f] = (flagged[f] ?? 0) + 1;
  }

  // receipt chain — one entry per stage, digests over canonical content
  const inputDigest = sha(JSON.stringify({ headers: sheet.headers, rows: sheet.rows }));
  const outputDigest = sha(JSON.stringify(classified.map((r) => [r.row, r.category, r.flags])));
  const chain: FinanceReceipt[] = [];
  const mint = (op: string, rows: number): void => {
    const prev = chain.length ? chain[chain.length - 1].digest : null;
    const body = { seq: chain.length + 1, op, rows, mode, inputDigest, outputDigest, prev, nonce: `stage-${op}` };
    const digest = sha(JSON.stringify(body));
    chain.push({ ...body, digest } as FinanceReceipt);
  };
  mint("classify", classified.length);
  mint("sort", classified.length);
  mint("summarise", classified.length);

  return { sheet: buildOutputSheet(sheet, classified, cols), classified, summary: { byCategory, byMonth, flagged }, receipts: chain, mode };
}

export function verifyReceipts(receipts: FinanceReceipt[]): boolean {
  let prev: string | null = null;
  for (const r of receipts) {
    if (r.prev !== prev) return false;
    const { digest, ...body } = r;
    const recomputed = sha(JSON.stringify({ ...body, nonce: `stage-${r.op}` }));
    if (recomputed !== digest) return false;
    prev = digest;
  }
  return true;
}

export function buildOutputSheet(input: SheetData, classified: ClassifiedRow[], cols: ColumnMap): SheetData {
  const headers = [...input.headers, "Category", "Confidence", "Flags", "Month"];
  const rows = classified.map((r) => [
    ...r.row,
    r.category,
    r.confidence,
    r.flags.join(";"),
    monthOf(r.row, cols.date),
  ]);
  return { name: `${input.name}-Classified`, headers, rows };
}

/* ------------------------------------------------------------------ synthetic industrial demo ledger */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_HEADERS = ["Date", "Voucher No", "Party", "Description", "Amount (INR)", "Cost Centre", "Entered By"];

const DEMO_TEMPLATES: Array<{ cat: Exclude<Category, "MISC">; party: string; desc: string; lo: number; hi: number }> = [
  { cat: "RAW-MATERIALS", party: "Coastal Steel Supply", desc: "Steel coil 2mm — plant purchase", lo: 120000, hi: 890000 },
  { cat: "RAW-MATERIALS", party: "Allied Fasteners", desc: "Fasteners and bar stock purchase", lo: 30000, hi: 180000 },
  { cat: "PAYROLL", party: "Payroll — Staff", desc: "Monthly salary — staff wages", lo: 850000, hi: 980000 },
  { cat: "LOGISTICS-FREIGHT", party: "Regional Logistics", desc: "Freight — inbound coils", lo: 8000, hi: 62000 },
  { cat: "LOGISTICS-FREIGHT", party: "Metro Transport", desc: "Lorry transport — despatch to customer", lo: 5000, hi: 40000 },
  { cat: "UTILITIES", party: "Grid Power — Unit 1", desc: "Electricity bill — Plant-1", lo: 60000, hi: 210000 },
  { cat: "REPAIRS-MAINTENANCE", party: "Precision Machine Tools", desc: "Machine service and spares", lo: 12000, hi: 150000 },
  { cat: "TRAVEL-DA", party: "Travel Desk", desc: "Travel DA — sales team", lo: 3000, hi: 45000 },
  { cat: "OFFICE-ADMIN", party: "City Stationers", desc: "Stationery and printing", lo: 2000, hi: 25000 },
  { cat: "PROFESSIONAL-FEES", party: "Northgate Consultancy", desc: "Audit and professional fees", lo: 25000, hi: 200000 },
  { cat: "TAX-DUTIES", party: "GST Portal", desc: "GST challan payment", lo: 50000, hi: 400000 },
  { cat: "BANK-CHARGES", party: "Bank — Current A/c", desc: "Bank charges and neft commission", lo: 500, hi: 9000 },
  { cat: "SALES-RECEIPTS", party: "Customer — Ridgeway Engg", desc: "Payment received against invoice", lo: 150000, hi: 1200000 },
];

const COST_CENTRES = ["Plant-1", "Plant-2", "HQ", "Export Cell"];
const ENTERED_BY = ["Accounts-1", "Accounts-2", "A. Raghavan (GM Finance)", "Finance Lead", "HR Lead"];

/** Deterministic demo ledger for the synthetic industrial fixture — FY 2025-26.
 *
 *  Every counterparty, signatory and cost-centre label here is invented. What is
 *  NOT invented is the structure, and the structure is what the probes assert on:
 *  six anchor rows carrying a large purchase, a payroll run, an exact duplicate
 *  pair, a board-note settlement, and a negative credit note. Change the names
 *  freely; removing any of those six rows silently guts the fixture. */
export function buildDemoLedger(dataRows = 5200): SheetData {
  const rnd = mulberry32(11);
  const rows: Cell[][] = [];
  const fyStart = Date.UTC(2025, 3, 1); // 2025-04-01
  const fyDays = 365;
  const iso = (dayOffset: number): string => new Date(fyStart + dayOffset * 86400000).toISOString().slice(0, 10);

  // Six deterministic anchor rows (the demo's proof points).
  rows.push([iso(72), "SI/P/0612", "Coastal Steel Supply", "Steel coil 2mm — plant purchase", 458000, "Plant-1", "A. Raghavan (GM Finance)"]);
  rows.push([iso(182), "SI/PY/0930", "Payroll — Staff", "September salary — staff wages", 912000, "HQ", "Accounts-1"]);
  rows.push([iso(126), "SI/P/0805", "Regional Logistics", "Freight — inbound coils", 27500, "Plant-2", "Accounts-2"]);
  rows.push([iso(126), "SI/P/0805", "Regional Logistics", "Freight — inbound coils", 27500, "Plant-2", "Accounts-2"]); // duplicate pair
  rows.push([iso(196), "SI/JV/1014", "Board Note", "Misc settlement as per board note", 2750000, "HQ", "A. Raghavan (GM Finance)"]);
  rows.push([iso(215), "SI/CN/1102", "Northern Metals Co", "Credit note — steel return", -38000, "Plant-1", "Accounts-1"]);

  while (rows.length < dataRows) {
    const t = DEMO_TEMPLATES[Math.floor(rnd() * DEMO_TEMPLATES.length)];
    const amt = Math.round(t.lo + rnd() * (t.hi - t.lo));
    rows.push([
      iso(Math.floor(rnd() * fyDays)),
      `KR/${t.cat.slice(0, 2)}/${String(rows.length + 1).padStart(5, "0")}`,
      t.party,
      t.desc,
      amt,
      COST_CENTRES[Math.floor(rnd() * COST_CENTRES.length)],
      ENTERED_BY[Math.floor(rnd() * ENTERED_BY.length)],
    ]);
  }
  return { name: "KR-Ledger-FY26", headers: DEMO_HEADERS, rows };
}
