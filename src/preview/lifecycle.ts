/**
 * Server lifecycle management
 *
 * Handles startup, restart, shutdown, and client connection tracking
 */

import path from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { mkdir, remove, copyDirectory, fileExists } from '../utils/file-utils.ts';
import { info, debug } from '../utils/logger.ts';
import { ConfigurationManager } from '../config/config-state.ts';
import type { PreviewServerOptions } from '../types.ts';
import type { ServerState, ClientTracker } from './server-context.ts';
import { generateAndWriteHtml, stopFileWatcher, startFileWatcher } from './file-watcher.ts';

/**
 * Initialize preview directories and copy source files
 *
 * Creates a unique temporary directory and copies both the input directory
 * and preview assets to it. This isolation ensures the original files remain
 * untouched during preview operations.
 *
 * @param inputPath - Absolute path to the user's input directory containing markdown files
 * @param assetsSourceDir - Absolute path to the preview assets directory (scripts, styles)
 * @returns Promise resolving to the absolute path of the created temporary directory
 * @throws {Error} If directory creation or file copying fails
 *
 * @example
 * ```typescript
 * const tempDir = await initializePreviewDirectories(
 *   '/home/user/my-book',
 *   '/app/src/assets/preview'
 * );
 * // tempDir: /tmp/pagedmd-preview/a1b2c3d4e5f6g7h8
 * ```
 */
export async function initializePreviewDirectories(
  inputPath: string,
  assetsSourceDir: string
): Promise<string> {
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
  await copyDirectory(assetsSourceDir, tempDir);
  debug(`Copied preview assets to ${tempDir}`);

  return tempDir;
}

/**
 * Resolve the preview assets directory path
 *
 * Dynamically determines the correct assets directory based on the current
 * execution context (development vs production build).
 *
 * Supports two scenarios:
 * - Development: Running from `src/server.ts` → assets at `src/assets`
 * - Production: Running from `dist/cli.js` → assets at `dist/assets`
 *
 * @returns Absolute path to the assets directory
 *
 * @example
 * ```typescript
 * const assetsDir = resolveAssetsDir();
 * // Development: /app/src/assets
 * // Production: /app/dist/assets
 * ```
 */
export function resolveAssetsDir(): string {
  const thisFileDir = path.dirname(new URL(import.meta.url).pathname);
  return path.join(thisFileDir, '..', 'assets');
}

/**
 * Validate that the input path exists on the filesystem
 *
 * @param inputPath - Path to validate (file or directory)
 * @returns Promise that resolves if path exists
 * @throws {Error} If the input path does not exist
 *
 * @example
 * ```typescript
 * await validateInputPath('/home/user/my-book');
 * // Succeeds if path exists, throws Error otherwise
 * ```
 */
export async function validateInputPath(inputPath: string): Promise<void> {
  if (!(await fileExists(inputPath))) {
    throw new Error(`Input path not found: ${inputPath}`);
  }
}

/**
 * Initialize and load the configuration manager
 *
 * Creates a ConfigurationManager instance with the input path and preview
 * server options, then loads the manifest.yaml and resolves all configuration.
 *
 * @param inputPath - Absolute path to the input directory
 * @param options - Preview server options (verbose, debug flags)
 * @returns Promise resolving to an initialized ConfigurationManager instance
 * @throws {Error} If manifest.yaml is invalid or configuration fails to load
 *
 * @example
 * ```typescript
 * const configManager = await initializeConfiguration(
 *   '/home/user/my-book',
 *   { verbose: true, debug: false }
 * );
 * const config = configManager.getConfig();
 * ```
 */
export async function initializeConfiguration(
  inputPath: string,
  options: PreviewServerOptions
): Promise<ConfigurationManager> {
  const configManager = new ConfigurationManager(inputPath, {
    input: inputPath,
    verbose: options.verbose,
    debug: options.debug,
  });
  await configManager.initialize();
  return configManager;
}

/**
 * Restart the preview server with a new input directory
 *
 * Handles the complete workflow for switching the preview to a different folder:
 * 1. Stops the file watcher
 * 2. Updates the server state with new input path
 * 3. Clears and recreates the temporary directory
 * 4. Copies new input files and assets
 * 5. Reinitializes configuration
 * 6. Regenerates HTML from markdown
 * 7. Restarts the file watcher
 *
 * This function is typically called when the user switches folders via the UI.
 *
 * @param newInputPath - Absolute path to the new input directory
 * @param state - Server state object containing current configuration and references
 * @returns Promise that resolves when the restart is complete
 * @throws {Error} If the new input path is invalid or restart operations fail
 *
 * @example
 * ```typescript
 * await restartPreview('/home/user/different-book', serverState);
 * // Preview now shows content from /home/user/different-book
 * ```
 */
