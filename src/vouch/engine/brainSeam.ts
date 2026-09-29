/**
 * VH 16.9.7 — THE REAL-MODEL PLANNING SEAM (async, host-aware).
 *
 * LANGUAGE PRECISION (16.9.5 review, adopted): this is a real-model PLANNING
 * seam, not a fully real-model brain — route, recall, act, gate and learn
 * remain the governed runtime's; the real model proposes the PLAN. The honest
 * next milestone: real model → full Vouch reasoning/context → governed tool
 * selection → mission execution → proof → verified learning.
 *
 * HOST AWARENESS (16.9.6 review — the production fix): the 16.9.5/16.9.6 seam
 * spawned via node:child_process, which the web bundle aliases to an honest
 * stub — so a shipped "Claude exited 1" could mean the CLI NEVER RAN. That was
 * a false failure report: exactly what this product exists to prevent. The
 * seam now routes by host, through the boundaries that already exist:
 *
 *   Tauri (native)  →  ipc.cliInvoke → the Rust allowlist → real process
 *   Browser (web)   →  REFUSED IN WORDS before any spawn is attempted —
 *                      never the stub, never a fabricated exit code
 *   Probes / tests  →  dependency-injected invoke (the real end-to-end test
 *                      drives a REAL process: node itself)
 *
 * The seam is ASYNC: a real model can take a minute; blocking the chat's
 * event loop was unacceptable. VouchBrain.decide now admits a Promise, and
 * the governed pipeline awaits it — everything downstream (simulation, the
 * human gate, receipts, learning) is unchanged.
 *
 * Refusal taxonomy (all in words, never faked): unknown harness · not
 * installed · host cannot spawn (web) · non-zero exit · timeout · empty
 * answer. No silent fallback — a refusal keeps the labeled simulated plan
 * and the refusal is visible in the plan's thoughts.
 */
import fs from "node:fs";
import { HARNESS_BY_ID, type HarnessId } from "../../domain/harness";
import { ipc, useTauri } from "../../ipc/client";
import type { VouchBrain, VouchPlan } from "./vouch";

export type BrainPref = "simulated" | "auto";
const PREF_KEY = "vh.brain.pref";

export function brainPref(): BrainPref {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PREF_KEY) : null;
    return raw === "auto" ? "auto" : "simulated"; // OFF by default — a human turns it on
  } catch {
    return "simulated";
  }
}

export function setBrainPref(p: BrainPref): void {
  try {
    localStorage.setItem(PREF_KEY, p === "auto" ? "auto" : "simulated");
  } catch {
    /* non-persistent host: the pref is session-only, stated by the UI */
  }
}

export interface BrainInvokeSpec {
  name: string;
  bin: string;
  /** The argv TEMPLATE after the binary; $PROMPT is substituted per call. */
  argv: string[];
}

export interface BrainInvokeResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Thrown by hosts that cannot spawn: the caller refuses in words — never a fake exit code. */
export class BrainHostError extends Error {}

export interface BrainInvokeDeps {
  /** Registry + install detection. Null = unknown harness. bin null = known but absent. */
  resolve: (harnessId: string) => { name: string; bin: string | null; argv: string[] } | null;
  /** The host boundary: IPC (Tauri), injected spawn (probes), or a BrainHostError (web). */
  invoke: (bin: string, argv: string[], timeoutSecs: number) => Promise<BrainInvokeResult>;
}

/**
 * Registry + install detection: mirrors drill.findHarnessBin (PATH walk,
 * win32-aware) and returns the harness's argv template. NOTE: this module
 * deliberately does NOT import ./drill — the vouch→brainSeam→drill→vouch
 * edge would create a module-init cycle; the docstrings in both files name
 * each other as the pair.
 */
