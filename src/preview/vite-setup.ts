/**
 * Vite server setup and configuration
 *
 * Creates and configures Vite dev server with custom middleware
 */

import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { info } from '../utils/logger.ts';
import type { ServerState, ClientTracker } from './server-context.ts';
import { createApiMiddleware } from './api-middleware.ts';

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const server = Bun.serve({
      port,
      fetch() {
        return new Response();
      },
    });
    // Use stop(true) to forcefully close and clean up resources
    server.stop(true);
    // Give server time to fully release the port
    await new Promise((resolve) => setTimeout(resolve, 10));
    return true;
  } catch {
    return false;
  }
}

/**
 * Find an available port starting from the given port
 */
export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }

  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

/**
 * Create Vite server with API middleware
 *
 * @param state Server state
 * @param clientTracker Client connection tracker
 * @param port Port to use
 * @param restartPreviewFn Function to restart preview
 * @param shutdownFn Function to shutdown server
 * @returns Configured Vite server
 */
export async function createConfiguredViteServer(
  state: ServerState,
  clientTracker: ClientTracker,
  port: number,
  restartPreviewFn: (newPath: string) => Promise<void>,
  shutdownFn: () => Promise<void>
): Promise<ViteDevServer> {
  const middleware = createApiMiddleware(state, clientTracker, restartPreviewFn, shutdownFn);

  const viteServer = await createViteServer({
    configFile: false,
    root: state.tempDir,
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      open: state.options.openBrowser,
      // Note: Vite automatically sets appropriate cache headers
      // - HTML: no-cache for instant updates
      // - JS/CSS with ?v= hash: long-term cache with immutable
      // - Other assets: short-term cache with revalidation
      // We don't override headers here to let Vite handle it optimally
    },
    clearScreen: false,
    plugins: [
      {
        name: 'api-middleware',
        configureServer(server) {
          server.middlewares.use(middleware);
        },
      },
    ],
  });

  await viteServer.listen();

  const serverUrl = `http://localhost:${port}`;
  info(`Preview server running at ${serverUrl}`);
  info('Press Ctrl+C to stop');

  return viteServer;
}
