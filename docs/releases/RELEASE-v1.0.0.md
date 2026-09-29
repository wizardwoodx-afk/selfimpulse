# 11Handle 1.0.0 — release notes

## v0.0.3 (current milestone)

- **Editorial Minimal UI.** One stylesheet (`src/ui/vh.css`), retuned for an
  Apple-grade editorial feel: warm paper-cream light theme, deep-ink dark
  theme, one desaturated teal accent, Instrument Serif display face, Geist
  body/mono, hairline borders over shadows, 500-weight ceiling, single
  primary action (the composer send), more generous whitespace, calmer rail,
  stronger hero typography. No purple gradients, no blinking status dots,
  no Lucide icon stacks.
- **GitHub production hygiene.** `.github/workflows/gate.yml` runs tsc →
  `npm test` → `node verify/run.mjs` on ubuntu-latest/Node 22.14; SECURITY.md
  with disclosure policy and in-scope surfaces; CONTRIBUTING.md with the
  three-bar gate rule (don't hand-edit generated bundles); tightened
  `.gitignore`.
- **Repo cleaned.** One-off `.md` how-tos moved under `docs/setup/`, release
  notes under `docs/releases/`, legal notices under `docs/legal/`, the
  verify script under `scripts/verify.sh`. PowerShell one-offs
  (`build-app.ps1`, `cargo-dev.ps1`, `screenshot.ps1`) and stale benchmark
  JSON are gone. The probe/gate/build infra is intact.
- **Specialist routing documented.** `docs/design/specialist-routing.md`
  spells out the two numbers reviewers kept asking about: Top-K=3 candidate
  selection into the plan, CREW_MAX=25 live-agent ceiling on the floor.
- **pdf.js 6.3.** Updated off the vulnerable build the gate flagged; CVE
  addressed in the bundle.

Gates at tag: tsc 0 errors, `npm test` 171/0, `node verify/run.mjs` 170/0.

## v0.0.2

- pdf.js CVE remediation, receipt chain hardening, first zip release.

## v0.0.1

- initial archive.
