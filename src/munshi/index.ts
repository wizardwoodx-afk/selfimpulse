/**
 * Munshi — the Indian-finance specialist pack.
 *
 * "Munshi" is the traditional term for the accountant who kept the books: the person a
 * business trusted with the ledger, the returns and the deadlines. This module is that
 * role, expressed as a set of specialist agents that run on the 11Handle substrate —
 * so every computation they produce can be signed, receipted and re-verified, and every
 * filing they prepare stops at a human gate.
 *
 * ── THE DESIGN RULE THAT MATTERS MOST ────────────────────────────────────────────
 * Tax arithmetic is NOT delegated to a language model. Every number in this pack comes
 * from a deterministic TypeScript engine with integer-paise money and a dated ruleset.
 * The model's job is to read messy input, explain a finding and draft a response; the
 * engine's job is to be right. A plausible-sounding wrong ITC figure is worse than no
 * figure at all, and a wrong rupee amount is indistinguishable from a right one to the
 * person signing the return.
 *
 * ── RULESET DISCIPLINE ───────────────────────────────────────────────────────────
 * Indian indirect tax moved hard in 2025–26: the four-slab structure collapsed to
 * nil/5/18/40 on 22 September 2025; GSTR-3B auto-populated liabilities are hard-locked
 * from the July 2025 period; e-invoice reporting has a 30-day hard stop above a ₹10 crore
 * AATO. An engine carrying 2017-era rates would not be out of date — it would be
 * actively harmful. So every table here is stamped with the ruleset it belongs to and
 * the basis it comes from, and `RULESET` is a value you can print, log and compare.
 *
 * ── WHERE THE HUMAN GATE SITS ───────────────────────────────────────────────────
 * These agents PREPARE. They do not file. Filing requires GSTN credentials and a GSP/ASP
 * channel, which is a capability the operator grants, not a capability the pack assumes.
 * Every agent that ends in a filing or a payment returns a `requiresApproval` subject so
 * the 11Handle gate cannot be bypassed by a specialist that "felt confident".
 */
export { RULESET, RULESET_BASIS, rulesetStamp } from "./ruleset";
export * from "./money";
export type { Invoice, MatchOutcome, MatchResult, TaxPeriod, FinancialYear, StateCode, StateName } from "./types";
export * from "./gstin";
export * from "./period";
export * from "./gst/itc";
export * from "./gst/returns";
export * from "./gst/statutory";
export * from "./tds";
export * from "./tdsStatute";
export * from "./msme";
export { AGENTS, agentsByDomain, findAgent, agentCount, rosterStatus, type Agent, type Domain } from "./agents";
