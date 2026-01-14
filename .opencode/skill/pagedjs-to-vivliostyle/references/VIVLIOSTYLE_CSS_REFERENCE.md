# Vivliostyle CSS Reference

Complete CSS features supported by Vivliostyle for paged media.

## Values

### CSS-wide Keywords
`initial`, `inherit`, `unset`, `revert`

### Length Units
`em`, `ex`, `ch`, `rem`, `lh`, `rlh`, `vw`, `vh`, `vmin`, `vmax`, `vi`, `vb`, `cm`, `mm`, `q`, `in`, `pc`, `pt`, `px`

### Sizing Keywords
`min-content`, `max-content`, `fit-content`

### Color Values
- Named colors
- `transparent`, `currentColor`
- `rgb()`, `rgba()`
- Hex: `#RRGGBB`, `#RRGGBBAA`
- `hsl()`, `hsla()`
- `hwb()`

### Special Functions

```css
/* Attribute reference */
content: attr(data-title);
content: attr(href url);

/* Cross references */
content: target-counter(attr(href), page);
content: target-counters(attr(href), chapter, ".");
content: target-text(attr(href));

/* Named strings */
content: string(chapter-title);
content: string(chapter-title, first);

/* Content function */
string-set: title content();
string-set: title content(text);
string-set: title content(first-letter);

/* Running elements */
position: running(header);
content: element(header);
content: element(header, first);

/* Leaders */
content: leader(dotted);
content: leader(solid);
content: leader(space);

/* Calculations */
width: calc(100% - 2em);

/* Environment variables (Vivliostyle-specific) */
content: env(pub-title);  /* Publication title */
content: env(doc-title);  /* Document title */

/* CSS Variables */
:root { --main-color: #333; }
color: var(--main-color);
```

---

## @page Rule

### Page Size

```css
@page {
  /* Named sizes */
  size: A4;
  size: A4 landscape;
  size: letter;
  size: legal;
  
  /* Custom size */
  size: 210mm 297mm;
  size: 6in 9in;
  
  /* Supported named sizes */
  /* A0-A10, B0-B10, C0-C10, JIS-B0 to JIS-B10 */
  /* letter, legal, ledger */
}
```

### Page Margins

```css
@page {
  margin: 20mm;
  margin: 20mm 15mm;
  margin: 20mm 15mm 25mm 15mm;
  
  /* Individual margins */
  margin-top: 25mm;
  margin-right: 20mm;
  margin-bottom: 30mm;
  margin-left: 20mm;
}
```

### Bleed and Crop Marks

```css
@page {
  bleed: 3mm;
  marks: crop;
  marks: cross;
  marks: crop cross;
  crop-offset: 10mm; /* Vivliostyle extension */
}
```

### Named Pages

```css
/* Assign named page */
.chapter {
  page: chapter;
}

.appendix {
  page: appendix;
}

/* Style named pages */
@page chapter {
  @top-center { content: "Chapter"; }
}

@page appendix {
  @top-center { content: "Appendix"; }
}
```

---

## Page Selectors

```css
/* Basic selectors */
@page :first { }    /* First page of first document */
@page :left { }     /* Left-hand pages */
@page :right { }    /* Right-hand pages */
@page :blank { }    /* Blank pages */
@page :recto { }    /* Recto pages (right in LTR) */
@page :verso { }    /* Verso pages (left in LTR) */

/* Named page selectors */
@page chapter:first { }
@page chapter:left { }

/* Nth page selector (Vivliostyle) */
@page :nth(1) { }       /* First page of each document */
@page :nth(2) { }       /* Second page */
@page :nth(2n) { }      /* Even pages */
@page :nth(2n+1) { }    /* Odd pages */
@page :nth(5n) { }      /* Every 5th page */

@page chapter:nth(1) {  /* First page of each chapter */
  counter-increment: chapter;
}
```

---

## Margin Boxes

### All 16 Margin Boxes

```css
@page {
  /* Top row */
  @top-left-corner { }
  @top-left { }
  @top-center { }
  @top-right { }
  @top-right-corner { }
  
  /* Left side */
  @left-top { }
  @left-middle { }
  @left-bottom { }
  
  /* Right side */
  @right-top { }
  @right-middle { }
  @right-bottom { }
  
  /* Bottom row */
  @bottom-left-corner { }
  @bottom-left { }
  @bottom-center { }
  @bottom-right { }
  @bottom-right-corner { }
}
```

