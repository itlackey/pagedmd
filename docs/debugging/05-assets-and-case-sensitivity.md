# 05 - Assets and Case Sensitivity

## Symptom

In the PDF, you see the literal string `alt text` where an image should be.

That usually means the image failed to load.

## Why it happens

On Linux filesystems, paths are case-sensitive.

So:

- `streetwarden.png` is NOT the same file as `Streetwarden.png`

## How to find broken references

Search markdown for image references:

```bash
grep -RIn "!\[" tests/field-guide-input/*.md
```

When you find a suspected file, confirm it exists:

```bash
ls -la tests/field-guide-input | grep -i streetwarden
```

## Fix in markdown

Example fix performed:

File: `tests/field-guide-input/chapter-01.md`

Change:

- `![alt text](streetwarden.png)`

To:

- `![alt text](Streetwarden.png)`

Then rebuild:

```bash
bun src/cli.ts build tests/field-guide-input --format pdf --output /tmp/fg-letter2.pdf
```

## Debugging in the browser

In the rendered document (`.../vivliostyle/index.html`) open DevTools Network tab and filter by:

- Status code 404
- Resource type “Img”

Fix those paths first before blaming CSS.
