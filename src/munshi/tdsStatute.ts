/**
 * The TDS statute transition — which Act governs a deduction, and under what reference.
 *
 * THE PROBLEM THIS SOLVES. Rates and thresholds did not change on 1 April 2026, but the
 * LAW DID. The Income-tax Act, 2025 replaced the 1961 Act for the earlier of the date of
 * credit or the date of payment falling on or after that date. The old 194-series labels
 * are gone from the statute: resident TDS is now a table inside s.393, salary is s.392,
 * and TCS is s.394. Quoting "194C" for an April-2026 transaction is not a stylistic slip
 * — the returns carry the new section reference and the department's validation utility
 * rejects the old one.
 *
 * So an engine that accepts only a section number and computes a rate is answering half
 * the question, and the half it answers is the half that did not change. This module
 * answers the half that did: given the earlier of credit or payment, it names the Act,
 * the section reference to quote, the table item, the payment code where published, and
 * the cross-reference to the other Act's label.
 *
 * HOW THE REFERENCES ARE HELD. Two confidence levels, and they are not decoration:
 *   · "asserted"  — the section and the table item are corroborated across several
 *                   independent published mappings; safe to print.
 *   · "reported"  — published, but either provisional in the source or not agreed across
 *                   sources. Printed WITH the disagreement named, never silently chosen.
 *   · "unmapped"  — this ruleset does not carry a mapping for the section. The engine says
 *                   so rather than inventing a table item. A fabricated table reference
 *                   would validate against nothing and waste an accountant's afternoon.
 *
 * The rates and thresholds themselves stay in tds.ts: they are unchanged by the
 * transition, and keeping them in one place is what stops the two Acts' tables drifting
 * apart in code that is supposed to be the same arithmetic.
 */

/** Which Act governs the deduction. */
export type Statute = "1961" | "2025";

/** 1 April 2026 — the first day the 2025 Act governs TDS. */
export const TDS_TRANSITION_DATE = "2026-04-01";

const ACT_NAME: Readonly<Record<Statute, string>> = Object.freeze({
  "1961": "Income-tax Act, 1961",
  "2025": "Income-tax Act, 2025",
});

/** A published mapping from a 1961-Act section to its 2025-Act reference. */
interface Mapping {
  /** 2025-Act section, e.g. "393(1)". */
  section: string;
  /** Table item inside that section, e.g. "Sl. 6(i).D(b)" — null where not corroborated. */
  tableRef: string | null;
  /** Four-digit payment code carried on the challan / return, where sources agree. */
  paymentCode: number | null;
  /** Where a source disagrees on a sub-entry, the disagreement is recorded here. */
  note?: string;
}

/**
 * The mapping table. Corroborated across published FY 2026-27 mappings (taxguru,
 * onefinops, terra-insight, goforfiling, and the practitioner notes on individual
 * sections). Where they agree, "asserted"; where they disagree, the field is left null
 * and the disagreement is named in `note`.
 */
