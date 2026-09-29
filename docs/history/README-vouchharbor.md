# Vouch Harbor 19.7.12 — the accountable agent OS (govern · execute · verify · learn)

> **The proof layer for agent work.** Vouch Harbor runs fleets of AI coding agents on your own machine and turns every mission into signed, independently verifiable evidence — the assurance runtime for the age of agent audits.

### Why this beats the consumer agent wave (GROKBOT, MUSE and the rest)

The 2026 consumer agents — xAI's GROKBOT, Meta's MUSE — are polished walled
gardens: named first-party bots, shared cloud computers, taught tasks,
routines, app connectors, human-approval pauses. Vouch Harbor ships the same
surface area and then goes where none of them do:

| They offer | Vouch Harbor ships instead |
|---|---|
| First-party named bots only | **BYOA** — any external agent registers under a declared risk ceiling and joins through the same gate + ledger (19.4.1) |
| "Teach-a-Task" skills in their cloud | **Bounded RSI** — a curriculum from the agent's own evidence ledger drafts frozen, digest-stamped playbooks; apply/reject is always human; a floor the loop can never touch (19.4.1) |
| Human-approval pauses | A graded human gate with risk tiers, receipts for APPROVALS AND REFUSALS, and a replayable audit chain |
| Cloud-computer execution | On-device execution (File System Access API / Tauri shell) plus the same engine as an MCP router and an A2A host |
| Conversational connectors | Governed connector declarations + SKILL.md ecosystem import — playbooks with provenance, no silent egress, one SSRF-guarded network policy |
| No model picker, gated behind a heavy subscription | Bring your own model/provider endpoint; local-first; keys are session-only by default, or encrypted at rest in the local owner vault |

They watch the screen; we sign the work. The full RSI design — with the 2026 landscape (AlphaEvolve, Darwin Gödel Machine, Gödel Agent, STOP, SEAL, ADAS, RSIAgent) mapped against it — lives in [docs/RSI-FRAMEWORK.md](docs/RSI-FRAMEWORK.md), and the proprietary trust-rooted architecture in [docs/RSIRALS.md](docs/RSIRALS.md).

### The current product state (19.7.12 [Keyholder] (UI))

### NEW in 19.7.2.2 [Agent] — the crew works on its own: 700 new specialists, an Agentic MoE, an initiative loop that EXECUTES, runtime-enforced BEW, and a 3D memory graph

**The fleet deepened by 700 finished professionals.** 350 finance
specialists (`src/vh19/financeBench.ts`) — 200 India-focused (GST filings
and GSTR-2B reconciliation, e-invoice/e-way bill, TDS 24Q/26Q/27Q and
26AS/AIS matching, UPI/gateway/nostro settlement recon, Ind AS, SEZ/EXIM,
NBFC and MSME work incl. 43B(h)) and 150 international (US GAAP/SEC,
IFRS, Pillar Two, UK/EU/APAC/GCC indirect tax, AML/sanctions, FP&A,
SOX/PCAOB, M&A quality of earnings). 350 semiconductor specialists
(`src/vh19/siliconBench.ts`) covering the whole lifecycle — architecture →
RTL → UVM DV → synthesis/DFT → place-and-route → sign-off (STA/DRC/LVS/
EM-IR) → tapeout → fab/ATE → packaging → bring-up → reliability/yield —
each entry carrying a sign-off contract: commands, corners and waiver
owners per claim. **Every sub-agent is governed by the Behaviour
Enforcement Workflow [BEW]** (`src/vh19/bew.ts`) — enforced TWICE: the
six phases (intake, plan, act, verify, recover, report), the error
ladder (transient/bad-input/blocked/gate), the task ladders and the
debug-first discipline ride every composed prompt, AND the member agent
loop carries a runtime phase machine (`BewRun`): the trail is recorded
as it executes, a run that cannot prove VERIFY cannot claim done
(truncated ⇒ partial, downgraded by the machine), recoveries are capped
at one, and every member run ships a BEW receipt with its violations.

**The AGENTIC MIXTURE OF EXPERTISE** (`src/vh19/moe.ts`) is sparse
specialist routing over the WHOLE established fleet (all 1,850, every
category — the new benches get no shortcut and no exclusion; this is
agent-level routing, not a transformer MoE, and it says so): a
deterministic gate tiers the request (point/standard/complex → 1/2/3
experts), the top-ranked expert always enters, and each additional one
must add marginal coverage (a new domain or new capabilities) or is
pruned with a stated reason. **The INITIATIVE engine**
(`src/vh19/initiative.ts`) doesn't just plan — safe acts EXECUTE through
the real engine (askVH19 → routing → MoE → member loops → gated tools →
receipts): the heartbeat evaluates due follow-ups, pending goals and
memory drift, executes what is safe through the SHARED production
executor (the same askVH19 dep set a typed chat message takes —
provider, human gate, handoff recorder, evidence fetch), feeds failures
to a 3-strike circuit breaker, reschedules partials as capped verify
check-backs, and receipts every verdict in Settings → Autonomy. The
integration probe drives that exact executor against a scripted
provider and watches real member loops answer on the wire. Proposals never
self-execute; risky work always stops at the human gate; runs while the
window is open — stated plainly. Gate-blocked runs leave a capped
check-back on the heartbeat automatically. **The memory graph is now
3D and touchable** (`src/vh19/graph3d.ts`): a hand-rolled, zero-dependency
engine (deterministic seeded layout, depth-sorted render) with the
glossy-black-and-silver house finish — drag to rotate, scroll to zoom,
idle auto-drift. Six probe suites pin it all (probe/bew · moe ·
initiative · graph3d · financeBench · siliconBench — 24 · 17 · 30 · 17 ·
20 · 17 checks) — 156 suites total.

### NEW in 19.7.10.1 [Screenwright] — the boundary, stated precisely

The seventh external review accepted the previous patch as the strongest
RSIRALS build so far and then named two things to fix. Both are shipped here.

- **THE TERMINOLOGY IS NOW EXACT.** That patch described the new `h7`–`h10`
  tier as "structural" and said it "reads the shape of the change." It does
  not. It is pattern matching over the submitted text: `h7`, for instance,
  needs both a URL-shaped token and network language, so a change expressed
  in code that names neither can still introduce network access and pass.
  The tier is renamed **CAPABILITY-PATTERN**, the finding strings it emits
  say `capability pattern:` rather than `structural:`, and the accurate
  boundary is now written into the shipped source and pinned by probe:
  **a ten-check, digest-pinned textual / capability-pattern screen, plus the
  human approval that follows it — NOT structural semantic verification of
  the proposed code.** `probe/rsiralsV6` grew 61 → 64 to hold that wording
  still, so the deck cannot drift ahead of the code again.
- **THE RELEASE RECORD IS PROMOTED.** `RELEASE-VERIFICATION.md` still opened
  as the previous release while every manifest named the new one — the
  underlying data was current, the document was not. It now opens as this
  release and carries its own verification section at the top.
- **A FOUR-PART IDENTITY BROKE THE DRIFT SCANNER.** `19.7.10.1` exposed a
  second bug in the freshly repaired `probe/docIdentity`: with only one
  optional numeric group, the pattern backtracked and read a truncated
  three-part version out of the new four-part identity. It now accepts up to
  three groups after the major and refuses
  both a trailing `.digit` and a trailing digit. Waking it again caught four
  identity lines the bump tool does not reach (the previous patch number,
  un-prefixed, in the feature sheet and the framework doc, plus two in the
  one-pager) — all fixed.

