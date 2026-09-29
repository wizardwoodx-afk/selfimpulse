/**
 * Money — integer paise, never floating point.
 *
 * 0.1 + 0.2 !== 0.3 in binary floating point, and a tax engine that inherits that error
 * produces returns that do not tie out. Every amount in this pack is an integer count of
 * paise (`type Paise = number`), and the only place a float is ever touched is parsing
 * human input and formatting for display. ₹1,23,456.78 is 12345678 paise, exactly.
 *
 * `Number.isSafeInteger` covers 9.007e15, i.e. about ₹90 trillion in paise — beyond any
 * single taxpayer's turnover, so a plain number is sound here and BigInt would only cost
 * ergonomics.
 */

/** An exact count of paise. Never fractional. */
export type Paise = number;

export const ZERO: Paise = 0;

export function paise(n: number): Paise {
  if (!Number.isFinite(n)) throw new Error(`munshi/money: not a finite amount: ${n}`);
  return Math.round(n);
}

export function rupeesToPaise(rupees: number): Paise {
  return paise(rupees * 100);
}

export function add(...amounts: Paise[]): Paise {
  return amounts.reduce((a, b) => a + b, 0);
}

export function sub(a: Paise, b: Paise): Paise {
  return a - b;
}

/** Multiply by a plain quantity (line item count, months) with half-up rounding. */
export function times(a: Paise, qty: number): Paise {
  return paise(a * qty);
}

/** Apply a rate expressed in percent, e.g. `rate(1000, 18)` = 180. Half-up. */
export function rate(amount: Paise, percent: number): Paise {
  return paise((amount * percent) / 100);
}

/**
 * Section 170, CGST Act: tax, interest and penalty are rounded to the nearest rupee
 * (50 paise rounds up). Use this at the invoice line and at the return total — doing it
 * in both places and then reconciling the difference is how a return ties out.
 */
export function roundToRupee(amount: Paise): Paise {
  return Math.round(amount / 100) * 100;
}

/** Intra-state split: CGST and SGST each get half, and the halves must sum exactly. */
export function splitIntraState(tax: Paise): { cgst: Paise; sgst: Paise } {
  const half = Math.floor(tax / 2);
  return { cgst: half, sgst: tax - half };   // remainder to SGST so the total is exact
}

/** Group in the Indian system: last three digits, then pairs — 12,34,567.89 */
export function formatINR(amount: Paise, opts: { symbol?: boolean; paisePart?: boolean } = {}): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const s = String(whole);
  let grouped: string;
  if (s.length <= 3) {
    grouped = s;
  } else {
    const head = s.slice(0, s.length - 3);
    const tail = s.slice(s.length - 3);
    grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + tail;
  }
  const dec = opts.paisePart === false ? "" : `.${String(frac).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${opts.symbol === false ? "" : "₹"}${grouped}${dec}`;
}

/** Compact crore/lakh form for dashboards: ₹1.23 Cr, ₹4.50 L, ₹12,345 */
export function formatCompact(amount: Paise): string {
  const rupees = Math.abs(amount) / 100;
  const sign = amount < 0 ? "-" : "";
  if (rupees >= 1e7) return `${sign}₹${(rupees / 1e7).toFixed(2)} Cr`;
  if (rupees >= 1e5) return `${sign}₹${(rupees / 1e5).toFixed(2)} L`;
  if (rupees >= 1e3) return `${sign}₹${(rupees / 1e3).toFixed(1)}k`;
  return formatINR(amount);
}

/**
 * Parse what accountants actually type and what Tally / Zoho / Busy actually export:
 * "1,23,456.78", "123456.78", "₹ 1,23,456", "-4500", "12L", "1.25 Cr", "(1,200)".
 * Returns null rather than throwing — input cleaning is a workflow, and the agent that
 * cleans it reports the rejects, while the engine stays strict.
 */
export function parseAmount(input: string): Paise | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  if (s === "") return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }        // (1,200) = -1200
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  s = s.replace(/[₹,\s]/g, "");

  const word = s.match(/^([0-9]*\.?[0-9]+)(cr|crore|l|lakh|lac|lacs|k)$/i);
  if (word) {
    const n = Number(word[1]);
    if (!Number.isFinite(n)) return null;
    const unit = word[2].toLowerCase();
    const mult = unit.startsWith("cr") ? 1e7 : unit.startsWith("l") ? 1e5 : 1e3;
    const value = rupeesToPaise(n * mult);
    return negative ? -value : value;
  }

  if (!/^[0-9]*\.?[0-9]+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const value = rupeesToPaise(n);
  return negative ? -value : value;
}

/** Parse a percentage that may arrive as "18", "18%", "18.0". */
export function parseRate(input: string | number): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const m = String(input).trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*%?$/);
  return m ? Number(m[1]) : null;
}
