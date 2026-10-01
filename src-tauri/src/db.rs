use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::path::Path;
use uuid::Uuid;

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    init(&conn)?;
    ensure_skill_usage_columns(&conn)?;
    ensure_approval_authority_columns(&conn)?;
    Ok(conn)
}

/// V11: the shipped schema, extracted so tests can build exactly this in memory
/// (the code that ships is the code that was tested).
pub fn init(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS workflows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            graph_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS versions (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            label TEXT NOT NULL,
            graph_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS executions (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            workflow_version INTEGER NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            error TEXT,
            stats_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            execution_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            kind TEXT NOT NULL,
            level TEXT NOT NULL,
            node_id TEXT,
            data_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            node_key TEXT NOT NULL,
            kind TEXT NOT NULL,
            content TEXT NOT NULL,
            tags_json TEXT NOT NULL,
            importance REAL NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY,
            node_key TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            procedure TEXT NOT NULL,
            origin TEXT NOT NULL,
            version INTEGER NOT NULL,
            score REAL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            execution_id TEXT NOT NULL,
            node_key TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS evolution (
            id TEXT PRIMARY KEY,
            node_key TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            decision TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            decided_at TEXT
        );
        CREATE TABLE IF NOT EXISTS mcp (
            id TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS approvals (
            id TEXT PRIMARY KEY,
            execution_id TEXT NOT NULL,
            node_key TEXT NOT NULL,
            summary TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            requested_by TEXT NOT NULL DEFAULT '',
            authority TEXT NOT NULL DEFAULT 'human',
            cap_hash TEXT NOT NULL DEFAULT '',
            cap_expires_at INTEGER NOT NULL DEFAULT 0,
            cap_decision TEXT NOT NULL DEFAULT '',
            decided_by TEXT NOT NULL DEFAULT '',
            decided_at TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS dlq (
            id TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS node_state (
            node_key TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS run_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workflow_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS evaluations (
            id TEXT PRIMARY KEY,
            node_key TEXT NOT NULL,
            execution_id TEXT,
            suite_json TEXT NOT NULL,
            score REAL NOT NULL,
            details_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_evaluations_node ON evaluations(node_key, created_at);
        CREATE TABLE IF NOT EXISTS suites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            cases_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS workspace_roots (
            path TEXT PRIMARY KEY,
            added_at TEXT NOT NULL
        );
        "
    )?;
    Ok(())
}

/// V11 (W6): skill usage columns. ALTER TABLE cannot say "add if missing" in SQLite, so probe
/// pragma_table_info first. An older database file upgrades in place, silently, once.
fn ensure_skill_usage_columns(conn: &Connection) -> rusqlite::Result<()> {
    let has: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM pragma_table_info('skills') WHERE name='use_count'",
            [],
            |r| r.get(0),
        )
        .optional()?;
    if has.is_none() {
        conn.execute_batch(
            "ALTER TABLE skills ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0;
             ALTER TABLE skills ADD COLUMN last_used_at TEXT;",
        )?;
    }
    Ok(())
}

/// C-2 (security review of archive 4): approvals gained approver-authority
/// binding — who asked, what authority may answer, and the one-time native
/// capability that a decision must present. Existing databases get the same
/// columns added in place, exactly like the skills migration above.
fn ensure_approval_authority_columns(conn: &Connection) -> rusqlite::Result<()> {
    let has: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM pragma_table_info('approvals') WHERE name='requested_by'",
            [],
            |r| r.get(0),
        )
        .optional()?;
    if has.is_none() {
        conn.execute_batch(
            "ALTER TABLE approvals ADD COLUMN requested_by TEXT NOT NULL DEFAULT '';
             ALTER TABLE approvals ADD COLUMN authority TEXT NOT NULL DEFAULT 'human';
             ALTER TABLE approvals ADD COLUMN cap_hash TEXT NOT NULL DEFAULT '';
             ALTER TABLE approvals ADD COLUMN cap_expires_at INTEGER NOT NULL DEFAULT 0;
             ALTER TABLE approvals ADD COLUMN cap_decision TEXT NOT NULL DEFAULT '';
             ALTER TABLE approvals ADD COLUMN decided_by TEXT NOT NULL DEFAULT '';
             ALTER TABLE approvals ADD COLUMN decided_at TEXT NOT NULL DEFAULT '';",
        )?;
    }
    Ok(())
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// QA fix (audit C2): the filesystem sandbox's user-registered roots. The app data dir is always
/// allowed; every other directory must be explicitly registered here (Teams does this when a run
/// starts) before fs_* / shell_exec will touch it. Paths are stored normalized.
pub fn workspace_root_list(conn: &Connection) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare("SELECT path, added_at FROM workspace_roots ORDER BY path")?;
    let rows = stmt.query_map([], |r| {
        Ok(json!({ "path": r.get::<_, String>(0)?, "addedAt": r.get::<_, String>(1)? }))
    })?;
    let out: Vec<Value> = rows.collect::<Result<_, _>>()?;
    Ok(Value::Array(out))
}

pub fn workspace_root_add(conn: &Connection, root: &str) -> rusqlite::Result<Value> {
    let normalized = normalize_root(root);
    conn.execute(
        "INSERT OR IGNORE INTO workspace_roots (path, added_at) VALUES (?1, ?2)",
        params![normalized, now()],
    )?;
    Ok(json!({ "ok": true, "path": normalized }))
}

pub fn workspace_root_remove(conn: &Connection, root: &str) -> rusqlite::Result<Value> {
    let normalized = normalize_root(root);
    conn.execute("DELETE FROM workspace_roots WHERE path = ?1", params![normalized])?;
    Ok(json!({ "ok": true, "path": normalized }))
}

/// Lexical normalization shared with commands.rs: forward slashes, no trailing separator,
/// no `.` / `..` components. Drive-letter case-insensitivity is handled by the checker.
fn normalize_root(root: &str) -> String {
    let mut parts: Vec<String> = Vec::new();
    for comp in root.replace('\\', "/").split('/') {
        if comp.is_empty() || comp == "." {
            continue;
        }
        if comp == ".." {
            // Never pop the drive/prefix (first component like "C:"), never go above root.
            if parts.len() > 1 {
                parts.pop();
            }
            continue;
        }
        parts.push(comp.to_string());
    }
    parts.join("/")
}


fn nid(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4().simple())
}

pub fn workflow_list(conn: &Connection) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare("SELECT id, name, description, graph_json, created_at, updated_at FROM workflows ORDER BY updated_at DESC")?;
    let rows = stmt.query_map([], |r| {
        Ok(json!({
            "id": r.get::<_, String>(0)?,
            "name": r.get::<_, String>(1)?,
            "description": r.get::<_, String>(2)?,
            "graph": serde_json::from_str::<Value>(&r.get::<_, String>(3)?).unwrap_or(json!({})),
            "createdAt": r.get::<_, String>(4)?,
            "updatedAt": r.get::<_, String>(5)?,
        }))
    })?;
    Ok(Value::Array(rows.filter_map(|r| r.ok()).collect()))
}

pub fn workflow_get(conn: &Connection, id: &str) -> rusqlite::Result<Value> {
    conn.query_row(
        "SELECT id, name, description, graph_json, created_at, updated_at FROM workflows WHERE id=?1",
        [id],
        |r| {
            Ok(json!({
                "id": r.get::<_, String>(0)?,
                "name": r.get::<_, String>(1)?,
                "description": r.get::<_, String>(2)?,
                "graph": serde_json::from_str::<Value>(&r.get::<_, String>(3)?).unwrap_or(json!({})),
                "createdAt": r.get::<_, String>(4)?,
                "updatedAt": r.get::<_, String>(5)?,
            }))
        },
    )
}

pub fn workflow_create(conn: &Connection, name: &str, description: &str) -> rusqlite::Result<Value> {
    let id = nid("wf");
    let ts = now();
    let graph = json!({
        "schemaVersion": 2,
        "id": id,
        "name": name,
        "nodes": [],
        "connections": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
        "groups": [],
        "notes": []
    });
    conn.execute(
        "INSERT INTO workflows (id,name,description,graph_json,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6)",
        params![id, name, description, graph.to_string(), ts, ts],
    )?;
    Ok(json!({ "id": id }))
}

pub fn workflow_save(conn: &Connection, id: &str, name: &str, description: &str, graph: &Value) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE workflows SET name=?2, description=?3, graph_json=?4, updated_at=?5 WHERE id=?1",
        params![id, name, description, graph.to_string(), now()],
    )?;
    Ok(())
}

