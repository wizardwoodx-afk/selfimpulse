/**
 * SelfImpulse — the two 3D graphs.
 *
 * Renderer: 3d-force-graph (MIT, vasturiano) over three.js / WebGL / d3-force-3d.
 * That is the maintained OSS 3D force-graph. Cosmograph is GPU-faster at 50k+
 * nodes; our graphs are tens of nodes, so the Three.js path is the right one —
 * it lets each MODE have its own geometry, material and lighting.
 *
 * Two modes, impossible to confuse:
 *   • "work"   — mission DAG, top→bottom. Metallic octahedrons, champagne
 *                light, directional arrows + travelling particles. A floor
 *                grid in CSS sits under it.
 *   • "memory" — topic cluster. Frosted spheres, teal/sage emissive, no
 *                arrows, no particles, exponential fog. A starfield in CSS
 *                sits under it.
 *
 * WebGL is loaded on demand: the shell paints with zero GPU cost, and the
 * module stays importable in SSR / the render probe.
 */
import React, { useEffect, useRef } from "react";

/* 3d-force-graph's published types are generic over node/link; we keep the
   instance as a structural any so custom Three.js meshes don't fight them. */
type FgInst = {
  width: (n: number) => FgInst; height: (n: number) => FgInst;
  backgroundColor: (c: string) => FgInst; showNavInfo: (v: boolean) => FgInst;
  nodeThreeObject: (fn: (n: FgNode) => unknown) => FgInst;
  nodeThreeObjectExtend: (v: boolean) => FgInst;
  nodeLabel: (fn: (n: FgNode) => string) => FgInst;
  linkColor: (fn: (l: FgLink) => string) => FgInst;
  linkWidth: (fn: (l: FgLink) => number) => FgInst;
  linkOpacity: (n: number) => FgInst;
  linkDirectionalArrowLength: (n: number) => FgInst;
  linkDirectionalArrowRelPos: (n: number) => FgInst;
  linkDirectionalArrowColor: (fn: () => string) => FgInst;
  linkDirectionalParticles: (fn: (l: FgLink) => number) => FgInst;
  linkDirectionalParticleWidth: (n: number) => FgInst;
  linkDirectionalParticleColor: (fn: () => string) => FgInst;
  linkDirectionalParticleSpeed: (fn: (l: FgLink) => number) => FgInst;
  dagMode: (m: "td" | null) => FgInst; dagLevelDistance: (n: number) => FgInst;
  warmupTicks: (n: number) => FgInst; cooldownTicks: (n: number) => FgInst; cooldownTime: (n: number) => FgInst;
  onNodeClick: (fn: (n: FgNode) => void) => FgInst;
  d3Force: (name: string) => { strength: (n: number) => void } | undefined;
  cameraPosition: (pos: { x: number; y: number; z: number }, lookAt?: unknown, ms?: number) => FgInst;
  scene: () => { add: (...o: unknown[]) => void; fog?: unknown };
  controls: () => { autoRotate: boolean; autoRotateSpeed: number; enableDamping: boolean };
  onEngineStop: (fn: () => void) => FgInst; zoomToFit: (ms: number, pad: number) => FgInst;
  graphData: (data?: { nodes: FgNode[]; links: FgLink[] }) => { nodes: FgNode[]; links: FgLink[] };
  d3ReheatSimulation: () => FgInst;
  _destructor: () => void;
};
const loadRenderer = () => import("3d-force-graph").then((m) => m.default as unknown as new (el: HTMLElement) => FgInst);
const loadThree = () => import("three") as Promise<ThreeLib>;
type ThreeLib = {
  Mesh: new (g: unknown, m: unknown) => { add: (o: unknown) => void };
  OctahedronGeometry: new (r: number, d: number) => unknown;
  TetrahedronGeometry: new (r: number, d: number) => unknown;
  BoxGeometry: new (x: number, y: number, z: number) => unknown;
  SphereGeometry: new (r: number, w: number, h: number) => unknown;
  MeshStandardMaterial: new (o: Record<string, unknown>) => unknown;
  MeshPhysicalMaterial: new (o: Record<string, unknown>) => unknown;
  MeshBasicMaterial: new (o: Record<string, unknown>) => unknown;
  AmbientLight: new (c: number, i: number) => unknown;
  DirectionalLight: new (c: number, i: number) => { position: { set: (x: number, y: number, z: number) => void } };
  FogExp2: new (c: number, d: number) => unknown;
};

