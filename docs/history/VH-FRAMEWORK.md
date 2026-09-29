# THE VH FRAMEWORK — text edition (PPT-ready)
*Vouch Harbor Labs · VH 19.7.12 "Keyholder" (UI) · the complete product framework in one document.*
*Write your deck from this file. Every claim here is probe-pinned in this archive.*

---

## 1 · THE LINE
**VH — the accountable agent OS.** AI agents that work on your machine and prove everything they did.

## 2 · THE PURPOSE
Make AI work auditable — so enterprises can trust agents the way they trust signed contracts.

## 3 · THE PAIN
Enterprises deploy agent fleets they cannot audit. Chat logs are not evidence. Today's answer is "trust our logs." Regulation (EU AI Act evidence duties, in force) has made assurance a procurement requirement. 84% of security leaders doubt they could pass an agent-focused compliance audit; agents already outnumber human users ~82-to-1 in enterprises.

## 4 · THE INSIGHT
Capability is commoditized — nine major frameworks all score 10/10 on tool use, and none ships a native policy gate. The 2026 question is PROOF. Proof is a runtime, not a feature. Ship the boundary as the product.

## 5 · THE PRODUCT — one console, one engine, hands included
| Surface | Role |
|---|---|
| The Console | The app IS one dark operations console: crew rail, run stream, handoff ledger, federation plane — every bubble rides its honesty chips |
| The Generalist | One face at the door — deterministic, derived from the name its owner gives it; routes the bench, runs the gate, synthesises the crew |
| Mission Loop | COMPOSE → DISPATCH → COMMUNICATE → EXECUTE → GATE → ADAPT over 25 agent CLIs |
| Proof | The signed receipt vault — every action, every mission, every self-change |
| Audit | Assurance Score, FinOps chargeback, incident black box, EU AI Act / ISO 42001 / SOC 2 crosswalk |
| Federation | Cross-owner crossings under standing authority, one common ledger, regulated activation |

## 6 · THE FIVE CORE CAPABILITIES
1. **THE HUMAN GATE** — risk-tiered approval inside the run; approvals AND refusals receipted. Autonomy is exam-earned, category-scoped, revocable; the override floor is structural.
2. **SIGNED RECEIPTS** — hash-chained, HMAC-sealed, signed; verifiable offline on a machine that never saw the app.
3. **REAL EXECUTION** — 1,150 routed specialists (1,790 catalogued incl. registered), five gated tools on a real workspace, Captain synthesis over actually-executed answers.
4. **BRING YOUR OWN AGENT** — external agents join under a trust intersection: TLS-by-default, rate ceilings, injection-scanned, delegation receipted.
5. **CROSS-OWNER FEDERATION** — two owners' agents working together with a human decision on BOTH sides and evidence either side can verify offline (below).

## 7 · THE AUTHORITY SUITE — the moat
*Answers the five unsolved gaps named by the 2026 agent-identity literature. Mandates sign asymmetrically (ECDSA P-256): the owner signs, anyone verifies.*

### 7.1 MANDATE PASSPORT — Know Your Agent (KYA)
A signed, portable mandate: scope, budget ceiling that DECAYS as the agent operates, expiry, and the human owner's signature. No passport, no action. Standards bodies are drafting this; VH ships it.

### 7.2 CHAIN OF AUTHORITY — delegation provenance
Every delegation hop commits BOTH principals; scope can only SHRINK per hop (monotonic attenuation); the chain rides inside the receipts. Named by researchers as the gap with NO production protocol anywhere — this is it.

### 7.3 INTENT RECEIPTS — measured honesty
Before a risky action the agent declares its intent IN WORDS; the gate approves the intent, not just the action; declared-vs-executed DIVERGENCE is measured and receipted. VH never claims to read intent — it measures the gap between declared and executed.

### 7.4 AGENT WARRANTY PACK — assurance as an asset
The signed receipt history exported as an insurance/contract artifact: missions, approvals, refusals, intent-convergence rate, violations — sealed. Telemetry + auditability is exactly what insurers and courts ask for.

### 7.5 LIABILITY MAP — who owed what, hop by hop
From a verified chain: the responsibility map across every principal, owner first. The artifact legal teams need after an incident, generated before one happens.

