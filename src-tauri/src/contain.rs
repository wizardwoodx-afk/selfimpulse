//! SelfImpulse — host-escape containment for every spawned process (shell, MCP,
//! harness). This is the native mirror of `src/mission/shellContain.ts`; the two
//! are pinned to the same flags by `probe/shellContain.test.ts`.
//!
//! The security boundary of workspace-restricted execution is NOT "cwd is inside
//! the workspace" — a permitted process inherits the user's OS privileges. The
//! boundary is: agent → policy/gate → CONTAINED executor. Every run reports the
//! rung it actually achieved (`unshare` / `bwrap` / `seatbelt` /
//! `node-permission` / `policy-only`); nothing is ever inferred.

use std::path::{Path, PathBuf};
use std::process::Command;

/// How this run is contained. `policy-only` is honest reporting, not a sandbox.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Containment {
    Unshare,
    Bwrap,
    Seatbelt,
    NodePermission,
    PolicyOnly,
}

impl Containment {
    pub fn label(&self) -> &'static str {
        match self {
            Containment::Unshare => "unshare",
            Containment::Bwrap => "bwrap",
            Containment::Seatbelt => "seatbelt",
            Containment::NodePermission => "node-permission",
            Containment::PolicyOnly => "policy-only",
        }
    }
}

