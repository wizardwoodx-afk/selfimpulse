import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/munshi/index.ts
var munshi_exports = {};
__export(munshi_exports, {
  AGENTS: () => AGENTS,
  B2CL_THRESHOLD: () => B2CL_THRESHOLD,
  CURRENT_RATES: () => CURRENT_RATES,
  LEGACY_RATES: () => LEGACY_RATES,
  RULESET: () => RULESET,
  RULESET_BASIS: () => RULESET_BASIS,
  STATE_CODES: () => STATE_CODES,
  TCS_TABLE: () => TCS_TABLE,
  TDS_TABLE: () => TDS_TABLE,
  TDS_TRANSITION_DATE: () => TDS_TRANSITION_DATE,
  ZERO: () => ZERO,
  add: () => add,
  agentCount: () => agentCount,
  agentsByDomain: () => agentsByDomain,
  assessPayables: () => assessPayables,
  buildGstr1: () => buildGstr1,
  buildGstr3b: () => buildGstr3b,
  checkIrnCancellationWindow: () => checkIrnCancellationWindow,
  checkIrnWindow: () => checkIrnWindow,
  classifyEnterprise: () => classifyEnterprise,
  computeTds: () => computeTds,
  daysBetween: () => daysBetween,
  daysOverdue: () => daysOverdue,
  dueDates: () => dueDates,
  eInvoiceStatus: () => eInvoiceStatus,
  ewayBillValidity: () => ewayBillValidity,
  explainGstin: () => explainGstin,
  explainStatuteReference: () => explainStatuteReference,
  financialYearOf: () => financialYearOf,
  findAgent: () => findAgent,
  formatCompact: () => formatCompact,
  formatINR: () => formatINR,
  fyEnd: () => fyEnd,
  fyStart: () => fyStart,
  gstinCheckChar: () => gstinCheckChar,
  hardLockCrosswalk: () => hardLockCrosswalk,
  interestOnLateTax: () => interestOnLateTax,
  irnReportingDeadline: () => irnReportingDeadline,
  isCurrentRate: () => isCurrentRate,
  isLegacyRate: () => isLegacyRate,
  isValidGstin: () => isValidGstin,
  itcAvailDeadline: () => itcAvailDeadline,
  itcTimeBarred: () => itcTimeBarred,
  lateFee: () => lateFee,
  msme1DueDates: () => msme1DueDates,
  nextPeriod: () => nextPeriod,
  normaliseInvoiceNumber: () => normaliseInvoiceNumber,
  paise: () => paise,
  parseAmount: () => parseAmount,
  parseRate: () => parseRate,
  paymentDeadline: () => paymentDeadline,
  periodLabel: () => periodLabel,
  periodsOf: () => periodsOf,
  placeOfSupply: () => placeOfSupply,
  prioritise: () => prioritise,
  rate: () => rate,
  rateForHsn: () => rateForHsn,
  reconcile: () => reconcile,
  reconcileTds: () => reconcileTds,
  returnFormFor: () => returnFormFor,
  rosterStatus: () => rosterStatus,
  roundReturnTotals: () => roundReturnTotals,
  roundToRupee: () => roundToRupee,
  rulesetStamp: () => rulesetStamp,
  rupeesToPaise: () => rupeesToPaise,
  splitIntraState: () => splitIntraState,
  statuteForEvent: () => statuteForEvent,
  statuteReference: () => statuteReference,
  sub: () => sub,
  taxPeriodOf: () => taxPeriodOf,
  tcsSection: () => tcsSection,
  tdsSection: () => tdsSection,
  times: () => times,
  validateGstin: () => validateGstin,
  validatePan: () => validatePan,
  vendorKey: () => vendorKey
});

// src/munshi/ruleset.ts
var RULESET = "IN-2026.09";
var RULESET_BASIS = Object.freeze({
  gstRates: "22 September 2025 (56th GST Council) \u2014 12% and 28% slabs abolished for most goods and services",
  gstr3bLock: "July 2025 tax period onwards \u2014 auto-populated liability fields are non-editable; corrections move to GSTR-1 / GSTR-1A",
  einvoice30Day: "1 April 2025 \u2014 30-day IRP reporting limit for AATO \u20B910 crore and above (Rule 48(4)/48(5))",
  einvoiceMandate: "1 August 2023 \u2014 e-invoicing mandatory at AATO \u20B95 crore and above",
  tds: "Finance Act 2025, effective 1 April 2025 \u2014 206AB/206CCA omitted, 206C(1H) repealed, 194T introduced, 194J threshold \u20B950,000",
  tdsAct2026: "1 April 2026 \u2014 the Income-tax Act, 2025 governs TDS on the EARLIER of credit or payment falling on or after that date: salary s.392, residents s.393 (one table), non-residents s.393(2), any person s.393(3), TCS s.394; rates and thresholds unchanged, the section reference changes",
  msme: "Section 43B(h) \u2014 payments to micro and small enterprises within 45 days (15 where no agreement)",
  ims: "Invoice Management System \u2014 accept / reject / pending actioning drives the recipient's GSTR-2B"
});
function rulesetStamp() {
  return `${RULESET} (gst-rates ${RULESET_BASIS.gstRates.slice(0, 4)} \u2026)`;
}

// src/munshi/money.ts
var ZERO = 0;
function paise(n) {
  if (!Number.isFinite(n)) throw new Error(`munshi/money: not a finite amount: ${n}`);
  return Math.round(n);
}
function rupeesToPaise(rupees) {
  return paise(rupees * 100);
}
function add(...amounts) {
  return amounts.reduce((a, b) => a + b, 0);
}
function sub(a, b) {
  return a - b;
}
function times(a, qty) {
  return paise(a * qty);
}
function rate(amount, percent) {
  return paise(amount * percent / 100);
}
function roundToRupee(amount) {
  return Math.round(amount / 100) * 100;
}
function splitIntraState(tax) {
  const half = Math.floor(tax / 2);
  return { cgst: half, sgst: tax - half };
}
function formatINR(amount, opts = {}) {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const s = String(whole);
  let grouped;
  if (s.length <= 3) {
    grouped = s;
  } else {
    const head = s.slice(0, s.length - 3);
    const tail = s.slice(s.length - 3);
    grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + tail;
  }
  const dec = opts.paisePart === false ? "" : `.${String(frac).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${opts.symbol === false ? "" : "\u20B9"}${grouped}${dec}`;
}
function formatCompact(amount) {
  const rupees = Math.abs(amount) / 100;
  const sign = amount < 0 ? "-" : "";
  if (rupees >= 1e7) return `${sign}\u20B9${(rupees / 1e7).toFixed(2)} Cr`;
  if (rupees >= 1e5) return `${sign}\u20B9${(rupees / 1e5).toFixed(2)} L`;
  if (rupees >= 1e3) return `${sign}\u20B9${(rupees / 1e3).toFixed(1)}k`;
  return formatINR(amount);
}
function parseAmount(input) {
  if (input === null || input === void 0) return null;
  let s = String(input).trim();
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/[₹,\s]/g, "");
  const word = s.match(/^([0-9]*\.?[0-9]+)(cr|crore|l|lakh|lac|lacs|k)$/i);
  if (word) {
    const n2 = Number(word[1]);
    if (!Number.isFinite(n2)) return null;
    const unit = word[2].toLowerCase();
    const mult = unit.startsWith("cr") ? 1e7 : unit.startsWith("l") ? 1e5 : 1e3;
    const value2 = rupeesToPaise(n2 * mult);
    return negative ? -value2 : value2;
  }
  if (!/^[0-9]*\.?[0-9]+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const value = rupeesToPaise(n);
  return negative ? -value : value;
}
function parseRate(input) {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const m = String(input).trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*%?$/);
  return m ? Number(m[1]) : null;
}

// src/munshi/gstin.ts
var BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var STATE_CODES = Object.freeze({
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu (merged into 26)",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (pre-bifurcation)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction"
});
var PAN_HOLDER = Object.freeze({
  P: "Individual",
  C: "Company",
  H: "Hindu Undivided Family",
  F: "Firm / LLP",
  A: "Association of Persons",
  T: "Trust",
  B: "Body of Individuals",
  L: "Local Authority",
  J: "Artificial Juridical Person",
  G: "Government"
});
function gstinCheckChar(first142) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = BASE36.indexOf(first142.charAt(i).toUpperCase());
    if (value < 0) return "?";
    const factor = i % 2 === 0 ? 1 : 2;
    const product = value * factor;
    sum += Math.floor(product / 36) + product % 36;
  }
  return BASE36.charAt((36 - sum % 36) % 36);
}
function validatePan(pan) {
  const p = String(pan ?? "").trim().toUpperCase();
  if (p.length !== 10) return { ok: false, code: "pan-length" };
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p)) return { ok: false, code: "pan-format" };
  const kind = PAN_HOLDER[p.charAt(3)];
  if (!kind) return { ok: false, code: "pan-holder-type" };
  return { ok: true, holderType: kind };
}
function validateGstin(input) {
  const g = String(input ?? "").trim().toUpperCase().replace(/\s/g, "");
  if (g.length !== 15) return { ok: false, code: "length", detail: `${g.length} characters, expected 15` };
  if (!/^[0-9A-Z]+$/.test(g)) return { ok: false, code: "characters", detail: "ASCII letters and digits only" };
  const stateCode = g.slice(0, 2);
  const state = STATE_CODES[stateCode];
  if (!state) return { ok: false, code: "state-code", detail: `${stateCode} is not an issued state code` };
  const pan = g.slice(2, 12);
  const panCheck = validatePan(pan);
  if (!panCheck.ok) return { ok: false, code: "pan-format", detail: `embedded PAN ${pan} \u2014 ${panCheck.code}` };
  const entityNumber = g.charAt(12);
  if (!/^[0-9A-Z]$/.test(entityNumber)) {
    return { ok: false, code: "entity-number", detail: `entity number ${entityNumber} is not 1\u20139 or A\u2013Z` };
  }
  if (g.charAt(13) !== "Z") {
    return { ok: false, code: "reserved-char", detail: `character 14 is ${g.charAt(13)}, expected Z` };
  }
  const expected = gstinCheckChar(g.slice(0, 14));
  if (g.charAt(14) !== expected) {
    return { ok: false, code: "checksum", detail: `check character is ${g.charAt(14)}, expected ${expected}` };
  }
  return {
    ok: true,
    parts: {
      gstin: g,
      stateCode,
      state,
      pan,
      holderType: panCheck.holderType ?? "Unknown",
      entityNumber,
      registrationKey: `${pan}/${stateCode}/${entityNumber}`
    }
  };
}
function isValidGstin(input) {
  return validateGstin(input).ok;
}
function explainGstin(input) {
  const v = validateGstin(input);
  if (v.ok) {
    const p = v.parts;
    return `valid \xB7 ${p.state} (${p.stateCode}) \xB7 ${p.holderType} \xB7 entity ${p.entityNumber}`;
  }
  return `INVALID (${v.code}) \u2014 ${v.detail}`;
}
function vendorKey(gstin) {
  const v = validateGstin(gstin);
  return v.ok ? v.parts.registrationKey : null;
}