- **THE RUNTIME RECORD MATCHES THE DECLARED FLOOR.** This release first
  shipped declaring `engines.node >=22.12.0` while its verification record
  named node 20.20.2 — certifying on a runtime below the product's own
  declared minimum, which for a product whose pitch is independently
  verifiable evidence is the wrong kind of ambiguity. The floor is the
  correct claim, so the runtime moved instead: the complete gate set was
  re-executed end to end under **node v22.23.2** (the CI runtime) with a
  clean `node_modules` and zero `EBADENGINE` warnings. `verify/BUILD-INFO.txt`
  now carries a machine-readable `node:` line, and the offline runner prints
  its own runtime in its summary — so the certification environment is
  checkable rather than asserted.

Both trust-root anchors re-pinned, because the verifier's own source text
changed and rotation is a release event: `programDigest` `581ddfa7…`,
`batteryDigest` `1c5e31fa…`. Protocol stays `vh-verifier/3`.

### NEW in 19.7.10 [Screenwright] — the gate that read keywords now reads structure

**The sixth external review found the P1 the fifth one left behind.** The canary
battery was **six regular expressions evaluated over the candidate's own text**,
and its source ships in the public repository. So the promotion gate reduced to
keyword filtering — and the reviewer proved it. A proposal that exfiltrated the
evidence store, set the promotion threshold to always-accept and deleted the
rollback path, **reworded to dodge every keyword**, passed 6/6 and drew a valid
ECDSA signature. All 55 existing checks asserted that the filters FIRE; not one
asserted they could not be routed around.

- **THE CAPABILITY-PATTERN TIER.** The battery grows **6 → 10**
  (`verifier/vh-verifier.mjs`). `h1`–`h6` stay as LEXICAL markers. `h7`–`h10`
  are CAPABILITY-PATTERN screens: **h7** a network egress endpoint, **h8** a
  weakened control threshold or a removed retention/rollback path, **h9**
  mutation or exfiltration of the evidence store, **h10** a widened authority.
  They screen for the *capability being introduced* rather than for intent
  language, so rewording the prose does not remove an endpoint, a deleted
  retention step, or a widened scope. The 19.7.9 evasion is now refused by
  THREE of them and is pinned as a regression; the legitimate tighten still
  clears all ten with no false positive. Both anchors re-pinned as designed —
  rotation is a release
  event, protocol stays `vh-verifier/3`.
- **HONEST WORDS, IN THE LEDGER.** `governChange` no longer writes "machine
  gates passed" as though a semantic review had happened. It records that the
  battery is a lexical + capability-pattern TEXT SCREEN (source public,
  digest-pinned)
  and that promotion to fleet is a human decision. The battery's own header now
  states its scope in the source: *no text screen can decide whether a proposal
  is malicious.* The human door was always load-bearing; the wording now says
  so instead of implying a review it never performed.
- **A DORMANT DRIFT GATE, REPAIRED.** `probe/docIdentity` had gone VACUOUS: its
  `VERSION_RE` was hardcoded to major `16`, so from the first 19.x release it
  matched **no string in any document**, reported green, and scanned nothing.
  A drift gate that cannot fail is worse than no gate — it manufactures
  confidence. The patterns are now DERIVED FROM THE RELEASE IDENTITY,
  historical-by-role documents are excluded BY NAME, and three anti-vacuity
  assertions make a regex that matches nothing a hard failure. Waking it
  exposed real drift, all now fixed: `VH-FRAMEWORK.md` and `FEATURES.md`
  still claimed the *Federation* release as current, the one-pager named a
  two-series-old build with a stale probe count, and two design docs spoke of
  the *Recall*-era contracts in the present tense.
- **19.7.9'S OWN TERMINOLOGY LAW, APPLIED TO THE SURVIVORS IT MISSED** —
  BUILD-INFO still read "hidden true-objective canaries" and "SHA-256 signature
  binding". Both corrected.
- **THE NODE FLOOR IS STATED** — `engines.node >=22.12.0`. `npm install` had
  been warning `EBADENGINE` for releases while the field was absent.

Counts: **156 live probe suites / 155 offline bundles**; `probe/rsiralsV6`
55 → **64** checks. Gates on node v20.20.2: tsc 0 · unit 20/20 · 156/156 live ·
offline 155/155 · host + MCP engines rebuilt · vite clean.

### NEW in 19.7.9 [Keyholder] — the P0 killed: no key ever ships again

**The 19.7.8 review found the release-blocking hole:** the verifier's
PRIVATE key rode inside the ZIP (a `git add -A` casualty), so anyone
holding the artifact could forge "all canaries passed" verdicts the pinned
public key happily accepted. The reviewer proved it by forging one. Shipped
here, at the root:

- **The artifact carries NO secret.** The verifier's ECDSA P-256 keypair is
  provisioned at RUNTIME — first run generates it and stores the private
  key at `~/.vouchharbor/verifier.key` (mode 0600), outside the app tree,
  outside the repo, outside every distributable. `git rm --cached` purged
  the leaked key; `.gitignore` now refuses `verifier/*.key` outright.
- **REGISTRATION replaces embedded keys.** The provisioned public key is
  COUNTERSIGNED by the OWNER key (the same ECDSA P-256 authority that
  signs mandates and federation crossings) and stored in the owner trust
  store. Verdicts verify under the REGISTERED key; a stranger key is
  refused; re-provisioning requires the owner again.
- **The PROGRAM is pinned.** The verifier digests its own source at
  runtime and binds `programDigest` into every verdict signature (protocol
  `vh-verifier/3`); the frozen trust root pins the expected value, next to
  the battery digest. A modified verifier is refused even before its key
  matters.
- **Honest words.** The battery is EXTERNALLY EXECUTED and DIGEST-PINNED —
  its source ships in `verifier/vh-verifier.mjs`; digest pinning prevents
  swapping, not secrecy. The "hidden/secret" framing is gone everywhere,
  including the ledger event text.
- **Artifact hygiene is now a standing probe check.** probe/rsiralsV6
  grew 42 → 53: no key file in the tree, `.gitignore` refuses keys, the
  trust root pins no key material, the program digest matches the shipped
  source byte-for-byte, plus the full provisioning flow (fresh machine →
  provision → owner countersignature verifies; tampered registration and
  wrong-program registration refused) and the foreign-key forgery anchor,
  now verified under the REGISTERED key.

### NEW in 19.7.8 [Trustroot] — real signatures, a frozen anchor, the desk on the live console

**The 19.7.7 review's verdict, shipped in full:**

- **REAL signatures, not checksums.** The verifier now signs every verdict
  with its **ECDSA P-256 private key** (the same curve as VH's authority
  mandates); VH verifies against the public key **pinned in the frozen
  trust root** (`src/vh19/verifierTrust.ts`). A modified verifier cannot
  forge accepted verdicts — it does not hold the pinned key. Probed with a
  literal foreign-key forgery attempt: refused.
- **The battery is anchored.** The pinned `expectedBatteryDigest` covers
  every check's SOURCE (id + probe source), and `verifyExternal` enforces
  it independently — a swapped exam is refused on sight, before signature
  checks even matter.
