# Print-on-Demand Presets for PagedMD

This directory contains documentation and example manifest presets for popular print-on-demand (POD) services. These presets ensure your PagedMD output meets the exact specifications required by each printer.

## Supported POD Services

| Service                                         | Description                                       | Documentation                              |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| [DriveThruRPG](#drivethrurpg--lightning-source) | Leading TTRPG marketplace, uses Lightning Source  | [DTRPG Specs](./dtrpg-specifications.md)   |
| [Lulu](#lulu)                                   | Self-publishing platform with global distribution | [Lulu Specs](./lulu-specifications.md)     |
| [Amazon KDP](#amazon-kdp)                       | Amazon's self-publishing platform                 | [KDP Specs](./kdp-specifications.md)       |
| [IngramSpark](#ingramspark)                     | Professional distribution network                 | [Ingram Specs](./ingram-specifications.md) |

## Quick Start

Copy one of the example manifests from the `examples/` subdirectory and customize for your project:

```bash
cp docs/pod-presets/examples/dtrpg-6x9-color.yaml my-book/manifest.yaml
```

## Universal Requirements

All POD services share these common requirements:

### Bleed

- **Standard bleed**: 0.125" (3.175mm) on all sides
- Bleed area is trimmed during binding
- Any content meant to extend to the page edge MUST fill the bleed area

### Safety Margins

- **Minimum safe zone**: 0.25" (6.35mm) from trim edge for critical content
- **Recommended safe zone**: 0.5" (12.7mm) for text and important elements
- Content in the safety margin may be cut off due to trimming variance

### Gutter (Inside Margin)

- **Minimum gutter**: 0.375" (9.5mm) for books under 150 pages
- **Recommended gutter**: 0.5" - 0.875" (12.7mm - 22.2mm) based on page count
- Gutter increases with page count to account for spine curvature

### Image Resolution

- **Minimum**: 300 DPI for all images
- **Maximum**: 600 DPI (higher offers no benefit)
- Images below 300 DPI will appear blurry or pixelated

### Color Space

- **Color interiors**: sRGB or CMYK
- **Black & white interiors**: Grayscale
- Total ink coverage (TAC) should not exceed 270% for CMYK

### PDF Requirements

- PDF/X-1a or PDF 1.4+ recommended
- All fonts embedded or converted to outlines
- No transparency (flatten before export)
- No password protection
- No crop marks or registration marks

## Page Count Requirements

Page counts must be divisible by certain numbers depending on binding:

| Book Size                 | Divisibility Rule |
| ------------------------- | ----------------- |
| 6.14" x 9.21" and smaller | Divisible by 6    |
| 6.69" x 9.61" and larger  | Divisible by 4    |
| All perfect bound         | Divisible by 2    |

Books with non-conforming page counts will have blank pages added at the back.

## Common Trim Sizes

### US Standard Sizes

| Size      | Dimensions    | Common Uses                     |
| --------- | ------------- | ------------------------------- |
| Pocket    | 4.25" x 6.87" | Mass market paperbacks          |
| Digest    | 5.5" x 8.5"   | Trade fiction, novellas         |
| US Trade  | 6" x 9"       | Most common for self-publishing |
| US Letter | 8.5" x 11"    | Manuals, workbooks, RPG books   |

### International Sizes

| Size         | Dimensions                     | Common Uses            |
| ------------ | ------------------------------ | ---------------------- |
| A5           | 5.83" x 8.27" (148mm x 210mm)  | European trade books   |
| A4           | 8.27" x 11.69" (210mm x 297mm) | European manuals, RPGs |
| Royal        | 6.14" x 9.21"                  | UK trade books         |
| Crown Quarto | 7.44" x 9.69"                  | Art books, illustrated |

### TTRPG-Optimized Sizes

| Size         | Dimensions     | Notes                                  |
| ------------ | -------------- | -------------------------------------- |
| Standard RPG | 8.5" x 11"     | Classic D&D format                     |
| Compact RPG  | 6" x 9"        | Easier to carry, popular modern choice |
| Digest RPG   | 5.5" x 8.5"    | Indie RPG standard                     |
| Premium RPG  | 8.25" x 10.75" | Coffee table quality                   |

## Spine Width Calculation

Spine width depends on page count and paper type:

### Formula

```
Spine Width = Page Count × Paper Thickness per Page
```

### Paper Thickness Reference

| Paper Type                  | Thickness per Page |
| --------------------------- | ------------------ |
| 50lb / 74gsm White          | 0.0025" (0.0635mm) |
| 60lb / 90gsm White          | 0.0030" (0.0762mm) |
| 70lb / 104gsm White (Color) | 0.0035" (0.0889mm) |
| 50lb / 74gsm Cream          | 0.0028" (0.0711mm) |
| Groundwood 38lb / 56gsm     | 0.0022" (0.0559mm) |

### Example Calculations

| Page Count | 50lb White | 70lb Color |
| ---------- | ---------- | ---------- |
| 100 pages  | 0.25"      | 0.35"      |
| 200 pages  | 0.50"      | 0.70"      |
| 300 pages  | 0.75"      | 1.05"      |
| 400 pages  | 1.00"      | 1.40"      |

> **Note**: Always use your POD service's spine calculator for exact values, as paper stock varies by printing location.

## Directory Contents

```
docs/pod-presets/
├── README.md                    # This file
├── dtrpg-specifications.md      # DriveThruRPG/Lightning Source specs
├── lulu-specifications.md       # Lulu Press specs
├── kdp-specifications.md        # Amazon KDP specs
├── ingram-specifications.md     # IngramSpark specs
└── examples/
    ├── dtrpg-6x9-color.yaml     # DTRPG 6x9 premium color
    ├── dtrpg-letter-bw.yaml     # DTRPG 8.5x11 black & white
    ├── lulu-ustrade-color.yaml  # Lulu US Trade color
    ├── lulu-a5-bw.yaml          # Lulu A5 black & white
    ├── kdp-6x9-cream.yaml       # KDP 6x9 cream paper
    └── kdp-letter-color.yaml    # KDP 8.5x11 premium color
```

## Using Presets with PagedMD

### Option 1: Copy and Customize

```bash
# Copy a preset as your starting point
cp docs/pod-presets/examples/dtrpg-6x9-color.yaml my-book/manifest.yaml

# Edit to add your book details
```

### Option 2: Reference in Your Manifest (Future Feature)

```yaml
# Future: extend from a preset
extends: dtrpg-6x9-color

title: My TTRPG Sourcebook
authors:
  - Your Name
```

## Validation Checklist

Before submitting to any POD service:

- [ ] PDF page size matches trim size + bleed (e.g., 6.25" x 9.25" for 6" x 9" book)
- [ ] All fonts are embedded
- [ ] Images are 300 DPI minimum
- [ ] No content in bleed area except backgrounds/images meant to bleed
- [ ] Critical content within safety margins
- [ ] Page count meets divisibility requirements
- [ ] Cover dimensions match template (trim + spine + trim + bleed)
- [ ] No security/password protection on PDF
- [ ] No crop marks or registration marks

## Resources

- [DriveThruRPG Partner Knowledge Base](https://help.drivethrurpg.com)
- [Lulu Book Creation Guide](https://assets.lulu.com/media/guides/en/lulu-book-creation-guide.pdf)
- [Amazon KDP Help](https://kdp.amazon.com/help)
- [IngramSpark Resources](https://www.ingramspark.com/resources)
