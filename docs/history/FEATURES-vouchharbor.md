# Vouch Harbor 19.7.0 "Recall" — feature sheet

### NEW in 19.7.9 [Keyholder] — the P0 killed: no key ever ships

- **The artifact carries NO secret** — the 19.7.8 review proved anyone
  holding the ZIP could forge verdicts, because the verifier's PRIVATE key
  rode inside it. Now the keypair is provisioned at RUNTIME (first run
  generates it; private key at `~/.vouchharbor/verifier.key`, mode 0600,
  outside every distributable) and the leaked key is purged from the repo,
  with `.gitignore` refusing `verifier/*.key` outright.
- **Owner-countersigned registration** — the provisioned public key is
  signed by the OWNER key (the mandate/crossing authority) into the owner
  trust store; verdicts verify under the REGISTERED key; re-provisioning
  requires the owner again.
- **The PROGRAM is pinned** (`vh-verifier/3`) — the verifier digests its
  own source at runtime and binds `programDigest` into every signature;
  the frozen trust root pins it beside the battery digest. A modified
  verifier is refused even before its key matters.
- **Honest words, everywhere** — the battery is EXTERNALLY EXECUTED and
  DIGEST-PINNED (its source ships; pinning prevents swapping, not
  secrecy). "Hidden/secret" is scrubbed from code, ledger text, and docs.
- **Artifact hygiene is a standing probe** — probe/rsiralsV6 grew
  42 → 53: no key in the tree, no key in the trust root, program digest
  byte-pinned, provisioning flow + registration tamper + foreign-key
  forgery + battery swap + replay + live apply, all green.

```
first run (per machine, owner-gated)
      │
  canaryClient ──spawn {op:"provision"}──► verifier/vh-verifier.mjs
      │        ◄── publicKeyJwk · keyFingerprint ──┘  key born at
      │                                               ~/.vouchharbor (0600)
      ▼
  OWNER KEY countersigns ──► REGISTRATION in the owner trust store
                             (stranger keys refused; re-provision = owner)

every apply (the Evolution desk, active console)
      │ proposal · nonce: CSPRNG randomUUID
      ▼
  canaryClient ──spawn {nonce, candidate}──► verifier/vh-verifier.mjs
      │        ◄── {failed, batteryDigest, programDigest, sig} ──┘
      ▼
  VALIDATE: nonce echo · battery = pin · program = pin · alg = pin ·
            ECDSA verify under the REGISTERED key
      ▼
  governChange: constitution → drift budget → EXTERNAL canaries
      ├─ BLOCK ──► refusal names the rule; proposal stays pending
      └─ ESCALATE ──► the HUMAN click = the promotion decision (fail-closed)
                         ▼
       override lands · v5 archive applied/reverted · v6 ledger
```

### NEW in 19.7.8 [Trustroot] — real signatures + a frozen trust root + the live desk

- **ECDSA P-256 verdict signatures** — the external verifier signs with
  its own private key; VH verifies against the public key PINNED in the
  frozen trust root. A foreign key literally cannot get a verdict accepted
  (probe pins the forgery attempt).
- **The frozen trust root** (`src/vh19/verifierTrust.ts`) — since 19.7.9
  it pins DIGESTS ONLY (verifier program · battery over every check's
  SOURCE) plus the registration pointer; no key material has shipped
  since. No setter; rotation is a release event.
- **CSPRNG nonces** (randomUUID) · **battery-swap refusal on sight** ·
  **the Evolution desk on the ACTIVE NextConsole** — scan → approve
  (gated) → the note shows verdict · canary source · ledger seq.

```
live self-evolution apply (the Evolution desk, active console)
      │ proposal
      ▼
  canaryClient ──spawn──► verifier/vh-verifier.mjs  (OUTSIDE src/)
      │ nonce: CSPRNG randomUUID          │ 6 held-out checks
      │        ◄── ECDSA P-256 signature ─┘  digest binds check SOURCE
      ▼
  TRUST ROOT (frozen): pinned public key · pinned battery digest · fingerprint
      │ verify signature + anchor battery + echo nonce
      ▼
  governChange: constitution → drift budget → EXTERNAL canaries
      ├─ BLOCK ──► refusal names the rule; proposal stays pending
      └─ ESCALATE ──► the HUMAN click = the promotion decision (fail-closed)
                         ▼
       override lands · v5 archive applied/reverted · v6 ledger
```

### NEW in 19.7.7 [Verifier] — RSIRALS v6 goes LIVE (the verifier leaves the building)

- **External canary verifier** — the held-out battery moved OUT of `src/`
  into `verifier/vh-verifier.mjs`, a separate zero-dependency process
  outside the self-modifiable surface (the constitution refuses candidates
  targeting it by name). Fresh nonce per call, SHA-256 signature binding
  nonce·verdict·battery-digest; replays and tampered verdicts are refused;
  no process → honest `unavailable`, never a pretend pass.
- **The live promotion path is v6-gated** — `applySelfChangeGuarded()` runs
  every self-evolution apply through external canaries → constitution →
  measured drift (the mutation, not the justification) → BLOCK-with-reasons
  or human-completed fail-closed promotion. Reverts land on both ledgers.

```
live self-evolution apply (the Apply button)
      │ proposal
      ▼
  canaryClient ──spawn──► verifier/vh-verifier.mjs  (OUTSIDE src/)
      │  nonce + signed verdict    │ 6 hidden checks, held out
      ▼                            ▼
  governChange: constitution → drift budget → EXTERNAL canaries
      │                                    (scan the FULL submission)
      ├─ BLOCK ──► refusal names the rule; proposal stays pending
      └─ ESCALATE ──► the HUMAN click = the promotion decision
                         ▼
       regression gate (fail-closed: tighten-only · human-approved)
                         ▼
       override lands · v5 archive applied/reverted · v6 ledger
```

### NEW in 19.7.6 [Office] — RSIRALS v6: the strengthened verifier · the office · the real crossing seam

