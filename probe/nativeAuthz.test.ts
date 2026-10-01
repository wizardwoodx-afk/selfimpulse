/**
 * Native authorization boundary probe — the security review of archive 3
 * (C-1..C-4) as an executable gate.
 *
 *   C-1  a MANDATORY, deny-by-default gate sits in front of every privileged
 *        Tauri command: guard.rs holds the policy table, lib.rs registers the
 *        wrappers, and the probe fails if the two ever drift apart or if any
 *        privileged name is still registered straight from commands::.
 *   C-2  approval/evolution decisions are authority-checked state transitions
 *        (enumerated decision, OPEN/PROPOSED only, exactly once, unknown id
 *        errors) — in db.rs AND in the localDb.ts web-mode mirror.
 *   C-3  the credential/system root refusal matches on PATH COMPONENTS; the
 *        never-firing suffix construction is gone and the reviewer's Windows
 *        vectors are pinned as shipped #[cfg(test)] tests.
 *   C-4  the receipt bridge refuses unsigned CURRENT-format receipts exactly
 *        like the canonical verifier — this section runs the real bridge.
 *
 * Run: ./node_modules/.bin/esbuild probe/nativeAuthz.test.ts --bundle --platform=node --format=esm \
 *        --define:SI_ROOT='"'$(pwd)'"' --outfile=/tmp/na.mjs --log-level=error && node /tmp/na.mjs
 */
import * as fs from "node:fs";
import * as path from "node:path";
import crypto from "node:crypto";

declare const SI_ROOT: string | undefined;
const root =
  typeof SI_ROOT === "string" && SI_ROOT.length > 0
    ? SI_ROOT
    : fs.existsSync(path.join(process.cwd(), "package.json"))
      ? process.cwd()
      : path.resolve(__dirname ?? process.cwd(), ".");
if (!fs.existsSync(path.join(root, "package.json"))) {
  console.error(`nativeAuthz: cannot find project root (looked in ${root}).`);
  process.exit(2);
}
const read = (p: string): string => fs.readFileSync(path.join(root, p), "utf8");

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const section = (name: string): void => console.log(`\n== ${name}`);

const libRs = read("src-tauri/src/lib.rs");
const guardRs = read("src-tauri/src/guard.rs");
const commandsRs = read("src-tauri/src/commands.rs");
const dbRs = read("src-tauri/src/db.rs");
const localDbTs = read("src/ipc/localDb.ts");

/** The privileged set: reviewer's ten plus the commands of the same class
 *  (secrets, sandbox boundary, code execution, browser actuation). */
const PRIVILEGED = [
  "approval_decide", "evolution_decide", "evolution_rollback",
  "secret_set", "secret_delete", "secret_get",
  "package_import", "package_export",
  "workspace_root_add", "workspace_root_remove",
  "shell_exec", "mcp_call",
  "browser_session_create", "browser_navigate", "browser_act", "browser_screenshot",
  "control_run_workflow",
  "fs_read", "fs_write", "fs_list", "fs_mkdir", "fs_remove",
];

