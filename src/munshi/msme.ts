/**
 * MSME — the 45-day clock that turns a late payment into a tax problem.
 *
 * Section 43B(h) of the Income-tax Act disallows a deduction for any amount payable to a
 * MICRO or SMALL enterprise that is not paid within the time allowed by Section 15 of the
 * MSMED Act — 45 days where there is a written agreement, 15 days where there is none,
 * counted from the date of acceptance of the goods or services.
 *
 * Two details decide whether a computation is right, and both are commonly missed:
 *   · MEDIUM enterprises are NOT covered. Only micro and small. Paying a medium supplier
 *     late is a commercial problem, not a disallowance.
 *   · The clock starts at ACCEPTANCE, not at the invoice date. Where a project accepts
 *     goods weeks after the invoice, the supplier's own invoice date overstates the time
 *     the buyer had — and the buyer is the one carrying the disallowance.
 */
import { type Paise } from "./money";
import { daysBetween } from "./period";

export type EnterpriseClass = "micro" | "small" | "medium" | "not-msme" | "unknown";

/** Udyam classification, in RUPEES of investment and turnover — not paise. */
export function classifyEnterprise(
  sector: "manufacturing" | "services",
  investmentRupees: number,
  turnoverRupees: number,
): EnterpriseClass {
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

export interface PaymentClock {
  dueBy: string;
  daysAllowed: number;
  basis: string;
  covered: boolean;
}

/**
 * The deadline for one bill. `acceptedOn` defaults to the invoice date because that is
 * what most books carry — and the agent warns when it is defaulted, because a wrong
 * acceptance date is the difference between "in time" and "disallowed".
 */
export function paymentDeadline(
  invoiceDate: string,
  enterprise: EnterpriseClass,
  opts: { acceptedOn?: string; writtenAgreement?: boolean } = {},
): PaymentClock {
  const acceptedOn = opts.acceptedOn ?? invoiceDate;
  const daysAllowed = opts.writtenAgreement === false ? 15 : 45;
  const d = new Date(`${acceptedOn}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysAllowed);
  const covered = enterprise === "micro" || enterprise === "small";
  return {
    dueBy: d.toISOString().slice(0, 10),
    daysAllowed,
    covered,
    basis: covered
      ? `s.15 MSMED Act — ${daysAllowed} days from acceptance (${acceptedOn}), disallowance risk under s.43B(h)`
        + (opts.acceptedOn ? "" : " — acceptance date defaulted to the invoice date; confirm it")
      : `s.43B(h) applies only to MICRO and SMALL enterprises — a ${enterprise} supplier is out of scope, `
        + `so lateness here is commercial, not a disallowance`,
  };
}

export interface PayableItem {
  vendor: string;
  gstin?: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: Paise;
  enterprise: EnterpriseClass;
  acceptedOn?: string;
  writtenAgreement?: boolean;
  paidOn?: string;
}

export interface AgeingRow {
  vendor: string;
  invoiceNumber: string;
  dueBy: string;
  daysOverdue: number;
  amount: Paise;
  disallowanceExposure: Paise;
  msme1Reportable: boolean;
  finding: string;
}

export interface AgeingResult {
  rows: AgeingRow[];
  totalOutstanding: Paise;
  totalExposure: Paise;
  msme1Reportable: Paise;
  covered: number;
  notCovered: number;
}

/**
 * Assess every open payable. `disallowanceExposure` is the amount that would be added
 * back to income if the year closed today — the number a CFO needs before the year-end
 * cash call, not after the assessment.
 */
export function assessPayables(items: PayableItem[], asOn: string): AgeingResult {
  const rows: AgeingRow[] = [];
  let totalOutstanding = 0, totalExposure = 0, msme1Reportable = 0, covered = 0, notCovered = 0;

  for (const it of items) {
    const clock = paymentDeadline(it.invoiceDate, it.enterprise, {
      acceptedOn: it.acceptedOn, writtenAgreement: it.writtenAgreement,
    });
    const settled = it.paidOn !== undefined;
    const overdue = settled ? Math.max(0, daysBetween(clock.dueBy, it.paidOn!)) : Math.max(0, daysBetween(clock.dueBy, asOn));
    const outstanding = settled ? 0 : it.amount;
    const exposure = clock.covered && !settled && overdue > 0 ? it.amount : 0;
    // MSME-1 reports outstanding dues to micro/small suppliers beyond 45 days
    const msme1 = clock.covered && !settled && overdue > 0;

    if (clock.covered) covered++; else notCovered++;
    totalOutstanding += outstanding;
    totalExposure += exposure;
    if (msme1) msme1Reportable += outstanding;

    rows.push({
      vendor: it.vendor, invoiceNumber: it.invoiceNumber, dueBy: clock.dueBy,
      daysOverdue: overdue, amount: outstanding, disallowanceExposure: exposure,
      msme1Reportable: msme1,
      finding: settled
        ? (overdue > 0 ? `paid ${overdue} day(s) after the s.15 deadline — the disallowance was avoided `
            + `by payment, but interest may still be owed to the supplier under s.16 MSMED`
          : "paid within the s.15 clock")
        : exposure > 0
          ? `${overdue} day(s) past the s.15 deadline with the bill still open — s.43B(h) disallowance `
            + `of the full amount if the year closes in this state, and MSME-1 reporting is triggered`
          : `open, ${clock.daysAllowed - daysBetween(it.invoiceDate, asOn)} day(s) of the clock remaining`,
    });
  }

  return {
    rows: rows.sort((a, b) => b.daysOverdue - a.daysOverdue),
    totalOutstanding, totalExposure, msme1Reportable, covered, notCovered,
  };
}

/** MSME-1 is half-yearly: 30 April (Oct–Mar) and 31 October (Apr–Sep). */
export function msme1DueDates(financialYear: string): Array<{ half: string; due: string }> {
  const y = Number(financialYear.slice(0, 4));
  return [
    { half: `Apr–Sep ${y}`, due: `${y}-10-31` },
    { half: `Oct ${y}–Mar ${y + 1}`, due: `${y + 1}-04-30` },
  ];
}