**RSIRALS v6 — the trust plane gets the upgrade, plane T stays frozen at v5.**
The 2026 research consensus in one line: when self-improvement drifts,
strengthen the VERIFIER, not the generator — and ground the loop in checks
it cannot modify. v6 ships exactly that, deterministic and probe-pinned:

- **The Constitution** — 4 machine-checkable invariants (no self-governance ·
  discretion-tightening · evidence-bound declarations · the human door is
  untouchable), diffed against EVERY candidate before anything else runs.
  Frozen, outside the evolvable surface — the evaluator is not part of the
  evolvable code.
- **The Drift Budget** — a candidate's change is MEASURED (token-level
  Jaccard distance vs the current text), never asserted: max 0.60 per
  change, 1.50 cumulative per rolling 24h. Bust the budget and the refusal
  tells you to shrink the step until a human can review it in one sitting.
- **Hidden true-objective canaries** — a held-out 4-check battery the
  proposer never sees at proposal time (overreach · scope creep ·
  evidence-dry declarations · evidence evasion). Verdicts only, at verify.
  Proposer-reported gains count for nothing.
- **Staged promotion, fail-closed** — SHADOW → CANARY → FLEET, with a
  frozen regression baseline checked PER DIMENSION: any single dimension
  below its floor refuses, even when the average rises. Unmeasured = refused.
- **The tamper-evident ledger** — every gate event (proposed · blocked ·
  canaried · promoted · rolled back) lands in a SHA-256 hash-chained,
  append-only local ledger with actor + policy version per event (the EU AI
  Act Art.12 receipt pattern). verifyLedger() re-walks the chain; one
  altered byte breaks it at that seq.
- **One gate + rollback** — governChange() is the only door: constitution →
  drift → digest-pinned canaries → ALLOW / BLOCK / ESCALATE-to-human. The gate
  NEVER promotes to fleet by itself; the human door is load-bearing.
  Promotion snapshots last-known-good; rollback() restores in one step,
  on the ledger.

```
RSIRALS v6 — THE STRENGTHENED VERIFIER (T stays frozen at v5)

  self-improving plane (rsi.ts loop)                    THE HUMAN
        │  proposes a change {name,target,body,declares}    ▲
        ▼                                                   │ ESCALATE /
  ┌─────────────────── governChange() — the ONE door ───────┴────────┐
  │                                                                   │
  │  1. CONSTITUTION (frozen, 4 rules)        fail → BLOCK (named)    │
  │     └ c1 rides the v5 control-plane firewall                      │
  │  2. DRIFT BUDGET  Jaccard(current, body)  > 0.60 → BLOCK          │
  │     └ cumulative 1.50 / rolling 24h                               │
  │  3. HIDDEN CANARIES (4, held out)         any fail → BLOCK        │
  │     └ proposer never sees the checks — verdicts only              │
  │  4. VERDICT: ALLOW / BLOCK / ESCALATE ────────────────────────────┘
  │                              │ human decision + per-dimension scores
  │  5. REGRESSION GATE          ▼
  │     └ fail-closed: ANY dimension < floor refuses (average irrelevant)
  │  6. PROMOTE  SHADOW → CANARY → FLEET   · last-known-good snapshot
  │  7. ROLLBACK  one-step restore, on the ledger
  │
  └──► LEDGER: SHA-256 hash-chained, append-only, tamper-evident
       every event carries actor · target · policy · digest · prevHash
```

**The Office — the 25 sub-agents' common space.** The crew workspace stops
being a flat roster: the crew renders as ONE office — departments by domain
(frontend, security, finance…), a shared board (at the gate · working ·
answered · sidelined), the steward making the rounds. Specialists from
different domains look like what they are: one team in one space, working
autonomously inside the modes and caps.

**The real crossing seam.** The Groups panel now runs crossings through the
live signed federation crossing (productionCross → runLiveCrossing) — the
production path finally matches the 37/37 module proof. And the panel says
exactly what it is: a governed local implementation of the cross-owner
group protocol; networked VH-A ↔ VH-B signing is the next federation
milestone.

### NEW in 19.7.5 [Groups] — two owners' agents, one governed crew

- **The charter**: both owners accept the same digest; capabilities from
  the federation vocabulary; hard limits (tasks/24h · crossings/task ·
  expiry); one-sided revocation with the reason on record.
- **Group work**: LOCAL items (real member loops, MoE-routed) + CROSSING
  items (the signed crossing, replay-guarded). No grant → fails named.
- **Three modes group-wide**, hot-switchable mid-run; crossings gate in
  Manual AND Semi-autonomous (cross-owner delegation is risky by nature).
- **Per-item human gates** with the revival law; item digests chained into
  the group session receipt; the steward reports as it happens.
  probe/groups: 37 checks.

### NEW in 19.7.4 [Crew] — 25 specialists, one working space, zero third-party agents

- **CLI retirement**: every agent executes natively on the owner's provider
  keys through the audited VH loop — one receipt format, no third-party
  binary in the trust chain; old graphs auto-migrate.
- **The crew workspace**: up to 25 specialists in parallel from dynamic
  domain pools (Agentic MoE v2: sparse selection with reasons, per-member
  reserve bench), instant same-domain failover, the 3-strike crew breaker,
  Manual / Semi / Full hot-switchable mid-run (critical always gates).
- **LOTUS**: Lean Optimal Token Utilisation System — reversible, error-
  passing, net-win-gated tool-output compression; every number an
  estimate, labelled.
- The review fix lives here too: muster and run are two phases; an
  all-gated run awaits the gate instead of failing. probe/crew: 35 checks
  including the reviewer's exact UI sequence.

### NEW in 19.7.3 — the autonomy release, integration-hardened ([Agent])

- **BEW on every sub-agent — enforced TWICE.** In every composed prompt
  AND at runtime: the member loop carries a `BewRun` phase machine —
  runtime-enforced PHASE/PROVENANCE discipline (the workflow and its
  evidence trail are machine-checked; semantic correctness is judged by
  the specialist's own VERIFY against the acceptance check it declared
  at INTAKE). The trail records as it executes, a run that cannot prove
  VERIFY cannot claim done, recoveries cap at one, every run ships a BEW
  receipt with violations (probe/bew 24).
