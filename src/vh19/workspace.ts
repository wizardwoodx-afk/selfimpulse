/**
 * IMPULSE-WORKSPACE — the office floor.
 *
 * A multi-team ask ("build an app, connect my internal docs, mail me")
 * is not a chat with 1,500 people. Captain (regional manager) opens the
 * desks the request actually needs; each Team Lead staffs workers from
 * that desk; HR holds the bench. The workers who walk onto the floor
 * are capped at CREW_MAX (25) by Agentic MoE — that is 25MoE60:
 * 60 domain specialists (Lead+HR), 25 sub-agents active.
 *
 * Autonomous: the only input is the user's request. No picker. No
 * "which team?". Muster is a pure function of (request, org, fleet).
 */
import type { RouteCandidate } from "./types";
import { getSpecialist } from "./registry";
import { tokenize } from "./router";
import { scanDomains, selectCrewV2, CREW_MAX, type CrewSelection } from "./moeV2";
import {
  DESKS, leadFor, hrFor, homeDesk, workersOnDesk,
  ORG_DESK_COUNT, ORG_SPECIALIST_COUNT, type DeskId, type DeskDef,
} from "./org";
import { ESTABLISHED_SPECIALISTS } from "./federation/fleet";

export const WORKSPACE_NAME = "IMPULSE-WORKSPACE";
export const FLOOR_CAP = CREW_MAX;
export const DESK_SCORE_MIN = 3;

export interface OfficeDesk {
  id: DeskId;
  label: string;
  lead: { id: string; name: string };
  hr: { id: string; name: string };
  pooled: number;
  onFloor: number;
}

export interface FloorSeat {
  id: string;
  name: string;
  desk: DeskId;
  score: number;
  reasons: string[];
}

export interface ImpulseWorkspace {
  name: typeof WORKSPACE_NAME;
  /** Always the regional manager — the only agent the user talks to. */
  captain: "Captain";
  task: string;
  desks: OfficeDesk[];
  floor: FloorSeat[];
  /** MoE selection this floor was built from — probes pin the cap. */
  selection: CrewSelection;
  considered: number;
  line: string;
}

function scoreDesk(d: DeskDef, tokens: string[], lower: string): number {
  let n = 0;
  for (const kw of d.keywords) {
    if (tokens.includes(kw)) n += 4;
    else if (kw.length >= 4 && lower.includes(kw)) n += 2;
  }
  return n;
}

/**
 * Open the office for this request. Captain is not asked which desks.
 * Workers on the floor are the MoE crew, each seated at their home desk.
 */
export function musterWorkspace(request: string): ImpulseWorkspace {
  const tokens = tokenize(request);
  const lower = request.toLowerCase();
  const pool = scanDomains(request);
  const selection = selectCrewV2(request, pool);

  const deskScores = DESKS
    .map((d) => ({ d, score: scoreDesk(d, tokens, lower) }))
    .filter((x) => x.score >= DESK_SCORE_MIN)
    .sort((a, b) => b.score - a.score || a.d.id.localeCompare(b.d.id));

  const floor: FloorSeat[] = [];
  const onFloor = new Map<DeskId, number>();
  for (const c of selection.crew) {
    const s = getSpecialist(c.id);
    if (!s) continue;
    const desk = homeDesk(s);
    onFloor.set(desk, (onFloor.get(desk) ?? 0) + 1);
    floor.push({ id: s.id, name: s.name, desk, score: c.score, reasons: c.reasons });
  }

  /* Desks the MoE seated, plus desks the request named even if a worker
     home-desk didn't land there — still a team in the room, empty floor. */
  const seated = new Set<DeskId>(floor.map((f) => f.desk));
  const involved: DeskDef[] = [];
  const seen = new Set<DeskId>();
  for (const id of seated) {
    const d = DESKS.find((x) => x.id === id);
    if (d && !seen.has(d.id)) { involved.push(d); seen.add(d.id); }
  }
  for (const { d } of deskScores) {
    if (seen.has(d.id)) continue;
    involved.push(d);
    seen.add(d.id);
  }

  const desks: OfficeDesk[] = involved.map((d) => {
    const lead = leadFor(d.id)!;
    const hr = hrFor(d.id)!;
    return {
      id: d.id,
      label: d.label,
      lead: { id: lead.id, name: lead.name },
      hr: { id: hr.id, name: hr.name },
      pooled: workersOnDesk(d.id).length,
      onFloor: onFloor.get(d.id) ?? 0,
    };
  });

  const line =
    `${WORKSPACE_NAME}: Captain opened ${desks.length} desk(s) · ` +
    `floor ${floor.length}/${FLOOR_CAP} workers of ${ESTABLISHED_SPECIALISTS.length} · ` +
    `${ORG_SPECIALIST_COUNT} domain specialists (Lead+HR) across ${ORG_DESK_COUNT} desks · ` +
    `MoE tier=${selection.gate.tier}. Autonomous — no team was picked by the user.`;

  return {
    name: WORKSPACE_NAME,
    captain: "Captain",
    task: request,
    desks,
    floor,
    selection,
    considered: pool.considered,
    line,
  };
}

/** Route candidates the live Captain path fields — workers only, never Lead/HR ids. */
export function floorAsCrew(office: ImpulseWorkspace): RouteCandidate[] {
  return office.floor.map((s) => ({ id: s.id, score: s.score, reasons: s.reasons }));
}

export function officeViewFromMuster(office: ImpulseWorkspace): {
  rooms: number;
  occupancy: number;
  cap: number;
  headline: string;
  desks: OfficeDesk[];
} {
  return {
    rooms: office.desks.length,
    occupancy: office.floor.length,
    cap: FLOOR_CAP,
    headline: office.line,
    desks: office.desks,
  };
}

/** Cheap type-guard so UI/probes don't import a circular. */
export function isImpulseWorkspace(x: unknown): x is ImpulseWorkspace {
  return !!x && typeof x === "object" && (x as ImpulseWorkspace).name === WORKSPACE_NAME;
}

export { ORG_DESK_COUNT, ORG_SPECIALIST_COUNT };

/** JSON-safe snapshot that rides the Captain response (Maps cannot). */
export function officeSnapshot(office: ImpulseWorkspace): ImpulseOfficeSnapshot {
  return {
    name: WORKSPACE_NAME,
    desks: office.desks.map((d) => ({
      id: d.id, label: d.label, lead: d.lead.name, hr: d.hr.name,
      pooled: d.pooled, onFloor: d.onFloor,
    })),
    floor: office.floor.map((s) => ({ id: s.id, desk: s.desk, name: s.name })),
    cap: FLOOR_CAP,
    line: office.line,
  };
}

export interface ImpulseOfficeSnapshot {
  name: typeof WORKSPACE_NAME;
  desks: Array<{ id: string; label: string; lead: string; hr: string; pooled: number; onFloor: number }>;
  floor: Array<{ id: string; desk: string; name: string }>;
  cap: number;
  line: string;
}
