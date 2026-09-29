/**
 * 11Handle — Munshi: the Indian finance pack.
 *
 * It ships twice on purpose: as the finance DOMAIN inside the Specialists door (the
 * generalist surface hosts it there, alongside frontend, engineering, API, data,
 * security, reliability, docs and growth) and as a door of its own, because a finance
 * desk reads better alone than as one tab of nine.
 *
 * WHY THIS DOOR EXISTS: `src/munshi/` shipped 47 specialists and a dated ruleset, but
 * nothing in the shell reached them. A capability no surface can reach is, from the
 * operator's side, the same as absent — the identical failure the Docs door was built to
 * fix. This door is the reachable surface for the pack.
 *
 * WHAT IT WILL NOT DO, by design:
 *   • it does not file, pay, or transmit anything. Every figure below is computed on this
 *     machine by the deterministic engines in `src/munshi/` and never leaves it. Filing
 *     needs GSTN credentials and a GSP/ASP channel — an operator-granted capability, not
 *     one this screen assumes. The 18 specialists in the roster that end in a filing or a
 *     payment are marked GATED here, and they stay gated.
 *   • it does not ask a model for an arithmetic answer. There is no provider call on this
 *     path at all: a wrong ITC figure and a right one look identical to the person signing
 *     the return, so no number on this screen is a language model's opinion.
 *   • it does not hide its basis. Every result prints the rule, the date and the ruleset
 *     version it came from (`IN-2026.09`), which is what makes a figure checkable against
 *     the statute instead of merely plausible.
 *
 * SCOPE, STATED PLAINLY: these are the fastest-moving statutory clocks in Indian finance
 * (rates after 22 Sep 2025, the July 2025 3B hard lock, the 30-day IRN limit at ₹10 crore
 * AATO, the Finance Act 2025 TDS table). The ruleset is a value you can read off the
 * screen, and the engine deliberately REFUSES rather than guesses when a rule is not in
 * its table — an unknown HSN code returns "unknown", not a plausible rate.
 */

import React, { useMemo, useState } from "react";
import {
  AGENTS, RULESET, agentsByDomain, rosterStatus,
  validateGstin, explainGstin, vendorKey,
  computeTds, TDS_TABLE, tdsSection, type PayeeType,
  statuteReference, explainStatuteReference, returnFormFor,
  reconcile,
  parseAmount, formatINR, rupeesToPaise,
  dueDates, daysOverdue, type ReturnKind,
  eInvoiceStatus, checkIrnWindow, ewayBillValidity,
  interestOnLateTax, lateFee,
  assessPayables, paymentDeadline, classifyEnterprise,
  type Invoice, type Domain, type EnterpriseClass, type TurnoverClass, type InterestBasis,
} from "../../munshi";

/* ── the tools ─────────────────────────────────────────────────────────────── */

const TOOLS = [
  { id: "gstin", label: "GSTIN" },
  { id: "tds", label: "TDS" },
  { id: "recon", label: "2B reconcile" },
  { id: "dates", label: "Due dates" },
  { id: "einvoice", label: "E-invoice · e-way" },
  { id: "msme", label: "43B(h)" },
  { id: "fee", label: "Interest · fee" },
] as const;
type ToolId = (typeof TOOLS)[number]["id"];

const DOMAIN_LABEL: Record<string, string> = {
  "gst-output": "GST · output",
  "gst-itc": "GST · credit",
  "gst-compliance": "GST · compliance",
  "tds": "TDS · TCS",
  "msme": "MSME",
  "banking-ops": "Banking · ops",
  "assurance": "Assurance",
  "reporting": "Reporting",
};

const OUTCOME_LABEL: Record<string, string> = {
  exact: "Matched",
  "value-mismatch": "Taxable value differs",
  "tax-mismatch": "Tax differs — money case",
  "rate-mismatch": "Rate differs",
  "period-mismatch": "Same value, different number",
  "duplicate-in-books": "Duplicate in books",
  "duplicate-in-2b": "Duplicate in 2B",
  "missing-in-2b": "Missing in 2B",
  "missing-in-books": "In 2B, not in your books",
  "gstin-mismatch": "GSTIN differs",
  "reverse-charge": "Reverse charge — not in 2B",
  "cancelled-in-2b": "Cancelled in 2B",
};

