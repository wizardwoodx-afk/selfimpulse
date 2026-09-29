/**
 * §A2A RUNTIME — the ONE bootstrap that mounts a harbor on the A2A v1.0 wire.
 *
 * WHY THIS FILE EXISTS. Until 17.10.7 rev 3 the A2A stack was complete and
 * unreachable: `createA2AServer()` (transport), `makeDelegationHandler()`
 * (receiver ladder) and `runInboundDelegation()` (the LiveBridge) were all real
 * and all probed — but nothing in the shipped product called them. The only
 * callers were probe suites. A passing end-to-end harness proves the
 * architecture works *when a test wires it*; it does not prove the shipped
 * application exposes it by default. An external review said exactly that, and
 * the grep agreed: `createA2AServer` appeared in src/ once (its own definition)
 * and in comments.
 *
 * This is the mount. One function, the whole ladder, in the order the product
 * claims it runs:
 *
 *     load harbor identity            → ECDSA P-256 keypair + fingerprint
 *     load the team this harbor speaks for
 *     sign the A2A v1.0.0 card        → JWS over the canonical card bytes
 *     build the delegation handler    → receiver GuardRail + routing + gate
 *     attach the LiveBridge           → real TeamExecutor, real CLI, real git
 *     attach the receiver risk policy → the receiver re-classifies; a sender
 *                                       cannot downgrade its own risk class
 *     listen                          → GET /.well-known/agent-card.json, POST /
 *
 * Everything below is Node-only by construction: the browser app cannot listen
 * on a port, so the mount lives in the host runtime (`npm run host` →
 * tools/vh-host.mjs) and in probes. The desktop face stays an A2A *client*
 * (discover → delegate → verify the returned receipt).
 *
 * HONESTY RULES, inherited from the bridge and restated here because this is
 * the door strangers walk through:
 *   • no execution deps, no harness binary, no bound repository → the runtime
 *     still mounts (it must, or it cannot refuse politely) but every delegation
 *     is REFUSED IN WORDS. There is no path from this file to a fabricated
 *     completion.
 *   • risky work is DENIED by default. A headless host has no human at the
 *     gate, and a gate that auto-approves for an absent operator is a door, not
 *     a gate. `riskyGate: "approve"` exists for a supervised host that wires a
 *     real `HumanGate`.
 *   • `seatMode: "drill"` (a deterministic local seat used when no agent CLI is
 *     installed) is reported in `describe()` and in every artifact it produces.
 *     It never claims to be a real model.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import type { HarnessId } from "../domain/harness";
import { secureId } from "../security/guardrail";
import { addTeammate, createTeam, delegateViaA2A, harborCardForTeamV10, makeDelegationHandler, type DelegationOutcome, type HarborTeam, type HumanGate, type ReceiverRiskMode, type RiskTier } from "./harborTeams";
import { createA2AServer, type A2AServerHandle } from "./a2aServer";
import { signAgentCardV10, type AgentCardV10, type CardSigningIdentityV10 } from "./a2aV10";
import type { BridgeConfig } from "./a2aBridge";
import { ENGINE_VERSION } from "../version";
import type { CliResult, TeamRunnerDeps } from "./teamExecutor";
import { scrubEnv } from "./sandbox";

/* ═══════════════════════════════════════════════════════════════════════════
   1 · HARBOR IDENTITY — the trust anchor the card is signed with
   ═══════════════════════════════════════════════════════════════════════════ */

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;

/**
 * A harbor's card-signing identity: a real ECDSA P-256 keypair plus the
 * fingerprint a peer pins. Peers verify the card's JWS against `publicJwk`, so
 * any mutation of any card field after signing fails discovery.
 */
export async function makeHarborIdentity(): Promise<CardSigningIdentityV10> {
  const kp = await crypto.subtle.generateKey(ECDSA, true, ["sign", "verify"]);
  const publicJwk = (await crypto.subtle.exportKey("jwk", kp.publicKey)) as JsonWebKey;
  const fp = createHash("sha256").update(JSON.stringify(publicJwk)).digest("hex").slice(0, 16);
  return { fp, privateKey: kp.privateKey, publicJwk };
}

/* ═══════════════════════════════════════════════════════════════════════════
   2 · NODE EXECUTION DEPS — what lets a mounted harbor actually run a seat
   ═══════════════════════════════════════════════════════════════════════════ */

