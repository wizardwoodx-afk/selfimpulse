import React, { useMemo, useState } from "react";
import { useVh, memoryGraphData, memoryStats, memorySecurity } from "../store";
import { ForceGraph, type FgNode, type FgLink } from "../graph/ForceGraph";

/**
 * MEMORY — a cool, organic cluster of everything the Captain remembers.
 * Sessions are the large nodes; keywords the small ones. Double-click a session to open it.
 */
export function Memory(): React.ReactElement {
  const { sessions, memOn, setMemory, clearMemory, openConversation, forgetSession, vault } = useVh();
  const [spin, setSpin] = useState(true);
  const [fit, setFit] = useState(0);
  const [sel, setSel] = useState<FgNode | null>(null);
  const [confirm, setConfirm] = useState(false);

  const { nodes, links, stats, sec } = useMemo(() => {
    const g = memoryGraphData(); const stats = memoryStats(); const sec = memorySecurity();
    const nodes: FgNode[] = [];
    const links: FgLink[] = [];
    for (const s of sessions) nodes.push({ id: `s:${s.id}`, name: s.title, kind: "session", val: 4 + Math.min(8, s.messageCount), sub: `${s.messageCount} messages · ${new Date(s.startedAt).toLocaleDateString()}` });
    for (const n of g.nodes) { nodes.push({ id: `k:${n.id}`, name: n.label, kind: "keyword", val: 1 + Math.min(5, n.weight) }); for (const sid of n.sessionIds) if (sessions.some((s) => s.id === sid)) links.push({ source: `s:${sid}`, target: `k:${n.id}` }); }
    for (const e of g.edges) links.push({ source: `k:${e.a}`, target: `k:${e.b}` });
    return { nodes, links, stats, sec };
  }, [sessions]);

  const selSession = sel?.id.startsWith("s:") ? sessions.find((s) => `s:${s.id}` === sel.id) ?? null : null;
  const open = (n: FgNode) => { if (n.id.startsWith("s:")) openConversation(n.id.slice(2)); };

  return (
    <>
      <header className="top"><h2>Memory</h2><span className="sub">everything the crew remembers · {sessions.length} conversation{sessions.length === 1 ? "" : "s"}</span>
        <div className="right"><span className={`pill ${sec.mode === "sealed" ? "ok" : "warn"}`}>{sec.mode === "sealed" ? "encrypted at rest" : sec.mode === "locked" ? "vault locked" : vault.status === "no-passphrase" ? "on device · no vault" : "plaintext on device"}</span><label className="switch"><input type="checkbox" checked={memOn} onChange={(e) => setMemory(e.target.checked)} /><i /><span>Remember</span></label></div></header>
      {nodes.length === 0 ? (
        <div className="scroll"><div className="empty" style={{ height: "100%" }}><h3>Nothing remembered yet</h3><p>{memOn ? "Conversations you have with the Captain will cluster here by topic — nothing leaves this device." : "Memory is off. Turn it on to keep conversations on this device."}</p></div></div>
      ) : (
        <div className="graph-wrap memory">
          <ForceGraph mode="memory" nodes={nodes} links={links} autoRotate={spin} fitSignal={fit} onNodeClick={setSel} onNodeDoubleClick={open} />
          <div className="hud">
            <div className="card"><div className="card-b">
              <span className="mode-tag memory"><i />Memory graph · frosted cluster · no arrows</span>
              <div className="klist" style={{ marginTop: 8 }}>
                <div><span>Conversations</span><span>{sessions.length}</span></div>
                <div><span>Topics</span><span>{stats.nodes}</span></div>
                <div><span>Links</span><span>{stats.edges}</span></div>
                <div><span>At rest</span><span>{sec.mode}</span></div>
              </div>
              <div className="legend memory"><span><i style={{ background: "#E9EBEE" }} />conversations</span><span><i style={{ background: "#AEB8B5" }} />topics</span></div>
            </div></div>
          </div>
          <div className="hud-r">
            {sel ? (
              <div className="card"><div className="card-b">
                <span className="lbl">{sel.kind === "session" ? "Conversation" : "Topic"}</span>
                <h3 style={{ margin: "4px 0 2px" }}>{sel.name}</h3>
                {sel.sub && <p className="faint" style={{ margin: 0 }}>{sel.sub}</p>}
                {selSession && <>
                  <div className="tags">{selSession.keywords.slice(0, 8).map((k) => <span key={k}>{k}</span>)}</div>
                  <div className="acts"><button className="btn primary sm" onClick={() => open(sel)}>Open the conversation</button><button className="btn sm ghost" onClick={() => { forgetSession(selSession.id); setSel(null); }}>Forget</button></div>
                </>}
                {!selSession && <p className="hint">Double-click a conversation node to open it.</p>}
              </div></div>
            ) : (
              <div className="card soft"><div className="card-b"><p className="hint" style={{ margin: 0 }}>Click a node for detail · double-click a conversation to open it</p></div></div>
            )}
          </div>
          <div className="graph-foot"><button className="btn sm" onClick={() => setFit((n) => n + 1)}>Fit</button><button className={`btn sm ${spin ? "" : "ghost"}`} onClick={() => setSpin((s) => !s)}>Auto-rotate</button>
            {!confirm ? <button className="btn sm ghost danger" onClick={() => setConfirm(true)}>Forget everything</button> : <><span className="hint">This cannot be undone.</span><button className="btn sm danger" onClick={() => { clearMemory(); setConfirm(false); setSel(null); }}>Yes, forget</button><button className="btn sm ghost" onClick={() => setConfirm(false)}>Keep</button></>}
          </div>
        </div>
      )}
    </>
  );
}
