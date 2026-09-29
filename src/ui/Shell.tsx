import React, { useEffect } from "react";
import { PRODUCT_NAME } from "../brand";
import { useVh, type Screen } from "./store";
import { Steward } from "./screens/Steward";
import { Work } from "./screens/Work";
import { Specialists } from "./screens/Specialists";
import { Receipts } from "./screens/Receipts";
import { Memory } from "./screens/Memory";
import { Docs } from "./screens/Docs";
import { Settings } from "./screens/Settings";
import { Chat } from "./screens/Chat";
import { WindowControls } from "./WindowControls";
import { ErrorBoundary } from "../panels/ErrorBoundary";
import { Toasts } from "../panels/Toast";

const NAV: Array<{ key: Screen; label: string; icon: string }> = [
  { key: "steward", label: "Captain", icon: "steward" },
  { key: "work", label: "Work", icon: "crew" },
  { key: "specialists", label: "Specialists", icon: "specialists" },
  { key: "receipts", label: "Receipts", icon: "receipts" },
  { key: "docs", label: "Docs", icon: "docs" },
  { key: "memory", label: "Memory", icon: "memory" },
  { key: "settings", label: "Settings", icon: "settings" },
];

/** Each door gets its own boundary, so one bad screen cannot blank the shell. */
function door(key: Screen, el: React.ReactElement) {
  return (
    <ErrorBoundary label={NAV.find((n) => n.key === key)?.label ?? key} resetKey={key}>
      {el}
    </ErrorBoundary>
  );
}

export function Shell(): React.ReactElement {
  const { screen, go, provider, busy, ownerHandle, vault, boot, newMission, gate, stewardName } = useVh();
  useEffect(() => { void boot(); }, [boot]);

  const counts: Partial<Record<Screen, number>> = {
    work: busy || gate ? 1 : 0,
    receipts: useVh.getState().receipts().filter((r) => r.state !== "pending").length,
  };

  return (
    <div className="app">
      {/* The window is created with `decorations: false`, so the OS draws no
          title bar. Without these controls the application has no way to be
          closed, minimised or moved except a keyboard shortcut. */}
      <WindowControls />
      <aside className="side">
        <div className="brand"><span className="mark" aria-hidden /><div><b>{PRODUCT_NAME}</b><small>ON-DEVICE · RECEIPTED</small></div></div>
        <button className="new" onClick={newMission}><span>New mission</span><i className="ic ic-steward" /></button>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => go(n.key)} aria-current={screen === n.key || (screen === "chat" && n.key === "memory") ? "page" : undefined}>
              <i className={`ic ic-${n.icon}`} />{n.label}
              {counts[n.key] ? <span className="n">{counts[n.key]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="status" onClick={() => go("settings")}>
            <span className={`led ${provider ? "ok" : "warn"}`} /><span>{provider ? "Connected" : "Plan-only"}</span><small>{provider ? provider.model || provider.kind : "no provider"}</small>
          </button>
          <button className="me" onClick={() => go("settings")}>
            <span className="av">{initials(ownerHandle)}</span>
            <div><b>{ownerHandle}</b><small>OWNER · {vault.status === "unlocked" ? "KEY SEALED" : vault.status === "sealed-locked" ? "VAULT LOCKED" : "NO VAULT"}</small></div>
            <i className="ic ic-chev" />
          </button>
        </div>
      </aside>
      <main className="main">
        {screen === "steward" && door("steward", <Steward />)}
        {screen === "work" && door("work", <Work />)}
        {screen === "specialists" && door("specialists", <Specialists />)}
        {screen === "receipts" && door("receipts", <Receipts />)}
        {screen === "docs" && door("docs", <Docs />)}
        {screen === "memory" && door("memory", <Memory />)}
        {screen === "settings" && door("settings", <Settings />)}
        {screen === "chat" && (
          <ErrorBoundary label="Conversation" resetKey={screen} onLeave={() => go("steward")}>
            <Chat title={stewardName} />
          </ErrorBoundary>
        )}
      </main>
      <Toasts />
    </div>
  );
}

function initials(s: string): string { return s.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "11"; }
