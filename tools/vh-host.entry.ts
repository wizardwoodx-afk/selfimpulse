/**
 * tools/vh-host.entry.ts — the A2A host process. Bundled by
 * `npm run host:build` into tools/vh-host-engine.mjs and launched by
 * tools/vh-host.mjs (`npm run host`). This is the mount the product was
 * missing: one process, one bootstrap, a harbor that is actually listening.
 *
 *   npm run host -- --harbor "USER 2" \
 *       --teammate "Lens|Code hardener|Hardens authorization code and proves it with tests|security" \
 *       --repo /path/to/repo --test-cmd "node test.js" --harness opencode
 *
 * The process prints one machine-readable line when it is listening:
 *
 *   VH-A2A-READY {"mounted":true,...}
 *
 * and, when asked to act as the sender, one more when a delegation settles:
 *
 *   VH-A2A-DELEGATED {"record":{...}}
 *
 * Nothing here is a demo shim. `--seat-mode real` (the default) refuses every
 * delegation in words when the configured harness is not installed; `--seat-mode
 * drill` uses a deterministic local seat and says so in every artifact.
 */
import fs from "node:fs";
import {
  drillBridgeConfig,
  nodeRunnerDeps,
  startA2ARuntime,
  type A2ARuntime,
  type RuntimeTeammateSpec,
} from "../src/mission/a2aRuntime";
import type { BridgeConfig } from "../src/mission/a2aBridge";
import type { HarnessId } from "../src/domain/harness";
import type { ReceiverRiskMode, RiskTier } from "../src/mission/harborTeams";

interface Args {
  [k: string]: string | boolean | undefined;
}

function parseArgv(argv: string[]): Args {
  const out: Args = {};
  const list: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  if (typeof out.teammate === "string") list.push(out.teammate);
  // `--teammate` may repeat; collect every occurrence in order.
  const repeats: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--teammate" && argv[i + 1]) repeats.push(argv[i + 1]);
  }
  if (repeats.length > 0) out.__teammates = JSON.stringify(repeats);
  else if (list.length > 0) out.__teammates = JSON.stringify(list);
  return out;
}