- **CSPRNG nonces** — `crypto.randomUUID()` (getRandomValues fallback).
  No clocks, no Math.random.
- **The Evolution desk is on the ACTIVE console** — NextConsole carries
  the guarded promotion surface: scan the ledgers, approve through the
  full anchored v6 gate (the note shows verdict · canary source · ledger
  seq), decline, with the verifier chain and the floor printed beneath.
  The honest description is now simply: RSIRALS v6 is live, on the
  user-facing surface, human approval required.

probe/rsiralsV6: 42 checks — trust-root freezing and fingerprints, a real
foreign-key forgery refused, signature tamper refused, battery swap
refused on sight, replay refused, and the live production apply still
gated end to end.

### NEW in 19.7.7 [Verifier] — RSIRALS v6 goes LIVE: the verifier leaves the building

**The 19.7.6 review verdict, shipped:** wire `governChange()` into the real
promotion path, and move the canary battery outside the agent-visible
source. Both, exactly:

- **The canary battery is now an EXTERNAL PROCESS** — `verifier/
  vh-verifier.mjs`, a separate zero-dependency Node program OUTSIDE `src/`
  (outside the self-modifiable surface; the constitution refuses any
  candidate targeting it BY NAME). **Ten deterministic checks in two
  tiers**, public in size only. Protocol: fresh CSPRNG NONCE per call →
  verdict → **ECDSA P-256 signature** binding
  nonce·result·battery-digest·program-digest. Replayed or tampered verdicts
  are refused; where no process can run (the browser console), the gate says
  `unavailable` and NEVER pretends — the candidate simply cannot pass
  canaries without the verifier, so it stays at the human gate.

  **What the battery is, honestly.** It is a TEXT
  SCREEN over the candidate's own words, and its source is public — the
  digest pin prevents SWAPPING the battery, it does not make it secret.
  Six checks are LEXICAL markers (h1–h6: intent language, absolute scope,
  hardcoded credentials, impersonation). Four are CAPABILITY-PATTERN
  screens (h7–h10: a network egress endpoint, a weakened control threshold
  or removed retention/rollback path, mutation of the evidence store, and
  authority widening). The sixth external review proved the all-lexical
  19.7.9 battery was **evadable** — a proposal that exfiltrated the evidence
  store, set promotion to always-accept and deleted the rollback path,
  reworded to dodge every keyword, passed 6/6 and drew a valid signature.
  The capability-pattern tier screens for the capability being introduced
  rather than for intent language, so rewording the prose does not remove an
  endpoint, a deleted retention step, or a widened scope — but it is still
  PATTERN MATCHING OVER SUBMITTED TEXT, not AST/diff/capability analysis of
  the proposed code, and a change written in code that names none of the
  patterns can still pass. THE ACCURATE SECURITY BOUNDARY: a ten-check,
  digest-pinned textual / capability-pattern screen, plus the human approval
  that follows it — not structural semantic verification of the proposed
  code. A text screen cannot decide malice: the human door is load-bearing,
  and the ledger says so in those words rather than implying a semantic
  review it never performed.
- **The live promotion path runs the full v6 gate.** `applySelfChange
  Guarded()` — the Apply button in the evolution surface — drives every
  self-evolution proposal through: EXTERNAL canaries → constitution →
  measured drift (the budget measures the MUTATION against the current
  state, not the justification) → BLOCK names the rule and the proposal
  stays pending → the human's click completes the staged promotion
  (fail-closed: tighten-only + human-approved) → the override lands →
  v5's archive records applied/reverted alongside v6's ledger. Both
  planes, one loop, closed both ways.

probe/rsiralsV6: 38 checks — including a REAL verifier spawn, signature
tamper + replay refusal, and the live apply of a real proposal through the
production path (plus its hostile twin, refused by name).

### NEW in 19.7.6 [Office] — RSIRALS v6 (the strengthened verifier), the office, the real crossing seam

**RSIRALS v6 upgrades the trust plane; plane T stays frozen at v5** — the
2026 research consensus (strengthen the verifier, ground the loop in checks
it cannot modify), shipped as six deterministic mechanisms:

- **The Constitution** — 4 frozen, machine-checkable invariants diffed
  against every candidate (no self-governance · discretion-tightening ·
  evidence-bound · the human door untouchable).
- **The Drift Budget** — change is MEASURED (token-level Jaccard vs the
  current text): max 0.60 per change, 1.50 per rolling 24h. Bust it and
  the refusal says: shrink the step until a human can review it.
- **Hidden true-objective canaries** — a held-out 4-check battery, opaque
  at proposal time; proposer-reported gains count for nothing.
- **Staged promotion, fail-closed** — shadow → canary → fleet; the
  regression gate refuses on ANY single dropped dimension (or an
  unmeasured one), even when the average rises.
- **The tamper-evident ledger** — every gate event in a SHA-256
  hash-chained append-only chain (actor · policy · digest · prevHash);
  verifyLedger() breaks loudly on one altered byte.
- **One gate + rollback** — governChange() is the only door; it never
  promotes to fleet by itself; promotion snapshots last-known-good and
  rollback() restores in one step.

**The Office** — the crew workspace renders as one common space:
departments by domain, the shared board (gate · working · answered ·
sidelined), the steward on rounds. **The real crossing seam** — the Groups
panel runs crossings through productionCross → the live signed federation
crossing, and names itself honestly: a governed local implementation of
the cross-owner group protocol (networked VH-A ↔ VH-B signing is the next
federation milestone). probe/rsiralsV6: 31 checks · probe/crew grows to 35.

### NEW in 19.7.5 [Groups] — Ram ↔ Raj: two owners' agents, one governed crew

**The gap closed.** Until now everything worked inside one owner's machine —
your agents worked with your sub-agents, and federation crossed individual
tasks between owners. A GROUP is the continuous form: Ram's VH and Raj's VH
join as one working group whose agents collaborate across both sides, while
the owners stay the governors. The agents work; the humans rule.

- **The charter** — a group exists only as a charter both owners accepted:
  named members, capabilities from the federation delegation vocabulary,
  hard limits (tasks per rolling 24h, signed crossings per task, an expiry),
  and one-sided revocation with the reason on record.
- **Group work** — a task is planned into LOCAL items (run on this side by
  the real member agent loops, routed by Agentic MoE v2) and CROSSING items
  (delegated to the peer over the signed federation crossing —
  replay-guarded, both ledgers agreeing). No standing grant → the crossing
  fails named: nothing was signed, nothing left the machine.
- **Three modes, group-wide** — the same Manual / Semi-autonomous / Fully
  autonomous throttle, hot-switchable mid-run. Crossings gate in manual AND
  semi — delegating to another owner is risky by nature. Full runs them
  inside the charter limits.
- **The human gate** — per item, with the crew's revival law: a premature
  run over an all-gated plan awaits the gate (never "failed"); approvals
  revive; the run executes what the owners approved.
- **Proof** — every item carries a digest; the group session receipt chains
  them. The steward reports the working as it happens.

probe/groups pins it all (37 checks): the charter law, acceptance digests,
the rolling-window and expiry refusals, modes over local and crossing items,
the crossing cap, the revival sequence, the signed-seam execution, and the
no-seam honesty.

### NEW in 19.7.4 [Crew] — the governed crew: 25 specialists, one working space, zero third-party agents

