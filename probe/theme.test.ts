/**
 * v0.0.3 (UI refresh) — design-system probe.
 *
 * One stylesheet, src/ui/vh.css. Pins the approved identity: deep ink dark
 * ground (not flat black), paper-cream light theme, one desaturated teal
 * accent, NO Apple-blue / competitor purple / electric cyan, Instrument Serif
 * display + Geist body/mono, and no legacy animation gimmicks.
 *
 * Weight policy: body stays light (400); headings and interactive controls
 * may step up to 500 (medium) — that is the deliberate weight for editorial
 * hierarchy. Nothing is bold/600+, which is what this probe guards against.
 */
import * as fs from "node:fs";
import * as path from "node:path";

let passed = 0; let failed = 0; const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

declare const IMPULSE_ROOT: string | undefined;
const ROOT = typeof IMPULSE_ROOT === "string" && IMPULSE_ROOT.length > 0 ? IMPULSE_ROOT : process.cwd();
const css = fs.readFileSync(path.join(ROOT, "src", "ui", "vh.css"), "utf8");
const main = fs.readFileSync(path.join(ROOT, "src", "main.tsx"), "utf8");

ok("one stylesheet — main.tsx imports vh.css and nothing else", /import '\.\/ui\/vh\.css'/.test(main) && (main.match(/\.css['"]/g) ?? []).length === 1);
ok("the retired sheets are gone", !fs.existsSync(path.join(ROOT, "src", "styles")));
/* Palette pins — re-anchored for the v0.0.3 editorial refresh. What protects:
   dark ground ≠ pure black; light ground is a warm cream; accent is ONE
   desaturated teal defined in both themes; competitor brand colours are still
   forbidden; weights top out at 500 (medium) for hierarchy, never semibold/bold. */
ok("dark ground is deep ink with a raised surface (not flat black)", /--bg:\s*#0B0C0E/i.test(css) && /--s2:\s*#15181C/i.test(css) && !/--bg:\s*#000\b/.test(css));
ok("the rail sits on base (transparent over background, hairline separator)", /border-right:1px solid var\(--line\)/.test(css) && !/\.side\{background:var\(--bg-deep\)/.test(css.replace(/background:transparent/, "")));
ok("light ground is warm paper-cream with ink", /--bg:\s*#FAF7F1/i.test(css) && /#1A1D21/i.test(css));
ok("the light theme carries its own surface step", /--s3:\s*#ECE6DA/i.test(css));
ok("one desaturated teal accent — dark pulls brighter, light holds deeper", /--accent:\s*#006E6C/i.test(css) && /--accent:\s*#4FB3AF/i.test(css));
ok("no Apple-blue / competitor purple / electric cyan anywhere", !/#007AFF|#3B82F6|#2563EB|#7C3AED|#06B6D4|#007AFF/i.test(css));
ok("Instrument Serif for display, Geist for body and mono", /Instrument Serif/.test(css) && /Geist/.test(css) && /Geist Mono/.test(css));
ok("not Inter / JetBrains", !/font-family[^;}]*Inter\b/.test(css) && !/JetBrains/.test(css));
ok("weights top out at medium (500) — nothing semibold/bold/600+", !/font-weight:\s*(6|7|8|9)00/.test(css) && !/font-weight:\s*bold(?!.*oblique)/.test(css.replace(/font-weight:\(.*?\)/g, "")));
ok("no legacy animation gimmicks (splash, shimmer, glow keyframes)", !/@keyframes\s+(splash|shimmer|glow|pulseGlow|float)/.test(css));
ok("themes are attribute-scoped so both ship in one sheet", /\[data-theme=dark\]|\[data-theme="dark"\]/.test(css) && /\[data-theme=light\]|\[data-theme="light"\]/.test(css));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);
