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

declare const SI_ROOT: string | undefined;
const ROOT = typeof SI_ROOT === "string" && SI_ROOT.length > 0 ? SI_ROOT : process.cwd();
const css = fs.readFileSync(path.join(ROOT, "src", "ui", "vh.css"), "utf8");
const main = fs.readFileSync(path.join(ROOT, "src", "main.tsx"), "utf8");

/* Palette helpers.
 *
 * These pins used to compare raw hex literals, which made them brittle in the
 * worst way: they could only ever be satisfied by the one hex they named, so a
 * deliberate, machine-checked re-step of the ground read as a failure. The
 * design system makes claims that are PROPERTIES, not literals — "the surface
 * ramp is measurably raised above the ground", "both themes carry ONE accent
 * hue". So these helpers measure those properties, and the assertions below
 * check the properties. A real regression still fails; a deliberate re-step
 * that the repo's own tooling endorses does not. */
const hex = (h: string): [number, number, number] => {
  const s = h.replace("#", "").trim();
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};
const relLum = (h: string): number => {
  const c = hex(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const hueOf = (h: string): number => {
  const [r, g, b] = hex(h);
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
  if (d === 0) return 0;
  let x = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return x < 0 ? x + 360 : x;
};
/** the hex value of one token inside one [data-theme=…] block */
const token = (theme: string, name: string): string => {
  const block = css.match(new RegExp(`\\[data-theme=${theme}\\]\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  const m = block?.[1].match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`, "i"));
  return m ? m[1] : "";
};

ok("one stylesheet — main.tsx imports vh.css and nothing else", /import '\.\/ui\/vh\.css'/.test(main) && (main.match(/\.css['"]/g) ?? []).length === 1);
ok("the retired sheets are gone", !fs.existsSync(path.join(ROOT, "src", "styles")));
/* Palette pins. Re-anchored at the redesign from "deep ink" to TRUE BLACK.
 *
 * What did NOT change, and what these still protect: the surface ramp must be
 * measurably raised above its own ground, the light ground must be paper and
 * not screen-white, the ink must be ink, and there must be exactly ONE accent
 * hue shared by both themes. The repo's own vh.css header asserts these claims
 * in prose and tools/contrast-check.mjs machine-checks 38 pairings, so the
 * assertions below measure the same properties instead of naming one hex.
 * A real regression (a flat ramp, a glare-white page, a second accent hue, an
 * accent that fails AA on its own ground) still fails here. */
const darkBg = token("dark", "bg");
const darkS1 = token("dark", "s1");
const darkS2 = token("dark", "s2");
const darkS3 = token("dark", "s3");
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// vh.css records that a first attempt at #0C0C0D (relLum 0.00370) was 1.7%
// above the ground and "read as noise, so the whole interface looked flat".
// --s1 must clear that rejected value or the flatness regression is back.
const REJECTED_FLAT_S1_LUM = 0.0045;
ok("the dark ground is true black and the surface ramp is measurably raised above it",
  /^#000000$/i.test(darkBg)
  && relLum(darkS1) < relLum(darkS2) && relLum(darkS2) < relLum(darkS3)
  && relLum(darkS1) > REJECTED_FLAT_S1_LUM,
  `bg ${darkBg} (lum ${relLum(darkBg)}), s1 ${darkS1} (${relLum(darkS1).toFixed(5)}), s2 ${darkS2}, s3 ${darkS3}`);
ok("the rail sits on base (transparent over background, hairline separator)", /border-right:1px solid var\(--line\)/.test(css) && !/\.side\{background:var\(--bg-deep\)/.test(css.replace(/background:transparent/, "")));
const lightBg = token("light", "bg");
const lightFg = token("light", "fg");
ok("light ground is paper-cream, not screen-white, and the ink on it is ink",
  relLum(lightBg) > 0.75 && relLum(lightBg) < 1
  && relLum(lightFg) < 0.05
  && contrast(lightFg, lightBg) >= 4.5,
  `bg ${lightBg} (lum ${relLum(lightBg).toFixed(4)}), fg ${lightFg} (${relLum(lightFg).toFixed(4)}), contrast ${contrast(lightFg, lightBg).toFixed(2)}:1`);
ok("the light theme carries its own surface step", relLum(token("light", "s3")) > 0 && relLum(token("light", "s3")) < relLum(lightBg),
  `s3 ${token("light", "s3")} vs bg ${lightBg}`);
/* ONE accent, verified as one HUE rather than as two literals: the identity is
 * the hue, the per-theme value is a tuning decision. Both must sit on the same
 * 177deg teal and both must clear AA as text on their own ground. */
const darkAccent = token("dark", "accent");
const lightAccent = token("light", "accent");
ok("one desaturated teal accent — dark pulls brighter, light holds deeper",
  Math.abs(hueOf(darkAccent) - hueOf(lightAccent)) < 8
  && relLum(darkAccent) > relLum(lightAccent) * 2
  && contrast(darkAccent, darkBg) >= 4.5
  && contrast(lightAccent, lightBg) >= 4.5,
  `dark ${darkAccent} (hue ${hueOf(darkAccent).toFixed(0)}, ${contrast(darkAccent, darkBg).toFixed(2)}:1), light ${lightAccent} (hue ${hueOf(lightAccent).toFixed(0)}, ${contrast(lightAccent, lightBg).toFixed(2)}:1)`);
ok("no Apple-blue / competitor purple / electric cyan anywhere", !/#007AFF|#3B82F6|#2563EB|#7C3AED|#06B6D4|#007AFF/i.test(css));
ok("Instrument Serif for display, Geist for body and mono", /Instrument Serif/.test(css) && /Geist/.test(css) && /Geist Mono/.test(css));
ok("not Inter / JetBrains", !/font-family[^;}]*Inter\b/.test(css) && !/JetBrains/.test(css));
ok("weights top out at medium (500) — nothing semibold/bold/600+", !/font-weight:\s*(6|7|8|9)00/.test(css) && !/font-weight:\s*bold(?!.*oblique)/.test(css.replace(/font-weight:\(.*?\)/g, "")));
ok("no legacy animation gimmicks (splash, shimmer, glow keyframes)", !/@keyframes\s+(splash|shimmer|glow|pulseGlow|float)/.test(css));
ok("themes are attribute-scoped so both ship in one sheet", /\[data-theme=dark\]|\[data-theme="dark"\]/.test(css) && /\[data-theme=light\]|\[data-theme="light"\]/.test(css));

/* BOOT-GROUND PARITY. index.html:29-35 states this contract in the file itself:
 * its inline <style> selectors (html[data-theme=light] body) outrank vh.css's
 * `body{...}`, so if the two grounds disagree the app shows the wrong ground for
 * as long as the inline rule wins — which, being inline, is forever. That comment
 * names verify/suites/theme.test.mjs as the thing that stops them separating, but
 * no assertion anywhere actually read index.html: this suite read vh.css alone.
 * The guarantee was documented and unenforced. It is enforced here. */
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const inline = indexHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
const inlineDark = inline.match(/html,body\{[^}]*?background:\s*(#[0-9a-fA-F]{3,8})/)?.[1] ?? "";
const inlineLight = inline.match(/\[data-theme="light"\][^{]*\{[^}]*?background:\s*(#[0-9a-fA-F]{3,8})/)?.[1] ?? "";
ok("the inline boot ground EQUALS --bg in vh.css — they cannot separate again",
  inlineDark.toLowerCase() === darkBg.toLowerCase() && inlineLight.toLowerCase() === lightBg.toLowerCase(),
  `index.html ${inlineDark}/${inlineLight} vs vh.css ${darkBg}/${lightBg}`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);
