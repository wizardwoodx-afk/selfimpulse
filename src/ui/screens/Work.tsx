import React, { useMemo, useState } from "react";
import { useVh } from "../store";
import { ForceGraph, type FgNode, type FgLink } from "../graph/ForceGraph";
import { GateCard } from "./GateCard";
import { getSpecialist } from "../../vh19/registry";

/**
 * WORK — the user watches the crew work as a top→bottom flow.
 * No transcript, no agent names: You → Captain → AGENT nn → tools → verify.
 * Built from the real GeneralistResponse (memberRuns, toolReceipts, outcome).
 */
export function Work(): React.ReactElement {
  const { lastResp, busy, gate, msgs, go, stewardName, savedTokens } = useVh();
  const [spin, setSpin] = useState(true);
  const [fit, setFit] = useState(0);

  const lastUser = [...msgs].reverse().find((m) => m.role === "user");
  const { nodes, links, agents, tools, receipts } = useMemo(() => build(lastResp, busy, gate?.ask.action ?? null, stewardName), [lastResp, busy, gate, stewardName]);
  const done = lastResp && !busy;
  const total = Math.max(1, tools + 2);
  const complete = done ? total : Math.min(total - 1, 1 + tools);

  return (
    <>
      <header className="top"><h2>Work</h2><span className="sub">{busy ? "1 running" : lastResp ? `last run · ${lastResp.outcome}` : "idle"}</span>
        <div className="right">{busy && <span className="pill accent">live</span>}<button className="btn sm" onClick={() => go("steward")}>New mission</button></div></header>

      {!lastResp && !busy && !gate ? (
        <div className="scroll"><div className="empty" style={{ height: "100%" }}><h3>No work yet</h3><p>Ask the Captain for an outcome and you'll watch the crew do it here — every step flowing top to bottom.</p><button className="btn primary" onClick={() => go("steward")}>Go to Captain</button></div></div>
      ) : (
        <div className="graph-wrap work">
          <ForceGraph mode="work" nodes={nodes} links={links} autoRotate={spin} fitSignal={fit} />
          <div className="hud">
            <div className="card"><div className="card-b">
              <span className="mode-tag work"><i />{lastResp?.office ? "IMPULSE-WORKSPACE · You → Captain → desks → workers" : "Mission DAG · metallic flow · top to bottom"}</span>
              <h3>{lastUser ? trunc(lastUser.text, 60) : "Mission"}</h3>
              <div className="prog"><i style={{ width: `${Math.round((complete / total) * 100)}%` }} /></div>
              <div className="klist">
                <div><span>Steps</span><span>{complete} / {total}</span></div>
                {lastResp?.office && <div><span>Desks</span><span>{lastResp.office.desks.length}</span></div>}
                <div><span>Agents</span><span>{lastResp?.office ? `${lastResp.office.floor.length} / ${lastResp.office.cap}` : agents}</span></div>
                <div><span>Receipts</span><span>{receipts}</span></div>
                <div><span>Waiting on you</span><span>{gate ? 1 : 0}</span></div>
                {savedTokens > 0 && <div><span>Tokens saved</span><span>{savedTokens}</span></div>}
              </div>
              <div className="legend work"><span><i style={{ background: "#D5B26B" }} />you</span><span><i style={{ background: "#E8C98A" }} />agents</span><span><i style={{ background: "#8C7A55" }} />tools</span><span><i style={{ background: "#E0A55C" }} />gate</span></div>
            </div></div>
            {lastResp && (
              <div className="card"><div className="card-b">
                <span className="lbl">{busy ? "Now" : "Result"}</span>
                <div className="klist" style={{ marginTop: 6 }}>
                  {(lastResp.office?.desks ?? []).slice(0, 8).map((d) => (
                    <div key={d.id}><span>{d.label} · {d.lead}{d.onFloor ? ` · ${d.onFloor} worker${d.onFloor === 1 ? "" : "s"}` : ""}</span><span className={`led ${d.onFloor ? (busy ? "live" : "ok") : "ok"}`} /></div>
                  ))}
                  {(lastResp.memberRuns ?? []).slice(0, 6).map((mr, i) => (
                    <div key={mr.specialistId}><span><span className="agent-tag">AGENT {String(i + 1).padStart(2, "0")}</span> · {mr.toolReceipts.length ? `${mr.toolReceipts.length} tool call${mr.toolReceipts.length === 1 ? "" : "s"}` : `${mr.providerCalls} call${mr.providerCalls === 1 ? "" : "s"}`}{mr.truncated ? " · partial" : ""}</span><span className={`led ${busy ? "live" : "ok"}`} /></div>
                  ))}
                  {!(lastResp.memberRuns?.length) && !(lastResp.office?.desks.length) && <div><span>{lastResp.outcome === "planned" ? "Planned — connect a provider to execute" : lastResp.outcome}</span><span className="led ok" /></div>}
                </div>
                {done && <button className="btn sm ghost" style={{ marginTop: 10 }} onClick={() => go("chat")}>Read the answer →</button>}
              </div></div>
            )}
          </div>
          {gate && <div className="gate-float"><GateCard /></div>}
          <div className="graph-foot"><button className="btn sm" onClick={() => setFit((n) => n + 1)}>Fit</button><button className={`btn sm ${spin ? "" : "ghost"}`} onClick={() => setSpin((s) => !s)}>Auto-rotate</button><span className="hint">drag to orbit · scroll to zoom · hover a node for detail</span></div>
        </div>
      )}
    </>
  );
}

