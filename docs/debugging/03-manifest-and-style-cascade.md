# 03 - Manifest and Style Cascade

## Where styles are configured

In `tests/field-guide-input/manifest.yaml`:

```yaml
styles:
  - themes/dimm-city.css
  - styles/index.css
```

- `themes/dimm-city.css` is a bundled theme under `src/assets/themes/`
- `styles/index.css` is project-local under `tests/field-guide-input/styles/`

## How pagedmd applies styles (important)

In build output, pagedmd inlines CSS into `<style>` blocks in this order:

1. Default styles (foundation CSS)
2. Plugin CSS
3. Custom CSS from `manifest.styles` (each file inlined after resolving @imports)

The inlining behavior means:

- If a theme is missing in output, it will _not_ be magically fetched later.
- You can verify inclusion by searching the built HTML for markers.

## Confirm theme was included (from a built HTML output)

```bash
bun src/cli.ts build tests/field-guide-input --format html --output /tmp/fg-html

grep -n "Dimm City Theme" /tmp/fg-html/index.html
grep -n "--color-paper: #000" /tmp/fg-html/index.html
```

If these grep checks fail:

- Ensure `manifest.yaml` is in the input directory you’re building
- Ensure the manifest actually contains the `styles:` entries

## Debugging “wrong theme” in Vivliostyle preview

If you’re using `npx vivliostyle preview` directly on an HTML file, make sure it is the correct HTML:

- Good: `/tmp/fg-html/index.html` (fresh build)
- Risky: `tests/field-guide/index.html` (may be stale if not rebuilt)

Use:

```bash
ls -lh /tmp/fg-html/index.html
stat /tmp/fg-html/index.html
```

and confirm the theme markers exist:

```bash
grep -n "Dimm City Theme" /tmp/fg-html/index.html | head
```
