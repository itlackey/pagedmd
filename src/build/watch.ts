/**
 * Watch mode orchestration for build command
 *
 * Monitors file system for changes and triggers rebuilds
 * with 200ms debounce to prevent build storms
 *
 * Error Recovery Features:
 * - Exponential backoff on consecutive failures (1s, 2s, 5s, 10s, 30s)
 * - Transient error detection (EBUSY, ETXTBSY, etc.)
 * - Rebuild queuing during active builds
 * - Automatic recovery after successful build
 * - Graceful shutdown after 5 consecutive failures
 */

import { watch as fsWatch } from 'fs';
import path from 'path';
import { build } from './build.ts';
import { info, error as logError, debug, warn } from '../utils/logger.ts';
import { isDirectory } from '../utils/file-utils.ts';
import { EXTENSIONS, FILENAMES } from '../constants.ts';
import type { BuildOptions, WatchContext, OutputFormat } from '../types.ts';

/** Maximum number of consecutive build failures before stopping watch mode */
const MAX_CONSECUTIVE_FAILURES = 5;

/** Exponential backoff delays for retries (in milliseconds) */
const BACKOFF_DELAYS = [1000, 2000, 5000, 10000, 30000];

/** Error codes that indicate transient filesystem issues */
const TRANSIENT_ERROR_CODES = ['EBUSY', 'ETXTBSY', 'EAGAIN', 'EWOULDBLOCK'];

/**
 * Start watch mode for automatic rebuilds
 *
 * Monitors markdown, CSS, manifest, and asset files for changes
 * Debounces changes with 200ms window to prevent build storms
 * Continues running after build failures
 * Exits gracefully on Ctrl+C
 *
 * @param options Build configuration
 */
