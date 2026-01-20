# 07 - Print Preflight and Why It Fails

## Tool

Use the repo’s preflight tool:

```bash
preflight-print --pdfPath /tmp/output.pdf --trim letter --maxTac 300
```

(From this environment we ran it via the tool wrapper, but the effect is the same.)

## What it checks (high-level)

- Page size matches trim
- Fonts embedded
- PDF/X marker present (heuristic)
- Ink coverage / TAC (Total Area Coverage)

## Common failure for dark + neon designs

If you print full-coverage black backgrounds and saturated neon elements, TAC often exceeds 300%.

In our run:

- Max TAC ~400%
- This is consistent with the reference `example-field-guide.pdf` as well.

Interpretation:

- This does NOT mean the PDF is “wrong”.
- It means it may not be compatible with conservative POD printer TAC limits (often 240–300%).

## What to do if you need POD compliance

Two options:

1. Adjust art/theme for print
   - Avoid pure black full-page backgrounds
   - Reduce saturation
   - Use dark gray paper and “fake black” aesthetic

2. Run a true CMYK/PDF-X pipeline
   - Convert images to CMYK before composition
   - Enforce TAC with ICC profile and conversion
   - Generate true PDF/X-1a output

This repo includes a PDF/X pipeline skill, but it requires careful validation of the resulting file.
