# Parser provenance — what the Docs door reads, and from where

Companion to `THIRD-PARTY-NOTICES.md`. The root notice carries the legally
required attribution text; this page carries the **pins** — exact artifacts,
hashes and license findings — so a reviewer can confirm what shipped without
diffing a lockfile by hand. The full twelve-field adoption record for each block
lives in the adoption register of record, outside the distributed tree.

## Adopted artifacts

| Package | Artifact | Purpose | License, as verified |
|---|---|---|---|
| `pdfjs-dist` | `6.3.289` · `sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==` | PDF text and outline | Apache-2.0, checked against the package's `LICENSE` |
| `mammoth` | `1.12.3` · `sha512-kkv2MrSFk3f/w3uLsz4FG/91LdWp2j+qmp7AjG2v7w2xgX5YDxiaFlaWourXrXtyUR6335+9guyIlPBnhHLvKw==` | DOCX heading and list structure | BSD-2-Clause, (c) 2013 Michael Williamson |
| `jszip` | `3.10.2` · `sha512-3l+rb15IOWtUhU0H5MFqES/T6Kh7abYwjosBey/vD6hDt8zoEffkSC5Ws5SGtgVw3gBx2NEbhTeSW1+kWkpyTQ==` | inflating vetted archive members | **dual `(MIT OR GPL-3.0-or-later)` — used under MIT** |

The `jszip` row is the reason this page exists. Its registry label is not a
single license, and the build-pack table called it plainly MIT. Choosing the MIT
option of a dual license is entirely lawful; assuming the label without opening
the license file is not a review. So the choice is recorded here, in writing, and
both license texts are shipped verbatim in `LICENSES/jszip-MIT-OR-GPL-3.txt`.

## Vendored file

| Path | Size | sha256 |
|---|---|---|
| `vendor/pdfjs/pdf.worker.min.mjs` | 1,317,034 bytes | `a33cfe728c584fdba4fcc1fd54bcdc2f9f2f13889ddbb5b2bd1d0f8cbe49b84e` |

An unmodified byte-for-byte copy of `legacy/build/pdf.worker.min.mjs` from the
installed artifact. It is vendored because pdf.js resolves its worker relative to
whatever bundle contains its parser: the offline verification pack inlines
packages, and a bundled run from outside the tree fails with
`Setting up fake worker failed` until the worker sits next to the tree it can
find. `probe/fileIngest.test.ts` compares this file byte-for-byte against the
installed artifact, so bumping `pdfjs-dist` without re-copying the worker fails
the gate rather than shipping a parser and a worker that disagree.

## Transitive dependencies, by license

Nothing copyleft entered the tree through these three packages.

- **from `jszip`** — `lie@3.3.0` MIT · `pako@1.0.11` MIT AND Zlib ·
  `setimmediate@1.0.5` MIT · `readable-stream@2.3.8` MIT (Node.js license text)
- **from `mammoth`** — `@xmldom/xmldom@0.8.15` MIT · `argparse@1.0.10` MIT ·
  `base64-js@1.5.1` MIT · `bluebird@3.4.7` MIT · `dingbat-to-unicode@1.0.2`
  BSD-2-Clause · `jszip@3.10.2` (MIT, as above) · `lop@0.4.2` BSD-2-Clause ·
  `path-is-absolute@1.0.1` MIT · `underscore@1.13.8` MIT · `xmlbuilder` MIT ·
  `duck@0.1.12` BSD · `option@0.2.4` BSD-2-Clause · `sprintf-js@1.0.3`
  BSD-3-Clause · `immediate@3.0.6` MIT
- **from `pdfjs-dist`** — none

Review note worth keeping: `bluebird` resolves to a 2016-era release because
mammoth pins it narrowly. It is MIT and sits on no path we call, but it is old,
and "old transitive dependency" is the kind of thing a security reviewer asks
about first.

## Prescribed and deliberately not adopted: `exceljs`

The build pack's format table prescribed `exceljs` for spreadsheets. It was
installed, confirmed working under both Node and browser bundling, and removed.
Three verified reasons:

1. `npm audit` reports a **moderate** vulnerability in it at the installed
   version, arriving through its transitive `uuid@8.3.2`.
2. It pulls in Node-process machinery — `archiver`, `unzipper`, `tmp`,
   filesystem-touching stream code — into a product whose surface is a browser
   webview and a Tauri shell.
3. The requirement, in the build pack's own words, is *"sheet names + header row
   as structure"*. `jszip` (already adopted here) plus an XML walk does exactly
   that, in scope, with **no new dependency**, under the same container gate the
   rest of the zip family already passes.

Spreadsheets are therefore parsed in `src/mission/documentParsers.ts` →
`parseXlsx()`: sheet names from `xl/workbook.xml` resolved through
`xl/_rels/workbook.xml.rels`, values from shared strings (rich-text runs joined)
and inline strings, each cell placed by its own reference so a sparse row still
lines up with its header.

**Consequent scope limit:** the pre-2007 binary Office formats (`.doc`, `.xls`,
`.ppt` — OLE compound documents) are refused in words, not converted. The door
says which formats it reads rather than returning an empty document and letting
the human find the gap later.
