# Field Guide Debugging Guide (Vivliostyle)

This folder contains a step-by-step, reproducible record of how we tested, debugged, and adjusted the Field Guide sources and build process to get output close to `example-field-guide.pdf`.

## Index

- `docs/debugging/01-repro-and-baseline.md`
  - Establish a baseline build
  - Capture evidence (page size, fonts, sample pages)

- `docs/debugging/02-chrome-devtools-workflow.md`
  - Chrome DevTools MCP workflow
  - Viewer vs rendered document (critical)
  - Checking computed CSS variables and confirming theme application

- `docs/debugging/03-manifest-and-style-cascade.md`
  - How manifest `styles:` resolves
  - Confirming theme CSS is actually inlined
  - Common failure modes (stale output, wrong file being previewed)

- `docs/debugging/04-page-size-and-named-pages.md`
  - Forcing Letter via `@page { size: letter; }`
  - Adding named page templates (`full`, `clean`, `blood-border`)

- `docs/debugging/05-assets-and-case-sensitivity.md`
  - Diagnosing broken images
  - Fixing case mismatches on Linux

- `docs/debugging/06-pdf-verification-checklist.md`
  - `pdfinfo`, `pdffonts`, `pdftoppm`
  - Quick visual diffs vs example

- `docs/debugging/07-print-preflight-and-why-it-fails.md`
  - Running `preflight-print`
  - TAC/ink coverage realities for dark + neon designs

- `docs/debugging/08-runbook-field-guide.md`
  - One-page operational runbook
  - Exact build → verify → preflight loop

- `docs/debugging/09-changes-we-made.md`
  - Exact file diffs to reproduce the improvements

- `docs/debugging/10-tools-reference.md`
  - Commands reference / quick copy-paste section
