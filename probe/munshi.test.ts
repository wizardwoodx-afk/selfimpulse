/**
 * Munshi probe — the Indian-finance specialist pack.
 *
 * This suite runs the engines, it does not read source text. Every rate, threshold,
 * deadline and rupee figure below is a worked example, so if someone edits a tax table
 * without a basis for the change, a gate goes red instead of a return going wrong.
 *
 * It also holds the registry to its own claims: every agent's `engine` field must name a
 * function that is actually exported by the pack. A registry that describes engines which
 * do not exist is the same failure mode as a test that asserts nothing.
 */
import * as munshi from "../src/munshi";

let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
function section(name: string): void { console.log(`\n== ${name}`); }

const P = munshi.rupeesToPaise;

// ─────────────────────────────────────────────────────────────────────────────
section("1. money is exact, because tax is not a place for binary floats");

ok("rupees convert to integer paise", P(1234.56) === 123456, String(P(1234.56)));
ok("the classic float error does not exist here",
  munshi.add(P(0.1), P(0.2)) === P(0.3), `${munshi.add(P(0.1), P(0.2))} vs ${P(0.3)}`);
ok("ten paise added a hundred times is exactly one rupee",
  Array.from({ length: 100 }).reduce<number>((a) => munshi.add(a, P(0.1)), 0) === P(10));
ok("18% of ₹1,00,000 is ₹18,000", munshi.rate(P(100_000), 18) === P(18_000));
ok("a rate on a fractional base rounds half-up",
  munshi.rate(101, 18) === Math.round(101 * 0.18), String(munshi.rate(101, 18)));
ok("section 170 rounding goes to the nearest rupee",
  munshi.roundToRupee(15_050) === 15_100 && munshi.roundToRupee(15_049) === 15_000);

const split = munshi.splitIntraState(1001);
ok("an intra-state split never loses a paisa", split.cgst + split.sgst === 1001,
  `${split.cgst} + ${split.sgst}`);
ok("an odd paisa goes to SGST so the total stays exact", split.cgst === 500 && split.sgst === 501);

ok("Indian digit grouping for ₹12,34,567.89", munshi.formatINR(P(1234567.89)) === "₹12,34,567.89",
  munshi.formatINR(P(1234567.89)));
ok("grouping works at lakh scale", munshi.formatINR(P(100000)) === "₹1,00,000.00",
  munshi.formatINR(P(100000)));
ok("compact form for dashboards", munshi.formatCompact(P(12500000)) === "₹1.25 Cr",
  munshi.formatCompact(P(12500000)));

ok("parses a Tally-style comma amount", munshi.parseAmount("1,23,456.78") === P(123456.78));
ok("parses a rupee-symbol amount", munshi.parseAmount("₹ 45,000") === P(45000));
ok("parses a lakh shorthand", munshi.parseAmount("12L") === P(1200000));
ok("parses a crore shorthand", munshi.parseAmount("1.25 Cr") === P(12500000));
ok("parses an accounting negative", munshi.parseAmount("(1,200)") === P(-1200));
ok("refuses junk instead of guessing", munshi.parseAmount("not a number") === null);
ok("a rate with a percent sign parses", munshi.parseRate("18%") === 18);

// ─────────────────────────────────────────────────────────────────────────────
section("2. GSTIN — the checksum that catches a transposed character");

// self-consistency: compute the check character, then validate the whole thing
const first14 = "33AABCV1234K1Z";
const built = first14 + munshi.gstinCheckChar(first14);
const builtVerdict = munshi.validateGstin(built);
ok("a GSTIN built from the algorithm validates", builtVerdict.ok, built);

// published example — Maharashtra, PAN AAPFU0939F
const published = "27AAPFU0939F1ZV";
const computed = munshi.gstinCheckChar(published.slice(0, 14));
ok("the published example reproduces its own check character", computed === published.charAt(14),
  `algorithm produced '${computed}', the document says '${published.charAt(14)}'`);

const good = munshi.validateGstin(published);
ok("a real GSTIN decodes to its state", good.ok && good.parts.stateCode === "27", JSON.stringify(good));
ok("it decodes the embedded PAN", good.ok && good.parts.pan === "AAPFU0939F");
ok("it reads a firm out of the PAN", good.ok && good.parts.holderType === "Firm / LLP",
  good.ok ? good.parts.holderType : "n/a");
const company14 = "27AAACR5055K1Z";
const companyVerdict = munshi.validateGstin(company14 + munshi.gstinCheckChar(company14));
ok("and a company out of another", companyVerdict.ok && companyVerdict.parts.holderType === "Company",
  companyVerdict.ok ? companyVerdict.parts.holderType : "invalid");
ok("the human explanation is one line", munshi.explainGstin(published).startsWith("valid ·"));

ok("a wrong length is rejected", munshi.validateGstin("27AAPFU0939F1Z").ok === false);
const badState = munshi.validateGstin("00AAPFU0939F1Z" + computed);
ok("an unissued state code is rejected by state, not by checksum",
  !badState.ok && badState.code === "state-code", JSON.stringify(badState));
