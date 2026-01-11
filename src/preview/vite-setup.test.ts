/**
 * Unit tests for Vite server setup
 */

import { describe, test, expect } from 'bun:test';
import { isPortAvailable, findAvailablePort } from './vite-setup.ts';

describe('Vite Setup', () => {
  describe('isPortAvailable', () => {
    test('returns true for available port', async () => {
      // Use a high port number likely to be available
      const result = await isPortAvailable(59999);
      expect(result).toBe(true);
    });

    test('returns false for unavailable port', async () => {
      // Start a server on a port
      const testPort = 58888;
      const server = Bun.serve({
        port: testPort,
        fetch() {
          return new Response('test');
        },
      });

      try {
        const result = await isPortAvailable(testPort);
        expect(result).toBe(false);
      } finally {
        server.stop(true);
        // Give it time to release
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
  });

  describe('findAvailablePort', () => {
    test('returns same port if available', async () => {
      const desiredPort = 59998;
      const port = await findAvailablePort(desiredPort);
      expect(port).toBe(desiredPort);
    });

    test('finds next available port if first is taken', async () => {
      const startPort = 58887;
      const server1 = Bun.serve({
        port: startPort,
        fetch() {
          return new Response();
        },
      });

      try {
        const port = await findAvailablePort(startPort);
        // Should get next port
        expect(port).toBeGreaterThan(startPort);
        expect(port).toBeLessThanOrEqual(startPort + 10);
      } finally {
        server1.stop(true);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });

    test('throws error if no ports available after max attempts', async () => {
      const startPort = 58886;
      const servers: any[] = [];

      try {
        // Block 11 ports (more than maxAttempts = 10)
        for (let i = 0; i < 11; i++) {
          const server = Bun.serve({
            port: startPort + i,
            fetch() {
              return new Response();
            },
          });
          servers.push(server);
        }

        await expect(findAvailablePort(startPort)).rejects.toThrow(/Could not find an available port/);
      } finally {
        // Cleanup all servers
        for (const server of servers) {
          server.stop(true);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });
  });
});
