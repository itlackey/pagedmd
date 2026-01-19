# Amazon Kindle Direct Publishing (KDP) Print Specifications

Amazon KDP offers print-on-demand paperback and hardcover books with distribution through Amazon's global marketplace. This document covers specifications for KDP print books.

## Overview

| Aspect              | Requirement                     |
| ------------------- | ------------------------------- |
| **File Format**     | PDF (preferred) or DOCX         |
| **Color Profile**   | sRGB or CMYK                    |
| **Resolution**      | 300 DPI minimum                 |
| **Bleed**           | 0.125" (3.175mm) if using bleed |
| **No-Bleed Option** | Available (white margins)       |

## Available Trim Sizes

### Standard Trim Sizes (Lower Printing Cost)

| Dimensions (inches) | Dimensions (mm) |
| ------------------- | --------------- |
| 5" x 8"             | 127 x 203       |
| 5.06" x 7.81"       | 129 x 198       |
| 5.25" x 8"          | 133 x 203       |
| 5.5" x 8.5"         | 140 x 216       |
| 6" x 9"             | 152 x 229       |

### Large Trim Sizes (Higher Printing Cost)

| Dimensions (inches) | Dimensions (mm) |
| ------------------- | --------------- |
| 6.14" x 9.21"       | 156 x 234       |
| 6.69" x 9.61"       | 170 x 244       |
| 7" x 10"            | 178 x 254       |
| 7.44" x 9.69"       | 189 x 246       |
| 7.5" x 9.25"        | 191 x 235       |
| 8" x 10"            | 203 x 254       |
| 8.25" x 6"          | 210 x 152       |
| 8.25" x 8.25"       | 210 x 210       |
| 8.5" x 8.5"         | 216 x 216       |
| 8.5" x 11"          | 216 x 279       |
| 8.27" x 11.69" (A4) | 210 x 297       |

### Custom Trim Sizes (Paperback Only)

KDP allows custom sizes within these ranges:

- **Width**: 4" - 8.5" (10.16 - 21.59 cm)
- **Height**: 6" - 11.69" (15.24 - 29.69 cm)

### Hardcover Trim Sizes

| Dimensions (inches) | Dimensions (mm) |
| ------------------- | --------------- |
| 5.5" x 8.5"         | 140 x 216       |
| 6" x 9"             | 152 x 229       |
| 6.14" x 9.21"       | 156 x 234       |
| 7" x 10"            | 178 x 254       |
| 8.25" x 11"         | 210 x 279       |

## Ink and Paper Options

### Paperback Options

| Ink Type       | Paper Type | Paper Weight         | Best For              |
| -------------- | ---------- | -------------------- | --------------------- |
| Black          | White      | 50-61lb (74-90 GSM)  | Text-heavy books      |
| Black          | Cream      | 50-61lb (74-90 GSM)  | Novels, fiction       |
| Standard Color | White      | 50-61lb (74-90 GSM)  | Some illustrations    |
| Premium Color  | White      | 60-71lb (88-105 GSM) | Full-color, art books |

### Hardcover Options

| Ink Type       | Paper Type     | Notes                       |
| -------------- | -------------- | --------------------------- |
| Black          | White or Cream | Available                   |
| Premium Color  | White          | Available                   |
| Standard Color | N/A            | NOT available for hardcover |

## Page Count Limits

### Paperback

| Ink/Paper      | Minimum | Maximum |
| -------------- | ------- | ------- |
| Black + White  | 24      | 828     |
| Black + Cream  | 24      | 776     |
| Standard Color | 72      | 600     |
| Premium Color  | 24      | 828     |

### Hardcover

| Ink/Paper | Minimum | Maximum |
| --------- | ------- | ------- |
| All types | 75      | 550     |

## Cover Options

### Paperback Cover Finishes

- **Glossy**: Shiny, vibrant, typical for textbooks and children's books
- **Matte**: Subtle, professional, typical for fiction

### Hardcover Cover Types

- **Case Laminate**: Printed directly on hardcover boards

## Bleed Settings

### With Bleed

- Add 0.125" (3.175mm) on all sides
- PDF page size = Trim size + 0.25" width and height
- Example: 6" x 9" book = 6.25" x 9.25" PDF pages
- Use when images/colors extend to page edge

### Without Bleed (No-Bleed Option)

- PDF page size = Trim size exactly
- White margin appears at page edges
- Use for text-only books without edge-to-edge content

## Margin Requirements

### Interior Margins

| Element            | Minimum         | Recommended          |
| ------------------ | --------------- | -------------------- |
| Outside margin     | 0.25" (6.35mm)  | 0.5" (12.7mm)        |
| Top/Bottom margins | 0.25" (6.35mm)  | 0.5" (12.7mm)        |
| Gutter (inside)    | See table below | Varies by page count |

