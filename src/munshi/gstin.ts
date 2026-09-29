/**
 * GSTIN — structural validation, checksum, and what the number actually encodes.
 *
 * The most common data-quality defect in an Indian purchase register is a GSTIN that
 * cannot exist: a transposed character, a wrong state code, a PAN embedded in the wrong
 * case. A checksum catches all three before the invoice is booked, which is why this is
 * the first gate every Munshi agent runs on any counterparty.
 *
 * Structure (CGST Rules, Rule 10):
 *   1–2   state code          (see STATE_CODES)
 *   3–12  PAN of the holder   (10 chars, its own format)
 *   13    entity number       (1–9 for the same PAN in the same state, else A–Z)
 *   14    "Z" by default      (reserved)
 *   15    check character     (base-36 checksum over the first 14)
 */
import type { StateCode, StateName } from "./types";

const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** State / UT codes as issued. 25 and 28 are retired; 26 and 37 replaced them. */
export const STATE_CODES: Readonly<Record<string, string>> = Object.freeze({
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman and Diu (merged into 26)", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "28": "Andhra Pradesh (pre-bifurcation)", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
});

/** PAN's 4th character states what kind of holder it is. */
const PAN_HOLDER: Readonly<Record<string, string>> = Object.freeze({
  P: "Individual", C: "Company", H: "Hindu Undivided Family", F: "Firm / LLP",
  A: "Association of Persons", T: "Trust", B: "Body of Individuals",
  L: "Local Authority", J: "Artificial Juridical Person", G: "Government",
});

export interface GstinParts {
  gstin: string;
  stateCode: StateCode;
  state: StateName;
  pan: string;
  holderType: string;
  entityNumber: string;
  /** Two taxpayers can share a PAN only by differing here — it is the dedupe key. */
  registrationKey: string;
}

export type GstinVerdict =
  | { ok: true; parts: GstinParts }
  | { ok: false; code: GstinFailure; detail: string };

export type GstinFailure =
  | "length" | "characters" | "state-code" | "pan-format" | "entity-number"
  | "reserved-char" | "checksum";

/** Recompute the 15th character from the first 14. The algorithm is the published one. */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = BASE36.indexOf(first14.charAt(i).toUpperCase());
    if (value < 0) return "?";
    const factor = i % 2 === 0 ? 1 : 2;
    const product = value * factor;
    // base-36 digit sum: a two-digit product contributes quotient + remainder
    sum += Math.floor(product / 36) + (product % 36);
  }
  return BASE36.charAt((36 - (sum % 36)) % 36);
}

/** Validate a PAN in isolation (it appears inside the GSTIN and on its own in 26AS). */
export function validatePan(pan: string): { ok: boolean; holderType?: string; code?: string } {
  const p = String(pan ?? "").trim().toUpperCase();
  if (p.length !== 10) return { ok: false, code: "pan-length" };
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p)) return { ok: false, code: "pan-format" };
  const kind = PAN_HOLDER[p.charAt(3)];
  if (!kind) return { ok: false, code: "pan-holder-type" };
  return { ok: true, holderType: kind };
}

/**
 * Full validation. Order matters: report the FIRST structural failure, because a
 * transposed character usually breaks the state code or the PAN long before the
 * checksum, and telling an operator "checksum failed" when the state code is "0Q" sends
 * them looking in the wrong place.
 */
export function validateGstin(input: string): GstinVerdict {
  const g = String(input ?? "").trim().toUpperCase().replace(/\s/g, "");
  if (g.length !== 15) return { ok: false, code: "length", detail: `${g.length} characters, expected 15` };
  if (!/^[0-9A-Z]+$/.test(g)) return { ok: false, code: "characters", detail: "ASCII letters and digits only" };

  const stateCode = g.slice(0, 2);
  const state = STATE_CODES[stateCode];
  if (!state) return { ok: false, code: "state-code", detail: `${stateCode} is not an issued state code` };

  const pan = g.slice(2, 12);
  const panCheck = validatePan(pan);
  if (!panCheck.ok) return { ok: false, code: "pan-format", detail: `embedded PAN ${pan} — ${panCheck.code}` };

  const entityNumber = g.charAt(12);
  if (!/^[0-9A-Z]$/.test(entityNumber)) {
    return { ok: false, code: "entity-number", detail: `entity number ${entityNumber} is not 1–9 or A–Z` };
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
      gstin: g, stateCode, state, pan, holderType: panCheck.holderType ?? "Unknown",
      entityNumber, registrationKey: `${pan}/${stateCode}/${entityNumber}`,
    },
  };
}

export function isValidGstin(input: string): boolean {
  return validateGstin(input).ok;
}

/**
 * One-line human answer for a spreadsheet cell: "valid · Tamil Nadu · Company" or the
 * first thing that is wrong. Agents print this instead of a boolean so an operator can
 * act on it without opening a debugger.
 */
export function explainGstin(input: string): string {
  const v = validateGstin(input);
  if (v.ok) {
    const p = v.parts;
    return `valid · ${p.state} (${p.stateCode}) · ${p.holderType} · entity ${p.entityNumber}`;
  }
  return `INVALID (${v.code}) — ${v.detail}`;
}

/** The same taxpayer on two invoices must resolve to one vendor — this is the key. */
export function vendorKey(gstin: string): string | null {
  const v = validateGstin(gstin);
  return v.ok ? v.parts.registrationKey : null;
}
