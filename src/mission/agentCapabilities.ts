/**
 * AGENT CAPABILITIES — what each coding CLI can actually be made to do, and how VH knows.
 *
 * WHY THIS EXISTS AS DATA RATHER THAN CODE
 *
 * Nine CLIs, each with its own vocabulary for the same five ideas: take a prompt, emit JSON, refuse to
 * write, pick a model, resume a conversation. Hardcoding that as branches would scatter nine sets of
 * assumptions across the codebase. As a table, the assumptions are visible, comparable and testable —
 * and, crucially, each one carries the evidence behind it.
 *
 * THE LESSON THIS FILE IS BUILT AROUND
 *
 * A doc-shaped capability table looks identical to a tested one until a real binary disagrees. VH
 * shipped `--max-turns` for Claude Code because documentation described it; the shipped 2.1.197
 * binary has no such flag. It shipped `--dangerously-skip-permissions` for OpenCode, which does not
 * exist there at all. Both were found only by running the executable.
 *
 * 2026-09 postscript: the --max-turns story grew a third act. The current vendor CLI reference
 * documents it for print mode while --help still omits it, so the claude entry is docs-graded
 * with the old scan recorded — and probe §10 now pins registry↔policy agreement on turn flags
 * for every harness. The lesson is unchanged: state the evidence, and keep the layers agreeing.
 *
 * So every entry states its confidence and its source, and `enforcedReadOnly()` is keyed off
 * enforcement rather than off whether a flag merely exists.
 */

import { getCustomHarness, isCustomHarness, type CustomHarnessSpec, type HarnessId } from "../domain/harness";

/**
 * How much weight a claim deserves.
 *
 *   binary     — checked against the shipped executable, by running it. The strongest evidence
 *                available, and the only kind that has ever caught a wrong flag.
 *   docs       — from the vendor's documentation. Usually right, occasionally ahead of the release.
 *   community  — from forum posts, issues and blog reports. Plausible, unconfirmed.
 *   unverified — VH is guessing, or the capability does not exist. Treat as a gap, not a feature.
 */
export type Confidence = "binary" | "docs" | "community" | "unverified";

export interface Capability {
  /** The argv fragment that provides it, or null when the CLI has no such control. */
  argv: string[] | null;
  confidence: Confidence;
  /** Where the claim came from, so it can be re-checked. */
  source: string;
  /**
   * True when the control is the CLI's DEFAULT rather than a flag to pass. Cursor's read-only is
   * exactly this: writes require --force, so plain `-p` cannot modify files. Emitting a flag for it
   * would duplicate the prompt flag — which is what `-p` already is.
   */
  implicit?: boolean;
}

export interface CostReporting {
  kind: "usd" | "tokens-only";
  /** Where the number appears in the output, as a hint for parsing. */
  path?: string;
  confidence: Confidence;
  source: string;
}

export interface AgentCapabilities {
  id: HarnessId;
  name: string;
  /** Candidate executable names, in preference order. */
  bins: string[];
  install: string;
  /** How the prompt is passed. For several CLIs this carries the subcommand, so it must come first. */
  prompt: Capability;
  /** Structured output. `kind` distinguishes a single JSON object from an NDJSON stream. */
  json: (Capability & { kind?: "json" | "ndjson" | "text" }) | null;
  /** Refuse to modify files. */
  readOnly: Capability | null;
  /** Explicitly permit writes. null means the default agent already writes. */
  write: Capability | null;
  /** The escape hatch that disables all permission checks. VH treats this as requiring a human decision. */
  fullAuto: Capability | null;
  /** Cap the agent's internal turn count. */
  maxTurns: Capability | null;
  /** Cap wall-clock time. null means VH enforces its own deadline instead. */
  timeout: Capability | null;
  /** Constrain output to a schema. */
  outputSchema: Capability | null;
  /** Have the CLI create its own worktree. */
  worktree: Capability | null;
  /** Set the working directory. */
  cwd: Capability | null;
  /** Model selection. */
  model: Capability | null;
  /** Resume a previous session. */
  resume: Capability | null;
  /**
   * Start a session under an id VH chose, rather than one the CLI invents.
   *
   * This distinction is not cosmetic. Claude's `--session-id <uuid>` CREATES a conversation under the
   * id you pass. OpenCode's `--session <id>` LOADS an existing one and hard-fails with
   * "Error: Session not found" (exit 1) if it does not exist — observed on the real 1.18.25 binary.
   * Assuming every CLI accepts a chosen id breaks half of them on turn one, before any work is done.
   * Where this is null, VH lets the CLI choose and captures the id from its output.
   */
  sessionStart: Capability | null;
  /** Suppress background update checks — without this a CI run can stall on a prompt. */
  noAutoUpdate: Capability | null;
  /** Per-rule allow/deny filters, e.g. "Bash(git *)". */
  filters: { allowFlag: string; denyFlag: string; confidence: Confidence; source: string } | null;
  /** How to read real cost out of the output. null means the CLI does not report it. */
  cost: CostReporting | null;
  /** True only when a read-only mode is actually ENFORCED by the CLI, not merely advisory. */
  enforcedReadOnly: boolean;
  /** Traps worth stating out loud, each with the evidence behind it. */
  gotchas: string[];
}

