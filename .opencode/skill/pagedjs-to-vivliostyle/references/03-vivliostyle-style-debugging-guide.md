
# Vivliostyle Style Debugging Guide
## Using `vivliostyle preview` and Chrome DevTools

This guide explains a **practical, repeatable workflow** for debugging HTML+CSS documents that you typeset with Vivliostyle, using:

- The **Vivliostyle CLI `preview` command** to render paginated output.
- **Chrome DevTools** to inspect the DOM, computed styles, and layout behavior.

The focus is on **paged‑media debugging**: page breaks, headers/footers, counters, and multi‑column layout.

---

## 1. Starting the Vivliostyle Preview Server

From your project directory, run:

```bash
vivliostyle preview path/to/your-document.html
```

What this does:

- Starts a local HTTP server.
- Opens Vivliostyle Viewer in your default browser.
- Renders your document with CSS Paged Media applied.
- Lets you flip through pages, zoom, and inspect the result.

If it doesn’t open automatically, Vivliostyle prints the local URL in your terminal; open that URL in Chrome.

---

## 2. Opening Chrome DevTools

In the Vivliostyle preview tab:

1. Right‑click anywhere on the page.
2. Choose **Inspect** to open Chrome DevTools.

You now have access to:

- **Elements panel** — live DOM and CSS rules.
- **Styles panel** — active CSS rules + cascade + specificity.
- **Computed panel** — final computed values (margin, padding, font size, etc.).
- **Console** — JavaScript logs and errors in case your document uses JS.

Even though Vivliostyle is driving pagination, it still runs in a normal browser context, so DevTools works as usual.

---

## 3. Inspecting Elements and CSS Cascade

### 3.1 Locating the Problem Element

Typical suspects:

- A heading that doesn’t start on a new page.
- A header/footer that shows the wrong chapter title.
- A paragraph that overflows or doesn’t respect multi‑column layout.

In the Elements panel:

1. Use the element picker (the mouse‑pointer icon) to click on the visual element in the page.
2. Examine its HTML structure.
3. Look at the **Styles** panel on the right.

### 3.2 Checking Active Rules

In the Styles panel:

- Verify that expected rules are present (e.g., `break-before: page;`, `columns: 2;`).
- Look for higher‑specificity rules or `!important` that override your intended styling.
- Toggle rules on and off by clicking the checkboxes to see immediate impact.

**Tip:** If a rule is crossed out, hover over the “info” icon or look further down the Styles panel to see what overrides it.

---

## 4. Debugging @page Rules and Margin Boxes

Vivliostyle uses **`@page` at‑rules** for page layout and margin box content. DevTools doesn’t show them as elements, but you can still verify that your stylesheet contains them and reason about their effect.

### 4.1 Checking That Your Stylesheet Is Loaded

In DevTools:

1. Open the **Sources** panel.
2. Find your CSS file(s) in the left file tree.
3. Confirm that your `@page` rules are present in the loaded file.

If the file is missing:

- Check that the `link rel="stylesheet"` paths in your HTML are correct.
- Ensure Vivliostyle is loading the same HTML you think it is (no stale build or wrong path).

### 4.2 Verifying Named Strings and Margin Content

If a running header/footer is wrong or missing:

1. Inspect the element that should define the string, e.g. `h1.chapter-title`.
2. Look for `string-set: chapterTitle content();` (or similar) in its Styles panel.
3. Verify that the `@page` rule has a matching margin at‑rule:

   ```css
   @page {
     @top-center { content: string(chapterTitle); }
   }
   ```

4. If the wrong text appears, ensure that:

   - The heading actually appears before the page where you expect its string to be used.
   - No other rule is overwriting `string-set` or redefining the same string later on the page.

**Diagnostic hack:** Temporarily change the header content to something obvious:

```css
@page {
  @top-center {
    content: "DEBUG HEADER" string(chapterTitle);
    background: yellow;
  }
}
```

If the yellow header shows up, your `@page` rule is active and the problem is likely with the named string, not the margin box itself.

---

## 5. Debugging Page Breaks and Fragmentation

### 5.1 Checking Break Properties

If a heading doesn’t start on a new page:

1. Inspect the heading element in DevTools.
2. Look for these properties in the Styles panel:

   - `break-before`
   - `break-after`
   - `page-break-before` / `page-break-after` (legacy aliases)

3. Confirm the final value in the **Computed** tab.

