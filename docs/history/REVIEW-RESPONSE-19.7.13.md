# Response to the sixth external review — release hygiene, 19.7.13

**Reviewed build:** `Velvet Hand (engine 19.7.12)`, the rebrand tree at `d1b38b7`
**This build:** `Velvet Hand (engine 19.7.13 "Keyholder")` — pushed as `2edaaa8`
**Verification record below was produced on node 20.20.2, clean install.**

The review's verdict was accepted in full: three release-management issues and one
documentation overstatement, all "not runtime architecture failures." All four are
closed here. Nothing in the review's "what I'd keep" list was touched — the engine's
behaviour, the gate, the receipts, the authority model and the identity split are as
they were; this release moves identity, docs, one probe, one new door and three
performance paths.

---

## Item 1 — the tree carried 19.7.13-era changes while calling itself 19.7.12

**Verdict: correct, and the largest issue. Fixed by bumping.**

The review's diagnosis was exact: `src/persist/quotaSafe.ts`, `src/mission/durable.ts`,
`src/vh19/memoryGraph.ts` and `src/graph/checkpoints.ts` described real behavioural
change while `package.json`, `src/version.ts`, `BUILD-INFO` and `MANIFEST` all said
19.7.12.

The bump was driven by the tree's own tool rather than edited by hand, so every
identity site moved together or none did:

```
node tools/bump-version.mjs --from 19.7.12 --to 19.7.13 --name Keyholder --check
  would update src/version.ts
  would update package.json
  would update package-lock.json
  would update src-tauri/Cargo.toml
  would update src-tauri/tauri.conf.json
  would update verify/BUILD-INFO.txt
  would update src/vh19/reachMcp.ts
  7 file(s) to change
```

**Proof it took everywhere:**

```
grep -n VH_VERSION src/version.ts        →  export const VH_VERSION = "19.7.13";
grep '"version"' package.json            →  "version": "19.7.13"
node tools/run-one-probe.mjs versionDrift →  43/43
```

The `versionDrift` suite is the one that matters here: it is the gate that would have
caught this class in the first place, and it is the gate the review should re-run to
confirm the seven sites agree.

---

## Item 2 — `BUILD-INFO.txt` contradicted itself (156/155 vs 155/154)

**Verdict: correct. The stale line was the 156/155 one. Corrected to the measured counts.**

Counting the tree rather than trusting either line:

```
node -e "import('./tools/probe-list.mjs').then(m=>console.log(m.listProbeSuites('probe').length))"
  →  155
ls verify/suites/*.mjs | wc -l
  →  154
```

155 live probe suites, 154 offline bundles — the body of the file was right and its
header was three series stale. The header now reads:

```
gate set (tsc / unit / 155 probe suites / 154 offline bundles / vite)
```

**Proof the pack agrees with its own manifest:**

```bash
node -e "const m=require('./verify/MANIFEST.json'),c=require('crypto'),f=require('fs');
console.log(Object.entries(m.suites).filter(([n,h])=>
  c.createHash('sha256').update(f.readFileSync('verify/suites/'+n)).digest('hex')!==h).length)"
  →  0        # 154 bundles, 0 hash mismatches
```

---

## Item 3 — build instructions said Node 20+

**Verdict: correct. Both files now state the real floor.**

`package.json` declares `engines.node >= 22.12.0`. Two documents disagreed with it:

| File | Was | Now |
|---|---|---|
| `BUILD-NATIVE.md` | `node --version  # 20 or newer` | `# 22.12 or newer (package.json engines floor)` |
| `INSTALL-ON-LAPTOP.md` | `**Node.js 20+** … v20 or newer` | `**Node.js 22.12+** … v22.12 or newer` |

**Observation from this build's own verification:** the whole gate (tsc, 155 suites,
154 offline bundles, vite) passes on **node 20.20.2** as well, with `EBADENGINE`
warnings and no failures. That is a fact about the code, not a licence to declare 20
supported — the declared floor is 22.12 and the docs now say so.

---

## Item 4 — README said "Memory is encrypted"

**Verdict: correct — an overstatement of what the code does.**

The implementation has never promised this: `graphSecurityStatus()` reports
`plaintext | sealed | locked`, and with no vault the graph persists as plaintext and
says so in words. The README sentence now matches the code:

> Memory can be encrypted at rest with the local vault, and can be switched off.

`FEATURES.md` was already accurate and was not changed.

---

## What this build adds around the review

**Docs door (`src/ui/screens/Docs.tsx`).** The engine could always distill a document
into an approved knowledge skill — `mission/knowledgeSkills.ts` has implemented
propose → human decision → installed skills for some time — but **no surface reached
it**, so a real capability was unreachable. The shell is now six doors: Steward · Work
· Receipts · **Docs** · Memory · Settings. The door refuses a document with no
extractable structure *in words*, installs nothing on its own, and discloses whether
content stayed on the machine or went to the provider.