pub fn workflow_delete(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM workflows WHERE id=?1", [id])?;
    Ok(())
}

pub fn execution_create(conn: &Connection, workflow_id: &str, workflow_version: i64) -> rusqlite::Result<Value> {
    let id = nid("exec");
    let stats = json!({"nodesRun":0,"nodesFailed":0,"retries":0,"inputTokens":0,"outputTokens":0,"durationMs":0,"costUsd":0,"evaluationScores":[]});
    conn.execute(
        "INSERT INTO executions (id,workflow_id,workflow_version,status,started_at,ended_at,error,stats_json) VALUES (?1,?2,?3,'RUNNING',?4,NULL,NULL,?5)",
        params![id, workflow_id, workflow_version, now(), stats.to_string()],
    )?;
    Ok(json!({ "id": id }))
}

pub fn execution_finish(conn: &Connection, id: &str, status: &str, error: Option<&str>, stats: &Value) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE executions SET status=?2, error=?3, stats_json=?4, ended_at=?5 WHERE id=?1",
        params![id, status, error, stats.to_string(), now()],
    )?;
    Ok(())
}

pub fn execution_list(conn: &Connection) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare("SELECT id, workflow_id, workflow_version, status, started_at, ended_at, error, stats_json FROM executions ORDER BY started_at DESC LIMIT 200")?;
    let rows = stmt.query_map([], |r| {
        Ok(json!({
            "id": r.get::<_, String>(0)?,
            "workflowId": r.get::<_, String>(1)?,
            "workflowVersion": r.get::<_, i64>(2)?,
            "status": r.get::<_, String>(3)?,
            "startedAt": r.get::<_, String>(4)?,
            "endedAt": r.get::<_, Option<String>>(5)?,
            "error": r.get::<_, Option<String>>(6)?,
            "stats": serde_json::from_str::<Value>(&r.get::<_, String>(7)?).unwrap_or(json!({})),
        }))
    })?;
    Ok(Value::Array(rows.filter_map(|r| r.ok()).collect()))
}

pub fn event_emit(conn: &Connection, execution_id: &str, kind: &str, level: &str, node_id: Option<&str>, data: &Value) -> rusqlite::Result<Value> {
    conn.execute(
        "INSERT INTO events (execution_id, ts, kind, level, node_id, data_json) VALUES (?1,?2,?3,?4,?5,?6)",
        params![execution_id, now(), kind, level, node_id, data.to_string()],
    )?;
    let seq = conn.last_insert_rowid();
    Ok(json!({
        "seq": seq,
        "ts": now(),
        "kind": kind,
        "level": level,
        "nodeId": node_id,
        "executionId": execution_id,
        "data": data,
    }))
}

