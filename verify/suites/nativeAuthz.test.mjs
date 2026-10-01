import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// protocol/bridge/selfimpulse-receipt-bridge.mjs
var selfimpulse_receipt_bridge_exports = {};
__export(selfimpulse_receipt_bridge_exports, {
  anchorReceipt: () => anchorReceipt,
  buildAnchorFact: () => buildAnchorFact,
  generateBridgeIdentity: () => generateBridgeIdentity,
  issuerFingerprint: () => issuerFingerprint,
  openFact: () => openFact,
  receiptEvidence: () => receiptEvidence,
  sealFact: () => sealFact,
  verifyAnchor: () => verifyAnchor,
  verifyReceiptChain: () => verifyReceiptChain
});
import crypto from "node:crypto";
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  }
  return v;
}
function generateBridgeIdentity(name = "bridge") {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const fp = sha256hex(`${jwk.crv}|${jwk.x}|${jwk.y}`).slice(0, 16).toUpperCase();
  return { name, fp, publicKey, privateKey, publicJwk: jwk };
}
function sealFact(facts, privateKey) {
  const p = JSON.stringify(facts);
  const n = crypto.randomBytes(16).toString("hex");
  const ts = Date.now();
  const sig = crypto.sign(
    "sha256",
    Buffer.from(`${p}|${n}|${ts}`, "utf8"),
    { key: privateKey, dsaEncoding: "ieee-p1363" }
  );
  return { p, n, ts, sig: b64e(sig) };
}
function openFact(env, signerPublicJwk, { windowMs = 5 * 6e4 } = {}) {
  if (!env || typeof env.p !== "string" || typeof env.n !== "string" || typeof env.ts !== "number")
    return { payload: null, verified: false, reason: "malformed-envelope" };
  if (env.n.length < 16 || env.n.length > 64)
    return { payload: null, verified: false, reason: "invalid-nonce-length" };
  if (Math.abs(Date.now() - env.ts) > windowMs)
    return { payload: null, verified: false, reason: "stale-envelope" };
  let ok2 = false;
  try {
    const key = crypto.createPublicKey({ key: signerPublicJwk, format: "jwk" });
    ok2 = crypto.verify(
      "sha256",
      Buffer.from(`${env.p}|${env.n}|${env.ts}`, "utf8"),
      { key, dsaEncoding: "ieee-p1363" },
      b64d(env.sig)
    );
  } catch {
    ok2 = false;
  }
  if (!ok2) return { payload: null, verified: false, reason: "bad-signature" };
  try {
    return { payload: JSON.parse(env.p), verified: true };
  } catch {
    return { payload: null, verified: false, reason: "unparseable-payload" };
  }
}
function verifyReceiptChain(rc) {
  if (!rc || typeof rc !== "object") return { ok: false, reason: "not-a-receipt" };
  if (!SEAL_SECRETS[rc.format]) return { ok: false, reason: `unknown format ${rc.format}` };
  if (!Array.isArray(rc.events)) return { ok: false, reason: "missing events" };
  let prev = GENESIS;
  for (const e of rc.events) {
    if (e.prev !== prev) return { ok: false, reason: `chain broken at seq ${e.seq}` };
    const { hash, ...body } = e;
    if (sha256hex(canon(body)) !== hash) return { ok: false, reason: `hash mismatch at seq ${e.seq}` };
    prev = hash;
  }
  if (hmacHex(prev, rc.format) !== rc.seal) return { ok: false, reason: "seal mismatch" };
  if (rc.format === "si-proof-receipt/2" && !rc.signature) {
    return {
      ok: false,
      reason: `receipt carries no issuer signature${rc.signatureNote ? ` (${rc.signatureNote})` : ""}. For si-proof-receipt/2 an issuer signature is required: without it the chain attests only tamper-evidence against anyone who knows the published seal secret, not authorship.`
    };
  }
  if (rc.signature) {
    if (!rc.issuer?.publicKeyHex || !/^[0-9a-fA-F]{64}$/.test(rc.issuer.publicKeyHex))
      return { ok: false, reason: "receipt is signed but carries no issuer public key" };
    const spki = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(rc.issuer.publicKeyHex, "hex")]);
    const okSig = crypto.verify(
      null,
      Buffer.from(prev, "hex"),
      crypto.createPublicKey({ key: spki, format: "der", type: "spki" }),
      Buffer.from(rc.signature, "hex")
    );
    if (!okSig) return { ok: false, reason: `issuer signature verification FAILED for chain head ${prev}` };
  }
  return { ok: true, head: prev, events: rc.events.length, signed: Boolean(rc.signature) };
}
function issuerFingerprint(publicKeyHex) {
  return sha256hex(Buffer.from(publicKeyHex, "hex").toString("latin1")).slice(0, 16);
}
function receiptEvidence(rc, verdict) {
  const issuer = rc.signature && rc.issuer?.publicKeyHex ? `issuer:${issuerFingerprint(rc.issuer.publicKeyHex)}` : "issuer:unsigned";
  return `receipt:${rc.format}:head:${verdict.head}:events:${verdict.events}:seal:ok:${issuer}`;
}
function buildAnchorFact({ receipt, verdict, agent, purpose = "cross-org-proof-anchoring" }) {
  if (!verdict?.ok) throw new Error("buildAnchorFact: receipt must be verified first");
  if (!agent?.fp || typeof agent.fp !== "string") throw new Error("buildAnchorFact: agent.fp required");
  return {
    v: 2,
    kind: "agent_action",
    agent: { n: String(agent.name ?? "").trim().slice(0, 60), fp: agent.fp },
    action: "anchor_receipt",
    tool: "selfimpulse-receipt-bridge",
    purpose: String(purpose).trim().slice(0, 200),
    policy: null,
    evidence: receiptEvidence(receipt, verdict).slice(0, 2e3),
    result: "success",
    ts: Date.now()
  };
}
function anchorReceipt(identity, receipt, { purpose } = {}) {
  const verdict = verifyReceiptChain(receipt);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const facts = buildAnchorFact({ receipt, verdict, agent: { name: identity.name, fp: identity.fp }, purpose });
  const env = sealFact(facts, identity.privateKey);
  return { ok: true, env, facts, verdict, evidence: facts.evidence };
}
function verifyAnchor(env, signerPublicJwk) {
  const opened = openFact(env, signerPublicJwk);
  if (!opened.verified) return { ok: false, reason: opened.reason };
  const facts = opened.payload;
  if (facts?.kind !== "agent_action" || facts.action !== "anchor_receipt")
    return { ok: false, reason: "not-an-anchor-fact" };
  const m = /^receipt:([a-z0-9/-]+):head:[0-9a-f]{64}:events:\d+:seal:ok:(issuer:[0-9a-f]{16}|issuer:unsigned)$/.exec(facts.evidence ?? "");
  if (!m) return { ok: false, reason: "malformed-anchor-evidence" };
  if (m[1] === "si-proof-receipt/2" && m[2] === "issuer:unsigned")
    return { ok: false, reason: "current-format anchor evidence claims an unsigned receipt" };
  return { ok: true, facts };
}
var SEAL_SECRETS, ED25519_SPKI_PREFIX, GENESIS, canon, sha256hex, hmacHex, b64e, b64d;
var init_selfimpulse_receipt_bridge = __esm({
  "protocol/bridge/selfimpulse-receipt-bridge.mjs"() {
    "use strict";
    SEAL_SECRETS = {
      "si-proof-receipt/2": "si-commercial-v1-offline",
      "mj-proof-receipt/2": "mj-commercial-v1-offline",
      "mj-proof-receipt/1": "mj-commercial-v1-offline"
    };
    ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
    GENESIS = "0".repeat(64);
    canon = (o) => JSON.stringify(sortDeep(o));
    sha256hex = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
    hmacHex = (s, format) => crypto.createHmac("sha256", SEAL_SECRETS[format]).update(s, "utf8").digest("hex");
    b64e = (buf) => Buffer.from(buf).toString("base64");
    b64d = (s) => Buffer.from(s, "base64");
  }
});

