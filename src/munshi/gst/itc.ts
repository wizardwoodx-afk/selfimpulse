/**
 * ITC reconciliation — the engine that pays for the pack.
 *
 * Every Indian finance team's month ends the same way: the purchase register is matched
 * against GSTR-2B, and the differences decide how much input tax credit is safe to claim.
 * The money is real (18% of a purchase is not a rounding error) and the reconciliation is
 * usually done in a spreadsheet by one exhausted person under a deadline.
 *
 * What this engine refuses to do: match on invoice NUMBER alone. Two suppliers can use
 * "001"; one supplier can restyle the same number between its books and the portal. A
 * number-only match silently pairs the wrong invoices and produces a confident, wrong
 * ITC figure — the worst possible output. So matching runs in passes and every pass
 * records WHICH key it matched on, and the classification says what to do about it.
 */
import { type Invoice, type MatchOutcome, type MatchResult } from "../types";
import { type Paise } from "../money";
import { daysBetween } from "../period";
import { financialYearOf } from "../period";
import { RULESET } from "../ruleset";

export interface ReconcileOptions {
  /** Tax difference tolerated as a rounding artefact, in paise. Default ₹1. */
  valueTolerance?: Paise;
  /** How many days a document may sit in a different period and still be "same doc". */
  periodToleranceDays?: number;
  /** Treat credit/debit notes as their own population rather than invoices. */
  separateNotes?: boolean;
}

const DEFAULTS: Required<ReconcileOptions> = {
  valueTolerance: 100,
  periodToleranceDays: 32,
  separateNotes: true,
};

/**
 * Normalise an invoice number for comparison: strip everything that is formatting.
 * "INV/2026-27/00142 " and "INV20262700142" are the same document; "142" and "00142" are
 * not necessarily, so leading zeros are preserved deliberately.
 */
