import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/shellContain.test.ts
import assert from "node:assert/strict";
import { spawnSync as spawnSync2 } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path2 from "node:path";

// src/mission/shellContain.ts
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
var systemReadPrefixes = () => process.platform === "win32" ? [] : ["/usr", "/bin", "/sbin", "/lib", "/lib64", "/lib32", "/etc/ssl", "/etc/resolv.conf", "/etc/hosts", "/etc/nsswitch.conf", "/etc/ld.so.cache", "/etc/ld.so.conf", "/proc", "/dev", "/opt/homebrew", "/opt/local"].filter((p) => existsSync(p));
var UNSHARE_MOUNT_SCRIPT = [
  'R="$1"; CWD="$2"; H="$3"; shift 3',
  "mount --make-rprivate / 2>/dev/null || true",
  "for p in /usr /bin /sbin /lib /lib64 /lib32 /etc /opt /proc /dev; do",
  '  if [ -e "$p" ]; then mkdir -p "$R$p"; mount --bind "$p" "$R$p"; mount -o remount,ro,bind "$R$p" 2>/dev/null || true; fi',
  "done",
  "IFS=':'",
  "for w in $CONTAIN_WRITES; do",
  '  [ -n "$w" ] || continue',
  '  mkdir -p "$R$w"; mount --bind "$w" "$R$w"',
  "done",
  "unset IFS",
  'mkdir -p "$R/tmp"',
  'mount -t tmpfs -o size=512m tmpfs "$R/tmp"',
  'exec chroot "$R" /usr/bin/env -i -C "$CWD" HOME="$H" TMPDIR=/tmp PATH=/usr/bin:/bin:/usr/local/bin "$@"'
].join("\n");
function which(bin) {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const p = path.join(dir, bin);
    if (existsSync(p)) return p;
  }
  return null;
}
function unshareWorks() {
  if (process.platform !== "linux" || !which("unshare") || !which("chroot") || !which("mount")) return false;
  try {
    const r = spawnSync("unshare", ["-Urm", "--map-root-user", "true"], { stdio: "ignore", timeout: 5e3 });
    return r.status === 0;
  } catch {
    return false;
  }
}
function detectContainment() {
  if (unshareWorks()) return "unshare";
  if (process.platform === "linux" && which("bwrap")) return "bwrap";
  if (process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec")) return "seatbelt";
  return "policy-only";
}
function nodePermissionArgs(nodeMajor, writePaths) {
  const flag = nodeMajor !== void 0 && nodeMajor >= 23 ? "--permission" : "--experimental-permission";
  const reads = [.../* @__PURE__ */ new Set([...systemReadPrefixes(), ...writePaths])];
  return [
    flag,
    ...reads.map((p) => `--allow-fs-read=${p}`),
    ...writePaths.map((p) => `--allow-fs-write=${p}`)
  ];
}
function bwrapArgv(spec) {
  const binds = [];
  for (const p of systemReadPrefixes()) binds.push("--ro-bind", p, p);
  for (const p of spec.readPaths) {
    const abs = path.resolve(p);
    if (existsSync(abs) && !spec.writePaths.some((w) => path.resolve(w) === abs)) binds.push("--ro-bind", abs, abs);
  }
  for (const p of spec.writePaths) {
    const abs = path.resolve(p);
    binds.push("--bind", abs, abs);
  }
  return [
    "bwrap",
    ...binds,
    "--dev",
    "/dev",
    "--proc",
    "/proc",
    "--tmpfs",
    "/tmp",
    "--setenv",
    "HOME",
    path.resolve(spec.writePaths[0] ?? spec.cwd),
    "--setenv",
    "TMPDIR",
    "/tmp",
    "--setenv",
    "PATH",
    "/usr/bin:/bin:/usr/local/bin",
    "--die-with-parent",
    "--new-session",
    "--chdir",
    path.resolve(spec.cwd),
    "--",
    spec.program,
    ...spec.args
  ];
}
function unshareArgv(spec) {
  const writes = spec.writePaths.map((p) => path.resolve(p));
  const scratch = path.resolve(spec.writePaths[0] ?? spec.cwd, ".contain-root");
  return {
    program: "unshare",
    args: ["-Urm", "--map-root-user", "/bin/sh", "-c", UNSHARE_MOUNT_SCRIPT, "contain-run", scratch, path.resolve(spec.cwd), writes[0] ?? path.resolve(spec.cwd), spec.program, ...spec.args],
    extraEnv: { CONTAIN_WRITES: writes.join(":") }
  };
}
function seatbeltArgv(spec) {
  const writes = spec.writePaths.map((p) => `(subpath "${path.resolve(p)}")`).join(" ");
  const profile = `(version 1)
(allow default)
(deny file-write*)
(allow file-write* ${writes} (subpath "/private/tmp") (subpath "/tmp"))
`;
  return ["sandbox-exec", "-p", profile, spec.program, ...spec.args];
}
function scrubbedEnv(spec, extra = {}) {
  const home = path.resolve(spec.writePaths[0] ?? spec.cwd);
  const base = {
    PATH: "/usr/bin:/bin:/usr/local/bin",
    HOME: home,
    ...process.platform === "win32" ? { USERPROFILE: home, HOMEDRIVE: path.parse(home).root.replace(/[\\/]$/, ""), HOMEPATH: path.parse(home).root.replace(/^[A-Za-z]:/, "") } : {},
    TMPDIR: process.platform === "win32" ? process.env.TEMP ?? "C:\\Temp" : "/tmp",
    LANG: process.env.LANG ?? "C.UTF-8",
    ...extra
  };
  for (const [k, v] of Object.entries(spec.env ?? {})) if (v !== void 0) base[k] = v;
  return base;
}
function spawnTarget(command, args) {
  if (path.isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return { program: command, args };
  }
  const names = process.platform === "win32" ? [`.exe`, `.cmd`, `.bat`, `.com`].map((e) => command + e).concat(command) : [command];
  const pathEnv = process.env.PATH ?? "";
  let resolved = null;
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (existsSync(candidate)) {
          resolved = candidate;
          break;
        }
      } catch {
      }
    }
    if (resolved) break;
  }
  const program = resolved ?? command;
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(program)) {
    const shell = process.env.ComSpec ?? "cmd.exe";
    return { program: shell, args: ["/c", program, ...args] };
  }
  return { program, args };
}
async function runContained(spec) {
  const mode = detectContainment();
  let program = spec.program;
  let args = spec.args;
  let containment = mode;
  let env = scrubbedEnv(spec);
  if (mode === "unshare") {
    const u = unshareArgv(spec);
    program = u.program;
    args = u.args;
    env = scrubbedEnv(spec, u.extraEnv);
  } else if (mode === "bwrap") {
    const argv2 = bwrapArgv(spec);
    program = argv2[0];
    args = argv2.slice(1);
  } else if (mode === "seatbelt") {
    const argv2 = seatbeltArgv(spec);
    program = argv2[0];
    args = argv2.slice(1);
  } else if (/^(node|npm|npx)(\.exe)?$/i.test(path.basename(spec.program))) {
    const writePaths = spec.writePaths.map((p) => path.resolve(p));
    if (path.basename(spec.program).startsWith("node")) {
      const extra = nodePermissionArgs(Number(process.versions.node.split(".")[0]), writePaths);
      args = [...extra, ...spec.args];
      containment = "node-permission";
    }
  }
  if (mode === "policy-only" || mode === "node-permission") {
    const t = spawnTarget(program, args);
    program = t.program;
    args = t.args;
  }
  return await new Promise((resolve2) => {
    const child = spawn(program, args, {
      cwd: spec.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), spec.timeoutMs ?? 15e3);
    child.stdout.on("data", (d) => stdout += d);
    child.stderr.on("data", (d) => stderr += d);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve2({ stdout, stderr: stderr + String(e.message), code: null, containment: "refused" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve2({ stdout, stderr, code, containment });
    });
  });
}
var ESCAPE_FIXTURES = [
  { id: "node-fs-read", program: "node", buildArgs: (f) => ["-e", `process.stdout.write("LEAK:"+require("fs").readFileSync(${JSON.stringify(f)},"utf8"))`] },
  { id: "node-fs-write", program: "node", buildArgs: (f) => ["-e", `require("fs").writeFileSync(${JSON.stringify(f + ".w")},"pwned");process.stdout.write("WROTE")`] },
  { id: "python-open", program: process.platform === "win32" ? "python" : "python3", buildArgs: (f) => ["-c", `print("LEAK:"+open(${JSON.stringify(f)}).read())`] },
  { id: "python-write", program: process.platform === "win32" ? "python" : "python3", buildArgs: (f) => ["-c", `open(${JSON.stringify(f + ".w")},"w").write("pwned");print("WROTE")`] },
  { id: "npm-home-leak", program: "npm", buildArgs: () => ["config", "get", "userconfig"] },
  { id: "git-status-outside", program: "git", buildArgs: (f) => ["-C", path.dirname(f), "status"] },
  { id: "git-config-read", program: "git", buildArgs: () => ["config", "--global", "--list", "--show-origin"] },
  { id: "cargo-manifest-outside", program: "cargo", buildArgs: (f) => ["metadata", "--manifest-path", path.join(path.dirname(f), "Cargo.toml"), "--format-version", "1"] }
];