- **The Agentic MoE** — sparse specialist routing over the WHOLE fleet
  (all 1,850, every category; agent-level routing, stated as such): fewest
  experts per task (1/2/3 by tier), marginal-coverage pruning with reasons
  (`moe.ts`, probe/moe 17).
- **The initiative engine — decide, then EXECUTE through the shared
  production executor.** Heartbeat safe acts carry the SAME dep set as a
  typed chat message (provider · human gate · handoff recorder ·
  evidence fetch) into askVH19 → MoE → member loops → gated tools →
  receipts; failures feed the 3-strike breaker, partials reschedule
  capped verify check-backs, proposals never self-execute (`initiative.ts`
  + `initiativeBridge.ts`, probe/initiative **35** — including the true
  integration test: a scripted provider, real member loops answering on
  the wire).
- **The 3D memory graph.** Zero-dependency engine: deterministic layout,
  glossy-black nodes with silver speculars, drag/zoom/inertia
  (`graph3d.ts`, probe/graph3d 17).
- **+700 specialists.** 350 finance (200 India · 150 international) +
  350 silicon across the full lifecycle, each with domain playbooks and
  honest contracts (probe/financeBench 20 · probe/siliconBench 17).
  Fleet: **1,850 established · 2,490 catalogued**.

### NEW in 19.7.2 — the maturity release (Noir)

- **Operator doctrine in every specialist.** Five rules appended to every
  composed prompt (`skills.ts` → `buildSpecialistPrompt`): verify before
  claiming · evidence over prose · fail forward with one labelled retry ·
  self-review marks INCOMPLETE, never guesses · scope past the safe tier
  returns to the human.
- **The maturity budget.** Member loops run up to five act/observe/adjust
  steps (`MAX_AGENT_STEPS` 3 → 5).
- **The Steward.** The center agent renders as the Steward on every
  surface; no rendered "Generalist" remains (probe/consolePolicy).
- **Final-product surface.** No version numbers, no demo/simulated props
  anywhere in the console.
- **Noir (default) + Cream Gray.** Flat matured black by default; a warm
  light finish under `html[data-theme="cream"]`; switched in Settings →
  Appearance, applied before first paint.
- **Minimal Settings.** Appearance · Security · Memory · Data, plain
  words; memory ON without a vault warns and points at vault creation.
- **Exact provider memory.** Session-only = memory + stored-copy removal,
  never sealed; on-this-machine = requires the unlocked vault, then seals.

### NEW in 19.7.0/19.7.1 — the console remembers, every token is accounted for, and secrets seal

**The owner vault (19.7.1).** Provider keys and the memory graph seal
with AES-256-GCM under a passphrase-derived key (PBKDF2-SHA-256, 310k
iterations) — the passphrase is never stored, sealed records hold no
plaintext, and legacy plaintext keys are purged as compromised. Without a
passphrase everything is session-only and the UI says so in words.

**The MCP runtime (19.7.1).** Enabled market servers become the governed
`mcp.call` tool — egress-guard review, the risky-tier human gate, receipts;
real JSON-RPC for HTTP servers, the host bridge (or an honest refusal) for
stdio. The market is no longer a registry; it is tool surface.

**The mission strip (19.7.1).** The Generalist's last run — authority,
evidence, cost, the crew that worked — sits above the stream as the
console's center of gravity; infrastructure planes group visibly below.

