# IngramSpark Print Specifications

IngramSpark is the professional self-publishing arm of Ingram Content Group, offering print-on-demand with the widest distribution network (40,000+ retailers worldwide). DriveThruRPG also uses Ingram/Lightning Source for fulfillment, so these specs largely overlap.

## Overview

| Aspect            | Requirement                |
| ----------------- | -------------------------- |
| **File Format**   | PDF                        |
| **Color Profile** | CMYK or sRGB               |
| **Resolution**    | 300 DPI minimum            |
| **Bleed**         | 0.125" (3.175mm)           |
| **Distribution**  | 40,000+ retailers globally |

## Available Trim Sizes

### Paperback - White Paper

Custom sizes available within:

- **Width**: 4" - 8.5" (102 - 216 mm)
- **Height**: 6" - 11" (152 - 280 mm)

### Paperback - Cream or Groundwood Paper

Custom sizes available within:

- **Width**: 4" - 6.14" (102 - 156 mm)
- **Height**: 6" - 9.252" (152 - 235 mm)

### Hardcover - White Paper

Custom sizes available within:

- **Width**: 5" - 8.5" (127 - 216 mm)
- **Height**: 8" - 11" (203 - 280 mm)

### Hardcover - Cream or Groundwood Paper

Custom sizes available within:

- **Width**: 5" - 6.14" (127 - 156 mm)
- **Height**: 8" - 9.21" (203 - 234 mm)

### Common Standard Sizes

| Size Name    | Dimensions (inches) | Dimensions (mm) | Category |
| ------------ | ------------------- | --------------- | -------- |
| Mass Market  | 4.25" x 6.87"       | 108 x 175       | Standard |
| Digest       | 5.5" x 8.5"         | 140 x 216       | Standard |
| A5           | 5.83" x 8.27"       | 148 x 210       | Standard |
| US Trade     | 6" x 9"             | 152 x 229       | Standard |
| Royal        | 6.14" x 9.21"       | 156 x 234       | Standard |
| Crown Quarto | 6.69" x 9.61"       | 170 x 244       | Large    |
| Executive    | 7" x 10"            | 178 x 254       | Large    |
| US Letter    | 8.5" x 11"          | 216 x 279       | Large    |

## Paper Options

### Interior Paper Types

| Paper Type     | Weight        | Colors     | Use Case            |
| -------------- | ------------- | ---------- | ------------------- |
| **Groundwood** | 38lb / 56gsm  | N/A        | Economy, newspapers |
| **Cream**      | 50lb / 74gsm  | Black only | Fiction, novels     |
| **White**      | 50lb / 74gsm  | Black only | Non-fiction, text   |
| **White**      | 70lb / 104gsm | Color      | Illustrated books   |

### Color Options

| Option                  | Description          | Paper               | Cost    |
| ----------------------- | -------------------- | ------------------- | ------- |
| **Black & White**       | Grayscale only       | Cream or White 50lb | Lowest  |
| **Standard Color**      | Inkjet color         | White 50lb          | Medium  |
| **Premium Color**       | High-quality inkjet  | White 70lb          | Higher  |
| **Ultra-Premium Color** | Laser-printed, satin | White 70lb          | Highest |

### Cover Paper

- **Weight**: 80lb / 220 GSM
- **Finish**: Glossy or Matte lamination

## Binding Types

### Paperback

| Type          | Description                     |
| ------------- | ------------------------------- |
| Perfect Bound | Standard paperback, glued spine |

### Hardcover

| Type                   | Description                          |
| ---------------------- | ------------------------------------ |
| Case Laminate (Gloss)  | Printed cover glued to boards, shiny |
| Case Laminate (Matte)  | Printed cover glued to boards, soft  |
| Jacketed Case Laminate | Case laminate with dust jacket       |
| Digital Cloth          | Cloth-like texture (US/UK only)      |
| Digital Cloth + Jacket | Cloth cover with dust jacket         |

## Bleed and Margins

### Interior Layout

```
┌──────────────────────────────────────────────────┐
│                   0.125" BLEED                   │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │   ← 0.25" Safety Margin (minimum) →        │  │
│  │                                            │  │
│  │   ┌────────────────────────────────────┐   │  │
│  │   │                                    │   │  │
│  │   │        SAFE CONTENT AREA           │   │  │
│  │   │                                    │   │  │
│  │   │                                    │   │  │
│  │   └────────────────────────────────────┘   │  │
│  │                                            │  │
│  │          ← 0.375"+ Gutter →                │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                    TRIM LINE                     │
└──────────────────────────────────────────────────┘
```

### Margin Requirements

| Element             | Minimum          | Recommended          |
| ------------------- | ---------------- | -------------------- |
| Bleed               | 0.125" (3.175mm) | 0.125"               |
| Safety (outer)      | 0.25" (6.35mm)   | 0.375" (9.5mm)       |
| Safety (top/bottom) | 0.25" (6.35mm)   | 0.375" (9.5mm)       |
| Gutter (inside)     | 0.375" (9.5mm)   | Varies by page count |

### Gutter by Page Count

| Page Count | Minimum Gutter | Recommended |
| ---------- | -------------- | ----------- |
| 1-100      | 0.375"         | 0.5"        |
| 101-200    | 0.5"           | 0.625"      |
| 201-400    | 0.625"         | 0.75"       |
| 401-600    | 0.75"          | 0.875"      |
| 601+       | 0.875"         | 1.0"        |

## Cover Specifications

### Cover Template Generator

IngramSpark provides a cover template generator that calculates exact dimensions based on:

