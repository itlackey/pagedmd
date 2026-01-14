
# Vivliostyle Known Limitations & Differences with Paged.js

## 1. Overview

Vivliostyle is a browser‑based CSS paged‑media engine. It relies on the browser’s layout engine plus its own pagination logic to implement much of the CSS Paged Media and CSS Generated Content for Paged Media specifications.

Paged.js is a JavaScript polyfill that takes a normal HTML document, applies CSS, and then rewrites the DOM into a series of page containers. It emulates many paged‑media features that browsers do not natively support.

This document summarizes **practical limitations of Vivliostyle** and calls out **behavioral differences compared to Paged.js**, with a focus on HTML+CSS workflows for books, manuals, and other long‑form documents.

---

## 2. Rendering Model Differences

### 2.1 Vivliostyle: CSS‑First, Minimal DOM Mutation

- Uses the browser’s CSS implementation as the primary layout engine.
- Applies paged‑media logic on top: page breaking, margin boxes, named pages, etc.
- Keeps your DOM structure mostly intact. The same HTML can usually render both as a normal web page and as paged output, depending on how you load it.

**Implication:** CSS specificity, selector matching, and inheritance behave much closer to “normal” browser behavior.

### 2.2 Paged.js: Polyfill with Extra DOM Structure

- Injects page containers (e.g., `.pagedjs_page`, `.pagedjs_pagebox`) around the content.
- Creates margin‑box elements and clones/renders content into those.
- Adds many extra elements and classes to the DOM during pagination.

**Implication:**

- CSS can end up targeting Paged.js’s synthetic elements.
- Some layout results are the product of **DOM structure + CSS**, rather than CSS alone.
- When migrating to Vivliostyle, **any selector that references Paged.js‑only classes must be rewritten**.

---

## 3. Feature Coverage Overview

The table below is intentionally opinionated and focused on *day‑to‑day book styling* rather than every spec detail.

| Area                            | Vivliostyle                                   | Paged.js                                           |
|---------------------------------|-----------------------------------------------|----------------------------------------------------|
| Core @page / size / margins     | ✅ Standards‑based                            | ✅ Polyfilled                                      |
| Named pages & page selectors    | ✅ `@page` with `:first`, `:left`, `:right`, `:nth()` | ✅ via internal page wrappers               |
| Margin boxes (header/footer)    | ✅ Using `@page` margin at‑rules              | ✅ via generated DOM nodes                         |
| Named strings (`string-set`)    | ✅ Supported                                   | ✅ Supported                                       |
| `position: running()` elements  | ⚠️ Limited / version‑dependent                | ✅ Polyfilled (using cloned DOM)                   |
| Page floats, footnotes          | ✅ Basic support                               | ✅ Basic support (depends on polyfill version)     |
| `target-counter`, cross‑refs    | ✅ Counters; text targets partial              | ⚠️ Typically JS helpers or manual patterns         |
| PDF bookmarks / metadata        | ❌ Not a core feature                          | ❌ Not a core feature                              |
| CMYK, print‑shop PDF features   | ❌ RGB‑oriented; no CMYK pipeline              | ❌ Same limitation                                 |

Legend: ✅ good / production‑ready, ⚠️ partial/quirky, ❌ absent.

---

## 4. Vivliostyle Limitations in Detail

### 4.1 Running Elements vs Named Strings

- Vivliostyle works well with **named strings**:

  ```css
  h1.chapter-title {
    string-set: chapterTitle content();
  }

  @page {
    @top-center { content: string(chapterTitle); }
  }
  ```

- **Limitation:** Full `position: running(header)` style support (moving an element itself into a margin box) is more restricted and may not behave like some examples from specs or other engines.
- Paged.js often handles “running elements” via DOM cloning into header/footer containers, so you might have gotten away with more complex HTML in your headers/footers.

**Migration implication:** Prefer **string‑based running headers/footers** instead of rearranging full element trees by using `position: running()`.

---

### 4.2 Complex Page Group Selectors & Advanced Paged‑Media Selectors

- Vivliostyle supports page selectors such as `:first`, `:left`, `:right`, and `:nth()` for pages.
- Page grouping or more exotic selectors (like “nth page of a page group”) are not widely supported or may be absent.
- Paged.js often approximates these behavior patterns by inserting additional placeholder pages or by exposing explicit class hooks.

**Practical tip:** Design simple page rules driven by:

- **Named pages** (e.g., `@page chapter`) and
- Basic selectors (`:first`, `:left`, `:right`, `:nth(n)`).

Avoid over‑engineering “page groups” unless you confirm Vivliostyle behavior with small test documents.

---

### 4.3 Blank Pages and Forced Left/Right

Vivliostyle:

- Understands concepts like left/right pages.
- When you request `break-before: left` or `break-before: right`, it may need to insert blank pages to maintain parity.
- Behavior is driven by CSS logic, not arbitrary scripting.

Paged.js:

- Blank page handling is part of its internal algorithm. It generates extra `.pagedjs_page` nodes when needed.
- You may have previously styled blank pages via `.pagedjs_page` classes or other Paged.js‑only hooks.