**Conversations as memory graphs.** Every chat becomes a graph of its
keywords — nodes, co-occurrence edges, dated sessions — stored
local-first. Ask in plain words ("what happened that day about the Zephyr
migration?") and the graph recalls the session and REHYDRATES it into the
crew's context — always marked as rehydrated, in the prompt and in the
UI, never a silent injection. Deterministic extraction, keyword + date
recall, idempotent upsert; 26 probe checks (`probe/memoryGraph`).

**The token pipeline on every call.** Normalize → repeated-line dedup
(marked in place) → prompt-cache alignment (measured, never gamed) →
emergency budget. The reply carries its own honest delta:
`⚡ est −N tok (P%)`, estimates labelled as estimates
(`probe/tokenPipeline`).

**The MCP market.** Add ANY Model Context Protocol server: 12 curated
reference servers (Filesystem, Git, GitHub, Postgres, SQLite, Brave
Search, Web Fetch, Memory, Sequential Thinking, Time, Slack, Puppeteer)
or your own stdio command / HTTP URL — zod-validated, the same SSRF
egress guard as providers, env keys by name only, one-click standard
`mcpServers` export for the host and any MCP client (`probe/mcpMarket`).

**A2A replay guard.** A duplicate crossing submission inside a 60-second
window is refused in words before anything is signed — a double click can
no longer sign two crossings (`probe/autoRepairReplay`).

**Autonomous error handling.** A member's transient provider failure
(timeout, network reset, unusable response) gets ONE situation-changing
auto-retry — no human pause, labelled on the run. Non-transient failures
are never blind-retried (`probe/autoRepairReplay`).

**The preview fix.** Sandboxed/opaque-origin frames (embeds, preview
panes) boot the real console now — the CORS + CSP root cause is fixed
and stated, not worked around.

**Your agents work directly with your customer's agents — with a human on both
sides and evidence either side can verify offline.**

### The full gate, in whatever window you have

The offline gate is 134 bundles and about 80 seconds on two cores, and it runs
**with nothing installed** — the archive extracted alone reaches the whole pack
(`134 passed, 0 failed`, and `sh VERIFY.sh` says the same in 82s). If even that
window is too short, it runs in pieces:

```bash
node verify/run.mjs --shard 2/4 --time-budget 90   # a deterministic slice
node verify/collect.mjs                            # the whole verdict, merged
```

A shard is a slice of the *sorted* suite list, so two machines shard identically
and a merged verdict is a verdict about the tree. A time budget decides what is
**started**, never what is **judged** — a running suite always finishes. A run
that stops early exits **3, never 0**, and names every suite it did not reach;
`collect` returns 0 only when the union covers all 134. One shard of four merges
to `34 passed, 100 not covered` → exit 3. Four merge to `134 passed, 0 not
covered` → exit 0.

Nothing in that path needs an install. The batch generators fall back to
pre-compiled specs in `verify/specs/` (sha256 in `verify/MANIFEST.json`);
`tools/drill-benchmark.mjs` and `tools/external-model-validation.mjs` do the
same; and the MCP engine `tools/mcp-engine.mjs` **carries its own runtime
dependencies**, so `node tools/mcp.mjs` answers an `initialize` handshake from a
directory containing nothing but itself. Every fallback announces the path it
took, and every pre-compiled artefact's hash is pinned in the manifest.

### A catalog entry is not regulatory authority

The regulated benches cover domains where the governing rule matters as much as
the technique. Those entries carry specification, vocabulary, risk tier and
doctrine — and they are **registered, not routed**: they receive no work until
the owner wires them in. On top of that, `federation/regulatedPolicy.ts` states
the rule the reviewer asked for:

- a regulated bench is **never** enabled by default, by upgrade or by a caller;
- activation names a **jurisdiction** and a **context**, by a **named person**,
  with a date it **must be reconsidered**;
- every way of leaving it vague is a refusal with its own name (`no-owner`,
  `no-domains`, `no-jurisdiction`, `weak-jurisdiction`, `no-context`,
  `no-renewal`, `expired`);
- activation `attests` who enabled what, where and until when — and explicitly
  does **not** attest that the jurisdiction accepted the use.


### Approve once, then run autonomously — with the evidence unchanged

A crossing stops for a human decision on each side, every time. That is right for
the first crossing and for anything unusual; it is untenable for the tenth crossing
of the same kind in the same day, which is the case that actually exists between a
working pair of harbors. So both owners can now approve **once**, and the pair works
on its own from there (`federation/standing.ts`).

What is removed is the human from the loop. What is **not** removed is the evidence:

- every crossing still carries its own envelope, its own nonces, its own receipt;
- each crossing is individually authorised under the grant by an acknowledgement
  bound to *that* envelope digest and *that* side's nonce;
- a grant is **bounded** — enumerated capabilities (never `*`), a total budget, a
  rate window, an expiry — and out-of-scope work **escalates back to a human**
  rather than proceeding;
- either side may revoke, at any time, with the reason on the record;
- the acknowledgement prints what it proves *and what it does not*: it attests that
  the owner's key authorised this crossing in advance under a grant naming the
  humans who set its bounds, and it explicitly does **not** attest that a human
  reviewed this particular crossing.

### One common place to check — two independent stores

Both users should be able to check the same thing from one place. A shared *server*
would be a shared trust anchor — whoever holds it could drop a row or show each side
a different history — so the common place is a derived **view**, not a shared store
(`federation/ledger.ts`):

- both sides record the same joint row for a crossing, into their **own** store;
- each side independently derives a **root** over its own entries; the roots are
  compared — equal means both hold the same set, and each proved it rather than asserted it;
- a divergence is named **in words, down to the crossing id**, and a missing row and
  a changed row are different findings, each with its own sentence;
- the shared screen is the union in time order: a row only one side holds is
  *marked*, a row the two hold differently is *flagged and shown unmerged* — never
  averaged away;
- a neutral third party may hold the agreed root. That mirror can prove the sides
  diverged; it can never assert what is true, because it holds one number, not the records.

### Activation is owner-key bound, not a named string

`federation/regulatedPolicy.ts` now signs activation with the harbor's owner
authority key, bound to the exact content — `enabledBy`, jurisdiction, context,
renewal date and the domain list — and files it with the same `attests` /
`notAttested` discipline as an approval. An unsigned activation is **refused by
name** ("a name is not an authorisation"), a signature that does not cover the
content cannot be re-aimed at another bench, and completeness is still judged
before anything is signed.


## 0. What 19.6.6 ships (the current release)

**The federation plane moves from probed subsystem to live path, and the app
becomes one console.**

- **One console, and it IS the app** — the 19.6.6 redesign deleted the
  multi-dock atelier shell outright. The Generalist's dark operations console
  is the whole product: crew rail on the left, run stream in the main pane,
  handoff ledger and federation plane one click away. Every run bubble rides
  its honesty chips (provenance digest, ECDSA mandate, gate banners that
  never skip silently). `src/App.tsx` mounts the console and nothing else.
- **The Generalist keeps ONE face** — deterministic, derived from the name
  its owner gives it (rename it and the face changes); every specialist
  carries a deterministic mark of its own. `src/vh19/face.tsx`; pinned by
  `probe/face` (10 checks).
- **Standing authority on the LIVE crossing** — the console issues a grant
  both owners sign once, and the pair crosses under it: each crossing keeps
  its own envelope and nonces and mints one acknowledgement per side, bound
  to that envelope digest. Out-of-scope, spent, lapsed or revoked grants
  ESCALATE to a per-crossing human decision — escalation is designed
  behaviour, never an error, and a grant never overrides earned pair
  standing (it adds one co-signed trust unit to the mesh's own ladder).
  The seam's owner key resolves through the hardened authority service —
  native keychain > passphrase-encrypted > session-only; no raw private
  key at rest. `src/vh19/federation/live.ts`; pinned by `probe/fedWired`
  (18 checks).
- **One common place to check, on the receipt** — every outcome (crossed AND
  refused) lands as the same joint row in BOTH stores with both receipts,
  and the roots over each store are compared on the receipt itself; the
  shared screen is a derived view, byte-identical by construction.
- **Regulated activation on the routing path** — the registered regulated
  bench (230 specialists) stays unrouted until a signed, complete, current
  activation exists; the refusal names every gap, and the unsigned case is
  named exactly: a name is not an authorisation. `generalist.ts` consults
  the gate over its selected specialists; `probe/fedWired` pins it.
- **Provider onboarding in the console** — first-time users connect
  OpenAI-compatible, Anthropic or Gemini right in the console (remembered
  under one named local record, forgettable); the legacy surface is not
  needed. `navAlign` pins it.

The 19.6.4 subsystem record stands unchanged beneath:

```
                        VH-19 GENERALIST (one console door)
                               │
                     ┌─────────┴─────────┐
                     │                   │
             1,790 specialists      Team / A2A / BYOA
             (1,150 established         │
              + 640 registered)         │
                     └─────────┬─────────┘
                               │
              RSIRALS v5 (frozen plane T) + v6 strengthened verifier
                               │
                    Authority — ECDSA P-256 mandates
                               │
                    ┌──────────┴──────────┐
                    │                     │
              Intent / Receipts    ★ FEDERATION PLANE (19.6, new)
                    │                     │
             VouchMesh (local      identity → anchors
              trust fabric)        approval → signed human decisions
                    │              bridge   → crossings, both humans
                    │              sigil    → the Face, derived
                    │              fleet    → one honest count
                    └──────────┬──────────┘
                               │
                       Agent Reach MCP (primary default MCP)
                               │
                      Computer Use / governed browser
```

★ = new in 19.6.0. Everything else is the frozen 19.5.6 "Reach" engine,
unchanged — this release adds a layer beside the core, not inside it.

### ★ The Federation plane — a crossing both humans decided

- **`identity.ts` — one identity system.** The federation identity is the
  harbor's *existing* authority identity: the same owner keypair that signs
  mandates, resolved through the same keystore (native OS credential store →
  AES-256-GCM envelope → session, honestly flagged `session`). The planner
  layer mints nothing. A peer pins an **anchor** carrying a *proof of
  possession* — an ECDSA self-signature over the anchor body, bound to the
  derived face — because a claimed public key proves nothing about who holds
  the private half. A session-scoped anchor is refused outright when a caller
  requires durability.
- **`approval.ts` — an owner-key approval, not a memory, and named as such.**
  A `FederationApproval` is ECDSA P-256 by the harbor's **owner authority key**
  over a body bound to `{ pair, side, capability, envelopeDigest, nonce }` with an
  expiry, spendable exactly once — *naming the human the key acts on behalf of*.
  Every way of re-aiming it has its own refusal: `wrong-pair`, `wrong-side`,
  `wrong-capability`, `wrong-envelope`, `wrong-nonce`, `expired`, `bad-signature`,
  `replayed-approval`. A decision that fails verification is **not** burned — the
  human keeps it.
  **What that proves is stated, never implied** (19.6.2): `APPROVAL_ATTESTATION`
  — *the owner's authority key approved, naming who authorised it* — beside
  `APPROVAL_NOT_ATTESTED` — *not that the named human authenticated with a
  credential distinct from the owner key*. Both sentences travel on every filed
  record, next to `signedBy` and the signing key's `ownerKeyHandle` (which key
  signed, beside which human it named), and they sit inside the crossing
  outcome's digest, so a receipt cannot be re-worded.
- **`bridge.ts` — the crossing.** An envelope is minted first (CSPRNG id, one
  nonce per side), digested, and only then does each human decide *against that
  digest*. The crossing proceeds only if both approvals verify, both policies
  lend the capability, and both decisions are still unspent — otherwise the
  refusal names the side and the rule. **A prior `success` row is not an
  approval**, pinned by probe. Standing is **read**, never written, and read
  **per side**: `standingInitiator` / `standingResponder` each consult their own
  harbor's local store, and the outcome records which store each tier came from
  (`standingSource { initiator, responder, shared }`, inside the digest). A
  single-machine caller passes one reader and the receipt says `shared: true`
  instead of implying two stores agreed. That is *distributed evidence, local
  trust state* — now true of the runtime, not only of the prose.
- **`sigil.ts` — the Face, redesigned.** A heraldic device derived from the
  identity's own SHA-256: field, division, semé, chief, charge, tincture,
  ground, bordure, tilt, plus a 16-hex handle beside it. **No gallery, no
  colour picker, no "new set"** — a face you can re-roll is a costume, and a
  costume is an impersonation surface. **No eyes and no mouth:** the renderer
  has no code path that puts two charges on one row (the first draft did, and
  it rendered as a smiley — that is now a probe). **Seven states** ride a crest
  so the field never emotes: at rest · working (three dots) · acting (a play
  triangle) · awaiting a human (a padlock) · verified (a heavier rim and a
  verdict seal) · refused (a slash through the field) · failed (a cross above
  it). Refused and failed are deliberately different marks: one is the harbor
  deciding, the other is a run that broke, and VH does not conflate them. The
  state list is exported (`SIGIL_STATES`) and read by the sheet, the montage and
  the app, so no surface can show a state the module does not define. Palette is
  strictly VH's own tokens.
- **The mark is KEY-derived.** The face a counterparty pins comes from the
  **canonical public key**, not the owner's name: rotate the key and the mark
  changes; swap the key and the old mark cannot come with it. Key material is
  canonicalised to the Base64 body of the SPKI PEM, so a PEM and a JWK of the
  same key draw the same mark however either is wrapped. Two kinds of mark
  exist and are **labelled, not confused**: *key-derived* for a harbor identity
  (whose identity of record is its key) and *subject-derived* for a run-derived
  subject with no key of its own. Hover text says which one you are looking at.
- **The Face is on screen, not just in a module.** `federation/SigilFace.tsx`
  renders both kinds: the mission-crew cards in the VH-19 door carry each
  member's *subject-derived* mark in the state their run ended in, and every
  **bound peer identity** in the collaboration desk carries the *key-derived*
  mark of the key you bound — re-encoded to the canonical form, so it is the
  same mark that peer's own anchor attests to. Hover text says what it is: *a
  recognition mark — the key is the proof*.
- **`fleet.ts` — one honest count.** `fleetClaim()` is the only way to state the
  number and it always prints both halves:
  **1,150 established specialists + 640 registered specialists = 1,790
  catalogued, 1,150 routed today.**

### ★ The fleet: 1,150 established + 640 registered = 1,790 catalogued

- **1,150 established** — the 19.5.6 bench (460 seed + 160 broader + 140 reach
  + 390 matured) across 14 categories, every category with a Captain (14/14).
  These are routed by the Generalist today.
- **+200 registered (19.5.6-reach batch)** — forty industry domains × five
  stations of work (assess · design · build · verify · sustain): energy, water,
  manufacturing, telecom, robotics, embedded, simulation, logistics, supply
  chain, retail, agriculture, climate, fisheries, insurance, banking, disaster
  modelling, payments, hospitality, real estate, clinical trials, tax, public
  sector, financial crime, critical infrastructure, identity, automotive, rail,
  medical devices, aerospace, pharma, aviation, streaming, games, media,
  journalism, publishing, advertising, PR, nonprofit — census 120 safe / 40
  risky / 40 critical.
- **+230 registered (19.6.2-regulated batch)** — forty-six *regulated-field*
  domains × the same five stations, the band where **the governing rule matters
  as much as the technique**: regulated software (avionics DO-178C, medical
  IEC 62304, industrial control IEC 61508), occupational/process/fire safety and
  physical security, certification, environmental testing, calibration and
  metrology, structural/electrical/food inspections, official statistics, census
  and public records, grid/refinery/hospital operations, public health,
  epidemiology, biosecurity, veterinary medicine, regulatory and standards
  writing, plain language, actuarial and pensions, audit and assurance,
  cost-benefit analysis, forensic accounting, urban and transport planning,
  accessible design, benefits administration, permitting and licensing, civic
  technology, facilities and building services, waste management, emergency
  management, courts, immigration, customs and trade, and emergency, crisis and
  consultation communications — census 138 safe / 46 risky / 46 critical, with
  **128 distinct domains across the three registered benches**, checked domain by
  domain so a new bench cannot re-slice ground the fleet already holds.
- **+210 registered (19.6-federation batch)** — forty-two *practice* domains ×
  the same five stations: quantum software, kernel systems, compilers,
  supply-chain security, zero trust, hardware security, chaos engineering,
  performance, accessibility, architecture/model/contract review, data
  engineering, geospatial, time series, platform engineering, observability,
  edge, scientific computing, materials, genomics, technical writing,
  curriculum, localization, financial modelling, risk, operations research,
  service/industrial/motion design, API product, developer experience,
  marketplaces, revenue ops, partnerships, procurement, privacy law, IP, export
  control, internal comms, investor and developer relations — census 126 safe /
  42 risky / 42 critical.
- **Registered is not a euphemism for missing.** Every registered specialist
  carries capabilities, routing vocabulary, an honest risk tier and a real
  system prompt; the gate checks each one. What it does not carry is a claim of
  runtime depth, and no surface may make one. Wiring them in is one spread in
  `registry.ts` — the owner's decision, and a probe fails if a registered bench
  ever joins silently.
- **All three batches come from one compile step**
  (`src/vh19/federation/batchKit.ts`) and are **generated from reviewed specs and
  drift-gated**: `node tools/generate-batch.mjs --all --check` fails if any
  snapshot and its spec disagree by a single byte — from the CLI or from the
  gate. The two older entry-point names still work as shims.

### The 19.5.6 "Reach" engine (unchanged in 19.6)

- **The 1,150 fleet** — 460 seed + 160 broader + 140 reach + 390 matured
  specialists across 14 categories, each matured specialist individually
  specified with named doctrine plus the uniform maturity contract (evidence
  before claims, gate on risky moves, receipts on every tool call, failures in
  words). Composition is self-proving from `catalogStats().byProvenance` — the
  number on screen is the number in code.
- **Agent Reach MCP — the app's primary default MCP server** (in-app + stdio),
  six tools: `pc.exec`, `pc.browser.open`, `pc.browser.screenshot`,
  `authority.issue`, `authority.verify`, `authority.lookup`. Every call rides
  the governed pipeline: risk tier → human gate → receipt.
- **The computer-use plane** — allowlisted, injection-scanned, bounded process
  execution; an honestly HYBRID browser (HTTPS fetch/snapshot, injectable
  transport, real-binary screenshots — refusals in words, never a faked page);
  central egress guard plus a stricter navigation rule for the browser plane.
- **Portable authority (ECDSA P-256)** — owner-granted mission mandates with
  clamped scope/budget/depth; a wrong owner passphrase is a HARD unlock failure
  (sealed keys are never replaced); verification works with the public key
  alone. Finished runs carry a run attestation bounded to what actually
  executed.
- **VouchMesh — the local collaboration trust fabric**, wired into the live A2A
  handoff seam: every delegated handoff produces a joint receipt co-signed by
  both participants; pair trust compounds across sessions; refusals move trust
  down. Scope stated everywhere: **VouchMesh is the LOCAL collaboration trust
  fabric; ECDSA provides portable authority across instances.** 19.6 adds the
  portability layer above it without redefining it.
- **Teammates plane (19.5.6)** — crew UX, VH-hardened: after each run, the
  Chief Steward + every routed specialist appear as mission-crew cards (run
  status, queue, scope, workspace DERIVED from the member's actual tool surface
  + the run's stated seam, sha256 verified trace digests, and a separate ECDSA
  P-256 authority line when the mandate exists). A coordination feed narrates
  the run; a labelled one-click sample mission demos the pipeline. Anyone can
  show a trace; VH signs it.
- **CSPRNG mission ids** — `crypto.randomUUID()` / `getRandomValues()`, 122 bits
  of randomness per id; never text-derived, never a non-crypto RNG.
- **Verification as a shipped product** — **137 probe suites**, **136
  self-contained offline bundles** (`node verify/run.mjs`, zero npm deps; the
  eleven headline suites also run in ~1.3s via `node tools/quick-verify.mjs`),
  a version-drift gate that pins every manifest, the BUILD-INFO provenance
  identity and the operational doc titles, byte-pinned engine bundles (MCP host
  + A2A host recompute checks), offline-verifiable receipts.
- **Native identity** — Vouch Harbor namespace end to end (`vh.sqlite`
  migrated in place, `vh-desktop` keychain with legacy read-fallback,
  `vh://event`), owner private keys never plaintext at rest.

Gates at 19.6.6: tsc 0 · 137 probe suites green · offline 136/136 (also
shardable: four parts, merged by `verify/collect.mjs`) · versionDrift green ·
offlinePack green · fleet 126/126 · teammates 14/14 · face 10/10 ·
fedWired 18/18 · reachPlane 31/31 · meshRuntime 17/17.

Gates at 19.6.4 (lineage): tsc 0 · 135 probe suites green · offline 134/134 ·
versionDrift 42/42 · offlinePack 17/17 · fleet 126/126 · teammates 14/14 ·
door 70/70 · reachPlane 31/31 · meshRuntime 17/17.
New at 19.6: fedSigil 8 · fedApproval 7 · fedCrossing 13 · fedIdentity 7 ·
fedFleet 9 · reachBeacon 9 · reachGrant 7 · reachPairMemory 9 · reachBatch 6.
A reviewer with a short execution window can reproduce the headline set with
`node tools/quick-verify.mjs` — eleven suites, ~1.3s, zero install.
The Face renders on screen in the mission-crew cards and the bound-peer list
(`src/vh19/federation/SigilFace.tsx`).

Gates at 19.5.6 (lineage): tsc 0 · fleet 126/126 · offline 125/125 ·
teammates 14/14 · door 70/70 · agentic 24/24 · reachPlane 31/31 ·
versionDrift 42/42.

*Everything below the line is the lineage record — accurate for the release
named in each section heading.*

---

## A. VH-19 — the Generalist front door (the primary UI)

```
User (VH-19 door — the app opens here)
   ↓
GuardRail content gate
   ↓
MoE-style router → specialist bench (1,150 registered specialists, 14 categories)
   ↓
Human gate (risky/critical work pauses; modal blocks the run)
   ↓
REAL provider execution (OpenAI-compatible / Anthropic / Gemini)
   ↓
Honest outcome: answered · planned · refused · gated-out · error · peer-delegated
   ↓
user Accept / Reject (+ why) → local learning memory
   ↓
90% autonomy exam → earned, revocable autonomy (override permanently on)
```

- **One conversation, one agent.** The user never picks specialists; the router
  shows its decision (who, why, scored how) on every message.
- **Nothing overstates itself.** No provider key ⇒ a plan in words, `executed:
  false`. No gate ⇒ risky work refused. No A2A bridge ⇒ nothing sent. Every
  response carries a provenance digest over its canonical form.
- **The bench is manageable.** Enable/disable any specialist; the router only
  fields the enabled bench, and the count on screen is the real count.
- **Cross-user Team-Evolve (18.1.0).** Joint runs are recorded with real
  outcomes; evolution proposals come only from verified history; adoption
  requires EVERY member's explicit approval (partial/duplicated/outsider
  approvals refuse); the evolved config leans on routing with a visible
  label; revocation is one click. `probe/teamEvolve` pins all of it.
