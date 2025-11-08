# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pagedmd** is a markdown-to-PDF converter using Paged.js for professional print layout. It converts markdown files to HTML and renders them to PDF with custom CSS styling for print-ready documents.

## Architecture

### Build Pipeline

The build pipeline uses a strategy pattern for different output formats:

1. **Markdown Processing** (`src/markdown/markdown.ts`)
   - Converts markdown to HTML using markdown-it
   - Supports extensible plugin system:
     - **Core Directives** (`core/core-directives-plugin.ts`) - Auto-rules and directives (@page, @break, @spread, @columns)
     - **TTRPG Directives** (`plugins/ttrpg-directives-plugin.ts`) - Stat blocks, dice notation, cross-references
     - **Dimm City Extensions** (`plugins/dimm-city-plugin.ts`) - District badges, roll prompts
   - Extension configuration via `manifest.yaml` extensions array
   - CSS cascade: default styles → themes → custom user styles
   - Resolves all @import statements and inlines CSS at build time

2. **Format Strategy Pattern** (`src/build/formats/`)
   - **PdfFormatStrategy** (`pdf-format.ts`) - Generates PDF via pagedjs-cli subprocess
   - **HtmlFormatStrategy** (`html-format.ts`) - Outputs standalone HTML
   - **PreviewFormatStrategy** (`preview-format.ts`) - Injects Paged.js polyfill for offline viewing
   - Each strategy implements `FormatStrategy` interface with `build()` and `validateOutput()` methods

3. **Build Orchestration** (`src/build/build.ts`)
   - Loads configuration from manifest.yaml and CLI options
   - Processes markdown files to HTML
   - Delegates to appropriate format strategy
   - Handles asset copying and cleanup

4. **Watch Mode** (`src/build/watch.ts`)
   - File system monitoring using chokidar
   - Debounced change detection (500ms default)
   - Prevents overlapping builds with async lock

### Preview Mode

**Dual-Server Architecture** (`src/server.ts`):
- **Bun Server** (user-specified port) - Main entry point
  - Serves toolbar UI (index.html) at root
  - Hosts API endpoints for directory operations
  - Reverse proxies preview content and HMR to Vite
  - Static file serving with security validation
- **Vite Server** (auto-assigned port) - Development server
  - Serves preview.html with Paged.js polyfill
  - Provides Hot Module Replacement (HMR) for instant updates
  - Handles asset bundling and transformations

**Request Flow**:
```
User Browser → http://localhost:{port}
                ├─→ GET / → index.html (toolbar UI)
                ├─→ GET /api/directories → handleListDirectories()
                ├─→ POST /api/change-folder → handleChangeFolder() → restartPreview()
                ├─→ GET /preview/* → reverse proxy → Vite (auto port)
                └─→ GET /@* (HMR) → reverse proxy → Vite

Vite Server (auto port) → Serves preview.html + assets with HMR
```

**Preview Workflow**:
1. Creates temporary directory (`/tmp/pagedmd-preview-*`)
2. Copies input files and assets to temp directory
3. Generates HTML from markdown with Paged.js polyfill injected
4. Starts Vite server on auto-assigned port
5. Starts Bun server on user-specified port with reverse proxy
6. Watches source files for changes and regenerates HTML automatically
7. Folder switching restarts preview with new directory content

**Client Architecture**:
- **Toolbar UI** (`src/assets/preview/scripts/preview.js`)
  - Folder selection modal with directory navigation
  - Page navigation controls (first, prev, next, last)
  - View mode toggles (single page, two-column)
  - Zoom controls and debug mode toggle
- **Iframe Integration**
  - preview.html loaded in iframe with previewAPI exposed
  - Parent window delegates operations to iframe API
  - Event-driven page change notifications
- **Paged.js Integration** (`src/assets/preview/scripts/interface.js`)
  - Custom handler exposes window.previewAPI
  - Supports page navigation, view modes, zoom levels, debug mode

**API Endpoints**:
- `GET /api/directories?path={path}` - List subdirectories at path (restricted to home directory)
- `POST /api/change-folder` - Switch preview to different directory (triggers restart)

**Security**:
- Path validation prevents directory traversal attacks (`src/utils/path-security.ts`)
- Home directory boundary enforcement
- Static file serving with comprehensive security checks
- URL decoding, Unicode normalization, symlink resolution

### Configuration System

**Manifest file** (`manifest.yaml`):
- Project metadata (title, authors, description)
- Page format configuration (size, margins, bleed)
- Styles array - relative paths to CSS files (resolved from bundled themes/ or user directory)
- Files array - explicit markdown file ordering (optional, defaults to alphabetical)
- Extensions array - enable/disable markdown plugins (ttrpg, dimmCity, containers)
- Default styles toggle (`disableDefaultStyles: true` to replace foundation CSS)

**Configuration Resolution** (`src/config/config-state.ts`):
- `ConfigurationManager` class manages config state
- Precedence: CLI options > manifest.yaml > defaults
- Resolves paths relative to input directory
- Validates required fields and path existence

**CLI** (`src/cli.ts`):
```bash
# Build commands
bun src/cli.ts build [input] --output [file] --format [pdf|html|preview] --watch

# Preview commands
bun src/cli.ts preview [input] --port [number] --open [boolean] --no-watch
```

### Key Modules

- `src/types.ts` - TypeScript interfaces for all data structures (BuildOptions, FormatStrategy, ResolvedConfig, etc.)
- `src/constants.ts` - Application constants (DEFAULT_PORT: 3000, DEBOUNCE: 500, temp directory patterns)
- `src/utils/config.ts` - Configuration loading (`loadManifest`, `validateManifest`)
- `src/utils/file-utils.ts` - Bun-native file operations (fileExists, readFile, writeFile, copyDirectory)
- `src/utils/css-utils.ts` - CSS @import resolution and inlining
- `src/utils/logger.ts` - Logging with levels (debug, info, warn, error)
- `src/utils/errors.ts` - Custom error classes (BuildError, ConfigError, ValidationError)

