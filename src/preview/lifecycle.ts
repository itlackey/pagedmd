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
 * Initialize preview directories and files
 *
 * @param inputPath Input directory path
 * @param assetsSourceDir Assets directory path
 * @returns Temporary directory path
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
 * Resolve assets directory path
 *
 * Supports two scenarios:
 * 1. Dev: Running from src/server.ts → assets at src/assets
 * 2. Prod: Running from dist/cli.js → assets at dist/assets
 */
export function resolveAssetsDir(): string {
  const thisFileDir = path.dirname(new URL(import.meta.url).pathname);
  return path.join(thisFileDir, '..', 'assets');
}

/**
 * Validate input path exists
 */
export async function validateInputPath(inputPath: string): Promise<void> {
  if (!(await fileExists(inputPath))) {
    throw new Error(`Input path not found: ${inputPath}`);
  }
}

/**
 * Initialize configuration manager
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
 * Restart preview for folder changes
 *
 * @param newInputPath New input directory
 * @param state Server state
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
 * Check if all clients have disconnected and schedule auto-shutdown
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
 * Graceful shutdown handler
 *
 * Stops watcher, closes Vite server, cleans up temp files
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
