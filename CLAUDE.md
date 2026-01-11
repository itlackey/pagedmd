# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pagedmd** is a markdown-to-PDF converter for professional print layout. It converts markdown files to HTML and renders them to PDF using Prince XML typesetter with custom CSS styling for print-ready documents. The preview mode uses Vivliostyle for in-browser rendering.

## Architecture

### Build Pipeline

The build pipeline uses a strategy pattern for different output formats:

1. **Markdown Processing** (`src/markdown/markdown.ts`)
   - Converts markdown to HTML using markdown-it
   - **Runtime Plugin System** (`src/markdown/plugin-loader.ts`):
     - **PluginLoader** class for dynamic plugin loading
     - Supports 4 plugin types: local, package, builtin, remote (future)
     - Plugin priority-based loading order (higher priority = earlier)
     - Automatic CSS collection and injection from plugins
     - Security validation for file paths (no path traversal)
     - Plugin caching for performance
   - **Built-in Plugins**:
     - **Core Directives** (`core/core-directives-plugin.ts`) - @page, @break, @spread, @columns
     - **TTRPG Directives** (`plugins/ttrpg-directives-plugin.ts`) - Stat blocks, dice notation, cross-references
     - **Dimm City Extensions** (`plugins/dimm-city-plugin.ts`) - District badges, roll prompts
   - **Plugin Configuration** (`manifest.yaml` plugins array):
     - String shorthand: `"ttrpg"` or `"./plugins/my-plugin.js"`
     - Object config: `{ path: "...", options: {...}, priority: 200 }`
     - Legacy `extensions` array supported for backward compatibility
   - **CSS Cascade**: default styles → plugin CSS → theme styles → custom user styles
   - Resolves all @import statements and inlines CSS at build time

2. **Format Strategy Pattern** (`src/build/formats/`)
   - **PdfFormatStrategy** (`pdf-format.ts`) - Generates PDF via Prince XML typesetter
   - **HtmlFormatStrategy** (`html-format.ts`) - Outputs standalone HTML
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
  - Serves preview.html with Vivliostyle viewer
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
3. Generates HTML from markdown with Vivliostyle viewer integration
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
- **Vivliostyle Integration** (`src/assets/preview/scripts/interface.js`)
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
bun src/cli.ts build [input] --output [file] --format [pdf|html] --watch

# Preview commands
bun src/cli.ts preview [input] --port [number] --open [boolean] --no-watch
```

### Key Modules

**Core Systems:**
- `src/types.ts` - TypeScript interfaces for all data structures (BuildOptions, FormatStrategy, ResolvedConfig, Manifest, etc.)
- `src/constants.ts` - Application constants (DEFAULT_PORT: 3000, DEBOUNCE: 500, temp directory patterns)
- `src/utils/config.ts` - Configuration loading (`loadManifest`, `validateManifest`)
- `src/utils/file-utils.ts` - Bun-native file operations (fileExists, readFile, writeFile, copyDirectory)
- `src/utils/css-utils.ts` - CSS @import resolution and inlining
- `src/utils/logger.ts` - Logging with levels (debug, info, warn, error)
- `src/utils/errors.ts` - Custom error classes (BuildError, ConfigError, ValidationError)
- `src/utils/path-security.ts` - Path validation and security (`validateStaticPath`, home directory enforcement)

**Plugin System:**
- `src/types/plugin-types.ts` - Plugin type definitions (PluginConfig, LoadedPlugin, PluginMetadata, PluginError)
- `src/markdown/plugin-loader.ts` - PluginLoader class for dynamic plugin loading
- `src/markdown/markdown.ts` - Plugin integration (`loadPluginsFromConfig`, `createMarkdownEngineWithPlugins`)
- `src/schemas/manifest.schema.ts` - Zod schema validation including plugins field

### Assets Directory

`src/assets/` structure:
- `core/` - Base CSS (variables, typography, layout, components, book-reset)
- `themes/` - Theme CSS files (loaded by users via manifest styles array)
- `plugins/` - CSS for markdown extensions
- `fonts/` - Web fonts
- `preview/` - Preview mode assets:
  - `scripts/` - interface.js, preview.js, toast.js
  - `styles/` - interface.css, preview.css
  - `index.html` - Preview UI shell (uses Vivliostyle viewer)

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

## Plugin System Architecture

The plugin system allows runtime extension of markdown-it functionality through a flexible, secure, and performant architecture.

### Plugin Types

Four plugin types are supported:

1. **Local** - JavaScript/TypeScript files relative to project directory
   - Path must be relative (no `../` or absolute paths)
   - Security validated via `validateStaticPath`
   - Dynamic import using `pathToFileURL`
   - Example: `./plugins/my-plugin.js`

2. **Package** - npm packages installed in `node_modules`
   - Resolves from `node_modules/{package-name}`
   - Reads `package.json` for metadata and entry point
   - Supports version constraints (`^1.0.0`, `~2.1.0`)
   - Example: `markdown-it-footnote`

3. **Builtin** - Pre-registered plugins shipped with pagedmd
   - Registered in `PluginLoader` constructor
   - Current built-ins: `ttrpg`, `dimmCity`
   - Loaded from `src/markdown/plugins/`
   - Example: `ttrpg`

4. **Remote** - URL-based plugins (future feature)
   - Currently throws "not yet supported"
   - Will require SRI (Subresource Integrity) hashes
   - Example: `https://example.com/plugin.js`

### Plugin Structure

A plugin must export:

