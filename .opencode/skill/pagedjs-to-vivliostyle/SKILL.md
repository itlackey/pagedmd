---
name: pagedjs-to-vivliostyle
description: Convert print-ready documents from PagedJS to Vivliostyle. Use when migrating CSS paged media stylesheets, HTML templates, or markdown book projects from PagedJS to Vivliostyle. Handles CSS feature mapping (@page rules, margin boxes, running headers, counters, named pages, fragmentation), markdown-it container syntax conversion, and project configuration migration. Includes validation scripts and comprehensive reference documentation.
---

# PagedJS to Vivliostyle Migration Skill

Convert CSS paged media projects from PagedJS to Vivliostyle, including stylesheets, HTML templates, and markdown book configurations.

## Quick Reference

| PagedJS | Vivliostyle | Notes |
|---------|-------------|-------|
| `pagedjs` polyfill | `@vivliostyle/cli` | Build tool replacement |
| `paged.polyfill.js` | Native CSS support | No JS polyfill needed |
| `--pagedjs-*` CSS vars | Standard CSS | Use native properties |
| `Paged.registerHandlers` | VFM plugins | Different extension model |

## Migration Workflow

### 1. Audit Existing PagedJS Project

Identify components:
- CSS files with `@page` rules
- HTML templates with print structure
- Markdown files with containers (`::: name`)
- JavaScript hooks/handlers

### 2. Convert CSS

See `references/CSS_MAPPING.md` for complete feature mapping.

**Core conversions:**

```css
/* PagedJS custom properties → Standard CSS */

/* PagedJS */
:root {
  --pagedjs-pagebox-width: 210mm;
  --pagedjs-pagebox-height: 297mm;
}

/* Vivliostyle - use size property directly */
@page {
  size: A4; /* or 210mm 297mm */
}
```

**Running headers:**

```css
/* PagedJS */
.running-title {
  position: running(runningTitle);
}
@page {
  @top-center {
    content: element(runningTitle);
  }
}

/* Vivliostyle - same syntax, fully supported */
.running-title {
  position: running(runningTitle);
}
@page {
  @top-center {
    content: element(runningTitle);
  }
}
```

**Named strings:**

```css
/* PagedJS */
h1 { string-set: chapter-title content(); }
@page {
  @top-left { content: string(chapter-title); }
}

/* Vivliostyle - identical syntax */
h1 { string-set: chapter-title content(); }
@page {
  @top-left { content: string(chapter-title); }
}
```

### 3. Convert Project Configuration

**PagedJS CLI → Vivliostyle CLI:**

```bash
# PagedJS
npx pagedjs-cli input.html -o output.pdf

# Vivliostyle
npx @vivliostyle/cli build input.html -o output.pdf
```

**Create vivliostyle.config.js:**

```javascript
module.exports = {
  title: 'Book Title',
  author: 'Author Name',
  language: 'en',
  size: 'A4',
  theme: './styles/print.css',
  entry: [
    'chapters/01-intro.md',
    'chapters/02-content.md',
  ],
  output: [
    './output.pdf',
    { path: './webpub/', format: 'webpub' }
  ],
};
```

### 4. Convert Markdown Containers

PagedJS projects using markdown-it-container need conversion to VFM syntax or custom VFM plugins.

See `references/MARKDOWN_IT_REFERENCE.md` for markdown-it-container patterns.

**Common container conversions:**

```markdown
<!-- PagedJS with markdown-it-container -->
::: warning
This is a warning
:::

<!-- VFM - use class syntax -->
{.warning}
This is a warning
```

For complex containers, create custom VFM configuration in vivliostyle.config.js:

```javascript
module.exports = {
  // ...
  vfm: {
    // Custom markdown processing options
    hardLineBreaks: false,
    disableFormatHtml: false,
  },
  documentProcessor: (options, metadata) => {
    // Custom unified processor for markdown-it-container equivalents
    return unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(customContainerPlugin)
      .use(remarkRehype)
      .use(rehypeStringify);
  }
};
```

### 5. Validate and Test

Run validation script:

```bash
bun run scripts/validate-css.ts ./styles/print.css
```

Test rendering:

```bash
# Preview
npx @vivliostyle/cli preview

# Build test PDF
npx @vivliostyle/cli build -o test-output.pdf
```

Compare output with original PagedJS PDF for:
- Page breaks at same locations
- Running headers/footers content
- Page numbers and counters
- Margin box positioning

## Key Differences

### PagedJS-Specific Features Not in Vivliostyle

| PagedJS | Vivliostyle Alternative |
|---------|------------------------|
| `--pagedjs-pagebox-width` | Use `@page { size: }` |
| `--pagedjs-pagebox-height` | Use `@page { size: }` |
| JS hooks (`Paged.registerHandlers`) | VFM plugins or pre-processing |
| `data-*` attributes from chunker | Use CSS selectors on content |

### Vivliostyle-Specific Features

| Feature | Syntax |
|---------|--------|
| `:nth(An+B)` page selector | `@page :nth(2n+1) { }` |
| Multi-document books | `entry: []` in config |
| `env(pub-title)` | Publication title in headers |
| `env(doc-title)` | Document title in headers |
| Page floats | `float: top`, `float-reference: page` |

## Reference Documentation

- `references/CSS_MAPPING.md` - Complete CSS feature mapping table
- `references/VIVLIOSTYLE_CSS_REFERENCE.md` - Full Vivliostyle CSS support documentation
- `references/MARKDOWN_IT_REFERENCE.md` - markdown-it and markdown-it-container docs
- `references/VFM_REFERENCE.md` - Vivliostyle Flavored Markdown specification

## Testing Scripts

- `scripts/validate-css.ts` - Validate CSS for Vivliostyle compatibility
- `scripts/convert-pagedjs-css.ts` - Automated CSS conversion helper
- `scripts/test-vivliostyle-render.ts` - Render test and comparison tool

## Common Issues

### Page Breaks Differ

Check `break-before`, `break-after`, `break-inside` values. Vivliostyle may handle `avoid` differently.

### Running Headers Missing

Ensure elements with `position: running()` exist in the HTML. VFM auto-generates sections that may not include running elements.

### Counters Reset Incorrectly

In multi-document books, `:first` matches only first page of first document. Use `:nth(1)` for first page of each document.

### Fonts Not Loading

Ensure `@font-face` declarations use correct paths relative to HTML file, not CSS file.
