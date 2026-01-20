# 01 - Repro and Baseline

## Goal

Get a known baseline so changes are measurable.

## Inputs

- Source project: `tests/field-guide-input/`
- Reference PDF: `example-field-guide.pdf`

## Baseline: Build a PDF from current sources

From repo root:

```bash
bun src/cli.ts build tests/field-guide-input --format pdf --output /tmp/fg-baseline.pdf
```

## Capture baseline metrics

### Page size + page count

```bash
pdfinfo /tmp/fg-baseline.pdf | egrep 'Pages|Page size'
```

### Embedded fonts

```bash
pdffonts /tmp/fg-baseline.pdf | head -40
```

### Visual spot-check (extract a few pages)

Pick a page range that exists in both the baseline and example.

```bash
pdftoppm /tmp/fg-baseline.pdf /tmp/fg-baseline-sample -png -f 68 -l 72
pdftoppm example-field-guide.pdf /tmp/fg-example-sample -png -f 68 -l 72
ls -lh /tmp/fg-baseline-sample-0*.png /tmp/fg-example-sample-0*.png
```

## What to look for

- Wrong theme signals: white/cream background, serif body font, muted colors.
- Wrong page size signals: 6x9-ish (432x648 pts) instead of Letter (612x792 pts).
- Missing asset signals: the literal text `alt text` showing up where an image should be.

If any of those are present, continue to the next docs.
