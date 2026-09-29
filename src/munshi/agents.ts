/**
 * The Munshi roster — 47 specialists.
 *
 * Each entry says what it computes, which engine it calls, what it takes in, what it
 * returns, whether a human gate stands at the end, and what 11Handle signs when it
 * finishes. Nothing here is a prompt dressed as a product: `status` is honest.
 *
 *   status "engine"    → the deterministic computation is implemented in this pack and is
 *                        covered by probe/munshi.test.ts. It works today, offline.
 *   status "workflow"  → the steps are declared and they call the engines, but the full
 *                        pass (document intake, judgement, drafting) is assembled per
 *                        engagement. It is a plan with named parts, not a claim of a
 *                        finished pipeline.
 *
 * Agents that end in a filing or a payment carry `requiresApproval: true`. That is not
 * politeness: a specialist that can file is a specialist that can create a liability, and
 * the 11Handle gate is the reason an operator can run forty of them unattended.
 */
import { RULESET } from "./ruleset";

export type Domain =
  | "gst-output" | "gst-itc" | "gst-compliance" | "tds"
  | "msme" | "banking-ops" | "assurance" | "reporting";

export interface Agent {
  id: string;
  name: string;
  domain: Domain;
  purpose: string;
  /** Exported function that performs the computation. */
  engine: string;
  inputs: string;
  output: string;
  /** True where the last step touches a portal, a payment or a filed document. */
  requiresApproval: boolean;
  /** What the 11Handle receipt attests when the agent completes. */
  receipt: string;
  status: "engine" | "workflow";
}

const A = (a: Agent): Agent => a;