function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function build(resp: ReturnType<typeof useVh.getState>["lastResp"], busy: boolean, gateAction: string | null, stewardName: string) {
  const nodes: FgNode[] = [{ id: "you", name: "You", kind: "you", val: 10 }, { id: "st", name: stewardName, kind: "captain", val: 7 }];
  const links: FgLink[] = [{ source: "you", target: "st", live: busy }];
  let tools = 0, receipts = 0;
  const ids = resp?.specialistIds ?? [];
  const runs = new Map((resp?.memberRuns ?? []).map((r) => [r.specialistId, r]));
  const office = resp?.office;
  const deskOf = new Map((office?.floor ?? []).map((s) => [s.id, s.desk]));
  if (office && office.desks.length > 0) {
    for (const d of office.desks) {
      nodes.push({ id: `d:${d.id}`, name: d.label, kind: "captain", val: 5, sub: `${d.lead} · ${d.onFloor} on floor` });
      links.push({ source: "st", target: `d:${d.id}`, live: busy });
    }
  }
  ids.forEach((sid, i) => {
    const tag = `AGENT ${String(i + 1).padStart(2, "0")}`;
    const sp = getSpecialist(sid);
    const run = runs.get(sid);
    const desk = deskOf.get(sid);
    const parent = desk && office?.desks.some((d) => d.id === desk) ? `d:${desk}` : "st";
    nodes.push({ id: `a${i}`, name: tag, kind: "agent", val: 6, live: busy, sub: sp?.category ? String(sp.category) : undefined });
    links.push({ source: parent, target: `a${i}`, live: busy });
    (run?.toolReceipts ?? []).forEach((t, j) => {
      const id = `t${i}_${j}`; tools += 1;
      const refused = /refus|denied|blocked/i.test(t.outcome);
      nodes.push({ id, name: `${t.tool} · ${t.outcome}`, kind: refused ? "refused" : "tool", val: 3, sub: t.inputPreview?.slice(0, 80) });
      links.push({ source: `a${i}`, target: id });
      if (t.digest) { receipts += 1; nodes.push({ id: `r${id}`, name: `receipt ${t.digest.slice(0, 8)}…`, kind: "wreceipt", val: 2 }); links.push({ source: id, target: `r${id}` }); }
    });
  });
  if (ids.length === 0 && busy) { nodes.push({ id: "a0", name: "AGENT 01", kind: "agent", val: 6, live: true }); links.push({ source: "st", target: "a0", live: true }); }
  if (gateAction) { nodes.push({ id: "gate", name: gateAction, kind: "gate", val: 5, live: true }); links.push({ source: ids.length ? "a0" : "st", target: "gate", live: true }); }
  if (resp?.provenanceDigest) { receipts += 1; nodes.push({ id: "prov", name: `provenance ${resp.provenanceDigest.slice(0, 8)}…`, kind: "wreceipt", val: 3 }); links.push({ source: "st", target: "prov" }); }
  if (resp && !busy) { nodes.push({ id: "v", name: `Verify · ${resp.outcome}`, kind: resp.outcome === "refused" ? "refused" : "tool", val: 4 }); (ids.length ? ids.map((_, i) => `a${i}`) : ["st"]).forEach((s) => links.push({ source: s, target: "v" })); }
  return { nodes, links, agents: Math.max(ids.length, busy ? 1 : 0), tools, receipts };
}
