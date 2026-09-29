/**
 * 11Handle — demo entry: builds the synthetic industrial finance demo.
 *
 *   demo/Synthetic-Industrial-FY26-RAW.xlsx         the "huge sheet" handed over
 *   demo/Synthetic-Industrial-FY26-CLASSIFIED.xlsx  sorted + classified + flagged
 *   demo/Synthetic-Industrial-FY26-SUMMARY.json     the numbers to talk through
 *   demo/Synthetic-Industrial-FY26-RECEIPT.json     the signed receipt chain (verifiable)
 *
 * The company, its people and its counterparties are invented. The *structure*
 * is the point and is load-bearing for the probes: 5,200 rows, mixed date
 * formats, blank parties, one exact duplicate, a board-note line, a negative
 * credit note and a board-name motif that must NOT look like a purchase. Anonymising
 * the names must not quietly remove any of that, or the fixture stops testing
 * what it was written to test.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { writeXlsx, readXlsx } from "./xlsxLite";
import { buildDemoLedger, classifyLedger, verifyReceipts } from "./financeEngine";

const outDir = path.resolve(process.cwd(), "demo");
fs.mkdirSync(outDir, { recursive: true });

const raw = buildDemoLedger(5200);
fs.writeFileSync(path.join(outDir, "Synthetic-Industrial-FY26-RAW.xlsx"), writeXlsx(raw));

const result = classifyLedger(raw);
fs.writeFileSync(path.join(outDir, "Synthetic-Industrial-FY26-CLASSIFIED.xlsx"), writeXlsx(result.sheet));

fs.writeFileSync(
  path.join(outDir, "Synthetic-Industrial-FY26-SUMMARY.json"),
  JSON.stringify(
    {
      company: "Synthetic Industrial Ltd",
      signatory: "A. Raghavan, GM Finance",
      period: "FY 2025-26",
      rows: raw.rows.length,
      mode: result.mode,
      summary: result.summary,
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(outDir, "Synthetic-Industrial-FY26-RECEIPT.json"),
  JSON.stringify({ engine: "11Handle Documents", verified: verifyReceipts(result.receipts), receipts: result.receipts }, null, 2),
);

// round-trip sanity: the classified workbook must read back intact
const back = readXlsx(fs.readFileSync(path.join(outDir, "Synthetic-Industrial-FY26-CLASSIFIED.xlsx")));
if (back.rows.length !== raw.rows.length) {
  throw new Error(`demo round-trip failed: ${back.rows.length} != ${raw.rows.length}`);
}
