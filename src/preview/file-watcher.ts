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
import { injectPagedJsPolyfill } from '../build/formats/preview-format.ts';
import type { ServerState } from './server-context.ts';

/**
 * Generate HTML and write to temp directory
 */
export async function generateAndWriteHtml(
  inputPath: string,
  tempDir: string,
  config: any
): Promise<void> {
  const htmlContent = await generateHtmlFromMarkdown(inputPath, config);
  const htmlWithPolyfill = injectPagedJsPolyfill(htmlContent);
  const outputPath = path.join(tempDir, 'preview.html');
  await Bun.write(outputPath, htmlWithPolyfill);
  debug(`Generated preview.html in ${tempDir}`);
}

/**
 * Start file watcher for input directory
 *
 * Watches for changes to markdown, CSS, and manifest files
 * and triggers rebuilds with debouncing
 *
 * @param state Server state
 * @returns FSWatcher instance
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
 * Start file watching if enabled
 */
export function startFileWatcher(state: ServerState): void {
  if (!state.options.noWatch) {
    state.currentWatcher = createFileWatcher(state);
  }
}

/**
 * Stop file watcher
 */
export async function stopFileWatcher(state: ServerState): Promise<void> {
  if (state.currentWatcher) {
    await state.currentWatcher.close();
    state.currentWatcher = null;
  }
}