- **Category-scoped autonomy (18.1.0).** Exams can be scoped to one category
  and a grant covers only that category; the gate consults the scoped grant;
  the override floor is unchanged.
- **Learning is local-first.** Accepts, rejects and corrections with reasons
  feed the briefings; cloud sync is opt-in and honestly non-operational until
  it ships with per-user encryption.
- **The 90% exam is real.** Questions come ONLY from the user's own recorded
  scenarios; the agent proposes AND explains each answer; ≥90% earns autonomy
  on safe-tier work; the monitor + override floor cannot be switched off, and
  revocation is one click, no exam required.
- **Providers, honestly.** Session keys live in memory only (and say so);
  durable keys go through env (`VH_OPENAI_API_KEY` / `VH_ANTHROPIC_API_KEY` /
  `VH_GEMINI_API_KEY`, base URLs overridable) or the keychain-backed Providers
  desk. SSRF guard on every base URL; keys are redacted from every error path.

## B. The proven engine behind the door

```
VH-19 door → askVH19 (src/vh19/generalist.ts)
Harbor/Helm → HarborProvider (src/app/harbor.tsx) → Vouch engine → bridge
           → REAL Mission Loop (src/mission/*) → receipts / gates / MCP / drill
```

- No view bypasses the bridge — every read and action goes through the real
  runtime; the shell probes enforce it.
