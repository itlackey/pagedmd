import MarkdownIt, { type Options } from "markdown-it";
import attrs from "markdown-it-attrs";
import anchors from "markdown-it-anchor";
import container from "markdown-it-container";
import { imgSize } from "@mdit/plugin-img-size";
import dimmCityPlugin from "./plugins/dimm-city-plugin.ts";
import ttrpgDirectivesPlugin from "./plugins/ttrpg-directives-plugin.ts";
import coreDirectivesPlugin from "./core/core-directives-plugin.ts";
import { BuildError, ConfigError } from "../utils/errors.ts";
import path from "path";
import {
  readFile,
  fileExists,
  isDirectory,
  readDirectory,
} from "../utils/file-utils.ts";
import { debug, info, warn } from "../utils/logger.ts";
import { type ResolvedConfig } from "../config/config-state.ts";
import { resolveImports } from "../utils/css-utils.ts";
import { defaultStyles } from "./core/assets.ts";
import { loadManifest } from "../utils/config.ts";

/**
 * Extension configuration options for markdown engine
 */
export interface MarkdownExtensionOptions {
  /** Enable TTRPG directives plugin (auto-rules, directives, callouts). Defaults to true. */
  ttrpg?: boolean;
  /** Enable Dimm City inline syntax (stat blocks, dice, badges, etc.). Defaults to true. */
  dimmCity?: boolean;
  /** Enable legacy container syntax (::::: page, ::: ability, etc.). Defaults to true for backward compatibility. */
  containers?: boolean;
}

/**
 * Convert manifest.extensions array to MarkdownExtensionOptions
 */
export function parseExtensionOptions(
  extensions?: string[],
): MarkdownExtensionOptions {
  if (!extensions || extensions.length === 0) {
    // Default: all extensions enabled
    return { ttrpg: false, dimmCity: false, containers: true };
  }

  const extensionSet = new Set(extensions.map((ext) => ext.toLowerCase()));
  return {
    ttrpg: extensionSet.has("ttrpg"),
    dimmCity: extensionSet.has("dimm-city"),
    containers: true, // extensionSet.has('containers'),
  };
}

/**
 * Create configured MarkdownIt instance for Dimm City TTRPG content
 *
 * This engine includes:
 * - Standard markdown features (attrs, anchors, img-size)
 * - Dimm City inline syntax extensions (stat blocks, dice, badges, etc.)
 * - TTRPG directives system (auto-rules, directives, callouts)
 *
 * Extensions can be selectively enabled/disabled via the extensions parameter.
 * By default, all extensions are enabled.
 *
 * @param extensions - Optional configuration to enable/disable specific extensions
 */
export function createPagedMarkdownEngine(
  extensions?: MarkdownExtensionOptions,
): MarkdownIt {
  // Default: all extensions enabled
  const enableTtrpg = extensions?.ttrpg !== false;
  const enableDimmCity = extensions?.dimmCity !== false;
  const enableContainers = extensions?.containers !== false;
  const options: Options = {
    html: true,
  };

  let markdownLib = new MarkdownIt(options)
    .use(imgSize)
    .use(anchors)
    .use(coreDirectivesPlugin);

  // Legacy container syntax (optional)
  if (enableContainers || enableDimmCity || enableTtrpg) {
    markdownLib
      .use(container, "page") //Deprecated, use @page directive instead
      .use(container, "wrapper")
      .use(container, "container"); // Supports adhoc containers ::: ability, ::: note, etc.
  }

  // Dimm City custom markdown extensions (optional)
  // Enable all 8 TTRPG-specific extensions for inline syntax
  if (enableDimmCity) {
    markdownLib.use(dimmCityPlugin, {
      districtBadges: true, // #TechD, #Dark badges
    });
  }

  // TTRPG Directives Plugin (optional)
  // Auto-rules for H1 chapter starts and HR page breaks
  // Directives: @page, @break, @spread, @columns
  // Callouts: > [!note], > [!tip], > [!warning], etc.
  if (enableTtrpg) {
    markdownLib.use(ttrpgDirectivesPlugin, {
      statBlocks: true, // {HP:12 DMG:3} syntax
      diceNotation: true, // 2d6+3 auto-styling
      crossReferences: true, // @[NPC:investigator] syntax
      traitCallouts: true, // ::trait[Shadow Step] syntax
      challengeRatings: true, // CR:4 notation
      rollPrompts: true, // ROLL A DIE! auto-styling
      terminology: true, // Auto-styling for game terms
    });
  }

  // Attributes plugin MUST run after inline plugins to avoid consuming
  // stat block syntax {HP:25} as attributes. This plugin is registered last.
  markdownLib.use(attrs);

  return markdownLib;
}

// Single global MarkdownIt instance with all plugins loaded
// We use enable/disable API to toggle rules on each render
let globalMarkdownEngine: MarkdownIt | null = null;

