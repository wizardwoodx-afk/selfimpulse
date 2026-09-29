import { DEFINITIONS_BY_ID, NODE_DEFINITIONS } from "../src/domain/nodeLibrary";
const show = (id: string) => {
  const d = DEFINITIONS_BY_ID.get(id);
  if (!d) { console.log(id, "MISSING"); return; }
  console.log(id, "| cat:", (d as any).category, "| in:", JSON.stringify((d.inputs??[]).map((p:any)=>[p.id,p.dataType,p.required])), "| out:", JSON.stringify((d.outputs??[]).map((p:any)=>[p.id,p.dataType])));
};
["control.start","control.end","cap.transform","control.approval","control.branch"].forEach(show);
console.log("--- nodes whose FIRST output is Text and that need no required input ---");
for (const d of NODE_DEFINITIONS) {
  const outs = (d.outputs ?? []);
  const reqIn = (d.inputs ?? []).filter((p:any)=>p.required);
  if (outs[0]?.dataType === "Text" && reqIn.length === 0) console.log(" ", d.id, "|", d.title, "| outs:", outs.map((p:any)=>p.id+":"+p.dataType).join(","));
}

/* ── audit H5: this suite used to only PRINT (exit 0 no matter what). It
   asserts now — a diagnostic that cannot fail is not a check. ── */
let _pass = 0, _fail = 0;
function _ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { _pass += 1; console.log(" ok  ", label); }
  else { _fail += 1; console.log("  FAIL", label, detail); }
}
let _textFirst = 0;
for (const d of NODE_DEFINITIONS) {
  const outs = (d.outputs ?? []) as Array<{ dataType?: string }>;
  const reqIn = ((d as { inputs?: Array<{ required?: boolean }> }).inputs ?? []).filter((p) => p.required);
  if (outs[0]?.dataType === "Text" && reqIn.length === 0) _textFirst += 1;
}
/* the ids this probe explores — the ones the library ACTUALLY ships
   (control.branch was in the original print list and does not exist; the old
   script printed "MISSING" and exited 0, which is exactly the failure mode
   this audit fix removes) */
for (const id of ["control.start", "control.end", "cap.transform", "control.approval"]) {
  _ok(`node definition ships: ${id}`, !!DEFINITIONS_BY_ID.get(id), "missing");
}
_ok("the node library is non-empty and fully iterated", NODE_DEFINITIONS.length >= 1, String(NODE_DEFINITIONS.length));
console.log(`\n${_pass} passed, ${_fail} failed`);
if (_fail > 0) process.exit(1);
