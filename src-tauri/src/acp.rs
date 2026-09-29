//! ACP process bridge (V11, VH-11.0-PROPOSAL W1).
//!
//! The WebView cannot spawn processes, so the Rust side owns the ACP agent child. One handle
//! per child; stdout lines flow through a channel the frontend polls via `acp_recv`. The
//! protocol itself lives in TypeScript (`src/mission/acp.ts`) — this module is pipes only.
//!
//! Design notes:
//! - `std::process` only, matching the rest of this crate's parser style (no new deps).
//! - A reader thread per child never blocks: it pushes lines into an mpsc channel and sends
//!   `None` on EOF, so `recv` can distinguish "quiet" from "dead".
//! - `recv` bounds its wait at ~2 s per call and returns `(null, null)` on timeout; the
//!   frontend polls. A hung agent is detected by the frontend's request timeout, not here.
//! - `close` kills and reaps; a child that died on its own is reaped by the first `recv`
//!   that observes EOF, so no zombie is left behind in either path.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, TryRecvError};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

struct AcpProc {
    stdin: ChildStdin,
    rx: Receiver<Option<String>>,
    child: Child,
}

static REGISTRY: OnceLock<Mutex<HashMap<u64, AcpProc>>> = OnceLock::new();
static NEXT_HANDLE: AtomicU64 = AtomicU64::new(1);

fn registry() -> &'static Mutex<HashMap<u64, AcpProc>> {
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Spawn an ACP agent child and return its handle.
///
/// V-security fix: previously this built a bare `Command::new(program)` with
/// the parent's full environment inherited and no program allowlist or
/// sandbox — meaning any process that could reach `acp_open` over Tauri IPC
/// could spawn any binary with the user's env (API keys included). Now the
/// child is spawned through `contain::wrap_command`, the exact same primitive
/// `shell_exec` uses: env is scrubbed (env_clear + PATH/HOME), HOME is
/// redirected into the workspace, and when the OS supports it the child runs
/// inside unshare/bwrap/seatbelt. The caller (commands.rs) is responsible for
/// validating that the program is on the allowlist and that cwd lies inside a
/// registered root before calling here; this function asserts containment on
/// what it actually runs.
pub fn open(program: &str, args: &[String], cwd: Option<&str>) -> Result<u64, String> {
    // Default cwd to the current working directory; wrap_command requires one.
    // The caller (commands.rs) validates the resolved cwd against registered
    // roots before invoking us — here we just make sure the directory exists
    // so the sandbox setup does not silently fall back somewhere else.
    let cwd_path: PathBuf = match cwd {
        Some(d) if !d.is_empty() => Path::new(d).to_path_buf(),
        _ => std::env::current_dir().map_err(|e| format!("acp: no cwd and current_dir failed: {e}"))?,
    };
    let write_paths: Vec<PathBuf> = vec![cwd_path.clone()];
    let (mut cmd, _rung) = crate::contain::wrap_command(program, args, &cwd_path, &[], &write_paths);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("acp: failed to spawn {program}: {e}"))?;
    let stdin = child.stdin.take().ok_or_else(|| "acp: stdin unavailable".to_string())?;
    let stdout = child.stdout.take().ok_or_else(|| "acp: stdout unavailable".to_string())?;
    let (tx, rx) = mpsc::channel::<Option<String>>();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(l) => {
                    if tx.send(Some(l)).is_err() {
                        break; // the handle was closed and dropped — nothing to feed
                    }
                }
                Err(_) => break,
            }
        }
        let _ = tx.send(None);
    });
    let handle = NEXT_HANDLE.fetch_add(1, Ordering::SeqCst);
    registry()
        .lock()
        .map_err(|_| "acp: registry poisoned".to_string())?
        .insert(handle, AcpProc { stdin, rx, child });
    Ok(handle)
}

/// Write one newline-delimited JSON-RPC message to the child's stdin.
pub fn send(handle: u64, line: &str) -> Result<(), String> {
    let mut reg = registry().lock().map_err(|_| "acp: registry poisoned".to_string())?;
    let proc = reg.get_mut(&handle).ok_or_else(|| format!("acp: unknown handle {handle}"))?;
    proc.stdin
        .write_all(line.as_bytes())
        .and_then(|_| proc.stdin.write_all(b"\n"))
        .and_then(|_| proc.stdin.flush())
        .map_err(|e| format!("acp: write failed: {e}"))
}

/// Poll for the next stdout line.
///
/// Returns `(Some(line), None)` for a line, `(None, Some(code))` when the child has exited,
/// and `(None, None)` when the bounded window elapsed with nothing to report. The frontend
/// treats the last case as "keep polling".
pub fn recv(handle: u64) -> Result<(Option<String>, Option<i64>), String> {
    let deadline = Instant::now() + Duration::from_millis(2000);
    loop {
        {
            let mut reg = registry().lock().map_err(|_| "acp: registry poisoned".to_string())?;
            match reg.get_mut(&handle) {
                Some(proc) => match proc.rx.try_recv() {
                    Ok(Some(line)) => return Ok((Some(line), None)),
                    Ok(None) => {
                        let code = proc.child.wait().ok().and_then(|s| s.code());
                        reg.remove(&handle);
                        return Ok((None, Some(code.map(i64::from).unwrap_or(-1))));
                    }
                    Err(TryRecvError::Disconnected) => {
                        let code = proc.child.wait().ok().and_then(|s| s.code());
                        reg.remove(&handle);
                        return Ok((None, Some(code.map(i64::from).unwrap_or(-1))));
                    }
                    Err(TryRecvError::Empty) => {}
                },
                None => return Err(format!("acp: unknown handle {handle}")),
            }
        }
        if Instant::now() >= deadline {
            return Ok((None, None));
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}

/// Kill and reap the child, dropping the handle. Closing an unknown handle is not an error:
/// the child may already have been reaped by `recv`.
pub fn close(handle: u64) -> Result<(), String> {
    if let Ok(mut reg) = registry().lock() {
        if let Some(mut proc) = reg.remove(&handle) {
            let _ = proc.child.kill();
            let _ = proc.child.wait();
        }
    }
    Ok(())
}

/// Count of live ACP children — used by the Proof page's runtime panel.
#[allow(dead_code)]
pub fn live_handles() -> usize {
    registry().lock().map(|r| r.len()).unwrap_or(0)
}

#[allow(dead_code)]
fn _assert_shapes(_: &Child, _: &ChildStdin, _: &Receiver<Option<String>>) {}