// probe/nativeAuthz.test.ts
import * as fs from "node:fs";
import * as path from "node:path";
import crypto2 from "node:crypto";
var root = ".".length > 0 ? "." : fs.existsSync(path.join(process.cwd(), "package.json")) ? process.cwd() : path.resolve(__dirname ?? process.cwd(), ".");
if (!fs.existsSync(path.join(root, "package.json"))) {
  console.error(`nativeAuthz: cannot find project root (looked in ${root}).`);
  process.exit(2);
}
var read = (p) => fs.readFileSync(path.join(root, p), "utf8");
var pass = 0;
var fail = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}
var section = (name) => console.log(`
== ${name}`);
var libRs = read("src-tauri/src/lib.rs");
var guardRs = read("src-tauri/src/guard.rs");
var commandsRs = read("src-tauri/src/commands.rs");
var dbRs = read("src-tauri/src/db.rs");
var localDbTs = read("src/ipc/localDb.ts");
var PRIVILEGED = [
  "approval_decide",
  "evolution_decide",
  "evolution_rollback",
  "secret_set",
  "secret_delete",
  "secret_get",
  "package_import",
  "package_export",
  "workspace_root_add",
  "workspace_root_remove",
  "shell_exec",
  "mcp_call",
  "browser_session_create",
  "browser_navigate",
  "browser_act",
  "browser_screenshot",
  "control_run_workflow",
  "fs_read",
  "fs_write",
  "fs_list",
  "fs_mkdir",
  "fs_remove"
];
section("C-1 \u2014 centralized native authorization boundary");
ok("lib.rs declares `mod guard;`", /\bmod guard;/.test(libRs));
for (const name of PRIVILEGED) {
  ok(`lib.rs registers ${name} from guard::`, new RegExp(`guard::${name}\\b`).test(libRs));
  ok(
    `lib.rs does NOT register ${name} straight from commands::`,
    !new RegExp(`commands::${name}\\b`).test(libRs)
  );
}
ok(
  "guard::authorize is deny-by-default (unknown action => Err)",
  /other\s*=>\s*Err\(/.test(guardRs) && /deny by default/i.test(guardRs)
);
for (const name of PRIVILEGED) {
  ok(`guard.rs policy table names "${name}"`, guardRs.includes(`"${name}"`));
}
ok("guard wrappers call authorize() before commands::", /authorize\(/.test(guardRs));
ok(
  "gate self-tests ship in guard.rs",
  /#\[cfg\(test\)\]/.test(guardRs) && /unknown_actions_are_denied/.test(guardRs)
);
ok(
  "guard validates the two verdict enums at the gate",
  guardRs.includes('arg == "APPROVED" || arg == "REJECTED"') && guardRs.includes('arg == "ACCEPTED" || arg == "REJECTED"')
);
section("C-2 \u2014 decisions are authority-checked transitions");
ok(
  "db::approval_decide only flips OPEN rows (guard inside the WHERE clause)",
  /UPDATE approvals SET status=\?2 WHERE id=\?1 AND status='OPEN'/.test(dbRs)
);
ok(
  "db::approval_decide validates the decision enum",
  dbRs.includes("approval_decide: decision must be APPROVED or REJECTED")
);
ok(
  "db::approval_decide errors on unknown id instead of silent success",
  dbRs.includes("does not exist \u2014 nothing was changed.")
);
ok(
  "db::approval_decide is not a bare unconditional UPDATE anymore",
  !/UPDATE approvals SET status=\?2 WHERE id=\?"|UPDATE approvals SET status=\?2 WHERE id=\?1",/.test(dbRs)
);
ok(
  "db::evolution_decide only flips PROPOSED rows",
  /UPDATE evolution SET decision=\?2, status='DECIDED', decided_at=\?3 WHERE id=\?1 AND status='PROPOSED'/.test(dbRs)
);
ok(
  "evolution_rollback only flips DECIDED rows",
  /UPDATE evolution SET status='ROLLED_BACK' WHERE id=\?1 AND status='DECIDED'/.test(commandsRs)
);
ok(
  "commands::approval_decide returns the guarded db result verbatim",
  /db::approval_decide\(&\*lock_db\(&state\)\?, &approval_id, &decision\)\s*\n?\s*\)?\s*;?/.test(commandsRs) || commandsRs.includes("db::approval_decide(&*lock_db(&state)?, &approval_id, &decision)")
);
ok(
  "web-mode mirror (localDb.ts) refuses decisions on non-OPEN approvals",
  localDbTs.includes('if (a.status !== "OPEN")') && localDbTs.includes("is not OPEN (current status")
);
ok(
  "web-mode mirror (localDb.ts) refuses decisions on non-PROPOSED candidates",
  localDbTs.includes('if (c.status !== "PROPOSED")')
);
ok(
  "C-2 regression tests ship (cargo test c2_)",
  dbRs.includes("mod c2_decision_transition_tests") && dbRs.includes("decided_approval_cannot_flip_again")
);
section("C-3 \u2014 credential/system root refusal");
ok("commands.rs matches on path components (path_components_lower)", /fn path_components_lower\(/.test(commandsRs));
ok(
  "the never-firing with_sep construction is gone",
  !/let with_sep = /.test(commandsRs) && !/with_sep\.ends_with\(/.test(commandsRs)
);
ok(
  "credential check is an ordered TAIL match over components",
  /comps\.len\(\) >= want\.len\(\) && comps\[comps\.len\(\) - want\.len\(\)\.\.\] == want\[\.\.\]/.test(commandsRs)
);
ok(
  "system dirs compare component-wise, not as separator-fragile strings",
  /comps == path_components_lower\(bad\)/.test(commandsRs)
);
ok(
  "extended-length prefix handled in both canonical and folded forms",
  (commandsRs.match(/strip_prefix\("/g)?.length ?? 0) >= 3 && commandsRs.includes('strip_prefix("?/")')
);
ok(
  "reviewer's Windows vectors ship as #[cfg(test)] tests",
  commandsRs.includes("mod c3_credential_path_tests") && commandsRs.includes("C:\\Users\\me\\.ssh") && commandsRs.includes("\\\\?\\C:\\Users\\me\\.ssh")
);
ok(
  "trailing-separator and case variants are pinned",
  commandsRs.includes("trailing backslash must not defeat the check") && commandsRs.includes("C:\\USERS\\ME\\.SSH")
);
section("C-4 \u2014 bridge matches the canonical receipt policy (runs the real bridge)");
var bridge = await Promise.resolve().then(() => (init_selfimpulse_receipt_bridge(), selfimpulse_receipt_bridge_exports));
var sortDeep2 = (v) => Array.isArray(v) ? v.map(sortDeep2) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep2(v[k])])) : v;
var canon2 = (o) => JSON.stringify(sortDeep2(o));
var sha = (s) => crypto2.createHash("sha256").update(s, "utf8").digest("hex");
var SEAL_SECRETS2 = {
  "si-proof-receipt/2": "si-commercial-v1-offline",
  "mj-proof-receipt/2": "mj-commercial-v1-offline",
  "mj-proof-receipt/1": "mj-commercial-v1-offline"
};
function buildReceipt(fmt, signed) {
  const issuer = crypto2.generateKeyPairSync("ed25519");
  const pubHex = Buffer.from(issuer.publicKey.export({ format: "jwk" }).x, "base64url").toString("hex");
  let prev = "0".repeat(64);
  const events = [{ seq: 0, prev, ts: 175e10, type: "mission.start", objective: "probe" }].map((body) => {
    const e = { ...body };
    e.prev = prev;
    e.hash = sha(canon2(e));
    prev = e.hash;
    return e;
  });
  const rc = {
    format: fmt,
    header: { mission: "native-authz-probe" },
    events,
    seal: crypto2.createHmac("sha256", SEAL_SECRETS2[fmt] ?? "si-commercial-v1-offline").update(prev, "utf8").digest("hex")
  };
  if (signed) {
    rc.issuer = { alg: "ed25519", publicKeyHex: pubHex };
    rc.signature = crypto2.sign(null, Buffer.from(prev, "hex"), issuer.privateKey).toString("hex");
  }
  return rc;
}
var unsignedCurrent = buildReceipt("si-proof-receipt/2", false);
var vUnsigned = bridge.verifyReceiptChain(unsignedCurrent);
ok(
  "unsigned si-proof-receipt/2 is REFUSED with the signature requirement named",
  vUnsigned.ok === false && /issuer signature is required/.test(vUnsigned.reason ?? ""),
  vUnsigned.reason
);
var signedCurrent = buildReceipt("si-proof-receipt/2", true);
var vSigned = bridge.verifyReceiptChain(signedCurrent);
ok("signed si-proof-receipt/2 verifies", vSigned.ok === true, vSigned.reason);
var legacyUnsigned = buildReceipt("mj-proof-receipt/1", false);
var vLegacy = bridge.verifyReceiptChain(legacyUnsigned);
ok("legacy mj-proof-receipt/1 still verifies unsigned (format promise)", vLegacy.ok === true, vLegacy.reason);
var tampered = buildReceipt("si-proof-receipt/2", true);
tampered.events[0].note = "evil";
ok("tampered event still fails (hash mismatch)", bridge.verifyReceiptChain(tampered).ok === false);
var anchor = bridge.generateBridgeIdentity("probe");
var refusedAnchor = bridge.anchorReceipt(anchor, unsignedCurrent);
ok(
  "anchorReceipt refuses to attest an unsigned current-format receipt",
  refusedAnchor.ok === false && /issuer signature is required/.test(refusedAnchor.reason ?? ""),
  refusedAnchor.reason
);
var forgedFacts = {
  v: 2,
  kind: "agent_action",
  agent: { n: "probe", fp: anchor.fp },
  action: "anchor_receipt",
  tool: "selfimpulse-receipt-bridge",
  purpose: "native-authz-probe",
  policy: null,
  evidence: `receipt:si-proof-receipt/2:head:${"a".repeat(64)}:events:1:seal:ok:issuer:unsigned`,
  result: "success",
  ts: Date.now()
};
var forgedEnv = bridge.sealFact(forgedFacts, anchor.privateKey);
var vForged = bridge.verifyAnchor(forgedEnv, anchor.publicJwk);
ok(
  "verifyAnchor rejects evidence that claims an unsigned CURRENT-format receipt",
  vForged.ok === false && /claims an unsigned receipt/.test(vForged.reason ?? ""),
  vForged.reason
);
var legacyFacts = { ...forgedFacts, evidence: `receipt:mj-proof-receipt/1:head:${"b".repeat(64)}:events:1:seal:ok:issuer:unsigned` };
var legacyEnv = bridge.sealFact(legacyFacts, anchor.privateKey);
ok(
  "verifyAnchor still accepts legacy-format unsigned evidence (no over-blocking)",
  bridge.verifyAnchor(legacyEnv, anchor.publicJwk).ok === true
);
var malformedEnv = bridge.sealFact({ ...forgedFacts, evidence: "receipt:garbage" }, anchor.privateKey);
ok("verifyAnchor still rejects malformed evidence", bridge.verifyAnchor(malformedEnv, anchor.publicJwk).ok === false);
console.log(`
${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error("failures:\n  - " + failures.join("\n  - "));
  process.exit(1);
}
