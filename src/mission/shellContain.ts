/**
 * 11Handle — shell containment (the host-escape boundary).
 *
 * The security boundary of workspace-restricted execution is NOT "cwd is inside
 * the workspace" — a permitted `node`/`python` process inherits the user's OS
 * privileges and can read anything the user can. The boundary is:
 *
 *     agent → policy/gate → CONTAINED executor
 *
 * This module is the single, testable specification of that containment. The
 * native runner (src-tauri/src/contain.rs) mirrors these builders exactly and
 * `probe/shellContain.test.ts` pins both sides to the same flags, then runs a
 * live escape battery through `runContained` on this machine.
 *
 * Containment ladder (strongest available is always used, and the run reports
 * which rung was achieved — never inferred):
 *
 *   unshare        Linux user-namespace + mount-namespace chroot sandbox
 *                  (util-linux `unshare`): system prefixes bound read-only,
 *                  ONLY the workspace is writable, /tmp is a tmpfs, HOME is
 *                  redirected into the workspace. Everything else is absent.
 *   bwrap          Linux bubblewrap, same policy, when installed.
 *   seatbelt       macOS sandbox-exec profile: read ok, writes only inside
 *                  the workspace and scratch.
 *   node-permission  Node's own permission model (--experimental-permission /
 *                  --permission): filesystem allow-list enforced by the Node
 *                  runtime for node programs when no OS sandbox exists.
 *   policy-only    No OS sandbox on this host: allow-list + workspace cwd +
 *                  env scrub ONLY, and the run says so (`containment:
 *                  "policy-only"`). Honest, not silent.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export type ContainmentMode = "unshare" | "bwrap" | "seatbelt" | "node-permission" | "policy-only";

export interface ContainSpec {
  program: string;
  args: string[];
  cwd: string;
  /** Directory trees the process may read (plus system runtime prefixes). */
  readPaths: string[];
  /** Directory trees the process may write (workspace roots + scratch). */
  writePaths: string[];
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export interface ContainResult {
  stdout: string;
  stderr: string;
  code: number | null;
  containment: ContainmentMode | "refused";
}

const systemReadPrefixes = (): string[] =>
  process.platform === "win32"
    ? []
    : ["/usr", "/bin", "/sbin", "/lib", "/lib64", "/lib32", "/etc/ssl", "/etc/resolv.conf", "/etc/hosts", "/etc/nsswitch.conf", "/etc/ld.so.cache", "/etc/ld.so.conf", "/proc", "/dev", "/opt/homebrew", "/opt/local"].filter((p) => existsSync(p));

/** Chroot-mount script run INSIDE the user+ mount namespace. Positional: R CWD HOME + program argv. */
export const UNSHARE_MOUNT_SCRIPT = [
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
  "mount -t tmpfs -o size=512m tmpfs \"$R/tmp\"",
  'exec chroot "$R" /usr/bin/env -i -C "$CWD" HOME="$H" TMPDIR=/tmp PATH=/usr/bin:/bin:/usr/local/bin "$@"',
].join("\n");

function which(bin: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const p = path.join(dir, bin);
    if (existsSync(p)) return p;
  }
  return null;
}

function unshareWorks(): boolean {
  if (process.platform !== "linux" || !which("unshare") || !which("chroot") || !which("mount")) return false;
  try {
    const r = spawnSync("unshare", ["-Urm", "--map-root-user", "true"], { stdio: "ignore", timeout: 5000 });
    return r.status === 0;
  } catch {
    return false;
  }
}

export function detectContainment(): ContainmentMode {
  if (unshareWorks()) return "unshare";
  if (process.platform === "linux" && which("bwrap")) return "bwrap";
  if (process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec")) return "seatbelt";
  return "policy-only";
}

/**
 * Node runtime flags for the node-permission rung (used for node when no OS
 * sandbox exists). Node 20: --experimental-permission; Node >=23: --permission.
 */
export function nodePermissionArgs(nodeMajor: number | undefined, writePaths: string[]): string[] {
  const flag = nodeMajor !== undefined && nodeMajor >= 23 ? "--permission" : "--experimental-permission";
  const reads = [...new Set([...systemReadPrefixes(), ...writePaths])];
  return [
    flag,
    ...reads.map((p) => `--allow-fs-read=${p}`),
    ...writePaths.map((p) => `--allow-fs-write=${p}`),
  ];
}

/** The bwrap builder — mirrored by contain.rs and pinned by the probe. */
export function bwrapArgv(spec: ContainSpec): string[] {
  const binds: string[] = [];
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
    "--dev", "/dev",
    "--proc", "/proc",
    "--tmpfs", "/tmp",
    "--setenv", "HOME", path.resolve(spec.writePaths[0] ?? spec.cwd),
    "--setenv", "TMPDIR", "/tmp",
    "--setenv", "PATH", "/usr/bin:/bin:/usr/local/bin",
    "--die-with-parent",
    "--new-session",
    "--chdir", path.resolve(spec.cwd),
    "--",
    spec.program,
    ...spec.args,
  ];
}