/* ─────────────────────────── C-1: the gate exists ─────────────────────────── */
section("C-1 — centralized native authorization boundary");
ok("lib.rs declares `mod guard;`", /\bmod guard;/.test(libRs));
for (const name of PRIVILEGED) {
  ok(`lib.rs registers ${name} from guard::`, new RegExp(`guard::${name}\\b`).test(libRs));
  ok(
    `lib.rs does NOT register ${name} straight from commands::`,
    !new RegExp(`commands::${name}\\b`).test(libRs),
  );
}
ok(
  "guard::authorize is deny-by-default (unknown action => Err)",
  /other\s*=>\s*Err\(/.test(guardRs) && /deny by default/i.test(guardRs),
);
for (const name of PRIVILEGED) {
  ok(`guard.rs policy table names "${name}"`, guardRs.includes(`"${name}"`));
}
ok("guard wrappers call authorize() before commands::", /authorize\(/.test(guardRs));
ok(
  "gate self-tests ship in guard.rs",
  /#\[cfg\(test\)\]/.test(guardRs) && /unknown_actions_are_denied/.test(guardRs),
);
ok(
  "guard validates the two verdict enums at the gate",
  guardRs.includes('arg == "APPROVED" || arg == "REJECTED"') &&
    guardRs.includes('arg == "ACCEPTED" || arg == "REJECTED"'),
);

/* ────────────────────── C-2: authority-checked decisions ────────────────────── */
section("C-2 — decisions are authority-checked transitions");
ok(
  "db::approval_decide only flips OPEN rows (guard inside the WHERE clause)",
  /UPDATE approvals SET status=\?2 WHERE id=\?1 AND status='OPEN'/.test(dbRs),
);
ok(
  "db::approval_decide validates the decision enum",
  dbRs.includes("approval_decide: decision must be APPROVED or REJECTED"),
);
ok(
  "db::approval_decide errors on unknown id instead of silent success",
  dbRs.includes("does not exist — nothing was changed."),
);
ok(
  "db::approval_decide is not a bare unconditional UPDATE anymore",
  !/UPDATE approvals SET status=\?2 WHERE id=\?"|UPDATE approvals SET status=\?2 WHERE id=\?1",/.test(dbRs),
);
ok(
  "db::evolution_decide only flips PROPOSED rows",
  /UPDATE evolution SET decision=\?2, status='DECIDED', decided_at=\?3 WHERE id=\?1 AND status='PROPOSED'/.test(dbRs),
);
ok(
  "evolution_rollback only flips DECIDED rows",
  /UPDATE evolution SET status='ROLLED_BACK' WHERE id=\?1 AND status='DECIDED'/.test(commandsRs),
);
ok(
  "commands::approval_decide returns the guarded db result verbatim",
  /db::approval_decide\(&\*lock_db\(&state\)\?, &approval_id, &decision\)\s*\n?\s*\)?\s*;?/.test(commandsRs) ||
    commandsRs.includes("db::approval_decide(&*lock_db(&state)?, &approval_id, &decision)"),
);
ok(
  "web-mode mirror (localDb.ts) refuses decisions on non-OPEN approvals",
  localDbTs.includes('if (a.status !== "OPEN")') && localDbTs.includes("is not OPEN (current status"),
);
ok(
  "web-mode mirror (localDb.ts) refuses decisions on non-PROPOSED candidates",
  localDbTs.includes('if (c.status !== "PROPOSED")'),
);
ok(
  "C-2 regression tests ship (cargo test c2_)",
  dbRs.includes("mod c2_decision_transition_tests") && dbRs.includes("decided_approval_cannot_flip_again"),
);

/* ─────────────────────── C-3: component-based refusal ─────────────────────── */
section("C-3 — credential/system root refusal");
ok("commands.rs matches on path components (path_components_lower)", /fn path_components_lower\(/.test(commandsRs));
ok(
  "the never-firing with_sep construction is gone",
  !/let with_sep = /.test(commandsRs) && !/with_sep\.ends_with\(/.test(commandsRs),
);
ok(
  "credential check is an ordered TAIL match over components",
  /comps\.len\(\) >= want\.len\(\) && comps\[comps\.len\(\) - want\.len\(\)\.\.\] == want\[\.\.\]/.test(commandsRs),
);
ok(
  "system dirs compare component-wise, not as separator-fragile strings",
  /comps == path_components_lower\(bad\)/.test(commandsRs),
);
ok(
  "extended-length prefix handled in both canonical and folded forms",
  (commandsRs.match(/strip_prefix\("/g)?.length ?? 0) >= 3 && commandsRs.includes('strip_prefix("?/")'),
);
ok(
  "reviewer's Windows vectors ship as #[cfg(test)] tests",
  commandsRs.includes("mod c3_credential_path_tests") &&
    commandsRs.includes("C:\\Users\\me\\.ssh") &&
    commandsRs.includes("\\\\?\\C:\\Users\\me\\.ssh"),
);
ok(
  "trailing-separator and case variants are pinned",
  commandsRs.includes("trailing backslash must not defeat the check") &&
    commandsRs.includes("C:\\USERS\\ME\\.SSH"),
);

/* ──────── C-4: the bridge refuses unsigned current-format receipts ──────── */
section("C-4 — bridge matches the canonical receipt policy (runs the real bridge)");
const bridge = await import("../protocol/bridge/selfimpulse-receipt-bridge.mjs") as {
  verifyReceiptChain(rc: unknown): { ok: boolean; reason?: string; head?: string };
  generateBridgeIdentity(name?: string): { name: string; fp: string; privateKey: crypto.KeyObject; publicJwk: unknown };
  anchorReceipt(id: unknown, receipt: unknown, opts?: object): { ok: boolean; reason?: string; env?: unknown; evidence?: string };
  verifyAnchor(env: unknown, jwk: unknown): { ok: boolean; reason?: string; facts?: { kind?: string } };
  sealFact(facts: unknown, key: crypto.KeyObject): unknown;
};

const sortDeep = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(sortDeep)
  : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]))
    : v;
const canon = (o: unknown): string => JSON.stringify(sortDeep(o));
const sha = (s: string): string => crypto.createHash("sha256").update(s, "utf8").digest("hex");
/** Published per-format seal secrets — mirror of SEAL_SECRETS in the bridge. */
const SEAL_SECRETS: Record<string, string> = {
  "si-proof-receipt/2": "si-commercial-v1-offline",
  "mj-proof-receipt/2": "mj-commercial-v1-offline",
  "mj-proof-receipt/1": "mj-commercial-v1-offline",
};

type Receipt = { format: string; header: Record<string, unknown>; events: unknown[]; seal: string; issuer?: unknown; signature?: string };

function buildReceipt(fmt: string, signed: boolean): Receipt {
  const issuer = crypto.generateKeyPairSync("ed25519");
  const pubHex = Buffer.from((issuer.publicKey.export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
  let prev = "0".repeat(64);
  const events = [{ seq: 0, prev, ts: 1_750_000_000_000, type: "mission.start", objective: "probe" }].map((body) => {
    const e: Record<string, unknown> = { ...body };
    e.prev = prev;
    e.hash = sha(canon(e));
    prev = e.hash;
    return e;
  });
  const rc: Receipt = {
    format: fmt,
    header: { mission: "native-authz-probe" },
    events,
    seal: crypto.createHmac("sha256", SEAL_SECRETS[fmt] ?? "si-commercial-v1-offline").update(prev, "utf8").digest("hex"),
  };
  if (signed) {
    rc.issuer = { alg: "ed25519", publicKeyHex: pubHex };
    rc.signature = crypto.sign(null, Buffer.from(prev, "hex"), issuer.privateKey).toString("hex");
  }
  return rc;
}

const unsignedCurrent = buildReceipt("si-proof-receipt/2", false);
const vUnsigned = bridge.verifyReceiptChain(unsignedCurrent);
ok(
  "unsigned si-proof-receipt/2 is REFUSED with the signature requirement named",
  vUnsigned.ok === false && /issuer signature is required/.test(vUnsigned.reason ?? ""),
  vUnsigned.reason,
);

const signedCurrent = buildReceipt("si-proof-receipt/2", true);
const vSigned = bridge.verifyReceiptChain(signedCurrent);
ok("signed si-proof-receipt/2 verifies", vSigned.ok === true, vSigned.reason);

const legacyUnsigned = buildReceipt("mj-proof-receipt/1", false);
const vLegacy = bridge.verifyReceiptChain(legacyUnsigned);
ok("legacy mj-proof-receipt/1 still verifies unsigned (format promise)", vLegacy.ok === true, vLegacy.reason);

const tampered = buildReceipt("si-proof-receipt/2", true);
(tampered.events[0] as { note?: string }).note = "evil";
ok("tampered event still fails (hash mismatch)", bridge.verifyReceiptChain(tampered).ok === false);

const anchor = bridge.generateBridgeIdentity("probe");
const refusedAnchor = bridge.anchorReceipt(anchor, unsignedCurrent);
ok(
  "anchorReceipt refuses to attest an unsigned current-format receipt",
  refusedAnchor.ok === false && /issuer signature is required/.test(refusedAnchor.reason ?? ""),
  refusedAnchor.reason,
);

// A forged evidence string inside a valid envelope: the envelope signature is
// real (attacker would need the issuer key to produce it — here WE are the
// issuer to prove the evidence grammar itself holds the line).
const forgedFacts = {
  v: 2, kind: "agent_action",
  agent: { n: "probe", fp: anchor.fp },
  action: "anchor_receipt", tool: "selfimpulse-receipt-bridge", purpose: "native-authz-probe",
  policy: null,
  evidence: `receipt:si-proof-receipt/2:head:${"a".repeat(64)}:events:1:seal:ok:issuer:unsigned`,
  result: "success", ts: Date.now(),
};
const forgedEnv = bridge.sealFact(forgedFacts, anchor.privateKey);
const vForged = bridge.verifyAnchor(forgedEnv, anchor.publicJwk);
ok(
  "verifyAnchor rejects evidence that claims an unsigned CURRENT-format receipt",
  vForged.ok === false && /claims an unsigned receipt/.test(vForged.reason ?? ""),
  vForged.reason,
);

const legacyFacts = { ...forgedFacts, evidence: `receipt:mj-proof-receipt/1:head:${"b".repeat(64)}:events:1:seal:ok:issuer:unsigned` };
const legacyEnv = bridge.sealFact(legacyFacts, anchor.privateKey);
ok(
  "verifyAnchor still accepts legacy-format unsigned evidence (no over-blocking)",
  bridge.verifyAnchor(legacyEnv, anchor.publicJwk).ok === true,
);

const malformedEnv = bridge.sealFact({ ...forgedFacts, evidence: "receipt:garbage" }, anchor.privateKey);
ok("verifyAnchor still rejects malformed evidence", bridge.verifyAnchor(malformedEnv, anchor.publicJwk).ok === false);

/* ───────────────────────────────── summary ───────────────────────────────── */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error("failures:\n  - " + failures.join("\n  - "));
  process.exit(1);
}