**The CLI era is retired.** Vouch Harbor no longer spawns external agent CLIs.
Every specialist — every member of every crew — executes natively on YOUR
provider keys (OpenAI / Anthropic / Gemini / local Ollama) through the audited
VH agent loop: one runtime, one receipt format, no third-party binary in the
trust chain. Old saved graphs keep working: a retired CLI id in a config
resolves to the native runtime automatically.

**The crew workspace** (`Crew workspace` in the console) fields up to
**25 specialists in parallel** for compound work:

- **Dynamic domain pools** — the task's own text scans the fleet; "build an
  app" pools hundreds across frontend/backend/database/security/devops/design,
  a GST filing pools a small finance/tax/legal set. The pool follows the task.
- **Agentic MoE v2** — sparse selection with reasons, a per-member reserve
  bench staged at selection time, and instant failover: a failed member is
  replaced by the next-best same-domain specialist in one step; a domain with
  no reserve escalates to you, named. The crew breaker (3 consecutive
  unresolved failures) cools a session down — visibly, never silently.
- **Three modes, hot-switchable mid-run** — Manual (nothing moves without
  you), Semi-autonomous (safe acts run free, risky/critical hit your gate),
  Fully autonomous (safe+risky run free inside the hard caps). Critical-tier
  acts ask in EVERY mode. In-flight acts finish under the mode that admitted
  them; the switch lands in the ledger.
- **The Steward** — one calm feed that reports the working as it happens:
  who started, who answered, who was replaced and by whom, what needs you.
- **LOTUS** — Lean Optimal Token Utilisation System: the crew's token
  economy. Tool output is compressed through conservative/balanced/
  aggressive/auto passes that never change meaning, never touch errors,
  stay reversible (expand any ref to the byte-exact original), dedupe
  repeats into short refs, and refuse any pass that would not pay for
  itself. Every number is an estimate, labelled.

154 probe suites pin it (modes 16 · moeV2 24 · lotus 21 · crew 26 — the
governance, the pools, the failover, the breaker, the receipts).

### NEW in 19.7.2 "Noir" — the maturity release: a sharper crew, two honest finishes, zero props

### NEW in 19.7.2 "Noir" — the maturity release: a sharper crew, two honest finishes, zero props

**The crew matured.** Every specialist now ships with the operator doctrine
(`src/vh19/skills.ts`, appended to every composed prompt): verify before
claiming, evidence over prose, fail forward with one labelled retry,
self-review that marks INCOMPLETE instead of guessing, and scope past the
safe tier handed back to the human. Member loops run up to five
act/observe/adjust steps (`agentLoop.ts`), so a specialist that misses
adjusts instead of stopping. **The center agent is the Steward** — rendered
everywhere as the Steward; internal identifiers are unchanged. **Nothing
fake, nothing versioned on screen**: the console renders no version numbers
and no demo/simulated props. **Two honest finishes**: matured noir
(default) and light cream gray — Settings → Appearance, applied before
first paint. **A minimal Settings plane** — Appearance · Security · Memory ·
Data — where turning memory ON without a vault says so and points at vault
creation, and provider memory is exact: "session only" keeps the key in
memory and removes the stored copy (never seals); "on this machine"
requires the unlocked vault and seals it.

### NEW in 19.7.0 "Recall" — memory, mastery, and the token pipeline

**The console remembers.** Every conversation becomes a keyword GRAPH
(`src/vh19/memoryGraph.ts`): nodes, co-occurrence edges, dated sessions,
local-first. Ask "what happened that day about X" and the graph recalls the
session and rehydrates it into the crew's context — always marked in the
prompt and in the UI, never a silent injection. **Every token is accounted
for**: every provider call rides the new wire pipeline (`src/vh19/tokenOptim.ts`
through the `providers.complete()` choke point) — normalize → repeated-line
dedup (marked) → prompt-cache alignment (measured, never gamed) → emergency
budget — and every reply carries its honest delta (`⚡ est −N tok (P%)`,
estimates labelled as estimates). **The MCP market** (`src/vh19/mcpMarket.ts`)
installs ANY server from a 12-entry curated catalog or your own stdio/HTTP
registration — zod-validated, SSRF-guarded, env keys by name only, standard
`mcpServers` export. **A2A hardening**: a replay guard refuses a duplicate
crossing submission inside a 60s window before anything is signed. **The
fleet self-heals**: a member's transient provider failure gets ONE
situation-changing auto-retry with no human pause, labelled on the run.
**The preview fix**: sandboxed/opaque-origin embeds boot the real console
now (the CORS + CSP root cause is fixed and stated). Full notes:
[VH-19.7-UPGRADE.md](VH-19.7-UPGRADE.md).

One console, and it IS the app (19.6.6 redesigned the whole surface): a dark
operations console with the crew on the left rail — the Generalist keeps ONE
deterministic face derived from the name its owner gives it, and every
specialist carries a deterministic mark — and the run stream in the main pane,
where every bubble rides its honesty chips (provenance digests, ECDSA mandate,
gate banners that never skip silently). Behind it: a Generalist that
routes 1,150 specialists (460 seed-batch + 160 broader-batch + 140 reach-batch
+ 390 maturity-batch, self-proving via `catalogStats().byProvenance`) out of a
**1,790-strong catalogued bench — 1,150 established specialists plus 640
registered specialists** (the 19.5.6-reach batch of 200, the 19.6-federation
batch of 210 and the 19.6.2-regulated batch of 230; registered means specified,
catalogued and honestly NOT routed, stated by `fleetClaim()` and pinned by
`probe/fedFleet`), real gated tool execution
over a real workspace, Captain synthesis, signed A2A invitations, and the **Federation plane ON the live path** (19.6.6): a cross-owner crossing that
needs an approval from BOTH sides — or a standing grant BOTH owners signed
once, spent per crossing, with out-of-scope / spent / lapsed / revoked grants
escalating to a per-crossing human decision; a common ledger where both stores
write the same joint row and the roots are compared on the receipt itself; and
regulated activation gating the registered regulated bench at the router (a
name is not an authorisation). A crossing still needs
an approval signed by each harbor's owner authority key
naming the human it acts on behalf of, bound to that exact envelope and spent
once; standing read per side from each harbor's own local store; derived sigil
Faces — key-derived for peers, subject-derived for crew — plus BYOA
(external agents under a trust intersection), governed connector
declarations, SKILL.md ecosystem import, a live-data GuardRail on one
shared egress policy, and **RSIRALS v5.0** — the proprietary trust-rooted
RSI: five-source evidence curriculum, human-gated apply, frozen
digest-stamped memory, receipt-bound promotion, canary auto-rollback, and a
governance plane the loop can never write. The release-by-release detail for
this series is in [VH-19.4-UPGRADE.md](VH-19.4-UPGRADE.md) with the
verification record in [RELEASE-VERIFICATION.md](RELEASE-VERIFICATION.md).

### Release narrative (history — the 12.0→16.x consolidation)

