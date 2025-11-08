# pagedmd

A powerful CLI tool and live preview UI for creating professional print-ready PDFs from markdown using [Paged.js](https://pagedjs.org). Write your content in markdown and let pagedmd handle the complex CSS Paged Media layout.

## Features

- **Markdown to PDF** - Convert markdown files to professional print layouts
- **Live Preview** - Interactive browser-based preview with Hot Module Replacement
- **Custom Styling** - Full control over typography, layout, and print design with CSS
- **Page Control** - Fine-grained control over page breaks, spreads, and multi-column layouts
- **Extensible** - Plugin system for custom markdown syntax and directives
- **Print-Ready** - Proper bleed, margins, running headers/footers, and page numbering

## Installation

Install globally with npm or Bun:

```bash
# Using npm
npm install -g @dimm-city/pagedmd

# Using Bun
bun install -g @dimm-city/pagedmd
```

Once installed, the `pagedmd` command will be available globally.

## Quick Start

### Build a PDF

```bash
# Build from current directory
pagedmd build

# Build from specific directory
pagedmd build ./my-book

# Build with custom output
pagedmd build --output my-book.pdf

# Watch mode (auto-rebuild on changes)
pagedmd build --watch
```

### Live Preview

```bash
# Start preview server with live reload
pagedmd preview

# Custom port
pagedmd preview --port 5000

# Don't auto-open browser
pagedmd preview --open false
```

The preview UI provides:
- **Page navigation** - Jump to any page, navigate with prev/next
- **View modes** - Single page or two-column (spread) view
- **Zoom controls** - Fit to width or custom zoom levels
- **Debug mode** - Visualize page breaks and layout boxes
- **Folder switching** - Load different projects without restarting

## Configuration

Create a `manifest.yaml` in your project directory:

```yaml
title: My Book Title
authors:
  - Author Name
description: Book description

page:
  size: letter      # or 'a4', '6x9', custom dimensions
  margins:
    top: 0.75in
    bottom: 0.75in
    inside: 0.875in
    outside: 0.625in
  bleed: 0.125in    # for print bleed

styles:
  - themes/my-theme.css
  - custom-styles.css

files:  # Optional - control file order
  - chapter-01.md
  - chapter-02.md
  - chapter-03.md

extensions:  # Enable markdown plugins
  - ttrpg      # Stat blocks, dice notation
  - dimmCity   # Custom game syntax
```

## Markdown Directives

pagedmd extends markdown with special directives for print layout:

### Page Control

```markdown
@page         # Force page break before this line
@break        # Force column break (in multi-column layouts)
@spread       # Force content to start on a right-hand page
@columns 2    # Switch to 2-column layout
@columns 1    # Switch back to single column
```

### Example

```markdown
# Chapter One

This is the first paragraph.

@page

# Chapter Two

This chapter starts on a new page.

@columns 2

This content flows in two columns.

@columns 1

Back to single column.
```

## Styling

### CSS Cascade

Styles are applied in order:

1. **Default Styles** - Base typography and layout (optional)
2. **Theme Styles** - Your custom themes from `manifest.yaml`
3. **CSS @import** - All imports are resolved and inlined

### Disable Default Styles

```yaml
disableDefaultStyles: true
styles:
  - my-complete-theme.css
```

### CSS Paged Media

Use standard CSS Paged Media features:

```css
@page {
  size: 6in 9in;
  margin: 0.75in;
}

@page :left {
  margin-left: 1in;
}

@page :right {
  margin-right: 1in;
}

h1 {
  page-break-before: always;
  page-break-after: avoid;
}
```

## CLI Reference

### Build Command

```bash
pagedmd build [input] [options]
```

**Options:**
- `--output <file>` - Output file path (default: output.pdf)
- `--format <type>` - Output format: `pdf`, `html`, or `preview` (default: pdf)
- `--watch` - Watch for changes and rebuild automatically

**Examples:**

```bash
# Build PDF with custom output
pagedmd build ./book --output book.pdf

# Build standalone HTML
pagedmd build --format html --output book.html

# Build preview bundle (offline Paged.js viewer)
pagedmd build --format preview

# Watch mode
pagedmd build --watch
```

### Preview Command

```bash
pagedmd preview [input] [options]
```

**Options:**
- `--port <number>` - Server port (default: 3000)
- `--open <boolean>` - Auto-open browser (default: true)
- `--no-watch` - Disable file watching

**Examples:**

```bash
# Start preview on default port (3000)
pagedmd preview

# Custom port
pagedmd preview --port 8080

# Don't open browser automatically
pagedmd preview --open false

# Preview without file watching
pagedmd preview --no-watch
```

## Architecture

### Build Pipeline

1. **Markdown Processing** - Converts markdown to HTML with markdown-it
2. **Plugin System** - Extensible directives and custom syntax
3. **CSS Resolution** - Resolves and inlines all @import statements
4. **Format Strategy** - Delegates to PDF, HTML, or Preview output strategy

### Preview Mode

- **Dual-Server Architecture**:
  - Bun server (user port) - Toolbar UI and API endpoints
  - Vite server (auto port) - Preview content with HMR
- **Live Reload** - File changes trigger automatic HTML regeneration
- **Reverse Proxy** - Seamless integration between servers

### Output Formats

- **PDF** - Renders via pagedjs-cli subprocess (Chromium headless)
- **HTML** - Standalone HTML file (requires online Paged.js CDN)
- **Preview** - Self-contained bundle with Paged.js polyfill (offline)

## Project Structure

```
pagedmd/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── build/              # Build orchestration and format strategies
│   ├── markdown/           # Markdown processing and plugins
│   ├── server.ts           # Preview server
│   ├── utils/              # Utilities (config, file ops, CSS)
│   └── assets/
│       ├── core/           # Base CSS
│       ├── themes/         # Bundled themes
│       ├── plugins/        # Plugin CSS
│       └── preview/        # Preview UI assets
├── manifest.yaml           # Project configuration
└── README.md
```

## Development

### Prerequisites

This project uses [Bun](https://bun.com) runtime v1.3.1 or later.

### Setup

```bash
# Clone the repository
git clone https://github.com/dimm-city/pagedmd.git
cd pagedmd

# Install dependencies
bun install

# Run from source
bun src/cli.ts build
bun src/cli.ts preview

# Build the CLI
bun run build

# Run tests
bun test
```

### Contributing

This project uses:
- [Bun](https://bun.com) - Fast all-in-one JavaScript runtime
- [Paged.js](https://pagedjs.org) - CSS Paged Media polyfill
- [markdown-it](https://github.com/markdown-it/markdown-it) - Markdown parser

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [Creative Commons Attribution 4.0 International License (CC BY 4.0)](http://creativecommons.org/licenses/by/4.0/).

You are free to share and adapt this work for any purpose, even commercially, as long as you provide appropriate attribution.
