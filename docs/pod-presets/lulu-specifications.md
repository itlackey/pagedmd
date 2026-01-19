# Lulu Press Print Specifications

Lulu is a self-publishing platform offering print-on-demand books with global distribution. This document covers the specifications for creating print-ready PDFs for Lulu.

## Overview

| Aspect            | Requirement                      |
| ----------------- | -------------------------------- |
| **File Format**   | PDF                              |
| **Color Profile** | sRGB (preferred) or CMYK         |
| **Resolution**    | 300 DPI minimum, 600 DPI maximum |
| **Bleed**         | 0.125" (3.18mm) on all sides     |
| **Safety Margin** | 0.5" (12.7mm) from trim edge     |
| **Gutter**        | Minimum 0.2" (5mm) inner margin  |

## Available Trim Sizes

### Paperback Sizes

| Size Name      | Dimensions (inches) | Dimensions (mm) |
| -------------- | ------------------- | --------------- |
| Pocket         | 4.25" x 6.87"       | 108 x 175       |
| Digest         | 5.5" x 8.5"         | 140 x 216       |
| A5             | 5.83" x 8.27"       | 148 x 210       |
| US Trade       | 6" x 9"             | 152 x 229       |
| Royal          | 6.14" x 9.21"       | 156 x 234       |
| US Letter      | 8.5" x 11"          | 216 x 279       |
| A4             | 8.27" x 11.69"      | 210 x 297       |
| Square (Small) | 7.5" x 7.5"         | 190 x 190       |
| Square (Large) | 8.5" x 8.5"         | 216 x 216       |

### Hardcover Sizes

| Size Name | Dimensions (inches) | Dimensions (mm) |
| --------- | ------------------- | --------------- |
| Digest    | 5.5" x 8.5"         | 140 x 216       |
| US Trade  | 6" x 9"             | 152 x 229       |
| Royal     | 6.14" x 9.21"       | 156 x 234       |
| Executive | 7" x 10"            | 178 x 254       |
| US Letter | 8.5" x 11"          | 216 x 279       |

## Paper and Color Options

### Interior Options

| Type                      | Paper Weight  | Best For              |
| ------------------------- | ------------- | --------------------- |
| **Black & White - White** | 50lb / 74gsm  | Text-heavy, budget    |
| **Black & White - Cream** | 50lb / 74gsm  | Novels, fiction       |
| **Standard Color**        | 60lb / 90gsm  | Some illustrations    |
| **Premium Color**         | 70lb / 104gsm | Full-color, art-heavy |

### Cover Options

| Finish     | Description                     |
| ---------- | ------------------------------- |
| **Glossy** | High shine, vibrant colors      |
| **Matte**  | Soft texture, professional look |

## Binding Types

| Type                      | Min Pages | Max Pages | Notes                 |
| ------------------------- | --------- | --------- | --------------------- |
| Perfect Bound (Paperback) | 24        | 800       | Standard paperback    |
| Coil Bound                | 24        | 300       | Lies flat when open   |
| Saddle Stitch             | 8         | 60        | Stapled booklets      |
| Casewrap (Hardcover)      | 24        | 800       | Printed hardcover     |
| Dust Jacket (Hardcover)   | 24        | 800       | Hardcover with jacket |

## Bleed and Margins

### Interior Layout

```
┌─────────────────────────────────────────────────┐
│               ← 0.125" BLEED →                  │
│  ┌───────────────────────────────────────────┐  │
│  │            ← 0.125" BLEED →               │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │                                     │  │  │
│  │  │     ← 0.5" SAFETY MARGIN →         │  │  │
│  │  │                                     │  │  │
│  │  │   ┌─────────────────────────────┐   │  │  │
│  │  │   │                             │   │  │  │
│  │  │   │    SAFE CONTENT AREA        │   │  │  │
│  │  │   │                             │   │  │  │
│  │  │   │                             │   │  │  │
│  │  │   └─────────────────────────────┘   │  │  │
│  │  │                                     │  │  │
│  │  │         0.2" GUTTER MIN →          │  │  │
│  │  │                                     │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │                         ← TRIM LINE →     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Margin Requirements

| Element         | Minimum         | Recommended  |
| --------------- | --------------- | ------------ |
| Bleed           | 0.125" (3.18mm) | 0.125"       |
| Safety Margin   | 0.5" (12.7mm)   | 0.5"         |
| Gutter (inside) | 0.2" (5mm)      | 0.4" - 0.75" |

### Gutter Recommendations by Page Count

| Page Count | Recommended Gutter |
| ---------- | ------------------ |
| Under 100  | 0.2" - 0.3"        |
| 100-200    | 0.3" - 0.4"        |
| 200-400    | 0.4" - 0.5"        |
| 400-600    | 0.5" - 0.625"      |
| 600+       | 0.625" - 0.75"     |

## Cover Specifications

### Cover PDF Requirements

- Single-page spread containing back, spine, and front
- 0.125" bleed on all outer edges
- No crop marks or registration marks

### Cover Dimensions Formula

```
Total Width = Back Cover Width + Spine Width + Front Cover Width

