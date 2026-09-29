/**
 * TDS — withholding, thresholds and the reconciliation that catches under-deduction.
 *
 * The ruleset here is Finance Act 2025 (FY 2025-26 onward), and it moved in three ways
 * that break older code and older habits:
 *   · Sections 206AB and 206CCA were OMITTED from 1 April 2025 — the "higher rate for
 *     non-filers" logic that many spreadsheets still carry is dead law.
 *   · Section 206C(1H) TCS on sale of goods was REPEALED.
 *   · Section 194T is new — 10% on payments by a firm to its partners above ₹20,000.
 *
 * Section 206AA survives: no PAN means the higher of the prescribed rate or 20%, and that
 * is a real cost an agent should flag before payment, not after.
 */
import { RULESET } from "./ruleset";
import { type Paise, rate as applyRate, roundToRupee } from "./money";
import { statuteReference, returnFormFor, type Statute, type StatuteReference } from "./tdsStatute";

export type TdsForm = "24Q" | "26Q" | "27Q" | "26QB" | "27EQ";

export interface TdsSection {
  section: string;
  what: string;
  /** Rate applied; `null` where the rate depends on the payee's status (see `byPayee`). */
  rate: number | null;
  byPayee?: Readonly<Record<string, number>>;
  /** Threshold, and whether it is per transaction or aggregate for the year. */
  threshold: Paise;
  thresholdBasis: "per-transaction" | "annual";
  resident: boolean;
  form: TdsForm;
  basis: string;
}

const L = 10_000_000;  // ₹1 lakh in PAISE — the unit here is paise, and getting this
                       // wrong corrupts every threshold below by two orders of magnitude