export async function startWatchMode(options: BuildOptions): Promise<void> {
  info('Starting watch mode...');

  // Resolve input directory
  const inputPath = options.input || process.cwd();
  const inputDir = (await isDirectory(inputPath)) ? inputPath : path.dirname(inputPath);

  // Resolve output directory/file to exclude from watching
  const outputPath = options.output ? path.resolve(options.output) : null;
  const outputBasename = outputPath ? path.basename(outputPath) : null;

  // Initialize watch context
  const context: WatchContext = {
    watcher: null,
    debounceTimer: null,
    pendingChanges: new Set<string>(),
    format: options.format || ('pdf' as OutputFormat),
    buildOptions: options,
    isBuilding: false,
    lastBuildTime: 0,
    pendingRebuildRequest: false,
    consecutiveFailures: 0,
    lastFailureTime: 0,
  };

  // Perform initial build
  info('Running initial build...');
  await performBuild(context);

  // Setup file watcher
  context.watcher = fsWatch(
    inputDir,
    { persistent: true },
    (eventType, filename) => {
      if (filename && shouldWatch(filename, outputBasename)) {
        const fullPath = path.join(inputDir, filename);
        handleFileChange(context, fullPath, filename);
      }
    }
  );

  // Handle watcher errors
  context.watcher.on('error', (error) => {
    if (options.verbose) {
      debug(`File watch error (non-fatal): ${error.message}`);
    }
  });

  info(`Watching for changes in: ${inputDir}`);
  info('Press Ctrl+C to exit');

  // Setup Ctrl+C handler for graceful shutdown
  process.on('SIGINT', () => {
    info('\nShutting down watch mode...');
    cleanup(context);
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {}); // Never resolves - keeps running until Ctrl+C
}

/**
 * Calculate exponential backoff delay based on failure count
 *
 * Returns delay in milliseconds: 1s, 2s, 5s, 10s, 30s
 */
function getBackoffDelay(consecutiveFailures: number): number {
  const index = Math.min(consecutiveFailures, BACKOFF_DELAYS.length - 1);
  return BACKOFF_DELAYS[index];
}

/**
 * Detect if error is a transient filesystem issue
 *
 * Transient errors are worth retrying immediately with backoff
 * Examples: EBUSY (file busy), ETXTBSY (text file busy)
 */
function isTransientError(error: Error): boolean {
  return TRANSIENT_ERROR_CODES.some(code => error.message.includes(code));
}

/**
 * Determine if file should be watched
 *
 * Watches: markdown, CSS, manifest, and asset files
 * Ignores: temp files, hidden files, node_modules, output files
 */
function shouldWatch(filename: string, outputBasename: string | null): boolean {
  // Ignore hidden files and directories
  if (filename.startsWith('.')) {
    return false;
  }

  // Ignore node_modules
  if (filename.includes('node_modules')) {
    return false;
  }

  // Ignore output directory/file
  if (outputBasename && filename === outputBasename) {
    debug(`Ignoring output file/directory: ${filename}`);
    return false;
  }

  // Ignore index.html (generated output)
  if (filename === 'index.html') {
    return false;
  }

  // Ignore assets directory (output)
  if (filename === 'assets') {
    return false;
  }

  // Watch markdown, CSS, and manifest files
  if (
    filename.endsWith(EXTENSIONS.MARKDOWN) ||
    filename.endsWith(EXTENSIONS.CSS) ||
    filename === FILENAMES.MANIFEST
  ) {
    return true;
  }

  // Watch common asset types (but not in output directory)
  const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2', '.ttf', '.otf'];
  if (assetExtensions.some(ext => filename.endsWith(ext))) {
    return true;
  }

  return false;
}

/**
 * Handle file change event with debouncing
 *
 * Accumulates changes in Set during debounce window
 * Triggers rebuild after 200ms of inactivity
 * Queues rebuild if one is already in progress
 */
function handleFileChange(context: WatchContext, fullPath: string, filename: string): void {
  // Add to pending changes
  context.pendingChanges.add(filename);

  // Clear existing debounce timer
  if (context.debounceTimer) {
    clearTimeout(context.debounceTimer);
  }

  // Set new debounce timer
  context.debounceTimer = setTimeout(async () => {
    const files = Array.from(context.pendingChanges);
    context.pendingChanges.clear();

    if (context.buildOptions.verbose) {
      info(`Files changed: ${files.join(', ')}`);
    } else {
      info(`File changed: ${files[0]}${files.length > 1 ? ` (+${files.length - 1} more)` : ''}`);
    }

    // If a build is already in progress, queue a rebuild for after it completes
    if (context.isBuilding) {
      context.pendingRebuildRequest = true;
      if (context.buildOptions.verbose) {
        debug('Build in progress, queuing rebuild for after completion...');
      }
      return;
    }

    // Trigger rebuild and wait for completion
    await performBuild(context);
  }, 200); // 200ms debounce (matches preview server)
}

/**
 * Perform build with error recovery
 *
 * Implements exponential backoff, transient error detection, and rebuild queuing
 * - On success: resets failure counter, processes queued rebuilds
 * - On failure: increments counter, applies backoff, retries
 * - On max failures: stops watch mode with clear message
 */
async function performBuild(context: WatchContext): Promise<void> {
  // Skip if already building
  if (context.isBuilding) {
    debug('Build already in progress, skipping...');
    return;
  }

  context.isBuilding = true;
  const startTime = Date.now();

  try {
    info('Rebuilding...');
    await build(context.buildOptions);
    context.lastBuildTime = Date.now();
    const duration = Date.now() - startTime;

    // Success - reset failure counter
    if (context.consecutiveFailures > 0) {
      info(`✓ Build complete (${duration}ms) - Recovered from ${context.consecutiveFailures} previous failure(s)`);
      context.consecutiveFailures = 0;
    } else {
      info(`✓ Build complete (${duration}ms)`);
    }

  } catch (error) {
    // Increment failure counter
    context.consecutiveFailures++;
    context.lastFailureTime = Date.now();

    const err = error instanceof Error ? error : new Error(String(error));
    const isTransient = isTransientError(err);

    // Check if we've exceeded max failures
    if (context.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logError(`Build failed ${MAX_CONSECUTIVE_FAILURES} times consecutively. Stopping watch mode.`);
      logError('Fix the errors and restart watch mode with: dc-book build --watch');
      logError(`Last error: ${err.message}`);

      if (context.buildOptions.verbose && err.stack) {
        console.error(err.stack);
      }

      // Cleanup and exit
      cleanup(context);
      process.exit(1);
    }

    // Calculate backoff delay
    const delay = getBackoffDelay(context.consecutiveFailures);
    const delaySeconds = (delay / 1000).toFixed(1);

    // Log appropriate error message
    if (isTransient) {
      warn(`Transient error detected (${err.message}). Retrying in ${delaySeconds}s...`);
    } else {
      logError(`Build failed (attempt ${context.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${err.message}`);
      logError(`Retrying in ${delaySeconds}s...`);
    }

    if (context.buildOptions.verbose && err.stack) {
      console.error(err.stack);
    }

    // Apply backoff delay before allowing next build
    await new Promise(resolve => setTimeout(resolve, delay));

  } finally {
    context.isBuilding = false;

    // Process queued rebuild if one was requested during this build
    if (context.pendingRebuildRequest) {
      context.pendingRebuildRequest = false;
      if (context.buildOptions.verbose) {
        debug('Processing queued rebuild...');
      }
      // Schedule rebuild (don't await to prevent recursion)
      void performBuild(context);
    }
  }
}

/**
 * Clean up watch resources
 *
 * Closes watcher and clears timers
 */
function cleanup(context: WatchContext): void {
  if (context.debounceTimer) {
    clearTimeout(context.debounceTimer);
    context.debounceTimer = null;
  }

  if (context.watcher) {
    try {
      context.watcher.close();
      debug('File watcher closed');
    } catch (error) {
      debug(`Error closing file watcher: ${(error as Error).message}`);
    }
    context.watcher = null;
  }
}