```typescript
// Required: Plugin function matching markdown-it signature
export default function myPlugin(md: MarkdownIt, options?: any): void {
  // Modify md instance
}

// Optional: Plugin metadata
export const metadata = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'What the plugin does',
  author: 'Author Name'
};

// Optional: Plugin CSS (automatically injected)
export const css = `
.my-class { color: blue; }
`;
```

### PluginLoader Class

**Location:** `src/markdown/plugin-loader.ts`

**Key Methods:**
- `loadPlugin(config: PluginConfig): Promise<LoadedPlugin | null>` - Load single plugin
- `loadPlugins(configs: PluginConfig[]): Promise<LoadedPlugin[]>` - Load multiple plugins
- `getBuiltinPlugins(): string[]` - List available built-in plugins
- `clearCache(): void` - Clear plugin cache

**Features:**
- **Caching**: Loaded plugins cached by configuration key (default: enabled)
- **Priority Sorting**: Plugins sorted by priority (higher = earlier) before applying
- **Error Handling**: Strict mode throws, non-strict mode warns and continues
- **Verbose Logging**: Optional detailed logging for debugging
- **Type Detection**: Automatically detects plugin type from configuration

**Configuration Normalization:**
```typescript
// String shorthand
"ttrpg" → { name: "ttrpg", enabled: true, priority: 100 }

// Object with auto-detection
{ path: "./plugin.js" } → { path: "./plugin.js", type: "local", enabled: true, priority: 100 }
```

### Integration into Markdown Pipeline

**File:** `src/markdown/markdown.ts`

**Process Flow:**
1. `processMarkdownFiles()` checks for `config.plugins` or `config.extensions`
2. If `plugins` configured:
   - Call `loadPluginsFromConfig()` to load plugins
   - Call `createMarkdownEngineWithPlugins()` to create MarkdownIt instance
   - Collect CSS from loaded plugins
3. If `extensions` configured (legacy):
   - Convert to plugin configs via `extensionsToPlugins()`
   - Use same plugin loading flow
4. Apply plugins to MarkdownIt in priority order
5. Inject plugin CSS into HTML output (Layer 2, after default styles)

**CSS Cascade with Plugins:**
```
1. Default Styles (optional)
2. Plugin CSS (collected from loaded plugins)
3. Theme Styles (manifest.styles array)
4. Custom CSS (@import resolved)
```

### Security

**Path Validation:**
- All local plugin paths validated via `validateStaticPath()`
- Prevents path traversal (`../`, absolute paths)
- Symlink resolution and validation
- Must be within project directory

**Package Plugin Security:**
- Only loads from `node_modules/`
- Cannot specify arbitrary filesystem paths
- Reads `package.json` to validate structure

**Future Remote Plugin Security:**
- Will require SRI integrity hashes
- HTTPS-only URLs
- Content validation before execution

### Testing

**File:** `src/markdown/plugin-loader.test.ts`

**Coverage:**
- 35 tests covering all plugin types
- Security validation (path traversal, absolute paths)
- Plugin caching behavior
- Priority ordering
- Error handling (strict vs non-strict modes)
- Configuration normalization
- CSS collection
- Metadata extraction

**Example Tests:**
```typescript
// Built-in plugin loading
test('loads ttrpg plugin', async () => {
  const loader = createPluginLoader(TEST_DIR);
  const result = await loader.loadPlugin('ttrpg');
  expect(result?.metadata.name).toBe('ttrpg');
});

// Security validation
test('rejects path traversal attempts', async () => {
  const config = { path: '../../../etc/passwd', type: 'local' };
  await expect(loader.loadPlugin(config)).rejects.toThrow(/outside allowed directory/);
});

// Priority sorting
test('sorts plugins by priority', async () => {
  const configs = [
    { name: 'ttrpg', priority: 100 },
    { name: 'dimmCity', priority: 200 },
  ];
  const results = await loader.loadPlugins(configs);
  expect(results[0].priority).toBe(200); // Higher priority first
});
```

### Examples

**Location:** `examples/plugins/` and `examples/with-custom-plugin/`

**Files:**
- `examples/plugins/callouts-plugin.js` - Full-featured admonition/callout plugin (185 lines)
- `examples/plugins/README.md` - Complete plugin development guide (550 lines)
- `examples/with-custom-plugin/` - Working example project using custom plugin

**Callouts Plugin Features:**
- Custom blockquote syntax: `> [!note] Title`
- 5 callout types: note, tip, warning, danger, info
- Automatic CSS injection with color-coded variants
- Configurable via options (types, className)
- Print-friendly styles

### Backward Compatibility

**Legacy `extensions` Array:**
```yaml
# Old approach (still works)
extensions:
  - ttrpg
  - dimmCity

# New approach (recommended)
plugins:
  - ttrpg
  - dimmCity
```

**Conversion Function:**
```typescript
extensionsToPlugins(['ttrpg', 'dimmCity'])
// Returns:
[
  { name: 'ttrpg', type: 'builtin', enabled: true },
  { name: 'dimmCity', type: 'builtin', enabled: true }
]
```

Both approaches use the same plugin loading pipeline internally.

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
- `src/markdown/plugin-loader.test.ts` - Plugin system (35 tests, all plugin types)

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

**Strategy Pattern**: Used for build formats (PDF, HTML) - allows adding new formats without modifying core build logic

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
   - Iframe containing preview.html with Vivliostyle viewer
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

A comprehensive code index with AST analysis has been created in `.references/`:

- `.references/pagedmd.index.md` - Main index with code structure and documentation links
- `.references/pagedmd_structure.md` - Detailed AST analysis

Use the index for efficient context gathering without loading entire files.
- this project uses CC-BY license
- you have to restart the server to see changes in the src/assets folder