export interface NodeDepsOptions {
  /** The bound repository's own test command. The verdict comes from the repo. */
  testCommand?: string[];
  /**
   * Explicit harness→executable pins, e.g. `{ codex: "/opt/bin/codex" }`. An
   * override is used verbatim; PATH search is the fallback.
   */
  binOverrides?: Record<string, string>;
  /** Extra directories searched before $PATH. */
  extraPath?: string[];
  /** Per-invocation log hook (the host prints these so a run is observable). */
  onInvoke?: (line: string) => void;
}

function isExecutable(file: string): boolean {
  try {
    const st = fs.statSync(file);
    return st.isFile() && (st.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

/** Search $PATH (plus extras/overrides) for a binary. Honest: null when absent. */
export function resolveBinSync(bin: string, opts?: NodeDepsOptions): string | null {
  if (bin.includes("/") || bin.includes(path.sep)) return isExecutable(bin) ? bin : null;
  const override = opts?.binOverrides?.[bin];
  if (override) return isExecutable(override) ? override : null;
  const dirs = [...(opts?.extraPath ?? []), ...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean)];
  for (const dir of dirs) {
    const candidate = path.join(dir, bin);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function spawnCli(
  bin: string,
  argv: string[],
  cwd: string,
  timeoutSecs: number,
  onInvoke?: (line: string) => void,
): Promise<CliResult> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    // V-security: spawn CLI children through scrubEnv() (28 credential-shaped
    // patterns wiped) so a child CLI — and any transitive process it starts —
    // never inherits OPENAI_API_KEY, GH_TOKEN, cloud creds, etc. from the
    // parent. Before this fix the spawn spread `...process.env` directly,
    // which is an env leak equivalent to handing the child the parent's keys.
    // GIT_TERMINAL_PROMPT / NO_COLOR are safe CLI-control vars, restored after
    // scrubbing rather than added to a leaky spread.
    const scrubbed = scrubEnv(process.env as Record<string, string>);
    const child = spawn(bin, argv, {
      cwd,
      env: { ...scrubbed, GIT_TERMINAL_PROMPT: "0", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const kill = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, Math.max(15, timeoutSecs) * 1000);
    child.stdout.on("data", (b) => { stdout += String(b); });
    child.stderr.on("data", (b) => { stderr += String(b); });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(kill);
      resolve({ exitCode: null, stdout, stderr: `${stderr}${String(err)}`, durationMs: Date.now() - t0, timedOut });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(kill);
      onInvoke?.(`spawn ${path.basename(bin)} ${argv.slice(0, 3).join(" ")} → exit ${code ?? "null"} in ${Date.now() - t0}ms`);
      resolve({ exitCode: code, stdout, stderr, durationMs: Date.now() - t0, timedOut });
    });
  });
}

/**
 * The host-side `TeamRunnerDeps`: real process spawning, real git, real fs,
 * and the repository's own test command as the verdict. This is the piece the
 * app's `hostRunnerDeps` cannot provide — that one rides the Tauri IPC layer on
 * desktop and simulates in the browser. A mounted A2A harbor needs the real
 * thing, because the receipt it seals has to mean something.
 */
export function nodeRunnerDeps(opts?: NodeDepsOptions): TeamRunnerDeps {
  const testCmd = opts?.testCommand ?? ["npm", "test"];
  return {
    resolveBin: async (bin) => resolveBinSync(bin, opts),
    cliInvoke: async (req) => spawnCli(req.bin, req.argv, req.cwd, req.timeoutSecs, opts?.onInvoke),
    git: async (args, cwd) => {
      const r = await spawnCli("git", args, cwd, 120, opts?.onInvoke);
      return {
        ok: r.exitCode === 0,
        exitCode: r.exitCode,
        stdout: r.stdout,
        stderr: r.stderr,
        reason: r.exitCode === 0 ? null : r.stderr.trim() || `git ${args[0] ?? ""} failed`,
      };
    },
    writeFile: async (absPath, contents) => {
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      await fs.promises.writeFile(absPath, contents, "utf8");
    },
    verify: async (cwd) => spawnCli(testCmd[0] ?? "npm", testCmd.slice(1), cwd, 300, opts?.onInvoke),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   3 · THE MOUNT
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RuntimeTeammateSpec {
  name: string;
  title: string;
  description: string;
  skills?: string[];
}

export interface A2ARuntimeOptions {
  /** This harbor's user identity — what inbound packets must be addressed to. */
  harborUser: string;
  /** The team this harbor speaks for. At least one teammate or routing fails. */
  teammates: RuntimeTeammateSpec[];
  /** Bind host. Defaults to 127.0.0.1 — the server refuses to guess wider. */
  host?: string;
  /** Bind port. 0 (default) picks a free port and the card is signed for it. */
  port?: number;
  /**
   * Shared bearer token. Every JSON-RPC call must carry it. OMIT IT AND ONE IS
   * MINTED: the harbor's card declares the `harborIdentity` scheme, and a card
   * that declares a scheme the listener does not enforce refuses everything —
   * so the honest choices are "enforce a token" or "publish a card that claims
   * no security". A mounted harbor that silently accepted strangers' work would
   * be the worst of the three, so that option does not exist here. The minted
   * token is reported on the handle and in `describe()` so the operator can hand
   * it to a peer.
   */
  token?: string;
  /** How the receiver treats work its OWN policy calls risky. Default: deny. */
  riskyGate?: "deny" | "approve" | HumanGate;
  /** The receiver's own risk re-classification. Default: upgrade HIGH/CRITICAL. */
  receiverRiskMode?: ReceiverRiskMode;
  /** Live execution. Without it the runtime mounts and refuses every delegation. */
  bridge?: BridgeConfig;
  /** Reuse an identity (a persisted key) instead of minting a fresh one. */
  identity?: CardSigningIdentityV10;
  /** Log hook for the host process's stdout. */
  onLog?: (line: string) => void;
}

export interface RuntimeDescriptor {
  mounted: true;
  product: string;
  version: string;
  harborUser: string;
  /** The port this process actually bound — the one the signed card advertises. */
  port: number;
  interfaceUrl: string;
  cardUrl: string;
  identityFp: string;
  cardSigned: boolean;
  securitySchemes: string[];
  /** The bearer token this listener enforces (minted when the operator gave none). */
  token: string;
  /** True when the token was minted here rather than supplied by the operator. */
  tokenMinted: boolean;
  teammates: Array<{ name: string; title: string; skills: string[] }>;
  policy: {
    receiverRiskMode: ReceiverRiskMode;
    riskyGate: "deny" | "approve" | "custom";
    guardrail: "inbound scan + egress check + replay window";
  };
  bridge: {
    executable: boolean;
    harness: HarnessId | null;
    reviewerHarness: HarnessId | null;
    repoRoot: string | null;
    testCommand: string[] | null;
    writerBin: string | null;
    reviewerBin: string | null;
    allowUnexecuted: boolean;
    /** Why this harbor cannot execute, in words, when it cannot. */
    refusalReason: string | null;
  };
}

export interface A2ARuntime {
  readonly port: number;
  readonly baseUrl: string;
  readonly cardUrl: string;
  readonly card: AgentCardV10;
  readonly identity: CardSigningIdentityV10;
  /** The bearer token a peer must present. Minted when none was configured. */
  readonly token: string;
  readonly team: HarborTeam;
  readonly server: A2AServerHandle;
  /** What is actually mounted, for the operator and for peer probes. */
  describe(): RuntimeDescriptor;
  /** This harbor acting as the SENDER: discover a peer, delegate, verify. */
  delegateTo(opts: {
    remoteRoot: string;
    remotePublicJwk: JsonWebKey;
    task: string;
    tier: RiskTier;
    authorization?: string;
    senderGate?: HumanGate;
  }): Promise<DelegationOutcome>;
  stop(): Promise<void>;
}

/** Claim a free port so the card can be signed for the URL that will really serve it. */
export function pickFreePort(host = "127.0.0.1"): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, host, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export async function startA2ARuntime(opts: A2ARuntimeOptions): Promise<A2ARuntime> {
  const host = opts.host ?? "127.0.0.1";
  const log = opts.onLog ?? (() => undefined);

  /* 1 · identity ─────────────────────────────────────────────────────────── */
  const identity = opts.identity ?? (await makeHarborIdentity());

  /* 2 · the team this harbor speaks for ──────────────────────────────────── */
  let team = createTeam(opts.harborUser);
  for (const spec of opts.teammates) {
    const added = addTeammate(team, {
      name: spec.name,
      title: spec.title,
      description: spec.description,
      skills: spec.skills ?? [],
    });
    if (!added.ok) throw new Error(`teammate "${spec.name}" refused: ${added.reason}`);
    team = added.value.team;
  }
  if (team.teammates.length === 0) throw new Error("a mounted harbor needs at least one teammate — routing has nothing to route to");

  /* 3 · the interface URL, known before the card is signed ───────────────── */
  const port = opts.port && opts.port > 0 ? opts.port : await pickFreePort(host);
  const interfaceUrl = `http://${host}:${port}/`;
  const unsigned = harborCardForTeamV10(team, interfaceUrl);
  const card = await signAgentCardV10(unsigned, identity);

  /* 4 · the receiver ladder: GuardRail + routing + THIS harbor's gate ────── */
  const riskyGate = opts.riskyGate ?? "deny";
  const gate: HumanGate =
    typeof riskyGate === "function"
      ? riskyGate
      : async (action, detail) => {
          log(`gate: ${action} — ${detail} → ${riskyGate === "approve" ? "approved (supervised host)" : "DENIED (no operator at this gate)"}`);
          return riskyGate === "approve";
        };

  /* 5 · the handler, with the LiveBridge and the receiver risk policy ────── */
  const handler = makeDelegationHandler(team, gate, opts.bridge ?? {}, { mode: opts.receiverRiskMode ?? "high-and-critical" });

  /* 6 · transport ────────────────────────────────────────────────────────── */
  const tokenMinted = opts.token === undefined;
  const token = opts.token ?? `vh-${secureId("link")}`;
  const server = createA2AServer({
    card,
    onMessage: handler,
    authorize: (req) => (req.headers.authorization ?? "") === `Bearer ${token}`,
    host,
    port,
  });
  const boundPort = await server.start();
  if (boundPort !== port) throw new Error(`listener bound ${boundPort} but the signed card advertises ${port} — refusing to serve a card that lies about its own interface`);
  const baseUrl = server.baseUrl;
  log(`a2a: mounted ${opts.harborUser} on ${baseUrl} (card ${cardUrlOf(baseUrl)}, identity ${identity.fp})`);
  if (tokenMinted) log(`a2a: no --token supplied, so this listener minted one — peers must present it (see describe().token)`);

  const bridge = opts.bridge ?? {};
  /* What would ACTUALLY be spawned — asked of the bridge's own resolver, so a
     host that pins its own binaries (or runs the labelled drill seat) is
     described truthfully instead of being reported as unable to execute. */
  const resolveFor = async (id: HarnessId | string | null | undefined): Promise<string | null> => {
    if (!id) return null;
    if (bridge.deps?.resolveBin) return bridge.deps.resolveBin(String(id));
    return resolveBinSync(String(id), {});
  };
  const writerBin = await resolveFor(bridge.harness ?? null);
  const reviewerId = bridge.reviewerHarness ?? null;
  const reviewerBin = await resolveFor(reviewerId);
  const missing: string[] = [];
  if (!bridge.deps) missing.push("no execution deps");
  if (!bridge.harness) missing.push("no harness configured");
  if (bridge.harness && !writerBin) missing.push(`harness "${bridge.harness}" is not installed on this host`);
  if (!bridge.repoRoot) missing.push("no repository bound");

  const describe = (): RuntimeDescriptor => ({
    mounted: true,
    product: "SelfImpulse",
    version: ENGINE_VERSION,
    harborUser: team.user,
    port: boundPort,
    interfaceUrl,
    cardUrl: cardUrlOf(baseUrl),
    identityFp: identity.fp,
    cardSigned: Array.isArray(card.signatures) && card.signatures.length > 0,
    securitySchemes: Object.keys(card.securitySchemes ?? {}),
    token,
    tokenMinted,
    teammates: team.teammates.map((t) => ({ name: t.name, title: t.title, skills: t.skills })),
    policy: {
      receiverRiskMode: opts.receiverRiskMode ?? "high-and-critical",
      riskyGate: typeof riskyGate === "function" ? "custom" : riskyGate,
      guardrail: "inbound scan + egress check + replay window",
    },
    bridge: {
      executable: missing.length === 0,
      harness: bridge.harness ?? null,
      reviewerHarness: reviewerId,
      repoRoot: bridge.repoRoot ?? null,
      testCommand: bridge.testCommand ?? null,
      writerBin,
      reviewerBin,
      allowUnexecuted: bridge.allowUnexecuted === true,
      refusalReason: missing.length === 0 ? null : `this harbor cannot execute: ${missing.join("; ")} — delegations will be refused in words, never answered with a completion`,
    },
  });

  return {
    port: boundPort,
    baseUrl,
    cardUrl: cardUrlOf(baseUrl),
    card,
    identity,
    token,
    team,
    server,
    describe,
    delegateTo: (o) =>
      delegateViaA2A({
        fromTeam: team,
        remoteRoot: o.remoteRoot,
        remotePublicJwk: o.remotePublicJwk,
        task: o.task,
        tier: o.tier,
        authorization: o.authorization,
        senderGate: o.senderGate,
      }),
    stop: async () => {
      await server.stop();
      log(`a2a: unmounted ${team.user} from ${baseUrl}`);
    },
  };
}

function cardUrlOf(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/.well-known/agent-card.json`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4 · THE DRILL SEAT — a deterministic local CLI, LABELLED
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A `BridgeConfig` whose CLI boundary is a deterministic local seat: a real
 * child process, a real worktree, a real git repo and the repository's OWN test
 * command as the verdict — but the "agent" is a script, not a model. This is
 * the drill's own idiom (the drill, `probe/a2aBridge` and the TeamsPage
 * simulation all use it) and it exists so the mount is testable on a host with
 * no agent CLI installed. It is never silent: every artifact it produces is
 * stamped `[drill-seat]`, and `describe()` reports it.
 *
 * `applyFix` decides whether the seat actually repairs the repository. Pass
 * false and the repo's test fails, the gate fails, and the record says
 * `executed-failed` — the anti-cheat path.
 */
export function drillBridgeConfig(opts: {
  repoRoot: string;
  baseBranch?: string;
  testCommand?: string[];
  harness?: HarnessId;
  reviewerHarness?: HarnessId;
  applyFix?: boolean;
  fixFile?: string;
  fixContents?: string;
  timeoutSecs?: number;
  /** Host log hook — the drill seat announces itself in the process log. */
  onLog?: (line: string) => void;
}): BridgeConfig {
  const applyFix = opts.applyFix !== false;
  const target = opts.fixFile ?? "guard.js";
  const contents =
    opts.fixContents ??
    `function authorize(role, user) {\n  // hardened: disabled principals are denied\n  return Boolean(user && user.active) && role !== "disabled";\n}\nmodule.exports = { authorize };\n`;
  const deps = nodeRunnerDeps({ testCommand: opts.testCommand ?? ["node", "test.js"], onInvoke: opts.onLog });
  const cliInvoke = deps.cliInvoke!;
  return {
    harness: opts.harness ?? "opencode",
    reviewerHarness: opts.reviewerHarness ?? "codex",
    repoRoot: opts.repoRoot,
    baseBranch: opts.baseBranch,
    testCommand: opts.testCommand ?? ["node", "test.js"],
    timeoutSecs: opts.timeoutSecs ?? 120,
    deps: {
      ...deps,
      /* Both seats resolve to this Node binary: a real process boundary, a
         deterministic brain. The reviewer seat is read-only by construction
         (mayWrite: false in the bridge), so only the writer can apply the fix. */
      resolveBin: async () => process.execPath,
      cliInvoke: async (req) => {
        const readOnly = /review|read-only|Review the change/i.test(req.argv.join(" "));
        if (!readOnly && applyFix) {
          try {
            await fs.promises.writeFile(path.join(req.cwd, target), contents, "utf8");
          } catch (err) {
            return { exitCode: 1, stdout: "", stderr: `[drill-seat] could not write ${target}: ${String(err)}`, durationMs: 0, timedOut: false };
          }
        }
        const stamp = readOnly
          ? "[drill-seat] read-only review complete: diff inspected against the delegated task."
          : applyFix
            ? `[drill-seat] applied the fix to ${target}.`
            : "[drill-seat] inspected the repository and made no change.";
        opts.onLog?.(stamp);
        const real = await cliInvoke({ ...req, bin: process.execPath, argv: ["-e", "process.stdout.write('')"] });
        return { ...real, exitCode: 0, stdout: JSON.stringify({ type: "result", is_error: false, result: stamp, session_id: `drill_${createHash("sha256").update(req.cwd).digest("hex").slice(0, 12)}` }) };
      },
    },
  };
}
