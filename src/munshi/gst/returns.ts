/**
 * Outward returns — GSTR-1 assembly, GSTR-3B assembly, and the hard-lock crosswalk.
 *
 * The hard-lock is the reason this file exists as an engine rather than a form-filler.
 * Since the July 2025 period, the liability fields in GSTR-3B are auto-populated from
 * GSTR-1 and are NOT editable. So the old month-end ritual — "adjust it in 3B" — is gone
 * at the portal. If the two disagree, the only legal route is to correct GSTR-1 (or file
 * GSTR-1A before the 3B). An agent that still offers to "fix it in 3B" is giving advice
 * that the portal will reject, so the crosswalk names the correction path explicitly.
 */
import { type Invoice } from "../types";
import { type Paise, add, rate as applyRate, roundToRupee, splitIntraState } from "../money";
import { RULESET } from "../ruleset";
import { STATE_CODES } from "../gstin";

export interface PosVerdict {
  supplyType: "intra-state" | "inter-state" | "export" | "sez";
  igst: Paise;
  cgst: Paise;
  sgst: Paise;
  basis: string;
}

/**
 * Place of supply decides the tax head, and getting it wrong is not a rounding error —
 * it is a wrong return in two states. For goods the default is the delivery location;
 * for services it is generally the recipient's location, with a long list of exceptions
 * (immovable property, events, transport, restaurants) that this function does NOT
 * pretend to encode. It computes the split once a human (or a rules table with a named
 * owner) has decided the place of supply.
 */
export function placeOfSupply(supplierState: string, posState: string, taxable: Paise, ratePercent: number): PosVerdict {
  const tax = applyRate(taxable, ratePercent);
  if (posState === "96") {
    return { supplyType: "export", igst: 0, cgst: 0, sgst: 0,
             basis: "place of supply outside India — zero-rated under s.16 IGST; report as export "
               + "of goods/services with shipping bill or LUT, not as a taxable supply" };
  }
  if (supplierState === posState) {
    const { cgst, sgst } = splitIntraState(tax);
    return { supplyType: "intra-state", igst: 0, cgst, sgst,
             basis: `supplier state ${STATE_CODES[supplierState] ?? supplierState} equals place of supply — `
               + "intra-state: CGST + SGST in equal halves (s.8 CGST Act)" };
  }
  return { supplyType: "inter-state", igst: tax, cgst: 0, sgst: 0,
           basis: `supplier state ${STATE_CODES[supplierState] ?? supplierState} differs from place of supply `
             + `${STATE_CODES[posState] ?? posState} — inter-state: IGST (s.7 IGST Act)` };
}

export interface Gstr1Section {
  table: string;
  label: string;
  count: number;
  taxable: Paise;
  tax: Paise;
}

export interface Gstr1Draft {
  period: string;
  sections: Gstr1Section[];
  totals: { taxable: Paise; igst: Paise; cgst: Paise; sgst: Paise; cess: Paise };
  rateSummary: Array<{ rate: number; taxable: Paise; tax: Paise }>;
  notes: string[];
  ruleset: string;
}

/** B2CL: inter-state supply to an unregistered person above ₹2.5 lakh invoice value. */
export const B2CL_THRESHOLD: Paise = 25_000_000;

/**
 * Assemble a GSTR-1 draft from a sales register. Section allocation follows the return's
 * own table numbering, because the operator has to enter these numbers into those tables.
 */
export function buildGstr1(invoices: Invoice[], supplierState: string): Gstr1Draft {
  const sections = new Map<string, Gstr1Section>();
  const rates = new Map<number, { taxable: Paise; tax: Paise }>();
  const notes: string[] = [];
  let tTaxable = 0, tIgst = 0, tCgst = 0, tSgst = 0, tCess = 0;

  const bump = (table: string, label: string, inv: Invoice, tax: Paise) => {
    const cur = sections.get(table) ?? { table, label, count: 0, taxable: 0, tax: 0 };
    cur.count += 1; cur.taxable += inv.taxableValue; cur.tax += tax;
    sections.set(table, cur);
  };

  for (const inv of invoices) {
    const tax = (inv.igst ?? 0) + (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.cess ?? 0);
    const isNote = inv.documentType === "credit-note" || inv.documentType === "debit-note";
    const registered = !!inv.gstin && inv.gstin !== "URP" && inv.gstin.length === 15;

    if (!registered) {
      const interState = inv.placeOfSupply !== undefined && inv.placeOfSupply !== supplierState;
      const b2cl = interState && inv.taxableValue > B2CL_THRESHOLD;
      bump(b2cl ? "5A" : "7", b2cl ? "B2C Large (inter-state, above ₹2.5 L)" : "B2C Small",
           inv, tax);
      if (interState && !b2cl) {
        notes.push(`Invoice ${inv.invoiceNumber}: inter-state B2C below ₹2.5 L — consolidated in `
          + `table 7, but the tax head is still IGST. Do not merge it into the intra-state lines.`);
      }
    } else if (isNote) {
      bump("9B", "Credit / debit notes (registered)", inv, tax);
    } else {
      bump("4A", "B2B supplies (registered)", inv, tax);
    }

    const ratePercent = inv.rate ?? (inv.taxableValue > 0 ? (tax * 100) / inv.taxableValue : 0);
    const r = rates.get(Math.round(ratePercent)) ?? { taxable: 0, tax: 0 };
    r.taxable += inv.taxableValue; r.tax += tax;
    rates.set(Math.round(ratePercent), r);

    tTaxable += inv.taxableValue;
    tIgst += inv.igst ?? 0; tCgst += inv.cgst ?? 0; tSgst += inv.sgst ?? 0; tCess += inv.cess ?? 0;
  }

  const rateSummary = [...rates.entries()]
    .map(([rateValue, v]) => ({ rate: rateValue, taxable: v.taxable, tax: v.tax }))
    .sort((a, b) => a.rate - b.rate);

  return {
    period: "", sections: [...sections.values()], rateSummary,
    totals: { taxable: tTaxable, igst: tIgst, cgst: tCgst, sgst: tSgst, cess: tCess },
    notes: [...new Set(notes)], ruleset: RULESET,
  };
}