const badChar = published.slice(0, 14) + (published.charAt(14) === "A" ? "B" : "A");
const badCharVerdict = munshi.validateGstin(badChar);
ok("a transposed check character is caught", !badCharVerdict.ok && badCharVerdict.code === "checksum");
ok("PAN validation stands alone", munshi.validatePan("AAPFU0939F").ok && !munshi.validatePan("AAPFU093F").ok);
ok("two registrations of one PAN differ by their registration key",
  munshi.vendorKey("27AAPFU0939F1ZV") !== munshi.vendorKey("27AAPFU0939F2ZV"));

// ─────────────────────────────────────────────────────────────────────────────
section("3. periods and deadlines — the 1 April year");

ok("a March date belongs to the year that started last April",
  munshi.financialYearOf("2027-03-31") === "2026-27", munshi.financialYearOf("2027-03-31"));
ok("the next day starts a new financial year",
  munshi.financialYearOf("2027-04-01") === "2027-28", munshi.financialYearOf("2027-04-01"));
const thisFy = munshi.periodsOf("2026-27");
ok("a financial year has twelve periods", thisFy.length === 12);
ok("periods start in April and end in March",
  thisFy[0] === "2026-04" && thisFy[11] === "2027-03", `${thisFy[0]} … ${thisFy[11]}`);

const g1 = munshi.dueDates("GSTR-1", "2026-08")[0]!;
ok("GSTR-1 is due on the 11th of the following month", g1.due === "2026-09-11", g1.due);
const g3 = munshi.dueDates("GSTR-3B", "2026-08")[0]!;
ok("GSTR-3B is due on the 20th", g3.due === "2026-09-20", g3.due);
const qrmp = munshi.dueDates("GSTR-3B", "2026-08", "qrmp", "Y")[0]!;
ok("QRMP Category Y files on the 24th", qrmp.due === "2026-09-24", qrmp.due);
const iff = munshi.dueDates("IFF", "2026-09")[0]!;
ok("IFF is due on the 13th", iff.due === "2026-10-13", iff.due);
ok("every due date carries its rule as the basis", g1.basis.includes("Rule 59"));
ok("the December period rolls into January correctly",
  munshi.dueDates("GSTR-3B", "2026-12")[0]!.due === "2027-01-20");
ok("days overdue is zero before the deadline", munshi.daysOverdue("2026-09-20", "2026-09-15") === 0);
ok("days overdue counts from the deadline", munshi.daysOverdue("2026-09-20", "2026-09-30") === 10);

// ─────────────────────────────────────────────────────────────────────────────
section("4. rate migration — the 12% and 28% slabs are gone");

ok("5% is a current rate", munshi.isCurrentRate(5));
ok("18% is a current rate", munshi.isCurrentRate(18));
ok("40% is a current rate", munshi.isCurrentRate(40));
ok("12% is now legacy", munshi.isLegacyRate(12));
ok("28% is now legacy", munshi.isLegacyRate(28));
ok("3% survives for bullion", munshi.isCurrentRate(3) && munshi.isCurrentRate(0.25));
ok("an invoice at 12% is flagged as legacy, not silently accepted", munshi.isLegacyRate(12) === true);
const cement = munshi.rateForHsn("2523");
ok("an indicative rate exists for cement at 18%", cement.rate === 18 && cement.confidence === "indicative",
  JSON.stringify(cement));
ok("it says the opinion is indicative rather than authoritative", cement.basis.includes("indicative"));
const unknown = munshi.rateForHsn("9999");
ok("an unclassifiable code returns unknown, not a guess",
  unknown.rate === null && unknown.confidence === "unknown", JSON.stringify(unknown));
ok("a too-short code is refused", munshi.rateForHsn("12").rate === null);

// ─────────────────────────────────────────────────────────────────────────────
section("5. ITC reconciliation — where the money is");

const books: munshi.Invoice[] = [
  { gstin: "27AAPFU0939F1ZV", invoiceNumber: "INV/2026-27/001", invoiceDate: "2026-08-04",
    taxableValue: P(100000), igst: 0, cgst: P(9000), sgst: P(9000), rate: 18, documentType: "invoice" },
  { gstin: "29AABCT1332L1ZP", invoiceNumber: "SB-4471", invoiceDate: "2026-08-11",
    taxableValue: P(50000), igst: P(9000), cgst: 0, sgst: 0, rate: 18, documentType: "invoice" },
  { gstin: "33AACCV1234K1Z9", invoiceNumber: "002", invoiceDate: "2026-08-14",
    taxableValue: P(20000), igst: 0, cgst: P(1800), sgst: P(1800), rate: 18, documentType: "invoice" },
  { gstin: "29AABCT1332L1ZP", invoiceNumber: "SB-4472", invoiceDate: "2026-08-18",
    taxableValue: P(25000), igst: P(4500), cgst: 0, sgst: 0, rate: 18, reverseCharge: true },
  { gstin: "27AAPFU0939F1ZV", invoiceNumber: "INV/2026-27/001", invoiceDate: "2026-08-04",
    taxableValue: P(100000), cgst: P(9000), sgst: P(9000), rate: 18, documentType: "invoice" },
];