/**
 * Get or initialize the global MarkdownIt instance
 * Instance is created once with ALL plugins enabled
 */
function getGlobalMarkdownEngine(): MarkdownIt {
  if (!globalMarkdownEngine) {
    // Create with ALL extensions enabled
    globalMarkdownEngine = createPagedMarkdownEngine({
      ttrpg: true,
      dimmCity: true,
      containers: true,
    });
  }
  return globalMarkdownEngine;
}

/**
 * Configure markdown engine rules based on extension options
 * Uses enable/disable API to toggle rules without recreating the parser
 */
function configureMarkdownRules(
  md: MarkdownIt,
  extensions?: MarkdownExtensionOptions,
): void {
  const enableTtrpg = extensions?.ttrpg !== false;
  const enableDimmCity = extensions?.dimmCity !== false;

  // TTRPG rules (from ttrpg-directives-plugin)
  const ttrpgRules = [
    "stat_block",
    "dice_notation",
    "cross_reference",
    "trait_callout",
    "challenge_rating",
  ];

  // Dimm City rules (from dimm-city-plugin)
  const dimmCityRules = ["district_badge", "roll_prompt"];

  // Enable/disable rules based on extension config
  if (enableTtrpg) {
    md.enable(ttrpgRules, true); // ignoreInvalid=true for safety
  } else {
    md.disable(ttrpgRules, true);
  }

  if (enableDimmCity) {
    md.enable(dimmCityRules, true);
  } else {
    md.disable(dimmCityRules, true);
  }
}

/**
 * Process markdown files from input directory
 * Reads all .md files and converts them to HTML articles
 *
 * @param inputPath - Input file or directory path
 * @param config - Resolved configuration object
 */