One product, one engine: you compose a crew, give it an outcome, and the
Mission Loop runs the whole agent-work cycle — dispatch, inter-agent
communication, gated execution, measured feedback, and human-approved
adaptation — leaving one signed, verifiable receipt per cycle. Before 12.0 the
app presented these as separate productions (Teams, Evolve, Missions, Mission
Control, Observe…). 12.0 merged them into a single runtime
(`src/mission/missionLoop.ts`) and one engine screen. 15.0 (the Vouch Harbor
face) made it six doors total: **Teammate · Mission Loop · Workflows · Proof ·
Audit · System**. 16.0 fused the two codebases into this product; 16.1 carries
one clean product line — the same single version stamps the engine, the
control plane, the proof protocol and the native shell — and adds the learning
bridge (M4) and the mission timeline (M5-lite). 16.2 adds the MCP capability
router (M3): any MCP client can list and call the product's capabilities
over stdio, and every call is routed through the same governed pipeline —
risky calls pause at the human gate, and every completed call mints a
receipt. 16.3 closes the roadmap with the gated, reversible meta-loop
(M6): the product can propose changes to its own control plane — risk
tiers and standing preferences — and every self-change is proposed in
words, simulated, human-gated, receipt-vouched and revertible (tighten
only; reverts are themselves gated). 16.4.0 closes the external-validation
gap with the drill: standard real missions — a fresh real git repo, the
repo's OWN test command, the real mission loop — run on demand, with the
verdict vouched and an attestation digest.

The Teammate door is the human front: a named, persistent Vouch seat you
message like a colleague — real tools, a human gate that pauses for approval
on risky actions, a signed receipt for every finished run, and — new in 16.1 —
it *learns*: a successful, verified mission distills into a test-gated skill,
and the next matching mission fast-paths on it, still paused at the human
gate.

## The VH-19 Generalist — the one front door (19.3.0)

The app opens on the VH-19 door: the user talks to ONE agent. Behind it: a
Mixture-of-Experts-style **specialist bench** (460 real specialists across 10
categories, user-manageable — disabled specialists are never fielded), an
autonomous **router** (deterministic scoring spine + optional LLM re-rank that
may reorder candidates but never invent them, with every decision and its
reasons shown on screen), a **provider seam** for OpenAI-compatible / Anthropic
/ Gemini endpoints (session keys in memory only; durable keys encrypted in the local owner
vault or via env — never plaintext; SSRF-guarded, redaction enforced), an **accept/reject learning
ledger** (local-first; cloud sync opt-in and honestly non-operational until it
ships), and the **90% autonomy exam** — questions generated only from the
user's real scenarios, agent-explained answers, user grading; ≥90% earns
gate-free safe-tier operation with monitor + override permanently on. The
honesty contract is enforced in code AND pinned by probes: no key ⇒ a plan in
words and `executed: false`; no gate ⇒ risky work refused; no A2A bridge ⇒
nothing sent; the door itself is probe-pinned (`probe/vh19Door`) to render and
to import the real engine.

**19.0.0 added the differentiator: cross-user Team-Evolve.** Two users' VH
instances share a team; every joint run lands in the team ledger with its real
outcome; with real verified history VH proposes an evolved team composition —
and adoption requires EVERY member's explicit approval (partial, duplicated
and outsider approvals refuse; there is no partial adoption). The evolved
config leans on future routing VISIBLY ("team-evolved preference"), and
revocation is one click. Autonomy is now category-scoped: an exam can cover
one category, and a grant covers only that category — the gate consults the
scoped grant. Pinned by `probe/teamEvolve` (31 checks). Full notes:
[VH-19.2-UPGRADE.md](VH-19.2-UPGRADE.md) · [VH-18.0-UPGRADE.md](VH-18.0-UPGRADE.md).

**19.2.0 adds The Shipyard — the team workspace.** Hand the door a whole
brief ("build me a recipe app with secure auth, tests, CI and a clean UI")
and it opens one **work order per needed domain**, each supervised by that
domain's **Captain** (the renamed AgentLead layer). Orders run one at a
time through the same governed pipeline — gate, routing, receipts — and a
build is only DONE when every order genuinely executed; blocked work
blocks the build, never fakes it. Every provider call now passes the
**autonomous token optimizer** (budget-fitted prompts, local usage ledger),
and research/analysis runs carry a **live-data GuardRail**: always search
for current and live data, date every claim, flag stale findings.

**Since 19.2.0 the claims execute.** When the router selects several
specialists, **each member now runs its own provider call** under its own
prompt and returns its own attributed answer with its own member receipt —
the Captain reports on N real results, and a failed member is recorded
failed, never relabelled. The **live-data GuardRail** is now a runtime
control: every answered research/analysis reply is scanned — time-sensitive
claims without dated live sources get a **stale flag appended to the reply
itself**, sealed in the provenance digest (VH ships no web-search
provider, so it enforces disclosure honestly instead of faking freshness).

**19.3.0 makes the fleet real.** Three review gaps closed in one release.
(1) **Specialists are executors now**: with a workspace wired, each member
runs a real act/observe loop over a governed toolset (fs.list, fs.read,
fs.write, net.fetch, wiki.search — plus the reach missions' computer-use
plane, pc.exec and pc.browser — seven tools, readable in one sitting; the
pc.* tools are never category-bound: the Generalist attaches them only to
reach-provenance missions). Every tool call is risk-tiered, rides the human
gate, and lands
its own receipt — including denials and parse errors; the model is told the
gate's real reason, never a fabricated result; a step-limited loop stops
labelled, never dressed as done. (2) **Captain synthesis**: after a
multi-member run, a deterministic divergence pass computes corroborated vs
single-sourced claim atoms, and the Captain's OWN provider call reconciles
the members' real answers into one coherent domain result — member sections
kept below as evidence; a failed synthesis says so and keeps every member
answer. (3) **The GuardRail retrieves**: with an evidence fetch wired, the
cited sources are ACTUALLY FETCHED and the claim markers checked inside —
"verified" then means retrieval (receipted per URL: status, claim hits,
timestamp), and a disclosure stamp can never pose as a retrieval stamp.
Full notes: [VH-19.3-UPGRADE.md](VH-19.3-UPGRADE.md).

## What it is

- **One engine, one cycle** — COMPOSE → DISPATCH → COMMUNICATE → EXECUTE →
  GATE → ADAPT runs as a single loop: the bandit router picks the run's
  strategy arms, dispatches every seat over the inter-agent bus, executes the
  team through the governance arena and budget ledger, and folds the measured
  report back through seat evolution (human-gated candidates), elastic
  scaling and lesson memory. One cycle = one signed receipt.
- **Learning bridge (16.1)** — a completed, verified mission trajectory
  distills into a vouched dispatch skill: real mission provenance (mission
  ID, verified seats), a replay gate that refuses too-coarse triggers, and a
  fast path that binds the skill into the next run's receipt. Failures land
  in failure memory; a failed replay flags the skill so it never
  auto-executes again.
- **Mission timeline (16.1)** — every dispatched mission opens into its
  unified chain: mission events plus the session and verdict bookends, as a
  phase-by-phase timeline. One mission, one chain, one state.