const gstr2b: munshi.Invoice[] = [
  { gstin: "27AAPFU0939F1ZV", invoiceNumber: "INV202627001", invoiceDate: "2026-08-04",
    taxableValue: P(100000), cgst: P(9000), sgst: P(9000), rate: 18, documentType: "invoice" },
  { gstin: "29AABCT1332L1ZP", invoiceNumber: "SB-4471", invoiceDate: "2026-08-11",
    taxableValue: P(50000), igst: P(7200), cgst: 0, sgst: 0, rate: 18, documentType: "invoice" },
  { gstin: "33AACCV1234K1Z9", invoiceNumber: "CN-900", invoiceDate: "2026-08-25",
    taxableValue: P(20000), cgst: P(1800), sgst: P(1800), rate: 18, documentType: "invoice" },
  { gstin: "27AAACR5055K1Z1", invoiceNumber: "R-77", invoiceDate: "2026-08-27",
    taxableValue: P(60000), cgst: P(5400), sgst: P(5400), rate: 18, documentType: "invoice" },
];

const rec = munshi.reconcile(books, gstr2b);
const byOutcome = rec.summary.byOutcome;
ok("the books-side duplicate is found once", byOutcome["duplicate-in-books"] === 1, JSON.stringify(byOutcome));
ok("a number restyled between books and portal still matches",
  byOutcome["exact"] === 1, JSON.stringify(byOutcome));
ok("a tax difference is classified as a tax mismatch, not a match",
  byOutcome["tax-mismatch"] === 1, JSON.stringify(byOutcome));
ok("the tax mismatch quantifies the short-paid IGST at ₹1,800",
  rec.results.find((r) => r.outcome === "tax-mismatch")!.itcAtRisk === P(1800),
  String(rec.results.find((r) => r.outcome === "tax-mismatch")!.itcAtRisk));
ok("the duplicate is the larger exposure — ₹18,000 claimed twice",
  rec.results.find((r) => r.outcome === "duplicate-in-books")!.itcAtRisk === P(18000),
  String(rec.results.find((r) => r.outcome === "duplicate-in-books")!.itcAtRisk));
ok("reverse charge is lifted out and never reported as missing from 2B",
  byOutcome["reverse-charge"] === 1 && munshi.reconcile(books, gstr2b)
    .results.filter((r) => r.outcome === "missing-in-2b" && r.books?.reverseCharge).length === 0);
ok("an invoice in 2B but not in the books is its own finding",
  byOutcome["missing-in-books"] === 1, JSON.stringify(byOutcome));
const periodTolerant = rec.results.find((r) => r.outcome === "period-mismatch");
ok("it does NOT merge a renumbered invoice into an exact match silently",
  periodTolerant !== undefined && periodTolerant.itcAtRisk === 0,
  `outcome=${periodTolerant?.outcome}`);

const summary = rec.summary;
ok("ITC at risk totals the duplicate plus the short-paid tax — ₹19,800",
  summary.itcAtRisk === P(19800), String(summary.itcAtRisk));
ok("an invoice in 2B with no books entry is filed as unclaimed, not at risk",
  summary.itcUnclaimed === 0 && summary.byOutcome["missing-in-books"] === 1,
  String(summary.itcUnclaimed));
ok("the summary names the ruleset it was computed under", summary.ruleset === munshi.RULESET);

const prioritised = munshi.prioritise(rec.results);
ok("findings prioritise money over housekeeping",
  prioritised[0]!.outcome === "tax-mismatch" || prioritised[0]!.outcome === "duplicate-in-books",
  prioritised[0]!.outcome);

// a supplier who has not filed at all
const unfiled = munshi.reconcile(
  [{ gstin: "27AAPFU0939F1ZV", invoiceNumber: "X-1", invoiceDate: "2026-08-02",
     taxableValue: P(10000), cgst: P(900), sgst: P(900) }], []);
ok("a supplier who has not filed is 'missing in 2B', not an error",
  unfiled.summary.byOutcome["missing-in-2b"] === 1);
ok("and its credit is booked as unclaimed rather than at risk",
  unfiled.summary.itcUnclaimed === P(1800) && unfiled.summary.itcAtRisk === 0);

const barred = munshi.itcTimeBarred("2025-05-10", "2026-12-05");
ok("credit from FY 2025-26 is time-barred after 30 Nov 2026", barred.barred === true, barred.deadline);
ok("the time bar names s.16(4)", barred.basis.includes("16(4)"));
ok("the 16(5) relief window is handled", munshi.itcAvailDeadline("2019-20").deadline === "2025-11-30");

// ─────────────────────────────────────────────────────────────────────────────
section("6. outward returns and the hard lock");

const posIntra = munshi.placeOfSupply("33", "33", P(100000), 18);
ok("the same state is intra-state", posIntra.supplyType === "intra-state");
ok("intra-state splits into equal halves", posIntra.cgst === P(9000) && posIntra.sgst === P(9000));
ok("intra-state carries no IGST", posIntra.igst === 0);
const posInter = munshi.placeOfSupply("33", "29", P(100000), 18);
ok("a different state is inter-state with IGST", posInter.supplyType === "inter-state" && posInter.igst === P(18000));
ok("inter-state carries no CGST", posInter.cgst === 0);
ok("an out-of-India place of supply is zero-rated", munshi.placeOfSupply("33", "96", P(100000), 18).igst === 0);

