/**
 * Unit tests for server context and state management
 */

import { describe, test, expect } from 'bun:test';
import { createServerState, createClientTracker } from './server-context.ts';
import { ConfigurationManager } from '../config/config-state.ts';
import type { PreviewServerOptions } from '../types.ts';

describe('Server Context', () => {
  describe('createServerState', () => {
    test('creates server state with correct initial values', () => {
      const inputPath = '/test/input';
      const tempDir = '/tmp/test';
      const assetsDir = '/assets';
      const configManager = new ConfigurationManager(inputPath, {});
      const options: PreviewServerOptions = {
        port: 3000,
        verbose: false,
        noWatch: false,
        openBrowser: true,
      };

      const state = createServerState(inputPath, tempDir, assetsDir, configManager, options);

      expect(state.currentInputPath).toBe(inputPath);
      expect(state.tempDir).toBe(tempDir);
      expect(state.assetsSourceDir).toBe(assetsDir);
      expect(state.configManager).toBe(configManager);
      expect(state.options).toBe(options);
      expect(state.currentWatcher).toBeNull();
      expect(state.isRebuilding).toBe(false);
      expect(state.viteServer).toBeNull();
      expect(state.isShuttingDown).toBe(false);
    });
  });

  describe('createClientTracker', () => {
    test('creates client tracker with correct initial values', () => {
      const tracker = createClientTracker();

      expect(tracker.connectedClients).toBeInstanceOf(Set);
      expect(tracker.connectedClients.size).toBe(0);
      expect(tracker.autoShutdownTimer).toBeNull();
      expect(tracker.AUTO_SHUTDOWN_DELAY).toBe(5000);
    });

    test('creates independent tracker instances', () => {
      const tracker1 = createClientTracker();
      const tracker2 = createClientTracker();

      tracker1.connectedClients.add('client1');

      expect(tracker1.connectedClients.size).toBe(1);
      expect(tracker2.connectedClients.size).toBe(0);
      expect(tracker1.connectedClients).not.toBe(tracker2.connectedClients);
    });
  });
});
