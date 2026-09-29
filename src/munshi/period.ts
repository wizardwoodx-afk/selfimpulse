/**
 * Periods and deadlines — the calendar an Indian finance team actually lives on.
 *
 * The financial year runs 1 April to 31 March, so "2026-27" means 1 Apr 2026 through
 * 31 Mar 2027. Every due-date calculation in the pack goes through here, so a deadline
 * is computed one way and can be argued with once.
 */
import type { FinancialYear, TaxPeriod } from "./types";
import { RULESET } from "./ruleset";

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

/** "2026-08" for an ISO date. */
export function taxPeriodOf(isoDate: string): TaxPeriod {
  return isoDate.slice(0, 7);
}

/** The GST period immediately after the given one. */
export function nextPeriod(period: TaxPeriod): TaxPeriod {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${MONTHS[m]}`;
}

export function periodLabel(period: TaxPeriod): string {
  const [y, m] = period.split("-").map(Number);
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${names[m - 1]} ${y}`;
}

/** Indian financial year containing a date: 1 Apr – 31 Mar. 2026-04-01 → "2026-27". */
export function financialYearOf(isoDate: string): FinancialYear {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function fyStart(fy: FinancialYear): string {
  return `${fy.slice(0, 4)}-04-01`;
}

export function fyEnd(fy: FinancialYear): string {
  const startYear = Number(fy.slice(0, 4));
  return `${startYear + 1}-03-31`;
}

/** The twelve periods of a financial year, April first. */
export function periodsOf(fy: FinancialYear): TaxPeriod[] {
  const startYear = Number(fy.slice(0, 4));
  return [
    ...MONTHS.slice(3).map((m) => `${startYear}-${m}`),
    ...MONTHS.slice(0, 3).map((m) => `${startYear + 1}-${m}`),
  ];
}

export type ReturnKind =
  | "GSTR-1" | "GSTR-1A" | "IFF" | "GSTR-3B" | "GSTR-9" | "GSTR-9C"
  | "GSTR-4" | "GSTR-7" | "GSTR-8" | "CMP-08" | "ITC-04";

export interface DueDate {
  kind: ReturnKind;
  period: TaxPeriod;
  due: string;                 // ISO yyyy-mm-dd
  basis: string;               // why this date
  ruleset: string;
}

/**
 * Statutory due dates for a monthly filer under the normal scheme.
 *
 * QRMP taxpayers file quarterly with IFF for the first two months: 13th for IFF/quarterly
 * GSTR-1, and GSTR-3B on the 22nd or 24th depending on the state group the taxpayer was
 * placed in. Both are supported because getting this wrong is a late fee, not a rounding
 * difference.
 */
export function dueDates(kind: ReturnKind, period: TaxPeriod,
                        scheme: "monthly" | "qrmp" = "monthly",
                        qrmpCategory: "X" | "Y" = "X"): DueDate[] {
  const [y, m] = period.split("-").map(Number);
  const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const day = (d: number, inPeriod = period) => {
    const [py, pm] = inPeriod.split("-").map(Number);
    const nm = pm === 12 ? { y: py + 1, m: 1 } : { y: py, m: pm + 1 };
    return `${nm.y}-${String(nm.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  switch (kind) {
    case "GSTR-1":
      return scheme === "monthly"
        ? [{ kind, period, due: day(11), basis: "Rule 59(1) — 11th of the following month", ruleset: RULESET }]
        : [{ kind, period, due: day(13), basis: "Rule 59(1) proviso — 13th after quarter end (QRMP)", ruleset: RULESET }];
    case "IFF":
      return [{ kind, period, due: day(13), basis: "Rule 59(2) — IFF by the 13th of the next month (QRMP)", ruleset: RULESET }];
    case "GSTR-1A":
      return [{ kind, period, due: day(11), basis: "GSTR-1A is filed before the period's GSTR-3B — corrections must reach the 3B", ruleset: RULESET }];
    case "GSTR-3B":
      if (scheme === "monthly") {
        return [{ kind, period, due: day(20), basis: "Rule 61(1)(i) — 20th of the following month", ruleset: RULESET }];
      }
      return [{
        kind, period,
        due: day(qrmpCategory === "X" ? 22 : 24),
        basis: `Rule 61(1)(ii) — QRMP Category ${qrmpCategory} (${qrmpCategory === "X" ? "22nd" : "24th"})`,
        ruleset: RULESET,
      }];
    case "GSTR-9":
    case "GSTR-9C":
      return [{
        kind, period, due: `${Number(period.slice(0, 4)) + 1}-12-31`,
        basis: "Annual return for the FY ending in this year — due 31 December",
        ruleset: RULESET,
      }];
    case "CMP-08":
      return [{ kind, period, due: day(18), basis: "Rule 61A — composition quarterly statement by the 18th", ruleset: RULESET }];
    case "GSTR-4":
      return [{ kind, period, due: `${Number(period.slice(0, 4)) + 1}-06-30`, basis: "Rule 62 — annual composition return by 30 June", ruleset: RULESET }];
    case "ITC-04":
      return [{ kind, period, due: day(25), basis: "Rule 45 — job-work statement (half-yearly / annual by turnover)", ruleset: RULESET }];
    case "GSTR-7":
      return [{ kind, period, due: day(10), basis: "Rule 66 — TDS deductor return by the 10th", ruleset: RULESET }];
    case "GSTR-8":
      return [{ kind, period, due: day(10), basis: "Rule 67 — e-commerce operator return by the 10th", ruleset: RULESET }];
    default:
      void nextMonth;
      return [];
  }
}

/** Whole days between two ISO dates, b = later. Negative when b precedes a. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function daysOverdue(due: string, asOn: string): number {
  return Math.max(0, daysBetween(due, asOn));
}