export interface Gstr3bDraft {
  outwardTaxable: Paise;
  outwardTax: Paise;
  itcAvailable: Paise;
  itcReversed: Paise;
  netCashPayable: Paise;
  y9?: Paise;
  ruleset: string;
}

/**
 * Assemble GSTR-3B from the GSTR-1 totals and the ITC position.
 *
 * Two arithmetic facts that decide whether a return is correct:
 *   · Table 4(B) reversals must not be netted into 4(A) — the portal reconciles them
 *     against 2B, and a netted figure reads as an under-claim, which invites a notice.
 *   · Net cash payable is never below zero. Excess credit carries forward; it is not
 *     refunded through 3B.
 */
export function buildGstr3b(
  gstr1: Gstr1Draft,
  itc: { available: Paise; reversed: Paise },
): Gstr3bDraft {
  const outwardTax = add(gstr1.totals.igst, gstr1.totals.cgst, gstr1.totals.sgst, gstr1.totals.cess);
  const netItc = itc.available - itc.reversed;
  const netCashPayable = Math.max(0, outwardTax - netItc);
  return {
    outwardTaxable: gstr1.totals.taxable,
    outwardTax,
    itcAvailable: itc.available,
    itcReversed: itc.reversed,
    netCashPayable,
    ruleset: RULESET,
  };
}

export interface CrosswalkFinding {
  table: string;
  what: string;
  gstr1: Paise;
  gstr3b: Paise;
  delta: Paise;
  correctionPath: string;
}

/**
 * The hard-lock crosswalk. Compares what GSTR-1 will report with what GSTR-3B says, and
 * for every difference names the ONLY route that fixes it. Under hard-locking there is no
 * table in 3B to edit, so "adjust in 3B" is not advice — it is a rejection.
 */
export function hardLockCrosswalk(
  gstr1: Gstr1Draft,
  gstr3b: Gstr3bDraft,
): { findings: CrosswalkFinding[]; consistent: boolean; note: string } {
  const g1Tax = add(gstr1.totals.igst, gstr1.totals.cgst, gstr1.totals.sgst, gstr1.totals.cess);
  const findings: CrosswalkFinding[] = [];

  if (g1Tax !== gstr3b.outwardTax) {
    findings.push({
      table: "3.1(a)", what: "outward taxable supplies — tax", gstr1: g1Tax, gstr3b: gstr3b.outwardTax,
      delta: gstr3b.outwardTax - g1Tax,
      correctionPath: "Correct GSTR-1, or file GSTR-1A before the 3B. Table 3.1 is auto-populated "
        + "and non-editable from the July 2025 period — it cannot be adjusted here.",
    });
  }
  if (gstr1.totals.taxable !== gstr3b.outwardTaxable) {
    findings.push({
      table: "3.1(a)", what: "outward taxable supplies — value", gstr1: gstr1.totals.taxable,
      gstr3b: gstr3b.outwardTaxable, delta: gstr3b.outwardTaxable - gstr1.totals.taxable,
      correctionPath: "Same route as the tax difference: GSTR-1 or GSTR-1A.",
    });
  }
  const netNegative = gstr3b.itcAvailable - gstr3b.itcReversed < 0;
  if (netNegative) {
    findings.push({
      table: "4", what: "ITC reversal exceeds credit available", gstr1: 0,
      gstr3b: gstr3b.itcReversed, delta: gstr3b.itcReversed,
      correctionPath: "Table 4(B) reversal cannot exceed 4(A) credit. Check whether a reversal "
        + "belongs to an earlier period; unused reversal is a common double-count in the ledger.",
    });
  }

  return {
    findings,
    consistent: findings.length === 0,
    note: `Hard-lock in force (${RULESET}): table 3.1 and 3.2 are auto-populated from GSTR-1 and are `
      + "not editable. Table 3.2 (inter-state supplies to unregistered persons) became non-editable "
      + "from the July 2025 period. Any correction therefore runs through GSTR-1 or GSTR-1A.",
  };
}

/** Round the return totals to the rupee the way the portal does before filing. */
export function roundReturnTotals(gstr3b: Gstr3bDraft): Gstr3bDraft {
  return {
    ...gstr3b,
    outwardTaxable: roundToRupee(gstr3b.outwardTaxable),
    outwardTax: roundToRupee(gstr3b.outwardTax),
    itcAvailable: roundToRupee(gstr3b.itcAvailable),
    itcReversed: roundToRupee(gstr3b.itcReversed),
    netCashPayable: roundToRupee(gstr3b.netCashPayable),
  };
}