/** The unshare builder — mirrored by contain.rs and pinned by the probe. */
export function unshareArgv(spec: ContainSpec): { program: string; args: string[]; extraEnv: Record<string, string> } {
  const writes = spec.writePaths.map((p) => path.resolve(p));
  const scratch = path.resolve(spec.writePaths[0] ?? spec.cwd, ".contain-root");
  return {
    program: "unshare",
    args: ["-Urm", "--map-root-user", "/bin/sh", "-c", UNSHARE_MOUNT_SCRIPT, "contain-run", scratch, path.resolve(spec.cwd), writes[0] ?? path.resolve(spec.cwd), spec.program, ...spec.args],
    extraEnv: { CONTAIN_WRITES: writes.join(":") },
  };
}

/** The seatbelt builder — macOS. Read-everything, write-only-inside. */
export function seatbeltArgv(spec: ContainSpec): string[] {
  const writes = spec.writePaths.map((p) => `(subpath "${path.resolve(p)}")`).join(" ");
  const profile = `(version 1)\n(allow default)\n(deny file-write*)\n(allow file-write* ${writes} (subpath "/private/tmp") (subpath "/tmp"))\n`;
  return ["sandbox-exec", "-p", profile, spec.program, ...spec.args];
}

function scrubbedEnv(spec: ContainSpec, extra: Record<string, string> = {}): Record<string, string> {
  const home = path.resolve(spec.writePaths[0] ?? spec.cwd);
  /* 19.8 — HOME is the POSIX home variable, and setting ONLY it left every
     Windows tool inside the sandbox with no home at all: the scrub clears the
     environment, and on Windows the toolchain reads `%USERPROFILE%` (npm, git,
     Python, cargo all do), not `HOME`. The observed symptom was `npm config get
     userconfig` printing an EMPTY path inside a contained run — fail-closed, so
     not a leak, but a broken environment that makes contained tooling fail for
     the wrong reason. The native mirror in contain.rs sets the same three. */
  const base: Record<string, string> = {
    PATH: "/usr/bin:/bin:/usr/local/bin",
    HOME: home,
    ...(process.platform === "win32" ? { USERPROFILE: home, HOMEDRIVE: path.parse(home).root.replace(/[\\/]$/, ""), HOMEPATH: path.parse(home).root.replace(/^[A-Za-z]:/, "") } : {}),
    TMPDIR: process.platform === "win32" ? process.env.TEMP ?? "C:\\Temp" : "/tmp",
    LANG: process.env.LANG ?? "C.UTF-8",
    ...extra,
  };
  for (const [k, v] of Object.entries(spec.env ?? {})) if (v !== undefined) base[k] = v;
  return base;
}

/**
 * Run a program under the strongest containment this host offers. The result
 * always reports which rung was achieved — a caller can never mistake
 * policy-only for an OS sandbox.
 */
/**
 * Resolve a program to something spawnable on this platform.
 *
 * Mirrors `resolve_program` / `spawn_target` in src-tauri/src/contain.rs, and
 * exists because the Rust side solved a problem the TypeScript reference never
 * did. 19.8: `runContained` called `spawn(program, args)` directly, and on
 * Windows that cannot execute a `.cmd`/`.bat` at all — npm, npx, python and py
 * all install a shim script rather than a real executable. Every contained run of
 * those tools therefore failed to start. The escape battery did not catch it
 * because the failures were REPORTED as "skipped" instead of being failures, so
 * a containment layer that could not launch half its fixtures still read green.
 *
 * Two steps, in this order:
 *   1. a bare name is searched on PATH with the extensions `PATHEXT` supplies,
 *      in the order Windows itself prefers — the bare name LAST, because npm
 *      installs an extensionless POSIX shim alongside `npm.cmd` and matching it
 *      first finds a bash script that cannot run at all;
 *   2. a resolved `.cmd`/`.bat` is launched as `cmd.exe /c <file> <args...>`,
 *      because Windows cannot `CreateProcess` a batch file.
 */