If you see `break-before: auto` instead of `page`, your intended rule may be:

- Missing,
- Overridden by a more specific rule,
- Or applied to the wrong selector.

### 5.2 Understanding Conflicting Break Rules

Sometimes parent elements have `break-inside: avoid;` which can interact with your explicit breaks.

- Inspect ancestor elements (e.g., containers, `.chapter`, `.section`).
- Look for `break-inside`, `page-break-inside`, or oversized elements that can’t split.

If a large unbreakable block sits right before your heading, it might push the heading to the next page (or pull it up) in unexpected ways.

### 5.3 Minimal Repro Case Strategy

If a break issue is hard to debug in the main document:

1. Create a **minimal HTML file** with just a few paragraphs and one heading.
2. Add only the relevant break rules.
3. Run `vivliostyle preview` on that minimal file.
4. Once it behaves correctly, slowly re-add complexity until you find what causes the break to fail.

This isolates whether the problem is:

- A Vivliostyle limitation,
- A CSS cascade mistake,
- Or a layout interaction (columns, floats, etc.).

---

## 6. Debugging Multi‑Column Layout

### 6.1 Verifying Column Properties

If a section is supposed to be multi‑column and isn’t:

1. Inspect the section container (e.g., `<main>`, `.chapter-body`, `.columns`).
2. Ensure you see `columns`, `column-count`, or `column-width` in the Styles panel:

   ```css
   .chapter-body {
     columns: 2;
     column-gap: 1.5em;
   }
   ```

3. Check the Computed panel for `column-count` and `column-width`.

If they look correct, but layout is still single column:

- Confirm that no ancestor has conflicting `display` values (e.g., `display: flex` on the column container may change behavior).
- Try moving the multi‑column style up or down the DOM tree to see if it begins to work.

### 6.2 Columns + Page Breaks + Footnotes

For tricky cases where columns and page breaks interact:

- Temporarily disable footnotes or floats by commenting out their CSS.
- See if the multi‑column layout behaves once the extra complexity is gone.
- Re‑enable and add complexity back in stages.

Vivliostyle, like browsers, can encounter tricky edge cases when floats, columns, and footnotes combine; incremental isolation is the most reliable way to find the culprit.

---

## 7. Global Debug Styles

A few temporary global rules make visual debugging much easier.

### 7.1 Outlines for All Elements

```css
* {
  outline: 1px dashed rgba(255, 0, 0, 0.25);
}
```

Use this to:

- See how block elements stack.
- Find unexpected margins, padding, or nesting.
- Understand where content actually breaks when paginated.

### 7.2 Debugging Page Boxes

You can’t directly outline pages via DOM, but you can:

- Make margins visually obvious via `@page`:

  ```css
  @page {
    margin: 20mm;
    border: 1px solid rgba(0, 0, 255, 0.3);
  }
  ```

- Wrap your document body in a preview frame:

  ```html
  <body class="debug-preview">
    <!-- content -->
  </body>
  ```

  ```css
  body.debug-preview {
    margin: 1rem auto;
    max-width: 210mm; /* for A4 */
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    background: #f8f8f8;
  }
  ```

This won’t affect the final PDF (if you remove it before export) but is invaluable while diagnosing layout issues.

---

## 8. Using DevTools to Prototype Fixes

You can prototype CSS fixes **directly in DevTools** before editing your real stylesheet.

1. Find the rule you want to adjust (e.g., a `break-before`, `margin`, or `font-size`).
2. Change the value inline in the Styles panel.
3. See immediate impact on the Vivliostyle rendering.

Once satisfied:

- Copy the updated CSS back into your project file.
- Save and refresh the Vivliostyle preview to verify with the real stylesheet.

---

## 9. Debugging Workflow Checklist

When something looks wrong in Vivliostyle:

1. **Open DevTools** and inspect the problematic element.
2. **Confirm your stylesheet is loaded** and the expected rule exists.
3. **Check the cascade** for overrides, specificity, or `!important`.
4. **Look at computed values** for the key properties (breaks, columns, margins).
5. **Use debug outlines** to visualize box model and page margins.
6. **Create a minimal reproduction** if behavior is still confusing.
7. Iterate until the CSS is correct and easy to reason about, then remove debug rules.

With this workflow, Vivliostyle becomes much less of a black box: you can treat it as “just another CSS renderer”, and use the same skills you use for complex web layouts—just adapted to paged media.
