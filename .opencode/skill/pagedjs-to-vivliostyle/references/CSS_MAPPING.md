# CSS Feature Mapping: PagedJS → Vivliostyle

Complete mapping of CSS paged media features between PagedJS and Vivliostyle.

## Legend

- ✅ **Full Support** - Works identically
- ⚡ **Partial Support** - Works with noted differences
- 🔄 **Conversion Required** - Needs syntax change
- ❌ **Not Supported** - No equivalent

---

## @page Rule Properties

### Page Size

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `size: A4` | ✅ | ✅ | ✅ Full |
| `size: A4 landscape` | ✅ | ✅ | ✅ Full |
| `size: 210mm 297mm` | ✅ | ✅ | ✅ Full |
| `size: letter` | ✅ | ✅ | ✅ Full |
| ISO sizes A0-A10 | ✅ | ✅ | ✅ Full |
| ISO sizes B0-B10 | ✅ | ✅ | ✅ Full |
| JIS-B0 to JIS-B10 | ❌ | ✅ | ⚡ Vivliostyle only |

### Margins

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `margin: 20mm` | ✅ | ✅ | ✅ Full |
| `margin: 20mm 15mm` | ✅ | ✅ | ✅ Full |
| `margin: 20mm 15mm 25mm 15mm` | ✅ | ✅ | ✅ Full |

### Bleed and Marks

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `bleed: 3mm` | ✅ | ✅ | ✅ Full |
| `marks: crop` | ✅ | ✅ | ✅ Full |
| `marks: cross` | ✅ | ✅ | ✅ Full |
| `marks: crop cross` | ✅ | ✅ | ✅ Full |
| `crop-offset` | ❌ | ✅ | ⚡ Vivliostyle only |

---

## Page Selectors

| Selector | PagedJS | Vivliostyle | Notes |
|----------|---------|-------------|-------|
| `@page` | ✅ | ✅ | ✅ Full |
| `@page :first` | ✅ | ✅ | ✅ Full - first page of first doc |
| `@page :left` | ✅ | ✅ | ✅ Full |
| `@page :right` | ✅ | ✅ | ✅ Full |
| `@page :blank` | ✅ | ✅ | ✅ Full |
| `@page :recto` | ✅ | ✅ | ✅ Full |
| `@page :verso` | ✅ | ✅ | ✅ Full |
| `@page name` | ✅ | ✅ | ✅ Named pages |
| `@page :nth(An+B)` | ❌ | ✅ | ⚡ Vivliostyle only |

### Named Pages

```css
/* Both systems - identical syntax */
.chapter {
  page: chapter;
}

@page chapter {
  @top-center {
    content: "Chapter";
  }
}

@page chapter:first {
  @top-center {
    content: none;
  }
}
```

### :nth() Page Selector (Vivliostyle Only)

```css
/* Vivliostyle - style every 5th page */
@page :nth(5n) {
  background: #f5f5f5;
}

/* First page of each chapter (multi-doc) */
@page chapter:nth(1) {
  counter-increment: chapter;
}
```

---

## Margin Boxes

All 16 margin boxes supported in both systems:

| Margin Box | PagedJS | Vivliostyle |
|------------|---------|-------------|
| `@top-left-corner` | ✅ | ✅ |
| `@top-left` | ✅ | ✅ |
| `@top-center` | ✅ | ✅ |
| `@top-right` | ✅ | ✅ |
| `@top-right-corner` | ✅ | ✅ |
| `@left-top` | ✅ | ✅ |
| `@left-middle` | ✅ | ✅ |
| `@left-bottom` | ✅ | ✅ |
| `@right-top` | ✅ | ✅ |
| `@right-middle` | ✅ | ✅ |
| `@right-bottom` | ✅ | ✅ |
| `@bottom-left-corner` | ✅ | ✅ |
| `@bottom-left` | ✅ | ✅ |
| `@bottom-center` | ✅ | ✅ |
| `@bottom-right` | ✅ | ✅ |
| `@bottom-right-corner` | ✅ | ✅ |

### Margin Box Styling

```css
/* Identical in both systems */
@page {
  @top-center {
    content: "Header Text";
    font-size: 10pt;
    color: #666;
    vertical-align: bottom;
    border-bottom: 1px solid #ccc;
  }
  
  @bottom-center {
    content: counter(page);
  }
}
```