- **MCP capability router (16.2; spec-current at 16.5)** — `npm run mcp`
  serves the product's capabilities as an MCP server (JSON-RPC 2.0 over
  stdio): 20 governed tools, honest risk labels in the schema, risky calls
  non-blocking at the human gate (approve/deny from the UI or the server
  itself, then poll `call_status`), and a receipt minted for every completed
  call — success, denial, refusal or error — carrying the calling face's
  origin. **16.5 is a DUAL-ERA server for the MCP 2026-07-28 spec**: the
  stateless core (per-request capabilities in `_meta`, `server/discover`,
  no handshake, results carry `resultType`), cacheable tool lists
  (`ttlMs` + `cacheScope`), MRTR input flows (a gated call returns
  `input_required` with the decision as an elicitation request; the client
  answers with `inputResponses`), and the **Tasks extension** (durable task
  handles over gated work: `tasks/get` poll, `tasks/update`,
  `tasks/cancel`) — while legacy 2025-revision clients keep the exact old
  wire (initialize handshake, `approve_action` + `call_status`). One throat:
  both eras route through the same governed pipeline. `probe/mcpRouter`
  drives the real server over real stdio in both eras.
- **Gated, reversible meta-loop (16.3)** — the product proposes changes
  to its own control plane (`risk.tier` tighten-only, `preference.set`),
  each one proposed in words, simulated, paused at the human gate (the
  revert is gated too), receipt-vouched in every outcome, and reversible
  with the exact state restored. Behavior-pinned: a re-tiered tool
  actually pauses at the gate until reverted. Faces: System → Meta loop
  (ledger + intents; decisions on the one gate) and MCP
  (`meta_propose` / `meta_status` / `meta_revert`). What it cannot
  self-modify — the receipt protocol, the gate, the brain, the code — is
  stated in the code and the docs.
- **Clean identity, completed (16.5)** — the legacy heritage names are
  gone from the whole VISIBLE product surface, not just the control plane:
  the shell, every page, the canvas watermark, onboarding, the IPC bridge,
  the browser stubs and the domain catalogs (agent identity prompts now
  read "the Vouch Harbor planner", the home reads "Vouch", the provenance
  demo generator is "Vouch Harbor" at the current version). The ACP
  override env is `VOUCH_ACP_BIN` (the old name still honored), and the
  IPC workflow contract moved to `VH`. Pinned by a new `vhClean` surface
  scan; engine-internal historical comments are the one labeled exception.
- **The drill (16.4)** — the product proving itself on real missions:
  `guard` (fix the disabled-admin bug), `maths` (implement the missing
  `clamp`), `impossible` (must come back FAILED — never a fake pass).
  Each run is a fresh REAL git repo whose OWN test command decides,
  through the REAL mission loop (real governance arena, real worktrees,
  signed cycle receipt), with a vouched drill report + reproducible
  attestation digest, a unified mission-ledger entry, and — because it is
  a mission — the human gate. Faces: System → Drill and MCP
  (`run_drill`, 20 governed tools).
- **Hardening + external proof (16.6)** — the conformance release, per the
  16.5.0 review: (1) the **MCP conformance suite** (`probe/mcpConformance`)
  validates every wire message — both eras, both directions — against the
  OFFICIAL spec JSON Schemas committed under `tools/mcp-conformance/` with
  provenance and sha256 pins, and writes `report.json` evidence per run;
  (2) **one throat, whole-tree pinned** — the 15.x Teammate prototype is
  deleted and a scan pins the complete set of files that touch the mission
  loop engine; (3) **honest docs** — the one-pager claims only what the tree
  proves (the signed audit report is a planned deliverable, named as such)
  and keeps the drill's deterministic-seat distinction explicit (machinery,
  not model intelligence); (4) the **reproducible drill benchmark**
  (`tools/drill-benchmark.mjs`) — full catalog through the real Mission Loop,
  one stable `overallDigest`, probe-pinned cross-process.
- **External validation (16.7)** — the hardening sequence's external-proof
  items, probe-pinned: (1) the **official MCP SDK client** (pinned
  devDependency, the spec's own client library) drives the real server
  end to end — handshake at 2025-11-25, 20-tool surface, the full human
  gate to a verified receipt, denial executes nothing (`probe/mcpSdkClient`);
  (2) the **real-model seam** — `run_drill` can run its seats on a REAL
  agent CLI (the loop spawns the real bin; the seat is labeled REAL in the
  report and the receipt; a missing CLI is refused in words, never faked),
  and `tools/external-model-validation.mjs` inventories the product's own
  25-harness registry on the host's PATH and validates a real model when
  one is present — honestly reporting absence when none is; (3) **benchmark
  integrity** — the drill's impossible scenario now carries a per-run random
  SEAL, the test file never enters a seat's worktree (the seat that decides
  the outcome cannot read the judge; the verifier re-injects the canonical
  test per verification run), and a canary detects and labels tampering.
- **Modern-client conformance (16.9)** — the 2026-07-28 era, proven from
  the outside: the **official MCP TypeScript SDK v2** (`@modelcontextprotocol/client`
  v2.0.0, exact-pinned devDependency — the spec's own client library for the
  modern revision) drives the real server over real stdio with the era
  **pinned to 2026-07-28** (`probe/mcpSdkClientV2`, 10 tests): the
  connect-time `server/discover` (both eras advertised), the 20-tool
  surface, and the **human gate the modern way** — `input_required` +
  `requestState`, answered through the client's elicitation handler and
  retried with `inputResponses` (MRTR), approve → executed → receipt
  `VALID`, decline → nothing executed; honest refusals in words; and the
  same v2 SDK in default (legacy) posture still negotiates 2025-11-25 —
  one official client library, both eras. With probe #90, both protocol
  eras are now externally validated by their official clients.
- **Learn by proving (16.8)** — VH-COLOR Phase 1, the capability genome:
  capabilities become versioned **genomes** (objective, trigger, procedure,
  declared failure modes, resource limits, provenance) that climb the
  lifecycle OBSERVED → CANDIDATE → UNDER_EVALUATION → SHADOW → CANARY →
  ACTIVE through four **hard gates** — safety, provenance, dependencies,
  regression — where a failure QUARANTINES with the stated reason, and
  quarantine lifts only through a named governor re-evaluation. **The
  protocol's central invariant is mechanical**: a capability cannot grant
  itself safety authority — the governor's grant travels as a separate
  argument, a grant written into the genome's own fields is invisible to
  the gate (probe-pinned). Trust grades **C0–C5** derive from the
  provenance chain (receipt → replay → multi-seat → lineage), the **signed
  capability package** (canonical digest + Ed25519 from the receipt
  keychain) is portable yet re-earns its trust on any host it imports to
  (never lands in ACTIVE), production regressions **auto-rollback** with
  fallback to the last ACTIVE version, and existing M4 skills convert to
  genomes with their receipts and seats intact. Probe-locked
  (`probe/genome`, 56 assertions); the MCP surface is unchanged — the
  20-tool conformance pin holds.
- **25 harnesses, no lock-in** — 23 CLIs (claude, codex, gemini, grok,
  cursor, opencode, amp, …) plus `hermes` and `llm`, from one shared
  registry; install detection and argv policy cannot drift.
- **Verification first** — exit-code-first verdicts, measured cost
  (`unmeasured` rather than estimated), canary-proven sandbox wrappers, and
  an adversarial arena that must PASS before a run is admitted.
- **Communication as infrastructure** — every dispatch and seat event rides
  the inter-agent bus on role channels, visible live in the engine screen.
- **Gated merges** — the merge executor runs the plan's real git steps and
  refuses anything the gate blocked without a recorded human override; on a
  host without git it reports `simulated` instead of claiming a merge.