export function resolveBrainHarness(harnessId: string): { name: string; bin: string | null; argv: string[] } | null {
  const spec = HARNESS_BY_ID.get(harnessId as HarnessId);
  if (!spec) return null;
  const path = (typeof process !== "undefined" && process.env?.PATH) ? process.env.PATH : "";
  const dirs = path ? path.split(process.platform === "win32" ? ";" : ":") : [];
  const exts = process.platform === "win32" ? ["", ".cmd", ".exe"] : [""];
  for (const bin of spec.bins) {
    for (const dir of dirs) {
      for (const ext of exts) {
        const candidate = dir ? `${dir}/${bin}${ext}` : `${bin}${ext}`;
        try {
          fs.accessSync(candidate, fs.constants.X_OK);
          return { name: spec.name, bin: candidate, argv: spec.argv };
        } catch {
          /* keep walking */
        }
      }
    }
  }
  return { name: spec.name, bin: null, argv: spec.argv };
}


/**
 * THE WIRE IDENTITY (16.10.0 — the 16.9.7 review fix): the IPC first argument
 * is the BARE allowlisted provider id ("claude"), never the TS-resolved
 * absolute path. The Rust gate matches ALLOWED_CLI_BINS against exact names
 * and THEN resolves the binary itself (which_bin: PATH + login-shell paths —
 * resolution is the server's job, never the webview's). 16.9.7 sent the
 * resolved absolute path, so the production gate refused a perfectly
 * installed harness ("/usr/local/bin/claude" ≠ "claude") — a mismatch the
 * DI probe could not see because its injected invoke never crossed IPC.
 */
export function bareProviderId(bin: string): string {
  const parts = bin.split(/[\\/]/);
  return (parts[parts.length - 1] ?? bin).replace(/\.(exe|cmd|bat)$/i, "");
}

/**
 * THE PRODUCTION INVOKE — host-aware, async:
 *   Tauri  → the existing governed IPC boundary (ipc.cliInvoke → Rust allowlist),
 *            the same route the mission loop's hostDeps uses; argv is passed
 *            explicitly so the risk→sandbox mapping stays in one typed place.
 *            The wire identity is bareProviderId(bin) — see the docstring above.
 *   Web    → BrainHostError: the web edition cannot spawn processes and says so —
 *            node:child_process is stubbed in this bundle and is never touched.
 */
export const realBrainInvoke = async (bin: string, argv: string[], timeoutSecs: number): Promise<BrainInvokeResult> => {
  if (useTauri()) {
    const r = (await ipc.cliInvoke(bareProviderId(bin), argv.join(" "), undefined, timeoutSecs, argv)) as {
      stdout?: string; stderr?: string; code?: number | null;
    };
    return { exitCode: r.code ?? (r.stdout != null ? 0 : 1), stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? ""), timedOut: false };
  }
  throw new BrainHostError(
    "this host cannot spawn processes — the web edition refuses in words rather than touching the child_process stub; the native desktop build runs real models through the governed IPC boundary.",
  );
};

export const realBrainDeps: BrainInvokeDeps = {
  resolve: (harnessId) => resolveBrainHarness(harnessId),
  invoke: realBrainInvoke,
};

export type BrainModelResult =
  | { ok: true; text: string; harness: { id: string; name: string }; durationMs: number }
  | { ok: false; refused: string };

/**
 * Run one real-model prompt through a harness. ASYNC. Refuses in words when
 * the harness is unknown, not installed, the host cannot spawn, the CLI
 * fails, times out, or answers empty — never a fake run, never a fabricated
 * exit code.
 */
export async function runModelPrompt(
  prompt: string,
  harnessId: string,
  deps: BrainInvokeDeps = realBrainDeps,
  timeoutSecs = 90,
): Promise<BrainModelResult> {
  const resolved = deps.resolve(harnessId);
  if (!resolved) return { ok: false, refused: `real-model brain refused in words: unknown harness "${harnessId}" — the seam never fakes a real-model run.` };
  if (!resolved.bin) return { ok: false, refused: `real-model brain refused in words: ${resolved.name} (${harnessId}) is not installed on this host — the seam never fakes a real-model run.` };
  const argv = resolved.argv.map((a) => a.replace("$PROMPT", prompt));
  const t0 = Date.now();
  let r: BrainInvokeResult;
  try {
    r = await deps.invoke(resolved.bin, argv, timeoutSecs);
  } catch (e) {
    const msg = e instanceof BrainHostError ? e.message : String((e as Error)?.message ?? e);
    return { ok: false, refused: `real-model brain refused in words: ${msg} — no fake run is manufactured to fill the gap.` };
  }
  const durationMs = Date.now() - t0;
  if (r.timedOut) return { ok: false, refused: `real-model brain refused in words: ${resolved.name} timed out after ${timeoutSecs}s — no partial answer is claimed.` };
  if (r.exitCode !== 0) return { ok: false, refused: `real-model brain refused in words: ${resolved.name} exited ${r.exitCode} — the error is reported, not masked.` };
  const text = r.stdout.trim();
  if (!text) return { ok: false, refused: `real-model brain refused in words: ${resolved.name} returned an empty answer — nothing is invented to fill it.` };
  return { ok: true, text, harness: { id: harnessId, name: resolved.name }, durationMs };
}

