
# Migrating from Paged.js to Vivliostyle — HTML & CSS Mapping Guide

This guide is a **practical, implementation‑oriented reference** for migrating a project from **Paged.js** to **Vivliostyle**, focusing on:

- How each engine expects CSS paged‑media rules.
- How to translate page size, margins, and backgrounds.
- How to map headers/footers, running content, and page numbers.
- How to handle page breaks, multi‑column layouts, and corner cases.

The goal is to make this your **day‑to‑day “map”** from Paged.js idioms to Vivliostyle‑friendly CSS.

---

## 1. Mental Model Shift: Polyfill vs CSS Engine

### 1.1 Paged.js Mental Model

- “I write HTML+CSS, then Paged.js **creates pages in the DOM**.”
- Paged.js builds a tree of `.pagedjs_page` elements, each containing cloned content and margin boxes.
- You can style those generated boxes directly with CSS:

  ```css
  .pagedjs_pagebox .pagedjs_page {
    border: 1px solid #ccc;
  }
  ```

### 1.2 Vivliostyle Mental Model

- “I write HTML+CSS, and Vivliostyle **applies paged‑media CSS directly** to that DOM.”
- There are no synthetic `.pagedjs_*` wrappers you should rely on.
- Page appearance is controlled with CSS via `@page`, margin boxes, and normal selectors on your existing elements.

**Migration mantra:** Every Paged.js pattern that relies on `.pagedjs_…` must be re‑expressed in terms of **`@page` rules, named strings, counters, and regular selectors**.

---

## 2. Page Size, Margins, and Backgrounds

### 2.1 Common Ground

Paged.js and Vivliostyle both use the standard `@page` at‑rule:

```css
@page {
  size: A4;
  margin: 20mm 25mm 25mm 25mm;
}
```

This will work in both engines.

### 2.2 Migrating Page Borders & Backgrounds

**Paged.js style:**

```css
.pagedjs_page {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  background: white;
}
```

This targets the **generated page wrapper element**.

**Vivliostyle style:**

Vivliostyle doesn’t expose a `.pagedjs_page` equivalent. Instead, push what truly belongs to “the page” into `@page`:

```css
@page {
  size: A4;
  margin: 20mm;
  background: white;
  /* Note: box-shadow is not a page property; use it only for screen preview if needed */
}
```

For on‑screen debugging (not for final PDF), you can wrap your content in a container and style **that** with shadows:

```html
<body class="preview-frame">
  <!-- document content -->
</body>
```

```css
body.preview-frame {
  margin: 2rem auto;
  max-width: 210mm; /* A4 width */
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}
```

---

## 3. Headers, Footers, and Running Content

### 3.1 Named Strings (Preferred Pattern)

**Paged.js pattern:**
You might already be using the CSS standard pattern, which Paged.js polyfills:

```css
h1.chapter-title {
  string-set: chapterTitle content();
}

@page {
  @top-center { content: string(chapterTitle); }
  @bottom-center { content: counter(page); }
}
```

**Vivliostyle pattern:**
Good news — this is **exactly** how Vivliostyle wants you to do it. You can often keep this code unchanged.

### 3.2 Migrating Margin‑Box DOM Hooks

If you did something like this in Paged.js:

```css
.pagedjs_margin-content.pagedjs_margin-top-center::before {
  content: "My Book Title — " string(chapterTitle);
}
```

Then in Vivliostyle **there is no `.pagedjs_margin-content`**. Instead, use the margin at‑rules directly:

```css
@page {
  @top-center {
    content: "My Book Title — " string(chapterTitle);
    font-size: 10pt;
    font-weight: 600;
  }
}
```

### 3.3 Running Elements (`position: running()`)

If you used the `position: running(header)` pattern in Paged.js:

```css
header.book-title {
  position: running(bookHeader);
}

@page {
  @top-center {
    content: element(bookHeader);
  }
}
```

In Vivliostyle, support for **complex running elements** is limited and more fragile. Prefer **named strings** for text content. For complex multi‑element headers/footers, you may need to:

1. Flatten them into a single element whose **text** can be represented with a named string, or
2. Recreate the more complex layout as inline content inside the `content:` property using counters and text.

---

## 4. Page Breaks & Section Starts

### 4.1 Paged.js Typical Pattern

```css
h1.chapter-title {
  break-before: page;
}
```

Paged.js reads the CSS, but its internal pagination algorithm decides how to create pages and where to clone content.

### 4.2 Vivliostyle Pattern

The **same CSS applies**:

```css
h1.chapter-title {
  break-before: page;
}
```

**Key differences to watch for:**

