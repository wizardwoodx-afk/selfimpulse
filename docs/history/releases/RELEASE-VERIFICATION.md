> ## ⛔ FROZEN — SUPERSEDED HISTORICAL RECORD
>
> **Do not cite this file as the current release record.** It is the
> accumulated verification history of the pre-rename releases, kept verbatim
> because deleting a record of what was actually measured is worse than keeping
> a confusing one.
>
> Everything below describes the retired product identity — **Velvet Hand**,
> engine **Vouch Harbor**, artifacts prefixed **`VH-`** — and the counts measured
> on the trees of its day. None of it describes the product as it ships today.
> The names below are *history*, not claims.
>
> | | current | this file |
> |---|---|---|
> | Product | **11Handle** | Velvet Hand |
> | Engine | **MJ 19.7.15** | Vouch Harbor 19.7.x |
> | Artifacts | `11H-` | `VH-` |
> | Release record | [`docs/releases/11H-1.0.0-RELEASE-VERIFICATION.md`](../releases/11H-1.0.0-RELEASE-VERIFICATION.md) | — |
> | Live counts | measured by `npm test` / `node verify/run.mjs` | frozen below |
>
> To re-measure the shipped tree, run the gates yourself; the runners print
> their own numbers and [`probe/docConsistency.test.ts`](../../../probe/docConsistency.test.ts)
> fails any *live* document whose stated count disagrees with the tree.

# Velvet Hand (engine: Vouch Harbor) — release verification record


Every number below was produced by running the named command in **this archive**,
on **node v22.23.2** (the CI runtime; the declared `engines` floor is
`>=22.12.0`), Linux x64. Re-run them yourself; do not take this file's word
for it. On a machine WITHOUT node_modules and without network,
`sh VERIFY.sh` runs the one truly zero-dependency gate: the bundled
offline pack (the runner reports its own suite count). The protocol selftest needs `cd protocol && npm install`.

## The rebrand record — Velvet Hand

The product ships under the name **Velvet Hand**; **Vouch Harbor** remains the
engine's name and is credited as such (Settings → About, README, the desktop
description). No number is shown to a user anywhere: `src/brand.ts` carries the
product name and tagline and no version; `src/version.ts` keeps the engine
build identity for manifests and receipts only.

What moved: the versioned record (CHANGELOG, this file, upgrade guides, design
notes, the old README/FEATURES) is archived under `docs/history/` as written.
What is new: a clean README, FEATURES and docs/VERIFICATION with no numbers.
What the probes now enforce: `docIdentity` requires **zero** product-version
mentions in current-facing docs (stricter than "all agree"); `vhClean`,
`navAlign`, `merge`, `legacyCompat`, `consolePolicy`, `versionDrift` pin the
Velvet Hand identity and that Settings → About shows product + engine names
and never a version. Storage keys, receipt formats (`vh-proof-receipt/2`) and
code identifiers are unchanged, so existing local data carries over.

**Tree.** Velvet Hand on engine 19.7.12 "Keyholder", node v22.12.0, Linux x64.

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | 0 errors |
| Dev runner | `node tools/run-all-probes.mjs` | **155 passed, 0 failed** (node v22.12.0) |
| Offline pack | `node verify/run.mjs` | **154 passed, 0 failed** |
| Engines | `npm run mcp:build && npm run host:build` | rebuilt; byte-identity probes green |
| Web build | `npm run build` | `dist/` — title "Velvet Hand — your agents, with receipts" |
| Render | SSR of Shell + Settings | sidebar brand = "Velvet Hand"; no version digits rendered |

## The 19.7.12 record — the redesign (UI)

The user-facing product was rebuilt end to end: one shell (`src/ui/Shell.tsx`)
with five doors — Steward · Work · Receipts · Memory · Settings — one
stylesheet (`src/ui/vh.css`: charcoal/bone, champagne accent, Instrument
Serif + Geist, no blue, no animation gimmicks), and one store
(`src/ui/store.ts`) that is the single production caller of the engine.
The retired trees (`src/views`, `src/pages`, `src/panels/*` except
ErrorBoundary/Toast, `src/app/{Helm,Sidebar,harbor,…}`, `src/styles`) are
DELETED — including the old VH-19 door's plaintext provider loader, which
is the reviewer's item (3). The crew is internal: no Crew screen, agents
render as AGENT nn.

What the review of the first 19.7.12 cut asked for, and what shipped:

| Review finding | Fix shipped | Proof it is real |
|---|---|---|
| Release identity was split (19.7.9 / 19.7.12 in different files) | `tools/bump-version.mjs` drives every identity site from `src/version.ts`; README, BUILD-INFO, this file, docs, engines and the offline MANIFEST all say 19.7.12 | probe/versionDrift 42/42; `grep -rn "19\.7\.9" --include=*.md` finds only historical records |
| Gate had run on node 20 | The whole gate re-ran on **node v22.12.0** (engines rebuilt there too) | table below |
| Retired `Vh19.tsx` still carried a plaintext provider loader | File deleted with its tree; `boot()` purges any legacy plaintext key on first run and keeps it in memory only; no `localStorage.setItem(...provider...)` exists under `src/ui` | probe/vh19Door §2, probe/vhClean, probe/shellRender |
| Probes/offline pack still pinned the old UI | probe/palette and probe/v10Page retired; **probe/shellRender** added (SSR-renders the Shell and every door, 22 checks); vh19Door rewritten engine-first; 14 probes (theme, meridian, preflight, face, fedWired, graph3d, initiative, guardrailAlign, differentiatorAlign, knowledgeSkills, meshRuntime, productionStack, securityReview, teammates, scoreSourceOfTruth, navAlign) repointed from deleted files to the shell or the seam they wrapped — never loosened to "skip" | 155/155 dev runner; 154/154 offline pack |

Two regressions the render/probe pass FOUND in the new shell and fixed
(they would have shipped otherwise):

- **Work showed "No work yet" while a gate was pending before any reply**
  — empty-state guard now `!lastResp && !busy && !gate`.
