#!/usr/bin/env bun

/**
 * Simplified CLI for pagedmd
 *
 * Implements build and preview commands using commander.js
 * Directly calls simplified build and preview functions
 */

import { program } from 'commander';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from './build/build.ts';
import { startWatchMode } from './build/watch.ts';
import { startPreviewServer } from './server.ts';
import { createBuildOptions, ensureManifest, validateFormatOption } from './utils/config.ts';
import { fileExists } from './utils/file-utils.ts';
import { BuildError, ConfigError } from './utils/errors.ts';
import { setLogLevel, error as logError } from './utils/logger.ts';
import { DEFAULTS, NETWORK } from './constants.ts';
import { OutputFormat } from './types.ts';

// Get package version
const SOURCE_FOLDER = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(SOURCE_FOLDER, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };

/**
 * Commander option types for type safety
 */
interface BuildCommandOptions {
  output?: string;
  htmlOutput?: string;
  timeout: string;
  verbose: boolean;
  debug: boolean;
  format?: string;
  watch?: boolean;
  force?: boolean;
  profile?: boolean;
}

interface PreviewCommandOptions {
  port: string;
  watch: boolean;
  open: string | boolean;
  verbose: boolean;
  debug: boolean;
}

/**
 * Configure logging level based on verbose flag
 */
function setupLogging(verbose: boolean): void {
  if (verbose) {
    setLogLevel('DEBUG');
  }
}

/**
 * Build command - Generate PDF from markdown
 */
program
  .command('build')
  .description('Generate output from markdown file(s) in specified format (configure custom CSS via manifest.yaml)')
  .argument('[input]', 'Input markdown file or directory (defaults to current directory)')
  .option('-o, --output <path>', 'Output path (file for PDF, directory for HTML)')
  .option('--html-output <path>', 'Save intermediate HTML to specified path (for debugging)')
  .option('--format <format>', 'Output format: html or pdf (default: pdf)', 'pdf')
  .option('--watch', 'Watch for file changes and automatically rebuild', false)
  .option('--force', 'Force overwrite existing output without validation', false)
  .option('--timeout <ms>', 'Timeout for PDF generation in milliseconds', String(DEFAULTS.TIMEOUT))
  .option('--verbose', 'Enable verbose output', false)
  .option('--debug', 'Debug mode (preserve temporary files)', false)
  .option('--profile', 'Enable detailed performance profiling', false)
  .action(async (input: string | undefined, opts: BuildCommandOptions) => {
    await executeBuildProcess(opts, input);
  });

/**
 * Preview command - Start live preview server with file watching
 *
 * Two modes:
 * 1. With input path: pagedmd preview ./my-book
 *    - Immediately starts watching specified directory
 *    - Legacy behavior (backward compatible)
 *
 * 2. Without input path: pagedmd preview
 *    - Starts server with folder selector UI
 *    - No watching until user selects folder through UI
 *    - Prevents watching unwanted directories (test fixtures, etc.)
 */
program
  .command('preview', { isDefault: true })
  .description('Start live preview server with automatic rebuild on file changes (default command)')
  .argument('[input]', 'Input markdown file or directory (optional - if omitted, shows folder selector)')
  .option('--port <number>', 'Port for live-server', String(NETWORK.DEFAULT_PORT))
  .option('--no-watch', 'Disable file watching')
  .option('--open <boolean>', 'Automatically open browser (default: true)', 'true')
  .option('--verbose', 'Enable verbose output', false)
  .option('--debug', 'Debug mode (preserve temporary files)', false)
  .action(async (input: string | undefined, opts: PreviewCommandOptions) => {
    setupLogging(opts.verbose);

    try {
      let inputPath: string | undefined = undefined;

      // Only validate input path if provided
      if (input) {
        inputPath = path.isAbsolute(input) ? input : path.join(process.cwd(), input);

        if (!(await fileExists(inputPath))) {
          throw new ConfigError(`Input path not found: ${inputPath}`);
        }

        // Ensure manifest exists before starting preview (only if input provided)
        await ensureManifest(inputPath);
      } else {
        // No input path - use current working directory
        inputPath = process.cwd();
        await ensureManifest(inputPath);
      }

      // Parse --open boolean flag (supports 'true'/'false' strings)
      const openBrowser = opts.open === 'true' || opts.open === true;

      await startPreviewServer({
        input: inputPath,
        port: parseInt(opts.port, 10),
        noWatch: !opts.watch,
        verbose: opts.verbose,
        openBrowser,
        debug: opts.debug,
      });
    } catch (error) {
      handleError(error, opts.verbose);
    }
  });

