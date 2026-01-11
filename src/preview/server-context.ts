/**
 * Preview server context and state management
 *
 * Centralizes server state to avoid passing many parameters between functions
 */

import type { FSWatcher } from 'chokidar';
import type { ViteDevServer } from 'vite';
import type { PreviewServerOptions, PreviewEngineId } from '../types.ts';
import type { ConfigurationManager } from '../config/config-state.ts';

/**
 * Server lifecycle state
 */
export interface ServerState {
  /** Current input directory being previewed */
  currentInputPath: string;
  /** File watcher instance */
  currentWatcher: FSWatcher | null;
  /** Is currently rebuilding? (prevents overlapping builds) */
  isRebuilding: boolean;
  /** Vite dev server instance */
  viteServer: ViteDevServer | null;
  /** Is server shutting down? (prevents multiple shutdown calls) */
  isShuttingDown: boolean;
  /** Temporary directory for preview files */
  tempDir: string;
  /** Assets source directory */
  assetsSourceDir: string;
  /** Configuration manager */
  configManager: ConfigurationManager;
  /** Server options */
  options: PreviewServerOptions;
  /** Current preview engine */
  currentEngine: PreviewEngineId;
}

/**
 * Client connection tracking
 */
export interface ClientTracker {
  /** Set of connected client IDs */
  connectedClients: Set<string>;
  /** Auto-shutdown timer */
  autoShutdownTimer: NodeJS.Timeout | null;
  /** Delay before auto-shutdown (ms) */
  AUTO_SHUTDOWN_DELAY: number;
}

/**
 * Create initial server state
 */
export function createServerState(
  inputPath: string,
  tempDir: string,
  assetsSourceDir: string,
  configManager: ConfigurationManager,
  options: PreviewServerOptions
): ServerState {
  return {
    currentInputPath: inputPath,
    currentWatcher: null,
    isRebuilding: false,
    viteServer: null,
    isShuttingDown: false,
    tempDir,
    assetsSourceDir,
    configManager,
    options,
    currentEngine: options.engine || 'pagedjs',
  };
}

/**
 * Create client tracker
 */
export function createClientTracker(): ClientTracker {
  return {
    connectedClients: new Set<string>(),
    autoShutdownTimer: null,
    AUTO_SHUTDOWN_DELAY: 5000, // 5 seconds
  };
}
