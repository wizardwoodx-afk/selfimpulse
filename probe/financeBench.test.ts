/**
 * probe/financeBench.test.ts — the 350-specialist FINANCE expansion.
 *
 * Pins: exact counts (200 India-focused finance.in.* + 150 international
 * finance.intl.* = 350), per-entry integrity (unique ids, two real
 * capabilities, 5+ routing keywords, honest risk tiers, doctrine with the
 * finance contract), domain coverage spot-checks (GST, TDS, UPI recon,
 * Ind AS on the India side; US GAAP/SEC, IFRS, AML, Pillar Two on the
 * international side), and catalog registration (categories 16, census
 * 1,850 established).
 */
import assert from "node:assert/strict";

let passed = 0; let failed = 0; const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

class MemStore implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; } clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  removeItem(k: string) { this.m.delete(k); } setItem(k: string, v: string) { this.m.set(k, v); }
}
(globalThis as { localStorage?: Storage }).localStorage = new MemStore();

import { FINANCE_SPECIALISTS, FINANCE_IN_SPECIALISTS, FINANCE_INTL_SPECIALISTS } from "../src/vh19/financeBench";
import { catalogStats, SPECIALISTS } from "../src/vh19/registry";
import { buildSpecialistPrompt } from "../src/vh19/skills";

