/**
 * Statutory computation — rates, interest, late fees, e-invoice clocks, e-way validity.
 *
 * Every function here returns its `basis` string alongside the number, because an agent
 * that hands an operator a figure without saying which rule produced it has given them
 * something they cannot defend in an assessment.
 */
import { RULESET } from "../ruleset";
import { type Paise, paise as toPaise, roundToRupee } from "../money";
import { daysBetween, daysOverdue } from "../period";

// ── GST rates, post 22 September 2025 ─────────────────────────────────────────
/**
 * The 56th GST Council collapsed the structure. 12% and 28% are gone for most goods and
 * services; the working rates are 5% and 18%, with nil for essentials and a 40% special
 * rate for demerit and luxury goods. 3% and 0.25% survive for bullion.
 *
 * LEGACY_RATES is not decoration. Its real job is `isLegacyRate()`, which is how the
 * compliance agents find invoices still charging 12% or 28% — a live defect on books
 * that were not repriced in September 2025.
 */
export const CURRENT_RATES = Object.freeze([0, 0.25, 3, 5, 18, 40] as const);
export const LEGACY_RATES = Object.freeze([12, 28] as const);

export function isLegacyRate(percent: number): boolean {
  return (LEGACY_RATES as readonly number[]).includes(percent);
}

export function isCurrentRate(percent: number): boolean {
  return (CURRENT_RATES as readonly number[]).includes(percent);
}

/**
 * An INDICATIVE starting map, deliberately labelled as such.
 *
 * HSN-level rates come from CBIC rate notifications and change by entry; a pack that
 * pretends to know all of them would be lying at scale. This covers the classifications
 * Munshi agents hit constantly, and returns `confidence: "unknown"` for anything else so
 * the agent escalates instead of guessing. Classification is a human decision with a
 * named responsible person — Section 13 of the CGST Act puts liability on the declarant.
 */
export interface RateOpinion {
  rate: number | null;
  confidence: "indicative" | "unknown";
  basis: string;
}

const INDICATIVE: ReadonlyArray<{ prefix: string; rate: number; what: string }> = Object.freeze([
  { prefix: "2523", rate: 18, what: "cement" },
  { prefix: "2710", rate: 18, what: "petroleum products (rates vary by entry)" },
  { prefix: "3004", rate: 5, what: "medicaments — many entries nil-rated; verify per entry" },
  { prefix: "7108", rate: 3, what: "gold" },
  { prefix: "7102", rate: 0.25, what: "rough diamonds" },
  { prefix: "2402", rate: 40, what: "tobacco products" },
  { prefix: "2202", rate: 40, what: "aerated / caffeinated beverages" },
  { prefix: "8418", rate: 18, what: "refrigerators" },
  { prefix: "8415", rate: 18, what: "air conditioners" },
  { prefix: "8528", rate: 18, what: "televisions and monitors" },
  { prefix: "8703", rate: 18, what: "motor cars — 40% applies above the large-car threshold" },
  { prefix: "8711", rate: 18, what: "motorcycles — 40% above 350cc" },
  { prefix: "8708", rate: 18, what: "motor vehicle parts" },
  { prefix: "1006", rate: 5, what: "rice — many entries nil when unbranded" },
  { prefix: "0406", rate: 5, what: "cheese" },
  { prefix: "0405", rate: 5, what: "butter and ghee" },
  { prefix: "6109", rate: 5, what: "t-shirts and vests" },
  { prefix: "6103", rate: 5, what: "suits and trousers (18% above the ₹2,500 price point)" },
  { prefix: "9954", rate: 18, what: "construction services" },
  { prefix: "9983", rate: 18, what: "professional and technical services (SAC 9983)" },
  { prefix: "9965", rate: 5, what: "goods transport agency services" },
  { prefix: "9992", rate: 5, what: "passenger transport" },
  { prefix: "9972", rate: 18, what: "real estate services" },
  { prefix: "9982", rate: 18, what: "legal and accounting services" },
]);

export function rateForHsn(hsn: string): RateOpinion {
  const code = String(hsn ?? "").replace(/\D/g, "");
  if (code.length < 4) {
    return { rate: null, confidence: "unknown", basis: "HSN/SAC needs at least 4 digits to classify" };
  }
  const hit = INDICATIVE.find((r) => code.startsWith(r.prefix));
  if (hit) {
    return {
      rate: hit.rate, confidence: "indicative",
      basis: `indicative for ${hit.what} (${hit.prefix}*) under ${RULESET}; confirm against the CBIC rate notification before filing`,
    };
  }
  return {
    rate: null, confidence: "unknown",
    basis: `no indicative entry for ${code} under ${RULESET} — classification is a declarant decision, do not infer it`,
  };
}

