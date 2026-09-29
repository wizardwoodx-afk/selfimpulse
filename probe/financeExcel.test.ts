/**
 * probe · financeExcel — the Documents/Finance wing end-to-end.
 *
 * Writes a large synthetic industrial ledger workbook, reads it back, classifies,
 * sorts, flags, summarises, mints receipts, writes the classified workbook and
 * verifies the whole chain. Zero dependencies outside the product.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { writeXlsx, readXlsx, indexToCol, colToIndex } from "../src/vh19/finance/xlsxLite";
import {
  buildDemoLedger,
  classifyLedger,
  detectColumns,
  verifyReceipts,
  monthOf,
} from "../src/vh19/finance/financeEngine";

let checks = 0;
const ok = (cond: boolean, msg: string): void => {
  assert.ok(cond, msg);
  checks += 1;
};

// --- 1. big ledger fixture ------------------------------------------------
const raw = buildDemoLedger(5200);
ok(raw.rows.length === 5200, "ledger has 5200 data rows");
ok(raw.headers.length === 7, "ledger has 7 columns");

// --- 2. xlsx round-trip (write -> read) -----------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "11h-fin-"));
const rawPath = path.join(tmp, "raw.xlsx");
fs.writeFileSync(rawPath, writeXlsx(raw));
const back = readXlsx(fs.readFileSync(rawPath));
ok(back.headers.join("|") === raw.headers.join("|"), "headers survive round-trip");
ok(back.rows.length === raw.rows.length, "row count survives round-trip");
ok(String(back.rows[0][2]) === "Coastal Steel Supply", "first anchor row survives");
ok(indexToCol(0) === "A" && indexToCol(25) === "Z" && indexToCol(26) === "AA", "column letters");
ok(colToIndex("A") === 0 && colToIndex("AA") === 26, "column indexes");

// --- 3. classify + sort + flags ------------------------------------------
const result = classifyLedger(back);
ok(result.mode === "rules-only", "rules-only mode is labelled honestly");
const cols = detectColumns(back.headers);

const findRow = (voucher: string, amt: number): typeof result.classified =>
  result.classified.filter((r) => String(r.row[cols.voucher]) === voucher && Number(r.row[cols.amount]) === amt);

const anchor = findRow("SI/P/0612", 458000);
ok(anchor.length === 1 && anchor[0].category === "RAW-MATERIALS", "steel purchase -> RAW-MATERIALS");

const salary = findRow("SI/PY/0930", 912000);
ok(salary.length === 1 && salary[0].category === "PAYROLL", "salary -> PAYROLL");

const dups = findRow("SI/P/0805", 27500);
ok(dups.length === 2, "duplicate pair both present");
ok(dups.every((r) => r.flags.includes("DUPLICATE")), "duplicate pair both flagged");

const misc = findRow("SI/JV/1014", 2750000);
ok(misc.length === 1 && misc[0].category === "MISC", "board-note unknown -> MISC (never guessed)");
ok(misc[0].flags.includes("REVIEW-HIGH-VALUE"), "high-value unknown is flagged for review");

const credit = findRow("SI/CN/1102", -38000);
ok(credit.length === 1 && credit[0].flags.includes("NEGATIVE-AMOUNT"), "credit note flagged NEGATIVE-AMOUNT");

// sorted by date asc
const dates = result.classified.map((r) => String(r.row[cols.date]));
ok(dates.every((d, i) => i === 0 || d >= dates[i - 1]), "sorted by date ascending");

// --- 4. summary integrity -------------------------------------------------
const total = result.classified.reduce((s, r) => s + Number(r.row[cols.amount]), 0);
const summaryTotal = Object.values(result.summary.byCategory).reduce((s, c) => s + c.total, 0);
ok(Math.abs(total - summaryTotal) < 1e-6, "category totals sum to the ledger");
ok(result.summary.flagged["DUPLICATE"] === 2, "two duplicate lines flagged");
ok(result.summary.flagged["REVIEW-HIGH-VALUE"] === 1, "one high-value review flag");

// month grouping sanity
const m0 = monthOf(back.rows[0], cols.date);
ok(/^\d{4}-\d{2}$/.test(m0), "month grouping key format");

// --- 5. receipts chain ----------------------------------------------------
ok(verifyReceipts(result.receipts), "receipt chain verifies");
ok(result.receipts.length === 3 && result.receipts[2].prev === result.receipts[1].digest, "chain is linked");

// tamper check: flip one byte of one receipt -> verify must fail
const tampered = JSON.parse(JSON.stringify(result.receipts));
tampered[1].rows = 999;
ok(!verifyReceipts(tampered), "tampered chain is refused");

// --- 6. classified workbook round-trip ------------------------------------
const outPath = path.join(tmp, "classified.xlsx");
fs.writeFileSync(outPath, writeXlsx(result.sheet));
const outBack = readXlsx(fs.readFileSync(outPath));
ok(outBack.headers.slice(-4).join("|") === "Category|Confidence|Flags|Month", "output columns appended");
ok(outBack.rows.length === raw.rows.length, "no rows lost in classification");

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`financeExcel: PASS (${checks} checks, 5200 rows)`);