function main(): void {
  ok("exactly 350 finance specialists", FINANCE_SPECIALISTS.length === 350);
  ok("exactly 200 India-focused (finance.in.*)", FINANCE_IN_SPECIALISTS.length === 200 && FINANCE_IN_SPECIALISTS.every((s) => s.id.startsWith("finance.in.")));
  ok("exactly 150 international (finance.intl.*)", FINANCE_INTL_SPECIALISTS.length === 150 && FINANCE_INTL_SPECIALISTS.every((s) => s.id.startsWith("finance.intl.")));

  const ids = new Set(FINANCE_SPECIALISTS.map((s) => s.id));
  ok("every id unique", ids.size === 350);
  ok("every entry is a finished professional (2 capabilities, 5+ keywords, doctrine + finance contract)",
    FINANCE_SPECIALISTS.every((s) =>
      s.category === "finance"
      && s.capabilities.length === 2 && s.capabilities.every((c) => c.length > 25)
      && s.keywords.length >= 5
      && s.riskTier === "safe" || s.riskTier === "risky"
      && /Finance contract:/.test(s.systemPrompt)));

  ok("risk tiers honest — portal filings/payment runs are risky",
    SPECIALISTS.filter((s) => s.id.startsWith("finance.") && s.riskTier === "risky").length >= 25
    && SPECIALISTS.find((s) => s.id === "finance.in.gstr3b-filer")!.riskTier === "risky");

  /* India coverage spot-checks */
  const has = (id: string) => ids.has(id);
  ok("GST core present (GSTR-1/3B/9, 2B recon, e-invoicing, e-way bill, notices, refunds, RCM, ITC)",
    has("finance.in.gstr1-filer") && has("finance.in.gstr3b-filer") && has("finance.in.gstr9-annual")
    && has("finance.in.gstr2b-recon") && has("finance.in.einvoice-irn") && has("finance.in.ewaybill")
    && has("finance.in.gst-notice-response") && has("finance.in.gst-refund") && has("finance.in.gst-rcm") && has("finance.in.itc-adjudicator"));
  ok("TDS/income-tax present (24Q/26Q/27Q, 26AS/AIS, ITRs, capital gains, 15CA/CB, reassessment)",
    has("finance.in.tds-24q") && has("finance.in.tds-26q") && has("finance.in.tds-27q") && has("finance.in.tds-26as-recon")
    && has("finance.in.itr2-preparer") && has("finance.in.capital-gains-compute") && has("finance.in.15ca-cb") && has("finance.in.it-148-reassessment"));
  ok("banking/recon present (UPI, NEFT/RTGS, gateway settlement, NACH, nostro, escrow, FX/FEMA, RBI reporting)",
    has("finance.in.upi-recon") && has("finance.in.neft-rtgs-recon") && has("finance.in.pg-settlement")
    && has("finance.in.nach-mandate") && has("finance.in.nostro-recon") && has("finance.in.escrow-recon")
    && has("finance.in.fx-fema") && has("finance.in.rbi-reporting"));
  ok("books/close + audit + payroll + EXIM + fintech present",
    has("finance.in.tally-prime") && has("finance.in.monthly-close") && has("finance.in.bs-finalisation")
    && has("finance.in.tax-audit-44ab") && has("finance.in.indas115-reviewer") && has("finance.in.pf-epfo")
    && has("finance.in.payroll-processor") && has("finance.in.duty-drawback") && has("finance.in.sez-compliance")
    && has("finance.in.nbfc-iracp") && has("finance.in.co-lending") && has("finance.in.ppi-wallet"));
  ok("MSME-focused present (43B(h), Udyam, CGTMSE pack, TReDS)",
    has("finance.in.msme-43bh") && has("finance.in.udyam-specialist") && has("finance.in.cgtmse-pack") && has("finance.in.treds-coordinator"));

  /* international coverage spot-checks */
  ok("US GAAP/SEC + IFRS present (606/842/CECL/740, XBRL; IFRS 9/15/16, IAS 12)",
    has("finance.intl.asc606-revenue") && has("finance.intl.asc842-leases") && has("finance.intl.cecl-modeler")
    && has("finance.intl.asc740-tax") && has("finance.intl.xbrl-edgar") && has("finance.intl.ifrs9-financial")
    && has("finance.intl.ifrs15-revenue") && has("finance.intl.ias12-tax"));
  ok("multi-jurisdiction tax present (US 1120/1040/SALT, UK VAT/CT, EU OSS/Pillar Two, APAC/GCC)",
    has("finance.intl.us-1120-preparer") && has("finance.intl.us-salt") && has("finance.intl.uk-vat-mtd")
    && has("finance.intl.eu-vat-oss") && has("finance.intl.eu-pillar2-globe") && has("finance.intl.sa-zatca") && has("finance.intl.jp-consumption"));
  ok("AML/financial-crime present (KYC, monitoring, sanctions, SAR, TBML, travel rule)",
    has("finance.intl.kyc-cdd-analyst") && has("finance.intl.aml-monitoring") && has("finance.intl.sanctions-screening")
    && has("finance.intl.sar-drafting") && has("finance.intl.tbml-redflags") && has("finance.intl.crypto-travel-rule"));
  ok("FP&A + treasury + audit intl + M&A present",
    has("finance.intl.rolling-forecast") && has("finance.intl.saas-metrics") && has("finance.intl.fx-hedge-accountant")
    && has("finance.intl.sox-404-tester") && has("finance.intl.pcaob-support") && has("finance.intl.qoe-analyst") && has("finance.intl.ppa-specialist"));

  /* catalog integration */
  const stats = catalogStats();
  ok("catalog census: 1,850 established, 16 categories", stats.count === 1850 && stats.categories === 16);
  ok("provenance carries the finance batch (350 = 200 + 150)", stats.byProvenance.finance === 350 && stats.byProvenance.financeIn === 200 && stats.byProvenance.financeIntl === 150);
  ok("finance specialists registered in SPECIALISTS", SPECIALISTS.some((s) => s.id === "finance.in.gstr3b-filer") && SPECIALISTS.some((s) => s.id === "finance.intl.pillar2-data"));

  /* domain skills bind by category */
  const gstr = SPECIALISTS.find((s) => s.id === "finance.in.gstr3b-filer")!;
  const prompt = buildSpecialistPrompt(gstr);
  ok("finance prompt binds Reconciliation Proof + Statute-Dated Compliance playbooks",
    prompt.includes("### Skill: Reconciliation Proof") && prompt.includes("### Skill: Statute-Dated Compliance"));
  ok("finance prompt carries doctrine + BEW", prompt.includes("Operator doctrine") && prompt.includes("Behaviour Enforcement Workflow [BEW]"));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
}
main();