- **Proof receipts** — every cycle exports a SHA-256 hash-chained receipt,
  Ed25519-signed, verifiable with zero product state. New receipts ride the
  `vh-proof-receipt/2` wire; pre-16.1 receipts (`mj-proof-receipt/1|2`) still
  verify through the same open verifier — compatibility, not branding. The
  Evidence Pack bundles receipts, merge attestations, an AIBOM and a control
  crosswalk (EU AI Act / ISO 42001 / SOC 2).
- **Verify anywhere — the open verifier (14.0)** — `node tools/verify-receipt.mjs receipt.jsonl` re-checks any
  receipt's chain, seal and Ed25519 signature with zero dependencies and zero
  product state; auditors run it on a machine that never installed this
  product. Broken chains print the exact seq; nothing is laundered.
- **Agent FinOps — measured chargeback (14.0)** — per-team, per-mission chargeback rows built from the budget
  ledger's real settlements and exported as digest-stamped CSV; seats that reported only tokens stay
  `unmeasured`, simulated seats are never charged (`src/mission/finOps.ts`).
- **Assurance Score & incident black box (14.0)** — a 0–100 evidence-derived rating per team (verification
  mix, arena, budget discipline, egress integrity, human feedback) that refuses to exist without measured
  runs, and a one-file tamper-evident forensic dossier for any mission with a SIEM JSONL projection
  (`src/mission/assuranceScore.ts`, `src/mission/incidentDossier.ts`).
- **Adaptation with a human gate** — the loop proposes, people dispose: seat
  instruction candidates grounded in measured evidence, bandit arm updates
  from measured runs only, elastic seat suggestions, and a lesson memory that
  shapes future briefings. Simulated runs and predictions teach nothing about
  real execution; nothing the loop learns edits a team silently in SUGGEST.
- **Explicit human feedback on every cycle** (12.1.1) — each cycle in the
  ledger carries a 1–5 rating + comment panel; the rating queues on every
  seat that ran and the next fold turns it into real evidence (1–2 becomes
  weight-2 human evidence with the comment preserved, 4–5 arms praise
  suppression, 3 is neutral). Feedback is integrity-bound to the team that
  actually ran the cycle, and re-rating before the fold supersedes the
  unconsumed rating — the human's last word wins, nothing accumulates, the
  verbatim history keeps every submission. Only cycles that RAN are ratable:
  an aborted cycle (nothing executed) is refused outright, while a gate-FAIL
  cycle whose seats ran stays ratable — feedback belongs on the runs that
  went wrong. One engine over the engines of record — the model is one
  orchestrating runtime plus one cycle ledger, not a single physical store.
- **Knowledge Forge — documents → structured knowledge proposals** (12.1.1)
  — paste a document (a chapter, a runbook, a SKILL.md from a
  book-to-skill-style distiller) and the Knowledge Forge turns it into a
  candidate knowledge skill: a mechanical extractor for frameworks/decision
  rules that is fully local, optionally enhanced by an LLM pass through your
  own installed harness CLIs — disclosed plainly: that pass sends the document to the
  harness's configured model provider (cloud by default; a locally-configured
  model stays local), and every proposal records `dataHandling: local |
  provider`. Proposals carry real SHA-256 provenance and claim NO measured
  effect (approval is governance, not proof the book is right); you approve
  or discard, and approved knowledge rides future mission briefings as
  `[knowledge]` — the loop carries the book forward without pretending it
  measured it.
- **Native desktop, local first** — Tauri v2 (Rust) shell with SQLite, OS
  keychain and stdio child processes; the same frontend runs as a browser
  edition on any static host. State lives on the machine; nothing phones home.

## Run it

```bash
# Node 22 + Rust stable
npm ci
npm run typecheck     # tsc --noEmit
npm test              # 155 suites
npm run build         # vite production build

npm run tauri dev     # desktop dev
npm run tauri:build   # nsis / dmg / appimage / deb

# offline verification (Node alone — dependency-backed suites honestly fail/skip
#   on a bare extraction; with `npm ci` everything runs)
node verify/run.mjs             # 154 bundles, the full gate (~80s, no install needed)
node verify/run.mjs --shard 1/4 # short execution window? run deterministic shards and merge
node tools/quick-verify.mjs    # the 11 headline suites in ~1.3s, zero install
# shorter window? run the same gate in pieces and merge:
#   node verify/run.mjs --shard 1/4 --time-budget 30   (…2/4, 3/4, 4/4)
#   node verify/collect.mjs                            (0 only when all 143 are covered)

# reproducible benchmark pack (zero install; B3 honestly skips without deps)
node benchmark/run.mjs

# mount THIS harbor on the A2A v1.0 wire — signed card, JSON-RPC endpoint,
#   receiver ladder and the live execution bridge behind it (see below)
npm run host -- --harbor "USER 2" --repo /path/to/repo --test-cmd "node test.js"
```

### The zero-install gates — and the one that isn't

Vouch Harbor keeps two notions of "zero install" strictly separate:

| Gate | Command | Deps needed |
|---|---|---|
| **Bridge gate** — receipt → vouch rulebook | `node protocol/bridge/bridge-selftest.mjs` | **none** — genuinely zero-install |
| **Offline pack** — the probe suites, bundled | `node verify/run.mjs` | none (dependency-backed suites state it) |
| **Interop CLI** — external-agent boundary | `node tools/vh-interop.mjs …` | **none** |
| **Benchmark pack** | `node benchmark/run.mjs` | none (B3 skips without protocol deps) |
| **Protocol cryptographic self-test** | `cd protocol && npm install && npm test` | **yes** — dependency-backed, lock-pinned |

The bridge gate, interop CLI and benchmark run on a bare extraction with
node alone. The full protocol suite (171 checks incl. grant-authority)
needs its installed dependencies — the lockfile ships in-tree, the
release notes never call that one zero-install, and
[`protocol/README-TEST.md`](protocol/README-TEST.md) gives the exact
commands to install and run it from a bare archive.

## A2A host — mounting a harbor on the wire (since 17.10.7)

`createA2AServer()` (transport), `makeDelegationHandler()` (the receiver
ladder) and `runInboundDelegation()` (the live execution bridge) are real and
probed — but a passing harness only proves the architecture works *when a test
wires it*. `startA2ARuntime()` in `src/mission/a2aRuntime.ts` is the single
bootstrap that wires it in the shipped product, and `npm run host` launches it
as a process:

```text
load harbor identity  → ECDSA P-256 keypair + fingerprint
load the team         → the teammates this harbor will route work to
sign the A2A card     → JWS over the canonical card bytes (v1.0.0 shape)
attach the handler    → GuardRail scan → routing → this harbor's human gate
attach the risk policy → the receiver re-classifies; a sender cannot downgrade
attach the LiveBridge → real TeamExecutor, real CLI, real git, the repo's test
listen                → GET /.well-known/agent-card.json · POST / (JSON-RPC 2.0)
```

Two such processes are a working pair: one discovers the other's card over
HTTP, verifies its JWS against the published key, presents the bearer token,
and the receiver executes the delegated task for real and returns a sealed
`vh-proof-receipt/2` the sender can verify itself. `probe/a2aRuntime.test.ts`
pins exactly that across independent OS processes (48 checks), including the
byte-pin on the shipped engine bundle — a stale `tools/vh-host-engine.mjs`
fails the gate, and a doctored one fails closed instead of listening.

