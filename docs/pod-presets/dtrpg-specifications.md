# DriveThruRPG / Lightning Source Print Specifications

DriveThruRPG uses Lightning Source (an Ingram company) for print-on-demand fulfillment. This document covers the specifications required for books sold through DriveThruRPG.

## Overview

| Aspect            | Requirement               |
| ----------------- | ------------------------- |
| **Printer**       | Lightning Source (Ingram) |
| **File Format**   | PDF                       |
| **Color Profile** | CMYK or sRGB              |
| **Resolution**    | 300 DPI minimum           |
| **Bleed**         | 0.125" (3.175mm)          |

## Available Trim Sizes

DriveThruRPG offers the following trim sizes:

### Standard Sizes

| Size Name    | Dimensions (inches) | Dimensions (mm) | TTRPG Use             |
| ------------ | ------------------- | --------------- | --------------------- |
| Pocket       | 5" x 8"             | 127 x 203       | Compact rules, zines  |
| Digest       | 5.5" x 8.5"         | 140 x 216       | Indie RPGs            |
| A5           | 5.827" x 8.268"     | 148 x 210       | European standard     |
| US Trade     | 6" x 9"             | 152 x 229       | General purpose       |
| Royal        | 6.14" x 9.21"       | 156 x 234       | Slightly larger trade |
| Crown Quarto | 6.69" x 9.61"       | 170 x 244       | Illustrated books     |
| Executive    | 7" x 10"            | 178 x 254       | Reference books       |
| Quarto       | 7.5" x 9.25"        | 191 x 235       | Art books             |
| Square S     | 8" x 8"             | 203 x 203       | Square format         |
| Comic        | 8" x 10"            | 203 x 254       | Comic books           |
| Premium      | 8.25" x 10.75"      | 210 x 273       | Premium RPGs          |
| Square L     | 8.5" x 8.5"         | 216 x 216       | Large square          |
| US Letter    | 8.5" x 11"          | 216 x 279       | Classic RPG format    |

## Interior Color Options

| Option                 | Paper               | Best For              | Cost    |
| ---------------------- | ------------------- | --------------------- | ------- |
| **Black & White 70lb** | 70lb uncoated white | Text-heavy, budget    | Lowest  |
| **Standard Color**     | 70lb coated white   | Maps, some color      | Medium  |
| **Premium Color**      | 80lb coated white   | Full-color, art-heavy | Highest |

## Binding Types

| Type                        | Description                               | Min Pages | Max Pages |
| --------------------------- | ----------------------------------------- | --------- | --------- |
| **Softcover Perfect Bound** | Glued spine, paperback                    | 24        | 800+      |
| **Hardcover Case Laminate** | Glued spine, hardcover with printed cover | 24        | 800+      |

### Cover Finishes

- **Gloss**: Shiny, vibrant colors, fingerprints visible
- **Matte**: Soft feel, professional look, fingerprint resistant

## Bleed and Margins

### Interior Pages

```
┌──────────────────────────────────────────┐
│ ← 0.125" BLEED                           │
│   ┌────────────────────────────────┐     │
│   │ ← 0.125" SAFETY               │     │
│   │   ┌────────────────────────┐   │     │
│   │   │                        │   │     │
│   │   │    SAFE CONTENT AREA   │   │     │
│   │   │                        │   │     │
│   │   └────────────────────────┘   │     │
│   │         0.5" GUTTER →         │     │
│   └────────────────────────────────┘     │
│                              TRIM LINE → │
└──────────────────────────────────────────┘
```

### Measurements

| Element               | Minimum          | Recommended    |
| --------------------- | ---------------- | -------------- |
| Bleed                 | 0.125" (3.175mm) | 0.125"         |
| Safety Margin (outer) | 0.125" (3.175mm) | 0.25" (6.35mm) |
| Gutter (inner)        | 0.375" (9.5mm)   | 0.5" - 0.875"  |

### Gutter by Page Count

| Page Count | Recommended Gutter |
| ---------- | ------------------ |
| 1-150      | 0.375" (9.5mm)     |
| 151-300    | 0.5" (12.7mm)      |
| 301-500    | 0.625" (15.9mm)    |
| 501+       | 0.875" (22.2mm)    |

## Page Count Rules

### Divisibility Requirements

- **6.14" x 9.21" and smaller**: Page count should be divisible by 6
- **6.69" x 9.61" and larger**: Page count should be divisible by 4
- **All books**: Must be divisible by 2 (minimum)

Non-conforming page counts will have blank pages added at the back.

## Cover Specifications

### Cover Template Required

DriveThruRPG requires you to use their cover template generator. The template calculates:

- Exact spine width based on page count and paper type
- Total cover dimensions including bleed
- Safe zones for text and important elements

### Cover PDF Dimensions

```
Total Width = Back Cover + Spine + Front Cover + (2 × Bleed)
            = Trim Width + Spine Width + Trim Width + 0.25"

Total Height = Trim Height + (2 × Bleed)
             = Trim Height + 0.25"
```

### Example: 6" x 9" book with 200 pages (Standard Color)

```
Spine Width ≈ 0.50" (varies by paper type)
Total Width = 6" + 0.50" + 6" + 0.25" = 12.75"
Total Height = 9" + 0.25" = 9.25"
```

### Cover Safe Zones

- **Outer edges**: 0.125" from trim line
- **Spine**: 0.0625" (1/16") from spine edge
- **Wrap area (hardcover)**: Additional 0.75" on all edges

## PDF Requirements

### Interior PDF

- Single PDF containing all pages
- Page size = Trim size + Bleed (e.g., 6.25" x 9.25" for 6" x 9" book)
- All fonts embedded
- Images at 300 DPI
- Flattened transparency
- No crop marks or registration marks
- No security/password protection

### Cover PDF

- Single page spread
- Exact dimensions from template
- All fonts embedded
- Images at 300 DPI
- CMYK color space recommended
- No crop marks

## Color Guidelines

### CMYK Recommendations

- Total Area Coverage (TAC): Maximum 270%
- Rich black: C:30 M:30 Y:30 K:100
- Avoid very light tints below 20%

### Image Handling

- Convert all images to CMYK before final export
- Embed ICC profiles
- Grayscale images for B&W interiors

## PagedMD Configuration

### Example manifest.yaml for DTRPG

```yaml
title: My TTRPG Sourcebook
authors:
  - Your Name

# Page format for DTRPG US Letter with Premium Color
format:
  size: 8.5in 11in
  bleed: 0.125in
  margins:
    top: 0.5in
    bottom: 0.5in
    inside: 0.625in # Gutter for ~200 pages
    outside: 0.5in

# PDF engine settings
pdf:
  engine: auto
  cropMarks: false # DTRPG doesn't want crop marks
  bleed: 0.125in

# Styles
styles:
  - themes/ttrpg-print.css
```

## Validation Checklist

Before uploading to DriveThruRPG:

- [ ] Interior PDF page size includes bleed
- [ ] Cover built from official template
- [ ] All fonts embedded
- [ ] Images 300 DPI minimum
- [ ] Page count meets divisibility rules
- [ ] No crop marks or registration marks
- [ ] Color profiles correct (CMYK or sRGB)
- [ ] PDF not password protected
- [ ] Spine text (if any) fits calculated spine width

## Resources

- [DriveThruRPG Print Partner Knowledge Base](https://help.drivethrurpg.com)
- [Lightning Source File Creation Guide](https://www.ingramspark.com/hubfs/downloads/file-creation-guide.pdf)
- [Cover Template Generator](https://www.drivethrurpg.com/pub_tools_print.php) (requires publisher account)
