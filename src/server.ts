/**
 * Preview server using Vite's built-in dev server
 *
 * Creates a temporary directory, generates HTML from markdown,
 * and serves it with Vite's hot module replacement.
 */

import path from 'path';
import { createServer, ViteDevServer } from 'vite';
import { watch } from 'chokidar';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import type { PreviewServerOptions } from './types.ts';
import { generateHtmlFromMarkdown } from './markdown/markdown.ts';
import { ConfigurationManager } from './config/config-state.ts';
import { mkdir, remove, writeFile, fileExists, copyDirectory } from './utils/file-utils.ts';
import { info, debug, error as logError } from './utils/logger.ts';
import { DEBOUNCE } from './constants.ts';
import { injectPagedJsPolyfill } from './build/formats/preview-format.ts';

/**
 * Preview server state
 */
interface PreviewServerState {
  tempDir: string;
  viteServer: ViteDevServer | null;
  watcher: ReturnType<typeof watch> | null;
  isRebuilding: boolean;
}

/**
 * Start preview server with Vite and file watching
 *
 * Process:
 * 1. Create temporary directory for preview content
 * 2. Copy input files and assets to temp directory
 * 3. Generate initial HTML from markdown
 * 4. Start Vite dev server on temp directory
 * 5. Watch input files for changes and regenerate HTML
 * 6. Vite handles automatic browser reload via HMR
 *
 * @param options - Preview server options
 */
export async function startPreviewServer(options: PreviewServerOptions): Promise<void> {
  // Validate input path exists
  const inputPath = options.input || process.cwd();
  if (!(await fileExists(inputPath))) {
    throw new Error(`Input path not found: ${inputPath}`);
  }

  info(`Starting preview server for: ${inputPath}`);

  // Create temporary directory with random suffix
  const tempDirBase = path.join(tmpdir(), 'pagedmd-preview');
  const tempDirSuffix = randomBytes(8).toString('hex');
  const tempDir = path.join(tempDirBase, tempDirSuffix);
  await mkdir(tempDir);
  debug(`Created temporary directory: ${tempDir}`);

  // Initialize state
  const state: PreviewServerState = {
    tempDir,
    viteServer: null,
    watcher: null,
    isRebuilding: false,
  };

  try {
    // Copy input directory to temp directory
    await copyDirectory(inputPath, tempDir);
    debug(`Copied markdown files from ${inputPath} to ${tempDir}`);

    // Copy only required preview assets to temp root
    const assetsSourceDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'assets');    
    await copyDirectory(assetsSourceDir, tempDir);
    debug(`Copied preview assets from ${assetsSourceDir} to ${tempDir}`);

    // Initialize configuration manager
    const configManager = new ConfigurationManager(inputPath, {
      input: inputPath,
      verbose: options.verbose,
      debug: options.debug,
    });
    await configManager.initialize();
    const config = configManager.getConfig();

    // Generate initial HTML
    await generateAndWriteHtml(inputPath, tempDir, config);

    // Start Vite dev server
    state.viteServer = await createServer({
      root: tempDir,
      server: {
        port: options.port,
        open: options.openBrowser ? '/index.html' : false,
        host: '0.0.0.0', // Allow external connections
      },
      // Disable Vite's own file watching (we handle it)
      clearScreen: false,
    });

    await state.viteServer.listen();

    const serverUrl = `http://localhost:${options.port}`;
    info(`Preview server running at ${serverUrl}`);
    info('Press Ctrl+C to stop');

    // Start file watching if not disabled
    if (!options.noWatch) {
      state.watcher = watch(inputPath, {
        persistent: true,
        ignoreInitial: true,
        ignored: /(^|[\/\\])\../, // Ignore dotfiles
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      // Debounced rebuild handler
      let rebuildTimer: NodeJS.Timeout | null = null;

      state.watcher.on('all', (event, filePath) => {
        

        debug(`File ${event}: ${filePath}`);

        // Clear existing timer
        if (rebuildTimer) {
          clearTimeout(rebuildTimer);
        }

        // Set new timer for debounced rebuild
        rebuildTimer = setTimeout(async () => {
          if (state.isRebuilding) {
            debug('Rebuild already in progress, skipping');
            return;
          }

          state.isRebuilding = true;
          try {
            info('Regenerating HTML...');

            // Re-copy only markdown files if changed
            if (filePath.endsWith('.md') || filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
              // Only copy the changed file if it's in input directory
              if (filePath.startsWith(inputPath)) {
                const relativePath = path.relative(inputPath, filePath);
                const destPath = path.join(tempDir, relativePath);
                await mkdir(path.dirname(destPath));
                await Bun.write(destPath, Bun.file(filePath));
                debug(`Copied changed file: ${relativePath}`);
              }
            }

            // Re-copy preview assets if CSS changed in source assets
            const assetsSourceDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets');
            if (filePath.includes('src/assets')) {
              await copyDirectory(assetsSourceDir, tempDir);
              debug(`Re-copied preview assets after asset change`);
            }

            // Re-initialize configuration (manifest may have changed)
            await configManager.initialize();
            const updatedConfig = configManager.getConfig();

            // Regenerate HTML
            await generateAndWriteHtml(inputPath, tempDir, updatedConfig);

            info('Preview updated');

            // Trigger Vite HMR to reload the page
            if (state.viteServer) {
              state.viteServer.ws.send({
                type: 'full-reload',
                path: '*',
              });
            }
          } catch (err) {
            logError('Failed to regenerate HTML:', err);
          } finally {
            state.isRebuilding = false;
          }
        }, DEBOUNCE.FILE_WATCH);
      });

      info('Watching for file changes...');
    }

    // Handle graceful shutdown
    const cleanup = async () => {
      info('\nShutting down preview server...');

      // Close file watcher
      if (state.watcher) {
        await state.watcher.close();
        debug('File watcher closed');
      }

      // Close Vite server
      if (state.viteServer) {
        await state.viteServer.close();
        debug('Vite server closed');
      }

      // Clean up temp directory (unless debug mode)
      if (!options.debug) {
        await remove(tempDir);
        debug('Temporary directory removed');
      } else {
        info(`Temporary directory preserved for debugging: ${tempDir}`);
      }

      process.exit(0);
    };

    // Register shutdown handlers
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Keep process alive
    await new Promise(() => {}); // Never resolves
  } catch (err) {
    logError('Preview server failed:', err);

    // Clean up on error
    if (state.watcher) {
      await state.watcher.close();
    }
    if (state.viteServer) {
      await state.viteServer.close();
    }
    if (!options.debug) {
      await remove(tempDir);
    }

    throw err;
  }
}

/**
 * Generate HTML from markdown and write to temp directory
 */
async function generateAndWriteHtml(
  inputPath: string,
  tempDir: string,
  config: any
): Promise<void> {
  // Generate base HTML from markdown (without preview assets - we'll inject them)
  const html = await generateHtmlFromMarkdown(inputPath, config, { includePreviewAssets: false });

  // Inject Paged.js polyfill and interface.js code inline
  const htmlWithPolyfill = injectPagedJsPolyfill(html);

  const previewPath = path.join(tempDir, 'preview.html');
  await writeFile(previewPath, htmlWithPolyfill);
  debug(`HTML written to: ${previewPath}`);
}