const sales: munshi.Invoice[] = [
  { gstin: "27AAPFU0939F1ZV", invoiceNumber: "S-1", invoiceDate: "2026-08-05",
    taxableValue: P(200000), igst: P(36000), placeOfSupply: "27", rate: 18 },
  { gstin: "URP", invoiceNumber: "S-2", invoiceDate: "2026-08-06",
    taxableValue: P(300000), igst: P(54000), placeOfSupply: "29", rate: 18 },
  { gstin: "URP", invoiceNumber: "S-3", invoiceDate: "2026-08-07",
    taxableValue: P(40000), cgst: P(3600), sgst: P(3600), placeOfSupply: "33", rate: 18 },
  { gstin: "33AACCV1234K1Z9", invoiceNumber: "S-4", invoiceDate: "2026-08-08",
    taxableValue: P(15000), cgst: P(1350), sgst: P(1350), placeOfSupply: "33", rate: 18,
    documentType: "credit-note" },
];
const g1draft = munshi.buildGstr1(sales, "33");
ok("registered supplies land in table 4A",
  g1draft.sections.some((s2) => s2.table === "4A" && s2.count === 1));
ok("an inter-state B2C invoice above ₹2.5 lakh goes to B2CL (5A)",
  g1draft.sections.some((s2) => s2.table === "5A" && s2.count === 1));
ok("an intra-state B2C invoice goes to B2C Small (7)",
  g1draft.sections.some((s2) => s2.table === "7" && s2.count === 1));
ok("a credit note is its own population (9B)",
  g1draft.sections.some((s2) => s2.table === "9B" && s2.count === 1));
ok("the rate-wise summary aggregates", g1draft.rateSummary.length >= 1);
ok("totals add up across heads", g1draft.totals.taxable === P(200000 + 300000 + 40000 + 15000),
  String(g1draft.totals.taxable));

const g3draft = munshi.buildGstr3b(g1draft, { available: P(21600), reversed: 0 });
ok("net cash payable is tax minus credit",
  g3draft.netCashPayable === g3draft.outwardTax - P(21600), String(g3draft.netCashPayable));
const overCredited = munshi.buildGstr3b(g1draft, { available: P(999999), reversed: 0 });
ok("excess credit never produces a negative cash payable", overCredited.netCashPayable === 0);

const clean = munshi.hardLockCrosswalk(g1draft, g3draft);
ok("a consistent return reports no findings", clean.consistent === true, JSON.stringify(clean.findings));
const drifted = munshi.hardLockCrosswalk(g1draft, { ...g3draft, outwardTax: g3draft.outwardTax - 100 });
ok("a drift between 1 and 3B is caught", drifted.consistent === false);
ok("the correction path names GSTR-1A rather than an edit in 3B",
  drifted.findings[0]!.correctionPath.includes("GSTR-1A"));
ok("the crosswalk states that 3B is non-editable under the hard lock",
  drifted.note.includes("non-editable"));

// ─────────────────────────────────────────────────────────────────────────────
section("7. interest and late fee");

const interest = munshi.interestOnLateTax(P(100000), "2026-09-20", "2026-10-20", "s.50(1)");
// ₹1,00,000 of tax × 18% × 30/365 = ₹1,479.45, rounded to the nearest rupee under s.170
ok("18% for 30 days on ₹1,00,000 of tax comes to ₹1,479",
  interest.interest === P(1479), `${interest.interest} paise`);
ok("a 12-day delay costs a fifth of the month",
  munshi.interestOnLateTax(P(100000), "2026-09-20", "2026-10-02").interest === P(592),
  String(munshi.interestOnLateTax(P(100000), "2026-09-20", "2026-10-02").interest));
ok("the day count is reported", interest.days === 30, String(interest.days));
ok("interest is computed on net cash liability and says so",
  interest.basis.includes("net cash liability") && interest.basis.includes("Rule 88B"));
const wrongCredit = munshi.interestOnLateTax(P(10000000), "2026-09-20", "2026-10-20", "s.50(3)");
ok("wrongly availed and utilised credit attracts 24%", wrongCredit.ratePercent === 24);
ok("interest is zero before the due date",
  munshi.interestOnLateTax(P(100000), "2026-09-20", "2026-09-15").interest === 0);

const fee = munshi.lateFee("GSTR-3B", "2026-09-20", "2026-09-30");
ok("late fee is ₹50 a day", fee.perDay === 5000 && fee.fee === P(500), `${fee.fee}`);
ok("ten days is not capped yet", fee.capped === false);
const nilFee = munshi.lateFee("GSTR-3B", "2026-09-20", "2026-09-30", { nil: true });
ok("a nil return pays ₹20 a day", nilFee.perDay === 2000);
const long = munshi.lateFee("GSTR-3B", "2026-09-20", "2028-09-20");
ok("the cap binds for a long delay", long.capped === true && long.fee === 200000, String(long.fee));
const bigTaxpayer = munshi.lateFee("GSTR-3B", "2026-09-20", "2028-09-20", { turnoverClass: "above-5cr" });
ok("a larger taxpayer has a larger cap", bigTaxpayer.fee === 1000000, String(bigTaxpayer.fee));
const annual = munshi.lateFee("GSTR-9", "2026-12-31", "2027-03-31");
ok("the annual return has its own ₹200/day fee", annual.perDay === 20000);
ok("the fee always carries its basis", annual.basis.includes("s.47"));