const MAPPINGS: Readonly<Record<string, Mapping>> = Object.freeze({
  // ── salary ────────────────────────────────────────────────────────────────
  "192":   { section: "392", tableRef: null, paymentCode: null },
  "192A":  { section: "392(7)", tableRef: null, paymentCode: 1004 },

  // ── 393(1): residents, one table, eight categories ────────────────────────
  "193":   { section: "393(1)", tableRef: "Sl. 5(i)", paymentCode: 1019 },
  "194":   { section: "393(1)", tableRef: "Sl. 7", paymentCode: 1029 },
  "194A":  { section: "393(1)", tableRef: "Sl. 5(ii).D(a) senior / 5(ii).D(b) other / 5(iii) non-bank",
             paymentCode: null,
             note: "the three 194A populations (senior ₹1,00,000, other ₹50,000, non-bank ₹10,000) map to "
                 + "three separate table entries with codes 1020 / 1021 / 1022 — the entry follows the payer, "
                 + "not this table row" },
  "194C":  { section: "393(1)", tableRef: "Sl. 6(i).D(a) individual/HUF · 6(i).D(b) other",
             paymentCode: null,
             note: "codes 1023 (1%, individual/HUF payee) and 1024 (2%, any other payee) — the code follows "
                 + "the payee, so this row carries both references" },
  "194D":  { section: "393(1)", tableRef: "Sl. 1(i)", paymentCode: 1005 },
  "194DA": { section: "393(1)", tableRef: "Sl. 8(i)", paymentCode: 1030 },
  "194H":  { section: "393(1)", tableRef: "Sl. 1(ii)", paymentCode: 1006 },
  "194-I(a)": { section: "393(1)", tableRef: "Sl. 2(ii).D(a)", paymentCode: 1008 },
  "194-I(b)": { section: "393(1)", tableRef: "Sl. 2(ii).D(b)", paymentCode: 1009 },
  "194-IA": { section: "393(1)", tableRef: null, paymentCode: null,
              note: "no table item for the transfer-of-immovable-property deduction is corroborated in the "
                  + "sources this ruleset carries — do not quote one until the utility master confirms it" },
  "194-IB": { section: "393(1)", tableRef: "Sl. 2(i)", paymentCode: 1007,
              note: "the payment code for this entry is published as PROVISIONAL pending CBDT's final master; "
                  + "treat 1007 as unconfirmed" },
  "194-IC": { section: "393(1)", tableRef: "Sl. 3(ii)", paymentCode: 1011 },
  "194J(a)": { section: "393(1)", tableRef: "Sl. 6(iii).D(a)", paymentCode: 1026 },
  "194J(b)": { section: "393(1)", tableRef: "Sl. 6(iii).D(b)", paymentCode: 1027 },
  "194K":  { section: "393(1)", tableRef: "Sl. 4(i)", paymentCode: 1013 },
  "194LA": { section: "393(1)", tableRef: "Sl. 3(iii)", paymentCode: 1012 },
  "194M":  { section: "393(1)", tableRef: null, paymentCode: null,
             note: "not corroborated in the mappings this ruleset carries" },
  "194-O": { section: "393(1)", tableRef: "Sl. 8(v)", paymentCode: 1035 },
  "194Q":  { section: "393(1)", tableRef: "Sl. 8(ii)", paymentCode: 1031 },
  "194R":  { section: "393(1)", tableRef: "Sl. 8(iv)", paymentCode: null,
             note: "sources disagree on the sub-codes for cash (1033 per one, 1034 per another) and in-kind "
                 + "benefit — the table item is agreed, the code is not, so no code is asserted" },
  "194S":  { section: "393(1)", tableRef: "Sl. 8(vi)", paymentCode: 1037 },

  // ── 393(3): payments to any person ────────────────────────────────────────
  "194B":  { section: "393(3)", tableRef: "Sl. 1", paymentCode: 1058 },
  "194BA": { section: "393(3)", tableRef: "Sl. 2", paymentCode: 1060 },
  "194G":  { section: "393(3)", tableRef: "Sl. 4", paymentCode: 1063 },
  "194N":  { section: "393(3)", tableRef: "Sl. 5", paymentCode: null,
             note: "the code splits by the filer's own status (1064 / 1065) and by whether the payee has "
                 + "filed returns — the table item is agreed, the code is not fixed" },
  "194T":  { section: "393(3)", tableRef: "Sl. 7", paymentCode: 1067 },

  // ── 393(2): non-residents ─────────────────────────────────────────────────
  "195":   { section: "393(2)", tableRef: "Sl. 17", paymentCode: 1057 },
});

/**
 * TCS keeps its own section number for the transition: 206C becomes s.394. The published
 * codes disagree between sources, so none is asserted — the section and its continuity
 * are, and that is what the return needs before the code.
 */
const TCS_MAPPING: Readonly<Record<string, Mapping>> = Object.freeze({
  "206C(1)":  { section: "394", tableRef: null, paymentCode: null },
  "206C(1F)": { section: "394", tableRef: null, paymentCode: null },
  "206C(1G)": { section: "394", tableRef: null, paymentCode: null },
  "206C(1H)": { section: "394", tableRef: null, paymentCode: null,
                note: "206C(1H) was repealed from 1 April 2025 and is carried in this pack as a repeal "
                    + "notice; it has no successor entry to quote" },
});

export type ReferenceConfidence = "asserted" | "reported" | "unmapped";

export interface StatuteReference {
  /** Which Act governs this deduction. */
  statute: Statute;
  act: string;
  /** The section reference to QUOTE for this transaction. */
  section: string;
  /** Table item inside s.393, where corroborated. */
  tableRef: string | null;
  /** Challan / return payment code, where sources agree. */
  paymentCode: number | null;
  /** The other Act's label for the same deduction — the cross-reference an accountant reads. */
  crossReference: string;
  confidence: ReferenceConfidence;
  basis: string;
}

export interface StatuteRouting {
  statute: Statute;
  act: string;
  basis: string;
}

/**
 * Which Act governs. The test is the earlier of the date of credit and the date of
 * payment — not the date the challan is paid, not the date the return is filed. A March
 * credit paid in April stays under the 1961 Act; an April credit uses the 2025 Act.
 */
export function statuteForEvent(earlierOfCreditOrPayment: string): StatuteRouting {
  const iso = earlierOfCreditOrPayment.trim();
  const newAct = iso >= TDS_TRANSITION_DATE;      // ISO dates compare lexically
  return newAct
    ? { statute: "2025", act: ACT_NAME["2025"],
        basis: `${iso} is on or after ${TDS_TRANSITION_DATE} — the earlier of credit or payment falls under `
             + `the ${ACT_NAME["2025"]}, where resident TDS is s.393, salary is s.392 and TCS is s.394` }
    : { statute: "1961", act: ACT_NAME["1961"],
        basis: `${iso} is before ${TDS_TRANSITION_DATE} — the earlier of credit or payment falls under the `
             + `${ACT_NAME["1961"]}, so the 194-series reference applies even if the payment or the challan `
             + `lands after the changeover` };
}