**A vacuous gate, found and repaired while adding it.** `probe/navAlign` asserted
"exactly five doors" while its regex matched only those five keys — so a *sixth* door
would have passed the check while the shell no longer matched its own description. It
now pins six doors, that every listed door is rendered, and that the Docs door reaches
the proposal seam. This is the same failure class as the `docIdentity` regex that was
hardcoded to major 16 and matched nothing; it is worth a sweep of the other
count-and-list pins.

**Performance.** The 3D graph's force simulation never stopped (the library keeps
ticking after convergence), so an open Memory door held a CPU core indefinitely;
`warmupTicks` / `cooldownTicks` / `cooldownTime` now stop it once still, with
`d3ReheatSimulation()` on data change so newly arrived nodes still relax, and the graph
honours `prefers-reduced-motion`. Recall lowercased the whole transcript once per
(probe × session) — 30–60 passes per query — and now lowers once per session and checks
the keyword set first.

**Deliberately not done:** `rendererConfig` (discrete-GPU hint at construction) was
evaluated and left out — the shipped `ForceGraph3D` types do not declare it and the
renderer is created before any post-construction call could take effect, so it would
have been a cast past the types for an option that may be silently ignored. Three
declared, testable changes beat four where one cannot be verified.

---

## Reproducing this build

The review noted that `npm ci` timed out in their environment, so the zero-install
path is the one to use — it needs node builtins only, no packages:

```bash
unzip VelvetHand-19.7.13-runnable.zip && cd VelvetHand-19.7.13-runnable
sh VERIFY.sh                 # → 154 passed, 0 failed   (zero install)
```

With a working toolchain:

```bash
npx tsc --noEmit             # → 0 errors
node tools/run-all-probes.mjs # → 155 passed, 0 failed
node verify/run.mjs           # → 154 passed, 0 failed
npm run build                 # → clean
```

Produced on node 20.20.2 (below the declared floor, and green anyway). The shipped
`dist/` is the build of this tree: shell 56.6 kB, engine and the lazily-loaded 3D
renderer as their own chunks.

---

## Repository state

`main` is at `2edaaa8` — "19.7.13 (Keyholder) — the Docs door, graph/recall
performance, release hygiene". 100 files changed against `d1b38b7`.

## Blocker 4 — `shellRender` did not cover the Docs door (verification defect)

You called it a verification defect rather than a product-runtime defect, and that
is exactly right: the app rendered Docs; the gate that was supposed to prove it
could not have noticed its absence.

The old assertion pinned a **literal list of five labels** with `.every(...)`. That
is additive-blind in both directions — a sixth door could ship while the gate stayed
green (it did), and any of the five could be deleted from the shell without failing
it. The same literal pattern was present in three probes.

**Fixed, in all three, by deriving the door list from the shell itself:**

| probe | before | after |
| --- | --- | --- |
| `probe/shellRender.test.tsx` | 5 hard-coded labels, Docs not rendered | `shellDoors()` derived from `src/ui/Shell.tsx`, count pinned at 6, Docs imported + rendered + asserted, component map keyed by shell keys |
| `probe/patinaShell.test.ts:72` | `["Steward","Work","Receipts","Memory","Settings"].every(...)` | same derived `shellDoors()`, count pinned, six-key set asserted |
| `probe/navAlign.test.ts` | matched five keys, claimed "exactly five" | six keys, each proven rendered, Docs seam asserted |

A count pin plus a derived list is the fix for the whole class: the set can now only
change deliberately, and the prose can no longer drift from the keys.

### Mutation proof (the part that matters)

A gate that is green is not evidence; a gate that goes **red when you break the
thing it guards** is. So the door was deleted on purpose — the `docs` nav entry and
the `<Docs />` render removed from `src/ui/Shell.tsx` — and the suite re-run:

```
FAIL the shell declares six doors — declared 5: Steward · Work · Receipts · Memory · Settings
FAIL the Docs door is among them
23 passed, 2 failed
```

With the shell restored, the same suite is **26 passed, 0 failed**. The gate now
fails for the exact regression it was written to prevent, which is the property the
old suite never had.

## Note 5 — the distiller is the mechanical path, and now says so on the surface

You are right, and the distinction is now named rather than inferable. The engine
can distill two ways: mechanically (structure read out of the text itself, no model
called, `dataHandling: "local"`) or through an LLM harness (`distiller.kind ===
"llm"`, which reports its harness and endpoint class). This door calls
`proposeKnowledgeSkill` **without** the optional `llm` harness — a harness CLI is a
desktop-host capability and the web build has none.

That posture is defensible for a security product and is now **stated where the
user meets it**: the cold state says extraction is mechanical and that nothing is
summarized or sent anywhere, and each proposal prints a `Distiller —` line naming
mechanical extraction or naming the harness. Wiring the LLM path belongs on the
desktop build, where a harness actually exists.