---

## Page Counters

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `counter(page)` | ✅ | ✅ | ✅ Full |
| `counter(pages)` | ✅ | ✅ | ✅ Full |
| `counter-reset: page` | ✅ | ✅ | ✅ Full |
| `counter-increment: page` | ✅ | ✅ | ✅ Full |
| Custom counters | ✅ | ✅ | ✅ Full |

```css
/* Page numbering - identical */
@page {
  @bottom-center {
    content: counter(page) " / " counter(pages);
  }
}

/* Chapter counters */
body {
  counter-reset: chapter;
}

h1.chapter {
  counter-increment: chapter;
}

h1.chapter::before {
  content: "Chapter " counter(chapter) ": ";
}
```

---

## Running Headers and Footers

### Named Strings (string-set/string)

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `string-set` | ✅ | ✅ | ✅ Full |
| `string()` | ✅ | ✅ | ✅ Full |
| `content()` | ✅ | ✅ | ✅ Full |
| `content(text)` | ✅ | ✅ | ✅ Full |
| `content(first-letter)` | ✅ | ✅ | ✅ Full |

```css
/* Named strings - identical in both */
h1 {
  string-set: chapter-title content();
}

@page {
  @top-left {
    content: string(chapter-title);
  }
}
```

### Running Elements (position: running / element())

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `position: running(name)` | ✅ | ✅ | ✅ Full |
| `element(name)` | ✅ | ✅ | ✅ Full |
| `element(name, first)` | ✅ | ✅ | ✅ Full |
| `element(name, last)` | ✅ | ✅ | ✅ Full |

```css
/* Running elements - identical */
.running-header {
  position: running(header);
}

@page {
  @top-center {
    content: element(header);
  }
}
```

---

## Fragmentation (Page Breaks)

| Property | PagedJS | Vivliostyle | Notes |
|----------|---------|-------------|-------|
| `break-before: page` | ✅ | ✅ | ✅ Full |
| `break-before: left` | ✅ | ✅ | ✅ Full |
| `break-before: right` | ✅ | ✅ | ✅ Full |
| `break-before: recto` | ✅ | ✅ | ✅ Full |
| `break-before: verso` | ✅ | ✅ | ✅ Full |
| `break-before: avoid` | ✅ | ✅ | ✅ Full |
| `break-after: page` | ✅ | ✅ | ✅ Full |
| `break-after: avoid` | ✅ | ✅ | ✅ Full |
| `break-inside: avoid` | ✅ | ⚡ | ⚡ All avoid-* treated as avoid |
| `break-inside: avoid-page` | ✅ | ⚡ | ⚡ Treated as avoid |
| `break-inside: avoid-column` | ✅ | ⚡ | ⚡ Treated as avoid |
| `orphans` | ✅ | ✅ | ✅ Full |
| `widows` | ✅ | ✅ | ✅ Full |
| `page-break-before` (legacy) | ✅ | ✅ | ✅ Full |
| `page-break-after` (legacy) | ✅ | ✅ | ✅ Full |
| `page-break-inside` (legacy) | ✅ | ✅ | ✅ Full |

```css
/* Chapter starts on right page */
.chapter {
  break-before: right;
}

/* Keep headings with following content */
h1, h2, h3 {
  break-after: avoid;
}

/* Don't break figures */
figure {
  break-inside: avoid;
}

/* Widows and orphans */
p {
  widows: 3;
  orphans: 3;
}
```

---

## Cross References

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `target-counter()` | ✅ | ✅ | ✅ Full |
| `target-counters()` | ✅ | ✅ | ✅ Full |
| `target-text()` | ✅ | ✅ | ✅ Full |

```css
/* Cross-reference - identical */
a.page-ref::after {
  content: " (page " target-counter(attr(href), page) ")";
}

a.title-ref::after {
  content: " "" target-text(attr(href)) """;
}
```

---

## Leaders (Table of Contents)

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `leader()` | ✅ | ✅ | ✅ Full |
| `leader(dotted)` | ✅ | ✅ | ✅ Full |
| `leader(solid)` | ✅ | ✅ | ✅ Full |
| `leader(space)` | ✅ | ✅ | ✅ Full |

```css
/* Table of contents leaders - identical */
.toc-entry a::after {
  content: leader(dotted) " " target-counter(attr(href), page);
}
```