pub fn execution_events(conn: &Connection, execution_id: &str) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare("SELECT seq, ts, kind, level, node_id, data_json FROM events WHERE execution_id=?1 ORDER BY seq")?;
    let rows = stmt.query_map([execution_id], |r| {
        Ok(json!({
            "seq": r.get::<_, i64>(0)?,
            "ts": r.get::<_, String>(1)?,
            "kind": r.get::<_, String>(2)?,
            "level": r.get::<_, String>(3)?,
            "nodeId": r.get::<_, Option<String>>(4)?,
            "executionId": execution_id,
            "data": serde_json::from_str::<Value>(&r.get::<_, String>(5)?).unwrap_or(json!({})),
        }))
    })?;
    Ok(Value::Array(rows.filter_map(|r| r.ok()).collect()))
}

pub fn memory_add(conn: &Connection, node_key: &str, kind: &str, content: &str, tags: &Value, importance: f64) -> rusqlite::Result<Value> {
    let id = nid("mem");
    conn.execute(
        "INSERT INTO memories (id,node_key,kind,content,tags_json,importance,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, node_key, kind, content, tags.to_string(), importance, now()],
    )?;
    Ok(json!({ "id": id }))
}

pub fn memory_search(conn: &Connection, node_key: &str, query: &str, limit: i64) -> rusqlite::Result<Value> {
    let q = format!("%{query}%");
    let mut stmt = conn.prepare("SELECT id, node_key, kind, content, tags_json, importance, created_at FROM memories WHERE node_key=?1 AND content LIKE ?2 ORDER BY importance DESC LIMIT ?3")?;
    let rows = stmt.query_map(params![node_key, q, limit], |r| {
        Ok(json!({
            "id": r.get::<_, String>(0)?,
            "nodeKey": r.get::<_, String>(1)?,
            "kind": r.get::<_, String>(2)?,
            "content": r.get::<_, String>(3)?,
            "tags": serde_json::from_str::<Value>(&r.get::<_, String>(4)?).unwrap_or(json!([])),
            "importance": r.get::<_, f64>(5)?,
            "createdAt": r.get::<_, String>(6)?,
        }))
    })?;
    Ok(Value::Array(rows.filter_map(|r| r.ok()).collect()))
}

pub fn skill_upsert(conn: &Connection, node_key: &str, name: &str, description: &str, procedure: &str, origin: &str) -> rusqlite::Result<Value> {
    let id = nid("skill");
    let ts = now();
    conn.execute(
        "INSERT INTO skills (id,node_key,name,description,procedure,origin,version,score,active,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,1,NULL,1,?7,?7)",
        params![id, node_key, name, description, procedure, origin, ts],
    )?;
    Ok(json!({ "id": id, "version": 1 }))
}

pub fn skills_list(conn: &Connection, node_key: &str) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare("SELECT id,node_key,name,description,procedure,origin,version,score,active,created_at,updated_at FROM skills WHERE node_key=?1")?;
    let rows: Vec<Value> = stmt
        .query_map([node_key], |r| {
            Ok(json!({
                "id": r.get::<_, String>(0)?,
                "nodeKey": r.get::<_, String>(1)?,
                "name": r.get::<_, String>(2)?,
                "description": r.get::<_, String>(3)?,
                "procedure": r.get::<_, String>(4)?,
                "origin": r.get::<_, String>(5)?,
                "version": r.get::<_, i64>(6)?,
                "score": r.get::<_, Option<f64>>(7)?,
                "active": r.get::<_, i64>(8)? == 1,
                "createdAt": r.get::<_, String>(9)?,
                "updatedAt": r.get::<_, String>(10)?,
                "preconditions": "",
                "toolStrategy": "",
                "verificationStrategy": "",
                "knownFailureModes": "",
            }))
        })?
        .filter_map(|r| r.ok())
        .collect();
    let active: Vec<Value> = rows.iter().filter(|s| s["active"].as_bool().unwrap_or(false)).cloned().collect();
    Ok(json!({ "skills": active, "all": rows }))
}

pub fn evolution_propose(conn: &Connection, cand: &Value) -> rusqlite::Result<Value> {
    let id = nid("evo");
    let mut payload = cand.clone();
    payload["id"] = json!(id);
    payload["decision"] = json!("PENDING");
    payload["status"] = json!("PROPOSED");
    payload["createdAt"] = json!(now());
    payload["decidedAt"] = Value::Null;
    conn.execute(
        "INSERT INTO evolution (id,node_key,payload_json,decision,status,created_at,decided_at) VALUES (?1,?2,?3,'PENDING','PROPOSED',?4,NULL)",
        params![id, cand["nodeKey"].as_str().unwrap_or(""), payload.to_string(), now()],
    )?;
    Ok(json!({ "id": id }))
}

pub fn evolution_list(conn: &Connection, node_key: Option<&str>) -> rusqlite::Result<Value> {
    let sql = if node_key.is_some() {
        "SELECT payload_json FROM evolution WHERE node_key=?1 ORDER BY created_at DESC"
    } else {
        "SELECT payload_json FROM evolution ORDER BY created_at DESC"
    };
    let mut stmt = conn.prepare(sql)?;
    let mut rows = if let Some(k) = node_key {
        stmt.query([k])?
    } else {
        stmt.query([])?
    };
    let mut out = Vec::new();
    while let Some(r) = rows.next()? {
        let s: String = r.get(0)?;
        if let Ok(v) = serde_json::from_str::<Value>(&s) {
            out.push(v);
        }
    }
    Ok(Value::Array(out))
}

