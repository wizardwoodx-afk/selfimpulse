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
 * 19.7.4 [Crew] — the runner is a label desk now, not a spawner.
 *
 * External agent CLIs are retired: the app executes every agent natively on
 * the owner's own provider keys through the VH agent loop (scheduler →
 * hermesRuntime), so every action carries one audited receipt format.
 *
 * What survives here:
 *   • harnessOf — resolves what a node's config SAYS into what actually
 *     runs: a retired CLI id or a custom harness resolves to the native
 *     runtime, so saved graphs keep running on provider keys with zero
 *     migration step;
 *   • runHarnessAgent — the retirement refusal, for any code path that
 *     still tries to spawn. The refusal states the fix and that nothing
 *     was executed.
 */
export function harnessOf(node: NodeInstance): string {
  const raw = String(node.config.harness ?? node.providers[0]?.cliProviderId ?? defaultHarness());
  if (isRetiredHarness(raw)) return defaultHarness();
  if (isCustomHarness(raw)) return defaultHarness();
  if (HARNESS_BY_ID.has(raw as HarnessId)) return raw;
  return defaultHarness();
}

const RETIRED_REFUSAL =
  "External agent CLIs are retired. SelfImpulse now runs every agent natively on your own provider keys — " +
  "connect a key in the Providers door (OpenAI, Anthropic, Gemini, or local Ollama) and run again. " +
  "Nothing was executed.";

/** The retirement refusal. No binary is spawned, no command is composed. */
export async function runHarnessAgent(
  node: NodeInstance,
  _collected: Record<string, unknown>,
  _composed: ReturnType<typeof composeNodePrompt>,
  _cwd?: string,
): Promise<HarnessRunResult> {
  void node;
  throw new Error(RETIRED_REFUSAL);
}