export async function processMarkdownFiles(
  inputPath: string,
  config: ResolvedConfig,
): Promise<Array<{ slug: string; html: string }>> {
  // Get global markdown engine (created once, reused forever)
  const md = getGlobalMarkdownEngine();

  // Configure rules based on manifest extensions using enable/disable API
  const extensionOptions = parseExtensionOptions(config.extensions);
  configureMarkdownRules(md, extensionOptions);

  if (config.extensions && config.extensions.length > 0) {
    debug(`Extensions enabled: ${config.extensions.join(", ")}`);
  }

  const content: Array<{ slug: string; html: string }> = [];

  // Check if input is a directory
  if (await isDirectory(inputPath)) {
    let markdownFiles: Array<{ name: string; path: string }> = [];

    if (config.files && config.files.length > 0) {
      // Use manifest file ordering
      debug(`Using manifest.files ordering (${config.files.length} files)`);
      markdownFiles = config.files.map((file) => ({
        name: path.basename(file),
        path: path.join(inputPath, file),
      }));

      // Verify all files exist
      for (const file of markdownFiles) {
        if (!(await fileExists(file.path))) {
          throw new BuildError(`File not found: ${file.path}`);
        }
      }
    } else {
      // Process all markdown files in alphabetical order (default behavior)
      const files = await readDirectory(inputPath);
      markdownFiles = files
        .filter((file) => file.isFile() && file.name.endsWith(".md"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((file) => ({
          name: file.name,
          path: path.join(inputPath, file.name),
        }));
    }

    for (const file of markdownFiles) {
      const markdownContent = await readFile(file.path);
      const slug = file.name.replace(".md", "");

      try {
        const html = md.render(markdownContent);
        content.push({ slug, html });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BuildError(
          `Failed to process markdown file ${file.path}: ${message}`,
        );
      }
    }
  } else {
    // Process single markdown file
    const markdownContent = await readFile(inputPath);
    const slug = path.basename(inputPath, ".md");

    try {
      const html = md.render(markdownContent);
      content.push({ slug, html });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BuildError(
        `Failed to process markdown file ${inputPath}: ${message}`,
      );
    }
  }

  return content;
}

export async function generateHtmlFromMarkdown(
  inputPath: string,
  config: ResolvedConfig,
  options?: { includePreviewAssets?: boolean },
) {
  // Load manifest from input directory
  info(`Generating HTML from markdown in: ${inputPath}`);
  const manifest = await loadManifest(inputPath);
  config = { ...config, ...manifest };
  const content = await processMarkdownFiles(inputPath, config);

  if (content.length === 0) {
    throw new BuildError("No markdown files found in input path");
  }

  info(`Processed ${content.length} markdown file(s)`);

  // STAGE 6: Create HTML with concatenated articles
  const htmlBody = content
    .map((c) => `<article id="${c.slug}">${c.html}</article>`)
    .join("\n");

  // STAGE 7: Build head content with CSS cascade
  /**
   * CSS Cascade Order (Specificity: Later rules override earlier ones)
   *
   * The CSS is loaded in a carefully designed cascade that allows designers
   * to progressively override defaults at each level:
   *
   * 1. DEFAULT STYLES (inlined) - Foundation layer
   *    - augmented-ui.min.css - UI framework
   *    - ttrpg-components.css - Callouts, stat blocks, profiles
   *    - layouts.css - Layout utilities
   *
   * 2. CUSTOM CSS (linked) - Designer overrides
   *    - Paths from manifest.styles array (relative to input directory)
   *    - Includes theme CSS files (e.g., themes/classic.css, themes/modern.css)
   *    - Final authority - can override any default styling
   *    - Linked (not inlined) to preserve @import and local development workflow
   *    - Examples: custom @page sizes, brand colors, layout adjustments
   *
   * Advanced: Designers can set manifest.disableDefaultStyles: true to completely
   * replace the foundation layer (requires providing all necessary CSS).
   */
  let headContent = `<meta charset="UTF-8">\n    `;

  // Layer 1: Default styles (inlined at build time by Bun)
  // This includes TTRPG foundation CSS (variables, resets, components, utilities)
  if (!config.disableDefaultStyles) {
    headContent += `<style>\n${defaultStyles}\n    </style>`;
  }

  // Layer 2: Theme styles, migrated to styles
  // Layer 3: Custom CSS from manifest (inlined with resolved @imports)
  // Two-tier resolution: bundled styles (themes/, plugins/) -> user custom styles
  // This matches preview mode behavior - all @imports are resolved and inlined
  if (config.styles && config.styles.length > 0) {
    const inputDir = (await isDirectory(inputPath))
      ? inputPath
      : path.dirname(inputPath);

    // Get bundled assets directory
    // When running from dist/cli.js: assets are in dist/assets/
    // When running from src/: assets are in src/assets/
    const { existsSync } = await import("fs");
    const thisFileDir = import.meta.dir;
    const assetsInSameDir = path.join(thisFileDir, "assets");
    const assetsInParent = path.join(thisFileDir, "../assets");
    const bundledStylesDir = existsSync(assetsInSameDir)
      ? assetsInSameDir
      : assetsInParent;

    for (const styleFile of config.styles) {
      let resolvedPath: string | null = null;
      let cssContent: string | null = null;

      // Tier 1: Check bundled styles directory (themes/, plugins/)
      const bundledPath = path.join(bundledStylesDir, styleFile);
      if (await fileExists(bundledPath)) {
        resolvedPath = bundledPath;
        cssContent = await readFile(bundledPath);
      }

      // Tier 2: Check input directory (user custom styles)
      if (!resolvedPath) {
        const userPath = path.join(inputDir, styleFile);
        if (await fileExists(userPath)) {
          resolvedPath = userPath;
          cssContent = await readFile(userPath);
        }
      }

      if (resolvedPath && cssContent) {
        // Resolve @import statements recursively (matches preview mode)
        const result = await resolveImports(cssContent, resolvedPath, {
          failOnMissing: true, // Build mode should fail on missing imports
        });

        // Log warnings (non-critical issues)
        for (const warning of result.warnings) {
          warn(`CSS import warning in ${styleFile}: ${warning}`);
        }

        // Throw on errors (critical issues like circular imports or missing files)
        if (result.errors.length > 0) {
          const errorList = result.errors.map((e) => `  - ${e}`).join("\n");
          throw new ConfigError(
            `Failed to resolve CSS imports in ${styleFile}:\n${errorList}`,
            "Check that all imported CSS files exist and there are no circular imports",
          );
        }

        headContent += `\n    <style>\n/* Custom CSS: ${styleFile} */\n${result.resolvedCSS}\n    </style>`;
        debug(`Custom CSS inlined: ${styleFile}`);
      } else {
        warn(`Custom CSS file not found: ${styleFile}`);
      }
    }
  }

  // Add metadata from config
  const title = config.title;
  const authors = config.authors;
  const metadata = config.metadata;

  if (title) {
    headContent += `\n    <title>${title}</title>`;
  }
  if (authors && authors.length > 0) {
    // Format authors for meta tag (comma-separated)
    const authorsString = authors.join(", ");
    headContent += `\n    <meta name="author" content="${authorsString}">`;
  }

  // Add additional metadata from manifest.metadata
  if (metadata) {
    if (metadata.author) {
      // Note: metadata.author can differ from authors list
      // If both exist, metadata.author takes precedence for <meta> tag
      headContent += `\n    <meta name="author" content="${metadata.author}">`;
    }
    if (metadata.date) {
      headContent += `\n    <meta name="date" content="${metadata.date}">`;
    }
    if (metadata.isbn) {
      headContent += `\n    <meta name="isbn" content="${metadata.isbn}">`;
    }
  }

  // Add preview assets if requested (for preview mode only)
  if (options?.includePreviewAssets) {
    headContent += `\n    <link rel="stylesheet" href="/interface.css">`;
    headContent += `\n    <script src="/paged.polyfill.js"></script>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
    ${headContent}
</head>
<body>
    ${htmlBody}
</body>
</html>`;
  return html;
}
