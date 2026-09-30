# Security

SelfImpulse is a desktop agent runtime that can execute real actions on your
machine. Security is not a slogan here — it is the product.

## Reporting a vulnerability

**Do not file a public GitHub issue.** Email security findings to
`security@selfimpulse.dev` (PGP key to be published on the project site).

We will acknowledge within 72 hours and provide a timeline for a fix. We ask
that you give us a reasonable embargo window before public disclosure so
every user has a patched build available.

## What is in scope

- The Tauri/Rust host (`src-tauri/`): IPC handlers, command allowlists,
  process containment (`contain.rs`), the secret store.
- The TypeScript engine (`src/engine/`, `src/mission/`): gates, tool policy,
  SSRF/egress guards, signing, the vault, the receipt chain.
- The verification pack (`verify/`) and probe suite (`probe/`): a bypass
  of a probe that the offline pack does not catch is a vulnerability in the
  proof system itself.
- The receipt protocol: any forgeable digest, unsigned chain, or replay
  against a valid receipt.

## What is *not* a vulnerability

- A refusal in words. SelfImpulse is designed to refuse rather than guess; a
  "I cannot do that" message is working as intended.
- Running on an unsupported engine. SelfImpulse requires Node ≥ 22.12 for dev
  and a supported Tauri WebView for desktop.
- An issue in one of our vendored dependencies that is already fixed at a
  newer pinned version — *do* report it so we can bump; we will credit you.

## Security model in one paragraph

The WebView is untrusted content. Every privileged action (filesystem,
shell, network outbound, MCP, browser control) is gated from TypeScript
policy **and** enforced again in the Rust IPC handler: program allowlists,
`ensure_allowed` workspace-root containment, `contain::wrap_command`
environment scrubbing, and fail-closed defaults. Receipts are Ed25519-signed (the cross-selfimpulse identity curve is
ECDSA P-256; the receipt issuer key is Ed25519), hash-chained, header-bound —
the mission, edition, arms and finish time are inside the signed material — and
verifiable with zero product state.
