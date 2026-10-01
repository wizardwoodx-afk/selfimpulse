/* C-1 — THE CENTRALIZED NATIVE AUTHORIZATION BOUNDARY
 *
 * Security review of archive 3: individual commands carried individual
 * checks, but there was no MANDATORY gate in front of the privileged set —
 * a new command, a refactored command, or a forgotten helper could reach the
 * filesystem, secrets, approvals, shell and browser surface without ever
 * passing a policy decision. Fail-open by construction.
 *
 * This module is that gate. `authorize()` below is a single deny-by-default
 * policy table: every privileged action is named explicitly, argument shapes
 * are validated here (decision enums, secret_ref grammar, non-empty ids), and
 * anything unlisted is refused. `lib.rs` registers THESE wrappers for IPC —
 * the JS command names and payloads are unchanged, the endpoint count is
 * unchanged — so the only way through to `commands::*` is past this policy.
 *
 * The deep, per-surface checks inside `commands.rs` (containment, keychain
 * checks, state machines in `db.rs`) remain in force: the guard authorizes
 * WHAT may be attempted; the inner command still enforces HOW.
 *
 * Adding a privileged command later? Add it here first. The companion probe
 * (probe/nativeAuthz.test.ts) fails the suite if the registration list in
 * lib.rs and this table ever drift apart.
 */
use crate::commands::{self, AppState};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::State;

/// The one policy function. `arg` carries the action's most security-relevant
/// argument (decision word, secret_ref, path/id) when it has one; pass "".
/// FAIL CLOSED: unknown action names are denied, not passed through.
pub(crate) fn authorize(action: &str, arg: &str) -> Result<(), String> {
    match action {
        // ── verdicts ────────────────────────────────────────────────────────
        "approval_decide" | "approval_authorize" => {
            if arg == "APPROVED" || arg == "REJECTED" {
                Ok(())
            } else {
                Err(format!(
                    "guard: approval decision must be APPROVED or REJECTED (got {arg:?}) — denied before reaching the database."
                ))
            }
        }
        "evolution_decide" => {
            if arg == "ACCEPTED" || arg == "REJECTED" {
                Ok(())
            } else {
                Err(format!(
                    "guard: evolution decision must be ACCEPTED or REJECTED (got {arg:?}) — denied before reaching the database."
                ))
            }
        }
        "evolution_rollback" | "secret_delete" | "secret_get" | "workspace_root_add"
        | "workspace_root_remove" | "fs_read" | "fs_write" | "fs_list" | "fs_mkdir"
        | "fs_remove" | "shell_exec" | "mcp_call" | "package_import" | "package_export"
        | "control_run_workflow" => require_nonempty(action, arg),

        // ── secrets ─────────────────────────────────────────────────────────
        "secret_set" => {
            // A secret_ref must look like a reference, never like a path or a
            // phrase with whitespace/control characters.
            if arg.is_empty() {
                return Err("guard: secret_ref must not be empty".into());
            }
            if arg.len() > 128
                || !arg
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | ':' | '/'))
            {
                return Err(format!(
                    "guard: secret_ref {arg:?} contains characters outside [A-Za-z0-9._-:/] or exceeds 128 bytes — denied."
                ));
            }
            // Also refuse traversal-shaped refs (`../`, `a//b`, leading slash):
            // a reference must be a flat name, never something a path-aware
            // consumer could re-interpret.
            if arg.split('/').any(|p| p.is_empty() || p == "." || p == "..") {
                return Err(format!("guard: secret_ref {arg:?} is not a flat reference (traversal-shaped) — denied."));
            }
            Ok(())
        }

        // ── browser automation (presence-only; action semantics live in the
        //    service, which validates session ids and action names itself) ──
        "browser_session_create" | "browser_navigate" | "browser_act" | "browser_screenshot" => Ok(()),

        other => Err(format!(
            "guard: unknown privileged action {other:?} is refused (deny by default) — register it in guard::authorize before calling."
        )),
    }
}