- **The initiative heartbeat and RSI evidence intake had been left behind
  in the deleted console.** Both now live in the store: `wakeNow()` runs
  `evaluateWake → applyWake → executeWakeActs(engineExecutor(...))` with the
  SAME `runDeps()` a typed message takes; the heartbeat is armed above
  level 0 and re-armed on every level change (Settings → Autonomy, "Run a
  heartbeat now"); gate denials, failures and unverified live-data claims
  become RSI curriculum with the canary rollback. probe/initiative 36/36
  and probe/vh19Door 43/43 pin the store as the caller.
- The federation plane (standing grant · crossing · common ledger ·
  regulated bench) is back as Settings → Federation on the real
  `vh19/federation/live` seam (probe/fedWired 18/18), and the guardrail
  manifest renders in Settings → About (probe/guardrailAlign 15/15).

Also: `3d-force-graph` is loaded lazily inside the mount effect so the
shell is SSR/node-safe (probe/graph3d pins it); the render probe uses
`react-dom/server` and needs no browser.

**Tree.** `19.7.12 "Keyholder" (UI)`, working tree at build time, node v22.12.0, Linux x64.

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | 0 errors |
| Dev runner | `node tools/run-all-probes.mjs` | **155 passed, 0 failed** (node v22.12.0) |
| Offline pack | `node verify/run.mjs` | **154 passed, 0 failed** (node v22.12.0); MANIFEST 19.7.12, suiteCount 154 |
| Engines | `npm run mcp:build && npm run host:build` | rebuilt at 19.7.12; byte-identity probes green |
| Web build | `npm run build` | `dist/` produced (vite) |
| Identity | `probe/versionDrift` | 42/42 — package.json · src/version.ts · README · BUILD-INFO · docs · MANIFEST agree on 19.7.12 |

## The 19.7.10.1 record — the boundary, stated precisely

The seventh external review scored the previous patch the strongest RSIRALS
build so far and named two fixes. Both ship here; every number below was
produced by running the named command in this archive.

1. **The terminology is now exact.** The reviewer was right: calling the
   `h7`–`h10` tier "structural" and saying it "reads the shape of the change"
   overstated a regex over submitted text as code analysis. `h7` needs BOTH a
   URL-shaped token and network language, so a change expressed in code that
   names neither can still introduce network access and pass. The tier is
   renamed **CAPABILITY-PATTERN**, its five emitted findings now read
   `capability pattern:` rather than `structural:`, and the accurate boundary
   is written into the shipped source:

   > a ten-check, digest-pinned **textual / capability-pattern screen**, plus
   > the human approval that follows it — **NOT** structural semantic
   > verification of the proposed code.

   `probe/rsiralsV6` grew 61 → **64** to pin that wording, so the deck cannot
   drift ahead of the code again.
2. **This document is promoted.** It opened as 19.7.9 [Keyholder] while every
   manifest named the new release — the data was current, the record was not.
3. **A four-part identity broke the freshly repaired scanner.** Moving to
   `19.7.10.1` exposed a second bug in `probe/docIdentity`: with one optional
   numeric group the pattern backtracked and read a truncated version out of
   the four-part identity. It now accepts up to three groups after the major
   and refuses both a trailing `.digit` and a trailing digit. Re-running it
   caught four identity lines the bump tool does not reach — all fixed.

**Gates (this archive, node v22.23.2 — the declared floor — Linux x64):**

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **0 errors** |
| Unit | `npm run unit` | **20 passed, 0 failed** |
| Probe suites | `npm test` | **156 passed, 0 failed** |
| RSIRALS v6 | `node tools/run-one-probe.mjs rsiralsV6` | **64 passed, 0 failed** |
| Doc identity | `node tools/run-one-probe.mjs docIdentity` | **10 passed, 0 failed** |
| Offline pack (zero-dep) | `node verify/run.mjs` | **155 passed, 0 failed** |
| Zero-dep entry point | `sh VERIFY.sh` | **155 passed, 0 failed** |
| Web build | `npx vite build` | **clean, 4.17 s** |

**Per-suite counts re-run under node v22.23.2** (independently reproduced by the
seventh external review at the same numbers):

| Suite | Command | Result |
|---|---|---|
| RSIRALS v6 | `node tools/run-one-probe.mjs rsiralsV6` | **64/64** |
| Vault security | `… vaultSecurity` | **27/27** |
| MCP runtime | `… mcpRuntime` | **22/22** |
| Groups | `… groups` | **37/37** |
| Crew | `… crew` | **35/35** |
| Federation wiring | `… fedWired` | **18/18** |
| Agentic MoE v2 | `… moeV2` | **24/24** |
| 3D memory graph | `… graph3d` | **17/17** |
| Version drift | `… versionDrift` | **42/42** |
| Doc identity | `… docIdentity` | **10/10** |

**The runtime-record mismatch the seventh review found, and why it is closed.**
19.7.10.1 first shipped declaring `engines.node >=22.12.0` while this record
named node v20.20.2 — the release certified itself on a runtime below its own
declared minimum, which for a product whose pitch is independently verifiable
evidence is exactly the wrong kind of ambiguity. The declared floor is the
correct one (a dependency requires it, CI runs 22.x, and Node 20 reached EOL
2026-04-30), so the runtime moved, not the claim: the complete gate set above
was re-executed end to end under **node v22.23.2** with a clean
`node_modules` — zero `EBADENGINE` warnings, the floor and the runtime now
agree. Node 20.20.2 remains a secondary supported runtime and passed the same
gates at the previous revision; the offline runner prints its own runtime in
its summary line, so this claim is checkable rather than asserted.

**Trust root as shipped** (`src/vh19/verifierTrust.ts`, re-pinned because the
verifier's own source text changed — rotation is a release event):

- `verifierProgramDigest` `581ddfa780c179f3a2ef89b2a5c7833c32609c2900d3c2e8a37808112b2ab377`
- `expectedBatteryDigest` `1c5e31fac9b7fb3abbda7a76702d271527084c048305561c695c188924c4040c`
- protocol `vh-verifier/3`, algorithm `ECDSA_p256_sha256`

**Artifact hygiene re-checked here:** no `.key`/`.pem` anywhere in the tree,
`verifier/` contains only `vh-verifier.mjs`, and no embedded EC key material.
The program digest recomputes byte-identical to the pin from the shipped
source.

## The 19.7.10 record — the evasion, closed

The sixth external review found the P1: the canary battery was **six regular
expressions over the candidate's own text**, source public in the repository,
so the promotion gate reduced to keyword filtering. The reviewer proved it — a
proposal that exfiltrated the evidence store, set the promotion threshold to
always-accept and deleted the rollback path, **reworded to dodge every
keyword**, passed 6/6 and drew a valid ECDSA signature. All 55 checks then in
`probe/rsiralsV6` asserted that the filters FIRE; not one asserted they could
not be routed around.

1. **The capability-pattern tier.** The battery grew **6 → 10**. `h1`–`h6`
   stay lexical; `h7`–`h10` screen for the capability being introduced —
   network egress endpoint · weakened control threshold or removed
   retention/rollback · evidence-store mutation · authority widening. The
   19.7.9 evasion is now refused by three of them and is pinned as a
   regression; the legitimate tighten still clears all ten, no false positive.
2. **Honest words in the ledger.** `governChange` no longer writes "machine
   gates passed" as though a semantic review happened; it records that the
   battery is a text screen and that promotion is a human decision.
3. **A dormant drift gate, repaired.** `probe/docIdentity`'s version regex was
   hardcoded to major `16`, so on 19.x it matched no string in any document,
   reported green, and scanned nothing. Repaired, derived from the release
   identity, with anti-vacuity assertions that make a regex matching nothing a
   hard failure.

## The 19.7.9 record — the keyholder

The fifth review found the P0: 19.7.8's ZIP carried the verifier's PRIVATE
key (a `git add -A` casualty), and the reviewer forged an "all canaries
passed" verdict with it that the pinned public key accepted. The lesson is
structural: an artifact cannot carry a secret meaningfully. Shipped here:

1. **No key ships.** The keypair is provisioned at RUNTIME (private key at
   `~/.vouchharbor/verifier.key`, mode 0600, outside the app tree); the
   leaked key is removed from the repo and `.gitignore` refuses
   `verifier/*.key`. The trust root pins DIGESTS ONLY — no key material.
2. **Registration, countersigned by the owner.** The provisioned public
   key is signed by the OWNER key (the mandate/crossing authority) into
   the owner trust store; verdicts verify under the REGISTERED key;
   re-provisioning requires the owner again.
3. **The program is pinned.** The verifier digests its own source at
   runtime and binds `programDigest` into every verdict signature
   (`vh-verifier/3`); the frozen trust root pins the expected value beside
   the battery digest. A modified verifier is refused on sight.
4. **Honest words.** The battery is EXTERNALLY EXECUTED and DIGEST-PINNED
   — its source ships in `verifier/vh-verifier.mjs`; pinning prevents
   swapping, not secrecy. "Hidden/secret" wording is scrubbed everywhere,
   including the ledger event text.

probe/rsiralsV6: 53 checks, including artifact hygiene (no key file, no
key material in the trust root, program digest byte-pinned), the full
provisioning flow with a tampered-registration refusal, foreign-key
forgery refused under the registered key, battery swap, replay, tampered
signature, and the live production apply gated end to end.

**Tree.** `19.7.9 "Keyholder"`, working tree at build time, node v20.20.2, Linux x64.

## The 19.7.8 record — the anchor

The fifth review accepted the live wiring and named the remaining gap
precisely: the verifier's "signature" was a plain SHA-256 (a recomputable
checksum, not authentication), the battery was not pinned from the caller,
and the nonces were clock-and-random. All three shipped: ECDSA P-256
signatures (the authority-mandate curve) verified against the public key
pinned in the frozen trust root; the battery digest — covering every
check's SOURCE — pinned beside it and enforced independently; CSPRNG
nonces. The review's one UX note (the promotion desk lived only in the
retired Vh19 view) shipped too: the Evolution desk is now a panel on the
active NextConsole. probe/rsiralsV6: 42 checks, including a literal
foreign-key forgery attempt refused.

**Tree.** `19.7.8 "Trustroot"`, working tree at build time, node v20.20.2, Linux x64.

## The 19.7.7 record — the live verifier

The fourth review confirmed 19.7.6's fixes and named two caveats, both
shipped here: (1) RSIRALS v6 was verified but not wired into the live
promotion path — now `applySelfChangeGuarded()` gates EVERY self-evolution
apply through the full v6 stack, with the drift budget measuring the
mutation against a comparable rendering of the current state; (2) the
canary checks were readable in shipped source — the battery now lives in
`verifier/vh-verifier.mjs`, a separate zero-dependency process outside the
agent's evolvable surface (constitution-protected by name), producing
nonce-bound, SHA-256-signed verdicts; replays and tampering are refused,
and where no process can run the gate honestly reports `unavailable` and
keeps the human door as the only promotion path. probe/rsiralsV6 grew to
38 checks, including a real verifier spawn and the live production apply.

**Tree.** `19.7.7 "Verifier"`, working tree at build time, node v20.20.2, Linux x64.

## The 19.7.6 record — the strengthened verifier

The third review of the Groups train confirmed the two-phase fix held
(crew 32/32) and named one production gap: the Groups panel never passed
the crossing seam, so crossing items always failed with "no crossing seam"
in the live product while the probe (which supplies the seam) stayed green.
Fixed exactly as prescribed: the Run Group path now wires
`cross: productionCross("vh-owner")` — the live signed federation crossing
— and the panel states the honest scope (governed local implementation of
the cross-owner group protocol; networked two-instance signing is the next
federation milestone). The same release ships RSIRALS v6 (the strengthened
verifier: constitution · measured drift budget · digest-pinned canaries · staged
fail-closed promotion · tamper-evident ledger · one gate + rollback —
plane T untouched at v5) and the Office rendering of the crew.
probe/rsiralsV6 pins it (31 checks).

**Tree.** `19.7.6 "Office"`, working tree at build time, node v20.20.2, Linux x64.

## The 19.7.5 record — the group release

Ships the two-owner group plane (charter → acceptance → governed tasks over
local and crossing items) WITH the 19.7.4 review fix in the same line: the
muster and the run are two phases in every workspace (crew and group), an
all-gated run returns awaiting-gate instead of failing, and gate decisions
are decidable from every live session state. probe/groups (37 checks) pins
the charter law, the limits, the modes over both item kinds, the crossing
cap, the revival sequence, and the no-seam honesty.

**Tree.** `19.7.5 "Groups"`, working tree at build time, node v20.20.2, Linux x64.

## The 19.7.4 record — the governed crew

The third external review verified the new suites independently (crew 26/26,
moeV2 24/24, modes 16/16, lotus 21/21, harnesses 270/270, harnessPolicy 94/94,
productionStack 7/7, realExecution 14/14, vhClean 8/8, versionDrift 42/42) and
named one release-blocking UI integration bug plus documentation drift. All
shipped in the next build:

| Review finding | Fix shipped | Proof it is real |
|---|---|---|
| "Manual-mode Crew creation gates everyone, then immediately stops the run" — the console mustered AND ran in one click; the all-gated run was marked failed; approve buttons then did nothing (the resolution logic only revived an awaiting-gate session, and a gate decision after a run was not accepted at all) | TWO fixes, one contract: (1) THE UI is now explicitly two-phase — Muster selects and gates the crew, the owner approves/refuses, and only "Run the crew" executes (the run never starts itself); (2) THE ENGINE is hardened underneath: a gate decision is decidable from awaiting-gate, running, AND a failed-untouched session (cooled-down refuses — the breaker owns it), and the completion law no longer calls an all-gated no-op run a failure — it returns the session to awaiting-gate with the line "nothing executed — N member(s) still await your approval"; an all-REFUSED crew is recorded as done-with-nothing, worded as the owner's decision | probe/crew pins the reviewer's exact UI sequence end-to-end: muster → premature run executes nothing (status awaiting-gate, feed line present) → approvals revive to running → the revived run answers the whole crew; plus the all-refused done-with-nothing case. The workspace panel carries the two buttons and the boundary hint |
| README still titled its product-state heading 19.7.2.2; this file's title was stale | Both headings now state the shipped release; historical sections keep their original titles untouched | probe/versionDrift pins the current-release headings; the drift gate widens as the checklists grow |

**Tree.** `19.7.4 "Crew"`, working tree at build time, node v20.20.2, Linux x64.

## The 19.7.3 record — the integration-hardening release

The second external review (of 19.7.2.2) scored the build ~9.6 and named
one implementation bug plus two honesty refinements. All three shipped:

| Review finding | Fix shipped | Proof it is real |
|---|---|---|
| "The production executor calls askVH19() WITHOUT the normal deps — the heartbeat only ever plans" | The executor moved OUT of the console into the shared `initiativeBridge.ts`: `engineExecutor()` carries the SAME dep set a typed chat message takes (provider · human gate `gateFn` · handoff recorder · evidenceFetch · userId) into the real engine; the console builds it, the probe drives it — one factory, no copy-paste, nothing left to half-wire | probe/initiative **35**, including the TRUE INTEGRATION TEST: a scripted provider, the real askVH19 → routing → Agentic MoE → member agent loops, **4 real wire calls** observed, the engine's own accounting ("2 of 2 routed members executed · member receipt …") landing in the act receipt; plus the honest no-provider case (planned-only, stated in the receipt) |
| "'Runtime-enforced BEW' should read as phase/provenance discipline" | Wording locked everywhere: the machine enforces the workflow and its evidence trail; semantic correctness is judged by the specialist's own VERIFY against the acceptance check declared at INTAKE | README + FEATURES carry the exact sentence; BEW_BLOCK's enforcement line already said "receipts your evidence per phase" |
| README said "keys in memory only", contradicting the vault | The comparison line and the provider-seam line now say: session-only by default, or encrypted at rest in the local owner vault | README lines pinned by the drift gates |