export const AGENT_CAPABILITIES: Record<HarnessId, AgentCapabilities> = {
  hermes: {
    id: "hermes",
    name: "Hermes Runtime",
    // 19.7.15: hermes is IN-PROCESS. It has no binary, is not a stdio child,
    // and takes no argv. These two lines used to describe a subprocess that
    // does not exist; every caller that read them was reasoning about a seat
    // that could not run.
    bins: [],
    install: "bundled with 11Handle; runs in-process (src/engine/hermesRuntime.ts) — no binary, no argv",
    prompt: { argv: [], confidence: "docs", source: "in-process runtime: no argv exists by construction" },
    json: null,
    readOnly: null,
    write: null,
    fullAuto: null,
    maxTurns: null,
    timeout: null,
    outputSchema: null,
    worktree: null,
    cwd: null,
    model: null,
    resume: null,
    sessionStart: null,
    noAutoUpdate: null,
    filters: null,
    cost: null,
    enforcedReadOnly: false,
    gotchas: ["No enforced sandbox, so a hermes seat must never be assigned HIGH or CRITICAL risk."],
  },

  llm: {
    id: "llm",
    name: "Direct LLM",
    bins: [],
    install: "no binary; VH calls the provider API directly",
    // In-process API call: there is no command line, and the empty argv says so
    // rather than a fake ["$PROMPT"] that would read as a spawnable command.
    prompt: { argv: [], confidence: "docs", source: "in-process API call: no argv exists by construction" },
    json: null,
    readOnly: null,
    write: null,
    fullAuto: null,
    maxTurns: null,
    timeout: null,
    outputSchema: null,
    worktree: null,
    cwd: null,
    model: null,
    resume: null,
    sessionStart: null,
    noAutoUpdate: null,
    filters: null,
    cost: null,
    enforcedReadOnly: false,
    gotchas: ["No filesystem access and no enforced sandbox. Useful for reasoning, useless for edits."],
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
 * §V11.6.1 — ONE RESOLVER FOR EVERY HARNESS REFERENCE.
 *
 * The 11.6.0 review found the hole this closes: custom ids (`custom:<slug>`) were smuggled
 * through `as HarnessId` casts, and `teamExecutor` looked them up directly in
 * AGENT_CAPABILITIES — which is undefined for them, and the executor dereferenced it.
 * Every consumer now goes through resolveCaps(), which is TOTAL: a builtin entry, a
 * registered custom's synthetic entry, or an honest unregistered-custom entry. It never
 * returns undefined caps, so no execution path can crash on a custom seat again.
 * ───────────────────────────────────────────────────────────────────────────── */

export interface ResolvedHarness {
  caps: AgentCapabilities;
  /** True when the id is a `custom:<slug>` reference. */
  custom: boolean;
  /** False for an unregistered custom (or an unknown id): the seat cannot run. */
  registered: boolean;
}

/** Synthetic capability entry for a REGISTERED custom harness: unknown-by-definition. */
export function syntheticCustomCaps(id: string, spec: CustomHarnessSpec): AgentCapabilities {
  return {
    id: id as HarnessId,
    name: `${spec.name} (custom)`,
    bins: [spec.bin],
    install: "Teams -> Connect -> Custom harnesses",
    prompt: { argv: spec.argv, confidence: "community", source: "user-registered harness — VH verified none of its flags" },
    json: null, readOnly: null, write: null, fullAuto: null, maxTurns: null, timeout: null,
    outputSchema: null, worktree: null, cwd: null, model: null, resume: null, sessionStart: null,
    noAutoUpdate: null, filters: null, cost: null,
    enforcedReadOnly: false,
    gotchas: ["User-registered harness: VH verified none of its flags. Read-only is advisory."],
  } as AgentCapabilities;
}

/** The honest entry for a custom id (or unknown id) with no registered spec. */
function unregisteredCustomCaps(id: string): AgentCapabilities {
  return {
    id: id as HarnessId,
    name: `Custom harness "${id}"`,
    bins: [],
    install: "Teams -> Connect -> Custom harnesses (re-add it, then recompile)",
    prompt: { argv: [], confidence: "unverified", source: "not registered (anymore)" },
    json: null, readOnly: null, write: null, fullAuto: null, maxTurns: null, timeout: null,
    outputSchema: null, worktree: null, cwd: null, model: null, resume: null, sessionStart: null,
    noAutoUpdate: null, filters: null, cost: null,
    enforcedReadOnly: false,
    gotchas: ["This harness is not registered (anymore); it cannot run until re-added in Teams -> Connect."],
  } as AgentCapabilities;
}

/** TOTAL harness resolver — builtin, registered custom, or honest unregistered. Never undefined. */
export function resolveCaps(harness: string): ResolvedHarness {
  if (isCustomHarness(harness)) {
    const spec = getCustomHarness(harness);
    return spec
      ? { caps: syntheticCustomCaps(harness, spec), custom: true, registered: true }
      : { caps: unregisteredCustomCaps(harness), custom: true, registered: false };
  }
  const caps = AGENT_CAPABILITIES[harness as HarnessId];
  return caps
    ? { caps, custom: false, registered: true }
    : { caps: unregisteredCustomCaps(harness), custom: false, registered: false };
}

/** Is read-only actually enforced by the CLI, or only requested?
 *  Custom harnesses (custom:*) are advisory-only by definition: VH did not verify them. */
export function enforcedReadOnly(id: HarnessId | string): boolean {
  const caps = AGENT_CAPABILITIES[id as HarnessId];
  return caps ? caps.enforcedReadOnly : false;
}

/**
 * Claims VH could not verify, surfaced as warnings rather than hidden.
 *
 * A flag that came from a forum post is not the same as one that came from `--help`, and the UI has
 * to be able to say which is which.
 */
export function unverifiedClaims(id: HarnessId | string): string[] {
  const caps = AGENT_CAPABILITIES[id as HarnessId];
  if (!caps) {
    return ["Custom harness: every flag is the user's own — VH verified none of it. Read-only is advisory."];
  }
  const out: string[] = [];
  const check = (name: string, cap: Capability | null) => {
    if (cap?.argv && cap.confidence === "community") {
      out.push(`${name}: ${cap.source}`);
    }
  };
  check("cwd", caps.cwd);
  check("model", caps.model);
  check("resume", caps.resume);
  check("json", caps.json);
  if (!caps.enforcedReadOnly && caps.readOnly?.argv) {
    out.push("read-only is advisory: no enforcement was verified, so this seat can still modify files.");
  }
  return out;
}

/** Which harnesses have had their behaviour checked against a real executable. */
export function binaryVerifiedHarnesses(): HarnessId[] {
  return (Object.keys(AGENT_CAPABILITIES) as HarnessId[]).filter((id) =>
    Object.values(AGENT_CAPABILITIES[id]).some((v) => v && typeof v === "object" && "confidence" in v && (v as { confidence?: Confidence }).confidence === "binary"),
  );
}

/** Harnesses that correspond to an executable CLI binary on disk. */
export const EXECUTABLE_HARNESSES: HarnessId[] = (Object.keys(AGENT_CAPABILITIES) as HarnessId[]).filter(
  (id) => AGENT_CAPABILITIES[id].bins.length > 0,
);

/** True when all claims about this harness come from binary verification or vendor docs with no unverified community claims. */
export function fullyDocumented(id: HarnessId): boolean {
  return unverifiedClaims(id).length === 0;
}

