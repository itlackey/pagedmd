# 04 - Page Size and Named Pages

## Symptoms

- Output page size is 6x9-ish (e.g., `432 x 648 pts`) instead of Letter (`612 x 792 pts`).
- Chapter CSS references named pages that don’t exist (`page: full`, `page: clean`, `page: blood-border`).

## Fix strategy

Make `styles/index.css` the “book-level contract”:

- Force `@page { size: letter; }`
- Define named page templates used by chapter styles
- Ensure backgrounds are actually painted

## File to edit

`tests/field-guide-input/styles/index.css`

## Example patch (what we did)

```css
@page {
  size: letter;
  margin: 0.75in;
  background: var(--color-paper);
}

@page full {
  size: letter;
  margin: 0;
  background: var(--color-paper);
}

@page clean {
  size: letter;
  margin: 0.75in;
  background: var(--color-paper);
}

@page blood-border {
  size: letter;
  margin: 0.75in;
  background: var(--color-paper);
}

html,
body {
  background: var(--color-paper);
  color: var(--color-ink);
}

@media print {
  html,
  body {
    background: var(--color-paper) !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }
}
```

## Test after change

```bash
bun src/cli.ts build tests/field-guide-input --format pdf --output /tmp/fg-letter.pdf
pdfinfo /tmp/fg-letter.pdf | egrep 'Pages|Page size'
```

Expected:

- `Page size: 612 x 792 pts (letter)`