## 8 · VOUCHMESH™ — bot-to-bot collaboration, made strong
*Bots don't trust each other. They vouch for each other — with receipts.*
1. **Registered peers only** — unknown bots cannot join; TLS-by-default identity digests.
2. **Mutual attestation** — both bots sign each other's capabilities; one-sided trust is refused.
3. **Joint receipts** — every shared mission is CO-SIGNED by every participant; collaboration becomes one artifact both parties are bound to, verifiable offline forever.
4. **Compounding trust** — clean joint receipts raise a pair's standing (probation → vouched → proven); divergence decays it.
5. **Quarantine** — a peer that breaks the mesh is ejected WITH a receipt; the mesh keeps working.

## 9 · THE FEDERATION PLANE — approve once, then autonomous; the evidence stays
1. **Standing authority** — both owners sign ONE bounded grant (enumerated capabilities, never `*`; total budget; rate window; expiry). Each crossing keeps its own envelope and nonces and mints an acknowledgement bound to that envelope digest. Out-of-scope, spent, lapsed or revoked grants ESCALATE to a per-crossing human decision — escalation is designed behaviour, never an error. A grant never overrides earned pair standing.
2. **One common place to check** — both stores write the SAME joint row, receipts included; each side derives its root independently; the roots are compared on the receipt itself. Divergence is named in words down to the crossing id.
3. **Regulated activation** — the registered regulated bench (230 specialists) stays unrouted until a signed, complete, current activation exists; the refusal names every gap. A name is not an authorisation.
4. **On the live path** — the console issues grants, runs crossings and reads the ledger through the same seam the probes pin (19.6.6): no subsystem sitting beside the runtime.

## 10 · AGENTS WORKING TOGETHER (what VH ships)
- Multi-specialist missions: each member runs its own provider call + receipt; Captain synthesis over real executed outputs only.
- The Shipyard: a whole brief → one work order per domain, each supervised by its Captain; DONE means genuinely executed.
- Team-Evolve: two users' VH instances share a team; evolution requires EVERY member's explicit approval.
- Collaboration desk: ECDSA-signed invitations + signed approvals + A2A inbound, receipts both ways.

## 11 · RSIRALS v5.0 — trust-rooted self-improvement
"The agent may evolve everything about itself — except the authority that judges whether its evolution is allowed."
Evidence curriculum from five sources → human-gated apply → frozen digest-stamped playbooks → sealed receipt-bound promotion → canary auto-rollback → longitudinal monitor. Frozen governance plane (∂T/∂A = 0). Honest θ-arm: no in-product weight training.

## 12 · THE COMPUTER-USE PLANE — hands, governed
`pc.exec`: allowlisted binaries, injection-scanned arguments, hard timeouts, receipted runs.
Built-in headless browser: per-mission isolated profiles, HTTPS-by-policy, critical actions hand over to the human gate, screenshots that refuse wordingly when no browser binary exists — a page is never faked.

## 13 · PROOF MACHINERY
The Drill (real git repos; a scenario that MUST fail) · 137 probe suites · 136 zero-install offline bundles · Agentic Test Protocol 24/24 · VH-Bench (40 tasks × 10 categories × failure injection × Pass@k) · independent source-level review ≈9.9/10.

## 14 · NAMING GLOSSARY (use these words)
| Name | Meaning |
|---|---|
| VH | the product — the accountable agent OS |
| The Console | the one dark operations console — the app itself |
| The Generalist | the one agent at the door; its face is derived from the name its owner gives it |
| The Bench | 1,150 routed specialists + 640 registered (1,790 catalogued) |
| The Gate | the human approval point inside the run |
| The Receipt | the signed, offline-verifiable evidence unit |
| RSIRALS | the proprietary trust-rooted self-improvement architecture |
| The Authority Suite | Mandate Passport · Chain of Authority · Intent Receipts · Warranty Pack · Liability Map |
| VOUCHMESH™ | the bot-to-bot trust fabric |
| Standing Grant | the once-signed, bounded cross-owner authorisation |
| Common Ledger | the joint row both stores hold, roots compared on the receipt |
| The Reach Bench | the 140 computer-use-era specialists |
| The Regulated Bench | the 230 registered specialists that route only under signed activation |
| The Computer-Use Plane | pc.exec + the built-in headless browser |
| The Drill | the product proving itself on demand |


## 15 · THE CLOSE
**They watch the screen. We sign the work.**
Next step: a live verification session — the full fleet, the agentic test and the security battery, run in front of you from this archive.

---
*Honesty rules of this document: pre-revenue by stage — these are engineering facts, not traction. Where competitors disclose nothing, we write "not disclosed". Founder fields are never invented. The single-machine federation demo models both owners on one machine and says so on the receipt; the two-instance transport is the next milestone, not a claim of this build.*