export function normaliseInvoiceNumber(raw: string): string {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function taxOf(inv: Invoice): Paise {
  return (inv.igst ?? 0) + (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.cess ?? 0);
}

function kindOf(inv: Invoice): string {
  return inv.documentType ?? "invoice";
}

/** Which document an ITC decision is about, when the same number appears twice. */
function identity(inv: Invoice): string {
  return `${kindOf(inv)}|${inv.gstin}|${normaliseInvoiceNumber(inv.invoiceNumber)}`;
}

function sameDocument(a: Invoice, b: Invoice, tol: Required<ReconcileOptions>): boolean {
  if (a.gstin !== b.gstin) return false;
  if (normaliseInvoiceNumber(a.invoiceNumber) !== normaliseInvoiceNumber(b.invoiceNumber)) return false;
  if (kindOf(a) !== kindOf(b)) return false;
  if (Math.abs(daysBetween(a.invoiceDate, b.invoiceDate)) > tol.periodToleranceDays) return false;
  return true;
}

/**
 * Match one population against the other in passes, and report the FIRST pass that
 * succeeds with the specific discrepancy that survived it.
 *
 * Pass order is a value judgement, stated so it can be argued with:
 *   1. same document, everything agrees            → exact
 *   2. same document, tax differs beyond tolerance → tax-mismatch (the money case)
 *   3. same document, taxable differs              → value-mismatch
 *   4. same GSTIN + same taxable + same tax window → likely the same document with a
 *      different number (supplier renumbered it) → period-mismatch, needs a human look
 * Anything left over is genuinely absent on one side.
 */
export function reconcile(
  books: Invoice[],
  gstr2b: Invoice[],
  options: ReconcileOptions = {},
): { results: MatchResult[]; summary: ReconcileSummary } {
  const tol = { ...DEFAULTS, ...options };
  const results: MatchResult[] = [];
  const used2b = new Set<number>();
  const usedBooks = new Set<number>();

  // Reverse-charge rows never appear in 2B — the recipient is the supplier. Pulling them
  // out first prevents a permanent false "missing in 2B" on every RCM bill.
  books.forEach((b, i) => {
    if (b.reverseCharge === true) {
      usedBooks.add(i);
      results.push({
        outcome: "reverse-charge", books: b, itcAtRisk: 0,
        detail: `RCM — self-assessed by the recipient; correctly absent from 2B. `
          + `ITC on it is claimed in the period the tax is paid (${RULESET})`,
      });
    }
  });

  // duplicate detection inside each side
  const seenBooks = new Map<string, number>();
  books.forEach((b, i) => {
    if (usedBooks.has(i)) return;
    const key = identity(b);
    if (seenBooks.has(key)) {
      usedBooks.add(i);
      results.push({
        outcome: "duplicate-in-books", books: b, itcAtRisk: taxOf(b),
        detail: `same document booked twice (first at row ${seenBooks.get(key)}) — ITC is claimable once`,
      });
    } else {
      seenBooks.set(key, i);
    }
  });
  const seen2b = new Map<string, number>();
  gstr2b.forEach((g, i) => {
    const key = identity(g);
    if (seen2b.has(key)) {
      used2b.add(i);
      results.push({ outcome: "duplicate-in-2b", gstr2b: g, itcAtRisk: 0,
                     detail: "the portal carries this document twice — verify before claiming" });
    } else {
      seen2b.set(key, i);
    }
  });

  // pass 1–3: same document
  books.forEach((b, i) => {
    if (usedBooks.has(i)) return;
    const j = gstr2b.findIndex((g, k) => !used2b.has(k) && sameDocument(b, g, tol));
    if (j < 0) return;
    const g = gstr2b[j]!;
    usedBooks.add(i); used2b.add(j);

    const taxDelta = taxOf(b) - taxOf(g);
    const valueDelta = b.taxableValue - g.taxableValue;

    if (Math.abs(taxDelta) <= tol.valueTolerance && Math.abs(valueDelta) <= tol.valueTolerance) {
      results.push({ outcome: "exact", books: b, gstr2b: g, itcAtRisk: 0,
                     detail: "books and 2B agree — ITC safe to claim" });
      return;
    }
    if (Math.abs(taxDelta) > tol.valueTolerance) {
      results.push({
        outcome: "tax-mismatch", books: b, gstr2b: g,
        itcAtRisk: Math.abs(taxDelta),
        detail: `tax differs by ${taxDelta} paise — claim only the 2B figure; the excess is `
          + `not available until the supplier amends its GSTR-1`,
      });
      return;
    }
    results.push({
      outcome: "value-mismatch", books: b, gstr2b: g, itcAtRisk: Math.abs(valueDelta),
      detail: `taxable value differs by ${valueDelta} paise but tax agrees — usually a `
        + `rounding or a discount booked late; the 2B figure governs`,
    });
  });

  // pass 4: same GSTIN, same money, number differs
  books.forEach((b, i) => {
    if (usedBooks.has(i)) return;
    const j = gstr2b.findIndex((g, k) => !used2b.has(k)
      && g.gstin === b.gstin
      && kindOf(g) === kindOf(b)
      && Math.abs(taxOf(g) - taxOf(b)) <= tol.valueTolerance
      && Math.abs(g.taxableValue - b.taxableValue) <= tol.valueTolerance);
    if (j < 0) return;
    const g = gstr2b[j]!;
    usedBooks.add(i); used2b.add(j);
    results.push({
      outcome: "period-mismatch", books: b, gstr2b: g, itcAtRisk: 0,
      detail: `same supplier, same amount, different number ("${b.invoiceNumber}" vs `
        + `"${g.invoiceNumber}") — likely one document renumbered. Credit is claimable in `
        + `the 2B period, but confirm the number before filing`,
    });
  });

  // leftovers
  books.forEach((b, i) => {
    if (usedBooks.has(i)) return;
    results.push({
      outcome: "missing-in-2b", books: b, itcAtRisk: taxOf(b),
      detail: `not in 2B — supplier has not filed it. Do not claim yet: follow up, and use `
        + `IMS to keep it pending rather than rejecting it`,
    });
  });
  gstr2b.forEach((g, j) => {
    if (used2b.has(j)) return;
    const taxable = g.taxableValue;
    results.push({
      outcome: "missing-in-books", gstr2b: g, itcAtRisk: 0,
      detail: `in 2B but not in books (taxable ${taxable} paise) — either a genuine purchase `
        + `never recorded, or an invoice addressed to someone else. Both are findings`,
    });
  });

  return { results, summary: summarise(results) };
}

export interface ReconcileSummary {
  total: number;
  byOutcome: Record<string, number>;
  /** ITC that cannot safely be claimed as things stand, in paise. */
  itcAtRisk: Paise;
  /** ITC available but unclaimed because the supplier has not filed, in paise. */
  itcUnclaimed: Paise;
  agreed: number;
  ruleset: string;
}

function summarise(results: MatchResult[]): ReconcileSummary {
  const byOutcome: Record<string, number> = {};
  let atRisk = 0, unclaimed = 0, agreed = 0;
  for (const r of results) {
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    if (r.outcome === "exact" || r.outcome === "period-mismatch") agreed++;
    if (r.outcome === "missing-in-2b") unclaimed += r.itcAtRisk;
    else atRisk += r.itcAtRisk;
  }
  return { total: results.length, byOutcome, itcAtRisk: atRisk, itcUnclaimed: unclaimed,
           agreed, ruleset: RULESET };
}

/** Findings in the order a finance controller wants to see them: money first. */
export function prioritise(results: MatchResult[]): MatchResult[] {
  const order: MatchOutcome[] = [
    "tax-mismatch", "duplicate-in-books", "gstin-mismatch", "value-mismatch",
    "missing-in-2b", "missing-in-books", "duplicate-in-2b", "cancelled-in-2b",
    "period-mismatch", "reverse-charge", "rate-mismatch", "exact",
  ];
  return [...results].sort((a, b) =>
    order.indexOf(a.outcome) - order.indexOf(b.outcome) || b.itcAtRisk - a.itcAtRisk);
}

/**
 * Section 16(4): credit for a financial year cannot be availed after 30 November of the
 * following year, or the annual return date, whichever is earlier. Section 16(5) gave
 * relief for FY 2017-18 to FY 2020-21. This is the deadline that turns an unclaimed ITC
 * from a receivable into a write-off, so agents surface it as a countdown.
 */
export function itcAvailDeadline(financialYear: string): { deadline: string; basis: string } {
  const startYear = Number(financialYear.slice(0, 4));
  const fy = startYear <= 2020 ? "2017-18 to 2020-21" : financialYear;
  if (fy === "2017-18 to 2020-21") {
    return { deadline: "2025-11-30",
             basis: "s.16(5) relief window — the FY 2017-18 to 2020-21 credit was allowed up to 30 Nov 2025" };
  }
  return {
    deadline: `${startYear + 1}-11-30`,
    basis: `s.16(4) — credit for FY ${financialYear} lapses after 30 Nov ${startYear + 1}, or the `
      + `annual return date if earlier`,
  };
}

export function itcTimeBarred(invoiceDate: string, asOn: string): { barred: boolean; deadline: string; basis: string } {
  const { deadline, basis } = itcAvailDeadline(financialYearOf(invoiceDate));
  return { barred: asOn > deadline, deadline, basis };
}