/**
 * Version and help
 */
program
  .name('pagedmd')
  .description('CLI tool for converting markdown to print-ready PDFs with TTRPG-specific features')
  .version(packageJson.version ?? '0.0.0')
  .addHelpText(
    'after',
    `
Examples:
  $ pagedmd                                 # Preview current directory (default)
  $ pagedmd preview                         # Preview current directory (explicit)
  $ pagedmd preview ./my-book               # Preview specific directory
  $ pagedmd preview --port 3579             # Preview with custom port
  $ pagedmd build                           # Build from current directory
  $ pagedmd build ./my-book                 # Build from specific directory
  $ pagedmd build chapter.md                # Build single file
  $ pagedmd build --output my-book.pdf      # Custom output path

Custom CSS Configuration:
  Create manifest.yaml in your project directory:

    title: My Book Title
    authors:
      - Author Name
      - Co-Author Name
    styles:
      - styles/custom.css
      - styles/extra.css
`
  );

export async function executeBuildProcess(opts: BuildCommandOptions, input: string | undefined) {
  setupLogging(opts.verbose);

  try {
    // Validate timeout value
    const timeout = parseInt(opts.timeout, 10);
    if (isNaN(timeout)) {
      throw new ConfigError(
        `Invalid timeout value: "${opts.timeout}"`,
        `Timeout must be a valid number (e.g., --timeout 60000 for 60 seconds)`
      );
    }
    if (timeout <= 0) {
      throw new ConfigError(
        `Invalid timeout value: ${timeout}ms`,
        `Timeout must be positive (e.g., --timeout 60000 for 60 seconds)`
      );
    }

    // Validate input path if provided
    if (input) {
      const inputPath = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
      if (!(await fileExists(inputPath))) {
        throw new ConfigError(`Input path not found: ${inputPath}`);
      }
    }

    // Validate output directory if provided
    if (opts.output) {
      const outputPath = path.isAbsolute(opts.output) ? opts.output : path.join(process.cwd(), opts.output);
      const outputDir = path.dirname(outputPath);
      if (!(await fileExists(outputDir))) {
        throw new ConfigError(
          `Output directory does not exist: ${outputDir}`,
          `Create the directory first: mkdir -p "${outputDir}"`
        );
      }
    }

    // Validate format option
    const formatValue = opts.format || 'pdf';
    const validatedFormat = validateFormatOption(formatValue);

    const buildOptions = createBuildOptions(input, {
      output: opts.output,
      htmlOutput: opts.htmlOutput,
      timeout,
      verbose: opts.verbose,
      debug: opts.debug,
    });

    // Add new options
    buildOptions.format = OutputFormat[validatedFormat.toUpperCase() as keyof typeof OutputFormat];
    buildOptions.watch = opts.watch || false;
    buildOptions.force = opts.force || false;
    buildOptions.profile = opts.profile || false;

    const inputPath = buildOptions.input || process.cwd();

    // Ensure manifest exists
    await ensureManifest(inputPath);

    // Handle watch mode vs single build
    if (buildOptions.watch) {
      await startWatchMode(buildOptions);
    } else {
      await build(buildOptions);
    }
  } catch (error) {
    handleError(error, opts.verbose);
  }
}

/**
 * Error handling
 */
function handleError(error: unknown, verbose: boolean): never {
  if (error instanceof BuildError || error instanceof ConfigError) {
    logError(error.message);
  } else if (error instanceof Error) {
    logError(`Unexpected error: ${error.message}`);
    if (verbose) {
      console.error('\nStack trace:', error.stack);
    }
  } else {
    logError('Unknown error:', error);
  }
  process.exit(1);
}

// Parse CLI arguments
program.parse(process.argv);