Honesty rules, inherited from the bridge:

- **No execution deps, no harness binary, no bound repository** → the harbor
  still mounts (it has to, to refuse politely) and every delegation is refused
  in words. `describe()` says which piece is missing.
- **Risky work is denied by default.** A headless host has no operator at the
  gate; `--allow-risky` exists for a supervised host that wires a real one.
- **The receiver grades the request itself.** A sender's `tier: "safe"` is a
  claim: the receiver runs the task through its own §10 risk table and takes
  the worse of the two, so a remote harbor cannot label a `git push --force`
  as safe and walk past the gate. The verdict is recorded on the delegation
  record as `receiverPolicy`.
- **A mounted harbor always enforces a bearer token.** Omit `--token` and one
  is minted and reported — the card advertises `harborIdentity`, and a card
  that claims a scheme the listener does not enforce would refuse everything.
- **`--seat-mode drill`** runs a deterministic local seat (a real child
  process, a deterministic brain) so the mount is testable on a host with no
  agent CLI installed. It is labelled in `describe()`, in the process log and
  in every artifact it produces. The default `--seat-mode real` refuses
  instead of substituting.

```bash
node tools/vh-host.mjs --help     # every flag
npm run host:build                # rebuild + byte-pin tools/vh-host-engine.mjs
```

## Repository layout

```
src/         React frontend — the engine (mission/missionLoop.ts), the Vouch control plane (vouch/), six doors, canvas, harness registry
src-tauri/   Rust shell — Tauri commands, SQLite, keyring, MCP/ACP bridges, git
protocol/    the Vouch Harbor Protocol (device-to-device trust substrate) + zero-dep bridge
probe/       150 probe suites, run by `npm test`
verify/      offline pack — self-contained bundles + runner, byte-pinned
benchmark/   reproducible benchmark pack (zero install, pinned inputs)
tools/       the byte-pinned MCP engine, receipt verifier, and vh-interop (the external-agent boundary)
vendor/      reference MCP servers and the evolution service
docs/        verification notes, information architecture, per-release history
```

## Verification

Every release is certified by the same four gates this README was written
against: `tsc --noEmit`, the live probe suites, the offline pack, and the
production build (see [docs/VERIFICATION.md](docs/VERIFICATION.md)). CI
(`.github/workflows/ci.yml`) repeats them on **Windows — the pre-seed
platform where the native app is built, installed and demoed — on Node 22
(a supported runtime)**, including `cargo check`/`cargo test`/`clippy` on
the real Tauri crate. Releases are additionally certified on the Linux
build host: 16.8.1's gates ran under **both Node v22.23.2 (the CI runtime)
and v20.20.2**. The offline pack is portable — it reproduces the full
gate on any OS with Node alone, zero installs, so the Windows-only CI is
not the only verification path.

The typed command table in `src/ipc/client.ts` makes a renamed Rust command a
compile error, and a version-drift probe fails the build if manifests, docs,
counts or provenance metadata disagree with the code. The clean-identity
probe pins the 16.1 rebrand: no legacy product names anywhere in the routed
surface, `vouch.*` persistence keys only, and both wire generations
(current + legacy) still verifying.

## Documentation

- Desktop builds: [DESKTOP-NATIVE.md](DESKTOP-NATIVE.md), [BUILD-NATIVE.md](BUILD-NATIVE.md)
- Installing on a laptop: [INSTALL-ON-LAPTOP.md](INSTALL-ON-LAPTOP.md)
- Web deployment (Vercel): [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)
- What Vouch Harbor wraps: [VENDOR.md](VENDOR.md) · [NOTICE](NOTICE)
## Communication layer — the Vouch Harbor Protocol (since 17.10)

`protocol/` ships the fixed device-to-device trust substrate (v0.10.7,
"Unified Sentinel-Hybrid": 171/171 gate green) plus the receipt bridge
that anchors `vh-proof-receipt/2` chain heads into the vouch chain — the
cross-org capability channel's trust anchor. Patina proves the work on one
machine; the protocol carries that proof, with identity, authorization,
reputation and revocation, to any other. Start here:

```
node protocol/bridge/bridge-selftest.mjs   # zero-install gate: 17/17
```

See `protocol/README.md` for the layer stack and the full rule record —
RULE 3 (scope-bounded delegation), RULE 4 (designated unbounded authority),
RULE 5 (a capability claim is not a licence) and RULE 6 (rotation possession +
revocation authority). The v0.10.2 "Fix1" history is preserved further down
that file.

- Release history: [CHANGELOG.md](CHANGELOG.md) and [docs/history/](docs/history/) — 19.6.2: [VH-19.6-UPGRADE.md](VH-19.6-UPGRADE.md) · release notes 19.5.1–19.4.1: [VH-19.4-UPGRADE.md](VH-19.4-UPGRADE.md) · 19.3.0: [VH-19.3-UPGRADE.md](VH-19.3-UPGRADE.md) · 19.2.0: [VH-19.2-UPGRADE.md](VH-19.2-UPGRADE.md) · 17.10.5: [VH-17.10-UPGRADE.md](VH-17.10-UPGRADE.md) · 16.9.7: [docs/history/VH-16.9.7-UPGRADE.md](docs/history/VH-16.9.7-UPGRADE.md) · 16.9.5: [docs/history/VH-16.9.5-UPGRADE.md](docs/history/VH-16.9.5-UPGRADE.md) · 16.9.1: [docs/history/VH-16.9.1-UPGRADE.md](docs/history/VH-16.9.1-UPGRADE.md) · 16.8.1: [docs/history/VH-16.8-UPGRADE.md](docs/history/VH-16.8-UPGRADE.md) · 16.8.0: [docs/history/VH-16.8-UPGRADE.md](docs/history/VH-16.8-UPGRADE.md) · 16.7.0: [docs/history/VH-16.7-UPGRADE.md](docs/history/VH-16.7-UPGRADE.md) · 16.6.0: [docs/history/VH-16.6-UPGRADE.md](docs/history/VH-16.6-UPGRADE.md) · 16.5.0: [docs/history/VH-16.5-UPGRADE.md](docs/history/VH-16.5-UPGRADE.md) · 16.4.1: [docs/history/VH-16.4-UPGRADE.md](docs/history/VH-16.4-UPGRADE.md) · 16.3.0: [docs/history/VH-16.3-UPGRADE.md](docs/history/VH-16.3-UPGRADE.md) · 16.2.0: [docs/history/VH-16.2-UPGRADE.md](docs/history/VH-16.2-UPGRADE.md) · 16.1.0: [docs/history/VH-16.1-UPGRADE.md](docs/history/VH-16.1-UPGRADE.md)
- Problem map (what each feature exists to solve): [docs/PROBLEM-FOCUS.md](docs/PROBLEM-FOCUS.md)
- Information architecture (one product, one spine): [docs/INFORMATION-ARCHITECTURE.md](docs/INFORMATION-ARCHITECTURE.md)

## License

**Proprietary — all rights reserved** (see `LICENSE`). The source is
available for evaluation; commercial terms are handled directly by the
project
(`src/mission/licensing.ts`); vendored components ship under their own terms
([NOTICE](NOTICE), [VENDOR.md](VENDOR.md)).

---

Built by **the Vouch Harbor team**. Feedback and pull requests welcome.
