/** Shared shapes. Kept tiny on purpose: the pack is engines, not an object model. */

export type StateCode = string;
export type StateName = string;

/** A GST return period, always the month it covers, e.g. 2026-08. */
export type TaxPeriod = string;
export type FinancialYear = string;          // "2026-27"

export interface Invoice {
  /** Supplier GSTIN. May be "URP" for an unregistered counterparty. */
  gstin: string;
  invoiceNumber: string;
  invoiceDate: string;                        // ISO yyyy-mm-dd
  taxableValue: number;                       // paise
  igst?: number;
  cgst?: number;
  sgst?: number;
  cess?: number;
  /** Document kind — credit and debit notes reconcile differently from invoices. */
  documentType?: "invoice" | "credit-note" | "debit-note" | "bill-of-entry";
  /** "RCM" where the recipient is liable; those rows are not ITC-matched against 2B. */
  reverseCharge?: boolean;
  hsn?: string;
  rate?: number;
  placeOfSupply?: StateCode;
  itcEligible?: boolean;
}

/** How a 2B line differs from the books line, in the order an officer would ask. */
export type MatchOutcome =
  | "exact"
  | "value-mismatch"
  | "tax-mismatch"
  | "rate-mismatch"
  | "period-mismatch"
  | "duplicate-in-books"
  | "duplicate-in-2b"
  | "missing-in-2b"
  | "missing-in-books"
  | "gstin-mismatch"
  | "reverse-charge"
  | "cancelled-in-2b";

export interface MatchResult {
  outcome: MatchOutcome;
  books?: Invoice;
  gstr2b?: Invoice;
  /** ITC exposed if this row is left as-is, in paise. */
  itcAtRisk: number;
  detail: string;
}
