# 08 - Runbook (Field Guide)

This is the shortest repeatable loop: build → verify → preflight.

## Build PDF (Vivliostyle)

```bash
bun src/cli.ts build tests/field-guide-input --format pdf --output /tmp/field-guide.pdf
```

## Verify page size

```bash
pdfinfo /tmp/field-guide.pdf | egrep 'Pages|Page size'
```

## Verify fonts

```bash
pdffonts /tmp/field-guide.pdf | head -40
```

## Extract sample pages for quick visual check

```bash
pdftoppm /tmp/field-guide.pdf /tmp/fg-sample -png -f 68 -l 72
```

## Preflight

```bash
preflight-print --pdfPath /tmp/field-guide.pdf --trim letter --maxTac 300
```

## Debug the rendered HTML in-browser (the correct way)

```bash
bun src/cli.ts build tests/field-guide-input --format html --output /tmp/fg-html
npx vivliostyle preview /tmp/fg-html/index.html --port 9998
```

Then inspect:

- `http://localhost:9998/vivliostyle/index.html`

Not just:

- `http://localhost:9998/__vivliostyle-viewer/...`