**Tree.** `19.7.3 "Agent"`, working tree at build time, node v20.20.2, Linux x64.

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | 0 errors |
| Unit | `npm run unit` | **20 passed, 0 failed** |
| Provider probes | `npm test` (150 suites) | **150 passed, 0 failed** |
| Offline gate | `node verify/run.mjs` (pack rebuilt to 149) | **149 passed, 0 failed** |
| Engines | `npm run mcp:build && npm run host:build` | rebuilt at 19.7.3; byte-identity probes green |
| Census | `catalogStats()` | **1,850 established** (460 seed + 160 broader + 140 reach + 390 matured + 350 finance + 350 silicon) + 640 registered = **2,490 catalogued** |

Short execution window? `node verify/run.mjs --shard 1/4` … `--shard 4/4`
(merge the summaries), or `--time-budget 60`.

## The 19.7.2.2 record — the review-fold release

The external review of 19.7.2.1 scored the build 9.5–9.7 and named three
fixes before freezing. All three shipped; each carries its own proof:

| Review finding | Fix shipped | Proof it is real |
|---|---|---|
| "Initiative is a wake planner, not an executor — no bridge, no production callers" | The EXECUTION BRIDGE: the heartbeat runs safe acts through the real engine (askVH19 → routing → MoE → member loops → gated tools → receipts); failures feed the circuit breaker, partials reschedule capped verify check-backs, proposals never self-execute, gate-blocked user runs leave a capped check-back automatically | `executeWakeActs` / `reportSuccess` in `initiative.ts`; production callers for `scheduleFollowUp` + `reportFailure` + `reportSuccess` in NextConsole; probe/initiative **30** (the bridge section pins each verdict path) |
| "BEW is prompt-enforced, not runtime-enforced" | The member agent loop carries `BewRun` — a runtime six-phase machine: the trail records as the loop executes, a run that cannot prove VERIFY cannot claim done (truncated ⇒ machine-downgraded partial), recoveries cap at one, every run ships a BEW receipt with violations | `BewRun` in `bew.ts`, wired in `agentLoop.ts` (every MemberRun requires a `bew` receipt — type-enforced); probe/bew **24** |
| "Say Agentic MoE / sparse specialist routing, and say what it spans" | The line itself reads "Agentic MoE (sparse specialist routing over the whole fleet)"; docs state agent-level routing, not a transformer MoE; the pool is probe-pinned to span ALL 1,850 established specialists, every category — not only the new 700 | probe/moe **17** (scope pins: category-span + no provenance filter) |

**Tree.** `19.7.2.2 "Agent"`, working tree at build time, node v20.20.2, Linux x64.

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | 0 errors |
| Unit | `npm run unit` | **20 passed, 0 failed** |
| Provider probes | `npm test` (150 suites) | **150 passed, 0 failed** |
| Offline gate | `node verify/run.mjs` (pack rebuilt to 149) | **149 passed, 0 failed** |
| Engines | `npm run mcp:build && npm run host:build` | rebuilt at 19.7.2.2; byte-identity probes green |
| Census | `catalogStats()` | **1,850 established** (460 seed + 160 broader + 140 reach + 390 matured + 350 finance + 350 silicon) + 640 registered = **2,490 catalogued** |

Short execution window? The offline gate shards deterministically:
`node verify/run.mjs --shard 1/4` … `--shard 4/4` (same tree ⇒ same
shards; merge the four summaries for the full verdict), or
`node verify/run.mjs --time-budget 60`.

## The 19.7.2.1 record — the [Agent] release (superseded in-tree by 19.7.2.2)

**Tree.** `19.7.2.1 "Agent"`, working tree at build time, node v20.20.2, Linux x64.

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | 0 errors |
| Unit | `npm run unit` | **20 passed, 0 failed** |
| Provider probes | `npm test` (150 suites) | **150 passed, 0 failed** |
| Offline gate | `node verify/run.mjs` (pack rebuilt to 149) | **149 passed, 0 failed** |
| New suites | `probe/bew · moe · initiative · graph3d · financeBench · siliconBench` | **24 · 17 · 30 · 17 · 20 · 17** |
| Engines | `npm run mcp:build && npm run host:build` | rebuilt at 19.7.2.1; byte-identity probes green |
| Census | `catalogStats()` | **1,850 established** (460 seed + 160 broader + 140 reach + 390 matured + 350 finance + 350 silicon) + 640 registered = **2,490 catalogued** |

**What this release wired.** BEW enforced TWICE — in every composed
prompt AND at runtime (the member loop's `BewRun` phase machine: recorded
trail, verify-or-not-done, capped recoveries, per-run BEW receipts with
violations) — the Agentic MoE (sparse specialist routing over the whole
1,850 fleet, marginal-coverage pruning) on both routing paths, the
initiative heartbeat that EXECUTES safe acts through the real engine
(askVH19 → member loops → gated tools → receipts; failures feed the
breaker; partials reschedule capped check-backs; proposals never
self-execute; production callers for scheduleFollowUp/reportFailure/
reportSuccess) with the Settings → Autonomy card, the zero-dependency 3D
memory graph with the glossy-black/silver finish, the +700
finance/silicon benches with domain playbooks, and the platinum/graphite
noir identity pass.

**Short execution window?** The offline gate shards deterministically:
`node verify/run.mjs --shard 1/4` … `--shard 4/4` (same tree ⇒ same
shards; merge the four summaries for the full verdict), or
`node verify/run.mjs --time-budget 60` for a bounded run.

## The 19.7.2 record — the maturity release

**Tree.** `19.7.2 "Noir"`, working tree at build time, node v20.20.2, Linux x64.

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | 0 errors |
| Unit | `npm run unit` | **20 passed, 0 failed** |
| Provider probes | `npm test` (144 suites) | **144 passed, 0 failed** |
| Offline gate | `node verify/run.mjs` (pack rebuilt to 143) | **143 passed, 0 failed** |
| New suite | `probe/consolePolicy` | **16** |
| Engines | `npm run mcp:build && npm run host:build` | rebuilt at 19.7.2; byte-identity probes green |
| Visual pass | headless Chromium, dev server, both themes | noir + cream render clean; mission strip intact; Settings plane verified; **0 page errors** |

**What this release wired.** The operator doctrine appended to every
specialist prompt (`skills.ts` → `buildSpecialistPrompt`), the maturity
budget (`MAX_AGENT_STEPS` 3 → 5), the Steward rename on every rendered
surface, the removal of all version chrome and demo props, the flat noir +
cream-gray finishes with pre-paint theme boot, the minimal Settings plane
(Appearance · Security · Memory · Data) with vault-before-memory guidance,
and exact provider memory semantics (session-only never seals; on-this-
machine requires the unlocked vault and seals).

## The 19.7.1 record — the review-hardening patch

**Tree.** `19.7.1 "Recall"`, working tree at build time, node v20.20.2, Linux x64.

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | 0 errors |
| Unit | `npm run unit` | **20 passed, 0 failed** |
| Provider probes | `npm test` (143 suites) | **143 passed, 0 failed** |
| Offline gate | `node verify/run.mjs` (pack rebuilt) | **142 passed, 0 failed** |
| New suites | `probe/vaultSecurity` · `probe/mcpRuntime` | **27** · **22** |
| Engines | `npm run mcp:build && npm run host:build` | rebuilt at 19.7.1; byte-identity probes green |

**What this patch wired.** The owner vault (AES-256-GCM + PBKDF2-310k, no
stored passphrase, legacy-plaintext purge), memory encryption at rest with
the ON/OFF switch and honest mode naming, the MCP runtime (enabled market
servers → `mcp.call` → gate → receipts; real JSON-RPC for HTTP, host-bridge
or refusal for stdio), and the UI review's hierarchy notes (mission strip,
infrastructure grouping, cache caveat in the tooltip, accent restraint).

## The 19.7.0 record — the Recall release: memory graphs, the token pipeline, the MCP market

**Tree.** `19.7.0 "Recall"`, working tree at build time. Every number below was
produced by running the named command in this tree on node v20.20.2, Linux x64.

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | 0 errors |
| Unit | `npm run unit` | **20 passed, 0 failed** |
| Provider probes | `npm test` (141 suites) | **141 passed, 0 failed** |
| Offline gate | rebuilt then run: `node tools/build-offline-verify.mjs && node verify/run.mjs` | **140 passed, 0 failed** |
| New suites | `probe/memoryGraph` · `probe/mcpMarket` · `probe/tokenPipeline` · `probe/autoRepairReplay` | **26** · **21** · **20** · **12** |
| Version drift | `probe/versionDrift` (via `npm test`) | green — 19.7.0 "Recall" on all thirteen surfaces |
| Preview parity | headless Chromium, `sandbox="allow-scripts"` opaque-origin frame vs direct load | both mount `html.nx`, **0 page errors**, chat + memory + market verified interactively |

**What this release wired.**

- **The preview fix at the root**: the `vh-preview-cors` dev plugin (permissive
  CORS + preflights, `server.cors: false`), a cannot-lie sandboxed-frame
  detector in `src/main.tsx` (opaque frames cannot reach `window.top`), the
  strict CSP skipped only inside such frames (stated in the console), and the
  splash light-canvas retired on mount. Reproduced before/after headlessly.
- **The memory graph** (`src/vh19/memoryGraph.ts`, `probe/memoryGraph` 26):
  deterministic keyword extraction, co-occurrence edges, dated sessions,
  keyword + date recall, MARKED rehydration, idempotent upsert, storage-less
  mirror. The console's rail lists conversations; the Memory Graphs plane
  renders the graph (SVG) and the sessions with Continue/forget.
- **The token pipeline** (`src/vh19/tokenOptim.ts` at the `providers.complete()`
  choke point, `probe/tokenPipeline` 20): normalize → dedup (marked) →
  cache-alignment measured → budget guard; per-run `optimDelta` rendered as the
  `⚡ est −N tok (P%)` chip on every reply.
- **The MCP market** (`src/vh19/mcpMarket.ts`, `probe/mcpMarket` 21): 12
  curated servers + user registry (stdio/HTTP), zod-validated, SSRF-guarded,
  env names only, standard `mcpServers` export.
- **The A2A replay guard** (`federation/live.ts` + `"replay"` refusal,
  `probe/autoRepairReplay`): duplicate crossing submissions inside a 60s window
  refused before signing, with the full attestation contract on the refusal.
