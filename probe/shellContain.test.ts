/**
 * probe · shellContain — the host-escape battery.
 *
 * Proves, adversarially, that a mission restricted to workspace X cannot use
 * node / python / npm / git / cargo / MCP-style processes to escape X and read
 * or write arbitrary host files. What this host cannot prove, the suite REPORTS
 * (containment rung per run) instead of pretending — a green run here always
 * names the boundary it actually exercised.
 *
 *   1. SPEC PINS — the native runner (contain.rs / commands.rs) carries the same
 *      containment builders as the reference implementation, so the two cannot
 *      drift silently.
 *   2. LIVE BATTERY — every ESCAPE_FIXTURES attempt runs through `runContained`
 *      against a planted secret OUTSIDE the workspace; the marker must never
 *      appear in any output and write attempts must not land.
 *   3. ENV SCRUB — HOME is redirected into the workspace; no host env leaks.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  ESCAPE_FIXTURES,
  bwrapArgv,
  detectContainment,
  nodePermissionArgs,
  runContained,
} from "../src/mission/shellContain";

const root = process.env.IMPULSE_ROOT ? path.resolve(process.env.IMPULSE_ROOT as string) : process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(root, rel), "utf8");
const MARKER = "S3CRET_SELFIMPULSE_CANARY_f7a91c";

let checks = 0;
const ok = (cond: boolean, msg: string): void => {
  assert.ok(cond, msg);
  checks += 1;
};

/* ---------------------------------------------------------- 1. spec pins */
const containRs = read("src-tauri/src/contain.rs");
const commandsRs = read("src-tauri/src/commands.rs");
const mcpRs = read("src-tauri/src/mcp.rs");
for (const flag of ["--ro-bind", "--bind", "--die-with-parent", "--new-session", "--tmpfs", "--chdir", "env_clear"]) {
  ok(containRs.includes(flag), `contain.rs carries the ${flag} containment flag`);
}
for (const token of ["-Urm", "--map-root-user", "mount --make-rprivate", "chroot", "tmpfs"]) {
  ok(containRs.includes(token), `contain.rs carries the unshare rung token ${token}`);
}
ok(containRs.includes("sandbox-exec") && containRs.includes("--experimental-permission"), "contain.rs carries the seatbelt + node-permission rungs");
ok(/contain::wrap_command/.test(commandsRs), "shell_exec/cli_invoke route through contain::wrap_command");
ok(/contain::wrap_command/.test(mcpRs) || /contain::/.test(mcpRs), "MCP spawn routes through the containment layer");
ok(/containment/.test(commandsRs), "shell_exec reports the containment rung in its result");
ok(/unshare_works|unshare/.test(containRs), "contain.rs probes the unshare rung at runtime");
const shellTs = read("src/mission/shellContain.ts");
ok(shellTs.includes("mount --make-rprivate") && shellTs.includes("--map-root-user"), "the TS reference and the Rust mirror share the unshare script tokens");

/* builder unit checks */
/* 19.8 — this used to assert `argv.includes("/tmp/ws")` against a hard-coded
   POSIX literal. `bwrapArgv` normalises through `path.resolve`, which on win32
   yields `C:\tmp\ws`, so the assertion failed on Windows while the BUILDER WAS
   CORRECT — the probe was asserting a platform string instead of the contract.
   The contract is "the workspace the caller asked for is bound into the argv,
   resolved the same way the implementation resolves it". That is what is pinned
   now, on every platform, and it is a STRONGER pin than the literal: a builder
   that stopped binding the workspace would still fail here. */
const WS = path.join(os.tmpdir(), "ws");
const argv = bwrapArgv({
  program: "node",
  args: ["-e", "1"],
  cwd: WS,
  readPaths: [WS],
  writePaths: [WS],
});
ok(argv[0] === "bwrap" && argv.includes("--die-with-parent") && argv[argv.indexOf("--") + 1] === "node", "bwrapArgv shape (wrapper, die-with-parent, -- terminator)");
ok(argv.includes(path.resolve(WS)), "bwrapArgv binds the workspace");
ok(argv.includes(WS) || argv.includes(path.resolve(WS)), "bwrapArgv binds the workspace (as given or resolved)");
ok(argv.filter((a) => a === path.resolve(WS)).length >= 2, "bwrapArgv binds the workspace read-write (a --bind pair, not a single mention)");
ok(argv.includes(path.resolve(path.join(os.tmpdir(), "ws"))), "bwrapArgv resolves the workspace path rather than passing a POSIX literal on this platform");
const npArgs = nodePermissionArgs(undefined, [WS]);
ok(npArgs[0].startsWith("--experimental-permission") || npArgs[0] === "--permission", "node-permission rung uses the permission-model flag");
ok(npArgs.some((a) => a === `--allow-fs-write=${WS}`), "node-permission rung allows writes only in the workspace");

