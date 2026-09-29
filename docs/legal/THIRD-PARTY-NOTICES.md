# Third-Party Notices

## Document readers adopted for the Docs door (§13)

Three published packages do the format-reading behind `src/mission/`. Each was
license-checked against the artifact's own license text rather than against its
registry label — which mattered once, and `docs/oss/PARSER-PROVENANCE.md` records
how. That page carries the exact versions, artifact hashes and the transitive
license review; the full field-by-field adoption record lives in the register of
record, outside the distributed tree.

### pdfjs-dist — PDF text and outline

- Project: https://github.com/mozilla/pdf.js
- Used: its `legacy/build/pdf.mjs` parser, plus that build's PDF worker vendored
  byte-for-byte at `vendor/pdfjs/pdf.worker.min.mjs` so both the offline
  verification pack and the browser build have a worker to start.
- License: Apache License, Version 2.0. Full text:
  `LICENSES/pdfjs-dist-APACHE-2.0.txt`.
- Our code calls it; no line of it was modified.

### mammoth — DOCX structure

- Project: https://github.com/mwilliamson/mammoth.js
- Used: `convertToHtml`, to carry Word heading levels and list structure into the
  knowledge proposal.
- License: BSD 2-Clause. Copyright (c) 2013, Michael Williamson. Full text:
  `LICENSES/mammoth-BSD-2-CLAUSE.txt`.
- Its dependencies are all permissive (MIT / BSD); none is copyleft.

### jszip — ZIP container and PPTX parts

- Project: https://github.com/Stuk/jszip
- Used: to inflate archive members that SelfImpulse's own central-directory scan has
  already approved by name and by size. jszip is not the security gate;
  `src/mission/archiveScan.ts` is.
- License: **dual MIT or GPL-3.0-or-later, at the licensee's choice. SelfImpulse
  uses it under the MIT license.** Copyright (c) 2009 Stuart Knightley, David
  Duponchel, Franz Buchinger, António Afonso. Both license texts are reproduced
  verbatim in `LICENSES/jszip-MIT-OR-GPL-3.txt`.

## Agent-User Interaction Protocol (AG-UI)

- Project: https://github.com/ag-ui-protocol/ag-ui
- Adopted: the AG-UI event vocabulary and base event contract, read from the
  upstream versioned `spec/` schema directory and re-expressed as first-party
  TypeScript in `src/engine/aguiProtocol.ts`. No runtime dependency was added;
  the module is SelfImpulse's own code implementing an adopted specification.
- Commit adopted: `b8ebd02c84a3` (31 event types; upstream protocol revision
  one point oh — this is the AG-UI protocol's own revision, not a SelfImpulse
  release number).
- License: MIT License. Copyright (c) 2025 AG-UI contributors.
- MIT license text: https://github.com/ag-ui-protocol/ag-ui/blob/main/LICENSE
- Integrity: `probe/aguiBoundary.test.ts` pins the adopted vocabulary and every
  rule the boundary must keep.

---

SelfImpulse (built on the MJ engine) includes clean-room TypeScript implementations of token-
compression techniques proven in the open-source community. The following
projects informed the design of LOTUS (Lean Optimal Token Utilisation System,
`src/engine/lotus.ts`); no source code from either project is included — the
implementations in this repository were written for VH's audited pipeline —
but their MIT licenses require this notice, and their authors have our thanks.

## context-compress (Open330)

- Project: https://github.com/Open330/context-compress
- Techniques informed: the compression mode ladder (conservative / balanced /
  aggressive / auto), dedup references for repeated tool output, and the
  net-win gate (skip any pass that would not pay for its own markers).
- License: MIT License. Copyright (c) 2026 Open330 and contributors.
- MIT license text: https://github.com/Open330/context-compress/blob/main/LICENSE

## LLMLingua (Microsoft Research)

- Project: https://github.com/microsoft/LLMLingua
- Techniques informed: the principle that a small, deterministic scorer can
  identify low-value tokens before inference — the research baseline for
  prompt compression (up to 20× with minimal performance loss). VH's LOTUS
  uses deterministic, model-free passes today; the LLMLingua line marks the
  path for model-scored compression later.
- License: MIT License. Copyright (c) Microsoft Corporation.
- MIT license text: https://github.com/microsoft/LLMLingua/blob/main/LICENSE

Permission is hereby granted, free of charge, to any person obtaining a copy
of the above-referenced software, to deal in the software without restriction,
including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the software, subject to the
following conditions: the above copyright notice and this permission notice
shall be included in all copies or substantial portions of the software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
