# VH-19 — Multi-Agent MoE Generalist: Build Plan (release 18.0.0)

> Base: Vouch Harbor 17.10.7 "WarrantTeams" (all gates green: tsc 0, protocol 171/171,
> unit 20/20, 107/107 live probes on node v20.20.2).
> Goal of this release: the **VH-19 Generalist layer** — one front door, an internal
> Mixture-of-Experts specialist bench, provider-pluggable real model calls, accept/reject
> learning, and the 90% autonomy exam — built on the existing governed pipeline
> (human gate, receipts, GuardRail, egress guard), never around it.

## What ships in 18.0.0 (this release)

### 1. Engine — `src/vh19/` (new, zero new runtime dependencies)
| Module | Role |
|---|---|
| `types.ts` | Shared contracts (Specialist, RouteDecision, DecisionRecord, ExamSession, GeneralistResponse). |
| `registry.ts` | The specialist bench: typed catalog of real specialists across 10 categories, each with capabilities, keywords, risk tier, system prompt, provenance. Honest computed digest. Architecture scales to hundreds; the shipped count is stated honestly (seed catalog, not a padded number). |
| `router.ts` | The MoE-style autonomous router: deterministic capability/keyword scoring, top-K selection with reasons, multi-specialist strategy, honest `no-match`. Optional LLM re-rank when a provider key exists — never a fake LLM. |
| `providers.ts` | OpenAI-compatible / Anthropic / Gemini adapters. Documented base URLs (`https://api.openai.com/v1`, `https://api.anthropic.com`, `https://generativelanguage.googleapis.com/v1beta`), baseURL overrides for proxies/gateways, keys from env only (never hardcoded, never logged, redaction helper), SSRF-safe via the existing `checkEgressUrl` guard, honest refusal when unconfigured. |
| `memory.ts` | Accept/reject learning ledger: local-first, per-user, capped, append-only records with reasons + pattern model. Cloud vector store: **opt-in interface, disabled by default, honestly labeled "not configured"** — no fake sync. |
| `exam.ts` | The 90% autonomy exam: questions generated from the user's REAL recorded scenarios, agent proposes + explains its own answer, user grades (Correct/Wrong + correction box), ≥90% grants autonomy with permanent monitor+override, <90% returns to the learning loop. Wrong answers + corrections flow back into memory. |
| `generalist.ts` | The VH-19 front door: intake → GuardRail scan → memory context → route → dispatch → human gate for risky → honest result. No provider configured → plans and routes but marks `executed: false` in words. Never fabricates an answer. Peer collaboration delegates through the existing A2A bridge (real, receipt-sealed). |

### 2. Proof — `probe/vh19.test.ts`
New probe suite (~40 checks): registry integrity, router determinism + honesty,
provider refusal/redaction/egress, memory ledger behavior, exam math at the 89/90
boundary, generalist end-to-end with injected deps, anti-cheat (no execution claim
without execution), autonomy override permanence.

### 3. Release engineering
- Version 17.10.7 → **18.0.0** across every manifest `versionDrift` pins
  (package.json, package-lock.json, Cargo.toml, Cargo.lock, tauri.conf.json,
  verify/BUILD-INFO.txt), `src/version.ts` (codename "Generalist"), current-facing docs.
- CHANGELOG entry; offline verification pack rebuilt so suite counts and byte pins hold.
- Full gates re-run: typecheck, unit, protocol selftest, **entire** live probe fleet.
- Shipped as `vouchharbor-18.0.0.zip` (source tree, no node_modules/.git/dist).

## Honest scope decisions (what does NOT ship in 18.0.0, and why)

1. **Mastra / VoltAgent / AI-SDK source merge — deferred to 18.1.** Research confirms
   Mastra core is Apache-2.0 (mergeable) and built on the Vercel AI SDK. But the stated
   #1 priority is security: a large vendored framework is a supply-chain surface that
   needs its own audit + upgrade pipeline, and no live model keys exist in this
   environment to validate real calls through it. 18.0.0 ships a zero-dependency,
   fully-probed provider layer with the same base-URL contract the AI SDK uses, so the
   merge is a drop-in later (adapter seam already shaped like `ai`'s providers).
2. **300–500 specialists — architecture yes, padded numbers no.** The registry + router
   scale to hundreds; the seed catalog ships real, individually-specified specialists.
   A catalog of 300 fake entries would not survive diligence and violates the product's
   own honesty rule.
3. **Cloud vector store — interface only, opt-in, off.** Local ledger is fully real.
4. **MCP surface additions — deferred.** The 20-governed-tool count is pinned across the
   probe fleet; expanding it is a deliberate release of its own (pins updated together).
5. **Simulated seats stay — labeled.** The browser-host simulation and deterministic
   drill seats are honestly-labeled test/demo machinery (the product's gates depend on
   them). What was actually fake (the A2A completion template literal) was already
   removed in 17.10.7. Nothing unlabeled-simulated ships.

## Phase 2 (post-funding roadmap, ready to execute)
- Mastra merge behind the provider/specialist seam + specialist catalog expansion.
- VH-19 UI door (chat face) + MCP tools (`vh19_ask`, `vh19_exam`, `vh19_memory`).
- Team-Evolve cross-user: evolved team configs as receipt-vouched, reusable artifacts
  over the existing A2A runtime (the wire, gates and receipts already exist).
- Cloud vector sync (opt-in) with per-user encryption at rest.
