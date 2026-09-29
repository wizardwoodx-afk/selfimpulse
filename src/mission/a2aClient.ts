/**
 * A2A v1.0.0 CLIENT transport (Warrant-Teams).
 *
 * Consumes a remote A2A server the way the spec describes discovery +
 * collaboration:
 *
 *   discoverAgentCard   GET /.well-known/agent-card.json → strict v1.0.0
 *                       validation (legacy-shape cards are refused) and
 *                       optional JWS signature verification
 *   sendMessage         message/send
 *   streamMessage       message/stream (SSE consumption)
 *   getTask / cancelTask / setPushConfig / getPushConfig
 *
 * Guardrails on the way OUT:
 *   • every target URL passes the egress guard (no cloud-metadata, no
 *     link-local, no non-http(s) schemes) before a socket opens;
 *   • a per-root request timeout kills hung transports;
 *   • JSON-RPC errors surface as typed A2AClientError (code + message),
 *     never as silent undefined.
 */
import { recordA2AVerifiedPeer } from "./a2aIdentityBridge";
import { checkEgressUrl } from "../security/guardrail";
import {
  validateAgentCardV10,
  verifyAgentCardV10Signatures,
  WELL_KNOWN_CARD_PATH,
  type AgentCardV10,
  type MessageV10,
  type PushNotificationConfigV10,
  type TaskV10,
} from "./a2aV10";

const TIMEOUT_MS = 10_000;

export class A2AClientError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = "A2AClientError";
  }
}

function guardUrl(root: string): void {
  const g = checkEgressUrl(root);
  if (!g.ok) throw new A2AClientError(-32000, `policy:egress-refused — ${g.reason}`);
}

async function post(root: string, body: unknown, authorization?: string): Promise<Record<string, unknown>> {
  guardUrl(root);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (authorization) headers.authorization = authorization;
    const resp = await fetch(root + "/", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return (await resp.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

let nextRpcId = 1;
async function rpc(root: string, method: string, params: Record<string, unknown>, authorization?: string): Promise<unknown> {
  const env = await post(root, { jsonrpc: "2.0", id: `vh-${nextRpcId++}`, method, params }, authorization);
  if (env.error !== undefined) {
    const e = env.error as { code?: number; message?: string };
    throw new A2AClientError(e.code ?? -32000, e.message ?? "json-rpc error");
  }
  return env.result;
}

/** §5 discovery: fetch the well-known card and demand strict v1.0.0 shape. */
export async function discoverAgentCard(root: string, opts?: { publicJwk?: JsonWebKey }): Promise<{ card: AgentCardV10; signatureVerified: boolean }> {
  guardUrl(root);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(root + WELL_KNOWN_CARD_PATH, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new A2AClientError(-32000, `agent-card discovery failed: HTTP ${resp.status}`);
  const card = (await resp.json()) as AgentCardV10;
  const violations = validateAgentCardV10(card);
  if (violations.length > 0) {
    throw new A2AClientError(-32000, `agent-card refused — not A2A v1.0.0: ${violations.join("; ")}`);
  }
  if (opts?.publicJwk) {
    const sig = await verifyAgentCardV10Signatures(card, opts.publicJwk);
    if (!sig.ok) throw new A2AClientError(-32000, "agent-card refused — no signature verified against the publisher key");
    // 18.4.0 — the verified card key becomes a STRUCTURAL collaboration
    // identity (bridge store), so approvals from a connected peer bind
    // without trust-on-first-use.
    await recordA2AVerifiedPeer(card.name, opts.publicJwk, root);
    return { card, signatureVerified: true };
  }
  return { card, signatureVerified: false };
}

export async function sendMessage(root: string, message: MessageV10, configuration?: Record<string, unknown>, authorization?: string): Promise<TaskV10> {
  return (await rpc(root, "message/send", configuration ? { message, configuration } : { message }, authorization)) as TaskV10;
}

export async function getTask(root: string, id: string, historyLength?: number): Promise<TaskV10> {
  return (await rpc(root, "tasks/get", historyLength === undefined ? { id } : { id, historyLength })) as TaskV10;
}

export async function cancelTask(root: string, id: string): Promise<TaskV10> {
  return (await rpc(root, "tasks/cancel", { id })) as TaskV10;
}

export async function setPushConfig(root: string, taskId: string, pushNotificationConfig: PushNotificationConfigV10): Promise<unknown> {
  return rpc(root, "tasks/pushNotificationConfig/set", { taskId, pushNotificationConfig });
}

export async function getPushConfig(root: string, taskId: string): Promise<unknown> {
  return rpc(root, "tasks/pushNotificationConfig/get", { taskId });
}

export interface StreamEventV10 {
  statusUpdate?: { taskId: string; contextId: string; status: { state: string; timestamp: string }; final: boolean };
  artifactUpdate?: { taskId: string; contextId: string; artifact: { artifactId: string; parts: unknown[] }; lastChunk?: boolean };
  task?: TaskV10;
  id?: unknown;
}

/** Consume a message/stream SSE response, invoking onEvent per data frame. */
export async function streamMessage(root: string, message: MessageV10, onEvent: (ev: StreamEventV10) => void): Promise<TaskV10 | null> {
  guardUrl(root);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS * 6);
  try {
    const resp = await fetch(root + "/", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `vh-${nextRpcId++}`, method: "message/stream", params: { message } }),
      signal: ctrl.signal,
    });
    if (!resp.ok || !resp.body) throw new A2AClientError(-32000, `stream refused: HTTP ${resp.status}`);
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let finalTask: TaskV10 | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx = buf.indexOf("\n\n");
      while (idx >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const env = JSON.parse(line.slice(6)) as { result?: StreamEventV10 & { status?: { state: string } } };
            if (env.result) {
              if (env.result.statusUpdate || env.result.artifactUpdate) onEvent(env.result);
              if (env.result.task) finalTask = env.result.task as TaskV10;
              else if (env.result.statusUpdate?.final && env.result.statusUpdate.status.state) {
                finalTask = finalTask ?? ({ id: env.result.statusUpdate.taskId, contextId: env.result.statusUpdate.contextId, status: { state: env.result.statusUpdate.status.state as TaskV10["status"]["state"], timestamp: new Date().toISOString() } } as TaskV10);
              }
            }
          } catch { /* malformed frame — skipped, stream continues */ }
        }
        idx = buf.indexOf("\n\n");
      }
    }
    return finalTask;
  } finally {
    clearTimeout(timer);
  }
}