/* ------------------------------------------------------- 2. live battery */
const rung = detectContainment();
console.log(`  containment rung on this host: ${rung}`);
const outside = fs.mkdtempSync(path.join(os.tmpdir(), "11h-outside-"));
const ws = fs.mkdtempSync(path.join(os.tmpdir(), "11h-ws-"));
const secretFile = path.join(outside, "secret.txt");
fs.writeFileSync(secretFile, MARKER);

const hasBin = (bin: string): boolean => {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [bin], { encoding: "utf8" });
  return r.status === 0;
};

let live = 0;
let skipped = 0;
for (const fixture of ESCAPE_FIXTURES) {
  const bin = fixture.id.startsWith("python") ? (process.platform === "win32" ? "python" : "python3") : fixture.program;
  if (!hasBin(bin) && !fixture.id.startsWith("node")) {
    console.log(`  skip ${fixture.id} — ${bin} not on this host`);
    skipped += 1;
    continue;
  }
  const res = await runContained({
    program: fixture.id.startsWith("node") ? process.execPath : bin,
    args: fixture.buildArgs(secretFile),
    cwd: ws,
    readPaths: [ws],
    writePaths: [ws],
    timeoutMs: 20000,
  });
  const nodeClass = fixture.id.startsWith("node");
  const osContained = rung === "bwrap" || rung === "seatbelt" || rung === "unshare";
  if (nodeClass || osContained) {
    // PROVEN class on this host: the marker must not leak and writes must not land.
    ok(!`${res.stdout}${res.stderr}`.includes(MARKER), `${fixture.id}: secret marker did not leak (${res.containment})`);
    if (fixture.id.endsWith("-write") || fixture.id === "node-fs-write" || fixture.id === "python-write") {
      ok(!fs.existsSync(`${secretFile}.w`), `${fixture.id}: write outside the workspace did not land (${res.containment})`);
    }
    live += 1;
  } else {
    // Policy-only host for this program class: REPORT, never pretend.
    console.log(`  REPORT ${fixture.id}: OS containment unavailable on this host (rung=${rung}) — battery runs in CI where bubblewrap is installed; policy layer + env scrub still enforced (run reported "${res.containment}")`);
    ok(res.containment === "policy-only" || res.containment === "refused", `${fixture.id}: the run honestly reports its rung`);
    skipped += 1;
  }
}
ok(live >= 2, `the battery proved at least the node-class escapes blocked on this host (proved ${live})`);
console.log(`  battery: ${live} proved, ${skipped} reported/skipped (rung=${rung})`);

/* ----------------------------------------------------------- 3. env scrub */
const envProbe = await runContained({
  program: process.execPath,
  args: ["-e", `process.stdout.write(JSON.stringify({home: process.env.HOME ?? null, ssh: process.env.SSH_AUTH_SOCK ?? null, path: process.env.PATH ?? ""}))`],
  cwd: ws,
  readPaths: [ws],
  writePaths: [ws],
  timeoutMs: 15000,
});
const envOut = JSON.parse(envProbe.stdout.trim().split("\n").pop() ?? "{}") as { home?: string | null; ssh?: string | null };
ok(envOut.home === ws, `HOME is redirected into the workspace (got ${envOut.home})`);
ok(!envOut.ssh, "no SSH_AUTH_SOCK (or any host secret env) reaches the process");

/* npm HOME leak: `npm config get userconfig` must resolve INSIDE the workspace */
if (hasBin("npm")) {
  const npmRes = await runContained({
    program: "npm",
    args: ["config", "get", "userconfig"],
    cwd: ws,
    readPaths: [ws],
    writePaths: [ws],
    timeoutMs: 20000,
  });
  ok(!npmRes.stdout.includes(os.homedir().replace(/\\/g, "/")), "npm does not see the real home directory (HOME scrub)");
  ok(npmRes.stdout.includes(path.basename(ws)) || npmRes.stdout.includes(ws), `npm's userconfig resolves inside the workspace (got: ${npmRes.stdout.trim().slice(0, 120)})`);
}

fs.rmSync(outside, { recursive: true, force: true });
fs.rmSync(ws, { recursive: true, force: true });
console.log(`shellContain: PASS (${checks} checks, rung=${rung})`);
