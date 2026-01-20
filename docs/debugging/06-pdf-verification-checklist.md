# 06 - PDF Verification Checklist

Use these checks every iteration.

## 1) Page size and count

```bash
pdfinfo /tmp/output.pdf | egrep 'Pages|Page size'
```

## 2) Fonts embedded

```bash
pdffonts /tmp/output.pdf | head -40
```

For the Dimm City theme, you should see fonts like:

- Tomorrow-\*
- Lixdu
- TitilliumWeb-\*

## 3) Visual sample pages

```bash
pdftoppm /tmp/output.pdf /tmp/out-sample -png -f 68 -l 72
ls -lh /tmp/out-sample-0*.png
```

Compare against the reference:

```bash
pdftoppm example-field-guide.pdf /tmp/ref-sample -png -f 68 -l 72
```

## 4) Optional: run a quick HTML build and grep for theme markers

```bash
bun src/cli.ts build tests/field-guide-input --format html --output /tmp/fg-html

grep -n "Dimm City Theme" /tmp/fg-html/index.html | head
```

If this fails, the PDF will not have the theme.