export async function restartPreview(newInputPath: string, state: ServerState): Promise<void> {
  info(`Restarting preview for: ${newInputPath}`);

  // Stop watcher
  await stopFileWatcher(state);

  // Update input path
  state.currentInputPath = newInputPath;

  // Clear temp directory
  await remove(state.tempDir);
  await mkdir(state.tempDir);

  // Re-copy new input
  await copyDirectory(newInputPath, state.tempDir);
  await copyDirectory(state.assetsSourceDir, state.tempDir);

  // Reinitialize config
  await state.configManager.initialize();
  const updatedConfig = state.configManager.getConfig();

  // Regenerate HTML
  await generateAndWriteHtml(newInputPath, state.tempDir, updatedConfig);

  // Restart watcher
  startFileWatcher(state);

  info('Preview restarted successfully');
}

/**
 * Check client connections and schedule automatic server shutdown if needed
 *
 * Implements graceful server shutdown after all clients disconnect. When the
 * last client disconnects, schedules a shutdown after a delay (default 5s).
 * If a client reconnects before the delay expires, the shutdown is cancelled.
 *
 * This prevents the server from staying running unnecessarily while allowing
 * reconnection without restarting (e.g., browser refresh).
 *
 * @param clientTracker - Client tracking object with connected clients set and shutdown timer
 * @param shutdownFn - Async function to call for server shutdown
 *
 * @example
 * ```typescript
 * checkForAutoShutdown(clientTracker, async () => {
 *   await shutdownServer(state, clientTracker);
 * });
 * // If no clients: "All clients disconnected. Server will shutdown in 5s..."
 * // If client reconnects: Shutdown cancelled
 * ```
 */
export function checkForAutoShutdown(
  clientTracker: ClientTracker,
  shutdownFn: () => Promise<void>
): void {
  if (clientTracker.connectedClients.size === 0) {
    // Clear any existing timer
    if (clientTracker.autoShutdownTimer) {
      clearTimeout(clientTracker.autoShutdownTimer);
    }

    // Schedule shutdown after delay
    info(
      `All clients disconnected. Server will shutdown in ${clientTracker.AUTO_SHUTDOWN_DELAY / 1000}s...`
    );
    clientTracker.autoShutdownTimer = setTimeout(() => {
      if (clientTracker.connectedClients.size === 0) {
        info('No clients reconnected. Shutting down...');
        void shutdownFn();
      }
    }, clientTracker.AUTO_SHUTDOWN_DELAY);
  } else {
    // Cancel auto-shutdown if there are connected clients
    if (clientTracker.autoShutdownTimer) {
      clearTimeout(clientTracker.autoShutdownTimer);
      clientTracker.autoShutdownTimer = null;
    }
  }
}

/**
 * Perform graceful server shutdown and cleanup
 *
 * Coordinates a clean shutdown of all server components:
 * 1. Prevents multiple simultaneous shutdown calls
 * 2. Cancels any pending auto-shutdown timers
 * 3. Stops the file watcher
 * 4. Closes the Vite development server
 * 5. Removes temporary directory and files
 * 6. Exits the process
 *
 * This function is called when:
 * - User closes the browser window (via disconnect + auto-shutdown)
 * - User explicitly requests shutdown via API
 * - Fatal error occurs during server operation
 *
 * @param state - Server state containing references to watcher, Vite server, etc.
 * @param clientTracker - Client tracking object with auto-shutdown timer
 * @returns Promise that resolves when shutdown is complete (process exits)
 *
 * @example
 * ```typescript
 * await shutdownServer(serverState, clientTracker);
 * // Logs: "Shutting down preview server..."
 * // Logs: "Server stopped. You can close this browser window."
 * // Process exits with code 0
 * ```
 */
export async function shutdownServer(state: ServerState, clientTracker: ClientTracker): Promise<void> {
  if (state.isShuttingDown) return; // Prevent multiple shutdown calls
  state.isShuttingDown = true;

  // Clear any pending auto-shutdown timer
  if (clientTracker.autoShutdownTimer) {
    clearTimeout(clientTracker.autoShutdownTimer);
    clientTracker.autoShutdownTimer = null;
  }

  info('\nShutting down preview server...');
  await stopFileWatcher(state);
  if (state.viteServer) await state.viteServer.close();
  await remove(state.tempDir);
  info('Server stopped. You can close this browser window.');
  process.exit(0);
}