**Vivliostyle limitation / difference:** You can’t rely on the presence of synthetic blank page containers with custom classes. Instead:

- Use `@page :blank { … }` to style blank pages.
- Use `@page :left { … }` and `@page :right { … }` for parity styling.

---

### 4.4 Cross‑References and Targets

Vivliostyle:

- Supports counter‑based cross‑references (`target-counter`, `target-counters`) for page numbers and outline numbers.
- Support for text‑based target extraction (`target-text`) is limited or absent depending on version.
- For truly dynamic cross‑refs (e.g., “See Figure 3.1 on page X”), you must combine counters with careful markup.

Paged.js:

- Typically relies on JavaScript hooks to do more complex cross‑references or on manual HTML duplication.
- There’s no single standard pattern; many projects roll their own.

**Migration implication:** Keep cross‑reference patterns **counter‑centric** and avoid patterns that require “pulling text from an arbitrary target element” unless you are willing to post‑process the HTML.

---

### 4.5 Footnotes and Endnotes

Vivliostyle:

- Supports CSS footnote constructs for relatively straightforward use cases.
- Complex situations (multi‑column footnotes, multiple independent footnote domains on a single page, deeply nested floats combined with footnotes) can be fragile and should be tested carefully.

Paged.js:

- Offers footnote support through polyfill logic, but has similar complexity limitations; edge cases often require custom CSS or JS.

**Practical advice:**

- Keep footnote layout simple (single column or simple multi‑column layout).
- Avoid placing footnoted content inside complex nested floats when possible.
- Build small A/B test documents to confirm behavior before rolling a pattern out to an entire book.

---

### 4.6 Advanced PDF and Print‑Shop Features

Neither Vivliostyle nor Paged.js, by themselves, provide:

- CMYK color management
- Professional prepress features (overprint, trapping, etc.)
- Tagged PDF / PDF/UA accessibility structures
- Rich PDF metadata and bookmark hierarchies (beyond what a downstream PDF tool might infer)

If you need those, you generally:

- Use Vivliostyle or Paged.js to create “good HTML + CSS → high‑quality RGB PDF”,
- Then pass it through other tools or a different renderer (e.g., Prince or a commercial engine) for final print‑shop output.

---

## 5. Differences That Matter During Migration

### 5.1 Selectors That Target Paged.js DOM

Any selector like:

```css
.pagedjs_page .pagedjs_area {
  padding: 10mm;
  background: white;
}
```

…will do nothing in Vivliostyle, because those classes do not exist there.

**Replacement pattern:** Move all page styling into `@page` rules and regular document selectors:

```css
@page {
  size: A4;
  margin: 20mm;
}

body {
  background: white;
}
```

If you need debug outlines while migrating, you can temporarily add:

```css
* {
  outline: 1px dashed rgba(255, 0, 0, 0.2);
}
```

to visually inspect box geometry in Vivliostyle.

---

### 5.2 Margin‑Box Content

With Paged.js, you may have relied on its margin box DOM structure (e.g., targeting `.pagedjs_margin-content`) and cloning of content into those elements.

Vivliostyle expects you to use **pure CSS** for headers/footers via `@page` margin at‑rules and named strings:

```css
h1.chapter-title {
  string-set: chapterTitle content();
}

@page {
  @top-center { content: string(chapterTitle); }
  @bottom-center { content: counter(page); }
}
```

**Key difference:** No direct DOM node in your HTML represents “the header” or “the footer” — they live in the page margin box model, controlled by CSS only.

---

### 5.3 JavaScript‑Driven Layout Tricks

Paged.js, being a JS polyfill, makes it tempting to:

- Measure content in JS,
- Move or clone nodes manually,
- Inject additional wrappers or markers as part of the pagination pipeline.

Vivliostyle is **not** designed for this style of manual DOM surgery during pagination. While your HTML can still use JS to prepare content *before* Vivliostyle lays it out, pagination itself should be considered **CSS‑driven**.

**Migration guideline:**

- Move any “pagination logic” that lives in JS into CSS (`@page`, breaks, counters, strings).
- Restrict JS to content preparation (e.g., number generation, TOC building, adding classes) that completes before Vivliostyle renders.

---

## 6. Summary & Recommendations

1. **Expect to lose Paged.js‑specific DOM hooks.** Anything targeting `.pagedjs_*` classes must be rewritten using standard CSS paged‑media constructs.
2. **Favor named strings over running elements.** They are better supported and more robust in Vivliostyle.
3. **Use @page selectors instead of DOM wrappers for page styling.**
4. **Test edge cases explicitly:** complex footnotes, multi‑column + floats, and forced left/right page breaks.
5. **Separate concerns:** treat Vivliostyle as a *CSS typesetting engine*, not a generic JS layout engine.

If you design your layout around the **CSS specs Vivliostyle supports well**, your documents will be more portable, easier to reason about, and much less tied to any specific pagination engine in the future.
