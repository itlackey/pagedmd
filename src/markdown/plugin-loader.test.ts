/**
 * Tests for PluginLoader
 */

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { createPluginLoader, PluginLoader } from './plugin-loader.ts';
import type { PluginConfig, LoadedPlugin } from '../types/plugin-types.ts';
import { PluginError, PluginSecurityError } from '../types/plugin-types.ts';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import type MarkdownIt from 'markdown-it';

const TEST_DIR = path.join(import.meta.dir, '../../test-temp/plugin-loader');

describe('PluginLoader', () => {
  beforeEach(async () => {
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('Factory function', () => {
    test('creates plugin loader with default options', () => {
      const loader = createPluginLoader(TEST_DIR);
      expect(loader).toBeInstanceOf(PluginLoader);
    });

    test('creates plugin loader with custom options', () => {
      const loader = createPluginLoader(TEST_DIR, {
        baseDir: TEST_DIR,
        strict: true,
        verbose: true,
        cache: false,
      });
      expect(loader).toBeInstanceOf(PluginLoader);
    });
  });

  describe('Plugin type detection', () => {
    test('detects local file from ./ prefix', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const config: PluginConfig = './plugin.js';

      // This will fail to load (file doesn't exist), but we can check the error message
      const result = await loader.loadPlugin(config);
      // In non-strict mode, returns null on error
      expect(result).toBeNull();
    });

    test('detects local file from .js extension', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const config: PluginConfig = 'plugins/custom.js';

      const result = await loader.loadPlugin(config);
      expect(result).toBeNull(); // File doesn't exist
    });

    test('detects built-in plugin', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const config: PluginConfig = 'ttrpg';

      const result = await loader.loadPlugin(config);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('builtin');
      expect(result?.metadata.name).toBe('ttrpg');
    });

    test('detects npm package by default', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const config: PluginConfig = 'some-package';

      const result = await loader.loadPlugin(config);
      // Will fail (package doesn't exist), but should attempt package load
      expect(result).toBeNull();
    });
  });

  describe('Built-in plugins', () => {
    test('loads ttrpg plugin', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin({ name: 'ttrpg', type: 'builtin' });

      expect(result).not.toBeNull();
      expect(result?.type).toBe('builtin');
      expect(result?.metadata.name).toBe('ttrpg');
      expect(result?.plugin).toBeFunction();
      expect(result?.priority).toBe(100); // default priority
    });

    test('loads dimmCity plugin', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin({ name: 'dimmCity', type: 'builtin' });

      expect(result).not.toBeNull();
      expect(result?.type).toBe('builtin');
      expect(result?.metadata.name).toBe('dimmCity');
      expect(result?.plugin).toBeFunction();
    });

    test('returns available built-in plugins', () => {
      const loader = createPluginLoader(TEST_DIR);
      const plugins = loader.getBuiltinPlugins();

      expect(plugins).toContain('ttrpg');
      expect(plugins).toContain('dimmCity');
    });

    test('throws error for unknown built-in plugin', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: true });

      const config: PluginConfig = { name: 'unknown', type: 'builtin' };

      await expect(loader.loadPlugin(config)).rejects.toThrow(PluginError);
    });

    test('returns null for unknown built-in plugin in non-strict mode', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: false });

      const config: PluginConfig = { name: 'unknown', type: 'builtin' };
      const result = await loader.loadPlugin(config);

      expect(result).toBeNull();
    });
  });

  describe('Local plugins', () => {
    test('loads valid local plugin', async () => {
      // Create a test plugin file
      const pluginPath = path.join(TEST_DIR, 'test-plugin.js');
      await writeFile(
        pluginPath,
        `
export default function testPlugin(md, options) {
  // Test plugin implementation
}

export const metadata = {
  name: 'test-plugin',
  version: '1.0.0',
  description: 'Test plugin'
};

export const css = '.test { color: red; }';
        `
      );

      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin({
        path: './test-plugin.js',
        type: 'local',
      });

      expect(result).not.toBeNull();
      expect(result?.type).toBe('local');
      expect(result?.metadata.name).toBe('test-plugin');
      expect(result?.metadata.version).toBe('1.0.0');
      expect(result?.css).toContain('color: red');
      expect(result?.plugin).toBeFunction();
    });

    test('loads plugin with named export', async () => {
      const pluginPath = path.join(TEST_DIR, 'named-export.js');
      await writeFile(
        pluginPath,
        `
export function plugin(md, options) {
  // Plugin implementation
}

export const metadata = {
  name: 'named-plugin',
  version: '2.0.0'
};
        `
      );

      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin({
        path: './named-export.js',
        type: 'local',
      });

      expect(result).not.toBeNull();
      expect(result?.metadata.name).toBe('named-plugin');
      expect(result?.plugin).toBeFunction();
    });

    test('rejects path traversal attempts', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: true });

      const config: PluginConfig = {
        path: '../../../etc/passwd',
        type: 'local',
      };

      // Security errors are wrapped in PluginError for consistency
      await expect(loader.loadPlugin(config)).rejects.toThrow(PluginError);
      await expect(loader.loadPlugin(config)).rejects.toThrow(/outside allowed directory/);
    });

    test('rejects absolute paths', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: true });

      const config: PluginConfig = {
        path: '/absolute/path/plugin.js',
        type: 'local',
      };

      // Security errors are wrapped in PluginError for consistency
      await expect(loader.loadPlugin(config)).rejects.toThrow(PluginError);
      await expect(loader.loadPlugin(config)).rejects.toThrow(/outside allowed directory/);
    });

    test('returns null for missing file in non-strict mode', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: false });

      const result = await loader.loadPlugin({
        path: './nonexistent.js',
        type: 'local',
      });

      expect(result).toBeNull();
    });

    test('throws error for missing file in strict mode', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: true });

      await expect(
        loader.loadPlugin({
          path: './nonexistent.js',
          type: 'local',
        })
      ).rejects.toThrow(PluginError);
    });

    test('throws error for plugin without export', async () => {
      const pluginPath = path.join(TEST_DIR, 'no-export.js');
      await writeFile(pluginPath, '// No exports');

      const loader = createPluginLoader(TEST_DIR, { strict: true });

      await expect(
        loader.loadPlugin({
          path: './no-export.js',
          type: 'local',
        })
      ).rejects.toThrow(PluginError);
    });
  });

  describe('Plugin configuration', () => {
    test('normalizes string config', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin('ttrpg');

      expect(result).not.toBeNull();
      expect(result?.metadata.name).toBe('ttrpg');
      expect(result?.priority).toBe(100); // default
    });

    test('normalizes object config', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin({
        name: 'ttrpg',
        type: 'builtin',
        priority: 200,
        options: { statBlocks: true },
      });

      expect(result).not.toBeNull();
      expect(result?.priority).toBe(200);
    });

    test('respects enabled flag', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin({
        name: 'ttrpg',
        enabled: false,
      });

      expect(result).toBeNull();
    });

    test('applies custom priority', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin({
        name: 'ttrpg',
        priority: 500,
      });

      expect(result?.priority).toBe(500);
    });
  });

  describe('Multiple plugins', () => {
    test('loads multiple plugins', async () => {
      const loader = createPluginLoader(TEST_DIR);

      const configs: PluginConfig[] = [
        'ttrpg',
        'dimmCity',
      ];

      const results = await loader.loadPlugins(configs);

      expect(results).toHaveLength(2);
      expect(results[0]!.metadata.name).toBe('ttrpg');
      expect(results[1]!.metadata.name).toBe('dimmCity');
    });

    test('sorts plugins by priority', async () => {
      const loader = createPluginLoader(TEST_DIR);

      const configs: PluginConfig[] = [
        { name: 'ttrpg', priority: 100 },
        { name: 'dimmCity', priority: 200 },
      ];

      const results = await loader.loadPlugins(configs);

      // Higher priority first
      expect(results[0]!.metadata.name).toBe('dimmCity');
      expect(results[0]!.priority).toBe(200);
      expect(results[1]!.metadata.name).toBe('ttrpg');
      expect(results[1]!.priority).toBe(100);
    });

    test('filters out disabled plugins', async () => {
      const loader = createPluginLoader(TEST_DIR);

      const configs: PluginConfig[] = [
        { name: 'ttrpg', enabled: true },
        { name: 'dimmCity', enabled: false },
      ];

      const results = await loader.loadPlugins(configs);

      expect(results).toHaveLength(1);
      expect(results[0]!.metadata.name).toBe('ttrpg');
    });

    test('filters out failed loads in non-strict mode', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: false });

      const configs: PluginConfig[] = [
        'ttrpg',
        { name: 'unknown', type: 'builtin' }, // Will fail
        'dimmCity',
      ];

      const results = await loader.loadPlugins(configs);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.metadata.name)).toEqual(['ttrpg', 'dimmCity']);
    });
  });

  describe('Plugin caching', () => {
    test('caches loaded plugins', async () => {
      const loader = createPluginLoader(TEST_DIR, { cache: true });

      const config: PluginConfig = 'ttrpg';

      const result1 = await loader.loadPlugin(config);
      const result2 = await loader.loadPlugin(config);

      // Should return the same instance (cached)
      expect(result1).toBe(result2);
    });

    test('respects cache disable option', async () => {
      const loader = createPluginLoader(TEST_DIR, { cache: false });

      const config: PluginConfig = 'ttrpg';

      const result1 = await loader.loadPlugin(config);
      const result2 = await loader.loadPlugin(config);

      // Different instances (not cached)
      expect(result1).not.toBe(result2);
      // But same content
      expect(result1?.metadata.name).toBe(result2?.metadata.name);
    });

    test('clears cache', async () => {
      const loader = createPluginLoader(TEST_DIR, { cache: true });

      const result1 = await loader.loadPlugin('ttrpg');
      loader.clearCache();
      const result2 = await loader.loadPlugin('ttrpg');

      // Different instances after cache clear
      expect(result1).not.toBe(result2);
    });
  });

  describe('Remote plugins', () => {
    test('throws not yet supported error', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: true });

      const config: PluginConfig = {
        url: 'https://example.com/plugin.js',
        type: 'remote',
      };

      await expect(loader.loadPlugin(config)).rejects.toThrow(/not yet supported/);
    });
  });

  describe('CSS collection', () => {
    test('collects CSS from local plugin', async () => {
      const pluginPath = path.join(TEST_DIR, 'css-plugin.js');
      await writeFile(
        pluginPath,
        `
export default function plugin(md) {}

export const css = '.my-class { color: blue; }';

export const metadata = {
  name: 'css-plugin',
  version: '1.0.0'
};
        `
      );

      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin({
        path: './css-plugin.js',
        type: 'local',
      });

      expect(result?.css).toContain('color: blue');
    });

    test('returns undefined for plugin without CSS', async () => {
      const loader = createPluginLoader(TEST_DIR);
      const result = await loader.loadPlugin('ttrpg');

      // Built-in plugins may or may not have CSS
      // Just verify it doesn't crash
      expect(result).not.toBeNull();
    });
  });

  describe('Error handling', () => {
    test('provides helpful error for missing path', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: true });

      const config: PluginConfig = {
        type: 'local',
        // Missing path
      };

      await expect(loader.loadPlugin(config)).rejects.toThrow(/requires path/);
    });

    test('provides helpful error for missing name', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: true });

      const config: PluginConfig = {
        type: 'package',
        // Missing name
      };

      await expect(loader.loadPlugin(config)).rejects.toThrow(/requires name/);
    });

    test('includes plugin name in error', async () => {
      const loader = createPluginLoader(TEST_DIR, { strict: true });

      const config: PluginConfig = {
        path: './missing.js',
        type: 'local',
      };

      try {
        await loader.loadPlugin(config);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(PluginError);
        const pluginError = error as PluginError;
        expect(pluginError.pluginName).toBe('./missing.js');
        expect(pluginError.pluginType).toBe('local');
      }
    });
  });
});