### Margin Box Properties

```css
@page {
  @top-center {
    content: "Header Text";
    font-size: 10pt;
    font-family: sans-serif;
    color: #666;
    vertical-align: bottom;
    text-align: center;
    border-bottom: 1px solid #ccc;
    padding-bottom: 5pt;
  }
}
```

---

## Running Headers and Footers

### Named Strings

```css
/* Set string from element content */
h1 {
  string-set: chapter-title content();
}

h2 {
  string-set: section-title content(text);
}

/* Use in margin box */
@page {
  @top-left {
    content: string(chapter-title);
  }
  @top-right {
    content: string(section-title, first);
  }
}
```

### Running Elements

```css
/* Define running element */
.running-header {
  position: running(header);
  font-size: 10pt;
  font-style: italic;
}

/* Use in margin box */
@page {
  @top-center {
    content: element(header);
  }
}

/* Options: first, start, last, first-except */
@page {
  @top-center {
    content: element(header, first);
  }
}
```

### Environment Variables

```css
/* Vivliostyle-specific env() values */
@page {
  @top-left {
    content: env(pub-title); /* Publication/book title */
  }
  @top-right {
    content: env(doc-title); /* Current document/chapter title */
  }
}
```

---

## Page Counters

```css
/* Built-in counters */
@page {
  @bottom-center {
    content: counter(page);
  }
  @bottom-right {
    content: counter(page) " / " counter(pages);
  }
}

/* Custom counters */
body {
  counter-reset: chapter section figure;
}

h1.chapter {
  counter-increment: chapter;
  counter-reset: section figure;
}

h2 {
  counter-increment: section;
}

figure {
  counter-increment: figure;
}

h1.chapter::before {
  content: "Chapter " counter(chapter) ": ";
}

figure figcaption::before {
  content: "Figure " counter(chapter) "." counter(figure) ": ";
}
```

---

## Fragmentation

### Break Properties

```css
/* Break before */
.chapter {
  break-before: page;    /* New page */
  break-before: left;    /* Next left page */
  break-before: right;   /* Next right page */
  break-before: recto;   /* Next recto */
  break-before: verso;   /* Next verso */
  break-before: avoid;   /* Avoid break */
}

/* Break after */
h1 {
  break-after: avoid;    /* Keep with following */
}

/* Break inside */
figure, table, blockquote {
  break-inside: avoid;   /* Don't split */
}

/* Widows and orphans */
p {
  widows: 3;
  orphans: 3;
}

/* Box decoration at breaks */
.callout {
  box-decoration-break: clone; /* Repeat borders/padding */
}
```

---

## Cross References

```css
/* Page number reference */
a.pageref::after {
  content: " (page " target-counter(attr(href), page) ")";
}

/* Text reference */
a.titleref::after {
  content: target-text(attr(href));
}

/* Counter reference */
a.figref::after {
  content: "Figure " target-counter(attr(href), figure);
}
```

---

## Leaders (TOC)

```css
/* Table of contents with leaders */
.toc-entry {
  display: flex;
}

.toc-entry .title {
  flex: 1;
}

.toc-entry a::after {
  content: leader(dotted) " " target-counter(attr(href), page);
}

/* Leader styles */
content: leader(dotted);  /* . . . . */
content: leader(solid);   /* ───── */
content: leader(space);   /*       */
```

---

## Footnotes

```css
/* Create footnote */
.footnote {
  float: footnote;
  footnote-policy: auto; /* or line */
}

/* Style footnote call */
.footnote::footnote-call {
  content: counter(footnote);
  font-size: 0.75em;
  vertical-align: super;
  line-height: 0;
}

/* Style footnote marker */
.footnote::footnote-marker {
  content: counter(footnote) ". ";
}

/* Style footnote area */
@page {
  @footnote {
    border-top: 0.5pt solid #999;
    margin-top: 1em;
    padding-top: 0.5em;
  }
}
```

---

## Page Floats

```css
/* Float to page edges */
figure.top {
  float: top;
  float-reference: page;
}

figure.bottom {
  float: bottom;
  float-reference: page;
}

/* Snap block float */
figure.snap {
  float: snap-block;
  float-reference: page;
}

/* Combined float positions */
figure.corner {
  float: top right;
  float-reference: page;
}

/* Clear page floats */
.clear-floats {
  clear: both;
}

/* Float reference options */
float-reference: page;
float-reference: column;
float-reference: region;
```