- Vivliostyle is stricter about the CSS Fragmentation spec; it won’t apply non‑standard aliases or JS heuristics.
- Combined with multi‑column or floats, the exact break behavior might slightly differ. Test chapters that begin near the bottom of a page or inside complex layouts.

### 4.3 Forced Left/Right Pages

Paged.js might have done something like inserting blank `.pagedjs_page` objects when you used custom logic for “odd/even chapter start” pages.

In Vivliostyle, use the spec:

```css
h1.chapter-title {
  break-before: right; /* or left */
}
```

Then style left/right pages via `@page` pseudo‑classes:

```css
@page:left {
  margin-left: 25mm;
  margin-right: 20mm;
}

@page:right {
  margin-left: 20mm;
  margin-right: 25mm;
}
```

Test blank pages and ensure your `@page :blank` context (if used) is styled reasonably:

```css
@page:blank {
  @top-center { content: none; }
  @bottom-center { content: none; }
}
```

---

## 5. Multi‑Column Layouts

### 5.1 Paged.js

Paged.js paginates **inside** whatever layout the browser produces. Many people use multi‑column layout for running text:

```css
main {
  columns: 2;
  column-gap: 1.5em;
}
```

Paged.js splits columns across its generated pages.

### 5.2 Vivliostyle

Vivliostyle uses the underlying browser’s implementation of multi‑column layout + its own pagination logic.

**Tips & edge cases:**

- Avoid too many nested column contexts (e.g., column inside column).
- Be careful combining columns with large floats; content might overflow or break in unexpected places.
- If you have column‑level footnotes, test with a small sample document — these are complex.

If you previously styled `.pagedjs_page` children in columns, move that logic onto your actual content containers (e.g., `<main>`, `.chapter-body`).

---

## 6. TOC, Cross‑References & Counters

### 6.1 Heading Numbering

This pattern works in both engines:

```css
body {
  counter-reset: chapter;
}

h1.chapter-title {
  counter-increment: chapter;
}

h1.chapter-title::before {
  content: "Chapter " counter(chapter) ". ";
}
```

### 6.2 Page Number References

Vivliostyle supports `target-counter()` for page‑number cross‑references. For example:

```css
a.fig-ref::after {
  content: " (see page " target-counter(attr(href), page) ")";
}
```

Paged.js might have used:

- JS to compute page numbers and inject them, or
- a similar CSS approach depending on version and plugin usage.

**Migration note:** If you used custom JS to build cross‑refs in Paged.js, consider switching to CSS `target-counter` patterns and verifying them in Vivliostyle.

---

## 7. Layout Debugging During Migration

When something doesn’t behave as expected:

1. **Run Vivliostyle preview on the document:**

   ```bash
   vivliostyle preview path/to/document.html
   ```

2. Open **Chrome DevTools** and inspect elements.

   - Check actual computed styles for `break-before`, `columns`, margins, etc.
   - Confirm that your `@page` rules exist and are not overridden by other stylesheets.

3. Temporarily add global outlines to see box boundaries:

   ```css
   * {
     outline: 1px dashed rgba(255, 0, 0, 0.2);
   }
   ```

4. Isolate one feature at a time (e.g., “chapter break”, “header text”) in a minimal test HTML file and confirm behavior in Vivliostyle before porting to the main book.

---

## 8. Paged.js Feature → Vivliostyle Mapping Cheatsheet

**Paged.js concept → Vivliostyle equivalent:**

- `.pagedjs_page` styling → `@page { … }`  
- `.pagedjs_margin-content` header/footer CSS → `@page` margin at‑rules (`@top-left`, `@top-center`, etc.)  
- JS‑driven running header elements → named strings (`string-set` / `content: string(...)`)  
- Page break logic in JS → `break-before`, `break-after`, `break-inside`, plus `page-break-*` fallbacks if needed  
- Left/right page wrappers → `@page:left` / `@page:right`  
- Debug outlines on pages → wrap body content in a preview container and style that

---

## 9. Migration Strategy Checklist

1. **Remove all `.pagedjs_*` selectors.**
2. **Move page appearance to `@page` rules** (size, margins, page backgrounds).
3. **Implement headers/footers via named strings and margin at‑rules.**
4. **Express page breaks via `break-*` properties**, not JS.
5. **Test multi‑column + floats in small, isolated documents first.**
6. **Use Vivliostyle preview + DevTools** to validate CSS cascade and layout.
7. Iterate until your print‑oriented CSS reads like **standard paged‑media CSS**, without Paged.js‑specific hooks.

Once you’ve done this, your HTML+CSS becomes much less dependent on any single pagination engine and more portable to other spec‑driven tools as well.