### Assets Directory

`src/assets/` structure:
- `core/` - Base CSS (variables, typography, layout, components, book-reset)
- `themes/` - Theme CSS files (loaded by users via manifest styles array)
- `plugins/` - CSS for markdown extensions
- `fonts/` - Web fonts
- `preview/` - Preview mode assets:
  - `scripts/` - paged.polyfill.js, interface.js, preview.js, toast.js
  - `styles/` - interface.css, preview.css
  - `index.html` - Preview UI shell

Assets are bundled into HTML using Bun's text loader (`with { type: 'text' }`) for self-contained output.

## Common Commands

```bash
# Install dependencies
bun install

# Build PDF from current directory
bun src/cli.ts build

# Build from specific directory/file
bun src/cli.ts build ./examples/my-book

# Build with custom output
bun src/cli.ts build --output my-book.pdf

# Build HTML instead of PDF
bun src/cli.ts build --format html

# Build preview (offline Paged.js viewer)
bun src/cli.ts build --format preview

# Watch mode (auto-rebuild on changes)
bun src/cli.ts build --watch

# Preview mode (live dev server with HMR)
bun src/cli.ts preview

# Preview with custom port
bun src/cli.ts preview --port 5000

# Preview without auto-opening browser
bun src/cli.ts preview --open false

# Preview without file watching
bun src/cli.ts preview --no-watch

# Run all tests
bun test

# Run specific test file
bun test src/utils/file-utils.test.ts

# Run tests in watch mode
bun test --watch
```

## Development Workflow

### Testing

Tests use Bun's built-in test runner:

```typescript
import { test, expect } from "bun:test";

test("description", () => {
  expect(value).toBe(expected);
});
```

Existing tests in:
- `src/utils/file-utils.test.ts` - File system operations
- `src/utils/css-utils.test.ts` - CSS import resolution
- `src/utils/manifest-writer.test.ts` - Manifest generation

### Adding New Markdown Extensions

To add a new markdown-it plugin:

1. Create plugin file in `src/markdown/plugins/`
2. Export default function that accepts `(md: MarkdownIt, options?: PluginOptions) => void`
3. Register plugin in `createPagedMarkdownEngine()` in `src/markdown/markdown.ts`
4. Add corresponding CSS to `src/assets/plugins/` if needed
5. Update `MarkdownExtensionOptions` interface in types.ts
6. Add extension name to manifest.yaml extensions array

### Adding New Build Formats

To add a new output format:

1. Create strategy class in `src/build/formats/` implementing `FormatStrategy` interface
2. Implement `build(options, htmlContent)` and `validateOutput(outputPath)` methods
3. Add format to `OutputFormat` type in types.ts
4. Register strategy in `src/build/build.ts` format strategy map
5. Update CLI format option in `src/cli.ts`

### Code Structure Patterns

**Strategy Pattern**: Used for build formats (PDF, HTML, Preview) - allows adding new formats without modifying core build logic

**Configuration Cascade**: CLI > Manifest > Defaults - consistent override pattern throughout codebase

**Bun-Native APIs**: Prefer Bun's built-in functions (Bun.file(), Bun.write()) over Node.js equivalents for performance

**Error Handling**: Use custom error classes (BuildError, ConfigError) for domain-specific errors with context

**Asset Bundling**: Use Bun's `import ... with { type: 'text' }` to inline assets at build time for self-contained output

## Important Implementation Details

### CSS Resolution Order

The CSS cascade is critical for allowing theme customization:

1. **Default Styles** (optional, controlled by `disableDefaultStyles`)
   - Foundation: variables, typography, layout, components
   - Bundled at build time via Bun text loader

2. **User Styles** (from manifest.yaml styles array)
   - Two-tier resolution:
     - First checks bundled `src/assets/themes/` and `src/assets/plugins/`
     - Falls back to user directory (relative to input)
   - All @import statements are recursively resolved and inlined
   - Build mode fails on missing imports, preview mode warns

### Preview Mode Architecture

Preview mode uses a dual-process architecture:

1. **Server Process** (`src/server.ts`):
   - Vite dev server serving temporary directory
   - Chokidar file watcher monitoring source files
   - Regenerates HTML on source changes
   - Vite handles browser HMR automatically

2. **Browser Client** (`src/assets/preview/scripts/`):
   - Parent window with toolbar UI (preview.js)
   - Iframe containing preview.html with Paged.js
   - previewAPI exposed on iframe window for page navigation
   - Event-driven updates (pageChanged, renderingComplete)
   - No state duplication - iframe is source of truth

### Manifest Extensions System

The `extensions` array in manifest.yaml controls which markdown plugins are enabled:

- `ttrpg`: Enables TTRPG directives (stat blocks, dice notation, cross-references)
- `dimmCity`: Enables Dimm City syntax (district badges, roll prompts)
- `containers`: Enables legacy container syntax (:::page, :::ability, etc.)

Empty or omitted extensions array enables all plugins by default.

## Code Index

A comprehensive code index with AST analysis and Paged.js documentation has been created in `.references/`:

- `.references/pagedmd.index.md` - Main index with code structure and documentation links
- `.references/pagedmd_structure.md` - Detailed AST analysis
- `.references/external-docs/` - Scraped Paged.js documentation

Use the index for efficient context gathering without loading entire files.
- this project uses CC-BY license