- **Auto-repair** (`agentLoop.ts`, `probe/autoRepairReplay`): transient member
  failures get ONE situation-changing retry, no human pause, labelled;
  non-transient failures are never blind-retried.

## The 19.6.6 record — the console release, with the federation plane ON the live path

**Tree.** `19.6.6 "Federation"`, working tree at build time, then the packaged archive
extracted alone into an empty directory for the dependency-free checks.

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | 0 errors |
| Build | `npm run build` | ok (tsc + vite) |
| Provider probes | `npm test` (137 suites) | **137 passed, 0 failed** |
| Offline gate | `node verify/run.mjs` | **136 passed, 0 failed** |
| Zero-install wrapper | `sh VERIFY.sh` | the offline pack, zero npm deps |
| Fast path | `node tools/quick-verify.mjs` | **11/11** |
| New suites | `probe/face` · `probe/fedWired` | **10 passed** · **18 passed** |
| Rewired bundles | `mcpRouter` · `a2aRuntime` | **22 passed** · **48 passed** (rebuilt shipped engines, sha-pinned) |

**What this release wired.**

19.6.4 shipped standing authority, the common ledger and regulated activation as
verified subsystems. 19.6.6 puts them on the crossing the console actually runs:

- **Standing authority on the live crossing** (`src/vh19/federation/live.ts`,
  consumed by `bridge.ts`): the console issues a grant both owners sign once;
  each crossing under it keeps its own envelope and nonces and mints one
  acknowledgement per side, bound to that envelope digest. Out-of-scope, spent,
  lapsed and revoked grants ESCALATE to a per-crossing human decision
  (`reason: "escalated-to-human"`), and a grant never overrides earned pair
  standing — it adds one co-signed trust unit to the mesh's own ladder.
- **The common ledger rides every outcome**: crossed AND refused rows land in
  both stores with both receipts; the roots over each store plus that row are
  compared on the receipt itself (`compareRoots` inside `finish()`).
- **Regulated activation on the routing path**: the registered regulated bench
  (230 specialists) stays unrouted until a signed, complete, current activation
  exists; the refusal names every gap — a name is not an authorisation.
- **The console**: one dark operations console IS the app; the Generalist keeps
  one deterministic face derived from the name its owner gives it; every
  specialist carries a deterministic mark. The multi-dock shell is retired.
  The console also carries provider onboarding (OpenAI-compatible, Anthropic,
  Gemini) so a first-time user can connect a model without any legacy surface.

**Pins.** `probe/fedWired` (18) exercises the live seam end to end — grant
issuance and two-owner verification, a covered crossing under standing
authority, jointly-held rows compounding the pair's standing up the mesh
ladder, out-of-scope escalation spending nothing, the tier floor holding
against the grant, exhaustion and revocation escalating to humans, the
no-grant per-crossing refusal, regulated routing gated unsigned/signed/tampered,
and the routing/console source wiring itself — including that the federation
owner key resolves through the hardened authority seam (native keychain >
passphrase-encrypted > session-only) and never through raw storage.
`probe/face` (10) pins the face system and the console door.

## The 19.6.4 record — autonomy with the evidence kept, and a provenance file that cannot drift

**Tree.** `19.6.4 "Federation"`, working tree at build time, then the packaged archive
extracted alone into an empty directory for the dependency-free checks.

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | 0 errors |
| Provider probes | `npm test` (135 suites) | **135 passed, 0 failed** |
| Offline gate | `node verify/run.mjs` | **134 passed, 0 failed** — 78.7s |
| Offline gate, sharded | `--shard 1/4 … 4/4` then `verify/collect.mjs` | **134 passed, 0 failed, 0 not covered** |
| Zero-install wrapper | `sh VERIFY.sh` | **134 passed, 0 failed** — 79.3s |
| Fast path | `node tools/quick-verify.mjs` | **11/11** |
| Batch drift | `node tools/generate-batch.mjs --all --check` | three benches OK (200/210/230) |
| Federation suites | `fedCrossing` · `fedFleet` | **13 passed** (was 11) · **9 passed** (was 7) |

**What the two new federation sections pin.**

`fedCrossing` §10 — *approve once, then autonomous*: a grant is issued and verified
under both owners' keys; three crossings run with no further human decision; the rate
bound refuses a burst inside the window (`window-exceeded`); the budget refuses once
spent (`grant-exhausted`); a capability outside the grant **escalates** rather than
proceeding; one side's revocation is honoured with its reason; an expired grant stops
being authority; and a wildcard capability, an unbounded budget or a one-sided grant
is refused at issue time. It also pins that a grant signed by one key and presented as
two fails verification (`bad-signature`, naming the responder side).

`fedCrossing` §11 — *the common view*: two stores holding the same rows derive the
same root; a store that recorded a different decision diverges with the crossing named
(`same crossing, different record`); a store missing a row diverges with its own,
different sentence (`holds no record of crossing …`); the shared view marks
single-holder rows and flags differing ones **unmerged**; and the auditor's mirror
verifies a match and reports a later change in words.

`fedFleet` §4c — *activation is owner-key bound*: a signed activation verifies under
the owner key; an **unsigned** one is refused by name ("a name is not an
authorisation"); a tampered jurisdiction or a swapped domain list breaks the
signature; a foreign key does not verify it; completeness is judged **before** signing;
and the record's `attests`/`notAttested` pair never claims the jurisdiction approved
the use.

`fedFleet` §2b — *the provenance file states the same census the code does*: this is
the pin that would have caught the reviewer's find. `verify/BUILD-INFO.txt` must state
the fleet on a `fleet:` line carrying the code's own numbers, and the stale
"1,560 census" phrasing fails the gate outright.

## The 19.6.3 record — the full gate, reproducible inside a short window

**Tree.** `19.6.3 "Federation"`, working tree at build time, and the packaged
archive extracted alone into an empty directory.

| Check | Command | Result |
|---|---|---|
| Types | `tsc --noEmit` | 0 errors |
| Provider probes | `npm test` (135 suites) | **135 passed, 0 failed** |
| Offline gate | `node verify/run.mjs` | **134 passed, 0 failed** |
| Offline gate, sharded | `--shard 1/4 … 4/4`, then `verify/collect.mjs` | **134 passed, 0 failed, 0 not covered** |
| Fast path | `node tools/quick-verify.mjs` | **11/11** (~1.3s, zero install) |
| **Offline gate, dependency-free** | `node verify/run.mjs` in the extracted archive (no `node_modules`) | **134 passed, 0 failed, 0 skipped — 80.5s** |
| **Zero-install wrapper** | `sh VERIFY.sh` in the extracted archive | **134 passed, 0 failed — 82.0s** |
| Batch drift, no esbuild | `node tools/generate-batch.mjs --all --check --verbose` | three benches OK from `verify/specs/`, sha256 matching MANIFEST |
| Command-line tools, no esbuild | `node tools/drill-benchmark.mjs` · `node tools/external-model-validation.mjs` | both run from `verify/specs/`, and say which path they took |
| MCP host, no `node_modules` | `node tools/mcp.mjs` with an `initialize` frame | answers the handshake (the engine carries zod) |
| Pack integrity | `unzip -t` both archives | no errors |

**The requirement this record answers.** A reviewer could not reproduce the
134/134 offline gate: the archive ships no `node_modules`, and ~86 seconds on
two cores did not fit their window, so the claim stayed *archive-reported*. It is
now *independently reproducible* inside a normal window, in four pieces:

```
$ node verify/run.mjs --shard 1/4 --time-budget 90
OFFLINE VERIFY SUMMARY: 34 passed, 0 failed. [shard 1/4 of 134]
$ node verify/run.mjs --shard 2/4 --time-budget 90
OFFLINE VERIFY SUMMARY: 34 passed, 0 failed. [shard 2/4 of 134]
$ node verify/run.mjs --shard 3/4 --time-budget 90
OFFLINE VERIFY SUMMARY: 33 passed, 0 failed. [shard 3/4 of 134]
$ node verify/run.mjs --shard 4/4 --time-budget 90
OFFLINE VERIFY SUMMARY: 33 passed, 0 failed. [shard 4/4 of 134]

$ node verify/collect.mjs
collect: 96.1s of runner time across the records
MERGED VERIFY SUMMARY: 134 passed, 0 failed, 0 not covered. (4 record(s))
verified: all 134 bundles covered, 0 failed.
```

**What a partial run looks like**, so nobody mistakes it for a pass — one shard
of four, merged:

```
MERGED VERIFY SUMMARY: 34 passed, 0 failed, 100 not covered. (1 record(s))
NOT VERIFIED: the records do not cover the whole pack. Run the remaining shards.
$ echo $?  → 3
```

**Exit codes.** 0 pass · 1 failed · 2 usage · 3 incomplete. A sharded or
budgeted run is never a pass on its own; only `collect` can say 0, and only when
the union covers all 134 bundles. A time budget decides what is *started* —
a suite that has begun always finishes and is judged on its result.

**Dependency-free is the point.** Every command above runs on a bare Node
install: the suites are pre-built `.mjs`, the specs are pre-compiled into
`verify/specs/`, and `npm ci` is only ever needed to add or rebuild bundles.

**The full gate, in one window, with nothing installed.** The archive extracted
alone (1,591 files, no `node_modules`) reaches the whole pack:

```
$ node verify/run.mjs
OFFLINE VERIFY SUMMARY: 134 passed, 0 failed. (node v20.20.2)
real 1m20.535s        # two cores, one window
```

**Running the condition exposed three real dependency leaks** — the claim
"dependency-free" was checked by extracting the archive and running it, not by
reading it. Each is fixed here, not restated:

| What leaked | How it showed | Fix |
|---|---|---|
| `tools/mcp-engine.mjs` imported `zod` | the MCP host would not start without `node_modules`; five suites that spawn it (`mcpRouter`, `mcpConformance`, `mcpSdkClient`, `mcpSdkClientV2`, `metaLoop`) timed out | the engine now **bundles its runtime dependencies** (`tools/build-mcp.mjs`, no `--packages=external`); 1.36 MB, self-contained; `NOTICE` discloses the bundled copy |
| `tools/drill-benchmark.mjs` / `tools/external-model-validation.mjs` needed `esbuild` to compile their entries | both refused in words ("REFUSED (needs node_modules)"), so `drill` self-skipped instead of being judged | the pack compiles both entries into `verify/specs/` (sha256 in the manifest) and the tools fall back to them, **announcing the path taken**; the refusal remains only when neither path exists |
| `probe/mcpSdkClient.test.ts` E4 read `node_modules/@modelcontextprotocol/sdk/package.json` | the suite skipped when the install was absent | E4 verifies the **declared** devDependency pin in every environment and the **resolved** version only where an install exists, saying which — the conformance claim itself (E1–E3 drive the real server through the bundled client) always runs |

The reviewer's condition was the right test: it failed against 19.6.2, and it
passes here for reasons a reader can check rather than take on faith.

**One honest boundary.** The 135-suite *development* gate (`npm test`) compiles
TypeScript probes and therefore still needs `npm ci`; it is green (135 passed, 0
failed) in the working tree. The archive's zero-install path is the 134-bundle
offline pack, which now covers everything except `offlinePack.test.ts` — the
suite that verifies the pack itself.

## The 19.6.2 record — the Federation plane

- **Cross-owner crossings with a human on both sides.** `federation/bridge.ts`
  mints an envelope (CSPRNG id, one nonce per side) and digests it BEFORE either
  human decides; each side then presents a signed approval bound to that exact
  digest. A crossing proceeds only when both approvals verify, both policies
  lend the capability at the pair's live standing, and both decisions are
  unspent. `probe/fedCrossing` pins the sequence, the symmetric enforcement,
  replay refusal, envelope expiry, and — the regression that matters — that a
  prior `success` ledger row is NOT an approval.
- **One identity system, with proof of possession.** `federation/identity.ts`
  resolves the same owner keypair `missionAuthority` uses; `probe/fedIdentity`
  asserts the federation public key is byte-identical to the authority's, that
  an anchor's self-signature is required, that re-pointing the face fails
  verification, and that a session-scoped anchor is refused when durability is
  required.
- **The Face, derived and measured — and now on screen.** `federation/sigil.ts`
  derives the whole device from the identity's SHA-256 via the harbor's own
  `pureSha256`; `probe/fedSigil` pins determinism, palette membership, the
  no-face charge arrangement (no two charges on one row, ever), every state in
  `SIGIL_STATES` (including that `refused` and `failed` render differently), and
  the distinctness report including its own honest collision count.
  `federation/SigilFace.tsx` renders it in the VH-19 door: a derived mark on
  each mission-crew card and each bound peer identity, with hover text that
  states plainly that this is a recognition aid and the key is the proof.
- **1,560, stated as two numbers.** `federation/fleet.ts` + `probe/fedFleet`
  pin the arithmetic (1,150 + 200 + 210), zero duplicate ids across six
  benches, per-entry specification for all 210 new specialists, and that the
  registry's OWN count is unchanged — registered benches are not routed.
- **Two local stores, in the runtime.** `probe/fedCrossing` §9 runs the same
  envelope twice with the two sides' local stores swapped and requires opposite
  outcomes — only possible if the two readers are genuinely independent — and
  requires a single-reader caller to be reported as `shared: true`. The outcome
  digest commits to `standingSource`, so a receipt shows which store each tier
  came from.
- **The mark tracks the key.** `probe/fedIdentity` §2 rotates a key under one
  owner name and requires a NEW mark, and requires the old mark to fail
  verification when re-pointed at the new key; §3 pins that a JWK and a PEM of
  one key — and the same PEM re-wrapped — derive one mark.
- **What an approval proves, and what it does not.** `probe/fedApproval` pins
  the vocabulary (`APPROVAL_SIGNER`, `APPROVAL_ATTESTATION`,
  `APPROVAL_NOT_ATTESTED`), requires both sentences on every filed record, and
  proves the semantic: one owner key approving twice, naming two different
  humans, produces two records that verify under the same key handle and stay
  distinguishable. `probe/fedCrossing` §8b requires the success line to name the
  key as the approver and puts both sentences inside the outcome digest.
- **The third registered bench.** `probe/fedFleet` §4a checks all 230 entries of
  the regulated bench (46 domains, 15/20 per category, every mission distinct),
  §2 pins the arithmetic (1,150 + 200 + 210 + 230 = 1,790). Each snapshot is
  drift-gated against its spec by `node tools/generate-batch.mjs --all --check`.
- **A short-window verification path.** `node tools/quick-verify.mjs` runs the
  eleven headline bundles in ~1.3s, zero install, printing each suite's own
  count. Verified from the packaged tree.
- **Gates at 19.6.2:** `tsc --noEmit -p tsconfig.json` 0 ·
  `node tools/run-all-probes.mjs` 135 suites green ·
  `node verify/run.mjs` 134/134 with zero npm dependencies ·
  `sh VERIFY.sh` green · both batch generators `--check` clean ·
  `versionDrift` 42/42 · `offlinePack` 17/17.
- **Not claimed:** no cross-instance transport is added or claimed — a crossing
  is a governed, receipted decision between two owners, and the wire that
  carries it is the integrator's. No central reputation service exists or is
  planned. The 410 registered specialists are catalogued, not routed.

## The 19.5.6 record — the Teammates plane (crew UX, VH-hardened)

- **The crew is visible**: the VH-19 door gains a Teammates desk — the Chief
  Steward plus every routed specialist rendered as mission-crew cards
  (final run states — not streaming): status (done / gated / refused /
  error, never dressed up), each member's own queue (tool attempts +
  outcomes + honest step-limit labels), scope chips, workspace facts
  derived from the member's actual tool surface + the run's stated seam,
  and verified trace digests (sha256) of the run they describe — with
  ECDSA P-256 shown on its own authority line when the mandate exists.
