# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pagedmd** is a thin wrapper around pagedjs-cli that converts markdown to HTML and renders it to PDF. The goal is a simple, personal-use tool for generating print-ready PDFs from markdown with custom CSS styling.

Current state: Stubbed out with code copied from another project (dc-book). Much of this code is for reference and should be simplified or removed.

## Architecture

### Build Pipeline

The core pipeline follows this flow:

1. **Markdown Processing** (`src/markdown/markdown.ts`)
   - Converts markdown files to HTML
   - Supports plugins for extended syntax (TTRPG directives, Dimm City extensions)
   - Handles custom markdown extensions defined in `manifest.yaml`

2. **Format Strategy Pattern** (`src/build/formats/`)
   - `pdf-format.ts` - Generates PDF via pagedjs-cli
   - `html-format.ts` - Outputs standalone HTML
   - `preview-format.ts` - Creates preview-ready HTML with live reload scripts

3. **Build Orchestration** (`src/build/build.ts`)
   - Validates build options
   - Loads manifest configuration
   - Processes markdown to HTML
   - Delegates to format-specific strategies
   - Handles cleanup

4. **Watch Mode** (`src/build/watch.ts`)
   - File system monitoring for auto-rebuild
   - Debounced change detection
   - Prevents overlapping builds

### Preview Mode

Preview mode should:
- Copy `inputDir` and `src/assets` to a temporary directory
- Serve the temporary directory using Vite
- Support hot reload when markdown/CSS/manifest changes
- Use Vite's built-in dev server (no custom WebSocket implementation needed)

**Note**: The current implementation references a preview server (`startPreviewServer`) that doesn't exist yet. This needs to be implemented using Vite.

### Configuration

**Manifest file** (`manifest.yaml`):
- Project metadata (title, authors)
- Custom CSS files via styles array (relative paths)
- Page format (size, margins, bleed)
- Markdown file ordering
- Extension configuration

**CLI Options** (`src/cli.ts`):
- Build command: `bun src/cli.ts build [input] [options]`
- Preview command: `bun src/cli.ts preview [input] [options]`
- Options override manifest settings

**Configuration precedence**: CLI > Manifest > Defaults

### Key Modules

- `src/types.ts` - TypeScript interfaces for all data structures
- `src/constants.ts` - Application-wide constants (timeouts, ports, defaults)
- `src/utils/config.ts` - Configuration loading and validation
- `src/utils/file-utils.ts` - File system operations (Bun-native preferred)
- `src/utils/logger.ts` - Logging utilities
- `src/utils/errors.ts` - Custom error classes

### Assets Directory

`src/assets/` contains:
- `themes/` - CSS themes for different book styles
- `fonts/` - Web fonts
- `core/` - Base CSS for Paged.js
- `plugins/` - CSS for markdown extensions
- `scripts/` - Client-side JavaScript
- Preview-related assets (`preview.js`, `preview.css`)

These assets are bundled with generated HTML for self-contained output.

## Common Commands

```bash
# Install dependencies
bun install

# Build PDF from current directory
bun src/cli.ts build

# Build from specific file/directory
bun src/cli.ts build ./my-book

# Build with custom output
bun src/cli.ts build --output my-book.pdf

# Build HTML instead of PDF
bun src/cli.ts build --format html

# Watch mode (auto-rebuild on changes)
bun src/cli.ts build --watch

# Preview mode (not yet implemented)
bun src/cli.ts preview

# Run tests
bun test

# Run specific test file
bun test src/utils/file-utils.test.ts
```

## Development Notes

### Simplification Goals

This project should be streamlined:

1. **Remove enterprise complexity** - No need for extensive validation, sophisticated error handling, or complex abstractions
2. **Simplify preview mode** - Use Vite's built-in dev server instead of custom WebSocket implementations
3. **Remove unused code** - Many utilities and abstractions from dc-book may not be needed
4. **Focus on core workflow**: markdown → HTML → PDF, with preview and watch modes

### Preview Mode Implementation

The preview mode should be implemented as:

```typescript
// Pseudocode for preview mode
async function preview(inputDir: string, port: number) {
  const tempDir = createTempDir();

  // Copy input files and assets
  copyDir(inputDir, tempDir);
  copyDir('src/assets', path.join(tempDir, 'assets'));

  // Generate initial HTML
  const html = await generateHtmlFromMarkdown(inputDir, config);
  writeFile(path.join(tempDir, 'index.html'), html);

  // Start Vite dev server
  const server = await vite.createServer({
    root: tempDir,
    server: { port }
  });

  await server.listen();

  // Watch for changes and regenerate HTML
  watchFiles(inputDir, async () => {
    const html = await generateHtmlFromMarkdown(inputDir, config);
    writeFile(path.join(tempDir, 'index.html'), html);
    // Vite handles hot reload automatically
  });
}
```

### Testing

Tests use Bun's built-in test runner:

```typescript
import { test, expect } from "bun:test";

test("description", () => {
  expect(value).toBe(expected);
});
```

Existing tests in:
- `src/utils/file-utils.test.ts`
- `src/utils/css-utils.test.ts`
- `src/utils/manifest-writer.test.ts`

### Missing Components

Currently referenced but not implemented:
- Preview server (`startPreviewServer` function)
- ConfigurationManager class (referenced in build.ts but doesn't exist)
- Some utility functions may be referenced but not yet created

These should be implemented or the code should be refactored to remove dependencies on them.