---

## Multi-Column Layout

```css
/* Note: Works best on root/body element */
body {
  column-count: 2;
  column-gap: 2em;
  column-rule: 1px solid #ccc;
}

/* Column properties */
.multicol {
  column-count: 3;
  column-width: 200px;
  column-gap: 20px;
  column-rule-width: 1px;
  column-rule-style: solid;
  column-rule-color: #999;
  column-fill: balance;
}

/* Column span (on page floats) */
h1 {
  column-span: all;
}
```

---

## Writing Modes

```css
/* Horizontal writing */
html {
  writing-mode: horizontal-tb;
}

/* Vertical writing (Japanese, Chinese) */
html {
  writing-mode: vertical-rl;
}

/* Text orientation */
.upright {
  text-orientation: upright;
}

.mixed {
  text-orientation: mixed;
}

/* Text combine */
.tcy {
  text-combine-upright: all;
}
```

---

## Fonts

```css
@font-face {
  font-family: "MyFont";
  src: url("fonts/myfont.woff2") format("woff2"),
       url("fonts/myfont.woff") format("woff");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0000-00FF;
}

/* Font features */
body {
  font-family: "MyFont", serif;
  font-kerning: normal;
  font-variant-ligatures: common-ligatures;
  font-variant-numeric: oldstyle-nums;
  font-feature-settings: "liga" 1, "kern" 1;
}
```

---

## CSS Logical Properties

```css
/* Block/inline dimensions */
.box {
  block-size: 100px;
  inline-size: 200px;
  min-block-size: 50px;
  max-inline-size: 300px;
}

/* Logical margins */
.element {
  margin-block-start: 1em;
  margin-block-end: 1em;
  margin-inline-start: 2em;
  margin-inline-end: 2em;
}

/* Logical padding */
.element {
  padding-block: 1em;
  padding-inline: 2em;
}

/* Logical borders */
.element {
  border-block-start: 1px solid black;
  border-inline-end: 2px solid gray;
}

/* Inside/outside (Vivliostyle extension) */
@page :left {
  margin-inside: 30mm;
  margin-outside: 20mm;
}
```

---

## Text Spacing (CJK)

```css
/* Text autospace */
body {
  text-autospace: normal;
  text-autospace: no-autospace;
  text-autospace: ideograph-alpha ideograph-numeric;
}

/* Text spacing trim */
body {
  text-spacing-trim: normal;
  text-spacing-trim: space-all;
  text-spacing-trim: trim-start;
}

/* Shorthand */
body {
  text-spacing: normal;
  text-spacing: auto;
}
```

---

## Initial Letters (Drop Caps)

```css
p:first-of-type::first-letter {
  initial-letter: 3;
  initial-letter: 3 2; /* lines, sink */
  font-weight: bold;
  margin-right: 0.1em;
}
```

---

## Repeated Headers (Tables)

```css
/* Repeat table headers on page breaks */
table thead {
  repeat-on-break: header;
}

table tfoot {
  repeat-on-break: footer;
}
```

---

## @supports Queries

```css
@supports (display: flex) {
  .container {
    display: flex;
  }
}

@supports selector(:has(*)) {
  /* Modern selector support */
}
```

---

## Media Queries

```css
/* Vivliostyle respects print media */
@media print {
  /* Print-specific styles */
}

/* Vivliostyle-specific media type */
@media vivliostyle {
  /* Vivliostyle-only styles */
}

/* Supported media features */
@media (min-width: 210mm) { }
@media (max-height: 297mm) { }
@media (color) { }
```

---

## Selectors Reference

### CSS2/3 Selectors
All standard selectors supported including:
- Universal, type, class, ID
- Attribute selectors
- Pseudo-classes: `:first-child`, `:last-child`, `:nth-child()`, `:not()`, `:empty`, etc.
- Pseudo-elements: `::before`, `::after`, `::first-line`, `::first-letter`, `::marker`
- Combinators: descendant, child, adjacent, general sibling

### CSS4 Selectors
- `:is()` - Matches any selector in list
- `:where()` - Zero-specificity `:is()`
- `:has()` - Parent selector
- `:nth-child(An+B of S)` - Filtered nth-child

### Not Supported
- `:visited` - Privacy
- `:active`, `:hover`, `:focus` - No interaction
- `:target` - No fragment navigation