- **Coordination is narrated**: a feed states how many agents were messaged,
  what each returned, when the synthesis is ready, and when a run pauses at
  the human gate.
- **One-click sample mission**, labelled a demo — nothing simulated is ever
  presented as executed.
- **Adapted, not copied**: the crew interaction model of the multi-agent
  desktop genre (named teammates, per-agent workspace/queue/context,
  visible inter-agent messaging, traceable decisions) restyled in the VH
  premium light system; and where others show a trace, VH signs one —
  probe-pinned.
- **Hardening pass (reviewer-driven)**: the workspace line is derived from
  each member's ACTUAL tool surface + the run's stated workspace seam —
  only reach-provenance members may display the Reach computer-use
  session, a toolless member states "no workspace"; the desk is named
  "mission crew" (final run states, not streaming); "signed trace" is now
  "verified trace digest" (sha256), and ECDSA P-256 appears only on the
  authority line; the rows are stated as a run-derived crew view, not
  persistent teammate instances.

Current gates (19.5.6): tsc 0 · fleet 126/126 · offline 125/125 ·
teammates 14/14 · door 70/70 · agentic test 24/24 · reachPlane 31/31 ·
versionDrift 42/42 · offlinePack 17/17.

## The 19.5.4 record — release-quality close-out

- **Reach MCP docs now name all six exposed tools**: `pc.exec`,
  `pc.browser.open`, `pc.browser.screenshot`, `authority.issue`,
  `authority.verify`, `authority.lookup` — the header and the runtime expose
  the identical surface (probe-pinned in `probe/meshRuntime`).
- **Release numbers at current truth**: the fleet is 125 probe suites / 124
  offline bundles; every count line in this record, `BUILD-INFO.txt`,
  `README.md` and the deck outline names exactly that.
- **Version aligned everywhere**: `VH_VERSION` and `REACH_MCP_VERSION` are
  both 19.5.4 (41 versionDrift pins + the Reach plane).

Current gates (19.5.4): tsc 0 · fleet 125/125 · offline 124/124 ·
meshRuntime 17/17 · door 70/70 · agentic test 24/24 · reachPlane 31/31 ·
versionDrift 41/41 · offlinePack 17/17.

## 19.5.3 FINAL-FREEZE hardening (review round 6)

- **VouchMesh is LIVE, not just probed**: `src/vh19/meshRuntime.ts` wires the
  mesh fabric into the production A2A handoff seam (`src/vh19/handoffs.ts` —
  the same path the VH-19 door and RSI consume). Every DELEGATED handoff now
  registers both parties as mesh peers, crosses mutual attestations, opens a
  channel, and mints a JOINT RECEIPT co-signed by both participants; the
  digest lands on the handoff record. Refused handoffs mint nothing but still
  move pair trust down. Standing compounds across sessions in localStorage.
  Hashing moved to `src/vh19/pureHash.ts` (synchronous SHA-256/HMAC, works in
  the WebView AND under Node, byte-identical to `node:crypto` — probe-pinned).
  Scope stays honest: mesh co-signatures are the trust fabric's tamper-
  evidence layer; portable authority remains the ECDSA mandate plane.
- **Ids are CSPRNG-born**: `uid()` now draws `crypto.randomUUID()` with a
  `crypto.getRandomValues()` fallback — 122 bits of cryptographic randomness
  per id. That is why cross-user or cross-run collision is not a planning
  concern; where no Web Crypto exists at all, the fallback is a labelled
  deterministic counter, never silent `Math.random()`.
- **Reach MCP version aligned**: `REACH_MCP_VERSION` is 19.5.3, matching the
  product line (component lineage no longer trails the release).
- **Reach MCP doc honesty**: the header no longer lists `authority.bind` —
  it is not an exposed Reach tool; the exposed set is exactly `pc.exec`,
  `pc.browser.open`, `pc.browser.screenshot`, `authority.issue`,
  `authority.verify`.
- **Comment drift closed**: registry and fleet comments state 390 matured and
  1,150 total, matching the live `catalogStats()` arithmetic.
- **VouchMesh scope, stated canonically**: VouchMesh is the LOCAL
  collaboration trust fabric; ECDSA provides portable authority across
  instances. Both sides of a handoff are minted and co-signed inside ONE VH
  runtime — no cross-instance network handshake happens and none is claimed.
  This sentence now lives in `vouchMesh.ts`, `meshRuntime.ts`, this record,
  and is probe-pinned in `probe/meshRuntime`.

## The 19.5.3 record — Reach matured: computer-use, the 1,150 fleet, hardened authority

19.5.1 introduced the Authority Suite (Mandate Passport, Chain of Authority,
Intent Receipts, Warranty Pack, Liability Map) and VOUCHMESH™ — the bot-to-bot
trust fabric. 19.5.1 gives VH hands and closes the documentation to the current
release:

- **Computer-use plane** (`src/vh19/computerUse.ts`, `probe/computerUse` 15 pins):
  allowlisted + injection-scanned + bounded `pc.exec`; built-in headless browser
  with per-mission isolated profiles, HTTPS-by-policy, critical-tier handover,
  and screenshots that refuse wordingly when no browser binary exists.
- **The 1,150 fleet**: the reach bench (`src/vh19/reachBench.ts`) adds 140
  computer-use-era specialists and the maturity bench (`src/vh19/maturityBench.ts`)
  adds 390 individually specified MATURED professionals across all 14 categories —
  each with named doctrine plus the uniform maturity contract (evidence before
  claims, gate on risky moves, receipts on every tool call, failures in words).
  Composition stays self-proving: 460 seed + 160 broader + 140 reach + 390 matured.