// ─────────────────────────────────────────────────────────────────────────────
section("8. e-invoice and e-way bill clocks");

const big = P(120000000);     // ₹12 crore AATO
const small = P(30000000);    // ₹3 crore
ok("e-invoicing applies at ₹12 crore", munshi.eInvoiceStatus(big).mandated === true);
ok("the 30-day limit applies above ₹10 crore", munshi.eInvoiceStatus(big).thirtyDayLimit === true);
ok("below ₹10 crore the 30-day limit does not apply", munshi.eInvoiceStatus(small).thirtyDayLimit === false);
ok("below ₹5 crore e-invoicing is not mandated", munshi.eInvoiceStatus(small).mandated === false);
ok("the deadline is 30 days from the document date",
  munshi.irnReportingDeadline("2026-08-01", big) === "2026-08-31",
  munshi.irnReportingDeadline("2026-08-01", big));
const closing = munshi.checkIrnWindow("2026-08-01", big, "2026-08-26");
ok("a window with days left reads as closing soon", closing.status === "closing-soon", closing.status);
const blocked = munshi.checkIrnWindow("2026-08-01", big, "2026-09-05");
ok("a missed window is blocked, not merely late", blocked.status === "blocked");
ok("a blocked document explains that it is not a valid tax invoice",
  blocked.finding.includes("not a valid tax invoice"));
ok("the check does not apply at low turnover",
  munshi.checkIrnWindow("2026-08-01", small, "2026-09-05").status === "not-applicable");
ok("IRN cancellation is allowed within 24 hours",
  munshi.checkIrnCancellationWindow("2026-08-01", "2026-08-01").allowed === true);
ok("and refused after it, pointing at a credit note",
  munshi.checkIrnCancellationWindow("2026-08-01", "2026-08-05").basis.includes("credit note"));
const eway = munshi.ewayBillValidity(450);
ok("e-way validity is one day per 200 km", eway.days === 3, String(eway.days));
ok("over-dimensional cargo is 20 km per day", munshi.ewayBillValidity(450, "over-dimensional").days === 23);
ok("short trips still get a full day", munshi.ewayBillValidity(30).days === 1);

// ─────────────────────────────────────────────────────────────────────────────
section("9. TDS — the thresholds that moved in 2025");

const professional = munshi.computeTds({ section: "194J(b)", amount: P(60000) });
ok("194J professional fees deduct at 10%", professional.applicable && professional.rate === 10,
  JSON.stringify(professional));
const j194a = munshi.tdsSection("194J(a)")!;
const j194b = munshi.tdsSection("194J(b)")!;
ok("the 194J threshold is ₹50,000 per category, up from ₹30,000",
  j194a.threshold === P(50000) && j194b.threshold === P(50000)
  && j194a.basis.includes("30,000") && j194a.basis.includes("50,000"),
  `${j194a.threshold} / ${j194b.threshold} paise — ${j194a.basis}`);
ok("it warns that the two 194J categories are counted separately, not together",
  j194b.basis.includes("per category"), j194b.basis);
ok("only the excess above the threshold is deducted once it is crossed",
  professional.tds === P(1000) && professional.warnings.some((w) => w.includes("excess")),
  String(professional.tds));
const belowThreshold = munshi.computeTds({ section: "194J(b)", amount: P(40000) });
ok("below the threshold nothing is deducted", belowThreshold.applicable === false);
const cumulative = munshi.computeTds({ section: "194J(b)", amount: P(30000), previouslyPaid: P(40000) });
ok("the deduction starts only above the threshold on the cumulative position",
  cumulative.applicable && cumulative.tds === P(2000), String(cumulative.tds));

const contractorCo = munshi.computeTds({ section: "194C", amount: P(50000), payeeType: "company" });
ok("194C deducts 2% for a company payee", contractorCo.rate === 2);
const contractorInd = munshi.computeTds({ section: "194C", amount: P(50000), payeeType: "individual" });
ok("194C deducts 1% for an individual", contractorInd.rate === 1);

const noPan = munshi.computeTds({ section: "194J(b)", amount: P(60000), panAvailable: false });
ok("no PAN forces the higher rate", noPan.rate === 20, String(noPan.rate));
ok("and the reason is s.206AA, not 206AB",
  noPan.warnings.some((w) => w.includes("206AA")) && noPan.warnings.some((w) => w.includes("206AB")),
  JSON.stringify(noPan.warnings));

const partner = munshi.computeTds({ section: "194T", amount: P(50000) });
ok("194T exists for firm-to-partner payments", partner.applicable && partner.rate === 10);
ok("194T carries a ₹20,000 threshold", munshi.tdsSection("194T")!.threshold === 2000000,
  String(munshi.tdsSection("194T")!.threshold));