/// Locate an executable on PATH.
///
/// On unix the name is matched verbatim. On Windows a bare name is not enough:
/// the interpreter shims a user actually types are `npx.cmd`, `python.exe`,
/// `py.exe` and so on, and `std::process::Command` does not append `PATHEXT` the
/// way a shell does. Spawning the seeded MCP servers with their documented
/// commands therefore failed with `program not found` on Windows for every
/// server that is not a `.exe` — which is all of them. The extensions tried
/// here are the ones `PATHEXT` normally supplies, in the order Windows itself
/// prefers them, so a server configured as `npx` finds `npx.cmd` without the
/// configuration having to name a platform.
fn which(bin: &str) -> Option<PathBuf> {
    let candidate = Path::new(bin);
    // A path with a separator is used as given; only bare names are searched.
    let names: Vec<String> = if candidate.components().count() > 1 || cfg!(not(target_os = "windows")) {
        vec![bin.to_string()]
    } else {
        // Order matters, and the bare name must come LAST. Node, npm and
        // several other tools install a POSIX shell script with no extension
        // (`D:\...\npx`) *alongside* `npx.cmd`. Matching the bare name first
        // therefore locates a bash script on Windows, which cannot be executed
        // at all — it fails with "%1 is not a valid Win32 application". The
        // extension Windows would actually run comes first.
        let mut v = Vec::new();
        for ext in [".exe", ".cmd", ".bat", ".com"] {
            v.push(format!("{bin}{ext}"));
        }
        v.push(bin.to_string());
        v
    };
    if let Ok(paths) = std::env::var("PATH") {
        for dir in std::env::split_paths(&paths) {
            for name in &names {
                let p = dir.join(name);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    None
}

/// Resolve a program name to something spawnable, or return it unchanged.
///
/// When nothing is found the original name is returned so the spawn error still
/// names what the configuration asked for, rather than a path the user never
/// wrote.
pub fn resolve_program(bin: &str) -> String {
    which(bin)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| bin.to_string())
}

/// Turn a configured program + arguments into something that can actually be
/// spawned on this platform, together with the arguments to use.
///
/// Finding `npx.cmd` is only half the problem. Windows cannot `CreateProcess` a
/// batch file at all: a `.cmd` or `.bat` target fails with
/// "%1 is not a valid Win32 application" (os error 193) no matter that the file
/// was located correctly. Batch files are scripts for the command interpreter,
/// so they have to be launched as `cmd.exe /c <file> <args...>`.
///
/// On unix this is the identity: the program is resolved and the arguments pass
/// through untouched, because a shebang script is executed by the kernel.
pub fn spawn_target(command: &str, args: &[String]) -> (String, Vec<String>) {
    let program = resolve_program(command);
    if !cfg!(target_os = "windows") {
        return (program, args.to_vec());
    }
    let lower = program.to_ascii_lowercase();
    if lower.ends_with(".cmd") || lower.ends_with(".bat") {
        let mut all = vec!["/c".to_string(), program];
        all.extend(args.iter().cloned());
        // `%ComSpec%` is the interpreter this session is actually configured
        // to use; falling back to `cmd.exe` keeps the spawn honest if it is unset.
        let shell = std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string());
        return (shell, all);
    }
    (program, args.to_vec())
}

/// Chroot-mount script run INSIDE the user+mount namespace. Positional: R CWD HOME + program argv.
/// Mirrors `UNSHARE_MOUNT_SCRIPT` in src/mission/shellContain.ts (pinned by the probe).
pub const UNSHARE_MOUNT_SCRIPT: &str = r#"R="$1"; CWD="$2"; H="$3"; shift 3
mount --make-rprivate / 2>/dev/null || true
for p in /usr /bin /sbin /lib /lib64 /lib32 /etc /opt /proc /dev; do
  if [ -e "$p" ]; then mkdir -p "$R$p"; mount --bind "$p" "$R$p"; mount -o remount,ro,bind "$R$p" 2>/dev/null || true; fi
done
IFS=':'
for w in $CONTAIN_WRITES; do
  [ -n "$w" ] || continue
  mkdir -p "$R$w"; mount --bind "$w" "$R$w"
done
unset IFS
mkdir -p "$R/tmp"
mount -t tmpfs -o size=512m tmpfs "$R/tmp"
exec chroot "$R" /usr/bin/env -i -C "$CWD" HOME="$H" TMPDIR=/tmp PATH=/usr/bin:/bin:/usr/local/bin "$@"
"#;

fn unshare_works() -> bool {
    if !cfg!(target_os = "linux") {
        return false;
    }
    if which("unshare").is_none() || which("chroot").is_none() || which("mount").is_none() {
        return false;
    }
    Command::new("unshare")
        .args(["-Urm", "--map-root-user", "true"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

pub fn detect() -> Containment {
    if unshare_works() {
        return Containment::Unshare;
    }
    if cfg!(target_os = "linux") && which("bwrap").is_some() {
        return Containment::Bwrap;
    }
    if cfg!(target_os = "macos") && Path::new("/usr/bin/sandbox-exec").exists() {
        return Containment::Seatbelt;
    }
    Containment::PolicyOnly
}

const SYSTEM_READ_PREFIXES: &[&str] = &[
    "/usr", "/bin", "/sbin", "/lib", "/lib64", "/lib32", "/etc/ssl", "/etc/resolv.conf",
    "/etc/hosts", "/etc/nsswitch.conf", "/etc/ld.so.cache", "/etc/ld.so.conf", "/proc", "/dev",
    "/opt/homebrew", "/opt/local",
];

/// Absolute, canonical, symlink-free form of `p`.
///
/// Canonicalize is best-effort: on Windows a path can be canonical even when it
/// does not exist yet, and on a non-existent path we fall back to the input.
/// This is used both for string comparison (dedupe) and for existence checks.
fn dunce_path(p: &Path) -> PathBuf {
    std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf())
}

/// The same value as a string, for argv entries and environment values.
/// Absolute path with the Windows `\\?\` prefix stripped.
///
/// `pub` since 20.1 so `hermes.rs` can compute the same `home` value the
/// scrubber needs, rather than inventing a second normalisation that would
/// drift from this one.
pub fn dunce_abs(p: &Path) -> String {
    dunce_path(p).display().to_string()
}

/// The bwrap builder — mirrored 1:1 by shellContain.ts `bwrapArgv` and pinned by the probe.
pub fn bwrap_argv(program: &str, args: &[String], cwd: &Path, read_paths: &[PathBuf], write_paths: &[PathBuf]) -> Vec<String> {
    let mut out: Vec<String> = vec![];
    for p in SYSTEM_READ_PREFIXES {
        if Path::new(p).exists() {
            out.push("--ro-bind".into());
            out.push((*p).into());
            out.push((*p).into());
        }
    }
    for p in read_paths {
        let abs = dunce_path(p);
        if abs.exists() && !write_paths.iter().any(|w| dunce_path(w) == abs) {
            out.push("--ro-bind".into());
            out.push(abs.display().to_string());
            out.push(abs.display().to_string());
        }
    }
    for p in write_paths {
        let abs = dunce_abs(p);
        out.push("--bind".into());
        out.push(abs.clone());
        out.push(abs);
    }
    out.push("--dev".into());
    out.push("/dev".into());
    out.push("--proc".into());
    out.push("/proc".into());
    out.push("--tmpfs".into());
    out.push("/tmp".into());
    out.push("--setenv".into());
    out.push("HOME".into());
    // `write_paths.first()` is `&PathBuf`; `cwd` is `&Path`. Normalise to `&Path`
    // so `unwrap_or` has a single type to work with.
    let home_path: &Path = match write_paths.first() {
        Some(p) => p.as_path(),
        None => cwd,
    };
    out.push(dunce_abs(home_path));
    out.push("--setenv".into());
    out.push("TMPDIR".into());
    out.push("/tmp".into());
    out.push("--setenv".into());
    out.push("PATH".into());
    out.push("/usr/bin:/bin:/usr/local/bin".into());
    out.push("--die-with-parent".into());
    out.push("--new-session".into());
    out.push("--chdir".into());
    out.push(dunce_abs(cwd));
    out.push("--".into());
    out.push(program.to_string());
    out.extend(args.iter().cloned());
    out
}

/// The seatbelt profile — macOS. Read ok; writes only inside workspace/scratch.
pub fn seatbelt_profile(write_paths: &[PathBuf]) -> String {
    let writes: Vec<String> = write_paths
        .iter()
        .map(|p| format!("(subpath \"{}\")", dunce_abs(p)))
        .collect();
    format!(
        "(version 1)\n(allow default)\n(deny file-write*)\n(allow file-write* {} (subpath \"/private/tmp\") (subpath \"/tmp\"))\n",
        writes.join(" ")
    )
}

/// Node's own permission-model flags for `node` programs (works without any OS sandbox).
pub fn node_permission_args(write_paths: &[PathBuf]) -> Vec<String> {
    let mut reads: Vec<String> = SYSTEM_READ_PREFIXES.iter().map(|s| s.to_string()).collect();
    for p in write_paths {
        reads.push(dunce_abs(p));
    }
    reads.sort();
    reads.dedup();
    let mut out = vec!["--experimental-permission".to_string()];
    for r in &reads {
        out.push(format!("--allow-fs-read={r}"));
    }
    for p in write_paths {
        out.push(format!("--allow-fs-write={}", dunce_abs(p)));
    }
    out
}

/// Scrub the environment of any command about to be spawned.
///
/// The program is chosen by `wrap_command` *after* containment is detected, so
/// this is applied to the final command rather than to a pre-built template.
/// `std::process::Command` has no program setter, so the program cannot be
/// swapped in place on a constructed command.
///
/// Mirrors `scrubbedEnv` in src/mission/shellContain.ts, including the Windows
/// home variables. `env_clear()` removes `%USERPROFILE%` along with everything
/// else, and on Windows the toolchain reads that rather than `HOME` — so before
/// this was added a contained Windows process had no home at all and tools like
/// npm and git failed for the wrong reason. The TS reference and this file must
/// agree; probe/shellContain.test.ts pins both.
/// Strip everything but a minimal, reconstructable environment.
///
/// `pub` since 20.1: `scrub` used to be private, so a caller that needed the
/// environment guarantee WITHOUT OS-level containment (`wrap_command`) had no
/// way to get it — and the honest cheaper option was to just not scrub.
/// `hermes.rs` spawned the bundled Python bridge with the full inherited
/// environment, handing that process every provider key the operator had
/// exported in their shell. It now calls this.
pub fn scrub_env(cmd: &mut Command, home: &str) {
    scrub(cmd, home)
}

fn scrub(cmd: &mut Command, home: &str) {
    cmd.env_clear();
    cmd.env("PATH", "/usr/bin:/bin:/usr/local/bin");
    cmd.env("HOME", home);
    if cfg!(windows) {
        cmd.env("USERPROFILE", home);
        // HOMEDRIVE/HOMEPATH are the split form some Windows APIs read. A path
        // like `C:\ws` yields drive `C:` and an empty path component.
        let p = Path::new(home);
        let drive = p.components().next().map(|c| c.as_os_str().to_string_lossy().into_owned()).unwrap_or_default();
        cmd.env("HOMEDRIVE", drive.trim_end_matches(['\\', ':']));
        cmd.env("HOMEPATH", p.strip_prefix(&drive).map(|r| r.to_string_lossy().into_owned()).unwrap_or_default());
    }
    cmd.env(
        "TMPDIR",
        if cfg!(windows) {
            std::env::var("TEMP").unwrap_or_else(|_| "C:\\Temp".into())
        } else {
            "/tmp".into()
        },
    );
    if let Ok(lang) = std::env::var("LANG") {
        cmd.env("LANG", lang);
    }
}

/// Wrap `program` in the strongest containment available. Returns the command to
/// run and the rung achieved.
/// The caller MUST surface the label in the run result — a contained run and a
/// policy-only run are different facts.
pub fn wrap_command(
    program: &str,
    args: &[String],
    cwd: &Path,
    read_paths: &[PathBuf],
    write_paths: &[PathBuf],
) -> (Command, Containment) {
    let mode = detect();
    let home = dunce_abs(write_paths.first().map(|p| p.as_path()).unwrap_or(cwd));

    let bare = Path::new(program)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| program.to_string());

    let (mut cmd, achieved) = match mode {
        Containment::Unshare => {
            let scratch = format!("{}/.contain-root", home);
            let writes: Vec<String> = write_paths.iter().map(|w| dunce_abs(w)).collect();
            let mut a: Vec<String> = vec![
                "-Urm".into(),
                "--map-root-user".into(),
                "/bin/sh".into(),
                "-c".into(),
                UNSHARE_MOUNT_SCRIPT.to_string(),
                "contain-run".into(),
                scratch,
                dunce_abs(cwd),
                home.clone(),
                program.to_string(),
            ];
            a.extend(args.iter().cloned());
            let mut c = Command::new("unshare");
            c.env("CONTAIN_WRITES", writes.join(":"));
            c.args(&a);
            (c, Containment::Unshare)
        }
        Containment::Bwrap => {
            let argv = bwrap_argv(program, args, cwd, read_paths, write_paths);
            let mut c = Command::new("bwrap");
            c.args(&argv);
            (c, Containment::Bwrap)
        }
        Containment::Seatbelt => {
            let profile = seatbelt_profile(write_paths);
            let mut a = vec!["-p".to_string(), profile, program.to_string()];
            a.extend(args.iter().cloned());
            let mut c = Command::new("sandbox-exec");
            c.args(&a);
            (c, Containment::Seatbelt)
        }
        Containment::PolicyOnly => {
            if bare.starts_with("node") && !bare.starts_with("npm") {
                let mut a = node_permission_args(write_paths);
                a.extend(args.iter().cloned());
                let mut c = Command::new(program);
                c.args(&a);
                c.current_dir(cwd);
                scrub(&mut c, &home);
                return (c, Containment::NodePermission);
            }
            let mut c = Command::new(program);
            c.args(args);
            (c, Containment::PolicyOnly)
        }
        Containment::NodePermission => unreachable!("detect() never returns NodePermission"),
    };

    // Always: environment scrub + HOME redirect (all rungs).
    scrub(&mut cmd, &home);
    cmd.current_dir(cwd);
    (cmd, achieved)
}
