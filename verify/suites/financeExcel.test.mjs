import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/financeExcel.test.ts
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// src/vh19/finance/xlsxLite.ts
import * as zlib from "node:zlib";
var CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 4294967295;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function findEocd(buf) {
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 101010256) return i;
  }
  throw new Error("xlsxLite: not a zip archive (no end-of-central-directory)");
}
function readZipEntries(buf) {
  const out = /* @__PURE__ */ new Map();
  const eocd = findEocd(buf);
  const total2 = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < total2; n++) {
    if (buf.readUInt32LE(off) !== 33639248) throw new Error("xlsxLite: bad central directory");
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw2 = buf.subarray(dataStart, dataStart + csize);
    const data = method === 0 ? Buffer.from(raw2) : zlib.inflateRawSync(raw2);
    out.set(name, data);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
function writeZipEntries(entries) {
  const now = /* @__PURE__ */ new Date();
  const dosTime = (now.getHours() & 31) << 11 | (now.getMinutes() & 63) << 5 | now.getSeconds() / 2 & 31;
  const dosDate = (now.getFullYear() - 1980 & 127) << 9 | (now.getMonth() + 1 & 15) << 5 | now.getDate() & 31;
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(67324752, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(2048, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.data.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(33639248, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(2048, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(e.data.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    locals.push(local, e.data);
    centrals.push(central);
    offset += local.length + e.data.length;
  }
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(101010256, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, eocd]);
}
function unescapeXml(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
}
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function colToIndex(ref) {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function indexToCol(i) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function parseSharedStrings(xml) {
  const out = [];
  for (const si of xml.match(/<si\b[^>]*>([\s\S]*?)<\/si>/g) ?? []) {
    const inner = si.replace(/^<si\b[^>]*>/, "").replace(/<\/si>$/, "");
    let text = "";
    for (const t of inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? []) {
      text += unescapeXml(t.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, ""));
    }
    out.push(text);
  }
  return out;
}
function parseSheetRows(xml, shared) {
  const rows = [];
  for (const rowXml of xml.match(/<row\b[^>]*>([\s\S]*?)<\/row>/g) ?? []) {
    const inner = rowXml.replace(/^<row\b[^>]*>/, "").replace(/<\/row>$/, "");
    const cells = [];
    const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let m;
    while (m = re.exec(inner)) {
      const attrs = m[1] ?? "";
      const body = m[2] ?? "";
      const rMatch = attrs.match(/\br="([A-Z]+)\d+"/);
      const col = rMatch ? colToIndex(rMatch[1]) : cells.length;
      const tMatch = attrs.match(/\bt="(\w+)"/);
      const t = tMatch ? tMatch[1] : "n";
      let value = null;
      if (t === "inlineStr") {
        const tm = body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        value = tm ? unescapeXml(tm[1]) : "";
      } else {
        const vm = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        const raw2 = vm ? unescapeXml(vm[1]) : "";
        if (raw2 === "") value = null;
        else if (t === "s") value = shared[Number(raw2)] ?? "";
        else if (t === "b") value = raw2 === "1";
        else if (t === "str" || t === "e") value = raw2;
        else {
          const n = Number(raw2);
          value = Number.isNaN(n) ? raw2 : n;
        }
      }
      while (cells.length < col) cells.push(null);
      cells[col] = value;
    }
    rows.push(cells);
  }
  return rows;
}
function readXlsx(buf, opts) {
  const files = readZipEntries(buf);
  const sharedXml = files.get("xl/sharedStrings.xml");
  const shared = sharedXml ? parseSharedStrings(sharedXml.toString("utf8")) : [];
  let sheetPath = "xl/worksheets/sheet1.xml";
  const rels = files.get("xl/_rels/workbook.xml.rels");
  const wb = files.get("xl/workbook.xml");
  let sheetName = "Sheet1";
  if (wb) {
    const sm = wb.toString("utf8").match(/<sheet\b[^>]*\bname="([^"]*)"/);
    if (sm) sheetName = unescapeXml(sm[1]);
  }
  if (rels) {
    const rm = rels.toString("utf8").match(/<Relationship\b[^>]*Target="([^"]*sheet[^"]*)"/);
    if (rm) {
      const target = rm[1].startsWith("/") ? rm[1].slice(1) : `xl/${rm[1].replace(/^\.\//, "")}`;
      sheetPath = target;
    }
  }
  const sheetXml = files.get(sheetPath) ?? files.get("xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new Error("xlsxLite: workbook contains no worksheet");
  const rows = parseSheetRows(sheetXml.toString("utf8"), shared);
  const headerAt = opts?.headerRow ?? 0;
  const headers = (rows[headerAt] ?? []).map((c) => c === null ? "" : String(c));
  const width = headers.length;
  const data = rows.slice(headerAt + 1).map((r) => {
    const out = [];
    for (let i = 0; i < width; i++) out.push(r[i] ?? null);
    return out;
  });
  return { name: sheetName, headers, rows: data };
}
function writeXlsx(sheet) {
  const width = Math.max(sheet.headers.length, ...sheet.rows.map((r) => r.length), 1);
  const allRows = [sheet.headers.map((h) => h), ...sheet.rows];
  const rowXml = allRows.map((row, ri) => {
    const cells = row.map((cell, ci) => {
      if (cell === null || cell === void 0) return "";
      const ref = `${indexToCol(ci)}${ri + 1}`;
      if (typeof cell === "number" && Number.isFinite(cell)) {
        return `<c r="${ref}"><v>${cell}</v></c>`;
      }
      if (typeof cell === "boolean") {
        return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(cell))}</t></is></c>`;
    }).join("");
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join("");
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
  void width;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheet.name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  return writeZipEntries([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRels, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbook, "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(wbRels, "utf8") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheetXml, "utf8") }
  ]);
}

// src/vh19/finance/financeEngine.ts
import { createHash } from "node:crypto";
var CATEGORIES = [
  "RAW-MATERIALS",
  "PAYROLL",
  "LOGISTICS-FREIGHT",
  "UTILITIES",
  "REPAIRS-MAINTENANCE",
  "TRAVEL-DA",
  "OFFICE-ADMIN",
  "PROFESSIONAL-FEES",
  "TAX-DUTIES",
  "BANK-CHARGES",
  "SALES-RECEIPTS",
  "MISC"
];
var CATEGORY_KEYWORDS = {
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
  "SALES-RECEIPTS": ["received", "receipt", "sales", "collection", "payment in", "customer", "invoice out"]
};
var sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
function detectColumns(headers) {
  const find = (res, fallback) => {
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
    by: find([/entered|by|user/i], 6)
  };
}
function textOf(cells, idx) {
  const v = cells[idx];
  return v === null || v === void 0 ? "" : String(v).toLowerCase();
}
function amountOf(cells, idx) {
  const v = cells[idx];
  return typeof v === "number" ? v : Number(v) || 0;
}
function monthOf(cells, idx) {
  const v = cells[idx];
  if (typeof v === "string" && /^\d{4}-\d{2}/.test(v)) return v.slice(0, 7);
  if (typeof v === "number" && v > 2e4 && v < 8e4) {
    const ms = Date.UTC(1899, 11, 30) + v * 864e5;
    return new Date(ms).toISOString().slice(0, 7);
  }
  return "UNKNOWN";
}
function classifyRow(row, cols2) {
  const text = `${textOf(row, cols2.desc)} ${textOf(row, cols2.party)}`;
  for (const cat of CATEGORIES) {
    if (cat === "MISC") continue;
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (text.includes(kw)) return { category: cat, confidence: "rules" };
    }
  }
  return { category: "MISC", confidence: "rules" };
}
function sortLedger(rows, cols2, keys = ["date", "category", "party"], dir = "asc") {
  const sign = dir === "asc" ? 1 : -1;
  const val = (r, k) => {
    switch (k) {
      case "date":
        return String(r.row[cols2.date] ?? "");
      case "amount":
        return amountOf(r.row, cols2.amount);
      case "category":
        return r.category;
      case "party":
        return textOf(r.row, cols2.party);
      default:
        return "";
    }
  };
  return rows.map((r, i) => ({ r, i })).sort((a, b) => {
    for (const k of keys) {
      const va = val(a.r, k);
      const vb = val(b.r, k);
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      if (c !== 0) return sign * c;
    }
    return a.i - b.i;
  }).map((x) => x.r);
}
function classifyLedger(sheet, opts) {
  const cols2 = detectColumns(sheet.headers);
  const seen = /* @__PURE__ */ new Map();
  let mode = "rules-only";
  let classified = sheet.rows.map((row) => {
    const { category } = classifyRow(row, cols2);
    const flags = [];
    const key = `${row[cols2.date]}|${textOf(row, cols2.party)}|${amountOf(row, cols2.amount)}`;
    const dupCount = seen.get(key) ?? 0;
    seen.set(key, dupCount + 1);
    if (dupCount > 0) flags.push("DUPLICATE");
    const amt = amountOf(row, cols2.amount);
    if (amt < 0) flags.push("NEGATIVE-AMOUNT");
    if (category === "MISC" && Math.abs(amt) >= 2e5) flags.push("REVIEW-HIGH-VALUE");
    return { row, category, confidence: "rules", flags };
  });
  const firstSeen = /* @__PURE__ */ new Map();
  classified.forEach((r, i) => {
    const key = `${r.row[cols2.date]}|${textOf(r.row, cols2.party)}|${amountOf(r.row, cols2.amount)}`;
    const prev = firstSeen.get(key);
    if (prev === void 0) firstSeen.set(key, i);
    else if (!classified[prev].flags.includes("DUPLICATE")) classified[prev].flags.push("DUPLICATE");
  });
  const stats = /* @__PURE__ */ new Map();
  for (const r of classified) {
    const arr = stats.get(r.category) ?? [];
    arr.push(amountOf(r.row, cols2.amount));
    stats.set(r.category, arr);
  }
  for (const r of classified) {
    const arr = stats.get(r.category) ?? [];
    if (arr.length < 8) continue;
    const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length);
    if (sd > 0 && Math.abs(amountOf(r.row, cols2.amount) - mean) > 4 * sd) {
      if (!r.flags.includes("OUTLIER")) r.flags.push("OUTLIER");
    }
  }
  classified = sortLedger(classified, cols2, opts?.keys, opts?.dir);
  const byCategory = {};
  const byMonth = {};
  const flagged = {};
  for (const r of classified) {
    const amt = amountOf(r.row, cols2.amount);
    const c = byCategory[r.category] ??= { count: 0, total: 0 };
    c.count += 1;
    c.total += amt;
    const m = monthOf(r.row, cols2.date);
    byMonth[m] = (byMonth[m] ?? 0) + amt;
    for (const f of r.flags) flagged[f] = (flagged[f] ?? 0) + 1;
  }
  const inputDigest = sha(JSON.stringify({ headers: sheet.headers, rows: sheet.rows }));
  const outputDigest = sha(JSON.stringify(classified.map((r) => [r.row, r.category, r.flags])));
  const chain = [];
  const mint = (op, rows) => {
    const prev = chain.length ? chain[chain.length - 1].digest : null;
    const body = { seq: chain.length + 1, op, rows, mode, inputDigest, outputDigest, prev, nonce: `stage-${op}` };
    const digest = sha(JSON.stringify(body));
    chain.push({ ...body, digest });
  };
  mint("classify", classified.length);
  mint("sort", classified.length);
  mint("summarise", classified.length);
  return { sheet: buildOutputSheet(sheet, classified, cols2), classified, summary: { byCategory, byMonth, flagged }, receipts: chain, mode };
}
function verifyReceipts(receipts) {
  let prev = null;
  for (const r of receipts) {
    if (r.prev !== prev) return false;
    const { digest, ...body } = r;
    const recomputed = sha(JSON.stringify({ ...body, nonce: `stage-${r.op}` }));
    if (recomputed !== digest) return false;
    prev = digest;
  }
  return true;
}
function buildOutputSheet(input, classified, cols2) {
  const headers = [...input.headers, "Category", "Confidence", "Flags", "Month"];
  const rows = classified.map((r) => [
    ...r.row,
    r.category,
    r.confidence,
    r.flags.join(";"),
    monthOf(r.row, cols2.date)
  ]);
  return { name: `${input.name}-Classified`, headers, rows };
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var DEMO_HEADERS = ["Date", "Voucher No", "Party", "Description", "Amount (INR)", "Cost Centre", "Entered By"];
var DEMO_TEMPLATES = [
  { cat: "RAW-MATERIALS", party: "Coastal Steel Supply", desc: "Steel coil 2mm \u2014 plant purchase", lo: 12e4, hi: 89e4 },
  { cat: "RAW-MATERIALS", party: "Allied Fasteners", desc: "Fasteners and bar stock purchase", lo: 3e4, hi: 18e4 },
  { cat: "PAYROLL", party: "Payroll \u2014 Staff", desc: "Monthly salary \u2014 staff wages", lo: 85e4, hi: 98e4 },
  { cat: "LOGISTICS-FREIGHT", party: "Regional Logistics", desc: "Freight \u2014 inbound coils", lo: 8e3, hi: 62e3 },
  { cat: "LOGISTICS-FREIGHT", party: "Metro Transport", desc: "Lorry transport \u2014 despatch to customer", lo: 5e3, hi: 4e4 },
  { cat: "UTILITIES", party: "Grid Power \u2014 Unit 1", desc: "Electricity bill \u2014 Plant-1", lo: 6e4, hi: 21e4 },
  { cat: "REPAIRS-MAINTENANCE", party: "Precision Machine Tools", desc: "Machine service and spares", lo: 12e3, hi: 15e4 },
  { cat: "TRAVEL-DA", party: "Travel Desk", desc: "Travel DA \u2014 sales team", lo: 3e3, hi: 45e3 },
  { cat: "OFFICE-ADMIN", party: "City Stationers", desc: "Stationery and printing", lo: 2e3, hi: 25e3 },
  { cat: "PROFESSIONAL-FEES", party: "Northgate Consultancy", desc: "Audit and professional fees", lo: 25e3, hi: 2e5 },
  { cat: "TAX-DUTIES", party: "GST Portal", desc: "GST challan payment", lo: 5e4, hi: 4e5 },
  { cat: "BANK-CHARGES", party: "Bank \u2014 Current A/c", desc: "Bank charges and neft commission", lo: 500, hi: 9e3 },
  { cat: "SALES-RECEIPTS", party: "Customer \u2014 Ridgeway Engg", desc: "Payment received against invoice", lo: 15e4, hi: 12e5 }
];
var COST_CENTRES = ["Plant-1", "Plant-2", "HQ", "Export Cell"];
var ENTERED_BY = ["Accounts-1", "Accounts-2", "A. Raghavan (GM Finance)", "Finance Lead", "HR Lead"];
function buildDemoLedger(dataRows = 5200) {
  const rnd = mulberry32(11);
  const rows = [];
  const fyStart = Date.UTC(2025, 3, 1);
  const fyDays = 365;
  const iso = (dayOffset) => new Date(fyStart + dayOffset * 864e5).toISOString().slice(0, 10);
  rows.push([iso(72), "SI/P/0612", "Coastal Steel Supply", "Steel coil 2mm \u2014 plant purchase", 458e3, "Plant-1", "A. Raghavan (GM Finance)"]);
  rows.push([iso(182), "SI/PY/0930", "Payroll \u2014 Staff", "September salary \u2014 staff wages", 912e3, "HQ", "Accounts-1"]);
  rows.push([iso(126), "SI/P/0805", "Regional Logistics", "Freight \u2014 inbound coils", 27500, "Plant-2", "Accounts-2"]);
  rows.push([iso(126), "SI/P/0805", "Regional Logistics", "Freight \u2014 inbound coils", 27500, "Plant-2", "Accounts-2"]);
  rows.push([iso(196), "SI/JV/1014", "Board Note", "Misc settlement as per board note", 275e4, "HQ", "A. Raghavan (GM Finance)"]);
  rows.push([iso(215), "SI/CN/1102", "Northern Metals Co", "Credit note \u2014 steel return", -38e3, "Plant-1", "Accounts-1"]);
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
      ENTERED_BY[Math.floor(rnd() * ENTERED_BY.length)]
    ]);
  }
  return { name: "KR-Ledger-FY26", headers: DEMO_HEADERS, rows };
}

// probe/financeExcel.test.ts
var checks = 0;
var ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks += 1;
};
var raw = buildDemoLedger(5200);
ok(raw.rows.length === 5200, "ledger has 5200 data rows");
ok(raw.headers.length === 7, "ledger has 7 columns");
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "11h-fin-"));
var rawPath = path.join(tmp, "raw.xlsx");
fs.writeFileSync(rawPath, writeXlsx(raw));
var back = readXlsx(fs.readFileSync(rawPath));
ok(back.headers.join("|") === raw.headers.join("|"), "headers survive round-trip");
ok(back.rows.length === raw.rows.length, "row count survives round-trip");
ok(String(back.rows[0][2]) === "Coastal Steel Supply", "first anchor row survives");
ok(indexToCol(0) === "A" && indexToCol(25) === "Z" && indexToCol(26) === "AA", "column letters");
ok(colToIndex("A") === 0 && colToIndex("AA") === 26, "column indexes");
var result = classifyLedger(back);
ok(result.mode === "rules-only", "rules-only mode is labelled honestly");
var cols = detectColumns(back.headers);
var findRow = (voucher, amt) => result.classified.filter((r) => String(r.row[cols.voucher]) === voucher && Number(r.row[cols.amount]) === amt);
var anchor = findRow("SI/P/0612", 458e3);
ok(anchor.length === 1 && anchor[0].category === "RAW-MATERIALS", "steel purchase -> RAW-MATERIALS");
var salary = findRow("SI/PY/0930", 912e3);
ok(salary.length === 1 && salary[0].category === "PAYROLL", "salary -> PAYROLL");
var dups = findRow("SI/P/0805", 27500);
ok(dups.length === 2, "duplicate pair both present");
ok(dups.every((r) => r.flags.includes("DUPLICATE")), "duplicate pair both flagged");
var misc = findRow("SI/JV/1014", 275e4);
ok(misc.length === 1 && misc[0].category === "MISC", "board-note unknown -> MISC (never guessed)");
ok(misc[0].flags.includes("REVIEW-HIGH-VALUE"), "high-value unknown is flagged for review");
var credit = findRow("SI/CN/1102", -38e3);
ok(credit.length === 1 && credit[0].flags.includes("NEGATIVE-AMOUNT"), "credit note flagged NEGATIVE-AMOUNT");
var dates = result.classified.map((r) => String(r.row[cols.date]));
ok(dates.every((d, i) => i === 0 || d >= dates[i - 1]), "sorted by date ascending");
var total = result.classified.reduce((s, r) => s + Number(r.row[cols.amount]), 0);
var summaryTotal = Object.values(result.summary.byCategory).reduce((s, c) => s + c.total, 0);
ok(Math.abs(total - summaryTotal) < 1e-6, "category totals sum to the ledger");
ok(result.summary.flagged["DUPLICATE"] === 2, "two duplicate lines flagged");
ok(result.summary.flagged["REVIEW-HIGH-VALUE"] === 1, "one high-value review flag");
var m0 = monthOf(back.rows[0], cols.date);
ok(/^\d{4}-\d{2}$/.test(m0), "month grouping key format");
ok(verifyReceipts(result.receipts), "receipt chain verifies");
ok(result.receipts.length === 3 && result.receipts[2].prev === result.receipts[1].digest, "chain is linked");
var tampered = JSON.parse(JSON.stringify(result.receipts));
tampered[1].rows = 999;
ok(!verifyReceipts(tampered), "tampered chain is refused");
var outPath = path.join(tmp, "classified.xlsx");
fs.writeFileSync(outPath, writeXlsx(result.sheet));
var outBack = readXlsx(fs.readFileSync(outPath));
ok(outBack.headers.slice(-4).join("|") === "Category|Confidence|Flags|Month", "output columns appended");
ok(outBack.rows.length === raw.rows.length, "no rows lost in classification");
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`financeExcel: PASS (${checks} checks, 5200 rows)`);