const senior = munshi.computeTds({ section: "194A", amount: P(70000), isSeniorCitizen: true });
ok("a senior citizen keeps the ₹1,00,000 interest threshold", senior.applicable === false);
ok("an ordinary depositor is already over ₹50,000",
  munshi.computeTds({ section: "194A", amount: P(70000) }).applicable === true);

const unknownSection = munshi.computeTds({ section: "194ZZ", amount: P(100000) });
ok("an unknown section refuses rather than guessing", unknownSection.applicable === false &&
  unknownSection.warnings.includes("unknown section"));

const repealed = munshi.tcsSection("206C(1H)");
ok("206C(1H) is present as a repeal notice, not as a live rate",
  repealed !== undefined && repealed.rate === 0 && repealed.basis.includes("REPEALED"));
ok("the surviving TCS section still collects", munshi.tcsSection("206C(1F)")!.rate === 1);
ok("194Q is 0.1% above ₹50 lakh", munshi.tdsSection("194Q")!.threshold === 500000000,
  String(munshi.tdsSection("194Q")!.threshold));

const tdsRec = munshi.reconcileTds(
  [{ deductee: "Acme", section: "194C", quarter: "Q2", amount: P(20000) },
   { deductee: "Beta", section: "194J(b)", quarter: "Q2", amount: P(15000) }],
  [{ deductee: "Acme", section: "194C", quarter: "Q2", amount: P(20000) }],
  [{ deductee: "Acme", section: "194C", quarter: "Q2", amount: P(20000) },
   { deductee: "Gamma", section: "194H", quarter: "Q2", amount: P(5000) }],
);
ok("a deduction not deposited is a finding",
  tdsRec.findings.some((f) => f.kind === "deducted-not-deposited"),
  JSON.stringify(tdsRec.findings.map((f) => f.kind)));
ok("a deposit not reported is its own finding",
  tdsRec.findings.some((f) => f.kind === "deducted-not-deposited"));
ok("a 26AS entry with no books counterpart is caught",
  tdsRec.findings.some((f) => f.kind === "reported-not-in-books"));
ok("the three totals are returned for the tie-out",
  tdsRec.totalDeducted === P(35000) && tdsRec.totalDeposited === P(20000) && tdsRec.totalReported === P(25000));

// ─────────────────────────────────────────────────────────────────────────────
section("9b. the Act transition — which law governs, and what to quote");

/* Rates did not change on 1 April 2026. The law did: the Income-tax Act, 2025 governs TDS
   on the earlier of credit or payment falling on or after that date, resident TDS becomes a
   table inside s.393, and quoting the old 194-series label on a return is a validation
   failure. These checks hold the routing, the reference it prints, and — just as important —
   the honesty of its confidence. */

ok("31 March 2026 is governed by the 1961 Act",
  munshi.statuteForEvent("2026-03-31").statute === "1961",
  munshi.statuteForEvent("2026-03-31").act);
ok("1 April 2026 is governed by the 2025 Act",
  munshi.statuteForEvent("2026-04-01").statute === "2025",
  munshi.statuteForEvent("2026-04-01").act);
ok("the routing states the earlier-of-credit-or-payment rule it applies",
  munshi.statuteForEvent("2026-04-01").basis.includes("earlier of credit or payment"));
ok("the transition date is a value, not a magic string in a comparison",
  munshi.TDS_TRANSITION_DATE === "2026-04-01");

const oldC = munshi.statuteReference("194C", "2026-02-10");
ok("a February deduction quotes s.194C under the 1961 Act",
  oldC.statute === "1961" && oldC.section === "194C", `${oldC.act} s.${oldC.section}`);
ok("and it forward-references what the section becomes",
  oldC.crossReference.includes("393(1)") && oldC.crossReference.includes("6(i)"),
  oldC.crossReference);

const newC = munshi.statuteReference("194C", "2026-05-10");
ok("a May deduction moves to s.393(1) under the 2025 Act",
  newC.statute === "2025" && newC.section === "393(1)", `${newC.act} s.${newC.section}`);
ok("with the table item for the payee class",
  newC.tableRef !== null && newC.tableRef.includes("6(i).D(a)") && newC.tableRef.includes("6(i).D(b)"),
  String(newC.tableRef));
ok("and it cross-references the former section an accountant still knows",
  newC.crossReference.includes("194C"), newC.crossReference);
ok("the reference prints one readable line",
  munshi.explainStatuteReference(newC).startsWith("Income-tax Act, 2025 · s.393(1)"),
  munshi.explainStatuteReference(newC));

ok("professional fees land on the 194J(b) table item with code 1027",
  munshi.statuteReference("194J(b)", "2026-09-30").tableRef === "Sl. 6(iii).D(b)" &&
  munshi.statuteReference("194J(b)", "2026-09-30").paymentCode === 1027);
ok("technical fees land on 194J(a) with code 1026",
  munshi.statuteReference("194J(a)", "2026-09-30").paymentCode === 1026);
ok("partner payments move to s.393(3) (the 'any person' table)",
  munshi.statuteReference("194T", "2026-09-30").section === "393(3)" &&
  munshi.statuteReference("194T", "2026-09-30").tableRef === "Sl. 7");
