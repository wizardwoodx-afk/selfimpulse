import { composeNodePrompt } from "../domain/composer";
import { defaultHarness, HARNESS_BY_ID, isCustomHarness, isRetiredHarness, type HarnessId } from "../domain/harness";
import type { NodeInstance } from "../domain/types";

export interface HarnessRunResult {
  text: string;
  via: string;
  /** A built-in HarnessId, or a `custom:<slug>` user-registered harness. */
  harness: string;
  code: number | null;
}

/**
 * CREW-SEAT harness resolver.
 *
 * Crew agents (workflow-graph nodes / AGENT 01..N) always run natively on
 * the owner's provider keys through the in-process Hermes loop — that is
 * what "the crew is internal" means. If a saved graph's seat config names
 * a vendor CLI id (claude/codex/opencode/...) or a user-registered custom
 * harness, that reference is silently redirected back to the default
 * native runtime, so old graphs keep running without spawning any binary.
 *
 * Vendor CLIs and user-registered binaries ARE still invokable in the
 * product — but only as bounded mission sub-task harnesses, through
 * src/mission/harnessAdapters.ts (CliHarness / CustomCliHarness / ACP),
 * under the mission boundary.codingAgents gate, inside a selected
 * workspace directory. They are tools, not crew members.
 */
export function harnessOf(node: NodeInstance): string {
  const raw = String(node.config.harness ?? node.providers[0]?.cliProviderId ?? defaultHarness());
  // Crew seats run native: redirect vendor CLI ids and custom harnesses.
  // isRetiredHarness is re-exported for probes that pin the contract by name;
  // CREW_NATIVE_ONLY is the live set and isRetiredHarness is its accessor.
  if (isRetiredHarness(raw)) return defaultHarness();
  if (isCustomHarness(raw)) return defaultHarness();
  if (HARNESS_BY_ID.has(raw as HarnessId)) return raw;
  return defaultHarness();
}

/**
 * Refusal shown when code tries to call runHarnessAgent — i.e. to spawn a
 * binary AS a crew seat. The crew runs through the native agent loop;
 * external binaries live behind the mission harness layer.
 */
const CREW_REFUSAL =
  "Crew agents run natively on your own provider keys — SelfImpulse does not " +
  "spawn an external binary as a crew member. To hand a bounded coding " +
  "sub-task to Claude Code, Codex, or another installed CLI, open a " +
  "mission in a real workspace and enable coding agents in the mission " +
  "boundary — the Captain will elect an installed CLI through the harness " +
  "arbitration layer, with argv visible before execution and the result " +
  "captured onto the receipt. Nothing was executed.";

/** Crew-seat execution is always native; this path refuses to spawn. */
export async function runHarnessAgent(
  node: NodeInstance,
  _collected: Record<string, unknown>,
  _composed: ReturnType<typeof composeNodePrompt>,
  _cwd?: string,
): Promise<HarnessRunResult> {
  void node;
  throw new Error(CREW_REFUSAL);
}