- One engine, one cycle: COMPOSE → DISPATCH → COMMUNICATE → EXECUTE → GATE →
  ADAPT, one signed receipt per cycle (`vh-proof-receipt/2`).
- MCP capability router: 20 governed tools over stdio, risky calls non-blocking
  at the human gate, a receipt for every completed call.
- A2A v1.0.0: JWS-signed agent cards, cross-harbor delegation that EXECUTES
  through the real TeamExecutor and seals a receipt — or refuses in words.
  Mounted by `npm run host`; the receiver re-grades inbound risk itself.
- The drill: real missions on fresh real git repos, the repo's OWN test command
  as the verdict, vouched reports, reproducible attestation digests.

## C. Primary button handlers (all real)

| Button | Action |
|---|---|
| Send (VH-19) | `askVH19()` — the governed Generalist path |
| ✓ Accept / ✗ Reject (VH-19) | `recordDecision()` — the learning payload |
| Propose exam / Submit grades | `proposeExam()` / `gradeExam()` |
| Revoke (autonomy) | `revokeAutonomy()` — instant, no exam |
| Disable / Enable (bench) | `setSpecialistEnabled()` — the router honors it |
| Approve / Deny (gate modal) | resolves the paused run's gate promise |
| Connect / Disconnect (provider) | session-scoped `ProviderConfig`, memory only |
| Make it so (Helm) | `sendVouchMessage()` — governed cycle |
| Hold (streaming) | `stopVouch()` — interrupts, mints no receipt |
| Approve / Deny (gate cards) | `resolveVouchApproval(id, ok)` |
| Verify (Register) | `verifyVouchReceipt(id)` — SHA-256/HMAC/Ed25519 check |
| JSONL (Register) | downloads the real chained receipt via `receiptToJsonl()` |
| + Muster a hand (Ship) | `harborMusterHand()` — real `TeamSeat` on the active crew |
| Re-rate (Ship) | `harborRerate()` — recomputes assurance from persisted crews |
| Run the drill (Backtest) | `runDrill(scenarioId)` — guard/maths/impossible |
| Run full sweep (Sweep) | orphaned-key scan, live vs ghost classification |
| Save key / Clear key | `setProviderKey()` / `removeProviderKey()` — OS keychain |