fn require_nonempty(action: &str, arg: &str) -> Result<(), String> {
    if arg.is_empty() {
        Err(format!("guard: {action} requires a non-empty argument — denied."))
    } else {
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Privileged wrappers. Same names, same payloads, same parameter idents as
// the commands they front (the idents drive Tauri's JS↔Rust key mapping) —
// registered from here instead of from commands.rs, so every call crosses
// `authorize` first. Result-typed commands propagate the denial as an error;
// Value-typed commands return the standard { ok:false, reason } shape.
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn approval_decide(state: State<Arc<AppState>>, approval_id: String, decision: String, capability: String) -> Result<(), String> {
    authorize("approval_decide", &decision)?;
    // Centralized here (not per-caller): an empty capability is refused at the
    // gate before any database state is examined.
    if capability.trim().is_empty() {
        return Err(format!(
            "guard: approval_decide requires the native capability from approval_authorize — denied (empty capability)."
        ));
    }
    commands::approval_decide(state, approval_id, decision, capability)
}

#[tauri::command]
pub fn approval_authorize(app: tauri::AppHandle, state: State<Arc<AppState>>, approval_id: String, decision: String) -> Result<Value, String> {
    authorize("approval_authorize", &decision)?;
    commands::approval_authorize(app, state, approval_id, decision)
}

#[tauri::command]
pub fn evolution_decide(state: State<Arc<AppState>>, candidate_id: String, decision: String) -> Result<Value, String> {
    authorize("evolution_decide", &decision)?;
    commands::evolution_decide(state, candidate_id, decision)
}

#[tauri::command]
pub fn evolution_rollback(state: State<Arc<AppState>>, candidate_id: String, _restore_role_prompt: Option<Value>) -> Result<Value, String> {
    authorize("evolution_rollback", &candidate_id)?;
    commands::evolution_rollback(state, candidate_id, _restore_role_prompt)
}

#[tauri::command]
pub fn secret_get(state: State<Arc<AppState>>, secret_ref: String) -> Result<Value, String> {
    authorize("secret_get", &secret_ref)?;
    commands::secret_get(state, secret_ref)
}

#[tauri::command]
pub fn secret_set(state: State<Arc<AppState>>, secret_ref: String, value: String) -> Result<Value, String> {
    authorize("secret_set", &secret_ref)?;
    commands::secret_set(state, secret_ref, value)
}

#[tauri::command]
pub fn secret_delete(state: State<Arc<AppState>>, secret_ref: String) -> Result<(), String> {
    authorize("secret_delete", &secret_ref)?;
    commands::secret_delete(state, secret_ref)
}

#[tauri::command]
pub fn package_import(state: State<Arc<AppState>>, pkg: Value) -> Result<Value, String> {
    authorize("package_import", "pkg")?;
    commands::package_import(state, pkg)
}

#[tauri::command]
pub fn package_export(state: State<Arc<AppState>>, workflow_id: String, _include_history: bool) -> Result<Value, String> {
    authorize("package_export", &workflow_id)?;
    commands::package_export(state, workflow_id, _include_history)
}

#[tauri::command]
pub fn workspace_root_add(state: State<'_, Arc<AppState>>, root: String) -> Result<Value, String> {
    authorize("workspace_root_add", &root)?;
    commands::workspace_root_add(state, root)
}

#[tauri::command]
pub fn workspace_root_remove(state: State<Arc<AppState>>, root: String) -> Result<Value, String> {
    authorize("workspace_root_remove", &root)?;
    commands::workspace_root_remove(state, root)
}

#[tauri::command]
pub fn fs_read(state: State<Arc<AppState>>, path: String) -> Result<String, String> {
    authorize("fs_read", &path)?;
    commands::fs_read(state, path)
}

#[tauri::command]
pub fn fs_write(state: State<Arc<AppState>>, path: String, content: String) -> Result<(), String> {
    authorize("fs_write", &path)?;
    commands::fs_write(state, path, content)
}

#[tauri::command]
pub fn fs_list(state: State<Arc<AppState>>, path: String) -> Result<Value, String> {
    authorize("fs_list", &path)?;
    commands::fs_list(state, path)
}

#[tauri::command]
pub fn fs_mkdir(state: State<Arc<AppState>>, path: String) -> Result<(), String> {
    authorize("fs_mkdir", &path)?;
    commands::fs_mkdir(state, path)
}

#[tauri::command]
pub fn fs_remove(state: State<Arc<AppState>>, path: String, recursive: bool) -> Result<(), String> {
    authorize("fs_remove", &path)?;
    commands::fs_remove(state, path, recursive)
}

#[tauri::command]
pub fn shell_exec(state: State<Arc<AppState>>, program: String, args: Vec<String>, cwd: Option<String>, timeout_secs: Option<u64>) -> Result<Value, String> {
    authorize("shell_exec", &program)?;
    commands::shell_exec(state, program, args, cwd, timeout_secs)
}

#[tauri::command]
pub fn mcp_call(state: State<Arc<AppState>>, server_id: String, tool: String, arguments: Value) -> Result<Value, String> {
    authorize("mcp_call", &server_id)?;
    commands::mcp_call(state, server_id, tool, arguments)
}

#[tauri::command]
pub fn control_run_workflow(state: State<Arc<AppState>>, workflow_id: String) -> Value {
    match authorize("control_run_workflow", &workflow_id) {
        Err(e) => json!({ "ok": false, "reason": e }),
        Ok(()) => commands::control_run_workflow(state, workflow_id),
    }
}

#[tauri::command]
pub async fn browser_session_create(key: Option<String>) -> Value {
    // C-1 invariant (review of archive 4): EVERY privileged wrapper crosses
    // authorize() before touching its implementation — presence checks today,
    // but the gate can never be silently skipped when the policy tightens.
    if let Err(e) = authorize("browser_session_create", key.as_deref().unwrap_or("")) {
        return json!({ "ok": false, "reason": e });
    }
    commands::browser_session_create(key).await
}

#[tauri::command]
pub async fn browser_navigate(session_id: String, url: String, timeout_ms: Option<u64>) -> Value {
    if let Err(e) = authorize("browser_navigate", &url) {
        return json!({ "ok": false, "reason": e });
    }
    commands::browser_navigate(session_id, url, timeout_ms).await
}

#[tauri::command]
pub async fn browser_act(
    args: Option<Value>,
    session_id: Option<String>,
    action: Option<String>,
    selector: Option<String>,
    value: Option<Value>,
    key: Option<String>,
    url: Option<String>,
    state: Option<String>,
    script: Option<String>,
    timeout_ms: Option<u64>,
) -> Value {
    let subject = action.clone().or_else(|| session_id.clone()).unwrap_or_default();
    if let Err(e) = authorize("browser_act", &subject) {
        return json!({ "ok": false, "reason": e });
    }
    commands::browser_act(args, session_id, action, selector, value, key, url, state, script, timeout_ms).await
}

#[tauri::command]
pub async fn browser_screenshot(session_id: String, full_page: Option<bool>) -> Value {
    if let Err(e) = authorize("browser_screenshot", &session_id) {
        return json!({ "ok": false, "reason": e });
    }
    commands::browser_screenshot(session_id, full_page).await
}

// ── the gate's own tests ─────────────────────────────────────────────────────
#[cfg(test)]
mod guard_tests {
    use super::authorize;

    #[test]
    fn unknown_actions_are_denied() {
        assert!(authorize("definitely_not_a_command", "").is_err());
        assert!(authorize("", "").is_err());
    }

    #[test]
    fn decision_words_are_enforced_at_the_gate() {
        assert!(authorize("approval_decide", "APPROVED").is_ok());
        assert!(authorize("approval_decide", "REJECTED").is_ok());
        assert!(authorize("approval_decide", "maybe").is_err());
        assert!(authorize("evolution_decide", "ACCEPTED").is_ok());
        assert!(authorize("evolution_decide", "PENDING").is_err());
    }

    #[test]
    fn secret_refs_are_shape_checked() {
        assert!(authorize("secret_set", "openai:prod-key_1").is_ok());
        assert!(authorize("secret_set", "").is_err());
        assert!(authorize("secret_set", "has spaces").is_err());
        assert!(authorize("secret_set", "../etc/passwd").is_err());
        assert!(authorize("secret_set", &"x".repeat(200)).is_err());
    }

    #[test]
    fn privileged_ids_must_be_nonempty() {
        assert!(authorize("shell_exec", "ls").is_ok());
        assert!(authorize("shell_exec", "").is_err());
        assert!(authorize("fs_remove", "").is_err());
        assert!(authorize("workspace_root_add", "").is_err());
    }
}