/**
 * The full reference for one deduction. `kind` selects the TDS or TCS table; the TDS table
 * is the default because that is where the transition bites.
 */
export function statuteReference(
  section: string,
  earlierOfCreditOrPayment: string,
  kind: "tds" | "tcs" = "tds",
): StatuteReference {
  const routing = statuteForEvent(earlierOfCreditOrPayment);
  const mapping = (kind === "tcs" ? TCS_MAPPING : MAPPINGS)[section];

  // Pre-transition: the old section IS the reference; the new one is the cross-reference.
  if (routing.statute === "1961") {
    const forward = mapping
      ? `under the 2025 Act this becomes s.${mapping.section}`
        + (mapping.tableRef ? `, Table ${mapping.tableRef}` : "")
        + (mapping.paymentCode ? `, payment code ${mapping.paymentCode}` : "")
      : "this ruleset carries no 2025-Act mapping for this section";
    return {
      statute: "1961",
      act: routing.act,
      section,
      tableRef: null,
      paymentCode: null,
      crossReference: `${section} — ${forward}`,
      confidence: mapping ? "asserted" : "unmapped",
      basis: `s.${section} of the ${ACT_NAME["1961"]} — ${routing.basis}`,
    };
  }

  // Post-transition with no mapping: say so, and keep the old label as the cross-reference.
  if (!mapping) {
    return {
      statute: "2025",
      act: routing.act,
      section,
      tableRef: null,
      paymentCode: null,
      crossReference: `former s.${section} of the ${ACT_NAME["1961"]}`,
      confidence: "unmapped",
      basis: `${routing.basis}. WARNING: this ruleset carries no ${ACT_NAME["2025"]} reference for `
           + `s.${section} — the rate is computed, the section reference to quote is NOT asserted here. `
           + `Confirm the table item against the department's validation master before filing.`,
    };
  }

  /* Confidence is decided by how much of the reference this ruleset actually carries:
       no table item and no code        → "unmapped": there is nothing to quote beyond the section
       a partial reference, or a note   → "reported": published, but not agreed or not final
       a full, corroborated reference   → "asserted" */
  const hasReference = mapping.tableRef !== null || mapping.paymentCode !== null;
  const confidence: ReferenceConfidence = !hasReference ? "unmapped" : mapping.note ? "reported" : "asserted";
  return {
    statute: "2025",
    act: routing.act,
    section: mapping.section,
    tableRef: mapping.tableRef,
    paymentCode: mapping.paymentCode,
    crossReference: `corresponds to former s.${section} of the ${ACT_NAME["1961"]}`,
    confidence,
    basis: `s.${mapping.section} of the ${ACT_NAME["2025"]}`
         + (mapping.tableRef ? `, Table ${mapping.tableRef}` : "")
         + (mapping.paymentCode ? `, payment code ${mapping.paymentCode}` : "")
         + ` — ${routing.basis}`
         + (mapping.note ? `. ${mapping.note}` : "")
         + (confidence === "unmapped"
             ? ". The section is asserted; the TABLE ITEM is not — confirm it against the department's "
             + "validation master before filing"
             : ""),
  };
}

/** One line an operator can read off a screen or a spreadsheet cell. */
export function explainStatuteReference(ref: StatuteReference): string {
  const bits = [`${ref.act} · s.${ref.section}`];
  if (ref.tableRef) bits.push(`Table ${ref.tableRef}`);
  if (ref.paymentCode !== null) bits.push(`code ${ref.paymentCode}`);
  bits.push(`(${ref.confidence})`);
  return bits.join(" · ");
}

/** The form the return is filed in, with the transition's own caveat. */
export function returnFormFor(section: string, earlierOfCreditOrPayment: string): {
  form: string; certificate: string; confidence: ReferenceConfidence; basis: string;
} {
  const routing = statuteForEvent(earlierOfCreditOrPayment);
  if (routing.statute === "1961") {
    const salary = section === "192";
    return {
      form: salary ? "24Q" : "26Q",
      certificate: salary ? "Form 16" : "Form 16A",
      confidence: "asserted",
      basis: `quarterly statements under the ${ACT_NAME["1961"]}: Form 24Q (salary) / 26Q (non-salary), `
           + `certificates Form 16 / 16A`,
    };
  }
  return {
    form: section === "192" ? "not asserted" : "140",
    certificate: section === "192" ? "not asserted" : "131",
    confidence: "reported",
    basis: `quarterly statements move to the 2025 Act's own numbering — Form 140 for non-salary TDS and `
         + `Form 131 for the certificate are the forms reported in practice, but this ruleset does NOT `
         + `assert them: sources disagree (some still cite 26Q), and the department's utility master is `
         + `the authority. The section reference above is the part that is asserted.`,
  };
}