export type GraphMode = "work" | "memory";
export interface FgNode { id: string; name: string; kind: string; val?: number; live?: boolean; sub?: string }
export interface FgLink { source: string; target: string; live?: boolean }

/* MONOCHROME CUT — nodes are white/grey only; role reads through lightness and
 * geometry, not hue. Two functional colours survive: `live` (the accent —
 * something is happening RIGHT NOW) and `refused` (a safety fact that must
 * never be styled away). Everything else is a studio-grey ramp.
 *
 * This used to be a second hardcoded copy of the palette. It had already
 * drifted once from vh.css, which is how --fg-3 ended up shipping an
 * unreadable 4.15:1 in dark while the stylesheet's own comment claimed AA.
 * So the graph now READS the theme tokens at draw time and derives its
 * intermediate greys by blending between --fg and --fg-3. The literals that
 * remain are fallbacks for when the stylesheet has not loaded yet; they are
 * no longer the source of truth. */
function cssVar(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

function mix(a: string, b: string, t: number): string {
  const pa = /^#([0-9a-f]{6})$/i.exec(a.trim());
  const pb = /^#([0-9a-f]{6})$/i.exec(b.trim());
  if (!pa || !pb) return a;
  const na = parseInt(pa[1], 16), nb = parseInt(pb[1], 16);
  const ch = (sh: number): number =>
    Math.round((((na >> sh) & 255) + (((nb >> sh) & 255) - ((na >> sh) & 255)) * t));
  return "#" + [ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function palette(): Record<string, string> {
  const dark = currentTheme() === "dark";
  const bg = cssVar("--bg", dark ? "#000000" : "#F7F7F5");
  const fg = cssVar("--fg", dark ? "#F4F5F7" : "#141719");
  const fg3 = cssVar("--fg-3", dark ? "#7C828A" : "#656B72");
  /* "you" is the far end of the ramp: brightest on black, darkest on paper. */
  const pole = dark ? "#FFFFFF" : "#000000";
  return {
    you: mix(fg, pole, 0.3),
    gate: fg,
    captain: mix(fg, fg3, 0.08),
    consul: mix(fg, fg3, 0.13),
    adept: mix(fg, fg3, 0.22),
    session: mix(fg, fg3, 0.18),
    agent: mix(fg, fg3, 0.3),
    keyword: mix(fg, fg3, 0.45),
    wreceipt: mix(fg, fg3, 0.55),
    tool: mix(fg, fg3, 0.62),
    receipt: mix(fg, fg3, 0.72),
    live: cssVar("--accent", dark ? "#5BD4CE" : "#0A6E6A"),
    refused: cssVar("--bad", dark ? "#E5745F" : "#9C3B2D"),
    link: cssVar("--line", dark ? "rgba(255,255,255,.09)" : "rgba(18,20,24,.10)"),
    wlink: cssVar("--line-2", dark ? "rgba(255,255,255,.15)" : "rgba(18,20,24,.18)"),
    bg,
    fg,
  };
}

export function currentTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export interface ForceGraphProps {
  mode: GraphMode;
  nodes: FgNode[];
  links: FgLink[];
  onNodeDoubleClick?: (n: FgNode) => void;
  onNodeClick?: (n: FgNode) => void;
  autoRotate?: boolean;
  fitSignal?: number;
  className?: string;
}

export function ForceGraph({ mode, nodes, links, onNodeDoubleClick, onNodeClick, autoRotate = true, fitSignal = 0, className }: ForceGraphProps): React.ReactElement {
  const el = useRef<HTMLDivElement>(null);
  const g = useRef<FgInst | null>(null);
  const last = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const cbs = useRef({ onNodeDoubleClick, onNodeClick });
  cbs.current = { onNodeDoubleClick, onNodeClick };
  const data = useRef({ nodes, links }); data.current = { nodes, links };
  const rot = useRef(autoRotate); rot.current = autoRotate;

  useEffect(() => {
    const host = el.current; if (!host) return;
    let inst: FgInst | null = null; let ro: ResizeObserver | null = null; let cancelled = false;
    void Promise.all([loadRenderer(), loadThree()]).then(([Ctor, THREE]) => {
      if (cancelled || !host.isConnected) return;
      const c = palette();
      const work = mode === "work";
      inst = new Ctor(host)
        .width(host.clientWidth).height(host.clientHeight)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        .nodeThreeObject((n: FgNode) => makeNode(THREE, n, c, work))
        .nodeThreeObjectExtend(false)
        .nodeLabel((n: FgNode) => {
          const x = n;
          return `<div style="font:12px Geist,system-ui;background:${c.bg};color:${c.fg};padding:7px 10px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.4);max-width:280px;border-left:3px solid ${c[x.kind] ?? c.keyword}">${esc(x.name)}${x.sub ? `<br><span style="opacity:.7">${esc(x.sub)}</span>` : ""}<br><span style="opacity:.55;font-family:Geist Mono,monospace;font-size:10px;letter-spacing:.08em">${x.kind.toUpperCase()}${x.live ? " · LIVE" : ""}</span></div>`;
        })
        .linkColor((l: FgLink) => (l.live ? c.live : (work ? c.wlink : c.link)))
        .linkWidth((l: FgLink) => (l.live ? 1.8 : work ? 1.05 : 0.8))
        .linkOpacity(0.95)
        .linkDirectionalArrowLength(work ? 3.5 : 0).linkDirectionalArrowRelPos(1).linkDirectionalArrowColor(() => c.live)
        .linkDirectionalParticles((l: FgLink) => (work ? (l.live ? 5 : 2) : 0))
        .linkDirectionalParticleWidth(work ? 1.8 : 0).linkDirectionalParticleColor(() => c.live)
        .linkDirectionalParticleSpeed((l: FgLink) => (l.live ? 0.014 : 0.005))
        .dagMode(work ? "td" : (null as unknown as "td")).dagLevelDistance(work ? 48 : 0)
        .warmupTicks(work ? 48 : 80)
        .cooldownTicks(work ? 160 : 220)
        .cooldownTime(9000)
        .onNodeClick((n) => {
          const x = n as FgNode & { x: number; y: number; z: number };
          const now = Date.now();
          if (now - last.current.at < 350 && last.current.id === x.id) { cbs.current.onNodeDoubleClick?.(x); return; }
          last.current = { id: x.id, at: now };
          cbs.current.onNodeClick?.(x);
          const d = 70; const r = 1 + d / Math.max(1, Math.hypot(x.x, x.y, x.z));
          inst?.cameraPosition({ x: x.x * r, y: x.y * r, z: x.z * r }, x, 900);
        });
      const live = inst as FgInst;
      live.d3Force("charge")?.strength(work ? -72 : -88);
      live.cameraPosition({ x: 0, y: work ? 40 : 20, z: work ? 280 : 330 });
      lightScene(THREE, live, work, c);
      const ctrl = live.controls();
      const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      ctrl.autoRotate = rot.current && !reduce;
      ctrl.autoRotateSpeed = reduce ? 0 : (work ? 0.18 : 0.42);
      ctrl.enableDamping = true;
      if (work) live.onEngineStop(() => live.zoomToFit(700, 140));
      g.current = live;
      live.graphData({ nodes: data.current.nodes.map((n) => ({ ...n })), links: data.current.links.map((l) => ({ ...l })) });
      ro = new ResizeObserver(() => { if (host.isConnected) live.width(host.clientWidth).height(host.clientHeight); });
      ro.observe(host);
    });
    return () => { cancelled = true; ro?.disconnect(); inst?._destructor(); g.current = null; };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const inst = g.current; if (!inst) return;
    const cur = inst.graphData();
    const keep = new Map(cur.nodes.map((n: FgNode) => [n.id, n]));
    const merged = nodes.map((n) => Object.assign(keep.get(n.id) ?? {}, n));
    inst.graphData({ nodes: merged as FgNode[], links: links.map((l) => ({ ...l })) });
    inst.d3ReheatSimulation();
  }, [nodes, links]);

  useEffect(() => {
    const ctrl = g.current?.controls() as { autoRotate: boolean } | undefined;
    if (ctrl) ctrl.autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => { if (fitSignal > 0) g.current?.zoomToFit(700, 120); }, [fitSignal]);

  useEffect(() => {
    const obs = new MutationObserver(() => {
      const inst = g.current; if (!inst) return;
      const c = palette(); const work = mode === "work";
      inst.linkColor((l) => (l.live ? c.live : (work ? c.wlink : c.link)));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [mode]);

  return <div ref={el} className={`g3 ${className ?? ""}`} data-graph={mode} />;
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

function makeNode(THREE: ThreeLib, n: FgNode, c: Record<string, string>, work: boolean) {
  const color = hexToInt(c[n.kind] ?? c.keyword);
  const r = Math.max(2.2, (n.val ?? 3) * (work ? 1.15 : 1.0));
  const geom = work
    ? (n.kind === "you" || n.kind === "captain" || n.kind === "consul"
      ? new THREE.OctahedronGeometry(r * 1.15, 0)
      : n.kind === "gate"
        ? new THREE.TetrahedronGeometry(r * 1.1, 0)
        : n.kind === "tool" || n.kind === "wreceipt" || n.kind === "refused"
          ? new THREE.BoxGeometry(r * 1.4, r * 1.4, r * 1.4)
          : new THREE.OctahedronGeometry(r, 0))
    : new THREE.SphereGeometry(r, 28, 20);
  const mat = work
    ? new THREE.MeshStandardMaterial({
      color,
      metalness: 0.22,
      roughness: 0.42,
      emissive: color,
      emissiveIntensity: n.live ? 0.5 : 0.05,
    })
    : new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.04,
      roughness: 0.32,
      transmission: 0.12,
      thickness: 0.6,
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
      emissive: color,
      emissiveIntensity: n.kind === "session" ? 0.42 : 0.16,
    });
  const mesh = new THREE.Mesh(geom, mat);
  if (!work && n.kind === "session") {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.7, 16, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    mesh.add(glow);
  }
  return mesh;
}

function lightScene(THREE: ThreeLib, live: FgInst, work: boolean, c: Record<string, string>): void {
  const scene = live.scene();
  const ambient = new THREE.AmbientLight(0xffffff, work ? 0.62 : 0.82);
  const key = new THREE.DirectionalLight(0xffffff, work ? 1.05 : 1.0);
  key.position.set(work ? 40 : -30, work ? 120 : 40, 80);
  const fill = new THREE.DirectionalLight(0xdfe3e8, 0.4);
  fill.position.set(-80, 20, -40);
  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(30, -60, -90);
  scene.add(ambient, key, fill, rim);
  if (!work) {
    /* Fog sells depth without drowning the cluster: at the default camera
       (z≈330) density 0.0045 fogged the scene ~93% toward black — the graph
       rendered correctly but read as faint dust. 0.0015 keeps a real aerial
       falloff (~25% at focus, ~55% at the far edge) so frosted spheres keep
       their surface shading where the user is actually looking. */
    scene.fog = new THREE.FogExp2(hexToInt(c.bg.replace("#", "") ? c.bg : "#0D1010"), 0.0015);
  }
}

function esc(s: string): string { return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string)); }