- **Asymmetric mandates**: mandates now sign with ECDSA P-256 keypairs —
  anyone verifies with the public key; symmetric HMAC is explicitly refused as
  portable authority (`probe/authority` 34 pins).
- **Authority ⟷ receipt-chain binding**: every authority hop binds to a
  receipt digest; both sides checkable offline.
- **Documentation at current truth**: release verification, changelog, upgrade
  notes and the adaptation record all name 19.5.1; the adaptation plan is now
  a shipped-code record with no forward-looking claims.
- **Live wiring — integration close-out**: Agent Reach MCP (`src/vh19/reachMcp.ts`)
  is the app's PRIMARY DEFAULT MCP (in-app surface + stdio via `tools/mcp.mjs`).
  Its computer-use tools (`pc.exec`, `pc.browser.open/screenshot`) execute ONLY
  through the governed VH-19 pipeline — risk tier → human gate → receipt — and
  the VH-19 Generalist attaches the pc context solely to reach-provenance members
  (`src/vh19/tools.ts`, seven tools). Every Generalist response rides an ECDSA
  P-256 mission mandate bound to its provenance digest in a verifiable ledger
  (`src/vh19/missionAuthority.ts` + `authorityWeb.ts`, WebCrypto: the live trust
  path in browser and node; the HMAC signer in `authority.ts` is demoted to
  local legacy). The browser plane remains honestly HYBRID — HTTPS fetch/snapshot,
  injectable transport, real-binary screenshots; no binary ⇒ refusal in words,
  never a faked page. UI overhauled to a minimal premium layer
  (`src/styles/minimal.css`, loaded last; VH-19 door carries the Reach panel).
  RSIRALS header drift fixed (governance plane frozen at 19.4.4, labelled).
  New probe: `probe/reachPlane` (25 checks) pins the whole wiring.
- **Review hardening (freeze-track)**: `authority.issue` is owner-granted and
  human-gated on every surface (empty/out-of-set scope refused, budget ≤ 100 and
  depth ≤ 1 clamped); ONE mandate per mission — response digest and ledger record
  reference the identical mandate, and the verifier checks digest identity;
  authority keys are DURABLE per VH identity handle (persisted JWK; a reload
  reuses the same owner keys; mandates name the handle, not `local-owner`);
  reach missions advertise `pc.exec` + `pc.browser` in member tool protocols via
  explicit capability policy; browser sessions persist per mission
  (`missionBrowser`) for multi-step open → act → screenshot workflows — and
  adopt explicitly-upgraded transports/binaries, so persistence never pins
  stale bindings.
- **Review hardening — round 2**: the Generalist no longer mints broad
  a-priori mandates — finished runs carry a signed RUN ATTESTATION (scope =
  tool classes actually executed; budget = executed action count; depth 0;
  nothing executed ⇒ `authority: null`), while a-priori grants remain
  exclusively owner-gated at the MCP surface; the authority binding commits
  to the mandate digest, and verification recomputes the stored mandate's
  digest independently; owner private keys never persist plaintext —
  production path is Tauri IPC → OS keychain, then AES-GCM passphrase
  envelope (PBKDF2 150k), else honestly session-scoped keys.
- **Review hardening — round 3**: mission ids are random per run (`uid`),
  never text-derived; `pc.browser` navigation rides the central egress guard PLUS a
  stricter plane rule (loopback/private/metadata refused for navigation while
  `net.fetch` keeps its documented local-service surface); the door exposes
  the authority-key security state and an owner passphrase unlock
  (`setAuthorityPassphrase`) — web authority is session-scoped UNTIL the
  owner unlocks encrypted persistence, and the docs say exactly that.

Round-4 gates (at that freeze): tsc 0 · fleet 124/124 · offline 123/123 · door 70/70 · agentic test 24/24.

## Prior record — 19.4.5 — BYOA security hardening + product-focused polish

BYOA gains an always-on security policy, probe-pinned: TLS by default (remote http refused), per-agent delegation rate ceiling (10/rolling minute), response containment (external replies size-capped and injection-scanned), scoped delegation-token receipts (identity + task + ceiling + time), and tamper-evident identity digests on registration. The product surface is polished capability-first: failure-framing copy is out, quick-start prompts are in, and the RSIRALS seal is documented at its exact scope (measurement integrity, not signed provenance). The pre-seed application document leaves the app repository — fundraising is a separate workstream. Gates: tsc 0 · door probe 70/70 · fleet 120/120 · offline 119/119.

## The 19.4.4 record — RSIRALS frozen: sealed settlement, structural contracts, honest attribution + pre-seed pack

19.4.4 closes the 19.4.3 review's three tightenings. Settlement is sealed: the raw numeric settlement function is module-private; the only exported door accepts MeasurementEvidence sealed by bindSettlementEvidence, and forged or tampered evidence is refused (probe-pinned in both directions). Governance is structural: every RSI draft carries a change contract (target, field, old/new value, authority, scope, risk); validateChangeContract rejects protected targets regardless of authority or wording, with the string firewall kept as defense-in-depth. Attribution wording is honest: failure-source attribution / arm routing — heuristic and labeled, with true counterfactuals in the mission-level measured loop. Ships the pre-seed application pack (docs/PRESEED-APPLICATION.md) and a refreshed one-pager. Gates: tsc 0 · door probe 63/63 · fleet 120/120 · offline 119/119.

## The 19.4.3 record — RSIRALS v5.0 ships proprietary + credential hygiene

19.4.3 ships RSIRALS v5.0 (Trust-Rooted Recursive Self-Improvement) as a proprietary Vouch Harbor product: three planes with a frozen, write-path-free governance plane; the nine-stage lifecycle with canary auto-rollback and an evolution archive; a control-plane firewall; counterfactual attribution with honest θ-arm (weight training stays out-of-band; accept/reject pairs export for DPO); and end-to-end evidentiary promotion — settlement numbers are read from exam receipts, never supplied. The 19.4.2 reviewer's P0 is fixed: the populated `.env.local` no longer ships (removed; `.env.example` placeholders only; packaging excludes `.env.*`; the exposed key must be rotated with the provider). Gates: tsc 0 · door probe 58/58 · fleet 120/120 · offline 119/119.

## The 19.4.2 record — the matured RSI framework, the BYOA trust intersection, a self-proving count

19.4.2 closes the 19.4.1 review's remaining items, built on a survey of
the 2026 RSI landscape (see `docs/RSI-FRAMEWORK.md`). The RSI curriculum
now covers the FULL declared evidence hierarchy — user rejection, gate
denials, execution failures, live-data unverified events, handoff
refusals — wired live from the door, nothing invented. Applied playbooks
enter a promotion ladder as `measuring` and can only be settled by a
MEASURED comparison (candidate beats baseline); losing measurements
retire them and revert the frozen memory exactly — the same discipline
as the mission self-improve loop. BYOA now enforces the trust
intersection (endpoint policy ∩ ceiling ∩ non-authoritative declared
capabilities ∩ identity), checked at registration and at delegation.
The specialist count proves itself: `catalogStats().byProvenance` is
computed from the arrays (460 seed + 160 broader = 620 registered
specialists, both batches fully routable), rendered live in the door,
and pinned by the probe. Gates: tsc 0 · door probe 48/48 · fleet
120/120 · offline 119/119.

## The 19.4.1 record — BYOA, RSI, unified egress

19.4.1 closes the pre-freeze review and adds two capabilities. **BYOA — bring
your own agent**: external agents register (endpoint kind, capabilities, risk
ceiling), join the Generalist through the existing peer seam, and every
delegation pauses at the human gate and lands in the handoff ledger — the
multi-agent story, under governance instead of in a walled garden. **RSI —
recursive self-improvement, the bounded kind**: a deterministic curriculum over
the agent's own evidence ledger, an actor that drafts frozen SKILL playbooks
(one receipted provider call when wired, the raw correction otherwise), a
verifier hierarchy where human approval and the autonomy exam outrank
everything and intrinsic self-assessment is never a verifier, and a floor the
loop can never touch. Fixes landed: evidence retrieval now rides the same
`checkEgressUrl` SSRF guard as tool egress (one network policy; refusals
receipted), the specialist count is stated as its composition (460 seed + 160
broader = 620, verifiable from `catalogStats`), and connector/skill copy says
exactly what it is (governed connector declarations; SKILL.md ecosystem
import). Protocol v0.10.7; suites 120/119.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (five-color) | `node tools/run-one-probe.mjs theme` | 11/11 |
| Collab identity | `node tools/run-one-probe.mjs collabInvite` | 29/29 |
| Goals + session rules | `node tools/run-one-probe.mjs goals` | 26/26 |
| Skills | `node tools/run-one-probe.mjs skills` | 16/16 |
| Captains + multi-member + synthesis contract | `node tools/run-one-probe.mjs captains` | 38/38 |
| Specialist tools + member agent loops | `node tools/run-one-probe.mjs agentTools` | 47/47 |
| Captain synthesis | `node tools/run-one-probe.mjs synthesis` | 29/29 |
| Live-data GuardRail (incl. retrieval + unified egress) | `node tools/run-one-probe.mjs liveData` | 27/27 |
| The Shipyard | `node tools/run-one-probe.mjs shipyard` | 22/22 |
| Legacy isolation | `node tools/run-one-probe.mjs legacyCompat` | 3/3 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door (incl. BYOA, RSI, egress, full-curriculum, promotion-ladder and trust-intersection pins) | `probe/vh19Door.test.tsx` (via `npm test`) | 38 at 19.4.1; 48 at 19.4.2; 58 at 19.4.3; 63 at 19.4.4; **70/70 at 19.4.5** |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Doc identity | `node tools/run-one-probe.mjs docIdentity` | 6/6 |
| Offline pack | `node verify/run.mjs` | 119 passed, 0 failed |
| Bare-machine verify | `sh VERIFY.sh` | green |
| Live fleet | `npm test` | 120/120 suites green |

---

## The 19.3.0 "Vanguard" record (history) (specialists execute · Captains synthesize · the GuardRail retrieves)

