/**
 * File watcher setup and management for preview server
 *
 * Handles watching input files and triggering rebuilds on changes
 */

import { watch, type FSWatcher } from 'chokidar';
import path from 'path';
import { mkdir } from '../utils/file-utils.ts';
import { info, debug, error as logError } from '../utils/logger.ts';
import { DEBOUNCE } from '../constants.ts';
import { generateHtmlFromMarkdown } from '../markdown/markdown.ts';
import type { ServerState } from './server-context.ts';

/**
 * Generate HTML from markdown and write to temporary directory
 *
 * Processes all markdown files in the input directory, generates HTML,
 * and writes the result to preview.html in the temp directory.
 * Injects Paged.js polyfill and interface scripts for CSS Paged Media rendering.
 *
 * This function is called during:
 * - Initial server startup
 * - Preview restarts (folder changes)
 * - File changes (via watcher rebuild)
 *
 * @param inputPath - Absolute path to the input directory containing markdown files
 * @param tempDir - Absolute path to the temporary directory where preview.html will be written
 * @param config - Resolved configuration object from ConfigurationManager
 * @returns Promise that resolves when HTML generation and writing is complete
 * @throws {Error} If markdown processing or file writing fails
 *
 * @example
 * ```typescript
 * await generateAndWriteHtml(
 *   '/home/user/my-book',
 *   '/tmp/pagedmd-preview/abc123',
 *   configManager.getConfig()
 * );
 * // Creates /tmp/pagedmd-preview/abc123/preview.html
 * ```
 */
export async function generateAndWriteHtml(
  inputPath: string,
  tempDir: string,
  config: any
): Promise<void> {
  const htmlContent = await generateHtmlFromMarkdown(inputPath, config);

  // Inject Paged.js scripts for CSS Paged Media rendering
  const pagedJsScripts = `
    <script src="/preview/scripts/paged.polyfill.js"></script>
    <script src="/preview/scripts/paged-interface.js"></script>
  `;

  let processedHtml = htmlContent;

  // Ensure DOCTYPE
  if (!processedHtml.trim().toLowerCase().startsWith('<!doctype')) {
    processedHtml = '<!DOCTYPE html>\n' + processedHtml;
  }

  // Inject Paged.js scripts before </body>
  if (processedHtml.includes('</body>')) {
    processedHtml = processedHtml.replace('</body>', `${pagedJsScripts}</body>`);
  } else {
    processedHtml += pagedJsScripts;
  }

  const outputPath = path.join(tempDir, 'preview.html');
  await Bun.write(outputPath, processedHtml);
  debug(`Generated preview.html in ${tempDir}`);
}

/**
 * Create and configure a file watcher for the input directory
 *
 * Sets up a chokidar watcher that monitors markdown (.md), YAML (.yaml, .yml),
 * and other relevant files for changes. When changes are detected:
 * 1. Debounces rapid changes (default 500ms)
 * 2. Copies changed files to temp directory
 * 3. Reinitializes configuration
 * 4. Regenerates preview HTML
 * 5. Vite HMR automatically updates the browser
 *
 * The watcher ignores:
 * - Dot files and directories (.git, .env, etc.)
 * - Initial file scan (only watches for changes)
 * - Files being written (waits for write completion)
 *
 * @param state - Server state containing input path, temp dir, and config manager
 * @returns Configured FSWatcher instance (call .close() to stop watching)
 *
 * @example
 * ```typescript
 * const watcher = createFileWatcher(serverState);
 * // Watches serverState.currentInputPath for changes
 * // Logs: "Watching for file changes..."
 * // On change: "File change: /path/to/file.md"
 * // On change: "Regenerating preview..."
 * // On change: "Preview updated"
 * ```
 */
export function createFileWatcher(state: ServerState): FSWatcher {
  const watcher = watch(state.currentInputPath, {
    persistent: true,
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../, // Ignore dot files
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  let rebuildTimer: NodeJS.Timeout | null = null;

  watcher.on('all', async (event, filePath) => {
    debug(`File ${event}: ${filePath}`);

    if (rebuildTimer) clearTimeout(rebuildTimer);

    rebuildTimer = setTimeout(async () => {
      if (state.isRebuilding) return;

      state.isRebuilding = true;
      try {
        info('Regenerating preview...');

        // Re-copy changed file if relevant
        if (
          filePath.endsWith('.md') ||
          filePath.endsWith('.yaml') ||
          filePath.endsWith('.yml')
        ) {
          if (filePath.startsWith(state.currentInputPath)) {
            const relativePath = path.relative(state.currentInputPath, filePath);
            const destPath = path.join(state.tempDir, relativePath);
            await mkdir(path.dirname(destPath));
            await Bun.write(destPath, Bun.file(filePath));
            debug(`Updated: ${relativePath}`);
          }
        }

        // Reinitialize config and regenerate
        await state.configManager.initialize();
        const updatedConfig = state.configManager.getConfig();
        await generateAndWriteHtml(state.currentInputPath, state.tempDir, updatedConfig);

        info('Preview updated');
      } catch (err) {
        logError('Failed to regenerate preview:', err);
      } finally {
        state.isRebuilding = false;
      }
    }, DEBOUNCE.FILE_WATCH);
  });

  info('Watching for file changes...');
  return watcher;
}

/**
 * Start file watching if not disabled via options
 *
 * Checks the server options and creates a file watcher unless the user
 * explicitly disabled watching with the --no-watch flag.
 *
 * @param state - Server state containing options and watcher reference
 *
 * @example
 * ```typescript
 * startFileWatcher(serverState);
 * // If options.noWatch is false: Creates watcher, logs "Watching for file changes..."
 * // If options.noWatch is true: Does nothing
 * ```
 */
export function startFileWatcher(state: ServerState): void {
  if (!state.options.noWatch) {
    state.currentWatcher = createFileWatcher(state);
  }
}

/**
 * Stop the file watcher and clean up resources
 *
 * Gracefully closes the chokidar watcher if one exists and clears the
 * reference from server state. Safe to call multiple times or when no
 * watcher is active.
 *
 * This is called during:
 * - Preview restarts (folder changes)
 * - Server shutdown
 *
 * @param state - Server state containing the watcher reference
 * @returns Promise that resolves when the watcher is closed
 *
 * @example
 * ```typescript
 * await stopFileWatcher(serverState);
 * // Watcher closed, serverState.currentWatcher set to null
 * ```
 */
export async function stopFileWatcher(state: ServerState): Promise<void> {
  if (state.currentWatcher) {
    await state.currentWatcher.close();
    state.currentWatcher = null;
  }
}