export const TDS_TABLE: readonly TdsSection[] = Object.freeze([
  { section: "192", what: "salary", rate: null, threshold: 0, thresholdBasis: "annual",
    resident: true, form: "24Q", basis: "slab rates on estimated income; no single rate" },
  { section: "192A", what: "premature EPF withdrawal", rate: 10, threshold: 50_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "Finance Act 2025" },
  { section: "193", what: "interest on securities", rate: 10, threshold: 10_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "Finance Act 2025" },
  { section: "194", what: "dividend", rate: 10, threshold: 10_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "threshold raised to ₹10,000" },
  { section: "194A", what: "interest other than securities", rate: 10, threshold: 50_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q",
    basis: "₹50,000 general / ₹1,00,000 senior citizen — raise threshold to 100000 for senior payees" },
  { section: "194B", what: "lottery or game-show winnings", rate: 30, threshold: 10_000 * 100,
    thresholdBasis: "per-transaction", resident: true, form: "26Q", basis: "Finance Act 2025" },
  { section: "194BA", what: "online gaming winnings", rate: 30, threshold: 0,
    thresholdBasis: "per-transaction", resident: true, form: "26Q", basis: "on net winnings, no threshold" },
  { section: "194C", what: "payment to contractors", rate: null,
    byPayee: { individual: 1, huf: 1, other: 2 }, threshold: 30_000 * 100,
    thresholdBasis: "per-transaction", resident: true, form: "26Q",
    basis: "₹30,000 single / ₹1,00,000 annual (₹2,00,000 where the payer is an individual or HUF)" },
  { section: "194D", what: "insurance commission", rate: 2, threshold: 20_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "rate reduced to 2% from 1 Apr 2025" },
  { section: "194DA", what: "life-insurance policy receipts", rate: 2, threshold: L,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "on the income component" },
  { section: "194G", what: "lottery ticket commission", rate: 2, threshold: 20_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "Finance Act 2025" },
  { section: "194H", what: "commission or brokerage", rate: 2, threshold: 20_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "rate reduced from 5% to 2%" },
  { section: "194-I(a)", what: "rent — plant and machinery", rate: 2, threshold: 50_000 * 100,
    thresholdBasis: "per-transaction", resident: true, form: "26Q",
    basis: "₹50,000 per month (Finance Act 2025)" },
  { section: "194-I(b)", what: "rent — land, building, furniture", rate: 10, threshold: 50_000 * 100,
    thresholdBasis: "per-transaction", resident: true, form: "26Q", basis: "₹50,000 per month" },
  { section: "194-IA", what: "transfer of immovable property", rate: 1, threshold: 50 * L,
    thresholdBasis: "per-transaction", resident: true, form: "26QB", basis: "Form 26QB is filed per transaction" },
  { section: "194-IB", what: "rent by individual/HUF not liable to audit", rate: 2,
    threshold: 50_000 * 100, thresholdBasis: "per-transaction", resident: true, form: "26QB",
    basis: "₹50,000 per month or part of it" },
  { section: "194-IC", what: "joint development agreement payments", rate: 10, threshold: 0,
    thresholdBasis: "per-transaction", resident: true, form: "26Q", basis: "no threshold" },
  { section: "194J(a)", what: "technical services, call centre, certain royalties", rate: 2,
    threshold: 50_000 * 100, thresholdBasis: "annual", resident: true, form: "26Q",
    basis: "threshold raised from ₹30,000 to ₹50,000 per category" },
  { section: "194J(b)", what: "professional fees, director's remuneration", rate: 10,
    threshold: 50_000 * 100, thresholdBasis: "annual", resident: true, form: "26Q",
    basis: "threshold applies per category, not in aggregate with 194J(a)" },
  { section: "194K", what: "income from mutual-fund units", rate: 10, threshold: 10_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "Finance Act 2025" },
  { section: "194LA", what: "compulsory acquisition of immovable property", rate: 10, threshold: 5 * L,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "threshold raised to ₹5,00,000" },
  { section: "194M", what: "payments by individual/HUF to contractors and professionals", rate: 2,
    threshold: 50 * L, thresholdBasis: "annual", resident: true, form: "26Q", basis: "₹50,00,000 annual" },
  { section: "194N", what: "cash withdrawals above the limit", rate: 2, threshold: 1e7 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "₹1 crore (₹3 crore for co-operative societies)" },
  { section: "194-O", what: "e-commerce participant payments", rate: 0.1, threshold: 5 * L,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "on gross amount of sales" },
  { section: "194Q", what: "purchase of goods", rate: 0.1, threshold: 50 * L,
    thresholdBasis: "annual", resident: true, form: "26Q",
    basis: "0.1% on purchases above ₹50 lakh from one seller; buyer's turnover must exceed ₹10 crore" },
  { section: "194R", what: "benefit or perquisite in business", rate: 10, threshold: 20_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q", basis: "value of the benefit" },
  { section: "194S", what: "transfer of virtual digital assets", rate: 1, threshold: 10_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q",
    basis: "₹50,000 for specified persons (threshold must be raised for those payees)" },
  { section: "194T", what: "payments by a firm to its partners", rate: 10, threshold: 20_000 * 100,
    thresholdBasis: "annual", resident: true, form: "26Q",
    basis: "NEW from 1 April 2025 — salary, remuneration, commission, bonus or interest to a partner" },
  { section: "195", what: "payments to non-residents", rate: null, threshold: 0,
    thresholdBasis: "per-transaction", resident: false, form: "27Q",
    basis: "rate depends on the nature of income and the applicable DTAA — never infer this one; "
      + "a wrong rate here creates a demand on the deductor" },
]);

export function tdsSection(section: string): TdsSection | undefined {
  return TDS_TABLE.find((s) => s.section.toUpperCase() === section.toUpperCase());
}

export type PayeeType = "individual" | "huf" | "company" | "firm" | "other";

export interface TdsInput {
  section: string;
  amount: Paise;
  /** Everything already paid to this payee this year under this section. */
  previouslyPaid?: Paise;
  payeeType?: PayeeType;
  /** false triggers Section 206AA. */
  panAvailable?: boolean;
  isSeniorCitizen?: boolean;
  /**
   * The EARLIER of the date of credit and the date of payment, ISO yyyy-mm-dd.
   *
   * This is not a nicety. On or after 1 April 2026 the Income-tax Act, 2025 governs the
   * deduction and the old 194-series reference must not be quoted on the return; before
   * that date the 1961 Act does. Without this input the answer is incomplete, and the
   * engine says so rather than defaulting to whichever Act it happens to be compiled
   * against.
   */
  creditOrPaymentOn?: string;
}

export interface TdsVerdict {
  applicable: boolean;
  rate: number;
  tds: Paise;
  section: string;
  /** The form on the 1961-Act table — the historical label. `formToFile` is what applies. */
  form: TdsForm | null;
  /** The form that applies on the date supplied. */
  formToFile: string | null;
  /** null when no credit/payment date was supplied — the statute is then undetermined. */
  statute: Statute | null;
  /** The section to QUOTE, its table item, its payment code and the cross-reference. */
  statuteReference: StatuteReference | null;
  basis: string;
  /** Basis for the form numbering, kept separate because its confidence is lower. */
  formBasis: string;
  warnings: string[];
}

/**
 * Compute the deduction for one payment, and say why.
 *
 * The payable amount is the CUMULATIVE figure crossing the threshold, not the current
 * invoice — Section 194C deducts on the amount that breaches ₹1,00,000 annual, not on the
 * whole year's total. Getting this backwards either over-deducts (a supplier complaint)
 * or under-deducts (a demand).
 */
export function computeTds(input: TdsInput): TdsVerdict {
  const warnings: string[] = [];
  const eventDate = input.creditOrPaymentOn?.trim();
  const ref = eventDate ? statuteReference(input.section, eventDate) : null;
  const formInfo = eventDate ? returnFormFor(input.section, eventDate) : null;
  if (!eventDate) {
    warnings.push("the earlier of the date of credit and the date of payment was not supplied — the "
      + "RATE is computed, but which Act governs and which section reference to quote are NOT: from "
      + "1 April 2026 the Income-tax Act, 2025 governs and the 194-series label must not be used");
  }
  if (ref?.confidence === "unmapped") warnings.push(ref.basis);

  const s = tdsSection(input.section);
  if (!s) {
    return { applicable: false, rate: 0, tds: 0, section: input.section, form: null,
             formToFile: formInfo?.form ?? null,
             statute: ref?.statute ?? null,
             statuteReference: ref,
             formBasis: formInfo?.basis ?? "statute not determined without a credit/payment date",
             basis: `section ${input.section} is not in the ${RULESET} table — do not deduct on a guess`,
             warnings: ["unknown section", ...warnings] };
  }

  /** Every path below carries the routing, so no answer is half a question. */
  const routing = {
    formToFile: formInfo?.form ?? s.form,
    statute: ref?.statute ?? null,
    statuteReference: ref,
    formBasis: formInfo?.basis ?? "statute not determined without a credit/payment date",
  };

  const previously = input.previouslyPaid ?? 0;
  const cumulative = previously + input.amount;
  const threshold = s.section === "194A" && input.isSeniorCitizen ? L : s.threshold;
  if (s.section === "194A" && input.isSeniorCitizen) {
    warnings.push("senior citizen payee — the ₹1,00,000 threshold applies to 194A");
  }

  let rate = s.rate ?? 0;
  if (s.byPayee) {
    const key = input.payeeType ?? "other";
    const payeeKey = key === "individual" || key === "huf" ? key : "other";
    rate = s.byPayee[payeeKey] ?? s.byPayee["other"] ?? 0;
  }
  if (s.rate === null && !s.byPayee) {
    return { applicable: true, rate: 0, tds: 0, section: s.section, form: s.form,
             ...routing,
             basis: `${s.section}: ${s.basis} — the rate must be determined from the payee's status, `
               + "not from a table",
             warnings: ["rate not auto-determinable"] };
  }

  const crossed = s.thresholdBasis === "annual" ? cumulative > threshold : input.amount > threshold;
  if (!crossed) {
    return { applicable: false, rate, tds: 0, section: s.section, form: s.form,
             ...routing,
             basis: `threshold not crossed (${s.thresholdBasis}); ${s.basis}`, warnings };
  }

  let amountToDeduct = input.amount;
  if (s.thresholdBasis === "annual" && previously <= threshold) {
    // only the portion above the threshold attracts deduction
    amountToDeduct = cumulative - threshold;
    warnings.push(`deduction applies from the point the ${s.thresholdBasis} threshold was crossed, `
      + `so only the excess above the threshold is deducted on this payment`);
  }

  // Section 206AA — no PAN. 206AB is omitted from FY 2025-26, so it is deliberately absent.
  if (input.panAvailable === false) {
    const higher = Math.max(rate, 20);
    warnings.push(`s.206AA — no PAN: rate is the higher of the prescribed rate (${rate}%) or 20%, `
      + `so ${higher}% applies. Sections 206AB/206CCA were omitted from 1 April 2025 and are NOT the basis here`);
    rate = higher;
    amountToDeduct = input.amount;
  }

  const tds = roundToRupee(applyRate(amountToDeduct, rate));
  return {
    applicable: true, rate, tds, section: s.section, form: s.form,
    ...routing,
    basis: `s.${s.section} at ${rate}% on ${amountToDeduct} paise — ${s.basis}`
      + (ref ? `. Reference to quote — ${ref.basis}` : ""),
    warnings,
  };
}

// ── TCS, Section 206C ─────────────────────────────────────────────────────────
export interface TcsSection { section: string; what: string; rate: number; threshold: Paise; basis: string }

export const TCS_TABLE: readonly TcsSection[] = Object.freeze([
  { section: "206C(1)", what: "alcohol, timber, scrap, minerals", rate: 1, threshold: 0,
    basis: "at the point of sale" },
  { section: "206C(1F)", what: "sale of motor vehicle above ₹10 lakh", rate: 1, threshold: 1e6 * 100,
    basis: "on the sale value above the threshold" },
  { section: "206C(1G)", what: "LRS remittance / overseas tour programme", rate: 5,
    threshold: 7 * L, basis: "5% above ₹7 lakh per year under LRS; 20% for non-PAN" },
  { section: "206C(1H)", what: "sale of goods", rate: 0, threshold: 0,
    basis: "REPEALED from 1 April 2025 — any collector still running this is over-collecting and "
      + "must refund with interest" },
]);

export function tcsSection(section: string): TcsSection | undefined {
  return TCS_TABLE.find((s) => s.section.toUpperCase() === section.toUpperCase());
}

// ── Reconciliation: books vs 26AS vs challans ────────────────────────────────
export interface TdsEntry { deductee: string; section: string; quarter: string; amount: Paise }
export interface TdsFinding {
  kind: "deducted-not-deposited" | "deposited-not-reported" | "reported-not-in-books" | "rate-mismatch";
  deductee: string;
  amount: Paise;
  detail: string;
}

/**
 * The three-way tie that a TDS notice is built on: what was deducted (books), what was
 * deposited (challans), what was reported (26AS, and the 26Q that feeds it). Any break in
 * the chain creates a demand on the deductor, so the agent reports the chain, not a total.
 */
export function reconcileTds(
  books: TdsEntry[],
  deposited: TdsEntry[],
  reported26as: TdsEntry[],
): { findings: TdsFinding[]; totalDeducted: Paise; totalDeposited: Paise; totalReported: Paise } {
  const head = (e: TdsEntry) => `${e.deductee.toUpperCase()}|${e.section}|${e.quarter}`;
  const sum = (rows: TdsEntry[]) => rows.reduce((a, r) => a + r.amount, 0);

  const dep = new Map<string, Paise>();
  for (const d of deposited) dep.set(head(d), (dep.get(head(d)) ?? 0) + d.amount);
  const rep = new Map<string, Paise>();
  for (const r of reported26as) rep.set(head(r), (rep.get(head(r)) ?? 0) + r.amount);

  const findings: TdsFinding[] = [];
  for (const b of books) {
    const k = head(b);
    const depositedAmt = dep.get(k) ?? 0;
    if (depositedAmt < b.amount) {
      findings.push({
        kind: "deducted-not-deposited", deductee: b.deductee, amount: b.amount - depositedAmt,
        detail: `deducted but not fully deposited for ${b.quarter} — interest under s.201(1A) runs at `
          + `1% per month for non-deposit and 1.5% for late deposit, and the expense is disallowed`,
      });
    }
    const reportedAmt = rep.get(k) ?? 0;
    if (reportedAmt < b.amount) {
      findings.push({
        kind: "deposited-not-reported", deductee: b.deductee, amount: b.amount - reportedAmt,
        detail: `deposited but not reported in 26Q/26AS for ${b.quarter} — the deductee cannot claim `
          + `credit and will raise it with you; correct the return`,
      });
    }
  }
  const bookKeys = new Set(books.map(head));
  for (const r of reported26as) {
    if (!bookKeys.has(head(r))) {
      findings.push({
        kind: "reported-not-in-books", deductee: r.deductee, amount: r.amount,
        detail: `appears in 26AS for ${r.quarter} with no corresponding entry in books — either a `
          + `mis-tagged deduction or a vendor you have not recorded`,
      });
    }
  }

  return { findings, totalDeducted: sum(books), totalDeposited: sum(deposited), totalReported: sum(reported26as) };
}
