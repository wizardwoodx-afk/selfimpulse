/**
 * The ruleset stamp.
 *
 * A tax engine without a date on its rates is a liability, not an asset. Every rate,
 * threshold and deadline in this pack belongs to a named ruleset; the stamp travels with
 * the output so a receipt can say which law the number was computed under.
 *
 * Bumping this constant is a deliberate act: change the tables, change the date, and the
 * probe that pins the tables will fail until it is updated with the new basis in hand.
 */
export const RULESET = "IN-2026.09";

/** When the rates in this ruleset took effect, and what put them there. */
export const RULESET_BASIS = Object.freeze({
  gstRates: "22 September 2025 (56th GST Council) — 12% and 28% slabs abolished for most goods and services",
  gstr3bLock: "July 2025 tax period onwards — auto-populated liability fields are non-editable; corrections move to GSTR-1 / GSTR-1A",
  einvoice30Day: "1 April 2025 — 30-day IRP reporting limit for AATO ₹10 crore and above (Rule 48(4)/48(5))",
  einvoiceMandate: "1 August 2023 — e-invoicing mandatory at AATO ₹5 crore and above",
  tds: "Finance Act 2025, effective 1 April 2025 — 206AB/206CCA omitted, 206C(1H) repealed, 194T introduced, 194J threshold ₹50,000",
  tdsAct2026: "1 April 2026 — the Income-tax Act, 2025 governs TDS on the EARLIER of credit or payment falling on or after that date: salary s.392, residents s.393 (one table), non-residents s.393(2), any person s.393(3), TCS s.394; rates and thresholds unchanged, the section reference changes",
  msme: "Section 43B(h) — payments to micro and small enterprises within 45 days (15 where no agreement)",
  ims: "Invoice Management System — accept / reject / pending actioning drives the recipient's GSTR-2B",
});

export function rulesetStamp(): string {
  return `${RULESET} (gst-rates ${RULESET_BASIS.gstRates.slice(0, 4)} …)`;
}