// ── Interest, Section 50 ──────────────────────────────────────────────────────
export type InterestBasis = "s.50(1)" | "s.50(3)";

/**
 * s.50(1): 18% per annum on tax paid late.
 * s.50(3): 24% per annum where ITC was wrongly availed AND utilised.
 *
 * Rule 88B: for a delayed GSTR-3B the interest runs on the NET CASH liability, not the
 * gross tax — computing it on gross is the single most common overpayment we see in
 * books, so `netCashLiability` is the parameter name, not `amount`.
 *
 * The day-count convention is explicit because practice varies between 365 and 360 and
 * an operator must be able to match their own. Default 365; both are defensible and the
 * basis string says which was used.
 */
export function interestOnLateTax(
  netCashLiability: Paise,
  from: string,
  to: string,
  basis: InterestBasis = "s.50(1)",
  dayBasis: 365 | 360 = 365,
): { interest: Paise; days: number; ratePercent: number; basis: string } {
  const ratePercent = basis === "s.50(1)" ? 18 : 24;
  const days = Math.max(0, daysBetween(from, to));
  const interest = roundToRupee(toPaise((netCashLiability * ratePercent * days) / (100 * dayBasis)));
  return {
    interest, days, ratePercent,
    basis: `${basis} — ${ratePercent}% p.a., simple, ${days} days on a ${dayBasis}-day year, ` +
      `net cash liability (Rule 88B), rounded to the nearest rupee`,
  };
}

// ── Late fee, Section 47 ──────────────────────────────────────────────────────
export type TurnoverClass = "up-to-1.5cr" | "1.5-to-5cr" | "above-5cr";

const LATE_FEE_CAP: Readonly<Record<TurnoverClass, Paise>> = Object.freeze({
  "up-to-1.5cr": 200_000,        // ₹2,000
  "1.5-to-5cr": 500_000,         // ₹5,000
  "above-5cr": 1_000_000,        // ₹10,000
});

/**
 * s.47 late fee: ₹50 per day for a normal return (₹25 CGST + ₹25 SGST), ₹20 per day for a
 * nil return, capped by turnover class. The cap is the part teams forget — a return two
 * years late is not a two-year fee.
 */
export function lateFee(
  kind: "GSTR-1" | "GSTR-3B" | "GSTR-9",
  dueDate: string,
  filedOn: string,
  opts: { nil?: boolean; turnoverClass?: TurnoverClass } = {},
): { fee: Paise; days: number; perDay: Paise; capped: boolean; basis: string } {
  const days = daysOverdue(dueDate, filedOn);
  const nil = opts.nil === true;
  const turnoverClass = opts.turnoverClass ?? "up-to-1.5cr";

  if (kind === "GSTR-9") {
    const perDay = 20_000;                                  // ₹200/day (₹100 + ₹100)
    const cap = LATE_FEE_CAP[turnoverClass];
    const gross = perDay * days;
    return {
      fee: Math.min(gross, cap), days, perDay, capped: gross > cap,
      basis: `s.47 read with the annual-return notification — ₹200 per day capped at the `
        + `${(cap / 100).toLocaleString("en-IN")} ceiling for a ${turnoverClass} taxpayer`,
    };
  }

  const perDay = nil ? 2_000 : 5_000;                        // ₹20 nil, ₹50 otherwise
  const cap = LATE_FEE_CAP[turnoverClass];
  const gross = perDay * days;
  return {
    fee: Math.min(gross, cap), days, perDay, capped: gross > cap,
    basis: `s.47 — ₹${perDay / 100}/day (${nil ? "nil return" : "CGST ₹25 + SGST ₹25"}), `
      + `capped at ₹${(cap / 100).toLocaleString("en-IN")} for a ${turnoverClass} taxpayer`,
  };
}

// ── E-invoice clocks ──────────────────────────────────────────────────────────
export interface EInvoiceStatus {
  mandated: boolean;
  thirtyDayLimit: boolean;
  reason: string;
}