export const AGENTS: readonly Agent[] = Object.freeze([
  // ── GST · outward ───────────────────────────────────────────────────────────
  A({ id: "gst.gstr1-preparer", name: "GSTR-1 Preparer", domain: "gst-output", status: "engine",
      purpose: "Assemble a section-wise GSTR-1 draft from the sales register, including B2CL split and rate-wise summary.",
      engine: "buildGstr1", inputs: "sales register rows (GSTIN, invoice no, date, taxable, tax, POS, rate)",
      output: "GSTR-1 sections 4A/5A/7/9B with a rate-wise summary and data-quality notes",
      requiresApproval: true, receipt: "GSTR-1 draft + input hash, approved before filing" }),
  A({ id: "gst.gstr3b-preparer", name: "GSTR-3B Preparer", domain: "gst-output", status: "engine",
      purpose: "Build the 3B position from GSTR-1 totals and the ITC reconciliation, with reversals kept separate from availment.",
      engine: "buildGstr3b", inputs: "GSTR-1 draft, ITC available, ITC reversed",
      output: "3B position: outward tax, ITC availed, ITC reversed, net cash payable",
      requiresApproval: true, receipt: "3B position + the ITC evidence it was built from" }),
  A({ id: "gst.hardlock-crosswalk", name: "Hard-lock Crosswalk", domain: "gst-output", status: "engine",
      purpose: "Compare what GSTR-1 reports with what GSTR-3B says and name the only legal correction path for each gap.",
      engine: "hardLockCrosswalk", inputs: "GSTR-1 draft, GSTR-3B draft",
      output: "table-by-table findings with the correction route (GSTR-1 or GSTR-1A — never an edit in 3B)",
      requiresApproval: false, receipt: "crosswalk result against a named ruleset" }),
  A({ id: "gst.pos-analyser", name: "Place of Supply Analyser", domain: "gst-output", status: "engine",
      purpose: "Decide IGST versus CGST+SGST from the supplier state and place of supply, and flag exports.",
      engine: "placeOfSupply", inputs: "supplier state code, place of supply, taxable value, rate",
      output: "tax head with the section basis, and the zero-rated route for exports",
      requiresApproval: false, receipt: "tax-head determination, per invoice" }),
  A({ id: "gst.rate-migration-audit", name: "Rate Migration Audit", domain: "gst-output", status: "engine",
      purpose: "Find invoices still charging the abolished 12% or 28% rates after 22 September 2025.",
      engine: "isLegacyRate + rateForHsn", inputs: "invoice lines with HSN/SAC and rate",
      output: "legacy-rate findings with the indicative current rate and a classification caveat",
      requiresApproval: false, receipt: "audit of rates against the live ruleset" }),
  A({ id: "gst.credit-note-agent", name: "Credit / Debit Note Agent", domain: "gst-output", status: "workflow",
      purpose: "Track notes as their own population, including the 24-hour IRN cancellation window and the effect on the recipient's credit.",
      engine: "checkIrnCancellationWindow", inputs: "note register, IRN timestamps",
      output: "note-by-note status and the filing treatment, with cancellations flagged as no longer possible",
      requiresApproval: true, receipt: "note population with cancellation windows evaluated" }),
  A({ id: "gst.export-refund-watch", name: "Export Refund Watch", domain: "gst-output", status: "workflow",
      purpose: "Track zero-rated supplies, LUT validity and RFD-01 refund claims built on shipping bills and IRNs.",
      engine: "placeOfSupply (export branch)", inputs: "shipping bills, LUT, e-BRC, RFD-01 acknowledgements",
      output: "refund pipeline with the documents each claim is still missing",
      requiresApproval: true, receipt: "refund status against the underlying document set" }),

  // ── GST · input tax credit ──────────────────────────────────────────────────
  A({ id: "gst.itc-2b-recon", name: "GSTR-2B Reconciliation", domain: "gst-itc", status: "engine",
      purpose: "Match the purchase register against GSTR-2B in passes, classify every difference and quantify the ITC at risk.",
      engine: "reconcile", inputs: "purchase register, GSTR-2B extract (or IMS feed)",
      output: "match results by outcome, ITC at risk, ITC unclaimed, prioritised findings",
      requiresApproval: false, receipt: "reconciliation over both populations, hashed" }),
  A({ id: "gst.itc-2a-legacy", name: "GSTR-2A Legacy Reconciliation", domain: "gst-itc", status: "engine",
      purpose: "Reconcile older periods where the counterparty return was GSTR-2A, with its different matching behaviour.",
      engine: "reconcile", inputs: "purchase register, GSTR-2A extract",
      output: "the same classification, annotated for the pre-2B regime",
      requiresApproval: false, receipt: "legacy-period reconciliation" }),
  A({ id: "gst.ims-actioning", name: "IMS Actioning", domain: "gst-itc", status: "workflow",
      purpose: "Decide accept / reject / pending for every record in the Invoice Management System, because the decision drives the recipient's own 2B.",
      engine: "reconcile (to find the records needing a decision)", inputs: "IMS feed, purchase register",
      output: "an actioning list with the reason for each decision, and the ones a human must judge",
      requiresApproval: true, receipt: "IMS decisions taken, with the basis for each" }),
  A({ id: "gst.blocked-credit-audit", name: "Blocked Credit Audit", domain: "gst-itc", status: "workflow",
      purpose: "Screen the credit register against the s.17(5) blocked list — motor vehicles, food, memberships, personal use.",
      engine: "rule table + reconcile (to size the population)", inputs: "credit register with expense heads",
      output: "blocked-credit findings with the section cited, and the reversal amount",
      requiresApproval: true, receipt: "blocked-credit screen over a named population" }),
  A({ id: "gst.itc-timebar-watch", name: "ITC Time-bar Watch", domain: "gst-itc", status: "engine",
      purpose: "Count down to the s.16(4) deadline — credit unclaimed after 30 November of the following year is a write-off.",
      engine: "itcTimeBarred", inputs: "open credit items with invoice dates",
      output: "a countdown with the lapse date and the exposure, per financial year",
      requiresApproval: false, receipt: "time-bar assessment at a named date" }),
  A({ id: "gst.rcm-controller", name: "Reverse Charge Controller", domain: "gst-itc", status: "engine",
      purpose: "Pair the self-assessed RCM liability with the credit on it, in the same period, and keep RCM rows out of 2B matching.",
      engine: "reconcile (RCM branch) + buildGstr3b", inputs: "inward supplies flagged RCM, tax paid",
      output: "RCM liability and matching credit, with any unpaired amount called out",
      requiresApproval: true, receipt: "RCM liability paired with its credit in one period" }),
  A({ id: "gst.isd-allocator", name: "ISD Credit Allocator", domain: "gst-itc", status: "workflow",
      purpose: "Distribute common input services credit across GSTINs on a defensible turnover-based formula.",
      engine: "money (exact allocation) + returns (per-GSTIN totals)", inputs: "common invoices, turnover by GSTIN",
      output: "ISD-1 allocation with the formula, the rounding and the residual treatment",
      requiresApproval: true, receipt: "allocation schedule that sums exactly to the credit" }),
  A({ id: "gst.drc03-drafter", name: "DRC-03 Drafter", domain: "gst-itc", status: "engine",
      purpose: "Compute tax, interest and penalty for a voluntary payment before a notice arrives.",
      engine: "interestOnLateTax + lateFee", inputs: "period, unpaid tax, payment date",
      output: "the three components with their bases, ready for a human to pay",
      requiresApproval: true, receipt: "voluntary payment computation, per component" }),

  // ── GST · compliance clocks and returns ─────────────────────────────────────
  A({ id: "gst.einvoice-30day", name: "E-invoice 30-day Window", domain: "gst-compliance", status: "engine",
      purpose: "Watch the 30-day IRP reporting limit above a ₹10 crore AATO and warn before the IRN becomes impossible.",
      engine: "checkIrnWindow", inputs: "invoice dates, aggregate turnover, as-on date",
      output: "per-document window status, with a 7-day early warning band",
      requiresApproval: false, receipt: "window assessment per document" }),
  A({ id: "gst.irn-validator", name: "IRN Pre-flight Validator", domain: "gst-compliance", status: "workflow",
      purpose: "Validate a document against the IRP's mandatory-field rules before the call, so a rejection does not cost a day.",
      engine: "eInvoiceStatus + validateGstin", inputs: "invoice payload",
      output: "field-level failures, with the ones that block an IRN separated from the ones that warn",
      requiresApproval: false, receipt: "pre-flight result before submission" }),
  A({ id: "gst.eway-validity", name: "E-way Bill Validity", domain: "gst-compliance", status: "engine",
      purpose: "Compute validity from distance and cargo type, and flag consignments travelling on expired documents.",
      engine: "ewayBillValidity", inputs: "distance, cargo type, generation timestamp, movement status",
      output: "validity in days with the rule cited, and expired-consignment findings",
      requiresApproval: false, receipt: "validity computation with the rule basis" }),
  A({ id: "gst.latefee-interest", name: "Late Fee & Interest", domain: "gst-compliance", status: "engine",
      purpose: "Compute s.47 late fees with the turnover cap applied, and s.50 interest on net cash liability as Rule 88B requires.",
      engine: "lateFee + interestOnLateTax", inputs: "return kind, due date, filing date, turnover class, unpaid tax",
      output: "fee and interest with days, rate, cap and the basis string",
      requiresApproval: false, receipt: "statutory computation of fee and interest" }),
  A({ id: "gst.deadline-radar", name: "Deadline Radar", domain: "gst-compliance", status: "engine",
      purpose: "One calendar across monthly, QRMP, IFF, annual and composition obligations for every GSTIN in the group.",
      engine: "dueDates + periodsOf", inputs: "GSTINs, scheme, category, as-on date",
      output: "a dated obligation list with days remaining",
      requiresApproval: false, receipt: "obligation calendar at a named date" }),
  A({ id: "gst.gstr9-annual", name: "Annual Return Reconciler", domain: "gst-compliance", status: "workflow",
      purpose: "Reconcile a full year: books versus GSTR-1 versus GSTR-3B versus 2B, and prepare GSTR-9 / 9C positions.",
      engine: "reconcile + buildGstr1 + hardLockCrosswalk (annualised)",
      inputs: "twelve periods of books, returns and 2B data",
      output: "annual reconciliation with the differences classified and the 9C impact",
      requiresApproval: true, receipt: "annual reconciliation across four populations" }),
  A({ id: "gst.asmt10-responder", name: "ASMT-10 Responder", domain: "gst-compliance", status: "workflow",
      purpose: "Read a scrutiny notice, locate each disputed figure in the records, and draft a point-by-point reply with annexures.",
      engine: "reconcile (to reproduce the disputed figures)", inputs: "ASMT-10, the periods it refers to, source records",
      output: "a reply draft with each paragraph tied to a recomputation and its evidence",
      requiresApproval: true, receipt: "notice response with an evidence link per allegation" }),
  A({ id: "gst.notice-tracker", name: "Notice Tracker", domain: "gst-compliance", status: "workflow",
      purpose: "Track notices, show-cause notices and orders with their reply deadlines and escalation state.",
      engine: "period (deadline arithmetic)", inputs: "notice register",
      output: "an ageing list with days to reply and the owner named",
      requiresApproval: false, receipt: "notice register state at a named date" }),

  // ── TDS / TCS ───────────────────────────────────────────────────────────────
  A({ id: "tds.deductor", name: "TDS Determination", domain: "tds", status: "engine",
      purpose: "Determine section, rate, threshold crossing and the deduction on the cumulative position — not on the invoice alone.",
      engine: "computeTds", inputs: "payment amount, section, prior payments, payee type, PAN status",
      output: "applicable / not, rate, tax, the form, and the basis with warnings",
      requiresApproval: true, receipt: "determination with its statutory basis" }),
  A({ id: "tds.206aa-check", name: "No-PAN Higher Rate Screen", domain: "tds", status: "engine",
      purpose: "Apply the higher of the prescribed rate or 20% where PAN is missing — and confirm 206AB is not the reason.",
      engine: "computeTds (panAvailable false)", inputs: "deductee PAN status, section, amount",
      output: "the rate that actually applies, with 206AB explicitly ruled out for FY 2025-26 onward",
      requiresApproval: false, receipt: "rate determination under s.206AA" }),
  A({ id: "tds.194q-tracker", name: "194Q Threshold Tracker", domain: "tds", status: "engine",
      purpose: "Track annual purchases per seller and deduct 0.1% from the point ₹50 lakh is crossed.",
      engine: "computeTds (section 194Q)", inputs: "purchase ledger by seller, buyer turnover",
      output: "sellers near or past the threshold with the deduction due, and the 206C(1H) repeal noted",
      requiresApproval: true, receipt: "threshold position per seller" }),
  A({ id: "tds.26as-recon", name: "26AS / AIS Reconciliation", domain: "tds", status: "engine",
      purpose: "Tie books to 26AS: deducted versus deposited versus reported, and surface the breaks that create a demand.",
      engine: "reconcileTds", inputs: "books TDS entries, challans, 26AS/AIS extract",
      output: "three-way findings with s.201(1A) interest exposure",
      requiresApproval: false, receipt: "three-way TDS reconciliation" }),
  A({ id: "tds.26q-preparer", name: "26Q / 27Q Preparer", domain: "tds", status: "workflow",
      purpose: "Assemble quarterly statements with correct section classification, lower-deduction certificates applied, and challan mapping.",
      engine: "computeTds + reconcileTds", inputs: "deduction register, challans, certificates",
      output: "statement-ready rows with exception lists",
      requiresApproval: true, receipt: "statement prepared with challan mapping" }),
  A({ id: "tds.challan-matcher", name: "Challan Matcher", domain: "tds", status: "engine",
      purpose: "Match paid challans to reported liability by section, period and amount, before the OLTAS mismatch is raised.",
      engine: "reconcileTds (challan branch)", inputs: "challan extract, liability by section and period",
      output: "matched, part-matched and unmatched challans with the correction each needs",
      requiresApproval: false, receipt: "challan reconciliation by section and period" }),
  A({ id: "tds.form16-issuer", name: "Form 16 / 16A Issuer", domain: "tds", status: "workflow",
      purpose: "Issue certificates from filed returns, with the PAN errors that stop a deductee's credit separated out.",
      engine: "reconcileTds", inputs: "filed statements, deductee master",
      output: "certificate set with pre-issue validation findings",
      requiresApproval: true, receipt: "certificate issue run with validation results" }),
  A({ id: "tcs.collector", name: "TCS Collector", domain: "tds", status: "engine",
      purpose: "Apply the surviving TCS sections — and refuse to collect under 206C(1H), which was repealed on 1 April 2025.",
      engine: "tcsSection", inputs: "sale type, value, buyer PAN status",
      output: "collection due, or a finding that the collection is no longer lawful",
      requiresApproval: true, receipt: "collection determination against the live ruleset" }),
  A({ id: "tds.lower-deduction", name: "Lower / Nil Deduction Monitor", domain: "tds", status: "workflow",
      purpose: "Track certificates, their validity windows and their stated limits, and stop deduction once the limit is exhausted.",
      engine: "computeTds", inputs: "certificates, deduction register",
      output: "certificate utilisation with expiry and limit breaches flagged",
      requiresApproval: false, receipt: "certificate position at a named date" }),

  // ── MSME ────────────────────────────────────────────────────────────────────
  A({ id: "msme.43bh-clock", name: "43B(h) Payment Clock", domain: "msme", status: "engine",
      purpose: "Run the 45/15-day clock from acceptance on every micro and small supplier bill and quantify the disallowance exposure.",
      engine: "assessPayables + paymentDeadline", inputs: "open payables with Udyam class and acceptance dates",
      output: "per-bill due date, days overdue, exposure, and the medium-supplier rows explicitly out of scope",
      requiresApproval: false, receipt: "s.43B(h) exposure at a named date" }),
  A({ id: "msme.msme1-return", name: "MSME-1 Filer", domain: "msme", status: "engine",
      purpose: "Identify half-yearly reportable dues over 45 days and prepare the MSME-1 population.",
      engine: "assessPayables + msme1DueDates", inputs: "payables aged at the half-year end",
      output: "the reportable population with the due date (30 April / 31 October)",
      requiresApproval: true, receipt: "reportable population for the half-year" }),
  A({ id: "msme.udyam-verifier", name: "Udyam Class Verifier", domain: "msme", status: "engine",
      purpose: "Classify suppliers as micro, small, medium or out of scope so the 43B(h) clock is applied to the right ones.",
      engine: "classifyEnterprise", inputs: "investment and turnover figures per supplier",
      output: "classification with the threshold reasoning, and medium flagged as uncovered",
      requiresApproval: false, receipt: "classification per supplier" }),

  // ── Banking and operations ──────────────────────────────────────────────────
  A({ id: "bank.reconciler", name: "Bank Reconciliation", domain: "banking-ops", status: "workflow",
      purpose: "Match bank statement lines to ledger entries, isolating timing differences from genuine misses.",
      engine: "reconcile (amount and reference passes)", inputs: "bank statement, cash/bank ledger",
      output: "matched, timing-difference and unreconciled populations, with stale items aged",
      requiresApproval: false, receipt: "reconciliation across both populations" }),
  A({ id: "ops.vendor-master-hygiene", name: "Vendor Master Hygiene", domain: "banking-ops", status: "engine",
      purpose: "Validate every GSTIN and PAN, deduplicate vendors sharing one registration, and catch transposed characters before they reach a return.",
      engine: "validateGstin + vendorKey + validatePan", inputs: "vendor master",
      output: "invalid registrations with the specific failure, plus duplicate groups by registration key",
      requiresApproval: false, receipt: "master-data validation with per-row reasons" }),
  A({ id: "ops.duplicate-payment", name: "Duplicate Payment Detector", domain: "banking-ops", status: "workflow",
      purpose: "Find the same bill paid twice — across vendors, months and spelling variants.",
      engine: "reconcile (identity and amount passes)", inputs: "payment register, purchase register",
      output: "candidate duplicates with the evidence for each pair",
      requiresApproval: false, receipt: "duplicate screen over the payment population" }),
  A({ id: "ops.three-way-match", name: "PO / GRN / Invoice Match", domain: "banking-ops", status: "workflow",
      purpose: "Match purchase order, goods receipt and invoice, and quantify the leakage at each break.",
      engine: "reconcile (three populations)", inputs: "PO, GRN and invoice registers",
      output: "price, quantity and timing variances with the value at risk",
      requiresApproval: false, receipt: "three-way match with variances quantified" }),
  A({ id: "ops.ageing-analyser", name: "Receivables & Payables Ageing", domain: "banking-ops", status: "engine",
      purpose: "Age open items into the buckets a board asks for, with the MSME and time-bar overlays applied.",
      engine: "assessPayables + period", inputs: "open item registers, as-on date",
      output: "ageing bands with exposure overlays rather than bare totals",
      requiresApproval: false, receipt: "ageing at a named date" }),
  A({ id: "ops.advance-tax", name: "Advance Tax Planner", domain: "banking-ops", status: "workflow",
      purpose: "Project the year's liability and the 15/45/75/100% instalments, with s.234B and 234C interest on shortfall.",
      engine: "interestOnLateTax (for the interest legs)", inputs: "year-to-date income, TDS, prior instalments",
      output: "instalment schedule with the interest cost of each shortfall scenario",
      requiresApproval: true, receipt: "instalment plan with interest modelled" }),
  A({ id: "ops.working-capital", name: "Working Capital Signal", domain: "banking-ops", status: "workflow",
      purpose: "Combine the MSME clock, the ITC cycle and the GST due dates into one cash-call calendar.",
      engine: "assessPayables + dueDates", inputs: "payables, receivables, return calendar",
      output: "the weeks where cash goes out faster than it comes in, with the drivers named",
      requiresApproval: false, receipt: "cash calendar derived from dated obligations" }),

  // ── Assurance and reporting ─────────────────────────────────────────────────
  A({ id: "assure.gstin-network", name: "Counterparty Network Analysis", domain: "assurance", status: "workflow",
      purpose: "Follow the counterparty graph for circular trading, shared-address clusters and suppliers whose filing record is failing.",
      engine: "vendorKey + validateGstin (graph construction)",
      inputs: "purchase and sales registers with registrations",
      output: "clusters with the signals that put them there, and the ITC at risk",
      requiresApproval: false, receipt: "network findings over a named population" }),
  A({ id: "assure.turnover-tie", name: "Turnover Tie-out", domain: "assurance", status: "workflow",
      purpose: "Tie reported turnover across GSTR-1, GSTR-3B, the books and the income-tax return, and explain each difference.",
      engine: "buildGstr1 + hardLockCrosswalk", inputs: "returns, books, ITR schedules",
      output: "a four-way tie-out with the differences classified and explained",
      requiresApproval: false, receipt: "four-way tie-out with explanations" }),
  A({ id: "assure.lapsed-filer-watch", name: "Lapsed Filer Watch", domain: "assurance", status: "workflow",
      purpose: "Flag counterparties whose return filing has stopped, because their silence becomes your credit problem.",
      engine: "reconcile (missing-in-2b population)", inputs: "2B and 2A history, supplier list",
      output: "suppliers with filing gaps and the credit exposed through them",
      requiresApproval: false, receipt: "filing-gap findings per supplier" }),
  A({ id: "report.board-mis", name: "Monthly MIS Pack", domain: "reporting", status: "workflow",
      purpose: "Assemble the month-end pack: tax position, credit realised, exposures, open notices and cash obligations.",
      engine: "all engines, aggregated", inputs: "the outputs of every agent above",
      output: "a board-ready pack where every number traces to a computation",
      requiresApproval: false, receipt: "MIS pack with per-line provenance" }),
  A({ id: "report.auditor-pack", name: "Auditor Evidence Pack", domain: "reporting", status: "workflow",
      purpose: "Assemble the reconciliation evidence an auditor asks for, with each figure traceable to its source records.",
      engine: "all engines, receipted", inputs: "the period's reconciliations and their inputs",
      output: "an evidence pack where every figure carries its hash, its ruleset and its approver",
      requiresApproval: false, receipt: "evidence pack, receipts included" }),
]);

export function agentCount(): number { return AGENTS.length; }

export function agentsByDomain(domain: Domain): Agent[] {
  return AGENTS.filter((a) => a.domain === domain);
}

export function findAgent(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id.toLowerCase() === id.toLowerCase());
}

/** How many of the roster are backed by a real computation today, and how many are staged. */
export function rosterStatus(): { total: number; engine: number; workflow: number; requiringApproval: number; ruleset: string } {
  return {
    total: AGENTS.length,
    engine: AGENTS.filter((a) => a.status === "engine").length,
    workflow: AGENTS.filter((a) => a.status === "workflow").length,
    requiringApproval: AGENTS.filter((a) => a.requiresApproval).length,
    ruleset: RULESET,
  };
}