---

## Footnotes

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `float: footnote` | ✅ | ✅ | ✅ Full |
| `::footnote-call` | ✅ | ✅ | ✅ Full |
| `::footnote-marker` | ✅ | ✅ | ✅ Full |
| `@footnote` | ✅ | ✅ | ✅ Full |
| `footnote-policy` | ❌ | ✅ | ⚡ Vivliostyle only |

```css
/* Footnotes - identical base syntax */
.footnote {
  float: footnote;
}

.footnote::footnote-call {
  content: counter(footnote);
  font-size: 0.8em;
  vertical-align: super;
}

.footnote::footnote-marker {
  content: counter(footnote) ". ";
}

@page {
  @footnote {
    border-top: 1px solid #ccc;
    padding-top: 0.5em;
  }
}

/* Vivliostyle-only: footnote-policy */
.footnote {
  float: footnote;
  footnote-policy: line; /* auto or line */
}
```

---

## Page Floats (Advanced)

Vivliostyle has enhanced page float support:

| Feature | PagedJS | Vivliostyle | Status |
|---------|---------|-------------|--------|
| `float: left/right` | ✅ | ✅ | ✅ Full |
| `float: top` | ❌ | ✅ | ⚡ Vivliostyle only |
| `float: bottom` | ❌ | ✅ | ⚡ Vivliostyle only |
| `float: snap-block` | ❌ | ✅ | ⚡ Vivliostyle only |
| `float-reference: page` | ❌ | ✅ | ⚡ Vivliostyle only |
| `float-reference: column` | ❌ | ✅ | ⚡ Vivliostyle only |

```css
/* Vivliostyle page floats */
figure.full-page {
  float: top;
  float-reference: page;
  width: 100%;
}

figure.bottom {
  float: bottom;
  float-reference: page;
}
```

---

## PagedJS Custom Properties → Standard CSS

### Must Convert

| PagedJS Custom Property | Vivliostyle Equivalent |
|------------------------|----------------------|
| `var(--pagedjs-pagebox-width)` | Defined via `@page { size: }` |
| `var(--pagedjs-pagebox-height)` | Defined via `@page { size: }` |
| `var(--pagedjs-margin-top)` | Use `@page { margin-top: }` |
| `var(--pagedjs-margin-bottom)` | Use `@page { margin-bottom: }` |
| `var(--pagedjs-margin-left)` | Use `@page { margin-left: }` |
| `var(--pagedjs-margin-right)` | Use `@page { margin-right: }` |

### PagedJS Generated Classes (Not Needed)

PagedJS generates these classes during rendering. They don't exist in source CSS and shouldn't be in Vivliostyle CSS:

- `.pagedjs_page` - Vivliostyle uses native pagination
- `.pagedjs_page_content` - Not needed
- `.pagedjs_margin-*` - Not needed
- `.pagedjs_bleed-*` - Not needed
- `.pagedjs_marks-*` - Not needed

---

## Vivliostyle-Only Features

### env() Functions

```css
@page {
  @top-left {
    content: env(pub-title); /* Publication title */
  }
  @top-right {
    content: env(doc-title); /* Current document title */
  }
}
```

### Inside/Outside Properties

```css
@page :left {
  margin-inside: 30mm;
  margin-outside: 20mm;
}

@page :right {
  margin-inside: 30mm;
  margin-outside: 20mm;
}
```

### Repeated Headers

```css
table thead {
  repeat-on-break: header;
}
```

---

## Migration Checklist

### Before Converting

- [ ] List all PagedJS-specific JavaScript hooks
- [ ] Identify `--pagedjs-*` custom properties
- [ ] Check for PagedJS class selectors
- [ ] Note any `Paged.registerHandlers` usage

### CSS Conversion

- [ ] Replace `--pagedjs-pagebox-*` with `@page { size: }`
- [ ] Remove PagedJS class selectors
- [ ] Test `@page` rules work correctly
- [ ] Verify margin box content
- [ ] Check running headers/footers
- [ ] Test page counters
- [ ] Validate cross-references

### Testing

- [ ] Compare page count
- [ ] Check page breaks match
- [ ] Verify headers/footers on all pages
- [ ] Test named pages
- [ ] Validate footnotes
- [ ] Check table of contents
