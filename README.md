# SelfImpulse

**Your agents, with receipts.**

SelfImpulse is an on-device AI captain. You describe the outcome you want; a
crew of specialist agents does the work on your own machine, under your own
provider key; every action — and every refusal — is signed into a receipt you
can verify later. Built on the **MJ** engine.

---

## What you get

- **Captain** — one calm place to ask. The Captain routes your request to the
  right specialists, executes only when a provider is connected, and answers
  in words when it can't.
- **Work** — watch the crew work as a live 3D mission DAG: you → the Captain →
  agents → tools → receipts. Risky actions pause here for your approval.
- **Specialists** — domain teams (frontend, engineering, healthcare, finance
  and more). The Captain picks ≤3 candidates per mission; execution expands
  to at most twenty-five live seats on the floor (see
  [`docs/design/specialist-routing.md`](docs/design/specialist-routing.md)).
- **Receipts** — a compact ledger of everything that happened, each line
  digest-stamped; export it as a file.
- **Docs** — teach the Captain from your own documents. Paste one or load a
  file; the engine distills its *structure* (procedure, decision rules, failure
  modes) into a knowledge proposal and you approve or dismiss it. It will not
  summarize, it will not install anything on its own, and it tells you whether
  the content stayed on this machine.
- **Memory** — your conversations become a graph you can move through;
  double-click a node to return to that conversation. Memory can be
  encrypted at rest with the local vault, and can be switched off.
- **Settings** — provider, vault, autonomy level, federation with another
  owner, appearance, and the guardrail manifest.

## Principles the code enforces

- **On-device.** Nothing leaves your machine without a signed authority and a
  receipt. No telemetry.
- **Your key, sealed.** Provider keys live in memory for the session, or
  encrypted at rest behind a passphrase vault — never plaintext.
- **The human gate.** Actions above the safe tier stop and ask. Approvals
  *and* refusals are receipted.
- **Honest outcomes.** Without a provider the Captain *plans*; it never
  dresses a plan as an execution. Live-data claims are fetched and checked
  before they are called verified.
- **Bounded autonomy.** Above "Off", a heartbeat lets the Captain act on its
  own inside hard caps, through the same engine path as a typed message, with
  a circuit breaker on failure.
- **The crew is internal.** Crew agents (AGENT 01, 02…) run natively on your
  own provider keys through one audited runtime — no third-party binary
  sits in the crew trust chain. Installed coding CLIs (Claude Code, Codex,
  OpenCode, ACP agents, any `custom:` binary you register) are invokable as
  bounded mission sub-task harnesses inside a selected workspace directory
  when the mission boundary allows it; they are tools, not crew, and every
  invocation is shown before execution and captured onto a receipt.

The full list of what the product physically cannot do is in
**Settings → About → Guardrail manifest**, and every line is pinned by a test.

## Run it

Requires Node 22.12 or newer.

```bash
npm install
npm run dev          # web app on http://localhost:5173
npm run build        # production build → dist/
```

Desktop builds (Tauri) are described in [`docs/setup/DESKTOP-NATIVE.md`](docs/setup/DESKTOP-NATIVE.md)
and [`docs/setup/BUILD-NATIVE.md`](docs/setup/BUILD-NATIVE.md). Laptop install notes are in
[`docs/setup/INSTALL-ON-LAPTOP.md`](docs/setup/INSTALL-ON-LAPTOP.md); hosted preview in
[`docs/setup/DEPLOY-VERCEL.md`](docs/setup/DEPLOY-VERCEL.md).

## Verify it yourself

Every claim above is a probe you can run.

```bash
npx tsc --noEmit                  # types
node tools/run-all-probes.mjs     # the full dev gate
node verify/run.mjs               # the offline pack — no install, node builtins only
sh scripts/verify.sh             # the same, from a clean unzip
```

The runners report their own suite counts; do not take this file's word for
it. The verification record for this build is in
[docs/history/releases/RELEASE-VERIFICATION.md](docs/history/releases/RELEASE-VERIFICATION.md).

## The engine

SelfImpulse is the product. **MJ** is the engine underneath: the
specialist registry and routing, the human gate, the receipt chain, the
memory graph, the vault, federation between owners, and the self-improvement
loop with its external verifier. The engine keeps its own build identity in
`src/version.ts` for manifests and receipts; the product never shows a
version number.

Engine documentation, design notes and the complete release history live in
[docs/](docs/README.md) and [docs/history/](docs/history/).

## Layout

```
src/ui/          the product — Shell, screens, store, one stylesheet (vh.css)
src/brand.ts     the product's name and tagline (one source of truth)
src/vh19/        the engine — routing, gate, receipts, memory, vault, federation, RSI
src/mission/     custody, egress, capability and privacy guards
src/vouch/       the vouch engine, drills and harness seams
probe/           the test suites (every guarantee above has one)
verify/          the zero-dependency offline pack
tools/           builders: MCP engine, host engine, offline pack, version bump
src-tauri/       the desktop shell
```

## License

Copyright © 2024–2026 K.S. / SelfImpulse. All rights reserved.
Third-party notices: [`docs/legal/THIRD-PARTY-NOTICES.md`](docs/legal/THIRD-PARTY-NOTICES.md).

## Security

See [`SECURITY.md`](SECURITY.md) for the disclosure policy and what is (and
is not) in scope. The short version: IPC handlers enforce what TypeScript
policy promises, egress and SSRF guards live on the fetch path, and child
processes spawn through a scrubbed environment inside workspace-root
containment.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). The three bars are `tsc`, `npm
test`, and `node verify/run.mjs` — all green, every commit. CI runs them on
every PR via `.github/workflows/gate.yml`.
