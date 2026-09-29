/**
 * probe/workspace.test.ts — 11WORKSPACE and the three-tier org.
 *
 * Pins: 30 desks × Lead+HR = 60 domain specialists; every established
 * worker maps to a desk; leads are NOT in the routed catalog; Captain
 * musters the office from the request alone (no picker); a compound
 * app+docs+mail ask opens ≥3 desks; the floor is workers only, ≤25,
 * and every floor id exists in the registry.
 */
import assert from "node:assert/strict";

let passed = 0; let failed = 0; const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

class MemStore implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; } clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  removeItem(k: string) { this.m.delete(k); } setItem(k: string, v: string) { this.m.set(k, v); }
}
(globalThis as { localStorage?: Storage }).localStorage = new MemStore();

import { getSpecialist, listSpecialists } from "../src/vh19/registry";
import { ESTABLISHED_SPECIALISTS } from "../src/vh19/federation/fleet";
import { CREW_MAX } from "../src/vh19/moeV2";
import {
  DESKS, DOMAIN_SPECIALISTS, ORG_DESK_COUNT, ORG_SPECIALIST_COUNT,
  desksForWorker, homeDesk, orgStats, leadFor, hrFor,
} from "../src/vh19/org";
import {
  musterWorkspace, floorAsCrew, officeSnapshot, officeViewFromMuster,
  isElevenWorkspace, WORKSPACE_NAME, FLOOR_CAP,
} from "../src/vh19/workspace";
import { askVH19, responseCanonical } from "../src/vh19/generalist";

async function main(): Promise<void> {
  console.log("workspace — 11WORKSPACE and the three-tier org");

  ok("thirty desks", DESKS.length === 30 && ORG_DESK_COUNT === 30);
  ok("sixty domain specialists (Lead+HR)", DOMAIN_SPECIALISTS.length === 60 && ORG_SPECIALIST_COUNT === 60);
  ok("every desk has a unique id", new Set(DESKS.map((d) => d.id)).size === DESKS.length);
  ok("every Lead+HR id is unique", new Set(DOMAIN_SPECIALISTS.map((s) => s.id)).size === DOMAIN_SPECIALISTS.length);
  ok("every desk has both a Lead and an HR",
    DESKS.every((d) => leadFor(d.id)?.role === "lead" && hrFor(d.id)?.role === "hr"));
  ok("Lead/HR ids never collide with the routed catalog",
    DOMAIN_SPECIALISTS.every((s) => getSpecialist(s.id) === null));
  ok("the routed catalog is still the established 1,850",
    ESTABLISHED_SPECIALISTS.length === 1850 && listSpecialists().length === 1850);

  const stats = orgStats();
  ok("every established worker maps to at least one desk", stats.unassigned === 0, `unassigned=${stats.unassigned}`);
  ok("the org accounts for every worker at least once",
    Object.values(stats.byDesk).reduce((n, c) => n + c, 0) >= ESTABLISHED_SPECIALISTS.length);
  ok("home desk is always a real desk",
    ESTABLISHED_SPECIALISTS.every((s) => DESKS.some((d) => d.id === homeDesk(s))));
  ok("desksForWorker never returns empty",
    ESTABLISHED_SPECIALISTS.every((s) => desksForWorker(s).length >= 1));

  const compound = "Make me a app and connect to my internal XYZ Docs with that and send me mail";
  const office = musterWorkspace(compound);
  ok("muster names 11WORKSPACE", office.name === WORKSPACE_NAME && isElevenWorkspace(office));
  ok("Captain is the only human-facing agent", office.captain === "Captain");
  ok("a compound app+docs+mail ask opens at least three desks",
    office.desks.length >= 3, `desks=${office.desks.map((d) => d.id).join(",")}`);
  const deskIds = new Set(office.desks.map((d) => d.id));
  ok("the compound ask involves product desks (frontend or backend, docs, comms)",
    (deskIds.has("frontend") || deskIds.has("backend") || deskIds.has("mobile") || deskIds.has("api"))
    && (deskIds.has("docs") || deskIds.has("writing"))
    && deskIds.has("comms"),
    `desks=${[...deskIds].join(",")}`);
  ok(`the floor never exceeds CREW_MAX (${CREW_MAX})`,
    office.floor.length <= FLOOR_CAP && FLOOR_CAP === CREW_MAX && CREW_MAX === 25,
    `floor=${office.floor.length}`);
  ok("the floor is non-empty for a compound build", office.floor.length >= 1, `floor=${office.floor.length}`);
  ok("every floor seat is a routed worker, never a Lead or HR",
    office.floor.every((s) => getSpecialist(s.id) !== null && !s.id.startsWith("lead.") && !s.id.startsWith("hr.")));
  ok("every floor seat sits at a named desk",
    office.floor.every((s) => deskIds.has(s.desk) || DESKS.some((d) => d.id === s.desk)));
  ok("floorAsCrew ids match the floor and stay inside the registry",
    floorAsCrew(office).every((c) => getSpecialist(c.id) !== null)
    && floorAsCrew(office).length === office.floor.length);
  ok("the accounting line names the office, the cap, and autonomy",
    office.line.includes("11WORKSPACE") && office.line.includes("Autonomous") && office.line.includes(`${FLOOR_CAP}`));

  const view = officeViewFromMuster(office);
  ok("the office view reports occupancy against the cap",
    view.occupancy === office.floor.length && view.cap === 25 && view.rooms === office.desks.length);

  const snap = officeSnapshot(office);
  ok("the snapshot is JSON-safe (no Maps) and named 11WORKSPACE",
    snap.name === "11WORKSPACE" && JSON.parse(JSON.stringify(snap)).floor.length === office.floor.length);

  const single = musterWorkspace("what is a merkle tree?");
  ok("a single-fact ask still musters without a picker",
    single.name === WORKSPACE_NAME && single.floor.length <= 1);

  void (async () => {
    const planned = await askVH19({ text: compound, userId: "workspace-probe" });
    ok("askVH19 carries the office on the live path",
      planned.office?.name === "11WORKSPACE", `office=${planned.office?.name ?? "absent"}`);
    ok("the live floor is the routed specialistIds (workers, not leads)",
      !!planned.office && planned.specialistIds.length === planned.office.floor.length
      && planned.specialistIds.every((id) => planned.office!.floor.some((s) => s.id === id))
      && planned.specialistIds.every((id) => getSpecialist(id) !== null));
    ok("the plan names 11WORKSPACE in words",
      planned.reply.includes("11WORKSPACE") && planned.reply.includes("Autonomous"));
    ok("the office rides inside the provenance digest",
      JSON.parse(responseCanonical({ ...planned, provenanceDigest: "" })).office?.name === "11WORKSPACE");
    ok("the filesystem workspace seam is a different field",
      planned.workspace == null || planned.workspace.kind !== "11WORKSPACE");

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
void assert;
main();
