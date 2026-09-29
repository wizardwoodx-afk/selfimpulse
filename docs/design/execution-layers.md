# Execution layers — crew, harnesses, and tools

SelfImpulse runs three distinct execution layers. They are separated on purpose
and receipts record which layer ran each step. Conflating them is how
"internal crew" and "external CLI" become a contradiction; this note
exists to pin the distinction.

## Layer 1 — the native runtime (provider keys, in-process)

**What it is.** The Hermes-class agent loop (`src/engine/hermesRuntime.ts`)
running in-process against the owner's own provider keys (OpenAI /
Anthropic / Gemini / local Ollama). Tools, browser, MCP, memory, and the
receipt chain are all wired through the same tool catalog.

**Who uses it.** Every crew agent — `AGENT 01..N` on the Work floor — runs
here. So does the Captain for conversational turns that don't need a
sub-process.

**Trust model.** One audited runtime, one receipt format. No third-party
binary is in the trust chain between the provider API call and the
receipt. This is the layer "the crew is internal" refers to.

If a saved workflow graph pins a crew seat to a vendor-CLI harness id
(which older graphs did), `harnessOf()` silently redirects it back to the
native default — no binary is spawned, no error dialog, the graph keeps
working.

## Layer 2 — mission sub-task harnesses (bounded sub-process)

**What it is.** An adapter layer (`src/mission/harnessAdapters.ts`) that
can invoke external coding-agent CLIs as tools for ONE bounded coding
sub-task inside a real mission:

- researched vendor CLIs (Claude Code, Codex CLI, OpenCode, Gemini CLI,
  Grok Build, Copilot CLI, Kilo Code, Aider, OpenHands, Goose, Qwen Code,
  Kimi, Auggie, Amp, Crush, Antigravity, Warp Oz, Amazon Q/Kiro, Droid,
  Cursor Agent, Cline, OpenClaude);
- the ACP wire (`src/mission/acp.ts`) — one adapter for any
  ACP-compliant agent;
- a vendored Hermes Agent CLI (if installed);
- user-registered `custom:<slug>` binaries (name + executable + argv
  template containing `$PROMPT` exactly once; validated in
  `validateCustomHarness()` and re-validated in Rust before spawn).

**When it runs.** All four must hold before arbitration will even score a
candidate:

1. a mission has been opened (not a chat turn);
2. the mission has a real workspace root selected (no root → no
   filesystem execution);
3. the mission boundary grants `codingAgents` (default for coding
   missions, off for pure planning / research);
4. the binary is detected on PATH by the Rust side
   (`cli_providers_detect`).

`selectHarness()` in `src/mission/arbitration.ts` scores every eligible
adapter on capability match, language match, historical success on this
repo/task-kind, latency, measured cost, permission fit, and recency. The
Captain never picks a harness by default and never invents a binary that
isn't installed.

argv is composed before execution and shown to the user when the task
risks a gate. Output is captured (stdout/stderr/exit code/latency) onto a
member-agent receipt line, and failures fail closed.

**Trust model.** These are tools — bounded, argv-visible, receipted,
cwd-scoped to the mission workspace root, with the Rust command allowlist
as the final gate. They are NOT crew members. They cannot address
memory, cannot call MCP servers on their own, and cannot schedule further
agents — they return text to the Captain, which is the only thing that
lands in the ledger.

## Layer 3 — the interop CLI (cross-process transport for non-SelfImpulse agents)

**What it is.** `tools/vh-interop.mjs` — a zero-dependency Node script
that lets an external agent that is NOT a SelfImpulse crew member (another
Patina-compatible agent, or a verifier running in a separate process)
submit signed work for admission under the same rulebook.

**When it runs.** Operator-driven. Transport packs carry proof and
identity only, never content. Exit code 1 plus a refusal in words on any
failed proof.

This is a transport / federation seam, not a coding-agent runner. It is
how agents that live OUTSIDE SelfImpulse hand work back IN with a verifiable
chain — the opposite of Layer 2.

## Why the design is this way

- The Captain (Layer 1) is the single conversational surface the user
  trusts. If coding agents were crew members, the user would have to
  track which seat is Claude vs Codex vs a local model — that's a roster,
  not a captain.
- Coding agents are genuinely useful for narrow coding sub-tasks inside a
  workspace, and pretending that SelfImpulse's native loop is always the
  best tool for a refactor is dishonest. The honest place for them is
  behind the same boundary as every other tool: shown before execution,
  gated by the mission's permission set, receipted after.
- The interop CLI is a separate story (federation, not delegation) and
  shares nothing with the harness layer besides "a process is spawned."

## What a receipt tells you

Every receipt line names the layer:

- `runtime=hermes` for Layer 1 (native agent turn);
- `harness=<id>` (e.g. `harness=claude`, `harness=custom:my-script`,
  `harness=acp`) for Layer 2, with argv, cwd, exit code, stdout bytes,
  and latency;
- `entry=interop` for Layer 3 admissions, with the granter fingerprint
  and proof check.

If a receipt ever shows a `harness=` line for a top-level crew step
without a mission workspace, that is a bug — probe it.