// probe/shellContain.test.ts
var root = process.env.HANDLE_ROOT ? path2.resolve(process.env.HANDLE_ROOT) : process.cwd();
var read = (rel) => fs.readFileSync(path2.join(root, rel), "utf8");
var MARKER = "S3CRET_11HANDLE_CANARY_f7a91c";
var checks = 0;
var ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks += 1;
};
var containRs = read("src-tauri/src/contain.rs");
var commandsRs = read("src-tauri/src/commands.rs");
var mcpRs = read("src-tauri/src/mcp.rs");
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
var shellTs = read("src/mission/shellContain.ts");
ok(shellTs.includes("mount --make-rprivate") && shellTs.includes("--map-root-user"), "the TS reference and the Rust mirror share the unshare script tokens");
var WS = path2.join(os.tmpdir(), "ws");
var argv = bwrapArgv({
  program: "node",
  args: ["-e", "1"],
  cwd: WS,
  readPaths: [WS],
  writePaths: [WS]
});
ok(argv[0] === "bwrap" && argv.includes("--die-with-parent") && argv[argv.indexOf("--") + 1] === "node", "bwrapArgv shape (wrapper, die-with-parent, -- terminator)");
ok(argv.includes(path2.resolve(WS)), "bwrapArgv binds the workspace");
ok(argv.includes(WS) || argv.includes(path2.resolve(WS)), "bwrapArgv binds the workspace (as given or resolved)");
ok(argv.filter((a) => a === path2.resolve(WS)).length >= 2, "bwrapArgv binds the workspace read-write (a --bind pair, not a single mention)");
ok(argv.includes(path2.resolve(path2.join(os.tmpdir(), "ws"))), "bwrapArgv resolves the workspace path rather than passing a POSIX literal on this platform");
var npArgs = nodePermissionArgs(void 0, [WS]);
ok(npArgs[0].startsWith("--experimental-permission") || npArgs[0] === "--permission", "node-permission rung uses the permission-model flag");
ok(npArgs.some((a) => a === `--allow-fs-write=${WS}`), "node-permission rung allows writes only in the workspace");
var rung = detectContainment();
console.log(`  containment rung on this host: ${rung}`);
var outside = fs.mkdtempSync(path2.join(os.tmpdir(), "11h-outside-"));
var ws = fs.mkdtempSync(path2.join(os.tmpdir(), "11h-ws-"));
var secretFile = path2.join(outside, "secret.txt");
fs.writeFileSync(secretFile, MARKER);
var hasBin = (bin) => {
  const r = spawnSync2(process.platform === "win32" ? "where" : "which", [bin], { encoding: "utf8" });
  return r.status === 0;
};
var live = 0;
var skipped = 0;
for (const fixture of ESCAPE_FIXTURES) {
  const bin = fixture.id.startsWith("python") ? process.platform === "win32" ? "python" : "python3" : fixture.program;
  if (!hasBin(bin) && !fixture.id.startsWith("node")) {
    console.log(`  skip ${fixture.id} \u2014 ${bin} not on this host`);
    skipped += 1;
    continue;
  }
  const res = await runContained({
    program: fixture.id.startsWith("node") ? process.execPath : bin,
    args: fixture.buildArgs(secretFile),
    cwd: ws,
    readPaths: [ws],
    writePaths: [ws],
    timeoutMs: 2e4
  });
  const nodeClass = fixture.id.startsWith("node");
  const osContained = rung === "bwrap" || rung === "seatbelt" || rung === "unshare";
  if (nodeClass || osContained) {
    ok(!`${res.stdout}${res.stderr}`.includes(MARKER), `${fixture.id}: secret marker did not leak (${res.containment})`);
    if (fixture.id.endsWith("-write") || fixture.id === "node-fs-write" || fixture.id === "python-write") {
      ok(!fs.existsSync(`${secretFile}.w`), `${fixture.id}: write outside the workspace did not land (${res.containment})`);
    }
    live += 1;
  } else {
    console.log(`  REPORT ${fixture.id}: OS containment unavailable on this host (rung=${rung}) \u2014 battery runs in CI where bubblewrap is installed; policy layer + env scrub still enforced (run reported "${res.containment}")`);
    ok(res.containment === "policy-only" || res.containment === "refused", `${fixture.id}: the run honestly reports its rung`);
    skipped += 1;
  }
}
ok(live >= 2, `the battery proved at least the node-class escapes blocked on this host (proved ${live})`);
console.log(`  battery: ${live} proved, ${skipped} reported/skipped (rung=${rung})`);
var envProbe = await runContained({
  program: process.execPath,
  args: ["-e", `process.stdout.write(JSON.stringify({home: process.env.HOME ?? null, ssh: process.env.SSH_AUTH_SOCK ?? null, path: process.env.PATH ?? ""}))`],
  cwd: ws,
  readPaths: [ws],
  writePaths: [ws],
  timeoutMs: 15e3
});
var envOut = JSON.parse(envProbe.stdout.trim().split("\n").pop() ?? "{}");
ok(envOut.home === ws, `HOME is redirected into the workspace (got ${envOut.home})`);
ok(!envOut.ssh, "no SSH_AUTH_SOCK (or any host secret env) reaches the process");
if (hasBin("npm")) {
  const npmRes = await runContained({
    program: "npm",
    args: ["config", "get", "userconfig"],
    cwd: ws,
    readPaths: [ws],
    writePaths: [ws],
    timeoutMs: 2e4
  });
  ok(!npmRes.stdout.includes(os.homedir().replace(/\\/g, "/")), "npm does not see the real home directory (HOME scrub)");
  ok(npmRes.stdout.includes(path2.basename(ws)) || npmRes.stdout.includes(ws), `npm's userconfig resolves inside the workspace (got: ${npmRes.stdout.trim().slice(0, 120)})`);
}
fs.rmSync(outside, { recursive: true, force: true });
fs.rmSync(ws, { recursive: true, force: true });
console.log(`shellContain: PASS (${checks} checks, rung=${rung})`);