/** A basis line is the point of this product — render it, never summarize it away. */
function Basis({ text }: { text: string }): React.ReactElement {
  return <p className="hint"><b>Basis — </b>{text}</p>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="field">
      <label className="lbl">{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function Result({ ok, headline, children }: { ok: boolean; headline: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="card">
      <div className="card-h">
        <h3>{headline}</h3>
        <span className={`pill ${ok ? "ok" : "warn"}`}>{ok ? "engine" : "check"}</span>
      </div>
      <div className="card-b">{children}</div>
    </div>
  );
}

/* ── 1 · GSTIN ─────────────────────────────────────────────────────────────── */

function GstinTool(): React.ReactElement {
  const [value, setValue] = useState("27AAPFU0939F1ZV");
  const v = validateGstin(value);
  const key = vendorKey(value);

  return (
    <>
      <div className="card">
        <div className="card-b">
          <Field label="GSTIN" hint="15 characters. The 15th is a mod-36 checksum over the first 14 — a transposed character usually dies here.">
            <input className="input mono" value={value} onChange={(e) => setValue(e.target.value)} placeholder="27AAPFU0939F1ZV" />
          </Field>
          {v.ok ? (
            <div className="kpis" style={{ marginTop: 14, marginBottom: 0 }}>
              <div><b>{v.parts.stateCode}</b><span>{v.parts.state}</span></div>
              <div><b className="mono" style={{ fontSize: 18 }}>{v.parts.pan}</b><span>{v.parts.holderType}</span></div>
              <div><b>{v.parts.entityNumber}</b><span>entity number</span></div>
            </div>
          ) : (
            <div className="note warn" style={{ marginTop: 14 }}>
              <b>{v.code}</b> — {v.detail}
            </div>
          )}
        </div>
      </div>
      <Result ok={v.ok} headline={v.ok ? "Valid registration" : "Refused"}>
        <p>{explainGstin(value)}</p>
        {v.ok && (
          <p className="hint"><b>Vendor key — </b>{key} · two invoices from this taxpayer resolve to one vendor, whatever the invoice numbering does.</p>
        )}
        <Basis text="state codes and the mod-36 check character are computed here; the PAN's 4th character gives the holder type. No portal call, no model." />
      </Result>
    </>
  );
}

/* ── 2 · TDS ───────────────────────────────────────────────────────────────── */

function TdsTool(): React.ReactElement {
  const [section, setSection] = useState("194J(b)");
  const [amount, setAmount] = useState("60,000");
  const [prev, setPrev] = useState("0");
  const [payeeType, setPayeeType] = useState<PayeeType>("company");
  const [panOk, setPanOk] = useState(true);
  const [senior, setSenior] = useState(false);
  /* The earlier of the date of credit and the date of payment decides WHICH ACT governs the
     deduction. Defaulted to today, because today is after the changeover and the honest
     default is the law currently in force — not the label the engine was written against. */
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));

  const meta = tdsSection(section);
  const ref = statuteReference(section, eventDate);
  const formInfo = returnFormFor(section, eventDate);
  const verdict = useMemo(() => computeTds({
    section,
    amount: parseAmount(amount) ?? 0,
    previouslyPaid: parseAmount(prev) ?? 0,
    payeeType,
    panAvailable: panOk,
    isSeniorCitizen: senior,
    creditOrPaymentOn: eventDate,
  }), [section, amount, prev, payeeType, panOk, senior, eventDate]);

  return (
    <>
      <div className="card">
        <div className="card-b">
          <Field label="Section" hint={meta ? `threshold ${formatINR(meta.threshold)} ${meta.thresholdBasis} · form ${meta.form}` : undefined}>
            <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
              {TDS_TABLE.map((s) => {
                const r = statuteReference(s.section, eventDate);
                return (
                  <option key={s.section} value={s.section}>
                    {s.section} — {s.what}{r.statute === "2025" ? `  →  s.${r.section}${r.tableRef ? ` Table ${r.tableRef}` : ""}` : ""}
                  </option>
                );
              })}
            </select>
          </Field>
          <div className="row" style={{ padding: "12px 0", borderTop: 0 }}>
            <Field label="Earlier of credit / payment"
              hint="This decides which ACT governs the deduction — on or after 1 April 2026 the Income-tax Act, 2025 applies, and the 194-series label must not be quoted on the return.">
              <input className="input mono" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </Field>
            <Field label="This payment (₹)"><input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Already paid this year (₹)"><input className="input" value={prev} onChange={(e) => setPrev(e.target.value)} /></Field>
            <Field label="Payee">
              <select className="input" value={payeeType} onChange={(e) => setPayeeType(e.target.value as PayeeType)}>
                {(["individual", "huf", "company", "firm", "other"] as PayeeType[]).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <label className="check"><input type="checkbox" checked={panOk} onChange={(e) => setPanOk(e.target.checked)} />
            <span>PAN available<small>No PAN is not a rate of zero — s.206AA forces the higher of the prescribed rate or 20%.</small></span>
          </label>
          <label className="check"><input type="checkbox" checked={senior} onChange={(e) => setSenior(e.target.checked)} />
            <span>Payee is a senior citizen<small>Only 194A moves — the interest threshold becomes ₹1,00,000.</small></span>
          </label>
        </div>
      </div>
      <Result ok={verdict.applicable} headline={verdict.applicable ? "Deduct" : "No deduction"}>
        <div className="kpis" style={{ marginBottom: 10 }}>
          <div><b className="mono" style={{ fontSize: 22 }}>{formatINR(verdict.tds)}</b><span>to deduct</span></div>
          <div><b>{verdict.rate}%</b><span>rate applied</span></div>
          <div><b className="mono" style={{ fontSize: 15 }}>s.{ref.section}</b><span>quote this section</span></div>
          <div><b className="mono" style={{ fontSize: 15 }}>{verdict.formToFile ?? "—"}</b><span>form to file</span></div>
        </div>
        <div className="note" style={{ marginBottom: 10 }}>
          <b>{ref.act}</b> — {explainStatuteReference(ref)}
          <div className="hint" style={{ marginTop: 6 }}>{ref.crossReference}</div>
          {ref.tableRef === null && (
            <div className="hint" style={{ marginTop: 6 }}>
              No table item is carried for this section in ruleset {RULESET} — the rate above is computed, but do
              not quote a table reference this engine has not verified.
            </div>
          )}
        </div>
        <Basis text={verdict.basis} />
        <Basis text={formInfo.basis} />
        {verdict.warnings.length > 0 && (
          <div className="note warn" style={{ marginTop: 10 }}>
            {verdict.warnings.map((w, i) => <div key={i}>· {w}</div>)}
          </div>
        )}
      </Result>
    </>
  );
}

/* ── 3 · the 2B reconcile ──────────────────────────────────────────────────── */

const SAMPLE_BOOKS = `27AAPFU0939F1ZV, INV/2026-27/001, 2026-08-04, 1,00,000, 0, 9,000, 9,000, 18
29AABCT1332L1ZP, SB-4471, 2026-08-11, 50,000, 9,000, 0, 0, 18
29AABCT1332L1ZP, SB-4472, 2026-08-18, 25,000, 4,500, 0, 0, 18, RCM
27AAPFU0939F1ZV, INV/2026-27/001, 2026-08-04, 1,00,000, 0, 9,000, 9,000, 18`;

const SAMPLE_2B = `27AAPFU0939F1ZV, INV202627001, 2026-08-04, 1,00,000, 0, 9,000, 9,000, 18
29AABCT1332L1ZP, SB-4471, 2026-08-11, 50,000, 7,200, 0, 0, 18
27AAACR5055K1Z1, R-77, 2026-08-27, 60,000, 0, 5,400, 5,400, 18`;

/** One invoice per line: gstin, number, date, taxable, igst, cgst, sgst[, rate][, RCM]. */
function parseInvoiceLines(text: string): { invoices: Invoice[]; bad: string[] } {
  const invoices: Invoice[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const c = line.split(/\s*[,\t]\s*/);
    if (c.length < 4) { bad.push(line); continue; }
    const taxable = parseAmount(c[3] ?? "");
    if (!c[0] || !c[1] || !c[2] || taxable === null) { bad.push(line); continue; }
    const doc: Invoice = {
      gstin: c[0].toUpperCase(),
      invoiceNumber: c[1],
      invoiceDate: c[2],
      taxableValue: taxable,
    };
    const at = (i: number): number | undefined => {
      const cell = c[i];
      if (cell === undefined || cell === "") return undefined;
      const p = parseAmount(cell);
      return p === null ? undefined : p;
    };
    const igst = at(4), cgst = at(5), sgst = at(6);
    if (igst !== undefined) doc.igst = igst;
    if (cgst !== undefined) doc.cgst = cgst;
    if (sgst !== undefined) doc.sgst = sgst;
    const rate = c[7] ? Number(c[7]) : NaN;
    if (Number.isFinite(rate)) doc.rate = rate;
    if (c[8] && /^rcm$/i.test(c[8])) doc.reverseCharge = true;
    invoices.push(doc);
  }
  return { invoices, bad };
}

function ReconTool(): React.ReactElement {
  const [booksText, setBooksText] = useState(SAMPLE_BOOKS);
  const [b2Text, setB2Text] = useState(SAMPLE_2B);

  const { invoices: books, bad: badBooks } = useMemo(() => parseInvoiceLines(booksText), [booksText]);
  const { invoices: portal, bad: badPortal } = useMemo(() => parseInvoiceLines(b2Text), [b2Text]);
  const run = useMemo(() => reconcile(books, portal), [books, portal]);
  const { summary } = run;
  const findings = run.results.filter((r) => r.outcome !== "exact");

  return (
    <>
      <div className="card">
        <div className="card-b">
          <div className="row" style={{ padding: "0 0 12px", borderTop: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label className="lbl">Purchase register — your books</label>
              <textarea className="input mono" rows={7} value={booksText} onChange={(e) => setBooksText(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label className="lbl">GSTR-2B — what the portal has</label>
              <textarea className="input mono" rows={7} value={b2Text} onChange={(e) => setB2Text(e.target.value)} />
            </div>
          </div>
          <span className="hint">
            One row per document: <span className="mono">gstin, number, date, taxable, igst, cgst, sgst[, rate][, RCM]</span>.
            Amounts may be written 1,00,000 · ₹45000 · 12L — the parser is the engine's, not a model's.
            {(badBooks.length > 0 || badPortal.length > 0) && ` ${badBooks.length + badPortal.length} line(s) could not be read and are skipped, never guessed.`}
          </span>
        </div>
      </div>

      <Result ok={summary.itcAtRisk === 0} headline={`${summary.total} documents reconciled`}>
        <div className="kpis" style={{ marginBottom: 12 }}>
          <div><b>{summary.agreed}</b><span>agreed both sides</span></div>
          <div><b className="mono" style={{ fontSize: 20 }}>{formatINR(summary.itcAtRisk)}</b><span>ITC at risk</span></div>
          <div><b className="mono" style={{ fontSize: 20 }}>{formatINR(summary.itcUnclaimed)}</b><span>credit not yet in 2B</span></div>
          <div><b className="mono" style={{ fontSize: 15 }}>{summary.ruleset}</b><span>ruleset</span></div>
        </div>
        <p className="hint">
          <b>ITC at risk</b> is credit already taken that the portal does not support — a duplicate claimed twice, a
          short-paid tax where the books figure and the portal figure disagree. <b>Credit not yet in 2B</b> is the
          opposite problem: your money, waiting on a supplier who has not filed. They are never added together.
        </p>
        {findings.length === 0 ? (
          <div className="note ok" style={{ marginTop: 10 }}>Every document matched. Nothing to act on this period.</div>
        ) : (
          <div className="ledger" style={{ marginTop: 12 }}>
            <div className="lh"><span>₹ at risk</span><span>Finding</span><span>Document</span><span>Where</span><span>Basis</span></div>
            {findings.map((r, i) => (
              <div className="lr" key={i} style={{ height: "auto", padding: "12px 16px", alignItems: "flex-start" }}>
                <span className="mono">{r.itcAtRisk ? formatINR(r.itcAtRisk) : "—"}</span>
                <span className="t"><b>{OUTCOME_LABEL[r.outcome] ?? r.outcome}</b><small>{r.detail}</small></span>
                <span className="mono">{r.books?.invoiceNumber ?? r.gstr2b?.invoiceNumber ?? "—"}</span>
                <span className="mono" style={{ whiteSpace: "nowrap" }}>{r.books ? "books" : ""}{r.books && r.gstr2b ? " + " : ""}{r.gstr2b ? "2B" : ""}</span>
                <span className="mono">{RULESET}</span>
              </div>
            ))}
          </div>
        )}
      </Result>
    </>
  );
}

/* ── 4 · due dates ─────────────────────────────────────────────────────────── */

const KINDS: ReturnKind[] = ["GSTR-1", "GSTR-1A", "IFF", "GSTR-3B", "GSTR-9", "GSTR-9C", "GSTR-4", "GSTR-7", "GSTR-8", "CMP-08", "ITC-04"];

function DatesTool(): React.ReactElement {
  const [kind, setKind] = useState<ReturnKind>("GSTR-3B");
  const [period, setPeriod] = useState("2026-08");
  const [scheme, setScheme] = useState<"monthly" | "qrmp">("monthly");
  const [category, setCategory] = useState<"X" | "Y">("X");
  const [asOn, setAsOn] = useState("2026-09-24");

  const rows = useMemo(() => dueDates(kind, period, scheme, category), [kind, period, scheme, category]);

  return (
    <>
      <div className="card">
        <div className="card-b">
          <div className="row" style={{ padding: "0 0 12px", borderTop: 0 }}>
            <Field label="Return"><select className="input" value={kind} onChange={(e) => setKind(e.target.value as ReturnKind)}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Field>
            <Field label="Period (yyyy-mm)"><input className="input mono" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
            <Field label="Scheme">
              <select className="input" value={scheme} onChange={(e) => setScheme(e.target.value as "monthly" | "qrmp")}>
                <option value="monthly">monthly</option><option value="qrmp">QRMP</option>
              </select>
            </Field>
            <Field label="QRMP group" hint="Category X files 3B on the 22nd, Y on the 24th.">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value as "X" | "Y")}>
                <option value="X">X</option><option value="Y">Y</option>
              </select>
            </Field>
            <Field label="As on"><input className="input mono" value={asOn} onChange={(e) => setAsOn(e.target.value)} /></Field>
          </div>
        </div>
      </div>
      <Result ok headline={`${kind} · ${period}`}>
        {rows.map((d, i) => {
          const late = daysOverdue(d.due, asOn);
          return (
            <div key={i}>
              <div className="kpis" style={{ marginBottom: 8 }}>
                <div><b className="mono" style={{ fontSize: 22 }}>{d.due}</b><span>due date</span></div>
                <div><b>{late > 0 ? `${late} day${late === 1 ? "" : "s"} overdue` : "in time"}</b><span>as on {asOn}</span></div>
                <div><b className="mono" style={{ fontSize: 14 }}>{d.ruleset}</b><span>ruleset</span></div>
              </div>
              <Basis text={d.basis} />
            </div>
          );
        })}
      </Result>
    </>
  );
}

/* ── 5 · e-invoice and e-way ───────────────────────────────────────────────── */

function EInvoiceTool(): React.ReactElement {
  const [aatoCr, setAatoCr] = useState("12");
  const [docDate, setDocDate] = useState("2026-08-01");
  const [asOn, setAsOn] = useState("2026-08-26");
  const [km, setKm] = useState("450");
  const [cargo, setCargo] = useState<"normal" | "over-dimensional">("normal");

  const aato = rupeesToPaise((Number(aatoCr) || 0) * 1e7);        // ₹ crore → paise
  const status = eInvoiceStatus(aato);
  const window = useMemo(() => checkIrnWindow(docDate, aato, asOn), [docDate, aato, asOn]);
  const eway = ewayBillValidity(Number(km) || 0, cargo);

  return (
    <>
      <div className="card">
        <div className="card-b">
          <div className="row" style={{ padding: "0 0 12px", borderTop: 0 }}>
            <Field label="Turnover (₹ crore)" hint="AATO in any year since 2017-18 keeps you in scope."><input className="input" value={aatoCr} onChange={(e) => setAatoCr(e.target.value)} /></Field>
            <Field label="Document date"><input className="input mono" value={docDate} onChange={(e) => setDocDate(e.target.value)} /></Field>
            <Field label="As on"><input className="input mono" value={asOn} onChange={(e) => setAsOn(e.target.value)} /></Field>
            <Field label="Distance (km)"><input className="input" value={km} onChange={(e) => setKm(e.target.value)} /></Field>
            <Field label="Cargo">
              <select className="input" value={cargo} onChange={(e) => setCargo(e.target.value as "normal" | "over-dimensional")}>
                <option value="normal">normal</option><option value="over-dimensional">over-dimensional</option>
              </select>
            </Field>
          </div>
        </div>
      </div>
      <Result ok={window.status !== "blocked"} headline={`IRN window — ${window.status.replace("-", " ")}`}>
        <div className="kpis" style={{ marginBottom: 10 }}>
          <div><b>{status.mandated ? "mandatory" : "not mandated"}</b><span>e-invoicing at this turnover</span></div>
          <div><b className="mono" style={{ fontSize: 22 }}>{window.deadline}</b><span>report by</span></div>
          <div><b>{status.thirtyDayLimit ? `${window.daysLeft} days left` : "no 30-day limit"}</b><span>from the document date</span></div>
        </div>
        <p>{window.finding}</p>
        <Basis text={status.reason} />
        <p className="hint" style={{ marginTop: 8 }}><b>E-way bill — </b>{eway.days} day{eway.days === 1 ? "" : "s"} of validity for {km} km{cargo === "over-dimensional" ? " over-dimensional" : ""}. {eway.basis}</p>
      </Result>
    </>
  );
}

/* ── 6 · MSME, the 43B(h) clock ────────────────────────────────────────────── */

function MsmeTool(): React.ReactElement {
  const [vendor, setVendor] = useState("SmallCo Industries");
  const [amount, setAmount] = useState("1,00,000");
  const [invoiceDate, setInvoiceDate] = useState("2026-06-01");
  const [acceptedOn, setAcceptedOn] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [enterprise, setEnterprise] = useState<EnterpriseClass>("small");
  const [agreement, setAgreement] = useState(true);
  const [asOn, setAsOn] = useState("2026-09-30");
  const [sector, setSector] = useState<"manufacturing" | "services">("services");
  const [investmentCr, setInvestmentCr] = useState("1");
  const [turnoverCr, setTurnoverCr] = useState("3");

  const clock = paymentDeadline(invoiceDate, enterprise, {
    writtenAgreement: agreement,
    ...(acceptedOn ? { acceptedOn } : {}),
  });
  const aged = useMemo(() => assessPayables([{
    vendor,
    invoiceNumber: "—",
    invoiceDate,
    amount: parseAmount(amount) ?? 0,
    enterprise,
    writtenAgreement: agreement,
    ...(acceptedOn ? { acceptedOn } : {}),
    ...(paidOn ? { paidOn } : {}),
  }], asOn), [vendor, amount, invoiceDate, acceptedOn, paidOn, enterprise, agreement, asOn]);
  const row = aged.rows[0];
  const classified = classifyEnterprise(sector, (Number(investmentCr) || 0) * 1e7, (Number(turnoverCr) || 0) * 1e7);

  return (
    <>
      <div className="card">
        <div className="card-b">
          <div className="row" style={{ padding: "0 0 12px", borderTop: 0 }}>
            <Field label="Vendor"><input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
            <Field label="Amount (₹)"><input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Invoice date"><input className="input mono" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
            <Field label="Accepted on" hint="The clock runs from acceptance, not the invoice date."><input className="input mono" value={acceptedOn} onChange={(e) => setAcceptedOn(e.target.value)} placeholder="defaults to invoice date" /></Field>
            <Field label="Paid on"><input className="input mono" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} placeholder="still unpaid" /></Field>
          </div>
          <div className="row" style={{ padding: "0 0 8px", borderTop: 0 }}>
            <Field label="Supplier class">
              <select className="input" value={enterprise} onChange={(e) => setEnterprise(e.target.value as EnterpriseClass)}>
                {(["micro", "small", "medium", "not-msme", "unknown"] as EnterpriseClass[]).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="As on"><input className="input mono" value={asOn} onChange={(e) => setAsOn(e.target.value)} /></Field>
            <label className="check"><input type="checkbox" checked={agreement} onChange={(e) => setAgreement(e.target.checked)} />
              <span>Written agreement exists<small>45 days with one, 15 without.</small></span>
            </label>
          </div>
        </div>
      </div>

      <Result ok={!row || row.disallowanceExposure === 0} headline={clock.covered ? `Due ${clock.dueBy} — covered by 43B(h)` : "Outside 43B(h)"}>
        <div className="kpis" style={{ marginBottom: 10 }}>
          <div><b>{clock.daysAllowed}</b><span>days allowed</span></div>
          <div><b className="mono" style={{ fontSize: 20 }}>{row ? formatINR(row.disallowanceExposure) : "—"}</b><span>disallowance exposure</span></div>
          <div><b>{row && row.daysOverdue > 0 ? `${row.daysOverdue} days late` : "not late"}</b><span>as on {asOn}</span></div>
        </div>
        <p>{row?.finding ?? clock.basis}</p>
        <Basis text={clock.basis} />
        <p className="hint" style={{ marginTop: 8 }}>
          <b>Udyam check — </b>{investmentCr} cr investment, {turnoverCr} cr turnover, {sector} → <b>{classified}</b>
          {classified === "medium" ? ". A medium enterprise is not covered by 43B(h): paying late is a commercial problem, not a disallowance." : "."}
        </p>
      </Result>

      <div className="card">
        <div className="card-b">
          <div className="row" style={{ padding: "0 0 4px", borderTop: 0 }}>
            <Field label="Sector"><select className="input" value={sector} onChange={(e) => setSector(e.target.value as "manufacturing" | "services")}><option value="manufacturing">manufacturing</option><option value="services">services</option></select></Field>
            <Field label="Investment (₹ crore)"><input className="input" value={investmentCr} onChange={(e) => setInvestmentCr(e.target.value)} /></Field>
            <Field label="Turnover (₹ crore)"><input className="input" value={turnoverCr} onChange={(e) => setTurnoverCr(e.target.value)} /></Field>
          </div>
          <Basis text="Udyam classification limits as notified — the thresholds differ between manufacturing and services, so the sector is part of the answer, not decoration." />
        </div>
      </div>
    </>
  );
}

/* ── 7 · interest and late fee ─────────────────────────────────────────────── */

function FeeTool(): React.ReactElement {
  const [tax, setTax] = useState("1,00,000");
  const [from, setFrom] = useState("2026-09-20");
  const [to, setTo] = useState("2026-10-20");
  const [basis, setBasis] = useState<InterestBasis>("s.50(1)");
  const [kind, setKind] = useState<"GSTR-1" | "GSTR-3B" | "GSTR-9">("GSTR-3B");
  const [nil, setNil] = useState(false);
  const [turnoverClass, setTurnoverClass] = useState<TurnoverClass>("up-to-1.5cr");

  const interest = useMemo(() => interestOnLateTax(parseAmount(tax) ?? 0, from, to, basis), [tax, from, to, basis]);
  const fee = lateFee(kind, from, to, { nil, turnoverClass });

  return (
    <>
      <div className="card">
        <div className="card-b">
          <div className="row" style={{ padding: "0 0 12px", borderTop: 0 }}>
            <Field label="Tax short-paid (₹)" hint="Interest runs on the net CASH liability — credit wrongly used is the 24% case."><input className="input" value={tax} onChange={(e) => setTax(e.target.value)} /></Field>
            <Field label="Due date"><input className="input mono" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Paid / filing on"><input className="input mono" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Interest basis">
              <select className="input" value={basis} onChange={(e) => setBasis(e.target.value as InterestBasis)}>
                <option value="s.50(1)">s.50(1) — 18%</option>
                <option value="s.50(3)">s.50(3) — 24%</option>
              </select>
            </Field>
          </div>
          <div className="row" style={{ padding: "0 0 4px", borderTop: 0 }}>
            <Field label="Return"><select className="input" value={kind} onChange={(e) => setKind(e.target.value as "GSTR-1" | "GSTR-3B" | "GSTR-9")}><option value="GSTR-1">GSTR-1</option><option value="GSTR-3B">GSTR-3B</option><option value="GSTR-9">GSTR-9</option></select></Field>
            <Field label="Turnover class">
              <select className="input" value={turnoverClass} onChange={(e) => setTurnoverClass(e.target.value as TurnoverClass)}>
                <option value="up-to-1.5cr">up to ₹1.5 cr</option>
                <option value="1.5-to-5cr">₹1.5–5 cr</option>
                <option value="above-5cr">above ₹5 cr</option>
              </select>
            </Field>
            <label className="check"><input type="checkbox" checked={nil} onChange={(e) => setNil(e.target.checked)} />
              <span>Nil return<small>₹20 a day instead of ₹50 — and the cap is different.</small></span>
            </label>
          </div>
        </div>
      </div>
      <Result ok={interest.interest === 0 && fee.fee === 0} headline="Interest and late fee">
        <div className="kpis" style={{ marginBottom: 10 }}>
          <div><b className="mono" style={{ fontSize: 22 }}>{formatINR(interest.interest)}</b><span>interest · {interest.ratePercent}%</span></div>
          <div><b className="mono" style={{ fontSize: 22 }}>{formatINR(fee.fee)}</b><span>late fee · {fee.days} days</span></div>
          <div><b className="mono" style={{ fontSize: 20 }}>{formatINR(interest.interest + fee.fee)}</b><span>total on this period</span></div>
        </div>
        <Basis text={interest.basis} />
        <Basis text={fee.basis} />
        {fee.capped && <div className="note warn" style={{ marginTop: 10 }}>The late-fee cap has bitten — a return two years late is not a two-year fee. The cap is set by turnover class, not by how long you waited.</div>}
      </Result>
    </>
  );
}

/* ── the pack, as sections any surface can host ────────────────────────────── */

/**
 * The finance tools. Exported rather than inlined into the door because the generalist
 * Specialists surface hosts exactly this panel — the domain lives in one place and is
 * mounted in two, which is what stops a second copy of a tool drifting from the first.
 */
export function MunshiTools(): React.ReactElement {
  const [tab, setTab] = useState<ToolId>("gstin");
  return (
    <>
      <div className="seg">
        {TOOLS.map((t) => (
          <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === "gstin" && <GstinTool />}
      {tab === "tds" && <TdsTool />}
      {tab === "recon" && <ReconTool />}
      {tab === "dates" && <DatesTool />}
      {tab === "einvoice" && <EInvoiceTool />}
      {tab === "msme" && <MsmeTool />}
      {tab === "fee" && <FeeTool />}

      <div className="note" style={{ marginTop: 14 }}>
        <b>These engines compute; they do not file.</b> Nothing here touches GSTN, a bank or a portal, and nothing
        leaves this machine. Filing needs credentials and a GSP/ASP channel — an operator-granted capability. The
        agents that end in a filing or a payment are marked <b>gated</b> below and stay behind the human decision.
      </div>
    </>
  );
}

/**
 * The finance roster. `domain` is controlled by the host when the host already offers a
 * domain selector; left undefined, this section renders its own.
 */
export function MunshiRoster({ domain }: { domain?: Domain | "all" } = {}): React.ReactElement {
  const [own, setOwn] = useState<Domain | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const active = domain ?? own;
  const listed = active === "all" ? AGENTS : agentsByDomain(active);
  const domains = Object.keys(DOMAIN_LABEL) as Domain[];

  return (
    <>
      {domain === undefined && (
        <div className="seg">
          <button aria-pressed={own === "all"} onClick={() => setOwn("all")}>all {AGENTS.length}</button>
          {domains.map((d) => (
            <button key={d} aria-pressed={own === d} onClick={() => setOwn(d)}>{DOMAIN_LABEL[d]} {agentsByDomain(d).length}</button>
          ))}
        </div>
      )}

      <div className="ledger">
        <div className="lh"><span>·</span><span>Specialist</span><span>Domain</span><span>Runs on</span><span>Gate</span></div>
        {listed.map((a) => (
          <React.Fragment key={a.id}>
            <button className={`lr ${open === a.id ? "open" : ""}`} onClick={() => setOpen(open === a.id ? null : a.id)}>
              <span className={`dot ${a.requiresApproval ? "pending" : "ok"}`} />
              <span className="t"><b>{a.name}</b><small className="mono">{a.id}</small></span>
              <span className="mono">{DOMAIN_LABEL[a.domain] ?? a.domain}</span>
              <span className="mono">{a.status === "engine" ? "engine" : "workflow"}</span>
              <span className={`pill ${a.requiresApproval ? "warn" : "ok"}`}>{a.requiresApproval ? "gated" : "open"}</span>
            </button>
            {open === a.id && (
              <div className="ld">
                <p>{a.purpose}</p>
                <p className="hint"><b>Engine — </b><span className="mono">{a.engine}</span></p>
                <p className="hint"><b>In — </b>{a.inputs}</p>
                <p className="hint"><b>Out — </b>{a.output}</p>
                <p className="hint"><b>The receipt attests — </b>{a.receipt}</p>
                {a.requiresApproval && (
                  <p className="hint"><b>Gate — </b>this agent ends at a filing, a payment or a filed document. It prepares; a human decides; the decision is recorded.</p>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

/* ── the finance door, composed ────────────────────────────────────────────── */

/** Kept as a door of its own as well as a panel: the finance desk reads better alone. */
export function Munshi(): React.ReactElement {
  const roster = rosterStatus();
  return (
    <>
      <header className="top">
        <h2>Munshi</h2>
        <span className="sub">Indian finance desk · {roster.total} specialists · ruleset {RULESET}</span>
        <div className="right"><span className="pill mono">computed on this machine</span></div>
      </header>
      <div className="scroll"><div className="page narrow">
        <div className="kpis">
          <div><b>{roster.total}</b><span>specialists</span></div>
          <div className="sep" />
          <div><b>{roster.engine}</b><span>deterministic engines</span></div>
          <div className="sep" />
          <div><b>{roster.requiringApproval}</b><span>stop at a human gate</span></div>
          <div className="sep" />
          <div><b className="mono" style={{ fontSize: 17 }}>{RULESET}</b><span>ruleset stamped on every result</span></div>
        </div>

        <MunshiTools />

        <h3 style={{ margin: "22px 2px 10px" }}>The specialists</h3>
        <MunshiRoster />
      </div></div>
    </>
  );
}