## D. The four unique differentiators (all wired)

| # | Feature | Where in UI |
|---|---|---|
| 1 | **Signed Delegation Chain Ledger** | Harbor Master → Lineage |
| 2 | **Ghost Agent Sweep + Zero-Residual Receipt** | Harbor Master → Sweep |
| 3 | **Backtest Replay Bench + The Drill** | Harbor Master → Backtest |
| 4 | **Hindsight Ledger** (counterfactual regret) | Register right column |

Plus the moat: **offline-verifiable SHA-256 + HMAC + Ed25519 receipts**
(`node tools/verify-receipt.mjs`, zero deps, zero state).

## F. Signed collaboration, self-evolution & the Horizon UI (18.2.0; hardened in 19.0.0)

- **Horizon UI.** A new token sheet from the product owner's three palettes:
  near-black inks, platinum mist text, Echo Park sage-gray accent (#748785).
  SF-first system type, hairline cards, quiet motion. `probe/theme` pins the
  identity — the old patina green cannot silently return. New app icon: the
  minimal horizon glyph, regenerated across every desktop size.
- **Settings, a real page.** Gear in the sidebar: appearance facts, the
  memory/sync truth (local ledger on-device; cloud opt-in recorded but
  non-operational — the "force sync" refusal is the proof), the self-evolution
  floor as written, applied self-changes with reverts, live bench count.
- **Signed collaboration invitations.** Per-member ECDSA P-256 VH identities
  (TOFU, honestly labeled). User 1 mints a signed invite naming scope, risk
  ceiling, duration and capabilities; tampering refuses in words; approvals
  are signatures by the approver's own key and team-evolution adoption
  verifies every one of them (`probe/collabInvite`).
- **Bounded recursive self-evolution.** Tighten-only proposals minted from
  your own ledger; human-applied, receipt-linked, revert-exact; three
  rejections in a category suppress that category's proposals — it evolves
  its own proposing. The floor (receipt protocol, human gate, honesty, NO
  loosenings) is unrepresentable in the store (`probe/selfEvolve`).
- **The team self-evolves after connection.** Once a connected team clears the
  real bar, VH mints the evolution proposal automatically — visible, never
  silent, never twice; adoption still needs every member, now optionally
  signed.

## G. 19.1.0 — the team release

| # | Feature | Where |
|---|---|---|
| 1 | **The Shipyard** — one brief → per-domain work orders under each domain's **Captain**, run through the real pipeline; DONE only when every order executed, SETTLED seals a build digest | VH-19 door → The Shipyard |
| 2 | **Captains** (renamed AgentLeads) reporting on **every** routed member — the 19.0.0 review's aggregation fix | door log · `src/vh19/captains.ts` |
| 3 | **Autonomous token optimizer** — budget-fitted prompts (marked cuts, never silent), local usage ledger shown live | every provider call · `src/vh19/tokenOptim.ts` |
| 4 | **Live-data GuardRail** — research/analysis prompts hard-carry "always search for current and live data; date every claim; flag stale data" | `research.live-data` skill |

Probes: `shipyard` 22 · `captains` 37 (incl. the multi-member execution pins).

## H. 19.2.0 — the claims-execute release

| # | Feature | Where |
|---|---|---|
| 1 | **True multi-member execution** — N routed specialists = N provider calls, N attributed answers, N member receipt digests; the Captain reports on real per-member results; a failed member is `error`, never relabelled | `askVH19` · `probe/captains` |
| 2 | **Live-data GuardRail at runtime** — answered research/analysis replies are scanned; time-sensitive claims without dated live sources get the stale flag appended to the reply, sealed in the digest, stamped in the door | `src/vh19/liveData.ts` · `probe/liveData` 17 |
| 3 | **Honest naming** — the token optimizer is a **prompt-budget optimizer** working on token estimates (~4 chars/token, labelled everywhere as an estimate) | door strip · `tokenOptim.ts` |

## I. 19.3.0 — the fleet-becomes-real release

| # | Feature | Where |
|---|---|---|
| 1 | **Real specialist execution** — workspace-wired members run an act/observe loop over five gated tools (`fs.list`, `fs.read`, `fs.write`, `net.fetch`, `wiki.search`), category-bound ≤ 3; every attempted call receipted (`vh19-tool/1`), gate denials fed back verbatim, step limit labelled honestly | `src/vh19/tools.ts` · `src/vh19/agentLoop.ts` · `probe/agentTools` 47 |
| 2 | **Captain synthesis** — deterministic divergence pass (corroborated vs single-sourced claim atoms) + the Captain's OWN reasoning call into one coherent domain result; member sections kept as evidence; failed synthesis stated, never faked | `src/vh19/synthesis.ts` · `probe/synthesis` 29 |
| 3 | **GuardRail retrieval** — cited sources FETCHED and claim-checked inside; `verifiedBy: "retrieval"` vs `"disclosure"` sealed in the digest; unfetchable sources keep the flag, receipted | `verifyLiveEvidence` · `probe/liveData` 27 |
| 4 | **Receipts cover effects** — member digests commit to the member's tool receipts, so a run's evidence chain includes what it did, not just what it said | `askVH19` multi-member branch |

## E. Version integrity

Every manifest agrees on **19.7.12 "Keyholder" (UI)** (and on every release since
this mechanism shipped): `src/version.ts`,
`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`,
`src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `verify/BUILD-INFO.txt`,
`verify/MANIFEST.json` and the current-facing docs.
`probe/versionDrift.test.ts` enforces it; `probe/vh19Door.test.tsx` pins the
front door; `probe/vh19.test.ts` pins the engine's honesty contract.

## Build

```
npm install
npm run dev          # web on :5173 (opens on the VH-19 door)
npm run tauri dev    # native desktop
npm run host         # mounts the A2A harbor (byte-pin verified)
npm test             # runs all 125 probe suites
```