// src/munshi/period.ts
var MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
function taxPeriodOf(isoDate) {
  return isoDate.slice(0, 7);
}
function nextPeriod(period) {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${MONTHS[m]}`;
}
function periodLabel(period) {
  const [y, m] = period.split("-").map(Number);
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[m - 1]} ${y}`;
}
function financialYearOf(isoDate) {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
function fyStart(fy) {
  return `${fy.slice(0, 4)}-04-01`;
}
function fyEnd(fy) {
  const startYear = Number(fy.slice(0, 4));
  return `${startYear + 1}-03-31`;
}
function periodsOf(fy) {
  const startYear = Number(fy.slice(0, 4));
  return [
    ...MONTHS.slice(3).map((m) => `${startYear}-${m}`),
    ...MONTHS.slice(0, 3).map((m) => `${startYear + 1}-${m}`)
  ];
}
function dueDates(kind, period, scheme = "monthly", qrmpCategory = "X") {
  const [y, m] = period.split("-").map(Number);
  const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const day = (d, inPeriod = period) => {
    const [py, pm] = inPeriod.split("-").map(Number);
    const nm = pm === 12 ? { y: py + 1, m: 1 } : { y: py, m: pm + 1 };
    return `${nm.y}-${String(nm.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  switch (kind) {
    case "GSTR-1":
      return scheme === "monthly" ? [{ kind, period, due: day(11), basis: "Rule 59(1) \u2014 11th of the following month", ruleset: RULESET }] : [{ kind, period, due: day(13), basis: "Rule 59(1) proviso \u2014 13th after quarter end (QRMP)", ruleset: RULESET }];
    case "IFF":
      return [{ kind, period, due: day(13), basis: "Rule 59(2) \u2014 IFF by the 13th of the next month (QRMP)", ruleset: RULESET }];
    case "GSTR-1A":
      return [{ kind, period, due: day(11), basis: "GSTR-1A is filed before the period's GSTR-3B \u2014 corrections must reach the 3B", ruleset: RULESET }];
    case "GSTR-3B":
      if (scheme === "monthly") {
        return [{ kind, period, due: day(20), basis: "Rule 61(1)(i) \u2014 20th of the following month", ruleset: RULESET }];
      }
      return [{
        kind,
        period,
        due: day(qrmpCategory === "X" ? 22 : 24),
        basis: `Rule 61(1)(ii) \u2014 QRMP Category ${qrmpCategory} (${qrmpCategory === "X" ? "22nd" : "24th"})`,
        ruleset: RULESET
      }];
    case "GSTR-9":
    case "GSTR-9C":
      return [{
        kind,
        period,
        due: `${Number(period.slice(0, 4)) + 1}-12-31`,
        basis: "Annual return for the FY ending in this year \u2014 due 31 December",
        ruleset: RULESET
      }];
    case "CMP-08":
      return [{ kind, period, due: day(18), basis: "Rule 61A \u2014 composition quarterly statement by the 18th", ruleset: RULESET }];
    case "GSTR-4":
      return [{ kind, period, due: `${Number(period.slice(0, 4)) + 1}-06-30`, basis: "Rule 62 \u2014 annual composition return by 30 June", ruleset: RULESET }];
    case "ITC-04":
      return [{ kind, period, due: day(25), basis: "Rule 45 \u2014 job-work statement (half-yearly / annual by turnover)", ruleset: RULESET }];
    case "GSTR-7":
      return [{ kind, period, due: day(10), basis: "Rule 66 \u2014 TDS deductor return by the 10th", ruleset: RULESET }];
    case "GSTR-8":
      return [{ kind, period, due: day(10), basis: "Rule 67 \u2014 e-commerce operator return by the 10th", ruleset: RULESET }];
    default:
      void nextMonth;
      return [];
  }
}
function daysBetween(a, b) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 864e5);
}
function daysOverdue(due, asOn) {
  return Math.max(0, daysBetween(due, asOn));
}

// src/munshi/gst/itc.ts
var DEFAULTS = {
  valueTolerance: 100,
  periodToleranceDays: 32,
  separateNotes: true
};
function normaliseInvoiceNumber(raw) {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function taxOf(inv) {
  return (inv.igst ?? 0) + (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.cess ?? 0);
}
function kindOf(inv) {
  return inv.documentType ?? "invoice";
}
function identity(inv) {
  return `${kindOf(inv)}|${inv.gstin}|${normaliseInvoiceNumber(inv.invoiceNumber)}`;
}
function sameDocument(a, b, tol) {
  if (a.gstin !== b.gstin) return false;
  if (normaliseInvoiceNumber(a.invoiceNumber) !== normaliseInvoiceNumber(b.invoiceNumber)) return false;
  if (kindOf(a) !== kindOf(b)) return false;
  if (Math.abs(daysBetween(a.invoiceDate, b.invoiceDate)) > tol.periodToleranceDays) return false;
  return true;
}
function reconcile(books2, gstr2b2, options = {}) {
  const tol = { ...DEFAULTS, ...options };
  const results = [];
  const used2b = /* @__PURE__ */ new Set();
  const usedBooks = /* @__PURE__ */ new Set();
  books2.forEach((b, i) => {
    if (b.reverseCharge === true) {
      usedBooks.add(i);
      results.push({
        outcome: "reverse-charge",
        books: b,
        itcAtRisk: 0,
        detail: `RCM \u2014 self-assessed by the recipient; correctly absent from 2B. ITC on it is claimed in the period the tax is paid (${RULESET})`
      });
    }
  });
  const seenBooks = /* @__PURE__ */ new Map();
  books2.forEach((b, i) => {
    if (usedBooks.has(i)) return;
    const key = identity(b);
    if (seenBooks.has(key)) {
      usedBooks.add(i);
      results.push({
        outcome: "duplicate-in-books",
        books: b,
        itcAtRisk: taxOf(b),
        detail: `same document booked twice (first at row ${seenBooks.get(key)}) \u2014 ITC is claimable once`
      });
    } else {
      seenBooks.set(key, i);
    }
  });
  const seen2b = /* @__PURE__ */ new Map();
  gstr2b2.forEach((g, i) => {
    const key = identity(g);
    if (seen2b.has(key)) {
      used2b.add(i);
      results.push({
        outcome: "duplicate-in-2b",
        gstr2b: g,
        itcAtRisk: 0,
        detail: "the portal carries this document twice \u2014 verify before claiming"
      });
    } else {
      seen2b.set(key, i);
    }
  });
  books2.forEach((b, i) => {
    if (usedBooks.has(i)) return;
    const j = gstr2b2.findIndex((g2, k) => !used2b.has(k) && sameDocument(b, g2, tol));
    if (j < 0) return;
    const g = gstr2b2[j];
    usedBooks.add(i);
    used2b.add(j);
    const taxDelta = taxOf(b) - taxOf(g);
    const valueDelta = b.taxableValue - g.taxableValue;
    if (Math.abs(taxDelta) <= tol.valueTolerance && Math.abs(valueDelta) <= tol.valueTolerance) {
      results.push({
        outcome: "exact",
        books: b,
        gstr2b: g,
        itcAtRisk: 0,
        detail: "books and 2B agree \u2014 ITC safe to claim"
      });
      return;
    }
    if (Math.abs(taxDelta) > tol.valueTolerance) {
      results.push({
        outcome: "tax-mismatch",
        books: b,
        gstr2b: g,
        itcAtRisk: Math.abs(taxDelta),
        detail: `tax differs by ${taxDelta} paise \u2014 claim only the 2B figure; the excess is not available until the supplier amends its GSTR-1`
      });
      return;
    }
    results.push({
      outcome: "value-mismatch",
      books: b,
      gstr2b: g,
      itcAtRisk: Math.abs(valueDelta),
      detail: `taxable value differs by ${valueDelta} paise but tax agrees \u2014 usually a rounding or a discount booked late; the 2B figure governs`
    });
  });
  books2.forEach((b, i) => {
    if (usedBooks.has(i)) return;
    const j = gstr2b2.findIndex((g2, k) => !used2b.has(k) && g2.gstin === b.gstin && kindOf(g2) === kindOf(b) && Math.abs(taxOf(g2) - taxOf(b)) <= tol.valueTolerance && Math.abs(g2.taxableValue - b.taxableValue) <= tol.valueTolerance);
    if (j < 0) return;
    const g = gstr2b2[j];
    usedBooks.add(i);
    used2b.add(j);
    results.push({
      outcome: "period-mismatch",
      books: b,
      gstr2b: g,
      itcAtRisk: 0,
      detail: `same supplier, same amount, different number ("${b.invoiceNumber}" vs "${g.invoiceNumber}") \u2014 likely one document renumbered. Credit is claimable in the 2B period, but confirm the number before filing`
    });
  });
  books2.forEach((b, i) => {
    if (usedBooks.has(i)) return;
    results.push({
      outcome: "missing-in-2b",
      books: b,
      itcAtRisk: taxOf(b),
      detail: `not in 2B \u2014 supplier has not filed it. Do not claim yet: follow up, and use IMS to keep it pending rather than rejecting it`
    });
  });
  gstr2b2.forEach((g, j) => {
    if (used2b.has(j)) return;
    const taxable = g.taxableValue;
    results.push({
      outcome: "missing-in-books",
      gstr2b: g,
      itcAtRisk: 0,
      detail: `in 2B but not in books (taxable ${taxable} paise) \u2014 either a genuine purchase never recorded, or an invoice addressed to someone else. Both are findings`
    });
  });
  return { results, summary: summarise(results) };
}
function summarise(results) {
  const byOutcome2 = {};
  let atRisk = 0, unclaimed = 0, agreed = 0;
  for (const r of results) {
    byOutcome2[r.outcome] = (byOutcome2[r.outcome] ?? 0) + 1;
    if (r.outcome === "exact" || r.outcome === "period-mismatch") agreed++;
    if (r.outcome === "missing-in-2b") unclaimed += r.itcAtRisk;
    else atRisk += r.itcAtRisk;
  }
  return {
    total: results.length,
    byOutcome: byOutcome2,
    itcAtRisk: atRisk,
    itcUnclaimed: unclaimed,
    agreed,
    ruleset: RULESET
  };
}
function prioritise(results) {
  const order = [
    "tax-mismatch",
    "duplicate-in-books",
    "gstin-mismatch",
    "value-mismatch",
    "missing-in-2b",
    "missing-in-books",
    "duplicate-in-2b",
    "cancelled-in-2b",
    "period-mismatch",
    "reverse-charge",
    "rate-mismatch",
    "exact"
  ];
  return [...results].sort((a, b) => order.indexOf(a.outcome) - order.indexOf(b.outcome) || b.itcAtRisk - a.itcAtRisk);
}
function itcAvailDeadline(financialYear) {
  const startYear = Number(financialYear.slice(0, 4));
  const fy = startYear <= 2020 ? "2017-18 to 2020-21" : financialYear;
  if (fy === "2017-18 to 2020-21") {
    return {
      deadline: "2025-11-30",
      basis: "s.16(5) relief window \u2014 the FY 2017-18 to 2020-21 credit was allowed up to 30 Nov 2025"
    };
  }
  return {
    deadline: `${startYear + 1}-11-30`,
    basis: `s.16(4) \u2014 credit for FY ${financialYear} lapses after 30 Nov ${startYear + 1}, or the annual return date if earlier`
  };
}
function itcTimeBarred(invoiceDate, asOn) {
  const { deadline, basis } = itcAvailDeadline(financialYearOf(invoiceDate));
  return { barred: asOn > deadline, deadline, basis };
}

// src/munshi/gst/returns.ts
function placeOfSupply(supplierState, posState, taxable, ratePercent) {
  const tax = rate(taxable, ratePercent);
  if (posState === "96") {
    return {
      supplyType: "export",
      igst: 0,
      cgst: 0,
      sgst: 0,
      basis: "place of supply outside India \u2014 zero-rated under s.16 IGST; report as export of goods/services with shipping bill or LUT, not as a taxable supply"
    };
  }
  if (supplierState === posState) {
    const { cgst, sgst } = splitIntraState(tax);
    return {
      supplyType: "intra-state",
      igst: 0,
      cgst,
      sgst,
      basis: `supplier state ${STATE_CODES[supplierState] ?? supplierState} equals place of supply \u2014 intra-state: CGST + SGST in equal halves (s.8 CGST Act)`
    };
  }
  return {
    supplyType: "inter-state",
    igst: tax,
    cgst: 0,
    sgst: 0,
    basis: `supplier state ${STATE_CODES[supplierState] ?? supplierState} differs from place of supply ${STATE_CODES[posState] ?? posState} \u2014 inter-state: IGST (s.7 IGST Act)`
  };
}
var B2CL_THRESHOLD = 25e6;
function buildGstr1(invoices, supplierState) {
  const sections = /* @__PURE__ */ new Map();
  const rates = /* @__PURE__ */ new Map();
  const notes = [];
  let tTaxable = 0, tIgst = 0, tCgst = 0, tSgst = 0, tCess = 0;
  const bump = (table, label, inv, tax) => {
    const cur = sections.get(table) ?? { table, label, count: 0, taxable: 0, tax: 0 };
    cur.count += 1;
    cur.taxable += inv.taxableValue;
    cur.tax += tax;
    sections.set(table, cur);
  };
  for (const inv of invoices) {
    const tax = (inv.igst ?? 0) + (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.cess ?? 0);
    const isNote = inv.documentType === "credit-note" || inv.documentType === "debit-note";
    const registered = !!inv.gstin && inv.gstin !== "URP" && inv.gstin.length === 15;
    if (!registered) {
      const interState = inv.placeOfSupply !== void 0 && inv.placeOfSupply !== supplierState;
      const b2cl = interState && inv.taxableValue > B2CL_THRESHOLD;
      bump(
        b2cl ? "5A" : "7",
        b2cl ? "B2C Large (inter-state, above \u20B92.5 L)" : "B2C Small",
        inv,
        tax
      );
      if (interState && !b2cl) {
        notes.push(`Invoice ${inv.invoiceNumber}: inter-state B2C below \u20B92.5 L \u2014 consolidated in table 7, but the tax head is still IGST. Do not merge it into the intra-state lines.`);
      }
    } else if (isNote) {
      bump("9B", "Credit / debit notes (registered)", inv, tax);
    } else {
      bump("4A", "B2B supplies (registered)", inv, tax);
    }
    const ratePercent = inv.rate ?? (inv.taxableValue > 0 ? tax * 100 / inv.taxableValue : 0);
    const r = rates.get(Math.round(ratePercent)) ?? { taxable: 0, tax: 0 };
    r.taxable += inv.taxableValue;
    r.tax += tax;
    rates.set(Math.round(ratePercent), r);
    tTaxable += inv.taxableValue;
    tIgst += inv.igst ?? 0;
    tCgst += inv.cgst ?? 0;
    tSgst += inv.sgst ?? 0;
    tCess += inv.cess ?? 0;
  }
  const rateSummary = [...rates.entries()].map(([rateValue, v]) => ({ rate: rateValue, taxable: v.taxable, tax: v.tax })).sort((a, b) => a.rate - b.rate);
  return {
    period: "",
    sections: [...sections.values()],
    rateSummary,
    totals: { taxable: tTaxable, igst: tIgst, cgst: tCgst, sgst: tSgst, cess: tCess },
    notes: [...new Set(notes)],
    ruleset: RULESET
  };
}
function buildGstr3b(gstr1, itc) {
  const outwardTax = add(gstr1.totals.igst, gstr1.totals.cgst, gstr1.totals.sgst, gstr1.totals.cess);
  const netItc = itc.available - itc.reversed;
  const netCashPayable = Math.max(0, outwardTax - netItc);
  return {
    outwardTaxable: gstr1.totals.taxable,
    outwardTax,
    itcAvailable: itc.available,
    itcReversed: itc.reversed,
    netCashPayable,
    ruleset: RULESET
  };
}
function hardLockCrosswalk(gstr1, gstr3b) {
  const g1Tax = add(gstr1.totals.igst, gstr1.totals.cgst, gstr1.totals.sgst, gstr1.totals.cess);
  const findings = [];
  if (g1Tax !== gstr3b.outwardTax) {
    findings.push({
      table: "3.1(a)",
      what: "outward taxable supplies \u2014 tax",
      gstr1: g1Tax,
      gstr3b: gstr3b.outwardTax,
      delta: gstr3b.outwardTax - g1Tax,
      correctionPath: "Correct GSTR-1, or file GSTR-1A before the 3B. Table 3.1 is auto-populated and non-editable from the July 2025 period \u2014 it cannot be adjusted here."
    });
  }
  if (gstr1.totals.taxable !== gstr3b.outwardTaxable) {
    findings.push({
      table: "3.1(a)",
      what: "outward taxable supplies \u2014 value",
      gstr1: gstr1.totals.taxable,
      gstr3b: gstr3b.outwardTaxable,
      delta: gstr3b.outwardTaxable - gstr1.totals.taxable,
      correctionPath: "Same route as the tax difference: GSTR-1 or GSTR-1A."
    });
  }
  const netNegative = gstr3b.itcAvailable - gstr3b.itcReversed < 0;
  if (netNegative) {
    findings.push({
      table: "4",
      what: "ITC reversal exceeds credit available",
      gstr1: 0,
      gstr3b: gstr3b.itcReversed,
      delta: gstr3b.itcReversed,
      correctionPath: "Table 4(B) reversal cannot exceed 4(A) credit. Check whether a reversal belongs to an earlier period; unused reversal is a common double-count in the ledger."
    });
  }
  return {
    findings,
    consistent: findings.length === 0,
    note: `Hard-lock in force (${RULESET}): table 3.1 and 3.2 are auto-populated from GSTR-1 and are not editable. Table 3.2 (inter-state supplies to unregistered persons) became non-editable from the July 2025 period. Any correction therefore runs through GSTR-1 or GSTR-1A.`
  };
}
function roundReturnTotals(gstr3b) {
  return {
    ...gstr3b,
    outwardTaxable: roundToRupee(gstr3b.outwardTaxable),
    outwardTax: roundToRupee(gstr3b.outwardTax),
    itcAvailable: roundToRupee(gstr3b.itcAvailable),
    itcReversed: roundToRupee(gstr3b.itcReversed),
    netCashPayable: roundToRupee(gstr3b.netCashPayable)
  };
}

// src/munshi/gst/statutory.ts
var CURRENT_RATES = Object.freeze([0, 0.25, 3, 5, 18, 40]);
var LEGACY_RATES = Object.freeze([12, 28]);
function isLegacyRate(percent) {
  return LEGACY_RATES.includes(percent);
}
function isCurrentRate(percent) {
  return CURRENT_RATES.includes(percent);
}
var INDICATIVE = Object.freeze([
  { prefix: "2523", rate: 18, what: "cement" },
  { prefix: "2710", rate: 18, what: "petroleum products (rates vary by entry)" },
  { prefix: "3004", rate: 5, what: "medicaments \u2014 many entries nil-rated; verify per entry" },
  { prefix: "7108", rate: 3, what: "gold" },
  { prefix: "7102", rate: 0.25, what: "rough diamonds" },
  { prefix: "2402", rate: 40, what: "tobacco products" },
  { prefix: "2202", rate: 40, what: "aerated / caffeinated beverages" },
  { prefix: "8418", rate: 18, what: "refrigerators" },
  { prefix: "8415", rate: 18, what: "air conditioners" },
  { prefix: "8528", rate: 18, what: "televisions and monitors" },
  { prefix: "8703", rate: 18, what: "motor cars \u2014 40% applies above the large-car threshold" },
  { prefix: "8711", rate: 18, what: "motorcycles \u2014 40% above 350cc" },
  { prefix: "8708", rate: 18, what: "motor vehicle parts" },
  { prefix: "1006", rate: 5, what: "rice \u2014 many entries nil when unbranded" },
  { prefix: "0406", rate: 5, what: "cheese" },
  { prefix: "0405", rate: 5, what: "butter and ghee" },
  { prefix: "6109", rate: 5, what: "t-shirts and vests" },
  { prefix: "6103", rate: 5, what: "suits and trousers (18% above the \u20B92,500 price point)" },
  { prefix: "9954", rate: 18, what: "construction services" },
  { prefix: "9983", rate: 18, what: "professional and technical services (SAC 9983)" },
  { prefix: "9965", rate: 5, what: "goods transport agency services" },
  { prefix: "9992", rate: 5, what: "passenger transport" },
  { prefix: "9972", rate: 18, what: "real estate services" },
  { prefix: "9982", rate: 18, what: "legal and accounting services" }
]);
function rateForHsn(hsn) {
  const code = String(hsn ?? "").replace(/\D/g, "");
  if (code.length < 4) {
    return { rate: null, confidence: "unknown", basis: "HSN/SAC needs at least 4 digits to classify" };
  }
  const hit = INDICATIVE.find((r) => code.startsWith(r.prefix));
  if (hit) {
    return {
      rate: hit.rate,
      confidence: "indicative",
      basis: `indicative for ${hit.what} (${hit.prefix}*) under ${RULESET}; confirm against the CBIC rate notification before filing`
    };
  }
  return {
    rate: null,
    confidence: "unknown",
    basis: `no indicative entry for ${code} under ${RULESET} \u2014 classification is a declarant decision, do not infer it`
  };
}
function interestOnLateTax(netCashLiability, from, to, basis = "s.50(1)", dayBasis = 365) {
  const ratePercent = basis === "s.50(1)" ? 18 : 24;
  const days = Math.max(0, daysBetween(from, to));
  const interest2 = roundToRupee(paise(netCashLiability * ratePercent * days / (100 * dayBasis)));
  return {
    interest: interest2,
    days,
    ratePercent,
    basis: `${basis} \u2014 ${ratePercent}% p.a., simple, ${days} days on a ${dayBasis}-day year, net cash liability (Rule 88B), rounded to the nearest rupee`
  };
}
var LATE_FEE_CAP = Object.freeze({
  "up-to-1.5cr": 2e5,
  // ₹2,000
  "1.5-to-5cr": 5e5,
  // ₹5,000
  "above-5cr": 1e6
  // ₹10,000
});
function lateFee(kind, dueDate, filedOn, opts = {}) {
  const days = daysOverdue(dueDate, filedOn);
  const nil = opts.nil === true;
  const turnoverClass = opts.turnoverClass ?? "up-to-1.5cr";
  if (kind === "GSTR-9") {
    const perDay2 = 2e4;
    const cap2 = LATE_FEE_CAP[turnoverClass];
    const gross2 = perDay2 * days;
    return {
      fee: Math.min(gross2, cap2),
      days,
      perDay: perDay2,
      capped: gross2 > cap2,
      basis: `s.47 read with the annual-return notification \u2014 \u20B9200 per day capped at the ${(cap2 / 100).toLocaleString("en-IN")} ceiling for a ${turnoverClass} taxpayer`
    };
  }
  const perDay = nil ? 2e3 : 5e3;
  const cap = LATE_FEE_CAP[turnoverClass];
  const gross = perDay * days;
  return {
    fee: Math.min(gross, cap),
    days,
    perDay,
    capped: gross > cap,
    basis: `s.47 \u2014 \u20B9${perDay / 100}/day (${nil ? "nil return" : "CGST \u20B925 + SGST \u20B925"}), capped at \u20B9${(cap / 100).toLocaleString("en-IN")} for a ${turnoverClass} taxpayer`
  };
}
function eInvoiceStatus(annualAggregateTurnover) {
  const cr = annualAggregateTurnover / 1e9;
  if (cr >= 10) {
    return {
      mandated: true,
      thirtyDayLimit: true,
      reason: `AATO \u20B9${cr.toFixed(2)} Cr \u2014 e-invoicing mandated (since 1 Aug 2023) and the 30-day IRP reporting limit applies (since 1 Apr 2025, Rule 48(4)/48(5))`
    };
  }
  if (cr >= 5) {
    return {
      mandated: true,
      thirtyDayLimit: false,
      reason: `AATO \u20B9${cr.toFixed(2)} Cr \u2014 e-invoicing mandated, but the 30-day hard stop applies only at \u20B910 Cr and above. Report promptly anyway: a blocked IRN cascades into GSTR-1 and any refund built on the document`
    };
  }
  return {
    mandated: false,
    thirtyDayLimit: false,
    reason: `AATO \u20B9${cr.toFixed(2)} Cr \u2014 below the \u20B95 Cr e-invoicing mandate. Confirm against turnover in ANY year since 2017-18: crossing the line once keeps you in scope`
  };
}
function irnReportingDeadline(invoiceDate, annualAggregateTurnover) {
  const status = eInvoiceStatus(annualAggregateTurnover);
  if (!status.thirtyDayLimit) return "no statutory cut-off";
  const d = /* @__PURE__ */ new Date(`${invoiceDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
}
function checkIrnWindow(invoiceDate, annualAggregateTurnover, asOn) {
  const status = eInvoiceStatus(annualAggregateTurnover);
  if (!status.thirtyDayLimit) {
    return {
      status: "not-applicable",
      deadline: "no statutory cut-off",
      daysLeft: Infinity,
      finding: "30-day limit does not apply at this turnover"
    };
  }
  const deadline = irnReportingDeadline(invoiceDate, annualAggregateTurnover);
  const daysLeft = daysBetween(asOn, deadline);
  if (daysLeft < 0) {
    return {
      status: "blocked",
      deadline,
      daysLeft,
      finding: `IRN can no longer be generated for a document dated ${invoiceDate}. Without an IRN this is not a valid tax invoice and the recipient's ITC is at risk`
    };
  }
  return {
    status: daysLeft <= 7 ? "closing-soon" : "within-window",
    deadline,
    daysLeft,
    finding: daysLeft <= 7 ? `${daysLeft} day(s) left to report \u2014 the window closes irreversibly at 30 days` : `${daysLeft} days left to report`
  };
}
function checkIrnCancellationWindow(irnGeneratedAt, asOn) {
  const hours = (Date.parse(`${asOn}T23:59:59Z`) - Date.parse(`${irnGeneratedAt}T00:00:00Z`)) / 36e5;
  return {
    allowed: hours <= 24,
    basis: hours <= 24 ? "within the 24-hour cancellation window" : `${Math.floor(hours / 24)} day(s) later \u2014 the IRN can no longer be cancelled; issue a credit note instead`
  };
}
function ewayBillValidity(distanceKm, cargo = "normal") {
  const perDay = cargo === "normal" ? 200 : 20;
  const days = Math.max(1, Math.ceil(distanceKm / perDay));
  return { days, basis: `Rule 138(10) \u2014 ${perDay} km per day for ${cargo} cargo over ${distanceKm} km` };
}

// src/munshi/tdsStatute.ts
var TDS_TRANSITION_DATE = "2026-04-01";
var ACT_NAME = Object.freeze({
  "1961": "Income-tax Act, 1961",
  "2025": "Income-tax Act, 2025"
});
var MAPPINGS = Object.freeze({
  // ── salary ────────────────────────────────────────────────────────────────
  "192": { section: "392", tableRef: null, paymentCode: null },
  "192A": { section: "392(7)", tableRef: null, paymentCode: 1004 },
  // ── 393(1): residents, one table, eight categories ────────────────────────
  "193": { section: "393(1)", tableRef: "Sl. 5(i)", paymentCode: 1019 },
  "194": { section: "393(1)", tableRef: "Sl. 7", paymentCode: 1029 },
  "194A": {
    section: "393(1)",
    tableRef: "Sl. 5(ii).D(a) senior / 5(ii).D(b) other / 5(iii) non-bank",
    paymentCode: null,
    note: "the three 194A populations (senior \u20B91,00,000, other \u20B950,000, non-bank \u20B910,000) map to three separate table entries with codes 1020 / 1021 / 1022 \u2014 the entry follows the payer, not this table row"
  },
  "194C": {
    section: "393(1)",
    tableRef: "Sl. 6(i).D(a) individual/HUF \xB7 6(i).D(b) other",
    paymentCode: null,
    note: "codes 1023 (1%, individual/HUF payee) and 1024 (2%, any other payee) \u2014 the code follows the payee, so this row carries both references"
  },
  "194D": { section: "393(1)", tableRef: "Sl. 1(i)", paymentCode: 1005 },
  "194DA": { section: "393(1)", tableRef: "Sl. 8(i)", paymentCode: 1030 },
  "194H": { section: "393(1)", tableRef: "Sl. 1(ii)", paymentCode: 1006 },
  "194-I(a)": { section: "393(1)", tableRef: "Sl. 2(ii).D(a)", paymentCode: 1008 },
  "194-I(b)": { section: "393(1)", tableRef: "Sl. 2(ii).D(b)", paymentCode: 1009 },
  "194-IA": {
    section: "393(1)",
    tableRef: null,
    paymentCode: null,
    note: "no table item for the transfer-of-immovable-property deduction is corroborated in the sources this ruleset carries \u2014 do not quote one until the utility master confirms it"
  },
  "194-IB": {
    section: "393(1)",
    tableRef: "Sl. 2(i)",
    paymentCode: 1007,
    note: "the payment code for this entry is published as PROVISIONAL pending CBDT's final master; treat 1007 as unconfirmed"
  },
  "194-IC": { section: "393(1)", tableRef: "Sl. 3(ii)", paymentCode: 1011 },
  "194J(a)": { section: "393(1)", tableRef: "Sl. 6(iii).D(a)", paymentCode: 1026 },
  "194J(b)": { section: "393(1)", tableRef: "Sl. 6(iii).D(b)", paymentCode: 1027 },
  "194K": { section: "393(1)", tableRef: "Sl. 4(i)", paymentCode: 1013 },
  "194LA": { section: "393(1)", tableRef: "Sl. 3(iii)", paymentCode: 1012 },
  "194M": {
    section: "393(1)",
    tableRef: null,
    paymentCode: null,
    note: "not corroborated in the mappings this ruleset carries"
  },
  "194-O": { section: "393(1)", tableRef: "Sl. 8(v)", paymentCode: 1035 },
  "194Q": { section: "393(1)", tableRef: "Sl. 8(ii)", paymentCode: 1031 },
  "194R": {
    section: "393(1)",
    tableRef: "Sl. 8(iv)",
    paymentCode: null,
    note: "sources disagree on the sub-codes for cash (1033 per one, 1034 per another) and in-kind benefit \u2014 the table item is agreed, the code is not, so no code is asserted"
  },
  "194S": { section: "393(1)", tableRef: "Sl. 8(vi)", paymentCode: 1037 },
  // ── 393(3): payments to any person ────────────────────────────────────────
  "194B": { section: "393(3)", tableRef: "Sl. 1", paymentCode: 1058 },
  "194BA": { section: "393(3)", tableRef: "Sl. 2", paymentCode: 1060 },
  "194G": { section: "393(3)", tableRef: "Sl. 4", paymentCode: 1063 },
  "194N": {
    section: "393(3)",
    tableRef: "Sl. 5",
    paymentCode: null,
    note: "the code splits by the filer's own status (1064 / 1065) and by whether the payee has filed returns \u2014 the table item is agreed, the code is not fixed"
  },
  "194T": { section: "393(3)", tableRef: "Sl. 7", paymentCode: 1067 },
  // ── 393(2): non-residents ─────────────────────────────────────────────────
  "195": { section: "393(2)", tableRef: "Sl. 17", paymentCode: 1057 }
});
var TCS_MAPPING = Object.freeze({
  "206C(1)": { section: "394", tableRef: null, paymentCode: null },
  "206C(1F)": { section: "394", tableRef: null, paymentCode: null },
  "206C(1G)": { section: "394", tableRef: null, paymentCode: null },
  "206C(1H)": {
    section: "394",
    tableRef: null,
    paymentCode: null,
    note: "206C(1H) was repealed from 1 April 2025 and is carried in this pack as a repeal notice; it has no successor entry to quote"
  }
});
function statuteForEvent(earlierOfCreditOrPayment) {
  const iso = earlierOfCreditOrPayment.trim();
  const newAct = iso >= TDS_TRANSITION_DATE;
  return newAct ? {
    statute: "2025",
    act: ACT_NAME["2025"],
    basis: `${iso} is on or after ${TDS_TRANSITION_DATE} \u2014 the earlier of credit or payment falls under the ${ACT_NAME["2025"]}, where resident TDS is s.393, salary is s.392 and TCS is s.394`
  } : {
    statute: "1961",
    act: ACT_NAME["1961"],
    basis: `${iso} is before ${TDS_TRANSITION_DATE} \u2014 the earlier of credit or payment falls under the ${ACT_NAME["1961"]}, so the 194-series reference applies even if the payment or the challan lands after the changeover`
  };
}
function statuteReference(section2, earlierOfCreditOrPayment, kind = "tds") {
  const routing = statuteForEvent(earlierOfCreditOrPayment);
  const mapping = (kind === "tcs" ? TCS_MAPPING : MAPPINGS)[section2];
  if (routing.statute === "1961") {
    const forward = mapping ? `under the 2025 Act this becomes s.${mapping.section}` + (mapping.tableRef ? `, Table ${mapping.tableRef}` : "") + (mapping.paymentCode ? `, payment code ${mapping.paymentCode}` : "") : "this ruleset carries no 2025-Act mapping for this section";
    return {
      statute: "1961",
      act: routing.act,
      section: section2,
      tableRef: null,
      paymentCode: null,
      crossReference: `${section2} \u2014 ${forward}`,
      confidence: mapping ? "asserted" : "unmapped",
      basis: `s.${section2} of the ${ACT_NAME["1961"]} \u2014 ${routing.basis}`
    };
  }
  if (!mapping) {
    return {
      statute: "2025",
      act: routing.act,
      section: section2,
      tableRef: null,
      paymentCode: null,
      crossReference: `former s.${section2} of the ${ACT_NAME["1961"]}`,
      confidence: "unmapped",
      basis: `${routing.basis}. WARNING: this ruleset carries no ${ACT_NAME["2025"]} reference for s.${section2} \u2014 the rate is computed, the section reference to quote is NOT asserted here. Confirm the table item against the department's validation master before filing.`
    };
  }
  const hasReference = mapping.tableRef !== null || mapping.paymentCode !== null;
  const confidence = !hasReference ? "unmapped" : mapping.note ? "reported" : "asserted";
  return {
    statute: "2025",
    act: routing.act,
    section: mapping.section,
    tableRef: mapping.tableRef,
    paymentCode: mapping.paymentCode,
    crossReference: `corresponds to former s.${section2} of the ${ACT_NAME["1961"]}`,
    confidence,
    basis: `s.${mapping.section} of the ${ACT_NAME["2025"]}` + (mapping.tableRef ? `, Table ${mapping.tableRef}` : "") + (mapping.paymentCode ? `, payment code ${mapping.paymentCode}` : "") + ` \u2014 ${routing.basis}` + (mapping.note ? `. ${mapping.note}` : "") + (confidence === "unmapped" ? ". The section is asserted; the TABLE ITEM is not \u2014 confirm it against the department's validation master before filing" : "")
  };
}
function explainStatuteReference(ref) {
  const bits = [`${ref.act} \xB7 s.${ref.section}`];
  if (ref.tableRef) bits.push(`Table ${ref.tableRef}`);
  if (ref.paymentCode !== null) bits.push(`code ${ref.paymentCode}`);
  bits.push(`(${ref.confidence})`);
  return bits.join(" \xB7 ");
}
function returnFormFor(section2, earlierOfCreditOrPayment) {
  const routing = statuteForEvent(earlierOfCreditOrPayment);
  if (routing.statute === "1961") {
    const salary = section2 === "192";
    return {
      form: salary ? "24Q" : "26Q",
      certificate: salary ? "Form 16" : "Form 16A",
      confidence: "asserted",
      basis: `quarterly statements under the ${ACT_NAME["1961"]}: Form 24Q (salary) / 26Q (non-salary), certificates Form 16 / 16A`
    };
  }
  return {
    form: section2 === "192" ? "not asserted" : "140",
    certificate: section2 === "192" ? "not asserted" : "131",
    confidence: "reported",
    basis: `quarterly statements move to the 2025 Act's own numbering \u2014 Form 140 for non-salary TDS and Form 131 for the certificate are the forms reported in practice, but this ruleset does NOT assert them: sources disagree (some still cite 26Q), and the department's utility master is the authority. The section reference above is the part that is asserted.`
  };
}

// src/munshi/tds.ts
var L = 1e7;
var TDS_TABLE = Object.freeze([
  {
    section: "192",
    what: "salary",
    rate: null,
    threshold: 0,
    thresholdBasis: "annual",
    resident: true,
    form: "24Q",
    basis: "slab rates on estimated income; no single rate"
  },
  {
    section: "192A",
    what: "premature EPF withdrawal",
    rate: 10,
    threshold: 5e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "Finance Act 2025"
  },
  {
    section: "193",
    what: "interest on securities",
    rate: 10,
    threshold: 1e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "Finance Act 2025"
  },
  {
    section: "194",
    what: "dividend",
    rate: 10,
    threshold: 1e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "threshold raised to \u20B910,000"
  },
  {
    section: "194A",
    what: "interest other than securities",
    rate: 10,
    threshold: 5e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "\u20B950,000 general / \u20B91,00,000 senior citizen \u2014 raise threshold to 100000 for senior payees"
  },
  {
    section: "194B",
    what: "lottery or game-show winnings",
    rate: 30,
    threshold: 1e4 * 100,
    thresholdBasis: "per-transaction",
    resident: true,
    form: "26Q",
    basis: "Finance Act 2025"
  },
  {
    section: "194BA",
    what: "online gaming winnings",
    rate: 30,
    threshold: 0,
    thresholdBasis: "per-transaction",
    resident: true,
    form: "26Q",
    basis: "on net winnings, no threshold"
  },
  {
    section: "194C",
    what: "payment to contractors",
    rate: null,
    byPayee: { individual: 1, huf: 1, other: 2 },
    threshold: 3e4 * 100,
    thresholdBasis: "per-transaction",
    resident: true,
    form: "26Q",
    basis: "\u20B930,000 single / \u20B91,00,000 annual (\u20B92,00,000 where the payer is an individual or HUF)"
  },
  {
    section: "194D",
    what: "insurance commission",
    rate: 2,
    threshold: 2e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "rate reduced to 2% from 1 Apr 2025"
  },
  {
    section: "194DA",
    what: "life-insurance policy receipts",
    rate: 2,
    threshold: L,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "on the income component"
  },
  {
    section: "194G",
    what: "lottery ticket commission",
    rate: 2,
    threshold: 2e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "Finance Act 2025"
  },
  {
    section: "194H",
    what: "commission or brokerage",
    rate: 2,
    threshold: 2e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "rate reduced from 5% to 2%"
  },
  {
    section: "194-I(a)",
    what: "rent \u2014 plant and machinery",
    rate: 2,
    threshold: 5e4 * 100,
    thresholdBasis: "per-transaction",
    resident: true,
    form: "26Q",
    basis: "\u20B950,000 per month (Finance Act 2025)"
  },
  {
    section: "194-I(b)",
    what: "rent \u2014 land, building, furniture",
    rate: 10,
    threshold: 5e4 * 100,
    thresholdBasis: "per-transaction",
    resident: true,
    form: "26Q",
    basis: "\u20B950,000 per month"
  },
  {
    section: "194-IA",
    what: "transfer of immovable property",
    rate: 1,
    threshold: 50 * L,
    thresholdBasis: "per-transaction",
    resident: true,
    form: "26QB",
    basis: "Form 26QB is filed per transaction"
  },
  {
    section: "194-IB",
    what: "rent by individual/HUF not liable to audit",
    rate: 2,
    threshold: 5e4 * 100,
    thresholdBasis: "per-transaction",
    resident: true,
    form: "26QB",
    basis: "\u20B950,000 per month or part of it"
  },
  {
    section: "194-IC",
    what: "joint development agreement payments",
    rate: 10,
    threshold: 0,
    thresholdBasis: "per-transaction",
    resident: true,
    form: "26Q",
    basis: "no threshold"
  },
  {
    section: "194J(a)",
    what: "technical services, call centre, certain royalties",
    rate: 2,
    threshold: 5e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "threshold raised from \u20B930,000 to \u20B950,000 per category"
  },
  {
    section: "194J(b)",
    what: "professional fees, director's remuneration",
    rate: 10,
    threshold: 5e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "threshold applies per category, not in aggregate with 194J(a)"
  },
  {
    section: "194K",
    what: "income from mutual-fund units",
    rate: 10,
    threshold: 1e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "Finance Act 2025"
  },
  {
    section: "194LA",
    what: "compulsory acquisition of immovable property",
    rate: 10,
    threshold: 5 * L,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "threshold raised to \u20B95,00,000"
  },
  {
    section: "194M",
    what: "payments by individual/HUF to contractors and professionals",
    rate: 2,
    threshold: 50 * L,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "\u20B950,00,000 annual"
  },
  {
    section: "194N",
    what: "cash withdrawals above the limit",
    rate: 2,
    threshold: 1e7 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "\u20B91 crore (\u20B93 crore for co-operative societies)"
  },
  {
    section: "194-O",
    what: "e-commerce participant payments",
    rate: 0.1,
    threshold: 5 * L,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "on gross amount of sales"
  },
  {
    section: "194Q",
    what: "purchase of goods",
    rate: 0.1,
    threshold: 50 * L,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "0.1% on purchases above \u20B950 lakh from one seller; buyer's turnover must exceed \u20B910 crore"
  },
  {
    section: "194R",
    what: "benefit or perquisite in business",
    rate: 10,
    threshold: 2e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "value of the benefit"
  },
  {
    section: "194S",
    what: "transfer of virtual digital assets",
    rate: 1,
    threshold: 1e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "\u20B950,000 for specified persons (threshold must be raised for those payees)"
  },
  {
    section: "194T",
    what: "payments by a firm to its partners",
    rate: 10,
    threshold: 2e4 * 100,
    thresholdBasis: "annual",
    resident: true,
    form: "26Q",
    basis: "NEW from 1 April 2025 \u2014 salary, remuneration, commission, bonus or interest to a partner"
  },
  {
    section: "195",
    what: "payments to non-residents",
    rate: null,
    threshold: 0,
    thresholdBasis: "per-transaction",
    resident: false,
    form: "27Q",
    basis: "rate depends on the nature of income and the applicable DTAA \u2014 never infer this one; a wrong rate here creates a demand on the deductor"
  }
]);
function tdsSection(section2) {
  return TDS_TABLE.find((s) => s.section.toUpperCase() === section2.toUpperCase());
}
function computeTds(input) {
  const warnings = [];
  const eventDate = input.creditOrPaymentOn?.trim();
  const ref = eventDate ? statuteReference(input.section, eventDate) : null;
  const formInfo = eventDate ? returnFormFor(input.section, eventDate) : null;
  if (!eventDate) {
    warnings.push("the earlier of the date of credit and the date of payment was not supplied \u2014 the RATE is computed, but which Act governs and which section reference to quote are NOT: from 1 April 2026 the Income-tax Act, 2025 governs and the 194-series label must not be used");
  }
  if (ref?.confidence === "unmapped") warnings.push(ref.basis);
  const s = tdsSection(input.section);
  if (!s) {
    return {
      applicable: false,
      rate: 0,
      tds: 0,
      section: input.section,
      form: null,
      formToFile: formInfo?.form ?? null,
      statute: ref?.statute ?? null,
      statuteReference: ref,
      formBasis: formInfo?.basis ?? "statute not determined without a credit/payment date",
      basis: `section ${input.section} is not in the ${RULESET} table \u2014 do not deduct on a guess`,
      warnings: ["unknown section", ...warnings]
    };
  }
  const routing = {
    formToFile: formInfo?.form ?? s.form,
    statute: ref?.statute ?? null,
    statuteReference: ref,
    formBasis: formInfo?.basis ?? "statute not determined without a credit/payment date"
  };
  const previously = input.previouslyPaid ?? 0;
  const cumulative2 = previously + input.amount;
  const threshold = s.section === "194A" && input.isSeniorCitizen ? L : s.threshold;
  if (s.section === "194A" && input.isSeniorCitizen) {
    warnings.push("senior citizen payee \u2014 the \u20B91,00,000 threshold applies to 194A");
  }
  let rate2 = s.rate ?? 0;
  if (s.byPayee) {
    const key = input.payeeType ?? "other";
    const payeeKey = key === "individual" || key === "huf" ? key : "other";
    rate2 = s.byPayee[payeeKey] ?? s.byPayee["other"] ?? 0;
  }
  if (s.rate === null && !s.byPayee) {
    return {
      applicable: true,
      rate: 0,
      tds: 0,
      section: s.section,
      form: s.form,
      ...routing,
      basis: `${s.section}: ${s.basis} \u2014 the rate must be determined from the payee's status, not from a table`,
      warnings: ["rate not auto-determinable"]
    };
  }
  const crossed = s.thresholdBasis === "annual" ? cumulative2 > threshold : input.amount > threshold;
  if (!crossed) {
    return {
      applicable: false,
      rate: rate2,
      tds: 0,
      section: s.section,
      form: s.form,
      ...routing,
      basis: `threshold not crossed (${s.thresholdBasis}); ${s.basis}`,
      warnings
    };
  }
  let amountToDeduct = input.amount;
  if (s.thresholdBasis === "annual" && previously <= threshold) {
    amountToDeduct = cumulative2 - threshold;
    warnings.push(`deduction applies from the point the ${s.thresholdBasis} threshold was crossed, so only the excess above the threshold is deducted on this payment`);
  }
  if (input.panAvailable === false) {
    const higher = Math.max(rate2, 20);
    warnings.push(`s.206AA \u2014 no PAN: rate is the higher of the prescribed rate (${rate2}%) or 20%, so ${higher}% applies. Sections 206AB/206CCA were omitted from 1 April 2025 and are NOT the basis here`);
    rate2 = higher;
    amountToDeduct = input.amount;
  }
  const tds = roundToRupee(rate(amountToDeduct, rate2));
  return {
    applicable: true,
    rate: rate2,
    tds,
    section: s.section,
    form: s.form,
    ...routing,
    basis: `s.${s.section} at ${rate2}% on ${amountToDeduct} paise \u2014 ${s.basis}` + (ref ? `. Reference to quote \u2014 ${ref.basis}` : ""),
    warnings
  };
}
var TCS_TABLE = Object.freeze([
  {
    section: "206C(1)",
    what: "alcohol, timber, scrap, minerals",
    rate: 1,
    threshold: 0,
    basis: "at the point of sale"
  },
  {
    section: "206C(1F)",
    what: "sale of motor vehicle above \u20B910 lakh",
    rate: 1,
    threshold: 1e6 * 100,
    basis: "on the sale value above the threshold"
  },
  {
    section: "206C(1G)",
    what: "LRS remittance / overseas tour programme",
    rate: 5,
    threshold: 7 * L,
    basis: "5% above \u20B97 lakh per year under LRS; 20% for non-PAN"
  },
  {
    section: "206C(1H)",
    what: "sale of goods",
    rate: 0,
    threshold: 0,
    basis: "REPEALED from 1 April 2025 \u2014 any collector still running this is over-collecting and must refund with interest"
  }
]);
function tcsSection(section2) {
  return TCS_TABLE.find((s) => s.section.toUpperCase() === section2.toUpperCase());
}
function reconcileTds(books2, deposited, reported26as) {
  const head = (e) => `${e.deductee.toUpperCase()}|${e.section}|${e.quarter}`;
  const sum = (rows) => rows.reduce((a, r) => a + r.amount, 0);
  const dep = /* @__PURE__ */ new Map();
  for (const d of deposited) dep.set(head(d), (dep.get(head(d)) ?? 0) + d.amount);
  const rep = /* @__PURE__ */ new Map();
  for (const r of reported26as) rep.set(head(r), (rep.get(head(r)) ?? 0) + r.amount);
  const findings = [];
  for (const b of books2) {
    const k = head(b);
    const depositedAmt = dep.get(k) ?? 0;
    if (depositedAmt < b.amount) {
      findings.push({
        kind: "deducted-not-deposited",
        deductee: b.deductee,
        amount: b.amount - depositedAmt,
        detail: `deducted but not fully deposited for ${b.quarter} \u2014 interest under s.201(1A) runs at 1% per month for non-deposit and 1.5% for late deposit, and the expense is disallowed`
      });
    }
    const reportedAmt = rep.get(k) ?? 0;
    if (reportedAmt < b.amount) {
      findings.push({
        kind: "deposited-not-reported",
        deductee: b.deductee,
        amount: b.amount - reportedAmt,
        detail: `deposited but not reported in 26Q/26AS for ${b.quarter} \u2014 the deductee cannot claim credit and will raise it with you; correct the return`
      });
    }
  }
  const bookKeys = new Set(books2.map(head));
  for (const r of reported26as) {
    if (!bookKeys.has(head(r))) {
      findings.push({
        kind: "reported-not-in-books",
        deductee: r.deductee,
        amount: r.amount,
        detail: `appears in 26AS for ${r.quarter} with no corresponding entry in books \u2014 either a mis-tagged deduction or a vendor you have not recorded`
      });
    }
  }
  return { findings, totalDeducted: sum(books2), totalDeposited: sum(deposited), totalReported: sum(reported26as) };
}

// src/munshi/msme.ts
function classifyEnterprise(sector, investmentRupees, turnoverRupees) {
  const Cr = 1e7;
  if (sector === "manufacturing") {
    if (investmentRupees <= Cr && turnoverRupees <= 5 * Cr) return "micro";
    if (investmentRupees <= 10 * Cr && turnoverRupees <= 50 * Cr) return "small";
    if (investmentRupees <= 50 * Cr && turnoverRupees <= 250 * Cr) return "medium";
    return "not-msme";
  }
  if (investmentRupees <= 2 * Cr && turnoverRupees <= 5 * Cr) return "micro";
  if (investmentRupees <= 10 * Cr && turnoverRupees <= 50 * Cr) return "small";
  if (investmentRupees <= 20 * Cr && turnoverRupees <= 250 * Cr) return "medium";
  return "not-msme";
}
function paymentDeadline(invoiceDate, enterprise, opts = {}) {
  const acceptedOn = opts.acceptedOn ?? invoiceDate;
  const daysAllowed = opts.writtenAgreement === false ? 15 : 45;
  const d = /* @__PURE__ */ new Date(`${acceptedOn}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysAllowed);
  const covered = enterprise === "micro" || enterprise === "small";
  return {
    dueBy: d.toISOString().slice(0, 10),
    daysAllowed,
    covered,
    basis: covered ? `s.15 MSMED Act \u2014 ${daysAllowed} days from acceptance (${acceptedOn}), disallowance risk under s.43B(h)` + (opts.acceptedOn ? "" : " \u2014 acceptance date defaulted to the invoice date; confirm it") : `s.43B(h) applies only to MICRO and SMALL enterprises \u2014 a ${enterprise} supplier is out of scope, so lateness here is commercial, not a disallowance`
  };
}
function assessPayables(items, asOn) {
  const rows = [];
  let totalOutstanding = 0, totalExposure = 0, msme1Reportable = 0, covered = 0, notCovered = 0;
  for (const it of items) {
    const clock = paymentDeadline(it.invoiceDate, it.enterprise, {
      acceptedOn: it.acceptedOn,
      writtenAgreement: it.writtenAgreement
    });
    const settled = it.paidOn !== void 0;
    const overdue = settled ? Math.max(0, daysBetween(clock.dueBy, it.paidOn)) : Math.max(0, daysBetween(clock.dueBy, asOn));
    const outstanding = settled ? 0 : it.amount;
    const exposure = clock.covered && !settled && overdue > 0 ? it.amount : 0;
    const msme12 = clock.covered && !settled && overdue > 0;
    if (clock.covered) covered++;
    else notCovered++;
    totalOutstanding += outstanding;
    totalExposure += exposure;
    if (msme12) msme1Reportable += outstanding;
    rows.push({
      vendor: it.vendor,
      invoiceNumber: it.invoiceNumber,
      dueBy: clock.dueBy,
      daysOverdue: overdue,
      amount: outstanding,
      disallowanceExposure: exposure,
      msme1Reportable: msme12,
      finding: settled ? overdue > 0 ? `paid ${overdue} day(s) after the s.15 deadline \u2014 the disallowance was avoided by payment, but interest may still be owed to the supplier under s.16 MSMED` : "paid within the s.15 clock" : exposure > 0 ? `${overdue} day(s) past the s.15 deadline with the bill still open \u2014 s.43B(h) disallowance of the full amount if the year closes in this state, and MSME-1 reporting is triggered` : `open, ${clock.daysAllowed - daysBetween(it.invoiceDate, asOn)} day(s) of the clock remaining`
    });
  }
  return {
    rows: rows.sort((a, b) => b.daysOverdue - a.daysOverdue),
    totalOutstanding,
    totalExposure,
    msme1Reportable,
    covered,
    notCovered
  };
}
function msme1DueDates(financialYear) {
  const y = Number(financialYear.slice(0, 4));
  return [
    { half: `Apr\u2013Sep ${y}`, due: `${y}-10-31` },
    { half: `Oct ${y}\u2013Mar ${y + 1}`, due: `${y + 1}-04-30` }
  ];
}

// src/munshi/agents.ts
var A = (a) => a;
var AGENTS = Object.freeze([
  // ── GST · outward ───────────────────────────────────────────────────────────
  A({
    id: "gst.gstr1-preparer",
    name: "GSTR-1 Preparer",
    domain: "gst-output",
    status: "engine",
    purpose: "Assemble a section-wise GSTR-1 draft from the sales register, including B2CL split and rate-wise summary.",
    engine: "buildGstr1",
    inputs: "sales register rows (GSTIN, invoice no, date, taxable, tax, POS, rate)",
    output: "GSTR-1 sections 4A/5A/7/9B with a rate-wise summary and data-quality notes",
    requiresApproval: true,
    receipt: "GSTR-1 draft + input hash, approved before filing"
  }),
  A({
    id: "gst.gstr3b-preparer",
    name: "GSTR-3B Preparer",
    domain: "gst-output",
    status: "engine",
    purpose: "Build the 3B position from GSTR-1 totals and the ITC reconciliation, with reversals kept separate from availment.",
    engine: "buildGstr3b",
    inputs: "GSTR-1 draft, ITC available, ITC reversed",
    output: "3B position: outward tax, ITC availed, ITC reversed, net cash payable",
    requiresApproval: true,
    receipt: "3B position + the ITC evidence it was built from"
  }),
  A({
    id: "gst.hardlock-crosswalk",
    name: "Hard-lock Crosswalk",
    domain: "gst-output",
    status: "engine",
    purpose: "Compare what GSTR-1 reports with what GSTR-3B says and name the only legal correction path for each gap.",
    engine: "hardLockCrosswalk",
    inputs: "GSTR-1 draft, GSTR-3B draft",
    output: "table-by-table findings with the correction route (GSTR-1 or GSTR-1A \u2014 never an edit in 3B)",
    requiresApproval: false,
    receipt: "crosswalk result against a named ruleset"
  }),
  A({
    id: "gst.pos-analyser",
    name: "Place of Supply Analyser",
    domain: "gst-output",
    status: "engine",
    purpose: "Decide IGST versus CGST+SGST from the supplier state and place of supply, and flag exports.",
    engine: "placeOfSupply",
    inputs: "supplier state code, place of supply, taxable value, rate",
    output: "tax head with the section basis, and the zero-rated route for exports",
    requiresApproval: false,
    receipt: "tax-head determination, per invoice"
  }),
  A({
    id: "gst.rate-migration-audit",
    name: "Rate Migration Audit",
    domain: "gst-output",
    status: "engine",
    purpose: "Find invoices still charging the abolished 12% or 28% rates after 22 September 2025.",
    engine: "isLegacyRate + rateForHsn",
    inputs: "invoice lines with HSN/SAC and rate",
    output: "legacy-rate findings with the indicative current rate and a classification caveat",
    requiresApproval: false,
    receipt: "audit of rates against the live ruleset"
  }),
  A({
    id: "gst.credit-note-agent",
    name: "Credit / Debit Note Agent",
    domain: "gst-output",
    status: "workflow",
    purpose: "Track notes as their own population, including the 24-hour IRN cancellation window and the effect on the recipient's credit.",
    engine: "checkIrnCancellationWindow",
    inputs: "note register, IRN timestamps",
    output: "note-by-note status and the filing treatment, with cancellations flagged as no longer possible",
    requiresApproval: true,
    receipt: "note population with cancellation windows evaluated"
  }),
  A({
    id: "gst.export-refund-watch",
    name: "Export Refund Watch",
    domain: "gst-output",
    status: "workflow",
    purpose: "Track zero-rated supplies, LUT validity and RFD-01 refund claims built on shipping bills and IRNs.",
    engine: "placeOfSupply (export branch)",
    inputs: "shipping bills, LUT, e-BRC, RFD-01 acknowledgements",
    output: "refund pipeline with the documents each claim is still missing",
    requiresApproval: true,
    receipt: "refund status against the underlying document set"
  }),
  // ── GST · input tax credit ──────────────────────────────────────────────────
  A({
    id: "gst.itc-2b-recon",
    name: "GSTR-2B Reconciliation",
    domain: "gst-itc",
    status: "engine",
    purpose: "Match the purchase register against GSTR-2B in passes, classify every difference and quantify the ITC at risk.",
    engine: "reconcile",
    inputs: "purchase register, GSTR-2B extract (or IMS feed)",
    output: "match results by outcome, ITC at risk, ITC unclaimed, prioritised findings",
    requiresApproval: false,
    receipt: "reconciliation over both populations, hashed"
  }),
  A({
    id: "gst.itc-2a-legacy",
    name: "GSTR-2A Legacy Reconciliation",
    domain: "gst-itc",
    status: "engine",
    purpose: "Reconcile older periods where the counterparty return was GSTR-2A, with its different matching behaviour.",
    engine: "reconcile",
    inputs: "purchase register, GSTR-2A extract",
    output: "the same classification, annotated for the pre-2B regime",
    requiresApproval: false,
    receipt: "legacy-period reconciliation"
  }),
  A({
    id: "gst.ims-actioning",
    name: "IMS Actioning",
    domain: "gst-itc",
    status: "workflow",
    purpose: "Decide accept / reject / pending for every record in the Invoice Management System, because the decision drives the recipient's own 2B.",
    engine: "reconcile (to find the records needing a decision)",
    inputs: "IMS feed, purchase register",
    output: "an actioning list with the reason for each decision, and the ones a human must judge",
    requiresApproval: true,
    receipt: "IMS decisions taken, with the basis for each"
  }),
  A({
    id: "gst.blocked-credit-audit",
    name: "Blocked Credit Audit",
    domain: "gst-itc",
    status: "workflow",
    purpose: "Screen the credit register against the s.17(5) blocked list \u2014 motor vehicles, food, memberships, personal use.",
    engine: "rule table + reconcile (to size the population)",
    inputs: "credit register with expense heads",
    output: "blocked-credit findings with the section cited, and the reversal amount",
    requiresApproval: true,
    receipt: "blocked-credit screen over a named population"
  }),
  A({
    id: "gst.itc-timebar-watch",
    name: "ITC Time-bar Watch",
    domain: "gst-itc",
    status: "engine",
    purpose: "Count down to the s.16(4) deadline \u2014 credit unclaimed after 30 November of the following year is a write-off.",
    engine: "itcTimeBarred",
    inputs: "open credit items with invoice dates",
    output: "a countdown with the lapse date and the exposure, per financial year",
    requiresApproval: false,
    receipt: "time-bar assessment at a named date"
  }),
  A({
    id: "gst.rcm-controller",
    name: "Reverse Charge Controller",
    domain: "gst-itc",
    status: "engine",
    purpose: "Pair the self-assessed RCM liability with the credit on it, in the same period, and keep RCM rows out of 2B matching.",
    engine: "reconcile (RCM branch) + buildGstr3b",
    inputs: "inward supplies flagged RCM, tax paid",
    output: "RCM liability and matching credit, with any unpaired amount called out",
    requiresApproval: true,
    receipt: "RCM liability paired with its credit in one period"
  }),
  A({
    id: "gst.isd-allocator",
    name: "ISD Credit Allocator",
    domain: "gst-itc",
    status: "workflow",
    purpose: "Distribute common input services credit across GSTINs on a defensible turnover-based formula.",
    engine: "money (exact allocation) + returns (per-GSTIN totals)",
    inputs: "common invoices, turnover by GSTIN",
    output: "ISD-1 allocation with the formula, the rounding and the residual treatment",
    requiresApproval: true,
    receipt: "allocation schedule that sums exactly to the credit"
  }),
  A({
    id: "gst.drc03-drafter",
    name: "DRC-03 Drafter",
    domain: "gst-itc",
    status: "engine",
    purpose: "Compute tax, interest and penalty for a voluntary payment before a notice arrives.",
    engine: "interestOnLateTax + lateFee",
    inputs: "period, unpaid tax, payment date",
    output: "the three components with their bases, ready for a human to pay",
    requiresApproval: true,
    receipt: "voluntary payment computation, per component"
  }),
  // ── GST · compliance clocks and returns ─────────────────────────────────────
  A({
    id: "gst.einvoice-30day",
    name: "E-invoice 30-day Window",
    domain: "gst-compliance",
    status: "engine",
    purpose: "Watch the 30-day IRP reporting limit above a \u20B910 crore AATO and warn before the IRN becomes impossible.",
    engine: "checkIrnWindow",
    inputs: "invoice dates, aggregate turnover, as-on date",
    output: "per-document window status, with a 7-day early warning band",
    requiresApproval: false,
    receipt: "window assessment per document"
  }),
  A({
    id: "gst.irn-validator",
    name: "IRN Pre-flight Validator",
    domain: "gst-compliance",
    status: "workflow",
    purpose: "Validate a document against the IRP's mandatory-field rules before the call, so a rejection does not cost a day.",
    engine: "eInvoiceStatus + validateGstin",
    inputs: "invoice payload",
    output: "field-level failures, with the ones that block an IRN separated from the ones that warn",
    requiresApproval: false,
    receipt: "pre-flight result before submission"
  }),
  A({
    id: "gst.eway-validity",
    name: "E-way Bill Validity",
    domain: "gst-compliance",
    status: "engine",
    purpose: "Compute validity from distance and cargo type, and flag consignments travelling on expired documents.",
    engine: "ewayBillValidity",
    inputs: "distance, cargo type, generation timestamp, movement status",
    output: "validity in days with the rule cited, and expired-consignment findings",
    requiresApproval: false,
    receipt: "validity computation with the rule basis"
  }),
  A({
    id: "gst.latefee-interest",
    name: "Late Fee & Interest",
    domain: "gst-compliance",
    status: "engine",
    purpose: "Compute s.47 late fees with the turnover cap applied, and s.50 interest on net cash liability as Rule 88B requires.",
    engine: "lateFee + interestOnLateTax",
    inputs: "return kind, due date, filing date, turnover class, unpaid tax",
    output: "fee and interest with days, rate, cap and the basis string",
    requiresApproval: false,
    receipt: "statutory computation of fee and interest"
  }),
  A({
    id: "gst.deadline-radar",
    name: "Deadline Radar",
    domain: "gst-compliance",
    status: "engine",
    purpose: "One calendar across monthly, QRMP, IFF, annual and composition obligations for every GSTIN in the group.",
    engine: "dueDates + periodsOf",
    inputs: "GSTINs, scheme, category, as-on date",
    output: "a dated obligation list with days remaining",
    requiresApproval: false,
    receipt: "obligation calendar at a named date"
  }),
  A({
    id: "gst.gstr9-annual",
    name: "Annual Return Reconciler",
    domain: "gst-compliance",
    status: "workflow",
    purpose: "Reconcile a full year: books versus GSTR-1 versus GSTR-3B versus 2B, and prepare GSTR-9 / 9C positions.",
    engine: "reconcile + buildGstr1 + hardLockCrosswalk (annualised)",
    inputs: "twelve periods of books, returns and 2B data",
    output: "annual reconciliation with the differences classified and the 9C impact",
    requiresApproval: true,
    receipt: "annual reconciliation across four populations"
  }),
  A({
    id: "gst.asmt10-responder",
    name: "ASMT-10 Responder",
    domain: "gst-compliance",
    status: "workflow",
    purpose: "Read a scrutiny notice, locate each disputed figure in the records, and draft a point-by-point reply with annexures.",
    engine: "reconcile (to reproduce the disputed figures)",
    inputs: "ASMT-10, the periods it refers to, source records",
    output: "a reply draft with each paragraph tied to a recomputation and its evidence",
    requiresApproval: true,
    receipt: "notice response with an evidence link per allegation"
  }),
  A({
    id: "gst.notice-tracker",
    name: "Notice Tracker",
    domain: "gst-compliance",
    status: "workflow",
    purpose: "Track notices, show-cause notices and orders with their reply deadlines and escalation state.",
    engine: "period (deadline arithmetic)",
    inputs: "notice register",
    output: "an ageing list with days to reply and the owner named",
    requiresApproval: false,
    receipt: "notice register state at a named date"
  }),
  // ── TDS / TCS ───────────────────────────────────────────────────────────────
  A({
    id: "tds.deductor",
    name: "TDS Determination",
    domain: "tds",
    status: "engine",
    purpose: "Determine section, rate, threshold crossing and the deduction on the cumulative position \u2014 not on the invoice alone.",
    engine: "computeTds",
    inputs: "payment amount, section, prior payments, payee type, PAN status",
    output: "applicable / not, rate, tax, the form, and the basis with warnings",
    requiresApproval: true,
    receipt: "determination with its statutory basis"
  }),
  A({
    id: "tds.206aa-check",
    name: "No-PAN Higher Rate Screen",
    domain: "tds",
    status: "engine",
    purpose: "Apply the higher of the prescribed rate or 20% where PAN is missing \u2014 and confirm 206AB is not the reason.",
    engine: "computeTds (panAvailable false)",
    inputs: "deductee PAN status, section, amount",
    output: "the rate that actually applies, with 206AB explicitly ruled out for FY 2025-26 onward",
    requiresApproval: false,
    receipt: "rate determination under s.206AA"
  }),
  A({
    id: "tds.194q-tracker",
    name: "194Q Threshold Tracker",
    domain: "tds",
    status: "engine",
    purpose: "Track annual purchases per seller and deduct 0.1% from the point \u20B950 lakh is crossed.",
    engine: "computeTds (section 194Q)",
    inputs: "purchase ledger by seller, buyer turnover",
    output: "sellers near or past the threshold with the deduction due, and the 206C(1H) repeal noted",
    requiresApproval: true,
    receipt: "threshold position per seller"
  }),
  A({
    id: "tds.26as-recon",
    name: "26AS / AIS Reconciliation",
    domain: "tds",
    status: "engine",
    purpose: "Tie books to 26AS: deducted versus deposited versus reported, and surface the breaks that create a demand.",
    engine: "reconcileTds",
    inputs: "books TDS entries, challans, 26AS/AIS extract",
    output: "three-way findings with s.201(1A) interest exposure",
    requiresApproval: false,
    receipt: "three-way TDS reconciliation"
  }),
  A({
    id: "tds.26q-preparer",
    name: "26Q / 27Q Preparer",
    domain: "tds",
    status: "workflow",
    purpose: "Assemble quarterly statements with correct section classification, lower-deduction certificates applied, and challan mapping.",
    engine: "computeTds + reconcileTds",
    inputs: "deduction register, challans, certificates",
    output: "statement-ready rows with exception lists",
    requiresApproval: true,
    receipt: "statement prepared with challan mapping"
  }),
  A({
    id: "tds.challan-matcher",
    name: "Challan Matcher",
    domain: "tds",
    status: "engine",
    purpose: "Match paid challans to reported liability by section, period and amount, before the OLTAS mismatch is raised.",
    engine: "reconcileTds (challan branch)",
    inputs: "challan extract, liability by section and period",
    output: "matched, part-matched and unmatched challans with the correction each needs",
    requiresApproval: false,
    receipt: "challan reconciliation by section and period"
  }),
  A({
    id: "tds.form16-issuer",
    name: "Form 16 / 16A Issuer",
    domain: "tds",
    status: "workflow",
    purpose: "Issue certificates from filed returns, with the PAN errors that stop a deductee's credit separated out.",
    engine: "reconcileTds",
    inputs: "filed statements, deductee master",
    output: "certificate set with pre-issue validation findings",
    requiresApproval: true,
    receipt: "certificate issue run with validation results"
  }),
  A({
    id: "tcs.collector",
    name: "TCS Collector",
    domain: "tds",
    status: "engine",
    purpose: "Apply the surviving TCS sections \u2014 and refuse to collect under 206C(1H), which was repealed on 1 April 2025.",
    engine: "tcsSection",
    inputs: "sale type, value, buyer PAN status",
    output: "collection due, or a finding that the collection is no longer lawful",
    requiresApproval: true,
    receipt: "collection determination against the live ruleset"
  }),
  A({
    id: "tds.lower-deduction",
    name: "Lower / Nil Deduction Monitor",
    domain: "tds",
    status: "workflow",
    purpose: "Track certificates, their validity windows and their stated limits, and stop deduction once the limit is exhausted.",
    engine: "computeTds",
    inputs: "certificates, deduction register",
    output: "certificate utilisation with expiry and limit breaches flagged",
    requiresApproval: false,
    receipt: "certificate position at a named date"
  }),
  // ── MSME ────────────────────────────────────────────────────────────────────
  A({
    id: "msme.43bh-clock",
    name: "43B(h) Payment Clock",
    domain: "msme",
    status: "engine",
    purpose: "Run the 45/15-day clock from acceptance on every micro and small supplier bill and quantify the disallowance exposure.",
    engine: "assessPayables + paymentDeadline",
    inputs: "open payables with Udyam class and acceptance dates",
    output: "per-bill due date, days overdue, exposure, and the medium-supplier rows explicitly out of scope",
    requiresApproval: false,
    receipt: "s.43B(h) exposure at a named date"
  }),
  A({
    id: "msme.msme1-return",
    name: "MSME-1 Filer",
    domain: "msme",
    status: "engine",
    purpose: "Identify half-yearly reportable dues over 45 days and prepare the MSME-1 population.",
    engine: "assessPayables + msme1DueDates",
    inputs: "payables aged at the half-year end",
    output: "the reportable population with the due date (30 April / 31 October)",
    requiresApproval: true,
    receipt: "reportable population for the half-year"
  }),
  A({
    id: "msme.udyam-verifier",
    name: "Udyam Class Verifier",
    domain: "msme",
    status: "engine",
    purpose: "Classify suppliers as micro, small, medium or out of scope so the 43B(h) clock is applied to the right ones.",
    engine: "classifyEnterprise",
    inputs: "investment and turnover figures per supplier",
    output: "classification with the threshold reasoning, and medium flagged as uncovered",
    requiresApproval: false,
    receipt: "classification per supplier"
  }),
  // ── Banking and operations ──────────────────────────────────────────────────
  A({
    id: "bank.reconciler",
    name: "Bank Reconciliation",
    domain: "banking-ops",
    status: "workflow",
    purpose: "Match bank statement lines to ledger entries, isolating timing differences from genuine misses.",
    engine: "reconcile (amount and reference passes)",
    inputs: "bank statement, cash/bank ledger",
    output: "matched, timing-difference and unreconciled populations, with stale items aged",
    requiresApproval: false,
    receipt: "reconciliation across both populations"
  }),
  A({
    id: "ops.vendor-master-hygiene",
    name: "Vendor Master Hygiene",
    domain: "banking-ops",
    status: "engine",
    purpose: "Validate every GSTIN and PAN, deduplicate vendors sharing one registration, and catch transposed characters before they reach a return.",
    engine: "validateGstin + vendorKey + validatePan",
    inputs: "vendor master",
    output: "invalid registrations with the specific failure, plus duplicate groups by registration key",
    requiresApproval: false,
    receipt: "master-data validation with per-row reasons"
  }),
  A({
    id: "ops.duplicate-payment",
    name: "Duplicate Payment Detector",
    domain: "banking-ops",
    status: "workflow",
    purpose: "Find the same bill paid twice \u2014 across vendors, months and spelling variants.",
    engine: "reconcile (identity and amount passes)",
    inputs: "payment register, purchase register",
    output: "candidate duplicates with the evidence for each pair",
    requiresApproval: false,
    receipt: "duplicate screen over the payment population"
  }),
  A({
    id: "ops.three-way-match",
    name: "PO / GRN / Invoice Match",
    domain: "banking-ops",
    status: "workflow",
    purpose: "Match purchase order, goods receipt and invoice, and quantify the leakage at each break.",
    engine: "reconcile (three populations)",
    inputs: "PO, GRN and invoice registers",
    output: "price, quantity and timing variances with the value at risk",
    requiresApproval: false,
    receipt: "three-way match with variances quantified"
  }),
  A({
    id: "ops.ageing-analyser",
    name: "Receivables & Payables Ageing",
    domain: "banking-ops",
    status: "engine",
    purpose: "Age open items into the buckets a board asks for, with the MSME and time-bar overlays applied.",
    engine: "assessPayables + period",
    inputs: "open item registers, as-on date",
    output: "ageing bands with exposure overlays rather than bare totals",
    requiresApproval: false,
    receipt: "ageing at a named date"
  }),
  A({
    id: "ops.advance-tax",
    name: "Advance Tax Planner",
    domain: "banking-ops",
    status: "workflow",
    purpose: "Project the year's liability and the 15/45/75/100% instalments, with s.234B and 234C interest on shortfall.",
    engine: "interestOnLateTax (for the interest legs)",
    inputs: "year-to-date income, TDS, prior instalments",
    output: "instalment schedule with the interest cost of each shortfall scenario",
    requiresApproval: true,
    receipt: "instalment plan with interest modelled"
  }),
  A({
    id: "ops.working-capital",
    name: "Working Capital Signal",
    domain: "banking-ops",
    status: "workflow",
    purpose: "Combine the MSME clock, the ITC cycle and the GST due dates into one cash-call calendar.",
    engine: "assessPayables + dueDates",
    inputs: "payables, receivables, return calendar",
    output: "the weeks where cash goes out faster than it comes in, with the drivers named",
    requiresApproval: false,
    receipt: "cash calendar derived from dated obligations"
  }),
  // ── Assurance and reporting ─────────────────────────────────────────────────
  A({
    id: "assure.gstin-network",
    name: "Counterparty Network Analysis",
    domain: "assurance",
    status: "workflow",
    purpose: "Follow the counterparty graph for circular trading, shared-address clusters and suppliers whose filing record is failing.",
    engine: "vendorKey + validateGstin (graph construction)",
    inputs: "purchase and sales registers with registrations",
    output: "clusters with the signals that put them there, and the ITC at risk",
    requiresApproval: false,
    receipt: "network findings over a named population"
  }),
  A({
    id: "assure.turnover-tie",
    name: "Turnover Tie-out",
    domain: "assurance",
    status: "workflow",
    purpose: "Tie reported turnover across GSTR-1, GSTR-3B, the books and the income-tax return, and explain each difference.",
    engine: "buildGstr1 + hardLockCrosswalk",
    inputs: "returns, books, ITR schedules",
    output: "a four-way tie-out with the differences classified and explained",
    requiresApproval: false,
    receipt: "four-way tie-out with explanations"
  }),
  A({
    id: "assure.lapsed-filer-watch",
    name: "Lapsed Filer Watch",
    domain: "assurance",
    status: "workflow",
    purpose: "Flag counterparties whose return filing has stopped, because their silence becomes your credit problem.",
    engine: "reconcile (missing-in-2b population)",
    inputs: "2B and 2A history, supplier list",
    output: "suppliers with filing gaps and the credit exposed through them",
    requiresApproval: false,
    receipt: "filing-gap findings per supplier"
  }),
  A({
    id: "report.board-mis",
    name: "Monthly MIS Pack",
    domain: "reporting",
    status: "workflow",
    purpose: "Assemble the month-end pack: tax position, credit realised, exposures, open notices and cash obligations.",
    engine: "all engines, aggregated",
    inputs: "the outputs of every agent above",
    output: "a board-ready pack where every number traces to a computation",
    requiresApproval: false,
    receipt: "MIS pack with per-line provenance"
  }),
  A({
    id: "report.auditor-pack",
    name: "Auditor Evidence Pack",
    domain: "reporting",
    status: "workflow",
    purpose: "Assemble the reconciliation evidence an auditor asks for, with each figure traceable to its source records.",
    engine: "all engines, receipted",
    inputs: "the period's reconciliations and their inputs",
    output: "an evidence pack where every figure carries its hash, its ruleset and its approver",
    requiresApproval: false,
    receipt: "evidence pack, receipts included"
  })
]);
function agentCount() {
  return AGENTS.length;
}
function agentsByDomain(domain) {
  return AGENTS.filter((a) => a.domain === domain);
}
function findAgent(id) {
  return AGENTS.find((a) => a.id.toLowerCase() === id.toLowerCase());
}
function rosterStatus() {
  return {
    total: AGENTS.length,
    engine: AGENTS.filter((a) => a.status === "engine").length,
    workflow: AGENTS.filter((a) => a.status === "workflow").length,
    requiringApproval: AGENTS.filter((a) => a.requiresApproval).length,
    ruleset: RULESET
  };
}

// probe/munshi.test.ts
var passed = 0;
var failed = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}
function section(name) {
  console.log(`
== ${name}`);
}
var P = rupeesToPaise;
section("1. money is exact, because tax is not a place for binary floats");
ok("rupees convert to integer paise", P(1234.56) === 123456, String(P(1234.56)));
ok(
  "the classic float error does not exist here",
  add(P(0.1), P(0.2)) === P(0.3),
  `${add(P(0.1), P(0.2))} vs ${P(0.3)}`
);
ok(
  "ten paise added a hundred times is exactly one rupee",
  Array.from({ length: 100 }).reduce((a) => add(a, P(0.1)), 0) === P(10)
);
ok("18% of \u20B91,00,000 is \u20B918,000", rate(P(1e5), 18) === P(18e3));
ok(
  "a rate on a fractional base rounds half-up",
  rate(101, 18) === Math.round(101 * 0.18),
  String(rate(101, 18))
);
ok(
  "section 170 rounding goes to the nearest rupee",
  roundToRupee(15050) === 15100 && roundToRupee(15049) === 15e3
);
var split = splitIntraState(1001);
ok(
  "an intra-state split never loses a paisa",
  split.cgst + split.sgst === 1001,
  `${split.cgst} + ${split.sgst}`
);
ok("an odd paisa goes to SGST so the total stays exact", split.cgst === 500 && split.sgst === 501);
ok(
  "Indian digit grouping for \u20B912,34,567.89",
  formatINR(P(123456789e-2)) === "\u20B912,34,567.89",
  formatINR(P(123456789e-2))
);
ok(
  "grouping works at lakh scale",
  formatINR(P(1e5)) === "\u20B91,00,000.00",
  formatINR(P(1e5))
);
ok(
  "compact form for dashboards",
  formatCompact(P(125e5)) === "\u20B91.25 Cr",
  formatCompact(P(125e5))
);
ok("parses a Tally-style comma amount", parseAmount("1,23,456.78") === P(123456.78));
ok("parses a rupee-symbol amount", parseAmount("\u20B9 45,000") === P(45e3));
ok("parses a lakh shorthand", parseAmount("12L") === P(12e5));
ok("parses a crore shorthand", parseAmount("1.25 Cr") === P(125e5));
ok("parses an accounting negative", parseAmount("(1,200)") === P(-1200));
ok("refuses junk instead of guessing", parseAmount("not a number") === null);
ok("a rate with a percent sign parses", parseRate("18%") === 18);
section("2. GSTIN \u2014 the checksum that catches a transposed character");
var first14 = "33AABCV1234K1Z";
var built = first14 + gstinCheckChar(first14);
var builtVerdict = validateGstin(built);
ok("a GSTIN built from the algorithm validates", builtVerdict.ok, built);
var published = "27AAPFU0939F1ZV";
var computed = gstinCheckChar(published.slice(0, 14));
ok(
  "the published example reproduces its own check character",
  computed === published.charAt(14),
  `algorithm produced '${computed}', the document says '${published.charAt(14)}'`
);
var good = validateGstin(published);
ok("a real GSTIN decodes to its state", good.ok && good.parts.stateCode === "27", JSON.stringify(good));
ok("it decodes the embedded PAN", good.ok && good.parts.pan === "AAPFU0939F");
ok(
  "it reads a firm out of the PAN",
  good.ok && good.parts.holderType === "Firm / LLP",
  good.ok ? good.parts.holderType : "n/a"
);
var company14 = "27AAACR5055K1Z";
var companyVerdict = validateGstin(company14 + gstinCheckChar(company14));
ok(
  "and a company out of another",
  companyVerdict.ok && companyVerdict.parts.holderType === "Company",
  companyVerdict.ok ? companyVerdict.parts.holderType : "invalid"
);
ok("the human explanation is one line", explainGstin(published).startsWith("valid \xB7"));
ok("a wrong length is rejected", validateGstin("27AAPFU0939F1Z").ok === false);
var badState = validateGstin("00AAPFU0939F1Z" + computed);
ok(
  "an unissued state code is rejected by state, not by checksum",
  !badState.ok && badState.code === "state-code",
  JSON.stringify(badState)
);
var badChar = published.slice(0, 14) + (published.charAt(14) === "A" ? "B" : "A");
var badCharVerdict = validateGstin(badChar);
ok("a transposed check character is caught", !badCharVerdict.ok && badCharVerdict.code === "checksum");
ok("PAN validation stands alone", validatePan("AAPFU0939F").ok && !validatePan("AAPFU093F").ok);
ok(
  "two registrations of one PAN differ by their registration key",
  vendorKey("27AAPFU0939F1ZV") !== vendorKey("27AAPFU0939F2ZV")
);
section("3. periods and deadlines \u2014 the 1 April year");
ok(
  "a March date belongs to the year that started last April",
  financialYearOf("2027-03-31") === "2026-27",
  financialYearOf("2027-03-31")
);
ok(
  "the next day starts a new financial year",
  financialYearOf("2027-04-01") === "2027-28",
  financialYearOf("2027-04-01")
);
var thisFy = periodsOf("2026-27");
ok("a financial year has twelve periods", thisFy.length === 12);
ok(
  "periods start in April and end in March",
  thisFy[0] === "2026-04" && thisFy[11] === "2027-03",
  `${thisFy[0]} \u2026 ${thisFy[11]}`
);
var g1 = dueDates("GSTR-1", "2026-08")[0];
ok("GSTR-1 is due on the 11th of the following month", g1.due === "2026-09-11", g1.due);
var g3 = dueDates("GSTR-3B", "2026-08")[0];
ok("GSTR-3B is due on the 20th", g3.due === "2026-09-20", g3.due);
var qrmp = dueDates("GSTR-3B", "2026-08", "qrmp", "Y")[0];
ok("QRMP Category Y files on the 24th", qrmp.due === "2026-09-24", qrmp.due);
var iff = dueDates("IFF", "2026-09")[0];
ok("IFF is due on the 13th", iff.due === "2026-10-13", iff.due);
ok("every due date carries its rule as the basis", g1.basis.includes("Rule 59"));
ok(
  "the December period rolls into January correctly",
  dueDates("GSTR-3B", "2026-12")[0].due === "2027-01-20"
);
ok("days overdue is zero before the deadline", daysOverdue("2026-09-20", "2026-09-15") === 0);
ok("days overdue counts from the deadline", daysOverdue("2026-09-20", "2026-09-30") === 10);
section("4. rate migration \u2014 the 12% and 28% slabs are gone");
ok("5% is a current rate", isCurrentRate(5));
ok("18% is a current rate", isCurrentRate(18));
ok("40% is a current rate", isCurrentRate(40));
ok("12% is now legacy", isLegacyRate(12));
ok("28% is now legacy", isLegacyRate(28));
ok("3% survives for bullion", isCurrentRate(3) && isCurrentRate(0.25));
ok("an invoice at 12% is flagged as legacy, not silently accepted", isLegacyRate(12) === true);
var cement = rateForHsn("2523");
ok(
  "an indicative rate exists for cement at 18%",
  cement.rate === 18 && cement.confidence === "indicative",
  JSON.stringify(cement)
);
ok("it says the opinion is indicative rather than authoritative", cement.basis.includes("indicative"));
var unknown = rateForHsn("9999");
ok(
  "an unclassifiable code returns unknown, not a guess",
  unknown.rate === null && unknown.confidence === "unknown",
  JSON.stringify(unknown)
);
ok("a too-short code is refused", rateForHsn("12").rate === null);
section("5. ITC reconciliation \u2014 where the money is");
var books = [
  {
    gstin: "27AAPFU0939F1ZV",
    invoiceNumber: "INV/2026-27/001",
    invoiceDate: "2026-08-04",
    taxableValue: P(1e5),
    igst: 0,
    cgst: P(9e3),
    sgst: P(9e3),
    rate: 18,
    documentType: "invoice"
  },
  {
    gstin: "29AABCT1332L1ZP",
    invoiceNumber: "SB-4471",
    invoiceDate: "2026-08-11",
    taxableValue: P(5e4),
    igst: P(9e3),
    cgst: 0,
    sgst: 0,
    rate: 18,
    documentType: "invoice"
  },
  {
    gstin: "33AACCV1234K1Z9",
    invoiceNumber: "002",
    invoiceDate: "2026-08-14",
    taxableValue: P(2e4),
    igst: 0,
    cgst: P(1800),
    sgst: P(1800),
    rate: 18,
    documentType: "invoice"
  },
  {
    gstin: "29AABCT1332L1ZP",
    invoiceNumber: "SB-4472",
    invoiceDate: "2026-08-18",
    taxableValue: P(25e3),
    igst: P(4500),
    cgst: 0,
    sgst: 0,
    rate: 18,
    reverseCharge: true
  },
  {
    gstin: "27AAPFU0939F1ZV",
    invoiceNumber: "INV/2026-27/001",
    invoiceDate: "2026-08-04",
    taxableValue: P(1e5),
    cgst: P(9e3),
    sgst: P(9e3),
    rate: 18,
    documentType: "invoice"
  }
];
var gstr2b = [
  {
    gstin: "27AAPFU0939F1ZV",
    invoiceNumber: "INV202627001",
    invoiceDate: "2026-08-04",
    taxableValue: P(1e5),
    cgst: P(9e3),
    sgst: P(9e3),
    rate: 18,
    documentType: "invoice"
  },
  {
    gstin: "29AABCT1332L1ZP",
    invoiceNumber: "SB-4471",
    invoiceDate: "2026-08-11",
    taxableValue: P(5e4),
    igst: P(7200),
    cgst: 0,
    sgst: 0,
    rate: 18,
    documentType: "invoice"
  },
  {
    gstin: "33AACCV1234K1Z9",
    invoiceNumber: "CN-900",
    invoiceDate: "2026-08-25",
    taxableValue: P(2e4),
    cgst: P(1800),
    sgst: P(1800),
    rate: 18,
    documentType: "invoice"
  },
  {
    gstin: "27AAACR5055K1Z1",
    invoiceNumber: "R-77",
    invoiceDate: "2026-08-27",
    taxableValue: P(6e4),
    cgst: P(5400),
    sgst: P(5400),
    rate: 18,
    documentType: "invoice"
  }
];
var rec = reconcile(books, gstr2b);
var byOutcome = rec.summary.byOutcome;
ok("the books-side duplicate is found once", byOutcome["duplicate-in-books"] === 1, JSON.stringify(byOutcome));
ok(
  "a number restyled between books and portal still matches",
  byOutcome["exact"] === 1,
  JSON.stringify(byOutcome)
);
ok(
  "a tax difference is classified as a tax mismatch, not a match",
  byOutcome["tax-mismatch"] === 1,
  JSON.stringify(byOutcome)
);
ok(
  "the tax mismatch quantifies the short-paid IGST at \u20B91,800",
  rec.results.find((r) => r.outcome === "tax-mismatch").itcAtRisk === P(1800),
  String(rec.results.find((r) => r.outcome === "tax-mismatch").itcAtRisk)
);
ok(
  "the duplicate is the larger exposure \u2014 \u20B918,000 claimed twice",
  rec.results.find((r) => r.outcome === "duplicate-in-books").itcAtRisk === P(18e3),
  String(rec.results.find((r) => r.outcome === "duplicate-in-books").itcAtRisk)
);
ok(
  "reverse charge is lifted out and never reported as missing from 2B",
  byOutcome["reverse-charge"] === 1 && reconcile(books, gstr2b).results.filter((r) => r.outcome === "missing-in-2b" && r.books?.reverseCharge).length === 0
);
ok(
  "an invoice in 2B but not in the books is its own finding",
  byOutcome["missing-in-books"] === 1,
  JSON.stringify(byOutcome)
);
var periodTolerant = rec.results.find((r) => r.outcome === "period-mismatch");
ok(
  "it does NOT merge a renumbered invoice into an exact match silently",
  periodTolerant !== void 0 && periodTolerant.itcAtRisk === 0,
  `outcome=${periodTolerant?.outcome}`
);
var summary = rec.summary;
ok(
  "ITC at risk totals the duplicate plus the short-paid tax \u2014 \u20B919,800",
  summary.itcAtRisk === P(19800),
  String(summary.itcAtRisk)
);
ok(
  "an invoice in 2B with no books entry is filed as unclaimed, not at risk",
  summary.itcUnclaimed === 0 && summary.byOutcome["missing-in-books"] === 1,
  String(summary.itcUnclaimed)
);
ok("the summary names the ruleset it was computed under", summary.ruleset === RULESET);
var prioritised = prioritise(rec.results);
ok(
  "findings prioritise money over housekeeping",
  prioritised[0].outcome === "tax-mismatch" || prioritised[0].outcome === "duplicate-in-books",
  prioritised[0].outcome
);
var unfiled = reconcile(
  [{
    gstin: "27AAPFU0939F1ZV",
    invoiceNumber: "X-1",
    invoiceDate: "2026-08-02",
    taxableValue: P(1e4),
    cgst: P(900),
    sgst: P(900)
  }],
  []
);
ok(
  "a supplier who has not filed is 'missing in 2B', not an error",
  unfiled.summary.byOutcome["missing-in-2b"] === 1
);
ok(
  "and its credit is booked as unclaimed rather than at risk",
  unfiled.summary.itcUnclaimed === P(1800) && unfiled.summary.itcAtRisk === 0
);
var barred = itcTimeBarred("2025-05-10", "2026-12-05");
ok("credit from FY 2025-26 is time-barred after 30 Nov 2026", barred.barred === true, barred.deadline);
ok("the time bar names s.16(4)", barred.basis.includes("16(4)"));
ok("the 16(5) relief window is handled", itcAvailDeadline("2019-20").deadline === "2025-11-30");
section("6. outward returns and the hard lock");
var posIntra = placeOfSupply("33", "33", P(1e5), 18);
ok("the same state is intra-state", posIntra.supplyType === "intra-state");
ok("intra-state splits into equal halves", posIntra.cgst === P(9e3) && posIntra.sgst === P(9e3));
ok("intra-state carries no IGST", posIntra.igst === 0);
var posInter = placeOfSupply("33", "29", P(1e5), 18);
ok("a different state is inter-state with IGST", posInter.supplyType === "inter-state" && posInter.igst === P(18e3));
ok("inter-state carries no CGST", posInter.cgst === 0);
ok("an out-of-India place of supply is zero-rated", placeOfSupply("33", "96", P(1e5), 18).igst === 0);
var sales = [
  {
    gstin: "27AAPFU0939F1ZV",
    invoiceNumber: "S-1",
    invoiceDate: "2026-08-05",
    taxableValue: P(2e5),
    igst: P(36e3),
    placeOfSupply: "27",
    rate: 18
  },
  {
    gstin: "URP",
    invoiceNumber: "S-2",
    invoiceDate: "2026-08-06",
    taxableValue: P(3e5),
    igst: P(54e3),
    placeOfSupply: "29",
    rate: 18
  },
  {
    gstin: "URP",
    invoiceNumber: "S-3",
    invoiceDate: "2026-08-07",
    taxableValue: P(4e4),
    cgst: P(3600),
    sgst: P(3600),
    placeOfSupply: "33",
    rate: 18
  },
  {
    gstin: "33AACCV1234K1Z9",
    invoiceNumber: "S-4",
    invoiceDate: "2026-08-08",
    taxableValue: P(15e3),
    cgst: P(1350),
    sgst: P(1350),
    placeOfSupply: "33",
    rate: 18,
    documentType: "credit-note"
  }
];
var g1draft = buildGstr1(sales, "33");
ok(
  "registered supplies land in table 4A",
  g1draft.sections.some((s2) => s2.table === "4A" && s2.count === 1)
);
ok(
  "an inter-state B2C invoice above \u20B92.5 lakh goes to B2CL (5A)",
  g1draft.sections.some((s2) => s2.table === "5A" && s2.count === 1)
);
ok(
  "an intra-state B2C invoice goes to B2C Small (7)",
  g1draft.sections.some((s2) => s2.table === "7" && s2.count === 1)
);
ok(
  "a credit note is its own population (9B)",
  g1draft.sections.some((s2) => s2.table === "9B" && s2.count === 1)
);
ok("the rate-wise summary aggregates", g1draft.rateSummary.length >= 1);
ok(
  "totals add up across heads",
  g1draft.totals.taxable === P(2e5 + 3e5 + 4e4 + 15e3),
  String(g1draft.totals.taxable)
);
var g3draft = buildGstr3b(g1draft, { available: P(21600), reversed: 0 });
ok(
  "net cash payable is tax minus credit",
  g3draft.netCashPayable === g3draft.outwardTax - P(21600),
  String(g3draft.netCashPayable)
);
var overCredited = buildGstr3b(g1draft, { available: P(999999), reversed: 0 });
ok("excess credit never produces a negative cash payable", overCredited.netCashPayable === 0);
var clean = hardLockCrosswalk(g1draft, g3draft);
ok("a consistent return reports no findings", clean.consistent === true, JSON.stringify(clean.findings));
var drifted = hardLockCrosswalk(g1draft, { ...g3draft, outwardTax: g3draft.outwardTax - 100 });
ok("a drift between 1 and 3B is caught", drifted.consistent === false);
ok(
  "the correction path names GSTR-1A rather than an edit in 3B",
  drifted.findings[0].correctionPath.includes("GSTR-1A")
);
ok(
  "the crosswalk states that 3B is non-editable under the hard lock",
  drifted.note.includes("non-editable")
);
section("7. interest and late fee");
var interest = interestOnLateTax(P(1e5), "2026-09-20", "2026-10-20", "s.50(1)");
ok(
  "18% for 30 days on \u20B91,00,000 of tax comes to \u20B91,479",
  interest.interest === P(1479),
  `${interest.interest} paise`
);
ok(
  "a 12-day delay costs a fifth of the month",
  interestOnLateTax(P(1e5), "2026-09-20", "2026-10-02").interest === P(592),
  String(interestOnLateTax(P(1e5), "2026-09-20", "2026-10-02").interest)
);
ok("the day count is reported", interest.days === 30, String(interest.days));
ok(
  "interest is computed on net cash liability and says so",
  interest.basis.includes("net cash liability") && interest.basis.includes("Rule 88B")
);
var wrongCredit = interestOnLateTax(P(1e7), "2026-09-20", "2026-10-20", "s.50(3)");
ok("wrongly availed and utilised credit attracts 24%", wrongCredit.ratePercent === 24);
ok(
  "interest is zero before the due date",
  interestOnLateTax(P(1e5), "2026-09-20", "2026-09-15").interest === 0
);
var fee = lateFee("GSTR-3B", "2026-09-20", "2026-09-30");
ok("late fee is \u20B950 a day", fee.perDay === 5e3 && fee.fee === P(500), `${fee.fee}`);
ok("ten days is not capped yet", fee.capped === false);
var nilFee = lateFee("GSTR-3B", "2026-09-20", "2026-09-30", { nil: true });
ok("a nil return pays \u20B920 a day", nilFee.perDay === 2e3);
var long = lateFee("GSTR-3B", "2026-09-20", "2028-09-20");
ok("the cap binds for a long delay", long.capped === true && long.fee === 2e5, String(long.fee));
var bigTaxpayer = lateFee("GSTR-3B", "2026-09-20", "2028-09-20", { turnoverClass: "above-5cr" });
ok("a larger taxpayer has a larger cap", bigTaxpayer.fee === 1e6, String(bigTaxpayer.fee));
var annual = lateFee("GSTR-9", "2026-12-31", "2027-03-31");
ok("the annual return has its own \u20B9200/day fee", annual.perDay === 2e4);
ok("the fee always carries its basis", annual.basis.includes("s.47"));
section("8. e-invoice and e-way bill clocks");
var big = P(12e7);
var small = P(3e7);
ok("e-invoicing applies at \u20B912 crore", eInvoiceStatus(big).mandated === true);
ok("the 30-day limit applies above \u20B910 crore", eInvoiceStatus(big).thirtyDayLimit === true);
ok("below \u20B910 crore the 30-day limit does not apply", eInvoiceStatus(small).thirtyDayLimit === false);
ok("below \u20B95 crore e-invoicing is not mandated", eInvoiceStatus(small).mandated === false);
ok(
  "the deadline is 30 days from the document date",
  irnReportingDeadline("2026-08-01", big) === "2026-08-31",
  irnReportingDeadline("2026-08-01", big)
);
var closing = checkIrnWindow("2026-08-01", big, "2026-08-26");
ok("a window with days left reads as closing soon", closing.status === "closing-soon", closing.status);
var blocked = checkIrnWindow("2026-08-01", big, "2026-09-05");
ok("a missed window is blocked, not merely late", blocked.status === "blocked");
ok(
  "a blocked document explains that it is not a valid tax invoice",
  blocked.finding.includes("not a valid tax invoice")
);
ok(
  "the check does not apply at low turnover",
  checkIrnWindow("2026-08-01", small, "2026-09-05").status === "not-applicable"
);
ok(
  "IRN cancellation is allowed within 24 hours",
  checkIrnCancellationWindow("2026-08-01", "2026-08-01").allowed === true
);
ok(
  "and refused after it, pointing at a credit note",
  checkIrnCancellationWindow("2026-08-01", "2026-08-05").basis.includes("credit note")
);
var eway = ewayBillValidity(450);
ok("e-way validity is one day per 200 km", eway.days === 3, String(eway.days));
ok("over-dimensional cargo is 20 km per day", ewayBillValidity(450, "over-dimensional").days === 23);
ok("short trips still get a full day", ewayBillValidity(30).days === 1);
section("9. TDS \u2014 the thresholds that moved in 2025");
var professional = computeTds({ section: "194J(b)", amount: P(6e4) });
ok(
  "194J professional fees deduct at 10%",
  professional.applicable && professional.rate === 10,
  JSON.stringify(professional)
);
var j194a = tdsSection("194J(a)");
var j194b = tdsSection("194J(b)");
ok(
  "the 194J threshold is \u20B950,000 per category, up from \u20B930,000",
  j194a.threshold === P(5e4) && j194b.threshold === P(5e4) && j194a.basis.includes("30,000") && j194a.basis.includes("50,000"),
  `${j194a.threshold} / ${j194b.threshold} paise \u2014 ${j194a.basis}`
);
ok(
  "it warns that the two 194J categories are counted separately, not together",
  j194b.basis.includes("per category"),
  j194b.basis
);
ok(
  "only the excess above the threshold is deducted once it is crossed",
  professional.tds === P(1e3) && professional.warnings.some((w) => w.includes("excess")),
  String(professional.tds)
);
var belowThreshold = computeTds({ section: "194J(b)", amount: P(4e4) });
ok("below the threshold nothing is deducted", belowThreshold.applicable === false);
var cumulative = computeTds({ section: "194J(b)", amount: P(3e4), previouslyPaid: P(4e4) });
ok(
  "the deduction starts only above the threshold on the cumulative position",
  cumulative.applicable && cumulative.tds === P(2e3),
  String(cumulative.tds)
);
var contractorCo = computeTds({ section: "194C", amount: P(5e4), payeeType: "company" });
ok("194C deducts 2% for a company payee", contractorCo.rate === 2);
var contractorInd = computeTds({ section: "194C", amount: P(5e4), payeeType: "individual" });
ok("194C deducts 1% for an individual", contractorInd.rate === 1);
var noPan = computeTds({ section: "194J(b)", amount: P(6e4), panAvailable: false });
ok("no PAN forces the higher rate", noPan.rate === 20, String(noPan.rate));
ok(
  "and the reason is s.206AA, not 206AB",
  noPan.warnings.some((w) => w.includes("206AA")) && noPan.warnings.some((w) => w.includes("206AB")),
  JSON.stringify(noPan.warnings)
);
var partner = computeTds({ section: "194T", amount: P(5e4) });
ok("194T exists for firm-to-partner payments", partner.applicable && partner.rate === 10);
ok(
  "194T carries a \u20B920,000 threshold",
  tdsSection("194T").threshold === 2e6,
  String(tdsSection("194T").threshold)
);
var senior = computeTds({ section: "194A", amount: P(7e4), isSeniorCitizen: true });
ok("a senior citizen keeps the \u20B91,00,000 interest threshold", senior.applicable === false);
ok(
  "an ordinary depositor is already over \u20B950,000",
  computeTds({ section: "194A", amount: P(7e4) }).applicable === true
);
var unknownSection = computeTds({ section: "194ZZ", amount: P(1e5) });
ok("an unknown section refuses rather than guessing", unknownSection.applicable === false && unknownSection.warnings.includes("unknown section"));
var repealed = tcsSection("206C(1H)");
ok(
  "206C(1H) is present as a repeal notice, not as a live rate",
  repealed !== void 0 && repealed.rate === 0 && repealed.basis.includes("REPEALED")
);
ok("the surviving TCS section still collects", tcsSection("206C(1F)").rate === 1);
ok(
  "194Q is 0.1% above \u20B950 lakh",
  tdsSection("194Q").threshold === 5e8,
  String(tdsSection("194Q").threshold)
);
var tdsRec = reconcileTds(
  [
    { deductee: "Acme", section: "194C", quarter: "Q2", amount: P(2e4) },
    { deductee: "Beta", section: "194J(b)", quarter: "Q2", amount: P(15e3) }
  ],
  [{ deductee: "Acme", section: "194C", quarter: "Q2", amount: P(2e4) }],
  [
    { deductee: "Acme", section: "194C", quarter: "Q2", amount: P(2e4) },
    { deductee: "Gamma", section: "194H", quarter: "Q2", amount: P(5e3) }
  ]
);
ok(
  "a deduction not deposited is a finding",
  tdsRec.findings.some((f) => f.kind === "deducted-not-deposited"),
  JSON.stringify(tdsRec.findings.map((f) => f.kind))
);
ok(
  "a deposit not reported is its own finding",
  tdsRec.findings.some((f) => f.kind === "deducted-not-deposited")
);
ok(
  "a 26AS entry with no books counterpart is caught",
  tdsRec.findings.some((f) => f.kind === "reported-not-in-books")
);
ok(
  "the three totals are returned for the tie-out",
  tdsRec.totalDeducted === P(35e3) && tdsRec.totalDeposited === P(2e4) && tdsRec.totalReported === P(25e3)
);
section("9b. the Act transition \u2014 which law governs, and what to quote");
ok(
  "31 March 2026 is governed by the 1961 Act",
  statuteForEvent("2026-03-31").statute === "1961",
  statuteForEvent("2026-03-31").act
);
ok(
  "1 April 2026 is governed by the 2025 Act",
  statuteForEvent("2026-04-01").statute === "2025",
  statuteForEvent("2026-04-01").act
);
ok(
  "the routing states the earlier-of-credit-or-payment rule it applies",
  statuteForEvent("2026-04-01").basis.includes("earlier of credit or payment")
);
ok(
  "the transition date is a value, not a magic string in a comparison",
  TDS_TRANSITION_DATE === "2026-04-01"
);
var oldC = statuteReference("194C", "2026-02-10");
ok(
  "a February deduction quotes s.194C under the 1961 Act",
  oldC.statute === "1961" && oldC.section === "194C",
  `${oldC.act} s.${oldC.section}`
);
ok(
  "and it forward-references what the section becomes",
  oldC.crossReference.includes("393(1)") && oldC.crossReference.includes("6(i)"),
  oldC.crossReference
);
var newC = statuteReference("194C", "2026-05-10");
ok(
  "a May deduction moves to s.393(1) under the 2025 Act",
  newC.statute === "2025" && newC.section === "393(1)",
  `${newC.act} s.${newC.section}`
);
ok(
  "with the table item for the payee class",
  newC.tableRef !== null && newC.tableRef.includes("6(i).D(a)") && newC.tableRef.includes("6(i).D(b)"),
  String(newC.tableRef)
);
ok(
  "and it cross-references the former section an accountant still knows",
  newC.crossReference.includes("194C"),
  newC.crossReference
);
ok(
  "the reference prints one readable line",
  explainStatuteReference(newC).startsWith("Income-tax Act, 2025 \xB7 s.393(1)"),
  explainStatuteReference(newC)
);
ok(
  "professional fees land on the 194J(b) table item with code 1027",
  statuteReference("194J(b)", "2026-09-30").tableRef === "Sl. 6(iii).D(b)" && statuteReference("194J(b)", "2026-09-30").paymentCode === 1027
);
ok(
  "technical fees land on 194J(a) with code 1026",
  statuteReference("194J(a)", "2026-09-30").paymentCode === 1026
);
ok(
  "partner payments move to s.393(3) (the 'any person' table)",
  statuteReference("194T", "2026-09-30").section === "393(3)" && statuteReference("194T", "2026-09-30").tableRef === "Sl. 7"
);
ok(
  "non-resident payments move to s.393(2)",
  statuteReference("195", "2026-09-30").section === "393(2)"
);
ok(
  "salary is its own section, not part of the 393 table",
  statuteReference("192", "2026-09-30").section === "392"
);
var r194r = statuteReference("194R", "2026-09-30");
ok(
  "a disputed payment code is withheld, not guessed",
  r194r.tableRef === "Sl. 8(iv)" && r194r.paymentCode === null && r194r.confidence === "reported",
  `${r194r.tableRef} / code ${String(r194r.paymentCode)} / ${r194r.confidence}`
);
ok(
  "and the disagreement is named in the basis",
  r194r.basis.includes("sources disagree"),
  r194r.basis.slice(0, 90)
);
var r194m = statuteReference("194M", "2026-09-30");
ok(
  "a section with no mapping is declared unmapped rather than invented",
  r194m.confidence === "unmapped" && r194m.tableRef === null,
  `${r194m.confidence} / ${String(r194m.tableRef)}`
);
ok(
  "and it tells the operator to confirm against the department's master",
  r194m.basis.includes("validation master"),
  r194m.basis.slice(0, 80)
);
ok(
  "TCS moves to s.394 rather than disappearing",
  statuteReference("206C(1)", "2026-09-30", "tcs").section === "394",
  statuteReference("206C(1)", "2026-09-30", "tcs").basis.slice(0, 70)
);
ok(
  "the repealed 206C(1H) has no successor entry to quote",
  statuteReference("206C(1H)", "2026-09-30", "tcs").basis.includes("repealed"),
  statuteReference("206C(1H)", "2026-09-30", "tcs").basis.slice(0, 70)
);
var fOld = returnFormFor("194C", "2026-03-31");
ok(
  "before the changeover the return form is the familiar 26Q",
  fOld.form === "26Q" && fOld.certificate === "Form 16A" && fOld.confidence === "asserted"
);
var fNew = returnFormFor("194C", "2026-05-10");
ok(
  "after it, the form numbering is stated but NOT asserted",
  fNew.confidence === "reported" && fNew.basis.includes("does NOT assert"),
  `${fNew.form} \u2014 ${fNew.confidence}`
);
ok(
  "and the reason it is not asserted is named",
  fNew.basis.includes("disagree"),
  fNew.basis.slice(0, 90)
);
ok(
  "salary keeps its own form numbering",
  returnFormFor("192", "2026-03-31").form === "24Q"
);
var dated = computeTds({
  section: "194C",
  amount: P(6e4),
  payeeType: "company",
  creditOrPaymentOn: "2026-05-10"
});
ok(
  "a dated deduction returns the statute alongside the rate",
  dated.statute === "2025" && dated.statuteReference?.section === "393(1)",
  `${String(dated.statute)} / ${String(dated.statuteReference?.section)}`
);
ok("the form to file follows the date", dated.formToFile === "140", String(dated.formToFile));
ok(
  "the verdict's basis names the section to quote",
  dated.basis.includes("393(1)"),
  dated.basis.slice(-90)
);
var undated = computeTds({ section: "194C", amount: P(6e4), payeeType: "company" });
ok(
  "an undated deduction still computes the rate",
  undated.tds === dated.tds && undated.tds === P(1200),
  `${undated.tds} vs ${dated.tds}`
);
ok(
  "but refuses to name a statute",
  undated.statute === null && undated.statuteReference === null
);
ok(
  "and says exactly why the answer is incomplete",
  undated.warnings.some((w) => w.includes("earlier of the date of credit")),
  JSON.stringify(undated.warnings)
);
var backdated = computeTds({
  section: "194C",
  amount: P(6e4),
  payeeType: "company",
  creditOrPaymentOn: "2026-03-20"
});
ok(
  "the RATES are identical either side of the changeover",
  backdated.tds === dated.tds && backdated.rate === dated.rate,
  `${backdated.rate}% / ${backdated.tds} vs ${dated.rate}% / ${dated.tds}`
);
ok(
  "only the legal reference moves",
  backdated.statute === "1961" && backdated.formToFile === "26Q",
  `${String(backdated.statute)} / ${String(backdated.formToFile)}`
);
ok(
  "206AA still forces the higher rate under the new Act",
  computeTds({
    section: "194J(b)",
    amount: P(6e4),
    panAvailable: false,
    creditOrPaymentOn: "2026-06-01"
  }).rate === 20
);
section("10. MSME \u2014 the 45-day clock that becomes a disallowance");
ok(
  "a micro manufacturer classifies as micro",
  classifyEnterprise("manufacturing", 5e6, 2e7) === "micro"
);
ok(
  "a medium enterprise is NOT covered by 43B(h)",
  paymentDeadline("2026-08-01", "medium").covered === false
);
ok(
  "and the basis says so explicitly",
  paymentDeadline("2026-08-01", "medium").basis.includes("MICRO and SMALL")
);
ok(
  "a small supplier gets 45 days with an agreement",
  paymentDeadline("2026-08-01", "small").dueBy === "2026-09-15",
  paymentDeadline("2026-08-01", "small").dueBy
);
ok(
  "15 days where there is no written agreement",
  paymentDeadline("2026-08-01", "small", { writtenAgreement: false }).dueBy === "2026-08-16"
);
ok(
  "the clock runs from acceptance when it is known",
  paymentDeadline("2026-08-01", "small", { acceptedOn: "2026-08-20" }).dueBy === "2026-10-04"
);
var assessed = assessPayables([
  {
    vendor: "SmallCo",
    invoiceNumber: "A-1",
    invoiceDate: "2026-06-01",
    amount: P(1e5),
    enterprise: "small"
  },
  {
    vendor: "MediumCo",
    invoiceNumber: "A-2",
    invoiceDate: "2026-06-01",
    amount: P(5e5),
    enterprise: "medium"
  },
  {
    vendor: "PaidCo",
    invoiceNumber: "A-3",
    invoiceDate: "2026-06-01",
    amount: P(5e4),
    enterprise: "micro",
    paidOn: "2026-07-10"
  }
], "2026-09-30");
ok(
  "an overdue micro/small bill creates disallowance exposure",
  assessed.rows.find((r) => r.vendor === "SmallCo").disallowanceExposure === P(1e5)
);
ok(
  "a medium bill creates none, however overdue",
  assessed.rows.find((r) => r.vendor === "MediumCo").disallowanceExposure === 0
);
ok(
  "a paid bill that was late has no exposure but says it was late",
  assessed.rows.find((r) => r.vendor === "PaidCo").finding.includes("paid")
);
ok("total exposure is the covered amount only", assessed.totalExposure === P(1e5), String(assessed.totalExposure));
ok("the MSME-1 population is identified separately", assessed.msme1Reportable === P(1e5));
ok("the classification counts are reported", assessed.covered === 2 && assessed.notCovered === 1);
var msme1 = msme1DueDates("2026-27");
ok("MSME-1 is half-yearly with two due dates", msme1.length === 2 && msme1[1].due === "2027-04-30");
section("11. the roster holds itself to its own claims");
var roster = rosterStatus();
ok("the pack ships well over thirty specialists", roster.total >= 30, `count=${roster.total}`);
ok("the roster is 47 specialists across 8 domains", roster.total === 47, String(roster.total));
ok("the roster size matches the registry", agentCount() === AGENTS.length);
ok(
  "every agent id is unique",
  new Set(AGENTS.map((a) => a.id)).size === AGENTS.length
);
ok(
  "every agent declares a purpose and an engine",
  AGENTS.every((a) => a.purpose.length > 40 && a.engine.length > 3)
);
ok("every agent declares what 11Handle signs", AGENTS.every((a) => a.receipt.length > 10));
ok(
  "the roster reports how many are engine-backed today",
  roster.engine + roster.workflow === roster.total && roster.engine >= 15,
  JSON.stringify(roster)
);
ok(
  "a substantial share of the roster ends at a human gate",
  roster.requiringApproval >= 15,
  String(roster.requiringApproval)
);
var ACTION_IDS = /preparer|issuer|drafter|responder|actioning|deductor|collector|return|allocator/i;
var actionAgents = AGENTS.filter((a) => ACTION_IDS.test(a.id));
ok(
  "the roster contains filing-end agents for the gate to apply to",
  actionAgents.length >= 10,
  String(actionAgents.length)
);
ok(
  "every agent that files, issues or answers the department carries the approval flag",
  actionAgents.every((a) => a.requiresApproval === true),
  actionAgents.filter((a) => !a.requiresApproval).map((a) => a.id).join(", ")
);
ok("the roster names its ruleset", roster.ruleset === RULESET);
var exportsSet = new Set(Object.keys(munshi_exports));
var STEP_WORDS = /* @__PURE__ */ new Set(["rule", "money", "returns", "period", "all", "aggregated", "receipted"]);
var missing = [];
for (const a of AGENTS) {
  for (const part of a.engine.split(/[+,]/)) {
    const lead = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (!lead) continue;
    const token = lead[1];
    if (!exportsSet.has(token) && !STEP_WORDS.has(token)) missing.push(`${a.id} \u2192 ${token}`);
  }
}
ok(
  "every engine an agent claims actually exists in the pack",
  missing.length === 0,
  missing.slice(0, 6).join(", ")
);
ok(
  "the domain split covers the Indian finance surface",
  new Set(AGENTS.map((a) => a.domain)).size >= 6
);
ok("findAgent resolves an id", findAgent("gst.itc-2b-recon")?.domain === "gst-itc");
ok(
  "agentsByDomain filters",
  agentsByDomain("tds").length >= 6,
  String(agentsByDomain("tds").length)
);
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);
