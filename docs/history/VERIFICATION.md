# Verifying a Vouch Harbor release

Vouch Harbor ships its verification with it. There are two tiers — use the
deepest one your environment allows.

## Tier 1 — offline, zero install (any machine with Node.js)

From the extracted release tree:

```
node verify/run.mjs
```

This executes **96** pre-bundled probe suites as self-contained `.mjs` files —
no `npm ci`, no network, no `node_modules`. Expected tail:

```
OFFLINE VERIFY SUMMARY: 96 passed, 0 failed.
```

~2.5 minutes on a typical laptop. The bundles are byte-pinned:
`verify/MANIFEST.json` carries a sha256 per bundle, and in a dev environment
the `offlinePack` suite fails the gate if a fresh rebuild is not byte-identical
to the shipped pack.

## Tier 2 — full toolchain (where `npm ci` works)

```
npm ci
npm run typecheck     # tsc --noEmit, exit 0
npm test              # 99 probe suites (98 bundled + the offline-pack freshness gate)
npm run build         # vite production build, exit 0
```

`tsc --noEmit` and `vite build` need the dev dependencies (React types, the
Tauri API surface) — that is exactly why Tier 1 exists: the runtime gate does
not.

## What each tier proves

| Claim | Tier 1 | Tier 2 |
|---|---|---|
| The 98 bundled probe suites pass (incl. Patina shell, version drift, production stack, brain seam, merge, MCP router, meridian, palette, navAlign, theme, preflight, buttonActions) | ✔ | ✔ |
| The offline pack is byte-fresh (rebuild == shipped) | pinned by MANIFEST | ✔ (offlinePack suite) |
| TypeScript compiles clean (0 errors) | — | ✔ |
| Production web build succeeds | — | ✔ |

## Gate history (landmark suite additions)

- **patinaShell** (17.1, 36/36) — the five-dock shell (Harbor · Ship · Chart ·
  Register · Harbor Master) with the Helm as single command surface; primary
  buttons wired to domain primitives; the four Patina differentiator panels
  (Delegation Chain / Ghost Sweep / Backtest Drill / Hindsight Ledger); Helm
  drives the real sendVouchMessage path.
- **versionDrift** (17.1.4, 41/41) — every manifest names the same release;
  operational-doc titles are patch-aware; BUILD-INFO.txt and MANIFEST.json
  agree with `src/version.ts`.
- **productionStack** (16.10.0 → 17.1.4, 7/7) — universal providers, durable
  missions, never-give-up constraints, triggers, skill store, receipted
  browser, KV-adapter boundary.
- **brainSeam** (16.9.7 → 17.1.4, 2/2) — the native-boundary fix: bare
  provider IDs ride the wire, the Rust allowlist stays the single authority,
  the web edition refuses host-cannot-spawn in words before any spawn.
- **merge** (16.0 → 17.1.4, 5/5) — one mission ID, one chain, one state;
  Patina mounts the Harbor view and the Helm drives Vouch.
- **mcpRouter** (16.5 → 17.1.4, 22/22) — 20 governed MCP tools, byte-pinned
  engine bundle (`tools/mcp-engine.mjs`), initialize/system_info/tool-list
  contract.
- **navAlign / palette / theme / preflight / meridian** (17.1.4, rewritten)
  — Patina five-dock IA, label-first fuzzy palette, atelier verdigris palette,
  simulate+RISKY_TOOLS gate pipeline, Harbor Master Sweep/Backtest/Lineage
  plus Register Hindsight Ledger.

*(Legacy 16.10.2 measurement (96/96 live, 95/95 offline): 17.1.4 adds
patinaShell and the Patina IA rewrites, bringing the totals to 99/98.)*

## Provenance

`verify/BUILD-INFO.txt` records the exact release identity, toolchain and
verbatim gate output this pack was built and certified with.

## Why this exists

A release archive ships without `node_modules`; `npm ci` needs the network and
a bare `tsc` dies on missing React types before producing a usable exit code.
Since 11.7.1 the gate itself is a shipped artifact, so "the tests pass" is
something a reviewer can execute, not a claim.

