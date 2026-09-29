import React, { useCallback, useEffect, useState } from "react";
import { ipc, useTauri, type McpServerSaveInput } from "../../ipc/client";
import type { McpServerEntry } from "../../domain/types";

/**
 * The MCP surface.
 *
 * The native half of this already existed and worked: five Tauri commands
 * (`mcp_server_list`, `mcp_server_save`, `mcp_server_remove`,
 * `mcp_connect_test`, `mcp_call`), a Rust stdio host that performs a real
 * `initialize` / `tools/list` / `tools/call` handshake, and ipc client wrappers
 * for all five. What was missing was the page those wrappers were written for —
 * `McpPage` was named in the ipc client's own comments and had never been
 * built. Until now the whole capability was reachable only by editing the
 * database by hand.
 *
 * Two rules this screen follows:
 *
 *  1. **Nothing is reported before it happened.** A server reads "connected"
 *     only when the native host returned a JSON-RPC reply. There is no
 *     optimistic state and no tool count that was not counted.
 *
 *  2. **A failure is shown, not swallowed.** `lastError` is displayed verbatim.
 *     A server that cannot start is a fact about the machine, and hiding it
 *     makes a broken configuration look like an empty one.
 */

export interface ConnectResult {
  connected: boolean;
  toolCount: number;
  lastError?: string | null;
  name?: string;
  transport?: string;
  tools?: Array<{ name: string; description?: string }> | null;
  notImplementedTools?: string[] | null;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "not valid JSON" };
  }
}