Where each cover width includes bleed:
- Back Cover Width = Trim Width + 0.125" (bleed)
- Front Cover Width = Trim Width + 0.125" (bleed)

Total Width = (Trim Width + 0.125") + Spine Width + (Trim Width + 0.125")
            = (2 × Trim Width) + Spine Width + 0.25"

Total Height = Trim Height + 0.25" (top and bottom bleed)
```

### Spine Width Calculation

Lulu provides a spine calculator, but approximate values:

| Paper Type | Per-Page Thickness |
| ---------- | ------------------ |
| 50lb White | 0.002252"          |
| 50lb Cream | 0.0025"            |
| 60lb White | 0.0027"            |
| 70lb Color | 0.00319"           |

**Example**: 326-page book on 70lb color paper

```
Spine = 326 × 0.00319" = 1.04" (approximately)
```

### Cover Safe Zones

| Area               | Minimum Distance       |
| ------------------ | ---------------------- |
| Outer edges        | 0.25" from trim line   |
| Spine edges        | 0.125" from spine fold |
| Hardcover casewrap | 0.75" additional wrap  |

## PDF Creation Guidelines

### Interior PDF

- **Page Size**: Trim size + 0.25" (bleed on each side)
  - Example: 6" x 9" book = 6.25" x 9.25" PDF pages
- **Format**: Single-page layout (NOT spreads)
- **Page Order**: Page 1 is a right-hand page
- **Fonts**: All fonts embedded
- **Images**: 300 DPI minimum
- **Transparency**: Flatten all layers
- **Marks**: No crop/registration marks
- **Security**: No password protection

### Cover PDF

- **Page Size**: Exact dimensions from Lulu calculator
- **Format**: Single page (back + spine + front)
- **Resolution**: 300 DPI minimum
- **Color**: sRGB or CMYK
- **Fonts**: All fonts embedded

## Color Guidelines

### Recommended Settings

- **Color Space**: sRGB (preferred) or CMYK
- **ICC Profile**: Gracol for best color matching
- **Rich Black**: C:30 M:30 Y:30 K:100
- **TAC (Total Area Coverage)**: Maximum 270%
- **Light Tints**: Avoid below 20%

### Grayscale for B&W Books

- Black & white images should be in grayscale color space
- Gamma: 2.2 - 2.4

### Color Variance Warning

Slight color differences between screen and print are normal. Variations may also occur between different print runs due to:

- Different printing facilities
- Press calibration differences
- Paper batch variations

## PagedMD Configuration

### Example manifest.yaml for Lulu US Trade

```yaml
title: My Book Title
authors:
  - Author Name

# Page format for Lulu US Trade (6" x 9")
format:
  size: 6in 9in
  bleed: 0.125in
  margins:
    top: 0.5in
    bottom: 0.5in
    inside: 0.4in # Gutter
    outside: 0.5in

# PDF engine settings
pdf:
  engine: auto
  cropMarks: false

# Styles
styles:
  - themes/book-print.css
```

## Validation Checklist

Before uploading to Lulu:

- [ ] Interior PDF pages are trim size + 0.25" for bleed
- [ ] Cover PDF matches Lulu template dimensions exactly
- [ ] All fonts are embedded
- [ ] All images are 300 DPI or higher
- [ ] No content in bleed area except backgrounds meant to bleed
- [ ] Critical content within 0.5" safety margin
- [ ] Gutter adequate for page count
- [ ] Single-page layout (not spreads)
- [ ] No crop marks or registration marks
- [ ] No password protection
- [ ] Color space is sRGB or CMYK

## Resources

- [Lulu Book Creation Guide (PDF)](https://assets.lulu.com/media/guides/en/lulu-book-creation-guide.pdf)
- [Lulu Publishing Toolkit](https://www.lulu.com/publishing-toolkit)
- [Lulu Knowledge Base](https://help.lulu.com/en/support/home)
- [Lulu Cover Template Generator](https://www.lulu.com/create) (during book creation)
