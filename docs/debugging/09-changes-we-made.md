# 09 - Concrete Changes We Made in This Repo

This doc lists the exact files changed during the debugging session.

## Manifest

File: `tests/field-guide-input/manifest.yaml`

Final key content:

```yaml
styles:
  - themes/dimm-city.css
  - styles/index.css

pdf:
  engine: vivliostyle
  pressReady: true
```

## Book-level CSS

File: `tests/field-guide-input/styles/index.css`

- Added `@page { size: letter; }` and margins
- Added named pages `full`, `clean`, `blood-border`
- Forced background painting via `html, body { background: var(--color-paper) }`
- Added `print-color-adjust` hints

## Case-sensitive asset fix

File: `tests/field-guide-input/chapter-01.md`

- `![alt text](streetwarden.png)` → `![alt text](Streetwarden.png)`

## Skill doc update

File: `.tmp/profile/skill/vivliostyle-debug/SKILL.md`

- Added guidance about inspecting `.../vivliostyle/index.html` vs viewer shell.