19.3.0 answers the 19.2.0 review's three capability findings: specialists
are executors now (workspace-wired members run a real act/observe loop
over five gated, receipted tools), the Captain REASONS over its members'
real answers (deterministic divergence pass + its own synthesis call, its
own receipt), and the live-data GuardRail performs actual source
retrieval when an evidence fetch is wired — "verified" then means fetched,
and a disclosure stamp can never pose as a retrieval stamp. Built on
19.2.0's multi-member execution and runtime GuardRail. Protocol v0.10.7;
suites 120/119.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (Horizon) | `node tools/run-one-probe.mjs theme` | 10/10 |
| Collab identity | `node tools/run-one-probe.mjs collabInvite` | 29/29 |
| Goals + session rules | `node tools/run-one-probe.mjs goals` | 26/26 |
| Skills | `node tools/run-one-probe.mjs skills` | 16/16 |
| Captains + multi-member + synthesis contract | `node tools/run-one-probe.mjs captains` | 38/38 |
| Specialist tools + member agent loops | `node tools/run-one-probe.mjs agentTools` | 47/47 |
| Captain synthesis | `node tools/run-one-probe.mjs synthesis` | 29/29 |
| Live-data GuardRail (incl. retrieval) | `node tools/run-one-probe.mjs liveData` | 27/27 |
| The Shipyard | `node tools/run-one-probe.mjs shipyard` | 22/22 |
| Legacy isolation | `node tools/run-one-probe.mjs legacyCompat` | 3/3 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 28/28 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Offline pack | `node verify/run.mjs` | 119 passed, 0 failed |
| Bare-machine verify | `sh VERIFY.sh` | green |
| Live fleet | `npm test` | 120/120 suites green |

---

---

# 19.2.0 "Armada" — release verification record (standing depth record)

True multi-member execution + runtime live-data GuardRail + honest naming.
All 19.2.0 gates were green at ship time: tsc 0 · protocol 171 · unit 20 ·
captains 37 · liveData 17 · shipyard 22 · skills 16 · goals 26 · vh19 81 ·
teamEvolve 35 · vh19Door 28 · versionDrift 41 · offline 117 · live 118 ·
VERIFY.sh green. Its disclosure-only GuardRail and report-only Captains
are superseded by 19.3.0's retrieval + synthesis (VH-19.3-UPGRADE.md).

---

# 19.1.0 "Shipyard" — release verification record (standing depth record)

The Shipyard team workspace, Captains (renamed AgentLeads, all-members
aggregation), token optimizer, prompt-level live-data guidance. All
19.1.0 gates were green at ship time: tsc 0 · protocol 171 · unit 20 ·
captains 27 · shipyard 22 · skills 16 · goals 26 · vh19 81 · vh19Door 28 ·
versionDrift 41 · offline 116 · live 117 · VERIFY.sh green. Its
prompt-level live-data "GuardRail" and single-call aggregation are
superseded by 19.2.0's runtime enforcement (VH-19.2-UPGRADE.md).

---

# 18.9.0 "Aurora" — release verification record (standing depth record)

Identity cleanse + skill layer + 300 specialists. All 18.9.0 gates were
green at ship time: tsc 0 · protocol 171 · unit 20 · skills 16 · goals 26 ·
collabInvite 29 · vh19 81 · vh19Door 28 · versionDrift 41 · offline 113 ·
live 114 · VERIFY.sh green. See VH-18.9-UPGRADE.md; the legacy-identifier
absolutes in its notes are superseded by 19.2.0's docs/LEGACY-COMPAT.md
registry.

---

# 18.8.0 "Atlas" — release verification record (standing depth record)

Catalog 147 → 252 + regenerated web build. All 18.8.0 gates were green at
ship time: tsc 0 · protocol 171 · unit 20 · theme 10 · collabInvite 29 ·
goals 26 · selfEvolve 18 · selfEvolveMission 52 · teamEvolve 35 · vh19 81 ·
vh19Door 28 · versionDrift 41 · offline 112 · live 113 · VERIFY.sh green.
See VH-18.8-UPGRADE.md for the full record. (Superseded identity-wise by
18.9.0: the 18.8.0 archive still carried predecessor-product strings.)

---

# 18.7.0 "Keystone" — release verification record (standing depth record)

Goal truthfulness (DONE/PARTIAL/PLANNED/BLOCKED) + A2A handoff ledger +
release-contract fixes + parallel offline verifier. All 18.7.0 gates were
green at ship time: tsc 0 · protocol 171 · unit 20 · theme 10 · collabInvite
29 · goals 26 · selfEvolve 18 · selfEvolveMission 52 · teamEvolve 35 ·
vh19 81 · vh19Door 28 · versionDrift 41 · offline 112 · live 113 ·
VERIFY.sh green. See VH-18.7-UPGRADE.md for the full record.

---

# 18.6.0 "Polaris" — release verification record (standing depth record)

Ledger identity + motion grammar + clean tree. All 18.6.0 gates were green
at ship time: tsc 0 · protocol 171 · unit 20 · theme 10 · collabInvite 29 ·
goals 19 · selfEvolve 18 · selfEvolveMission 52 · teamEvolve 35 · vh19 79 ·
vh19Door 28 · versionDrift 41 · offline 112 · live 113 · VERIFY.sh green.
See VH-18.6-UPGRADE.md for the full record.

---

# 18.5.0 "Apex" — release verification record (standing depth record)

Goal mode (Assignments) + session Auto-Review gate rules + Gemini stable-v1
default. All 18.5.0 gates were green at ship time: tsc 0 · protocol 171 ·
unit 20 · theme 10 · collabInvite 29 · goals 19 · selfEvolve 18 ·
selfEvolveMission 52 · teamEvolve 35 · vh19 79 · vh19Door 28 · offline 112 ·
live 113 · VERIFY.sh green. See VH-18.5-UPGRADE.md for the full record.

---

# 18.4.0 "Zenith" — release verification record (standing depth record)

## The 18.4.0 record (identity self-proof + structural A2A binding + bench depth)

18.4.0 closes the review's last two cryptographic nits (identity record
self-proof, structural card-verified binding), makes verification
reproducible on a bare machine (`sh VERIFY.sh`), and deepens the bench to
147 real specialists.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (Horizon) | `node tools/run-one-probe.mjs theme` | 10/10 |
| Collab identity (self-proof + structural) | `node tools/run-one-probe.mjs collabInvite` | 29/29 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 26/26 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Offline pack | `node verify/run.mjs` | 111 passed, 0 failed |
| Bare-machine verify | `sh VERIFY.sh` | green |
| Live fleet | `npm test` | 112/112 suites green |

---

# 18.3.0 "Meridian" — release verification record (standing hardening record)

## The 18.3.0 record (hardening + motion + new mark + split bundle)

18.3.0 closes the external review's two cryptographic findings (bound-key
approval verification, passphrase-sealed keys), ships the Horizon motion
system, a new icon, route-level code splitting and a browser CSP.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (Horizon) | `node tools/run-one-probe.mjs theme` | 10/10 |
| Collab identity (hardened) | `node tools/run-one-probe.mjs collabInvite` | 23/23 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 26/26 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Offline pack | `node verify/run.mjs` | 111 passed, 0 failed |
| Bundle split | `npm run build` | 9 chunks, main 528 kB |
| Live fleet | `npm test` | 112/112 suites green |

---

# 18.2.0 "Horizon" — release verification record (standing Horizon record)

## The 18.2.0 record (Horizon UI + signed invitations + bounded self-evolution)

18.2.0 ships the premium minimal UI (Horizon tokens, new icon, real Settings
page), the signed collaboration invitation lifecycle the external reviews
named the biggest gap (`probe/collabInvite`, 14 checks), bounded recursive
self-evolution with an unbreakable floor (`probe/selfEvolve`, 18 checks), and
automatic team self-proposal after connection (`probe/teamEvolve`, 35 checks).

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (Horizon) | `node tools/run-one-probe.mjs theme` | 10/10 |
| Collab invitations | `node tools/run-one-probe.mjs collabInvite` | 14/14 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 26/26 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Offline pack | `node verify/run.mjs` | 111 passed, 0 failed |
| Live fleet | `npm test` | 112/112 suites green |

---

# 18.1.0 "TeamEvolve" — release verification record (standing Team-Evolve record)

## The 18.1.0 record (cross-user Team-Evolve + category-scoped autonomy)

18.1.0 ships the differentiator the external reviews named as missing: the
team itself learns across users, with every member's explicit consent
structural (`probe/teamEvolve`, 31 checks), autonomy scoped per category, and
the bench grown to 102 real specialists. The stale five-docks comment class
from the 18.0.1 review is fixed and pinned.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 31/31 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 22/22 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Live fleet | `npm test` | see the run record below |

The protocol is unchanged at v0.10.7, so the 17.10.7 record below remains the
standing verification for the protocol and A2A surfaces.

---

# 18.0.1 "Generalist" — release verification record (standing front-door record)

The VH-19 front-door wiring (18.0.1) was verified at: tsc 0, protocol 171/171,
unit 20/20, vh19 73/73, vh19Door 18/18, versionDrift 41/41, full live fleet
109/109 on node v20.20.2, Linux x64, 2026-09-14.

---

# 17.10.7 "WarrantTeams" — release verification record (standing protocol/A2A record)

Produced on node v20.20.2, Linux x64, 2026-09-13.

## What this release is

17.10.5 shipped WarrantTeams on the 17.10.4 Warrant core, so it carried protocol
RULES 3–5 but not **RULE 6** — and its own attacker-grade campaign reported the two
resulting bounds as `FINDING A` / `FINDING B` instead of scoring them.

**17.10.7 back-ports RULE 6.** `protocol/` is self-contained (no app module imports
it), so the port is a bounded protocol-only diff and `protocol/` is now
byte-identical to the Warrant trunk:

- **Rotation must prove possession of the incoming key** — a second signature over
  `VH-ROTATE-POP-v1 | oldFp | newFp | ts`, bound to the caller's fingerprint.
  Missing `pop`, a wrong key or a mismatched `oldFp` fail closed as
  `invalid-rotation-proof`. Closes offline-fingerprint squatting.
- **Authority is withdrawn by authority** — a revocation against a DESIGNATED
  identity is honoured only from an authorised writer, refused at submission
  (`policy:revocation-requires-authority`, metrics `revocationRejected` /
  `rotationRejected`) and ignored at consumption, so records already in a ledger
  are inert. Closes the designated-authority denial of service.

Full notes: `VH-17.10-UPGRADE.md` §9–§10 and the `17.10.7` row in `CHANGELOG.md`.

## The gates

| Gate | Command | Result |
|---|---|---|
| Live probe suites | `npm ci && npm test` | **107 passed, 0 failed** |
| Offline pack | `node verify/run.mjs` | **106 passed, 0 failed** |
| Protocol self-test | `cd protocol && npm ci && npm test` | **ALL 171 UNIFIED-SENTINEL CHECKS PASSED** |
| Typecheck | `npx tsc --noEmit` | exit 0, no diagnostics |
| Production build | `npx vite build` | 478.33 kB main chunk (147.10 kB gzip), 2.77 s |
| Bridge gate | `node protocol/bridge/bridge-selftest.mjs` | **17/17** (zero-install) |
| Unit runner | `npm run unit` | **20 passed, 0 failed** |
| Version drift | `npm test` → `versionDrift` | **41 passed, 0 failed** |
| A2A runtime mount | `npm test` → `a2aRuntime` | **48 passed, 0 failed** — two independent VH processes |
| A2A host engine pin | `npm test` → `a2aRuntime` §2 | byte-identical rebuild + tampered engine fails closed |
| Benchmark | `node benchmark/run.mjs` | **6 passed, 0 failed** — B3 reports "171 checks" |
| Drill | `node tools/drill-benchmark.mjs` | guard passed · maths passed · **impossible FAILED (correct)** · digest `6a08e448e79255fe1e32ffe998eec7b8788d63ef59625b6b24f72c043c304f24` |