export function spawnTarget(command: string, args: string[]): { program: string; args: string[] } {
  if (path.isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return { program: command, args };
  }
  const names = process.platform === "win32"
    ? [`.exe`, `.cmd`, `.bat`, `.com`].map((e) => command + e).concat(command)
    : [command];
  const pathEnv = process.env.PATH ?? "";
  let resolved: string | null = null;
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (existsSync(candidate)) { resolved = candidate; break; }
      } catch { /* an unreadable PATH entry is not a reason to stop searching */ }
    }
    if (resolved) break;
  }
  // Nothing found: return the name unchanged so the spawn error still names what
  // the caller asked for, rather than a path the configuration never wrote.
  const program = resolved ?? command;
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(program)) {
    const shell = process.env.ComSpec ?? "cmd.exe";
    return { program: shell, args: ["/c", program, ...args] };
  }
  return { program, args };
}

/**
 * Run the command under the strongest containment available and report which
 * rung was actually achieved — a caller can never mistake
 * policy-only for an OS sandbox.
 */
export async function runContained(spec: ContainSpec): Promise<ContainResult> {
  const mode = detectContainment();
  let program = spec.program;
  let args = spec.args;
  let containment: ContainResult["containment"] = mode;
  let env = scrubbedEnv(spec);

  if (mode === "unshare") {
    const u = unshareArgv(spec);
    program = u.program;
    args = u.args;
    env = scrubbedEnv(spec, u.extraEnv);
  } else if (mode === "bwrap") {
    const argv = bwrapArgv(spec);
    program = argv[0];
    args = argv.slice(1);
  } else if (mode === "seatbelt") {
    const argv = seatbeltArgv(spec);
    program = argv[0];
    args = argv.slice(1);
  } else if (/^(node|npm|npx)(\.exe)?$/i.test(path.basename(spec.program))) {
    // The node-permission rung works anywhere Node runs — even without an OS sandbox.
    // (npm/npx are shell shims: flags cannot pass through them, so they keep the
    // scrubbed env + HOME redirect and honestly report their rung.)
    const writePaths = spec.writePaths.map((p) => path.resolve(p));
    if (path.basename(spec.program).startsWith("node")) {
      const extra = nodePermissionArgs(Number(process.versions.node.split(".")[0]), writePaths);
      args = [...extra, ...spec.args];
      containment = "node-permission";
    }
  }

  // The builder may have produced a wrapper (bwrap, unshare, sandbox-exec) whose
  // program is already absolute; spawnTarget is a no-op for those and only
  // rewrites bare tool names like `npm`.
  if (mode === "policy-only" || mode === "node-permission") {
    const t = spawnTarget(program, args);
    program = t.program;
    args = t.args;
  }

  return await new Promise((resolve) => {
    const child = spawn(program, args, {
      cwd: spec.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), spec.timeoutMs ?? 15000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + String(e.message), code: null, containment: "refused" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, containment });
    });
  });
}

/**
 * The adversarial battery. Each fixture is a realistic escape attempt a mission
 * restricted to a workspace would try (directly, or via node/python/npm/git/
 * cargo/MCP). `marker` is the secret planted outside the workspace — it must
 * never appear in any output.
 */
export const ESCAPE_FIXTURES: { id: string; program: string; buildArgs: (outsideFile: string) => string[] }[] = [
  { id: "node-fs-read", program: "node", buildArgs: (f) => ["-e", `process.stdout.write("LEAK:"+require("fs").readFileSync(${JSON.stringify(f)},"utf8"))`] },
  { id: "node-fs-write", program: "node", buildArgs: (f) => ["-e", `require("fs").writeFileSync(${JSON.stringify(f+".w")},"pwned");process.stdout.write("WROTE")`] },
  { id: "python-open", program: process.platform === "win32" ? "python" : "python3", buildArgs: (f) => ["-c", `print("LEAK:"+open(${JSON.stringify(f)}).read())`] },
  { id: "python-write", program: process.platform === "win32" ? "python" : "python3", buildArgs: (f) => ["-c", `open(${JSON.stringify(f+".w")},"w").write("pwned");print("WROTE")`] },
  { id: "npm-home-leak", program: "npm", buildArgs: () => ["config", "get", "userconfig"] },
  { id: "git-status-outside", program: "git", buildArgs: (f) => ["-C", path.dirname(f), "status"] },
  { id: "git-config-read", program: "git", buildArgs: () => ["config", "--global", "--list", "--show-origin"] },
  { id: "cargo-manifest-outside", program: "cargo", buildArgs: (f) => ["metadata", "--manifest-path", path.join(path.dirname(f), "Cargo.toml"), "--format-version", "1"] },
];