export function Mcp(): React.ReactElement {
  const native = useTauri();
  const [servers, setServers] = useState<McpServerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [probe, setProbe] = useState<Record<string, ConnectResult>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState<{ tool: string; body: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<McpServerSaveInput>({ name: "", command: "", args: [] });

  const load = useCallback(async () => {
    try {
      setServers(await ipc.mcpServerList());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setServers([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const test = useCallback(async (id: string) => {
    setBusy(id);
    try {
      // The await has to happen before the updater, not inside it: the updater is
      // a plain (non-async) function, so awaiting in its body is a syntax error.
      const outcome = (await ipc.mcpConnectTest(id)) as unknown as ConnectResult;
      setProbe((p) => ({ ...p, [id]: outcome }));
    } catch (e) {
      setProbe((p) => ({
        ...p,
        [id]: { connected: false, toolCount: 0, lastError: e instanceof Error ? e.message : String(e) },
      }));
    } finally {
      setBusy(null);
    }
  }, []);

  const call = useCallback(async (id: string, tool: string) => {
    const parsed = parseJson(args);
    if (!parsed.ok) {
      setResult({ tool, body: `Arguments are not valid JSON: ${parsed.error}` });
      return;
    }
    setBusy(id);
    try {
      const r = await ipc.mcpCall(id, tool, parsed.value);
      setResult({ tool, body: JSON.stringify(r, null, 2) });
    } catch (e) {
      setResult({ tool, body: `Call failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  }, [args]);

  const save = useCallback(async () => {
    if (!draft.name.trim() || !draft.command?.trim()) return;
    setBusy("save");
    try {
      await ipc.mcpServerSave({ ...draft, name: draft.name.trim(), command: draft.command.trim() });
      setAdding(false);
      setDraft({ name: "", command: "", args: [] });
      await load();
    } finally {
      setBusy(null);
    }
  }, [draft, load]);

  const remove = useCallback(async (id: string) => {
    setBusy(id);
    try {
      await ipc.mcpServerRemove(id);
      setProbe((p) => { const n = { ...p }; delete n[id]; return n; });
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  const rows = servers ?? [];

  return (
    <>
      <section className="sgroup">
        <h3>MCP servers</h3>
        <p className="lead">
          Servers the crew may call. Each is a real process: connecting spawns it,
          performs the handshake, and counts the tools it actually returned.
        </p>

        {!native && (
          <div className="note warn">
            Browser preview — servers run as local processes, so connecting needs the
            desktop build. Nothing below has been contacted.
          </div>
        )}
        {loadError && <div className="note bad">Could not read the server list: {loadError}</div>}

        {rows.length === 0 && !loadError && (
          <div className="empty">
            <h3>No servers registered</h3>
            <p>The crew is using its built-in tools only.</p>
          </div>
        )}

        {rows.map((s) => {
          const r = probe[s.id];
          const enabled = s.config?.enabled ?? false;
          // `pinned` lives under `config`, not on the record: a pinned server is
          // part of the seeded catalog and has no Remove button, so a user
          // cannot delete the control plane out from under the app.
          const pinned = s.config?.pinned ?? false;
          return (
            <div key={s.id} className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <b>{s.name}</b>
                <span className="mono faint">{s.id}</span>
                <span className={`dot ${r ? (r.connected ? "ok" : "refused") : "pending"}`} />
                <span className="hint" style={{ marginLeft: "auto" }}>
                  {r
                    ? r.connected
                      ? `connected · ${r.toolCount} tool${r.toolCount === 1 ? "" : "s"}`
                      : "not connected"
                    : enabled
                      ? "enabled · not yet tested"
                      : "disabled"}
                </span>
                <button className="btn sm" disabled={busy === s.id || !native}
                        onClick={() => void test(s.id)}>
                  {busy === s.id ? "Testing…" : "Test connection"}
                </button>
                {!pinned && (
                  <button className="btn sm danger" disabled={busy === s.id}
                          onClick={() => void remove(s.id)}>Remove</button>
                )}
              </div>
              <div className="mono faint">
                {s.config?.command} {(s.config?.args ?? []).join(" ")}
              </div>
              {r?.lastError && <div className="note bad">{String(r.lastError)}</div>}
              {r && !r.connected && !r.lastError && (
                <div className="note warn">The host got no JSON-RPC reply.</div>
              )}

              {r?.connected && (
                <>
                  <div className="acts">
                    <button className="btn sm ghost" onClick={() => setOpen(open === s.id ? null : s.id)}>
                      {open === s.id ? "Hide tools" : `Browse ${r.toolCount} tool${r.toolCount === 1 ? "" : "s"}`}
                    </button>
                  </div>
                  {open === s.id && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                      {(r.tools ?? []).map((t) => (
                        <div key={t.name} className="row" style={{ marginBottom: 0 }}>
                          <span className="mono">{t.name}</span>
                          <span className="hint" style={{ flex: 1 }}>{t.description ?? "—"}</span>
                          <button className="btn sm" disabled={busy === s.id}
                                  onClick={() => void call(s.id, t.name)}>Call</button>
                        </div>
                      ))}
                      <label className="field" style={{ maxWidth: "none" }}>
                        <span>Arguments (JSON)</span>
                        <input className="input" value={args} onChange={(e) => setArgs(e.target.value)} />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {result && (
          <div className="note" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            <b>{result.tool}</b>{"\n"}{result.body}
          </div>
        )}

        <div className="acts">
          <button className="btn ghost" onClick={() => setAdding(!adding)}>
            {adding ? "Cancel" : "Add a server"}
          </button>
        </div>

        {adding && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <label className="field"><span>Name</span>
              <input className="input" value={draft.name}
                     onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="field"><span>Command</span>
              <input className="input" value={draft.command ?? ""}
                     onChange={(e) => setDraft({ ...draft, command: e.target.value })} />
            </label>
            <label className="field"><span>Arguments (space separated)</span>
              <input className="input" value={(draft.args ?? []).join(" ")}
                     onChange={(e) => setDraft({ ...draft, args: e.target.value.split(/\s+/).filter(Boolean) })} />
            </label>
            <div className="acts">
              <button className="btn" disabled={busy === "save" || !draft.name.trim() || !draft.command?.trim()}
                      onClick={() => void save()}>Save server</button>
              <span className="hint">
                Saved servers are listed here until removed. Connecting is always an explicit test.
              </span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

