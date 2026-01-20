# 10 - Tools Reference

## Build tools

- Build PDF:
  - `bun src/cli.ts build <dir> --format pdf --output out.pdf`
- Build HTML:
  - `bun src/cli.ts build <dir> --format html --output out-dir`

## Vivliostyle preview

- `npx vivliostyle preview /path/to/index.html --port 9998`

## PDF inspection

- Page size / count:
  - `pdfinfo out.pdf | egrep 'Pages|Page size'`
- Fonts:
  - `pdffonts out.pdf`
- Rasterize pages for visual diff:
  - `pdftoppm out.pdf /tmp/out -png -f N -l M`

## Content debugging

- Find image references in markdown:
  - `grep -RIn "!\[" tests/field-guide-input/*.md`
- Identify case mismatches:
  - `ls -la tests/field-guide-input | grep -i name`

## Chrome DevTools MCP

When you’re using the MCP tools:

- Always open and evaluate scripts against the rendered doc URL:
  - `http://localhost:PORT/vivliostyle/index.html`
- Use `getComputedStyle(document.documentElement)` to confirm theme variables.

## Print preflight

- In this environment we used `preflight-print` tool wrapper.
- Output reports are written to `.reviews/preflight-print.*.md`.
