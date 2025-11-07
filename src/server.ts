/**
 * Preview server using Vite with custom API middleware
 *
 * SIMPLE Architecture:
 * - Vite serves everything on user-specified port
 * - Custom middleware handles /api/* endpoints with Bun
 * - Watch input directory and rebuild preview format on changes
 * - Vite handles HMR automatically
 */

import path from 'path';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { watch } from 'chokidar';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import type { PreviewServerOptions } from './types.ts';
import { generateHtmlFromMarkdown } from './markdown/markdown.ts';
import { ConfigurationManager } from './config/config-state.ts';
import { mkdir, remove, fileExists, copyDirectory } from './utils/file-utils.ts';
import { info, debug, error as logError } from './utils/logger.ts';
import { DEBOUNCE } from './constants.ts';
import { injectPagedJsPolyfill } from './build/formats/preview-format.ts';
import { handleListDirectories, handleChangeFolder } from './preview/routes.ts';

/**
 * Generate HTML and write to temp directory
 */
async function generateAndWriteHtml(
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
 * Start preview server with Vite as primary server
 */
export async function startPreviewServer(options: PreviewServerOptions): Promise<void> {
  const inputPath = options.input || process.cwd();
  if (!(await fileExists(inputPath))) {
    throw new Error(`Input path not found: ${inputPath}`);
  }

  info(`Starting preview server for: ${inputPath}`);

  // Create temporary directory
  const tempDirBase = path.join(tmpdir(), 'pagedmd-preview');
  const tempDirSuffix = randomBytes(8).toString('hex');
  const tempDir = path.join(tempDirBase, tempDirSuffix);
  await mkdir(tempDir);
  debug(`Created temporary directory: ${tempDir}`);

  // Copy input directory to temp
  await copyDirectory(inputPath, tempDir);
  debug(`Copied input files to ${tempDir}`);

  // Copy preview assets to temp
  const assetsSourceDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'assets');
  await copyDirectory(assetsSourceDir, tempDir);
  debug(`Copied preview assets to ${tempDir}`);

  // Initialize configuration
  const configManager = new ConfigurationManager(inputPath, {
    input: inputPath,
    verbose: options.verbose,
    debug: options.debug,
  });
  await configManager.initialize();
  const config = configManager.getConfig();

  // Generate initial HTML
  await generateAndWriteHtml(inputPath, tempDir, config);

  // Track state for folder changes
  let currentInputPath = inputPath;
  let currentWatcher: ReturnType<typeof watch> | null = null;
  let isRebuilding = false;

  // Restart preview for folder changes
  async function restartPreview(newInputPath: string): Promise<void> {
    info(`Restarting preview for: ${newInputPath}`);

    // Stop watcher
    if (currentWatcher) {
      await currentWatcher.close();
      currentWatcher = null;
    }

    // Update input path
    currentInputPath = newInputPath;

    // Clear temp directory
    await remove(tempDir);
    await mkdir(tempDir);

    // Re-copy new input
    await copyDirectory(newInputPath, tempDir);
    await copyDirectory(assetsSourceDir, tempDir);

    // Reinitialize config
    await configManager.initialize();
    const updatedConfig = configManager.getConfig();

    // Regenerate HTML
    await generateAndWriteHtml(newInputPath, tempDir, updatedConfig);

    // Restart watcher
    if (!options.noWatch) {
      startFileWatcher();
    }

    info('Preview restarted successfully');
  }

  // Start file watcher for input directory
  function startFileWatcher() {
    currentWatcher = watch(currentInputPath, {
      persistent: true,
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    let rebuildTimer: NodeJS.Timeout | null = null;

    currentWatcher.on('all', async (event, filePath) => {
      debug(`File ${event}: ${filePath}`);

      if (rebuildTimer) clearTimeout(rebuildTimer);

      rebuildTimer = setTimeout(async () => {
        if (isRebuilding) return;

        isRebuilding = true;
        try {
          info('Regenerating preview...');

          // Re-copy changed file if relevant
          if (filePath.endsWith('.md') || filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
            if (filePath.startsWith(currentInputPath)) {
              const relativePath = path.relative(currentInputPath, filePath);
              const destPath = path.join(tempDir, relativePath);
              await mkdir(path.dirname(destPath));
              await Bun.write(destPath, Bun.file(filePath));
              debug(`Updated: ${relativePath}`);
            }
          }

          // Reinitialize config and regenerate
          await configManager.initialize();
          const updatedConfig = configManager.getConfig();
          await generateAndWriteHtml(currentInputPath, tempDir, updatedConfig);

          info('Preview updated');
        } catch (err) {
          logError('Failed to regenerate preview:', err);
        } finally {
          isRebuilding = false;
        }
      }, DEBOUNCE.FILE_WATCH);
    });

    info('Watching for file changes...');
  }

  // Create Vite server with API middleware
  const viteServer = await createViteServer({
    configFile: false,
    root: tempDir,
    server: {
      port: options.port,
      strictPort: true,
      host: '0.0.0.0',
      open: options.openBrowser,
    },
    clearScreen: false,
    plugins: [
      {
        name: 'api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = new URL(req.url!, `http://${req.headers.host}`);

            // Handle /api/directories
            if (url.pathname === '/api/directories') {
              const response = await handleListDirectories(
                new Request(url.toString(), {
                  method: req.method,
                  headers: req.headers as HeadersInit,
                })
              );

              res.statusCode = response.status;
              response.headers.forEach((value, key) => {
                res.setHeader(key, value);
              });
              res.end(await response.text());
              return;
            }

            // Handle /api/change-folder
            if (url.pathname === '/api/change-folder' && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => (body += chunk));
              req.on('end', async () => {
                const response = await handleChangeFolder(
                  new Request(url.toString(), {
                    method: 'POST',
                    headers: req.headers as HeadersInit,
                    body,
                  }),
                  restartPreview
                );

                res.statusCode = response.status;
                response.headers.forEach((value, key) => {
                  res.setHeader(key, value);
                });
                res.end(await response.text());
              });
              return;
            }

            // Let Vite handle everything else
            next();
          });
        },
      },
    ],
  });

  await viteServer.listen();

  const serverUrl = `http://localhost:${options.port}`;
  info(`Preview server running at ${serverUrl}`);
  info('Press Ctrl+C to stop');

  // Start file watching if enabled
  if (!options.noWatch) {
    startFileWatcher();
  }

  // Graceful shutdown
  const cleanup = async () => {
    info('\nShutting down preview server...');
    if (currentWatcher) await currentWatcher.close();
    await viteServer.close();
    await remove(tempDir);
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