### Gutter Requirements by Page Count

| Page Count | Minimum Gutter  | Recommended Gutter |
| ---------- | --------------- | ------------------ |
| 24-150     | 0.375" (9.5mm)  | 0.5" (12.7mm)      |
| 151-300    | 0.5" (12.7mm)   | 0.625" (15.9mm)    |
| 301-500    | 0.625" (15.9mm) | 0.75" (19mm)       |
| 501-700    | 0.75" (19mm)    | 0.875" (22.2mm)    |
| 701+       | 0.875" (22.2mm) | 1" (25.4mm)        |

## Cover Specifications

### Cover PDF Dimensions

For paperback with bleed:

```
Total Width = (2 × Trim Width) + Spine Width + 0.25"
Total Height = Trim Height + 0.25"
```

### Spine Width Calculation

KDP provides a spine calculator. Approximate values:

| Paper Type        | Per-Page Thickness |
| ----------------- | ------------------ |
| White (black ink) | 0.002252"          |
| Cream (black ink) | 0.0025"            |
| White (color)     | 0.002347"          |

**Example**: 200-page book on white paper (black ink)

```
Spine = 200 × 0.002252" = 0.45" (approximately)
```

### Cover Safe Zones

| Area            | Distance from Edge          |
| --------------- | --------------------------- |
| Outer edges     | 0.125" minimum from trim    |
| Spine (if text) | Center text, allow variance |
| Barcode area    | Lower right of back cover   |

### Barcode Placement

- KDP adds ISBN barcode automatically
- Reserve space: approximately 2" x 1.2"
- Location: lower right of back cover
- Keep this area clear of text/images

## PDF Requirements

### Interior PDF

- Format: PDF (PDF/X-1a recommended)
- Page size: Trim + bleed (if using bleed)
- Fonts: All embedded
- Images: 300 DPI minimum
- Color: sRGB or CMYK
- No crop marks
- No password protection

### Cover PDF

- Format: PDF
- Single page spread (back + spine + front)
- Dimensions: From KDP calculator
- Fonts: All embedded
- Images: 300 DPI minimum
- Resolution: At least 300 DPI
- No crop marks

## Color Guidelines

### Color Space

- sRGB preferred for best results
- CMYK accepted
- Don't convert between color spaces after design

### Black Settings

- **Pure Black text**: K:100 (no CMY)
- **Rich Black (large areas)**: C:30 M:30 Y:30 K:100

### Total Ink Coverage

- Maximum TAC: 270%
- Avoid light tints below 20%

## Expanded Distribution

KDP offers expanded distribution to libraries and bookstores with additional requirements:

- Must use KDP-provided ISBN (free) or your own
- Additional margin requirements may apply
- Royalty rates differ from standard Amazon sales

## PagedMD Configuration

### Example manifest.yaml for KDP 6" x 9"

```yaml
title: My Book Title
authors:
  - Author Name

# Page format for KDP 6" x 9" with bleed
format:
  size: 6in 9in
  bleed: 0.125in
  margins:
    top: 0.5in
    bottom: 0.5in
    inside: 0.5in # Gutter for ~200 pages
    outside: 0.5in

# PDF engine settings
pdf:
  engine: auto
  cropMarks: false

# Styles for cream paper (warmer tones)
styles:
  - themes/book-print-cream.css
```

### Example for KDP US Letter Color

```yaml
title: My Color RPG Book
authors:
  - Author Name

# Page format for KDP 8.5" x 11" with premium color
format:
  size: 8.5in 11in
  bleed: 0.125in
  margins:
    top: 0.75in
    bottom: 0.75in
    inside: 0.75in # Larger gutter for RPG books
    outside: 0.5in

pdf:
  engine: auto
  cropMarks: false

styles:
  - themes/ttrpg-print.css
```

## Validation Checklist

Before uploading to KDP:

- [ ] PDF page size matches trim + bleed (if using bleed)
- [ ] Cover PDF matches KDP template dimensions
- [ ] All fonts are embedded
- [ ] All images are 300 DPI or higher
- [ ] Page count within limits for chosen options
- [ ] Gutter adequate for page count
- [ ] Barcode area clear on back cover
- [ ] No crop marks or registration marks
- [ ] No password protection
- [ ] Color space consistent (sRGB preferred)

## Resources

- [KDP Print Options Help](https://kdp.amazon.com/en_US/help/topic/G201834180)
- [Paperback Manuscript Templates](https://kdp.amazon.com/en_US/help/topic/G201834230)
- [Cover Calculator](https://kdp.amazon.com/cover-calculator) (requires KDP account)
- [Printing Cost Calculator](https://kdp.amazon.com/en_US/help/topic/G201834340)