function teammatesOf(args: Args): RuntimeTeammateSpec[] {
  const raw = typeof args.__teammates === "string" ? (JSON.parse(args.__teammates) as string[]) : [];
  if (raw.length === 0) {
    return [{ name: "Lens", title: "Code hardener", description: "Hardens authorization code and proves every change with the repository's own tests.", skills: ["security", "testing"] }];
  }
  return raw.map((entry) => {
    const [name, title, description, skills] = entry.split("|");
    return {
      name: (name ?? "Teammate").trim(),
      title: (title ?? "Specialist").trim(),
      description: (description ?? `${(name ?? "Teammate").trim()} — general specialist`).trim(),
      skills: (skills ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    };
  });
}

function fail(message: string): never {
  process.stdout.write(`VH-A2A-ERROR ${JSON.stringify({ error: message })}\n`);
  process.exit(2);
}

export async function main(argv: string[]): Promise<void> {
  const args = parseArgv(argv);
  const log = (line: string): void => { process.stdout.write(`[vh-host] ${line}\n`); };

  const harborUser = typeof args.harbor === "string" ? args.harbor : "VH HARBOR";
  const port = args.port === true ? 0 : Number(args.port ?? 0);
  const host = typeof args.host === "string" ? args.host : "127.0.0.1";
  const token = typeof args.token === "string" ? args.token : undefined;
  const riskMode = (typeof args["risk-mode"] === "string" ? args["risk-mode"] : "high-and-critical") as ReceiverRiskMode;
  const seatMode = (typeof args["seat-mode"] === "string" ? args["seat-mode"] : "real") as "real" | "drill" | "off";
  const repoRoot = typeof args.repo === "string" ? args.repo : undefined;
  const testCommand = typeof args["test-cmd"] === "string" ? args["test-cmd"].split(/\s+/).filter(Boolean) : ["node", "test.js"];
  const harness = (typeof args.harness === "string" ? args.harness : "opencode") as HarnessId;
  const reviewerHarness = (typeof args["reviewer-harness"] === "string" ? args["reviewer-harness"] : "codex") as HarnessId;
  const baseBranch = typeof args["base-branch"] === "string" ? args["base-branch"] : undefined;

  if (repoRoot && !fs.existsSync(repoRoot)) fail(`--repo does not exist: ${repoRoot}`);

  /* ── the bridge: how THIS host executes work delegated to it ─────────────── */
  let bridge: BridgeConfig | undefined;
  if (seatMode === "real") {
    if (repoRoot) {
      bridge = {
        harness,
        reviewerHarness,
        repoRoot,
        baseBranch,
        testCommand,
        timeoutSecs: args["timeout-secs"] === true ? 120 : Number(args["timeout-secs"] ?? 120),
        deps: nodeRunnerDeps({ testCommand, onInvoke: log }),
      };
    }
  } else if (seatMode === "drill") {
    if (!repoRoot) fail("--seat-mode drill needs --repo (the deterministic seat works in a real repository)");
    bridge = drillBridgeConfig({
      repoRoot: repoRoot!,
      baseBranch,
      testCommand,
      harness,
      reviewerHarness,
      applyFix: args["apply-fix"] !== "false",
      timeoutSecs: args["timeout-secs"] === true ? 120 : Number(args["timeout-secs"] ?? 120),
      onLog: log,
    });
  }

  const runtime: A2ARuntime = await startA2ARuntime({
    harborUser,
    teammates: teammatesOf(args),
    host,
    port: Number.isFinite(port) ? port : 0,
    token,
    riskyGate: args["allow-risky"] === true || args["allow-risky"] === "true" ? "approve" : "deny",
    receiverRiskMode: riskMode,
    bridge,
    onLog: log,
  });

  const descriptor = { ...runtime.describe(), seatMode, pid: process.pid };
  process.stdout.write(`VH-A2A-READY ${JSON.stringify(descriptor)}\n`);

  if (typeof args["write-jwk"] === "string") {
    fs.writeFileSync(args["write-jwk"], JSON.stringify({ fp: runtime.identity.fp, publicJwk: runtime.identity.publicJwk }, null, 2));
    log(`publisher JWK written to ${args["write-jwk"]}`);
  }

  /* ── optional sender half: this harbor delegates to a peer ──────────────── */
  if (typeof args["peer-url"] === "string" && typeof args.send === "string") {
    let peerJwk: JsonWebKey | undefined;
    if (typeof args["peer-jwk"] === "string") {
      const raw = fs.readFileSync(args["peer-jwk"], "utf8");
      const parsed = JSON.parse(raw) as { publicJwk?: JsonWebKey } & JsonWebKey;
      peerJwk = parsed.publicJwk ?? (parsed as JsonWebKey);
    }
    if (!peerJwk) fail("--peer-url needs --peer-jwk (the peer's publisher key) — an unproven identity is refused by design");
    const outcome = await runtime.delegateTo({
      remoteRoot: args["peer-url"] as string,
      remotePublicJwk: peerJwk!,
      task: args.send as string,
      tier: (args.tier === "risky" ? "risky" : "safe") as RiskTier,
      authorization: typeof args["peer-token"] === "string" ? `Bearer ${args["peer-token"]}` : undefined,
      senderGate: async () => args["approve-sender"] === true || args["approve-sender"] === "true",
    });
    process.stdout.write(`VH-A2A-DELEGATED ${JSON.stringify({ ok: outcome.ok, record: outcome.record })}\n`);
    if (args["exit-after-delegation"] === true || args["exit-after-delegation"] === "true") {
      await runtime.stop();
      process.stdout.write("VH-A2A-STOPPED\n");
      process.exit(outcome.ok ? 0 : 1);
    }
  }

  const shutdown = async (signal: string): Promise<void> => {
    log(`${signal} — unmounting`);
    try { await runtime.stop(); } catch { /* already down */ }
    process.stdout.write("VH-A2A-STOPPED\n");
    process.exit(0);
  };
  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.on("SIGINT", () => { void shutdown("SIGINT"); });
}

main(process.argv.slice(2)).catch((err) => {
  fail(err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err));
});
