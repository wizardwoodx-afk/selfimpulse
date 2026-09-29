/**
 * The engines a seat can run on. There are two, and both run IN-PROCESS on the
 * owner's own provider key:
 *
 *   hermes — the vendored native agent loop (act / observe / adjust)
 *   llm    — the direct provider seam
 *
 * This file used to carry a research catalogue of external coding-agent CLIs —
 * their install lines, their argv, their capability grades. That catalogue was
 * the specification of a feature the product no longer has, left in place as
 * "reference data", and it was the single most misleading thing in the agent
 * layer: the header claimed the app wrapped twenty-odd CLIs that were actually
 * and permanently gone. A reader who trusted the header would have concluded the
 * product spawned third-party agents.
 *
 * The removal is real, and it is recorded where it is enforced rather than in a
 * header that describes a past life: `RETIRED_HARNESSES` below is not a museum
 * piece, it is the deny-list that turns a stale id in a saved graph into a
 * refusal in words instead of a silent no-op. Those names stay for that reason.
 */
export type HarnessId = "hermes" | "llm";

export interface HarnessSpec {
  id: HarnessId;
  name: string;
  /**
   * External binaries this engine needs. ALWAYS EMPTY, and the emptiness is the
   * point: the drill walks this list on PATH and asserts that no engine resolves
   * to a binary, which is how "nothing here spawns a third-party process" is
   * proven mechanically instead of asserted in a comment. A field that could
   * grow back is a field that will.
   */
  bins: string[];
  /** argv template. Also always empty; it survives only because the brain seam
   *  returns it, and it is empty for the same reason `bins` is. */
  argv: string[];
  /** What the operator must do to make this engine usable. Never an install
   *  command for a third-party agent — there are none. */
  install: string;
  notes: string;
  /** Where the behaviour is implemented, so a claim can be re-traced. */
  source?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// EXTERNAL CODING-AGENT CLIs — REMOVED FROM THE TREE.
//
// 19.7.4 marked external agent CLIs "retired" but kept their specs in the file
// as reference data. They were not unreachable: the Rust allowlist still
// carried 22 binaries, `cli_invoke` could still spawn them, ACP could still
// bridge to a claude-code-acp / gemini --experimental-acp process, and a user
// could still register an arbitrary custom harness. A governance product that
// tells an operator a capability is gone while it is live is worse than one
// that never had it.
//
// It is now actually gone. The only engines are the two that run IN-PROCESS on
// the owner's own provider key:
//
//   hermes — the vendored native agent loop (act/observe/adjust)
//   llm    — the direct provider seam
//
// Every id below is refused by name, so a saved graph or a stale config naming
// one fails in words and is routed to `hermes` rather than silently doing
// nothing. Nothing spawns a third-party process any more: no external binary,
// no ACP peer, no custom harness.
// ═════════════════════════════════════════════════════════════════════════════

export const RETIRED_HARNESSES: ReadonlySet<string> = new Set([
  "claude", "codex", "opencode", "openclaude", "copilot", "cursor", "cursor-agent", "grok",
  "cline", "kilo", "aider", "gemini", "antigravity", "amp", "crush", "openhands", "goose",
  "qwen", "amazonq", "droid", "kimi", "auggie", "warp", "acp", "agent",
]);

export function isRetiredHarness(id: string): boolean {
  return RETIRED_HARNESSES.has(id);
}

export const HARNESSES: HarnessSpec[] = [
  {
    id: "hermes",
    name: "Native agent (in-process)",
    bins: [],
    argv: [],
    install: "Nothing to install — the agent loop runs inside 11Handle on your own provider key (or a local Ollama).",
    notes: "The vendored act/observe/adjust loop. Every crew seat runs here, so every action carries one audited receipt format and the trust story has no third party in it.",
    source: "src/engine/hermesRuntime.ts",
  },
  {
    id: "llm",
    name: "Direct LLM (API / Ollama)",
    bins: [],
    argv: [],
    install: "Save a provider key in Settings → Providers, or run Ollama locally",
    notes: "Not an agent loop. Calls the chat API with the composed agent prompt — the direct seam under the native runner.",
  },
];

export const HARNESS_BY_ID = new Map(HARNESSES.map((h) => [h.id, h]));

export function defaultHarness(): HarnessId {
  return "hermes";
}

/** Only native engines are offered: the vendored Hermes runtime, the ACP
 * wire, and the direct LLM seam — all executed on the owner's own keys. */
export const HARNESS_OPTIONS = HARNESSES.filter((h) => !isRetiredHarness(h.id)).map((h) => h.id);

// ═════════════════════════════════════════════════════════════════════════════
// V11.6 — CUSTOM HARNESSES
//
// A custom harness is the user's own binary: a name, an executable, and an argv
// template containing $PROMPT exactly once. It is validated here (TypeScript) and
// re-validated in Rust before cli_invoke will run it — the webview can never make
// the app execute a program the user has not explicitly registered.
// ═════════════════════════════════════════════════════════════════════════════

export interface CustomHarnessSpec {
  /** `custom:<slug>` — the id seats reference. */
  id: string;
  name: string;
  /** The executable to run, as typed (resolved via PATH + the usual install dirs in Rust). */
  bin: string;
  /** argv after the binary; $PROMPT is replaced with the composed prompt. */
  argv: string[];
  /** Free-form note the user writes for themselves. */
  notes: string;
  createdAt: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOM HARNESSES — REMOVED.
//
// A custom harness let a user register an arbitrary binary and an argv template
// containing $PROMPT, and the Rust side would spawn it. That is a text field
// that reaches process execution, on a product whose entire claim is that the
// agent runs under authority it can prove. It is gone: the native handler that
// could execute one is deleted, so registration is refused here rather than
// being a promise nothing enforces.
//
// The names remain exported because 26 modules import them; every one is now a
// refusal or an empty result, and probe/noExternalCli.test.ts pins that.
// ═════════════════════════════════════════════════════════════════════════════

export interface CustomHarnessSpec {
  id: string;
  name: string;
  bin: string;
  argv: string[];
  notes: string;
  createdAt: string;
}

export interface CustomHarnessValidationError {
  field: "name" | "bin" | "argv";
  message: string;
}

export function customHarnessId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return `custom:${slug || "harness"}`;
}

export function validateCustomHarness(_spec: { name: string; bin: string; argv: string[] }): CustomHarnessValidationError[] {
  return [{
    field: "bin",
    message: "Custom harnesses are removed. Every agent runs in-process on your own provider key — add a native seat instead.",
  }];
}

/** Always false: nothing can be a custom harness any more. */
export function isCustomHarness(_id: string): boolean {
  return false;
}

export function setCustomHarnesses(_list: CustomHarnessSpec[]): void {
  /* refused — see the note above */
}

export function getCustomHarness(_id: string): CustomHarnessSpec | undefined {
  return undefined;
}

export function listCustomHarnesses(): CustomHarnessSpec[] {
  return [];
}