/** AATO ₹5 crore mandates e-invoicing; ₹10 crore adds the 30-day hard stop. */
export function eInvoiceStatus(annualAggregateTurnover: Paise): EInvoiceStatus {
  const cr = annualAggregateTurnover / 1e9;                  // paise → crore
  if (cr >= 10) {
    return {
      mandated: true, thirtyDayLimit: true,
      reason: `AATO ₹${cr.toFixed(2)} Cr — e-invoicing mandated (since 1 Aug 2023) and the `
        + `30-day IRP reporting limit applies (since 1 Apr 2025, Rule 48(4)/48(5))`,
    };
  }
  if (cr >= 5) {
    return {
      mandated: true, thirtyDayLimit: false,
      reason: `AATO ₹${cr.toFixed(2)} Cr — e-invoicing mandated, but the 30-day hard stop `
        + `applies only at ₹10 Cr and above. Report promptly anyway: a blocked IRN cascades `
        + `into GSTR-1 and any refund built on the document`,
    };
  }
  return {
    mandated: false, thirtyDayLimit: false,
    reason: `AATO ₹${cr.toFixed(2)} Cr — below the ₹5 Cr e-invoicing mandate. Confirm against `
      + `turnover in ANY year since 2017-18: crossing the line once keeps you in scope`,
  };
}

/** The date an IRN becomes impossible. Past it, the document is not a valid tax invoice. */
export function irnReportingDeadline(invoiceDate: string, annualAggregateTurnover: Paise): string {
  const status = eInvoiceStatus(annualAggregateTurnover);
  if (!status.thirtyDayLimit) return "no statutory cut-off";
  const d = new Date(`${invoiceDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
}

export interface IrnWindowCheck {
  status: "within-window" | "closing-soon" | "blocked" | "not-applicable";
  deadline: string;
  daysLeft: number;
  finding: string;
}

/**
 * Whether a document can still be reported. "closing-soon" is set at 7 days because a
 * month-end backlog is how organisations actually lose IRNs, and a warning that arrives
 * on day 29 is a post-mortem.
 */
export function checkIrnWindow(invoiceDate: string, annualAggregateTurnover: Paise, asOn: string): IrnWindowCheck {
  const status = eInvoiceStatus(annualAggregateTurnover);
  if (!status.thirtyDayLimit) {
    return { status: "not-applicable", deadline: "no statutory cut-off", daysLeft: Infinity,
             finding: "30-day limit does not apply at this turnover" };
  }
  const deadline = irnReportingDeadline(invoiceDate, annualAggregateTurnover);
  const daysLeft = daysBetween(asOn, deadline);
  if (daysLeft < 0) {
    return { status: "blocked", deadline, daysLeft,
             finding: `IRN can no longer be generated for a document dated ${invoiceDate}. `
               + `Without an IRN this is not a valid tax invoice and the recipient's ITC is at risk` };
  }
  return {
    status: daysLeft <= 7 ? "closing-soon" : "within-window", deadline, daysLeft,
    finding: daysLeft <= 7
      ? `${daysLeft} day(s) left to report — the window closes irreversibly at 30 days`
      : `${daysLeft} days left to report`,
  };
}

/** Cancellation of an IRN is permitted for 24 hours; after that, issue a credit note. */
export function checkIrnCancellationWindow(irnGeneratedAt: string, asOn: string): { allowed: boolean; basis: string } {
  const hours = (Date.parse(`${asOn}T23:59:59Z`) - Date.parse(`${irnGeneratedAt}T00:00:00Z`)) / 3_600_000;
  return {
    allowed: hours <= 24,
    basis: hours <= 24
      ? "within the 24-hour cancellation window"
      : `${Math.floor(hours / 24)} day(s) later — the IRN can no longer be cancelled; issue a credit note instead`,
  };
}

// ── E-way bill validity ───────────────────────────────────────────────────────
/** Rule 138(10): 200 km per day for normal cargo, 20 km per day for over-dimensional. */
export function ewayBillValidity(distanceKm: number, cargo: "normal" | "over-dimensional" = "normal"): { days: number; basis: string } {
  const perDay = cargo === "normal" ? 200 : 20;
  const days = Math.max(1, Math.ceil(distanceKm / perDay));
  return { days, basis: `Rule 138(10) — ${perDay} km per day for ${cargo} cargo over ${distanceKm} km` };
}
