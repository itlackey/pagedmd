# 02 - Chrome DevTools Workflow (MCP)

## Why this matters

The Vivliostyle preview has two layers:

1. The viewer UI (navigation/toolbar)
2. The rendered document (your book HTML)

If you inspect the wrong layer, you will conclude “CSS isn’t applying” even when it is.

## Start a preview server (Vivliostyle CLI)

Use a built HTML file (recommended):

```bash
bun src/cli.ts build tests/field-guide-input --format html --output /tmp/fg-html
npx vivliostyle preview /tmp/fg-html/index.html --port 9998
```

## Know the two URLs

- Viewer shell:
  - `http://localhost:9998/__vivliostyle-viewer/index.html#src=http://localhost:9998/vivliostyle/index.html...`

- Rendered document:
  - `http://localhost:9998/vivliostyle/index.html`

To debug CSS, inspect `.../vivliostyle/index.html`.

## Verify theme application via computed CSS variables

Open DevTools console on the rendered document and run:

```js
const root = getComputedStyle(document.documentElement);
({
  colorPaper: root.getPropertyValue("--color-paper").trim(),
  colorInk: root.getPropertyValue("--color-ink").trim(),
  fontBody: root.getPropertyValue("--font-body").trim(),
  fontHeading: root.getPropertyValue("--font-heading").trim(),
});
```

Expected for Dimm City theme:

- `--color-paper` should be `#000`
- `--color-ink` should be `#eaecec`
- `--font-body` should include `Tomorrow`
- `--font-heading` should include `lixdu`

Also check body background is actually painted:

```js
getComputedStyle(document.body).backgroundColor;
```

## Confirm the theme CSS is present in the final HTML

Because pagedmd inlines CSS into `<style>` blocks, you can grep the DOM:

```js
[...document.querySelectorAll("style")].some((s) =>
  (s.textContent || "").includes("Dimm City Theme")
);
```

If this returns `false`, you are not debugging CSS—you are debugging why the theme wasn’t included.

## Common pitfall: long “Rendering pages…” screens

For big docs, the viewer can appear stuck if `renderAllPages=true`.

Use `renderAllPages=false` or inspect the rendered document directly and validate computed styles.