## The attack battery

Start a harbor first:

```bash
cd protocol && npm ci
PORT=3200 VH_DATA_DIR=/tmp/vh-verify node src/server/harbor.js
```

It boots `"version":"0.10.7"`. Then, from the archive root:

| Harness | Expected | Measured |
|---|---|---|
| `node protocol/wcarena/exploit-self-attestation.mjs` | every leg refused | **refused** — `policy:grantor-holds-nothing` |
| `node protocol/wcarena/adversarial-campaign.mjs` | 14/14, control intact | **14/14**, control YES |
| `node protocol/wcarena/v104-authority-matrix.mjs` | 10/10 | **10/10** |
| `node protocol/wcarena/governance-attacks.mjs` | 0 of 4 false-accepts | **0 of 4**, legitimate path true |
| `node protocol/wcarena/warrant-compromise-campaign.mjs` | 22/22 + 4 posture notes | **22/22**, 4 posture notes, **0 findings** |

The harbor's audit log records the blocked attack:

```
member.join    name=attacker_market_data_feed
vouch.rejected reason=grantor-holds-nothing  action=write:purchase_orders  held=["read:public"]
vouch.rejected reason=grantor-holds-nothing  action=*                     held=["read:public"]
```

## The A2A LiveBridge (added after external review of the first 17.10.7 package)

An external review scored the first 17.10.7 package 9.6/10 and made one
substantive finding that was **correct**: cross-harbor delegation had the whole
ladder real — strict A2A v1.0 discovery, JWS card verification, sender routing,
GuardRail, both human gates, tamper-evident digests, replay guards — and then
ended in a template literal.

```ts
const artifact = `${toTeammate.name} completed: "${task}" — executed under … governance.`
```

A claim of execution with no execution behind it, in the one product whose premise
is that a claim without evidence is not a claim. `probe/harborTeams` and
`probe/a2aV10` could not see it: they pinned the ladder, and the ladder was
genuinely real. Only the last step lied.

`src/mission/a2aBridge.ts` replaces it. The chain is now:

```
A2A → Warrant → GuardRail → receiver gate → REAL TeamExecutor
    → real git / CLI result → vh-proof-receipt/2
```

- The verdict is the **repository's own test command**, not the seat's and not ours.
- The bridge runs a **writer plus a read-only reviewer on a different harness**,
  because a single seat tiers `self-verification` and the adversarial gate BLOCKS
  it. The first draft tried one seat; the product's own gate correctly refused it.
- `DelegationRecord` gains `execution` (harness, run status, seats run/verified,
  measured USD, wall clock, `notRun` reasons) and `receipt`. Both are null
  whenever nothing ran.
- **No fallback.** No deps, no harness, no `repoRoot`, or a missing binary →
  refused in words with `artifact: null`. A run whose verification did not pass is
  `executed-failed`, never `completed`. Demos must ask explicitly
  (`allowUnexecuted`) and get a record whose note reads `NOT EXECUTED`.

`probe/a2aBridge` (34 checks) pins it on a real git repo with a real CLI boundary,
including the anti-cheat (a repo whose tests fail never reports a completion) and a
**regression pin** so no path can fabricate a completion string again.

### One correction to the review, in the interest of accuracy

The review asked to "restore the 17.10.6 LiveBridge". **There is no 17.10.6.**
Checked at the time of writing:

- GitHub releases: newest is `v17.10.5` (25 releases total) — no 17.10.6
- GitHub tags: 25 tags, none matching 17.10.6
- Branches: `main` only
- No `a2aBridge.ts` and no `LiveBridge` string in any tree in this workspace,
  including both 17.10.5 release ZIPs

So this bridge was **written, not restored** — built to the architecture the review
specified. If a 17.10.6 LiveBridge exists on a machine that never pushed, its
implementation should be diffed against this one and the better parts kept; the
regression pin in `probe/a2aBridge` will catch any attempt to drop it again.

The review's other findings were all confirmed and fixed: `docs/INTEROP.md` and
`docs/INFORMATION-ARCHITECTURE.md` titles read 17.10.5, `README.md` described the
protocol as "v0.10.2 … 122/122", and `protocol/package.json`'s description said
v0.10.4 while the code declared 0.10.7. None of those were in `versionDrift`'s
enforced set, which is exactly why they survived — the reviewer's proposed release
gate is the right fix, and `probe/a2aBridge` §6 is the first piece of it.

## The A2A runtime mount (rev 3, after the second external review)

The second review scored the LiveBridge 9.9 and then found the thing that
mattered more: the bridge was implemented and probed but **never mounted by the
application**. Its grep was correct — at that point `createA2AServer` appeared in
`src/` once (its own definition) and in comments; the only callers were probe
suites. A harness proves the architecture works when a test wires it. It does not
prove the shipped product exposes it.

Fixed by adding the missing layer, not by re-labelling the old one:

| Piece | What it is |
|---|---|
| `src/mission/a2aRuntime.ts` | `startA2ARuntime()` — the ONE bootstrap: identity → team → signed v1.0 card → delegation handler → receiver risk policy → LiveBridge → listen. Plus `nodeRunnerDeps()` (real process spawning, real git, the repo's own test as the verdict) and `drillBridgeConfig()` (the labelled deterministic seat). |
| `tools/vh-host.entry.ts` → `tools/vh-host-engine.mjs` | the host process, bundled and byte-pinned (`.sha256`) the same way the MCP engine is. |
| `tools/vh-host.mjs` (`npm run host`) | the launcher. Verifies the pin on every start; a doctored engine exits 2 instead of listening. |
| `probe/a2aRuntime.test.ts` | **48 checks**, including the launch-time end-to-end the review asked for. |
| `src/mission/a2aServer.ts` | now accepts a bind port (the signed card advertises an interface URL, so the listener has to be on it) and reports its real host in `baseUrl`. |
| `src/mission/harborTeams.ts` | `receiverRiskVerdict()` — the receiver re-classifies an inbound task with its own §10 table and takes the worse of that and the sender's claim. A sender's `"safe"` is a claim, not a clearance. Every settled record carries the verdict as `receiverPolicy`. |

What `probe/a2aRuntime` actually runs:

1. **§1** a runtime mounts: the signed card is served over real HTTP, passes the
   strict v1.0.0 validator, its JWS verifies against the harbor's own key, and a
   request without the bearer token never reaches a task.
2. **§2** the shipped launcher runs the shipped engine: `tools/vh-host-engine.mjs`
   is byte-identical to a rebuild of `tools/vh-host.entry.ts` and matches its
   committed sha256; a one-byte-flipped copy makes the launcher exit 2.
3. **§3** **two independently running VH processes.** The receiver mounts and
   publishes its JWK; a stranger discovers the card over HTTP and verifies its
   signature; the sender process delegates; the receiver process runs a real
   TeamExecutor mission (2 seats, cross-vendor gate PASS, real worktree, the
   repo's own test as the verdict) and returns a sealed `vh-proof-receipt/2`
   that verifies in the sender's process **and in a third process**
   (`tools/verify-receipt.mjs`, exit 0 with the issuer key pinned out of band,
   exit 3 — integrity valid, issuer UNVERIFIED — without it).
4. **§4** a mounted harbor with no bridge refuses in words: no artifact, no
   execution, no receipt, and the note names the missing capability.
5. **§5** anti-cheat across the wire: a repository whose tests fail comes back
   `refused` with the measured execution attached, never as a completion.
6. **§6** the receiver's own risk table overrules a sender: `git push --force …
   to production` declared `"safe"` is classified CRITICAL, upgraded to risky and
   **denied at a headless gate** — nothing executes — while genuinely read-only
   work stays safe. A sender that declares `"risky"` is never talked down.

Honesty notes for this section:

- **The drill seat is not a model.** §3/§5 run with `--seat-mode drill` because no
  agent CLI is installed on this build host: a real child process, a real
  worktree, a real git repo, the repository's own test as the verdict — and a
  deterministic brain. It is labelled in `describe()`, in the process log and in
  every artifact. The default `--seat-mode real` refuses instead of substituting.
- **A mounted harbor always enforces a bearer token.** Omit `--token` and one is
  minted and reported. The card advertises `harborIdentity`; a card that claims a
  scheme the listener does not enforce refuses everything, so "no auth" is not an
  option the mount offers.
- **The Warrant harbour process is not yet in the same boot.** `npm run host`
  mounts the A2A listener with the receiver ladder, the GuardRail and the
  receiver's own risk policy; it does not spawn
  `protocol/src/server/harbor.js` alongside it or consult that harbour's grant
  ledger before accepting a delegation. Authority on this door is: JWS-verified
  card identity + bearer token + receiver policy + human gate. Wiring the
  protocol harbour's grant check into the receiver gate is the next seam.

## What this archive does not prove

- **The Rust crate was not compiled.** `cargo check` / `cargo test` / `clippy` were
  not run for this record. `src-tauri/Cargo.lock` was updated by hand to keep the
  `vouchharbor` package version consistent with `Cargo.toml`; regenerate it with
  cargo on a host that has the toolchain.
- **No native build.** `npm run tauri:build` was not run.
- **The drill's seats are deterministic built-ins, not a model.** The suite's own
  `scope` string says so: it validates the runtime, governance and verification
  machinery — not frontier-model intelligence. No mission in this record was
  executed by a live model.
- **Still no native brain.** 23 of 25 harnesses are external CLIs; the in-process
  `hermes` seat routes to Ollama at `127.0.0.1:11434`.

## Reproducing

`node_modules/` and `protocol/node_modules/` are not shipped. Two installs:

```bash
npm ci                              # app toolchain
cd protocol && npm ci && cd ..      # protocol gate + attack harnesses
```

Then every command in the tables above runs unchanged. `dist/` is also not
shipped; regenerate it with `npx vite build`.

**One environment note, learned the hard way.** `probe/offlinePack` rebuilds all
106 bundles into a temp directory and byte-compares them against the shipped
pack. On a host where the temp filesystem is small, that rebuild fails with
`no space left on device` and the suite reports a false drift across every
bundle after the failure point. It is an environment failure, not a code
failure — but it looks like one. Give `$TMPDIR` at least ~700 MB free. With
space available the suite reports **17 passed, 0 failed**, including
*every shipped bundle is BYTE-IDENTICAL to a fresh rebuild (106 bundles)*.