- Trim size
- Page count
- Paper type
- Binding type

### Cover PDF Dimensions

```
Total Width = Back Cover + Spine + Front Cover + (2 × Bleed)
            = Trim Width + Spine + Trim Width + 0.25"

Total Height = Trim Height + (2 × Bleed)
             = Trim Height + 0.25"
```

### Spine Width Calculation

| Paper Type | Thickness per Sheet |
| ---------- | ------------------- |
| 50lb White | 0.002252"           |
| 50lb Cream | 0.002500"           |
| 70lb Color | 0.002347"           |
| Groundwood | 0.00185"            |

**Formula**: Spine Width = Page Count × Thickness per Sheet

**Example**: 300-page book on 50lb white

```
Spine = 300 × 0.002252" = 0.676"
```

### Cover Safe Zones

| Area           | Distance          |
| -------------- | ----------------- |
| Outer edges    | 0.125" from trim  |
| Spine edges    | 0.0625" from fold |
| Barcode area   | Per template      |
| Hardcover wrap | 0.75" additional  |

## PDF Requirements

### Interior PDF

| Requirement  | Specification        |
| ------------ | -------------------- |
| Format       | PDF/X-1a or PDF 1.4+ |
| Page Size    | Trim + Bleed         |
| Fonts        | All embedded         |
| Images       | 300 DPI minimum      |
| Transparency | Flattened            |
| Crop Marks   | None                 |
| Security     | None                 |

### Cover PDF

| Requirement | Specification           |
| ----------- | ----------------------- |
| Format      | PDF                     |
| Size        | From template generator |
| Fonts       | Embedded or outlined    |
| Images      | 300 DPI minimum         |
| Color       | CMYK preferred          |
| Spine Text  | Within safe zone        |

## Color Guidelines

### CMYK Settings

- **Total Ink Coverage**: Maximum 300% (recommended 270%)
- **Rich Black**: C:60 M:40 Y:40 K:100
- **Pure Black Text**: K:100 only
- **Minimum Tint**: 10% (avoid lighter)

### RGB to CMYK Conversion

- Convert before final export for accurate colors
- Use ICC profiles (GRACoL or SWOP)
- Expect some color shift (normal)

### Grayscale for B&W

- Use true grayscale color mode
- Gamma: 2.2

## Page Count Rules

### Minimum/Maximum by Format

| Format          | Minimum | Maximum |
| --------------- | ------- | ------- |
| Paperback (all) | 24      | 800+    |
| Hardcover (all) | 24      | 800+    |

### Divisibility Rules

- **All books**: Page count must be divisible by 2
- **Optimal**: Divisible by 4 or 6 to minimize blank pages

## Print Quality

### Global Print Network

IngramSpark prints at multiple facilities worldwide:

- United States (multiple locations)
- United Kingdom
- Australia
- Germany
- Other locations

### Quality Notes

- Slight color variation between facilities is normal
- Paper stock may vary slightly by location
- Allow 0.125" trim variance

## PagedMD Configuration

### Example manifest.yaml for IngramSpark

```yaml
title: Professional Publishing Guide
authors:
  - Author Name

# Page format for IngramSpark US Trade
format:
  size: 6in 9in
  bleed: 0.125in
  margins:
    top: 0.5in
    bottom: 0.5in
    inside: 0.625in # Good gutter for ~300 pages
    outside: 0.375in

# PDF settings for professional output
pdf:
  engine: prince # Prince for highest quality
  profile: PDF/X-1a # Standard for print
  cropMarks: false

styles:
  - themes/professional-print.css
```

### Example for Large Format Color

```yaml
title: Art and Design Portfolio
authors:
  - Artist Name

# Large format with premium color
format:
  size: 8.5in 11in
  bleed: 0.125in
  margins:
    top: 0.75in
    bottom: 0.75in
    inside: 0.75in
    outside: 0.5in

pdf:
  engine: auto
  cropMarks: false

styles:
  - themes/art-book.css
```

## Validation Checklist

Before uploading to IngramSpark:

- [ ] Interior PDF is trim size + 0.25" (bleed)
- [ ] Cover PDF matches template dimensions exactly
- [ ] All fonts embedded or outlined
- [ ] All images 300 DPI or higher
- [ ] Color images in CMYK or sRGB
- [ ] Total ink coverage under 270%
- [ ] Gutter appropriate for page count
- [ ] No crop marks or registration marks
- [ ] No password protection on PDF
- [ ] Page count is even number
- [ ] Spine text (if any) fits calculated width

## Distribution Options

IngramSpark offers the widest distribution:

| Channel          | Includes                  |
| ---------------- | ------------------------- |
| Amazon           | All Amazon sites globally |
| Barnes & Noble   | Online and stores         |
| Ingram Wholesale | 40,000+ retailers         |
| Libraries        | Baker & Taylor, Overdrive |
| International    | UK, EU, Australia, more   |

### Distribution Requirements

- Professional ISBN (included or your own)
- Retail-ready metadata
- Competitive discount settings
- Returns policy selection

## Resources

- [IngramSpark File Creation Guide](https://www.ingramspark.com/hubfs/downloads/file-creation-guide.pdf)
- [Cover Template Generator](https://myaccount.ingramspark.com/Portal/Tools/CoverTemplateGenerator)
- [Spine Calculator](https://myaccount.ingramspark.com/Portal/Tools/SpineCalculator)
- [Print Cost Calculator](https://myaccount.ingramspark.com/Portal/Tools/ShippingCalculator)
- [IngramSpark Help Center](https://www.ingramspark.com/help)