/** Parse a model answer into plan steps: lines, bullets stripped, bounded. */
export function planFromModelText(text: string, max = 6): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 3)
    .slice(0, max);
}

/** The planner prompt: the model proposes; the runtime still governs. */
export function plannerPrompt(objective: string): string {
  return [
    "You are the planner inside SelfImpulse's governed brain. Produce 3 to 6 concrete steps for the objective below.",
    "One step per line. No preamble, no markdown. The runtime simulates risky steps and pauses them at a human gate — propose honestly.",
    `Objective: ${objective}`,
  ].join("\n");
}

export async function brainModelRun(
  objective: string,
  deps: BrainInvokeDeps = realBrainDeps,
): Promise<BrainModelResult> {
  const prefOrder = ["gemini", "claude", "codex", "grok", "copilot", "opencode", "cursor", "amp", "llm", "hermes"];
  let lastRefusal = "real-model brain refused in words: no harness from the registry is installed on this host — the seam never fakes a real-model run.";
  for (const id of prefOrder) {
    const r = await runModelPrompt(plannerPrompt(objective), id, deps);
    if (r.ok) return r;
    lastRefusal = r.refused;
    if (r.refused.includes("unknown harness")) continue;
    if (!r.refused.includes("not installed")) return r; // installed but failed/host-refused: report, don't sweep
  }
  return { ok: false, refused: lastRefusal };
}

/**
 * Wrap a brain so the PLAN step can ride a real model when (and only when)
 * the human preference says so. ASYNC: decide may await the model. Refusals
 * keep the labeled simulated plan and add the refusal in words. IDENTITY IS
 * TRUTHFUL: live getters — the product cannot say "Brain: Simulated" in one
 * surface while a thought says "REAL model — Claude".
 */
export function wrapRealModelBrain(base: VouchBrain, deps: BrainInvokeDeps = realBrainDeps, prefOverride?: BrainPref): VouchBrain {
  return {
    get id() {
      return (prefOverride ?? brainPref()) === "auto" ? "simulated+real-plan" : base.id;
    },
    get label() {
      return (prefOverride ?? brainPref()) === "auto"
        ? "Simulated core + real-model planning (auto) — the real CLI proposes the plan; refusals are in words, never faked"
        : base.label;
    },
    async decide(input: string, ctx: Parameters<VouchBrain["decide"]>[1]): Promise<VouchPlan> {
      const plan = await base.decide(input, ctx);
      const pref = prefOverride ?? brainPref();
      if (pref !== "auto") return plan; // OFF by default — a human turned nothing on
      const r = await brainModelRun(input.slice(0, 400), deps);
      if (!r.ok) {
        return {
          ...plan,
          thoughts: [`real-model seam: ${r.refused}`, ...plan.thoughts],
          plan: [`(simulated brain retained — labeled) ${plan.plan[0] ?? "proceed under the governed loop"}`, ...plan.plan.slice(1)],
        };
      }
      const steps = planFromModelText(r.text);
      return {
        ...plan,
        thoughts: [
          `brain: REAL model — ${r.harness.name} (${r.harness.id}) answered in ${r.durationMs}ms · labeled, this run · still gated by the same human gate`,
          ...plan.thoughts,
        ],
        plan: steps.length > 0 ? steps : plan.plan,
        confidence: steps.length > 0 ? "medium" : plan.confidence, // a real model's plan is evidence, not certainty
      };
    },
  };
}