/* C-2: authority-checked transition — DECIDED only from PROPOSED, exactly once.
   (Same review as approval_decide below.) */
pub fn evolution_decide(conn: &Connection, id: &str, decision: &str) -> Result<Value, String> {
    if decision != "ACCEPTED" && decision != "REJECTED" {
        return Err(format!(
            "evolution_decide: decision must be ACCEPTED or REJECTED (got {decision:?})"
        ));
    }
    let ts = now();
    let changed = conn
        .execute(
            "UPDATE evolution SET decision=?2, status='DECIDED', decided_at=?3 WHERE id=?1 AND status='PROPOSED'",
            params![id, decision, ts],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        let existing: Option<String> = conn
            .query_row("SELECT status FROM evolution WHERE id=?1", [id], |r| r.get(0))
            .optional()
            .map_err(|e| e.to_string())?;
        return Err(match existing {
            Some(st) => format!(
                "evolution candidate {id} is not PROPOSED (current status {st}) — it moves exactly once, from PROPOSED to DECIDED."
            ),
            None => format!("evolution candidate {id} does not exist — nothing was changed."),
        });
    }
    let payload: Option<String> = conn
        .query_row("SELECT payload_json FROM evolution WHERE id=?1", [id], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    if let Some(p) = payload {
        if let Ok(mut v) = serde_json::from_str::<Value>(&p) {
            v["decision"] = json!(decision);
            v["status"] = json!("DECIDED");
            v["decidedAt"] = json!(ts);
            conn.execute("UPDATE evolution SET payload_json=?2 WHERE id=?1", params![id, v.to_string()])
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(json!({ "ok": true }))
}

pub fn mcp_list(conn: &Connection) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare("SELECT payload_json FROM mcp")?;
    let mut rows = stmt.query([])?;
    let mut out = Vec::new();
    while let Some(r) = rows.next()? {
        let s: String = r.get(0)?;
        if let Ok(v) = serde_json::from_str::<Value>(&s) {
            out.push(v);
        }
    }
    Ok(Value::Array(out))
}

pub fn mcp_save(conn: &Connection, cfg: &Value) -> rusqlite::Result<Value> {
    let id = cfg["id"].as_str().map(|s| s.to_string()).unwrap_or_else(|| nid("mcp"));
    let mut payload = cfg.clone();
    payload["id"] = json!(id);
    payload["transport"] = json!(cfg["transport"].as_str().unwrap_or("stdio"));
    payload["state"] = json!("AVAILABLE");
    payload["updatedAt"] = json!(now());
    if payload.get("createdAt").is_none() {
        payload["createdAt"] = json!(now());
    }
    if payload.get("config").is_none() {
        payload["config"] = json!({
            "transport": "stdio",
            "command": cfg["command"],
            "args": cfg["args"],
            "enabled": cfg["enabled"],
            "pinned": cfg["pinned"]
        });
    }
    conn.execute(
        "INSERT INTO mcp (id, payload_json) VALUES (?1,?2) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
        params![id, payload.to_string()],
    )?;
    Ok(json!({ "id": id }))
}

pub fn mcp_remove(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM mcp WHERE id=?1", [id])?;
    Ok(())
}

pub fn approval_request(conn: &Connection, execution_id: &str, node_key: &str, summary: &str, payload: &Value, requested_by: &str) -> rusqlite::Result<Value> {
    let id = nid("appr");
    // C-2 (archive 4): the request is BOUND at birth — who asked (requested_by)
    // and what authority may answer (authority, always `human` for native
    // approvals). The decision later has to prove it came through that authority.
    conn.execute(
        "INSERT INTO approvals (id,execution_id,node_key,summary,payload_json,status,created_at,requested_by,authority) VALUES (?1,?2,?3,?4,?5,'OPEN',?6,?7,'human')",
        params![id, execution_id, node_key, summary, payload.to_string(), now(), requested_by],
    )?;
    Ok(json!({ "id": id, "requestedBy": requested_by, "authority": "human" }))
}

pub fn approval_get(conn: &Connection, execution_id: &str, node_key: &str) -> rusqlite::Result<Value> {
    let row: Option<(String, String)> = conn
        .query_row(
            "SELECT status, id FROM approvals WHERE execution_id=?1 AND node_key=?2 AND status!='OPEN' ORDER BY created_at DESC LIMIT 1",
            params![execution_id, node_key],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    match row {
        Some((status, _)) => Ok(json!({ "decided": true, "status": status })),
        None => Ok(json!({ "decided": false })),
    }
}

pub fn approval_list(conn: &Connection) -> rusqlite::Result<Value> {
    // Capabilities are NEVER listed — they exist only as a hash in the row and
    // as the one-time return value of approval_authorize (archive 4, C-2).
    let mut stmt = conn.prepare("SELECT id,execution_id,node_key,summary,payload_json,status,created_at,requested_by,authority FROM approvals WHERE status='OPEN'")?;
    let rows = stmt.query_map([], |r| {
        Ok(json!({
            "id": r.get::<_, String>(0)?,
            "executionId": r.get::<_, String>(1)?,
            "nodeKey": r.get::<_, String>(2)?,
            "summary": r.get::<_, String>(3)?,
            "payload": serde_json::from_str::<Value>(&r.get::<_, String>(4)?).unwrap_or(json!({})),
            "status": r.get::<_, String>(5)?,
            "createdAt": r.get::<_, String>(6)?,
            "requestedBy": r.get::<_, String>(7)?,
            "authority": r.get::<_, String>(8)?,
        }))
    })?;
    Ok(Value::Array(rows.filter_map(|r| r.ok()).collect()))
}

/// Snapshot for the native authorize dialog: (status, summary, requested_by, authority).
pub fn approval_open_info(conn: &Connection, id: &str) -> rusqlite::Result<Option<(String, String, String, String)>> {
    conn.query_row(
        "SELECT status, summary, requested_by, authority FROM approvals WHERE id=?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )
    .optional()
}

fn cap_fingerprint(token: &str) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(token.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// C-2 (archive 4) — THE NATIVE APPROVAL CAPABILITY.
///
/// Only this mint stores anything a later decision can present, and the only
/// caller of this mint is `commands::approval_authorize`, which gates it on a
/// native OS dialog the WebView cannot answer for itself. The row keeps the
/// SHA-256 of the token (never the token), the freshness window, and the ONE
/// verdict the capability is allowed to cast — so a capability minted while
/// looking at an APPROVED dialog cannot later cast REJECTED, and vice versa.
pub fn approval_mint_capability(conn: &Connection, id: &str, decision: &str, ttl_secs: i64) -> Result<Value, String> {
    if decision != "APPROVED" && decision != "REJECTED" {
        return Err(format!("approval_authorize: decision must be APPROVED or REJECTED (got {decision:?})"));
    }
    let status: Option<String> = conn
        .query_row("SELECT status FROM approvals WHERE id=?1", [id], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    match status {
        None => return Err(format!("approval {id} does not exist — no capability was minted.")),
        Some(st) if st != "OPEN" => {
            return Err(format!(
                "approval {id} is not OPEN (current status {st}) — no capability is minted for a decision that already happened."
            ))
        }
        _ => {}
    }
    let token = nid("cap");
    let expires = now_unix().saturating_add(ttl_secs.max(60));
    conn.execute(
        "UPDATE approvals SET cap_hash=?2, cap_expires_at=?3, cap_decision=?4 WHERE id=?1 AND status='OPEN'",
        params![id, cap_fingerprint(&token), expires, decision],
    )
    .map_err(|e| e.to_string())?;
    Ok(json!({ "capability": token, "expiresAt": expires, "approvalId": id, "decision": decision }))
}

/* C-2, two rounds deep:
 *
 * Archive 3 fixed the STATE MACHINE (enumerated decision, OPEN only, exactly
 * once, unknown id errors — all still enforced below, still one atomic
 * statement). Archive 4 closes the remaining hole the reviewer named: the
 * transition proved the state, not the ACTOR. There was no approver identity,
 * no scope, no freshness — any code that knew an id could drive the machine.
 *
 * A decision now presents the native approval capability minted by
 * `approval_mint_capability` (only reachable through the OS dialog in
 * `approval_authorize`), and this function proves, before the UPDATE:
 *
 *   - the token was minted FOR THIS approval (hash match — a token minted for
 *     any other request is a confused-approver and is refused),
 *   - it is still fresh (inside its expiry window),
 *   - it casts exactly THIS verdict (a dialog seen for APPROVED cannot cast
 *     REJECTED),
 *   - and it is single-use: the transition clears it, so replay after the
 *     decision lands on the not-OPEN guard like any other second flip.
 */
pub fn approval_decide(conn: &Connection, id: &str, decision: &str, capability: &str) -> Result<(), String> {
    if decision != "APPROVED" && decision != "REJECTED" {
        return Err(format!(
            "approval_decide: decision must be APPROVED or REJECTED (got {decision:?})"
        ));
    }
    if capability.trim().is_empty() {
        return Err(format!(
            "approval {id}: no capability presented — a decision must first pass approval_authorize, where a human answers the native dialog. Requester code cannot decide its own request."
        ));
    }
    let row: Option<(String, String, i64, String)> = conn
        .query_row(
            "SELECT status, cap_hash, cap_expires_at, cap_decision FROM approvals WHERE id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let (status, cap_hash, cap_expires_at, cap_decision) = match row {
        None => return Err(format!("approval {id} does not exist — nothing was changed.")),
        Some(r) => r,
    };
    if status != "OPEN" {
        return Err(format!(
            "approval {id} is not OPEN (current status {status}) — a decision is final; an approval moves exactly once, from OPEN to APPROVED or REJECTED."
        ));
    }
    if cap_hash.is_empty() {
        return Err(format!(
            "approval {id} has no live capability — call approval_authorize first; the human's answer at the native dialog is what makes a decision legitimate."
        ));
    }
    if cap_fingerprint(capability) != cap_hash {
        return Err(format!(
            "capability does not belong to approval {id} — it was minted for a different request (confused-approver refused)."
        ));
    }
    if now_unix() > cap_expires_at {
        return Err(format!(
            "capability for approval {id} expired (freshness window closed at unix {cap_expires_at}) — return to approval_authorize for a fresh answer."
        ));
    }
    if cap_decision != decision {
        return Err(format!(
            "capability for approval {id} was minted for {cap_decision}; it cannot cast {decision}. Re-open approval_authorize and let the human pick this verdict explicitly."
        ));
    }
    let changed = conn
        .execute(
            "UPDATE approvals SET status=?2, decided_by='human:dialog', decided_at=?3, cap_hash='', cap_expires_at=0, cap_decision='' WHERE id=?1 AND status='OPEN'",
            params![id, decision, now()],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        // A racing second decision consumed the row between our check and the write.
        let st: Option<String> = conn
            .query_row("SELECT status FROM approvals WHERE id=?1", [id], |r| r.get(0))
            .optional()
            .map_err(|e| e.to_string())?;
        return Err(match st {
            Some(st) => format!("approval {id} is not OPEN (current status {st}) — another decision landed first."),
            None => format!("approval {id} does not exist — nothing was changed."),
        });
    }
    Ok(())
}

pub fn feedback_add(conn: &Connection, execution_id: &str, node_key: &str, rating: i64, comment: &str) -> rusqlite::Result<Value> {
    let id = nid("fb");
    conn.execute(
        "INSERT INTO feedback (id,execution_id,node_key,rating,comment,created_at) VALUES (?1,?2,?3,?4,?5,?6)",
        params![id, execution_id, node_key, rating, comment, now()],
    )?;
    Ok(json!({ "id": id }))
}

pub fn feedback_list(conn: &Connection) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare("SELECT id,execution_id,node_key,rating,comment,created_at FROM feedback ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |r| {
        Ok(json!({
            "id": r.get::<_, String>(0)?,
            "executionId": r.get::<_, String>(1)?,
            "nodeKey": r.get::<_, String>(2)?,
            "rating": r.get::<_, i64>(3)?,
            "comment": r.get::<_, String>(4)?,
            "createdAt": r.get::<_, String>(5)?,
        }))
    })?;
    Ok(Value::Array(rows.filter_map(|r| r.ok()).collect()))
}

pub fn dlq_add(conn: &Connection, payload: &Value) -> rusqlite::Result<Value> {
    let id = nid("dlq");
    let mut p = payload.clone();
    p["id"] = json!(id);
    p["status"] = json!("OPEN");
    p["createdAt"] = json!(now());
    conn.execute("INSERT INTO dlq (id, payload_json) VALUES (?1,?2)", params![id, p.to_string()])?;
    Ok(json!({ "id": id }))
}

pub fn dlq_list(conn: &Connection) -> rusqlite::Result<Value> {
    let mut stmt = conn.prepare("SELECT payload_json FROM dlq")?;
    let mut rows = stmt.query([])?;
    let mut out = Vec::new();
    while let Some(r) = rows.next()? {
        let s: String = r.get(0)?;
        if let Ok(v) = serde_json::from_str::<Value>(&s) {
            if v["status"] == "OPEN" {
                out.push(v);
            }
        }
    }
    Ok(Value::Array(out))
}

pub fn dlq_resolve(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    let payload: Option<String> = conn.query_row("SELECT payload_json FROM dlq WHERE id=?1", [id], |r| r.get(0)).optional()?;
    if let Some(p) = payload {
        if let Ok(mut v) = serde_json::from_str::<Value>(&p) {
            v["status"] = json!("RESOLVED");
            conn.execute("UPDATE dlq SET payload_json=?2 WHERE id=?1", params![id, v.to_string()])?;
        }
    }
    Ok(())
}

pub fn db_size(path: &Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

pub fn seed_mcp_if_empty(conn: &Connection) -> rusqlite::Result<()> {
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM mcp", [], |r| r.get(0))?;
    if n > 0 {
        return Ok(());
    }
    let catalog = [
        ("mcp.filesystem", "Filesystem", "npx", json!(["-y", "tsx", "vendor/mcp-servers-reference/src/filesystem/index.ts"])),
        ("mcp.git", "Git", "python", json!(["-m", "mcp_server_git"])),
        ("mcp.memory", "Memory", "npx", json!(["-y", "tsx", "vendor/mcp-servers-reference/src/memory/index.ts"])),
        ("mcp.sequential-thinking", "Sequential Thinking", "npx", json!(["-y", "tsx", "vendor/mcp-servers-reference/src/sequentialthinking/index.ts"])),
        ("mcp.time", "Time", "python", json!(["-m", "mcp_server_time"])),
        ("mcp.github", "GitHub", "github-mcp-server", json!(["stdio"])),
        ("mcp.control", "Control MCP", "mj-control-mcp", json!(["stdio"])),
    ];
    let ts = now();
    for (id, name, command, args) in catalog {
        let payload = json!({
            "id": id,
            "name": name,
            "transport": "stdio",
            "config": { "transport": "stdio", "command": command, "args": args, "enabled": id == "mcp.control", "pinned": true },
            "state": "AVAILABLE",
            "createdAt": ts,
            "updatedAt": ts,
        });
        conn.execute("INSERT INTO mcp (id, payload_json) VALUES (?1,?2)", params![id, payload.to_string()])?;
    }
    Ok(())
}

// ------------------------------------------------------------------ V11 (W6): the stub ledger, closed

/// Record a real usage touch for skills. Returns how many rows actually updated, so a caller
/// can distinguish "counted" from "counted nothing because the ids were stale".
pub fn skill_touch(conn: &Connection, skill_ids: &[String]) -> rusqlite::Result<Value> {
    let ts = now();
    let mut touched = 0i64;
    for id in skill_ids {
        touched += conn
            .execute(
                "UPDATE skills SET use_count = use_count + 1, last_used_at = ?2 WHERE id = ?1",
                params![id, ts],
            )
            .unwrap_or(0) as i64;
    }
    Ok(json!({ "touched": touched, "requested": skill_ids.len(), "at": ts }))
}

/// Persist one evaluation result with a real id, or replace nothing — the id is what the UI
/// links history entries by, so it must be the stored one.
pub fn evaluation_save(
    conn: &Connection,
    node_key: &str,
    execution_id: Option<&str>,
    suite: &Value,
    score: f64,
    details: &Value,
) -> rusqlite::Result<Value> {
    let id = nid("eval");
    let ts = now();
    conn.execute(
        "INSERT INTO evaluations (id, node_key, execution_id, suite_json, score, details_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, node_key, execution_id, suite.to_string(), score, details.to_string(), ts],
    )?;
    Ok(json!({ "id": id, "nodeKey": node_key, "score": score, "createdAt": ts }))
}

/// The real history for a node, newest first. An empty array now genuinely means "never evaluated".
pub fn evaluation_history(conn: &Connection, node_key: &str) -> rusqlite::Result<Value> {
    let mut st = conn
        .prepare("SELECT id, execution_id, suite_json, score, details_json, created_at FROM evaluations WHERE node_key = ?1 ORDER BY created_at DESC LIMIT 100")?;
    let rows = st
        .query_map([node_key], |r| {
            Ok(json!({
                "id": r.get::<_, String>(0)?,
                "executionId": r.get::<_, Option<String>>(1)?,
                "suite": serde_json::from_str::<Value>(&r.get::<_, String>(2)?).unwrap_or(Value::Null),
                "score": r.get::<_, f64>(3)?,
                "details": serde_json::from_str::<Value>(&r.get::<_, String>(4)?).unwrap_or(Value::Null),
                "createdAt": r.get::<_, String>(5)?,
            }))
        })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(Value::Array(out))
}

/// Upsert a suite by id (a new id is minted when the caller does not supply one).
pub fn suite_save(conn: &Connection, suite_id: Option<&str>, name: &str, cases: &Value) -> rusqlite::Result<Value> {
    let id = suite_id.map(str::to_string).unwrap_or_else(|| nid("suite"));
    let ts = now();
    conn.execute(
        "INSERT INTO suites (id, name, cases_json, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, cases_json = excluded.cases_json, updated_at = excluded.updated_at",
        params![id, name, cases.to_string(), ts],
    )?;
    Ok(json!({ "id": id, "name": name, "updatedAt": ts }))
}

/// Every stored suite, newest update first.
pub fn suite_list(conn: &Connection) -> rusqlite::Result<Value> {
    let mut st = conn
        .prepare("SELECT id, name, cases_json, updated_at FROM suites ORDER BY updated_at DESC")?;
    let rows = st
        .query_map([], |r| {
            Ok(json!({
                "id": r.get::<_, String>(0)?,
                "name": r.get::<_, String>(1)?,
                "cases": serde_json::from_str::<Value>(&r.get::<_, String>(2)?).unwrap_or(Value::Null),
                "updatedAt": r.get::<_, String>(3)?,
            }))
        })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(Value::Array(out))
}

/* ── C-2 regression tests (security review of archive 3) ────────────────────
 * approval_decide / evolution_decide used to be unconditional UPDATEs. These
 * pin the authority-checked transition: enumerated decisions, OPEN/PROPOSED
 * only, exactly once, unknown ids error instead of silently succeeding.
 *
 *   cargo test c2_
 * ────────────────────────────────────────────────────────────────────────── */
#[cfg(test)]
mod c2_decision_transition_tests {
    use super::{approval_decide, approval_mint_capability, approval_request, ensure_approval_authority_columns, evolution_decide, Connection};

    /// The SHIPPED schema (init), not a hand-rolled copy: the code that runs
    /// in production is the code these tests exercise.
    fn approvals_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        super::init(&conn).unwrap();
        conn.execute(
            "INSERT INTO approvals (id,execution_id,node_key,summary,payload_json,status,created_at) VALUES ('ap1','ex1','n1','s','{}','OPEN','t1')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO approvals (id,execution_id,node_key,summary,payload_json,status,created_at) VALUES ('ap2','ex1','n2','s','{}','OPEN','t1')",
            [],
        )
        .unwrap();
        conn
    }

    /// Mint through the same function the native dialog path uses.
    fn mint(conn: &Connection, id: &str, decision: &str) -> String {
        let v = approval_mint_capability(conn, id, decision, 300).unwrap();
        v["capability"].as_str().unwrap().to_string()
    }

    #[test]
    fn request_binds_requester_and_required_authority() {
        let conn = approvals_db();
        let v = approval_request(&conn, "ex9", "wf:node1", "ship it", &serde_json::json!({}), "workflow:wf1").unwrap();
        assert_eq!(v["requestedBy"], "workflow:wf1");
        assert_eq!(v["authority"], "human");
        let (req, auth): (String, String) = conn
            .query_row(
                "SELECT requested_by, authority FROM approvals WHERE id=?1",
                [v["id"].as_str().unwrap()],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!((req.as_str(), auth.as_str()), ("workflow:wf1", "human"));
    }

    #[test]
    fn decide_without_capability_is_refused() {
        let conn = approvals_db();
        let err = approval_decide(&conn, "ap1", "APPROVED", "").unwrap_err();
        assert!(err.contains("no capability"), "must demand the capability: {err}");
        assert_eq!(
            conn.query_row("SELECT status FROM approvals WHERE id='ap1'", [], |r| r.get::<_, String>(0)).unwrap(),
            "OPEN"
        );
    }

    #[test]
    fn decide_with_fresh_capability_lands_once() {
        let conn = approvals_db();
        let cap = mint(&conn, "ap1", "APPROVED");
        assert!(approval_decide(&conn, "ap1", "APPROVED", &cap).is_ok());
        let (st, by, hash): (String, String, String) = conn
            .query_row("SELECT status, decided_by, cap_hash FROM approvals WHERE id='ap1'", [], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })
            .unwrap();
        assert_eq!(st, "APPROVED");
        assert_eq!(by, "human:dialog", "the decision must record HOW it was authorized");
        assert_eq!(hash, "", "the capability must be consumed (single-use)");
        // replay of the same capability lands on the not-OPEN guard
        let err = approval_decide(&conn, "ap1", "APPROVED", &cap).unwrap_err();
        assert!(err.contains("not OPEN"), "replay must be a second-flip error: {err}");
    }

    #[test]
    fn foreign_capability_is_a_confused_approver() {
        let conn = approvals_db();
        let cap = mint(&conn, "ap2", "APPROVED"); // minted against ap2
        let err = approval_decide(&conn, "ap1", "APPROVED", &cap).unwrap_err();
        assert!(err.contains("does not belong"), "cross-approval use must be refused: {err}");
        let st: String = conn.query_row("SELECT status FROM approvals WHERE id='ap1'", [], |r| r.get(0)).unwrap();
        assert_eq!(st, "OPEN");
    }

    #[test]
    fn capability_cannot_cast_the_other_verdict() {
        let conn = approvals_db();
        let cap = mint(&conn, "ap1", "APPROVED"); // human saw the APPROVED dialog
        let err = approval_decide(&conn, "ap1", "REJECTED", &cap).unwrap_err();
        assert!(err.contains("minted for APPROVED"), "scope must bind the verdict: {err}");
        assert!(approval_decide(&conn, "ap1", "APPROVED", &cap).is_ok());
    }

    #[test]
    fn expired_capability_is_refused() {
        let conn = approvals_db();
        let cap = mint(&conn, "ap1", "APPROVED");
        conn.execute("UPDATE approvals SET cap_expires_at=1 WHERE id='ap1'", []).unwrap(); // window long closed
        let err = approval_decide(&conn, "ap1", "APPROVED", &cap).unwrap_err();
        assert!(err.contains("expired"), "freshness must be enforced: {err}");
        assert_eq!(
            conn.query_row("SELECT status FROM approvals WHERE id='ap1'", [], |r| r.get::<_, String>(0)).unwrap(),
            "OPEN"
        );
    }

    #[test]
    fn decision_must_be_enumerated() {
        let conn = approvals_db();
        assert!(approval_mint_capability(&conn, "ap1", "MAYBE", 300).is_err());
        assert!(approval_mint_capability(&conn, "ap1", "approved", 300).is_err(), "typo != verdict");
        assert!(approval_decide(&conn, "ap1", "MAYBE", "whatever").is_err());
    }

    #[test]
    fn unknown_ids_error_everywhere() {
        let conn = approvals_db();
        let err = approval_mint_capability(&conn, "ghost", "APPROVED", 300).unwrap_err();
        assert!(err.contains("does not exist"), "{err}");
        let err = approval_decide(&conn, "ghost", "APPROVED", "cap_x").unwrap_err();
        assert!(err.contains("does not exist"), "must say the id is unknown: {err}");
    }

    #[test]
    fn minting_against_a_decided_approval_is_refused() {
        let conn = approvals_db();
        let cap = mint(&conn, "ap1", "APPROVED");
        approval_decide(&conn, "ap1", "APPROVED", &cap).unwrap();
        let err = approval_mint_capability(&conn, "ap1", "REJECTED", 300).unwrap_err();
        assert!(err.contains("not OPEN"), "{err}");
    }

    #[test]
    fn existing_databases_gain_the_authority_columns() {
        let conn = Connection::open_in_memory().unwrap();
        // the archive-3 shape: seven columns, no authority material at all
        conn.execute_batch(
            "CREATE TABLE approvals (id TEXT PRIMARY KEY, execution_id TEXT NOT NULL, node_key TEXT NOT NULL,
             summary TEXT NOT NULL, payload_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
             INSERT INTO approvals VALUES ('ap1','ex1','n1','s','{}','OPEN','t1');",
        )
        .unwrap();
        ensure_approval_authority_columns(&conn).unwrap();
        let cols: Vec<String> = {
            let mut st = conn.prepare("SELECT name FROM pragma_table_info('approvals')").unwrap();
            st.query_map([], |r| r.get(0)).unwrap().filter_map(|r| r.ok()).collect()
        };
        for want in ["requested_by", "authority", "cap_hash", "cap_expires_at", "cap_decision", "decided_by", "decided_at"] {
            assert!(cols.iter().any(|c| c == want), "missing column {want}");
        }
        // and a decision without a capability on the migrated row is still refused
        let err = approval_decide(&conn, "ap1", "APPROVED", "").unwrap_err();
        assert!(err.contains("no capability"), "{err}");
    }

    #[test]
    fn evolution_decides_only_from_proposed() {
        let conn = Connection::open_in_memory().unwrap();
        super::init(&conn).unwrap();
        conn.execute(
            "INSERT INTO evolution (id,node_key,payload_json,decision,status,created_at) VALUES ('ev1','n1','{}','PENDING','PROPOSED','t1')",
            [],
        )
        .unwrap();
        assert!(evolution_decide(&conn, "ev1", "ACCEPTED").is_ok());
        let err = evolution_decide(&conn, "ev1", "REJECTED").unwrap_err();
        assert!(err.contains("not PROPOSED"), "must say why: {err}");
        assert!(evolution_decide(&conn, "ev1", "whenever").is_err());
        assert!(evolution_decide(&conn, "ghost", "ACCEPTED").is_err());
    }
}
