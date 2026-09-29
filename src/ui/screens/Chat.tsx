import React, { useEffect, useRef, useState } from "react";
import { useVh } from "../store";
import { Composer } from "./Composer";
import { GateCard } from "./GateCard";

/** The conversation view — reached from Memory (double-click a node) or "Open the conversation". */
export function Chat({ title }: { title: string }): React.ReactElement {
  const { msgs, busy, send, go, openSession, gate } = useVh();
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, gate]);
  const fmt = (iso: string) => { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  return (
    <>
      <header className="top"><h2>{openSession?.title ?? "Conversation"}</h2><span className="sub">{openSession ? "from memory" : "this session"}</span>
        <div className="right"><button className="btn sm ghost" onClick={() => go("memory")}>← Back to memory</button><button className="btn sm ghost" onClick={() => go("work")}>Watch the work</button></div></header>
      <div className="scroll"><div className="thread">
        {msgs.length === 0 && <div className="empty"><h3>Nothing here yet</h3><p>Start with the Steward and the conversation will appear here.</p></div>}
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.role === "user" ? "user" : ""}`}>
            <span className="av" />
            <div>
              <div className="who"><b>{m.role === "user" ? "You" : title}</b> · {fmt(m.at)}{m.rehydratedFrom ? <> · <span className="faint">continuing “{m.rehydratedFrom}”</span></> : null}</div>
              <p>{m.text}</p>
              {m.resp && (
                <div className="meta">
                  <span className={`pill ${m.resp.outcome === "refused" ? "bad" : m.resp.executed ? "ok" : "warn"}`}>{m.resp.outcome}</span>
                  {m.resp.specialistIds.length > 0 && <span className="pill">{m.resp.specialistIds.length} agent{m.resp.specialistIds.length === 1 ? "" : "s"}</span>}
                  {m.tok && m.tok.savedTokens > 0 && <span className="pill">−{m.tok.savedTokens} tokens</span>}
                  {m.resp.provenanceDigest && <span className="pill mono" title="provenance digest">{m.resp.provenanceDigest.slice(0, 8)}…</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        {gate && <div className="msg"><span className="av" /><div><GateCard /></div></div>}
        {busy && !gate && <div className="msg"><span className="av" /><div><div className="who"><b>{title}</b></div><p className="faint">Working — watch the graph in Work.</p></div></div>}
        <div ref={end} />
      </div></div>
      <div className="dock"><Composer small value={draft} onChange={setDraft} onSend={() => { void send(draft); setDraft(""); }} busy={busy} placeholder="Continue this conversation…" /></div>
    </>
  );
}