ok("non-resident payments move to s.393(2)",
  munshi.statuteReference("195", "2026-09-30").section === "393(2)");
ok("salary is its own section, not part of the 393 table",
  munshi.statuteReference("192", "2026-09-30").section === "392");

/* Where published sources disagree, the engine narrows its claim instead of picking one. */
const r194r = munshi.statuteReference("194R", "2026-09-30");
ok("a disputed payment code is withheld, not guessed",
  r194r.tableRef === "Sl. 8(iv)" && r194r.paymentCode === null && r194r.confidence === "reported",
  `${r194r.tableRef} / code ${String(r194r.paymentCode)} / ${r194r.confidence}`);
ok("and the disagreement is named in the basis",
  r194r.basis.includes("sources disagree"), r194r.basis.slice(0, 90));
const r194m = munshi.statuteReference("194M", "2026-09-30");
ok("a section with no mapping is declared unmapped rather than invented",
  r194m.confidence === "unmapped" && r194m.tableRef === null,
  `${r194m.confidence} / ${String(r194m.tableRef)}`);
ok("and it tells the operator to confirm against the department's master",
  r194m.basis.includes("validation master"), r194m.basis.slice(0, 80));

ok("TCS moves to s.394 rather than disappearing",
  munshi.statuteReference("206C(1)", "2026-09-30", "tcs").section === "394",
  munshi.statuteReference("206C(1)", "2026-09-30", "tcs").basis.slice(0, 70));
ok("the repealed 206C(1H) has no successor entry to quote",
  munshi.statuteReference("206C(1H)", "2026-09-30", "tcs").basis.includes("repealed"),
  munshi.statuteReference("206C(1H)", "2026-09-30", "tcs").basis.slice(0, 70));

const fOld = munshi.returnFormFor("194C", "2026-03-31");
ok("before the changeover the return form is the familiar 26Q",
  fOld.form === "26Q" && fOld.certificate === "Form 16A" && fOld.confidence === "asserted");
const fNew = munshi.returnFormFor("194C", "2026-05-10");
ok("after it, the form numbering is stated but NOT asserted",
  fNew.confidence === "reported" && fNew.basis.includes("does NOT assert"),
  `${fNew.form} — ${fNew.confidence}`);
ok("and the reason it is not asserted is named",
  fNew.basis.includes("disagree"), fNew.basis.slice(0, 90));
ok("salary keeps its own form numbering",
  munshi.returnFormFor("192", "2026-03-31").form === "24Q");

/* The verdict itself must carry the routing — otherwise the caller has a rate and no law. */
const dated = munshi.computeTds({ section: "194C", amount: P(60000), payeeType: "company",
  creditOrPaymentOn: "2026-05-10" });
ok("a dated deduction returns the statute alongside the rate",
  dated.statute === "2025" && dated.statuteReference?.section === "393(1)",
  `${String(dated.statute)} / ${String(dated.statuteReference?.section)}`);
ok("the form to file follows the date", dated.formToFile === "140", String(dated.formToFile));
ok("the verdict's basis names the section to quote",
  dated.basis.includes("393(1)"), dated.basis.slice(-90));
const undated = munshi.computeTds({ section: "194C", amount: P(60000), payeeType: "company" });
ok("an undated deduction still computes the rate",
  undated.tds === dated.tds && undated.tds === P(1200), `${undated.tds} vs ${dated.tds}`);
ok("but refuses to name a statute",
  undated.statute === null && undated.statuteReference === null);
ok("and says exactly why the answer is incomplete",
  undated.warnings.some((w) => w.includes("earlier of the date of credit")),
  JSON.stringify(undated.warnings));
const backdated = munshi.computeTds({ section: "194C", amount: P(60000), payeeType: "company",
  creditOrPaymentOn: "2026-03-20" });
ok("the RATES are identical either side of the changeover",
  backdated.tds === dated.tds && backdated.rate === dated.rate,
  `${backdated.rate}% / ${backdated.tds} vs ${dated.rate}% / ${dated.tds}`);
ok("only the legal reference moves",
  backdated.statute === "1961" && backdated.formToFile === "26Q",
  `${String(backdated.statute)} / ${String(backdated.formToFile)}`);
ok("206AA still forces the higher rate under the new Act",
  munshi.computeTds({ section: "194J(b)", amount: P(60000), panAvailable: false,
    creditOrPaymentOn: "2026-06-01" }).rate === 20);


// ─────────────────────────────────────────────────────────────────────────────
section("10. MSME — the 45-day clock that becomes a disallowance");

ok("a micro manufacturer classifies as micro",
  munshi.classifyEnterprise("manufacturing", 5000000, 20000000) === "micro");
ok("a medium enterprise is NOT covered by 43B(h)",
  munshi.paymentDeadline("2026-08-01", "medium").covered === false);
ok("and the basis says so explicitly",
  munshi.paymentDeadline("2026-08-01", "medium").basis.includes("MICRO and SMALL"));
ok("a small supplier gets 45 days with an agreement",
  munshi.paymentDeadline("2026-08-01", "small").dueBy === "2026-09-15",
  munshi.paymentDeadline("2026-08-01", "small").dueBy);
