import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/pairing.test.ts
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// src/mission/pairing.ts
var ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var CODE_LEN = 8;
var DEFAULT_TTL_SECS = 300;
var MAX_TTL_SECS = 900;
var MAX_ATTEMPTS = 5;
var enc = new TextEncoder();
function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}
function randomId(prefix) {
  return `${prefix}-${[...randomBytes(9)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function b64url(b) {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
var PEPPER = null;
function pepper() {
  if (PEPPER === null) PEPPER = b64url(randomBytes(32));
  return PEPPER;
}
async function hashCode(code) {
  return sha256hex(`${pepper()}:${code.trim().toUpperCase()}`);
}
function mintCode() {
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function createInvitation(args) {
  const ttl = Math.max(30, Math.min(MAX_TTL_SECS, args.ttlSecs ?? DEFAULT_TTL_SECS));
  const now = Date.now();
  const code = mintCode();
  const invitation = {
    id: args.id ?? randomId("pair"),
    hostFp: args.hostFp,
    harbor: args.harbor,
    codeHash: await hashCode(code),
    issuedAt: now,
    expiresAt: now + ttl * 1e3,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    state: "open",
    redeemedBy: null
  };
  return { invitation, code };
}
function stateAt(inv, now) {
  if (inv.state === "open" && now >= inv.expiresAt) return "expired";
  return inv.state;
}
async function redeemInvitation(args) {
  const now = args.now ?? Date.now();
  const inv = { ...args.invitation };
  const current = stateAt(inv, now);
  if (current !== "open") {
    return {
      ok: false,
      invitation: inv,
      reason: current === "redeemed" ? "this invitation was already used \u2014 pair a fresh one" : current === "expired" ? "this invitation has expired; pair a new one" : "this invitation was destroyed after too many wrong codes"
    };
  }
  const presented = await hashCode(args.code);
  if (!constantTimeEquals(presented, inv.codeHash)) {
    inv.attempts += 1;
    if (inv.attempts >= inv.maxAttempts) {
      inv.state = "destroyed";
      return { ok: false, invitation: inv, reason: "that code was wrong too many times, so this invitation is void" };
    }
    return {
      ok: false,
      invitation: inv,
      reason: `that code does not match (${inv.maxAttempts - inv.attempts} attempt(s) left before this invitation is void)`
    };
  }
  const ttl = Math.max(60, Math.min(MAX_TTL_SECS * 4, args.credentialTtlSecs ?? DEFAULT_TTL_SECS * 4));
  inv.state = "redeemed";
  inv.redeemedBy = { fp: args.peer.fp, name: args.peer.name, at: now };
  return {
    ok: true,
    invitation: inv,
    credential: {
      token: `vhp_${b64url(randomBytes(32))}`,
      harbor: inv.harbor,
      hostFp: inv.hostFp,
      peerFp: args.peer.fp,
      issuedAt: now,
      expiresAt: now + ttl * 1e3,
      // Stated, not implied: what a paired peer may ask for. The host still
      // runs every inbound delegation through its gates, so this is a ceiling
      // an operator can read, not the authority itself.
      scope: ["discover:card", "delegate"]
    }
  };
}
function credentialStatus(cred, now = Date.now()) {
  if (now >= cred.expiresAt) return { valid: false, reason: "this pairing credential has expired; pair again" };
  if (!cred.token.startsWith("vhp_")) return { valid: false, reason: "this is not a pairing credential" };
  return { valid: true, reason: "valid" };
}
function describeInvitation(inv, now = Date.now()) {
  const state = stateAt(inv, now);
  if (state === "redeemed") return `used by ${inv.redeemedBy?.name ?? "a peer"}`;
  if (state === "expired") return "expired";
  if (state === "destroyed") return "void after too many wrong codes";
  const left = Math.max(0, Math.ceil((inv.expiresAt - now) / 1e3));
  return `waiting for a peer \u2014 ${left}s left, ${inv.maxAttempts - inv.attempts} attempt(s) left`;
}

// src/security/guardrail.ts
var RateGate = class {
  constructor(limit, windowMs, now = () => Date.now()) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }
  hits = /* @__PURE__ */ new Map();
  /** Returns true when the action is within budget (and records it). */
  check(key) {
    const t = this.now();
    const arr = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(t);
    this.hits.set(key, arr);
    return true;
  }
};
var callRateGate = new RateGate(120, 6e4);

// src/mission/a2aV10.ts
var enc2 = new TextEncoder();

// src/mission/a2aClient.ts
async function claimPairing(args) {
  const base = args.hostRoot.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) return { ok: false, reason: "a pairing request needs an http(s) host root" };
  if (args.code.trim() === "") return { ok: false, reason: "no pairing code was entered" };
  try {
    const res = await fetch(`${base}/vh/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: args.code.trim(), peer: { fp: args.peerFp, name: args.peerName } }),
      signal: AbortSignal.timeout(args.timeoutMs ?? 1e4)
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok && body.credential) return { ok: true, credential: body.credential };
    return { ok: false, reason: body.reason ?? `the host refused the pairing (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, reason: `could not reach the host to pair: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// probe/pairing.test.ts
var ROOT = process.env.HANDLE_ROOT ?? process.cwd();
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var passed = 0;
var failed = 0;
var failures = [];
var ok = (label, cond, detail = "") => {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  }
};
var section = (n) => console.log(`
== ${n}`);
var NONCE = "vh-stop-test-nonce-0123456789";
async function modelTests() {
  section("1. an invitation is single-use, short, and not the token");
  const { invitation, code } = await createInvitation({ hostFp: "FP-HOST", harbor: "USER 1" });
  ok("a code is minted", /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), code);
  ok("it avoids characters people mishear", !/[01OI]/.test(code), code);
  ok("the invitation stores no code, only a digest", !JSON.stringify(invitation).includes(code));
  ok("it expires within minutes, not hours", invitation.expiresAt - invitation.issuedAt <= 9e5);
  ok("it is bound to this host's identity", invitation.hostFp === "FP-HOST" && invitation.harbor === "USER 1");
  section("2. redeeming spends it");
  const first = await redeemInvitation({ invitation, code, peer: { fp: "FP-PEER", name: "laptop" } });
  ok("the right code redeems", first.ok === true, first.ok ? "" : first.reason);
  const cred = first.ok ? first.credential : null;
  ok("the credential is scoped and expiring", Boolean(cred && cred.expiresAt > Date.now() && cred.scope.includes("delegate")));
  ok("it is a PAIRED credential, not the host's bearer token", Boolean(cred && cred.token.startsWith("vhp_")), cred?.token.slice(0, 8) ?? "");
  ok("it records which peer took it", first.ok && first.invitation.redeemedBy?.fp === "FP-PEER");
  ok("it is bound to the host identity it came from", cred?.hostFp === "FP-HOST");
  const replay = await redeemInvitation({ invitation: first.ok ? first.invitation : invitation, code, peer: { fp: "FP-OTHER", name: "attacker" } });
  ok("the SAME code cannot be redeemed twice", replay.ok === false);
  ok("and the refusal says it was used", !replay.ok && /already used/.test(replay.reason), replay.ok ? "" : replay.reason);
  ok("a second peer cannot ride the first peer's code", !replay.ok && replay.invitation.redeemedBy?.fp === "FP-PEER");
  section("3. wrong codes are expensive, not free");
  {
    const m = await createInvitation({ hostFp: "FP-HOST", harbor: "USER 1" });
    for (let i = 0; i < 4; i += 1) {
      const r = await redeemInvitation({ invitation: m.invitation, code: "ZZZZ-ZZZZ", peer: { fp: "FP-X", name: "guess" } });
      ok(`guess ${i + 1} is refused`, r.ok === false);
      if (!r.ok) m.invitation = r.invitation;
    }
    const last = await redeemInvitation({ invitation: m.invitation, code: "ZZZZ-ZZZZ", peer: { fp: "FP-X", name: "guess" } });
    ok("the fifth wrong guess voids the invitation", !last.ok && last.invitation.state === "destroyed", last.ok ? "" : last.reason);
    const after = await redeemInvitation({ invitation: last.invitation, code, peer: { fp: "FP-X", name: "guess" } });
    ok(
      "a void invitation cannot be redeemed with the CORRECT code either",
      after.ok === false,
      "a destroyed invitation is a resource that still works"
    );
    ok("and it says so", !after.ok && /void|destroyed/.test(after.reason), after.ok ? "" : after.reason);
  }
  section("4. time is not a suggestion");
  {
    const m = await createInvitation({ hostFp: "FP-HOST", harbor: "USER 1" });
    const later = m.invitation.expiresAt + 1;
    ok("an expired invitation is not redeemable", (await redeemInvitation({ invitation: m.invitation, code, peer: { fp: "FP-P", name: "late" }, now: later })).ok === false);
    ok("describeInvitation says expired", /expired/.test(describeInvitation(m.invitation, later)));
    const live = describeInvitation(m.invitation);
    ok("a live one says what it is waiting for", /waiting for a peer/.test(live), live);
    ok("\u2026and how long is left", /\d+s left/.test(live), live);
    ok("a spent one names the peer who spent it", /used by laptop/.test(describeInvitation(first.ok ? first.invitation : m.invitation)));
  }
  section("5. credentials expire and are shaped honestly");
  {
    const c = first.ok ? first.credential : null;
    if (!c) {
      ok("credential present", false);
      return;
    }
    ok("a fresh credential is valid", credentialStatus(c).valid === true);
    ok("an expired one is not", credentialStatus(c, c.expiresAt + 1).valid === false);
    ok("and the refusal is in words", /expired/.test(credentialStatus(c, c.expiresAt + 1).reason));
    ok(
      "something that is not a paired credential is refused outright",
      credentialStatus({ ...c, token: "vh-someone-elses-token" }).valid === false
    );
  }
  section("6. a live mount: bind scope, pairing code, paired credential, clean stop");
  const child = spawn(process.execPath, [
    path.join(ROOT, "tools", "vh-host.mjs"),
    "--harbor",
    "PAIR-PROBE",
    "--port",
    "0",
    "--pair"
  ], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    // The supervisor passes the unmount nonce this way; doing the same here is
    // what lets this suite exercise the real unmount channel rather than a
    // stand-in for it.
    env: { ...process.env, HANDLE_STOP_NONCE: NONCE }
  });
  let out = "";
  let err = "";
  let ready = null;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (c) => {
    out += c;
    for (const line of c.split("\n")) {
      if (line.startsWith("VH-A2A-READY") && !ready) {
        try {
          ready = JSON.parse(line.slice("VH-A2A-READY".length).trim());
        } catch {
          ready = {};
        }
      }
    }
  });
  child.stderr.on("data", (c) => {
    err += c;
  });
  try {
    const deadline = Date.now() + 4e4;
    while (!ready && Date.now() < deadline) await sleep(200);
    ok("the host mounted", ready !== null, err.slice(0, 300));
    const d = ready ?? {};
    ok("it is bound to loopback unless told otherwise", String(d.interfaceUrl).startsWith("http://127.0.0.1"), String(d.interfaceUrl));
    ok("the card advertises the loopback URL, not a wildcard", String(d.cardUrl).startsWith("http://127.0.0.1"));
    const liveCode = d.pairing?.code;
    ok("a pairing code is published in the READY descriptor", typeof liveCode === "string" && liveCode.length > 0);
    ok(
      "the host's OWN TOKEN IS NOT IN THE READY LINE",
      typeof d.tokenEnforced === "boolean" && d.token !== void 0 ? !out.includes(String(d.token)) : !/"token"/.test(out.split("\n")[0] ?? ""),
      "the READY line carries the bearer token, so anything that tees stdout leaks it"
    );
    ok("\u2026but the host does say it enforces one", d.tokenEnforced === true, JSON.stringify(d).slice(0, 160));
    const port = d.port;
    const base = `http://127.0.0.1:${port}`;
    const wrong = await claimPairing({ hostRoot: base, code: "QQQQ-QQQQ", peerFp: "FP-PEER-3", peerName: "guess" });
    ok("a wrong code is refused, and the refusal names the cost of guessing", wrong.ok === false && /attempt/.test(wrong.reason), wrong.ok ? "" : wrong.reason);
    const claimed = await claimPairing({ hostRoot: base, code: String(liveCode), peerFp: "FP-PEER-1", peerName: "peer-laptop" });
    ok("a peer redeems the code over the wire", claimed.ok === true, claimed.ok ? "" : claimed.reason);
    ok(
      "it gets a credential, not the host token",
      claimed.ok && claimed.credential.token.startsWith("vhp_") && claimed.credential.token !== d.token
    );
    const rpc = async (token) => {
      const res = await fetch(`${base}/`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: "probe-1", method: "message/send", params: { message: { role: "user", parts: [{ kind: "text", text: "ping" }] } } }),
        signal: AbortSignal.timeout(1e4)
      });
      return { status: res.status, body: await res.text() };
    };
    const withPaired = await rpc(claimed.ok ? claimed.credential.token : "");
    ok("the paired credential is ACCEPTED by the auth gate", !/unauthorized/.test(withPaired.body), withPaired.body.slice(0, 200));
    const withBogus = await rpc("vhp_totally-made-up");
    ok("a made-up credential is REFUSED by the same gate", /unauthorized/.test(withBogus.body), withBogus.body.slice(0, 200));
    const replayed = await claimPairing({ hostRoot: base, code: String(liveCode), peerFp: "FP-PEER-2", peerName: "attacker" });
    ok("the code cannot be redeemed a second time over the wire", replayed.ok === false);
    ok("and the host's refusal is specific", !replayed.ok && /already used/.test(replayed.reason), replayed.ok ? "" : replayed.reason);
    const stop = async (nonce) => {
      const res = await fetch(`${base}/vh/stop`, {
        method: "POST",
        headers: { "x-vh-stop-nonce": nonce },
        signal: AbortSignal.timeout(8e3)
      });
      await res.text();
      return res.status;
    };
    ok("a WRONG unmount nonce is refused", await stop("not-the-nonce") === 403);
    ok("\u2026and the host is still listening after the refusal", child.exitCode === null && /VH-A2A-STOPPED/.test(out) === false);
    let stillUp = true;
    try {
      await fetch(`${base}/.well-known/agent-card.json`, { signal: AbortSignal.timeout(2500) });
    } catch {
      stillUp = false;
    }
    ok("\u2026and still serving its card", stillUp, "a refused unmount took the host down anyway");
    ok("the right nonce is accepted", await stop(NONCE) === 200);
    const stopAt = Date.now();
    while (Date.now() < stopAt + 12e3 && child.exitCode === null) await sleep(150);
    ok(
      "the host unmounted ITSELF and wrote its own shutdown line",
      /VH-A2A-STOPPED/.test(out),
      (out + err).split("\n").slice(-3).join(" | ").slice(0, 200)
    );
    ok(
      "a clean unmount exits 0, with no signal",
      child.exitCode === 0 && child.signalCode === null,
      `exit=${child.exitCode} signal=${child.signalCode}`
    );
    await sleep(400);
    let stillServing = true;
    try {
      await fetch(`${base}/.well-known/agent-card.json`, { signal: AbortSignal.timeout(2500) });
    } catch {
      stillServing = false;
    }
    ok("and the card stops being served", !stillServing);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGKILL");
      await sleep(300);
    }
  }
}
async function sourceTests() {
  section("7. the supervisor is where bind scope and pairing are decided");
  const sup = fs.readFileSync(path.join(ROOT, "src-tauri", "src", "a2a_host.rs"), "utf8");
  ok("the start command takes a bind scope", /bind: Option<String>/.test(sup));
  ok("and defaults it to the narrowest choice", sup.includes('bind.as_deref().unwrap_or("local")'));
  ok("it passes --host to the host", sup.includes('.arg("--host")'));
  ok("a wildcard bind is refused by name", sup.includes("0.0.0.0") && sup.includes("A wildcard bind is never offered"));
  ok("a LAN mount resolves to a real interface address, not a wildcard", /fn lan_address/.test(sup) && /TEST-NET-1/.test(sup));
  ok("\u2026and refuses rather than guessing when there is none", /does not have a routable one/.test(sup));
  ok("it passes --pair only when the operator asked", sup.includes("if pair.unwrap_or(false)"));
  ok("status reports what it is bound to", /"bindAddress"/.test(sup) && /"bindScope"/.test(sup));
  ok("the host token still never crosses to the frontend", !/"token":/.test(sup) && /token. is deliberately NOT read/.test(sup));
  ok("the one-time code is what crosses", /"pairingCode"/.test(sup));
  section("8. stopping is graceful, with a fallback");
  ok("unmount asks the HOST to stop, over its own channel", sup.includes("request_unmount(&m)") && sup.includes("/vh/stop"));
  ok("the channel is nonce-guarded", sup.includes("x-vh-stop-nonce") && sup.includes("stop_nonce"));
  ok("and the nonce travels by environment, never argv", sup.includes('cmd.env("HANDLE_STOP_NONCE"'));
  ok("killing is the FALLBACK, not the plan", sup.includes("did not unmount when asked and had to be killed") && sup.includes("let _ = m.child.kill();"));
  ok("the operator is told which path it took", sup.includes('"graceful": graceful'));
  ok("no unsafe block was needed to do any of it", !sup.includes("unsafe"));
  ok("the operator is told which path it took", /"graceful": graceful/.test(sup));
  ok("quitting uses the same path", sup.includes("request_unmount(&m)") && sup.includes("wait_for_exit(&mut m.child, Duration::from_secs(3))"));
  const server2 = fs.readFileSync(path.join(ROOT, "src", "mission", "a2aServer.ts"), "utf8");
  ok("the unmount endpoint is nonce-guarded, not open", server2.includes("unmount-refused") && server2.includes("x-vh-stop-nonce"));
  ok("it is off unless a nonce was supplied", server2.includes("onStop?:") && server2.includes("opts.onStop = undefined") === false);
  const runtime2 = fs.readFileSync(path.join(ROOT, "src", "mission", "a2aRuntime.ts"), "utf8");
  ok("the host writes its own shutdown line before leaving", runtime2.includes("VH-A2A-STOPPED") && runtime2.includes("shutdownThenExit"));
  ok("a wrong nonce is refused without stopping anything", runtime2.includes("constantTimeEqual(presented, opts.stopNonce"));
  section("9. the endpoint cannot be reached as an A2A method");
  const server = fs.readFileSync(path.join(ROOT, "src", "mission", "a2aServer.ts"), "utf8");
  ok("pairing is a separate path, not an RPC method", server.includes('export const PAIR_PATH = "/vh/pair"') && !server.includes('case "vh/pair"'));
  ok(
    "it is served before the bearer check \u2014 redeeming is what GETS a credential",
    server.indexOf("req.url === PAIR_PATH") < server.indexOf("opts.authorize(req)")
  );
  ok("it answers 404 when the host is not pairing", /not-pairing/.test(server));
  ok("it validates the request rather than trusting it", /needs a code and the peer's identity/.test(server));
  ok("a refusal is specific, not a bare status", /pairing-refused/.test(server));
  const runtime = fs.readFileSync(path.join(ROOT, "src", "mission", "a2aRuntime.ts"), "utf8");
  ok("a paired credential passes the same gate as the host token", runtime.includes("presented === token") && runtime.includes("peers.get(presented)"));
  ok("an expired credential is removed, not merely rejected", runtime.includes("peers.delete(presented)"));
  ok("pairing is off unless the operator asked for it", runtime.includes("pairing?: boolean") && runtime.includes("opts.pairing === true"));
  ok("the spent invitation replaces the live one", runtime.includes("invitation = r.invitation"));
  section("10. the screen states the choice before making it");
  const screen = fs.readFileSync(path.join(ROOT, "src", "ui", "screens", "Federation.tsx"), "utf8");
  ok("both scopes are offered", /federation-bind-local/.test(screen) && /federation-bind-lan/.test(screen));
  ok("local is the default", screen.includes('useState<"local" | "lan">("local")'));
  ok("the screen says there is no wildcard option", screen.includes("There is no &ldquo;everything&rdquo; option"));
  ok("it warns what a network bind exposes", screen.includes("Anything else on the same network can"));
  ok(
    "the pairing code is shown as a one-time code",
    screen.includes("works <strong>once</strong>") && screen.includes("federation-pairing-code")
  );
  ok("and it is explicit that the token is not it", screen.includes("the host&rsquo;s token") || screen.includes("not the host"));
  ok("the live view shows what it is bound to", /federation-bind/.test(screen));
}
async function main() {
  await modelTests();
  await sourceTests();
  console.log(`
${passed} passed, ${failed} failed.`);
  if (failed) {
    console.log(failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}
void main();
