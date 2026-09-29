# SelfImpulse 1.0.0 — release notes

## v0.0.4 "Harness" (current)

- **Architectural clarity: three execution layers.** v0.0.3 said "external
  agent CLIs are retired," but the code still shipped a working
  mission-level CliHarness with argv composition, arbitration scoring,
  Rust-side command allowlist and receipt capture. That was a real
  contradiction, not a wording nit. The story now matches the code,
  honestly:
    - **Layer 1 — crew (native):** AGENT 01..N always run on the owner's
      own provider keys through the in-process Hermes loop. No third-party
      binary sits in the crew trust chain. `harnessRunner.runHarnessAgent`
      refuses to spawn for crew seats; `harnessOf()` redirects any saved
      CLI/custom seat id back to native.
    - **Layer 2 — mission sub-task harnesses (bounded tools):** Claude
      Code, Codex CLI, OpenCode, Gemini CLI, Grok Build, ACP agents, user-
      registered `custom:<slug>` binaries, and the other researched coding
      CLIs are invokable as tools for one bounded coding sub-task inside
      a mission with a real workspace root, when `boundary.codingAgents`
      is on. They are scored by `selectHarness()`, argv is composed and
      visible before execution, output is captured onto a receipt line,
      and they cannot address memory or schedule further agents. They
      are tools, not crew.
    - **Layer 3 — interop CLI:** `tools/vh-interop.mjs` for cross-process
      federated admission under the same rulebook (transport-only; no
      content in packs).
- **New architecture doc:** `docs/design/execution-layers.md` pins the
  three layers and what each receipt line tells you. `specialist-routing.md`
  cross-links it.
- **Engine codename:** MJ 19.7.16 "Harness" (was 19.7.15 "Handle"). Bumped
  in `src/version.ts`, `package.json#engine`, `VERSION.txt`,
  `docs/VERSIONING.md`, and `verify/BUILD-INFO.txt`.
- **Refusal text updated** in `src/engine/harnessRunner.ts` to direct the
  user to the mission boundary flag instead of lying that CLIs don't
  exist. `CREW_NATIVE_ONLY` is the named set of ids that must not run as
  crew (previously the opaque `RETIRED_HARNESSES`); `isRetiredHarness()`
  remains as the accessor so old references don't break.
- `harnesses` and `offlinePack` probes updated to reflect the two-layer
  contract and to read the engine version from `src/version.ts` instead
  of hardcoding 19.7.15.
- README "crew is internal" paragraph rewritten to be precise.
- src/App.tsx header comment, src/engine/hermesRuntime.ts,
  src/mission/securityReview.ts "External-agent boundary" entry updated
  to describe the real surface.

Gates at tag: tsc 0 errors, `npm test` 171/0, `node verify/run.mjs` 170/0.

## v0.0.3

- Editorial Minimal UI, GitHub repo hygiene (CI / SECURITY / CONTRIBUTING /
  tightened .gitignore), repo cleaned of PowerShell one-offs and stale
  benchmark JSON, docs organized under docs/{setup,releases,legal,design},
  specialist-routing Top-K=3 vs 25-agent ceiling documented, pdf.js 6.3.

## v0.0.2

- pdf.js CVE remediation, receipt chain hardening, first zip release.

## v0.0.1

- initial archive.