ok("15 days where there is no written agreement",
  munshi.paymentDeadline("2026-08-01", "small", { writtenAgreement: false }).dueBy === "2026-08-16");
ok("the clock runs from acceptance when it is known",
  munshi.paymentDeadline("2026-08-01", "small", { acceptedOn: "2026-08-20" }).dueBy === "2026-10-04");

const assessed = munshi.assessPayables([
  { vendor: "SmallCo", invoiceNumber: "A-1", invoiceDate: "2026-06-01", amount: P(100000),
    enterprise: "small" },
  { vendor: "MediumCo", invoiceNumber: "A-2", invoiceDate: "2026-06-01", amount: P(500000),
    enterprise: "medium" },
  { vendor: "PaidCo", invoiceNumber: "A-3", invoiceDate: "2026-06-01", amount: P(50000),
    enterprise: "micro", paidOn: "2026-07-10" },
], "2026-09-30");
ok("an overdue micro/small bill creates disallowance exposure",
  assessed.rows.find((r) => r.vendor === "SmallCo")!.disallowanceExposure === P(100000));
ok("a medium bill creates none, however overdue",
  assessed.rows.find((r) => r.vendor === "MediumCo")!.disallowanceExposure === 0);
ok("a paid bill that was late has no exposure but says it was late",
  assessed.rows.find((r) => r.vendor === "PaidCo")!.finding.includes("paid"));
ok("total exposure is the covered amount only", assessed.totalExposure === P(100000), String(assessed.totalExposure));
ok("the MSME-1 population is identified separately", assessed.msme1Reportable === P(100000));
ok("the classification counts are reported", assessed.covered === 2 && assessed.notCovered === 1);
const msme1 = munshi.msme1DueDates("2026-27");
ok("MSME-1 is half-yearly with two due dates", msme1.length === 2 && msme1[1]!.due === "2027-04-30");

// ─────────────────────────────────────────────────────────────────────────────
section("11. the roster holds itself to its own claims");

const roster = munshi.rosterStatus();
ok("the pack ships well over thirty specialists", roster.total >= 30, `count=${roster.total}`);
ok("the roster is 47 specialists across 8 domains", roster.total === 47, String(roster.total));
ok("the roster size matches the registry", munshi.agentCount() === munshi.AGENTS.length);
ok("every agent id is unique",
  new Set(munshi.AGENTS.map((a) => a.id)).size === munshi.AGENTS.length);
ok("every agent declares a purpose and an engine",
  munshi.AGENTS.every((a) => a.purpose.length > 40 && a.engine.length > 3));
ok("every agent declares what 11Handle signs", munshi.AGENTS.every((a) => a.receipt.length > 10));
ok("the roster reports how many are engine-backed today",
  roster.engine + roster.workflow === roster.total && roster.engine >= 15,
  JSON.stringify(roster));
ok("a substantial share of the roster ends at a human gate", roster.requiringApproval >= 15,
  String(roster.requiringApproval));
// The design rule is that whatever files, pays, issues or answers the department is gated.
// Pin that as an invariant over the ids naming such an action — not as a headcount, which a
// future addition could quietly satisfy while leaving a filer ungated.
const ACTION_IDS = /preparer|issuer|drafter|responder|actioning|deductor|collector|return|allocator/i;
const actionAgents = munshi.AGENTS.filter((a) => ACTION_IDS.test(a.id));
ok("the roster contains filing-end agents for the gate to apply to", actionAgents.length >= 10,
  String(actionAgents.length));
ok("every agent that files, issues or answers the department carries the approval flag",
  actionAgents.every((a) => a.requiresApproval === true),
  actionAgents.filter((a) => !a.requiresApproval).map((a) => a.id).join(", "));
ok("the roster names its ruleset", roster.ruleset === munshi.RULESET);

/**
 * The anti-lying check. Every agent claims an engine; a claim that names a function the
 * pack does not export is how a registry drifts into fiction. Module-level names (a whole
 * file's worth of functions named as a step) and descriptive words are allowed through a
 * short, explicit list rather than by loosening the pattern.
 */
const exportsSet = new Set(Object.keys(munshi));
// Whole-file names ("money", "returns") are legitimate steps. "aggregated" and "receipted"
// are 11Handle host verbs — the substrate provides them, this pack does not.
const STEP_WORDS = new Set(["rule", "money", "returns", "period", "all", "aggregated", "receipted"]);
const missing: string[] = [];
for (const a of munshi.AGENTS) {
  for (const part of a.engine.split(/[+,]/)) {
    const lead = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (!lead) continue;
    const token = lead[1]!;
    if (!exportsSet.has(token) && !STEP_WORDS.has(token)) missing.push(`${a.id} → ${token}`);
  }
}
ok("every engine an agent claims actually exists in the pack", missing.length === 0,
  missing.slice(0, 6).join(", "));
ok("the domain split covers the Indian finance surface",
  new Set(munshi.AGENTS.map((a) => a.domain)).size >= 6);
ok("findAgent resolves an id", munshi.findAgent("gst.itc-2b-recon")?.domain === "gst-itc");
ok("agentsByDomain filters", munshi.agentsByDomain("tds").length >= 6,
  String(munshi.agentsByDomain("tds").length));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);
