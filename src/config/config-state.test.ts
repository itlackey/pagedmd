/**
 * Tests for ConfigurationManager
 *
 * Tests manifest loading, CLI option precedence, and default values
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ConfigurationManager, createConfigManager } from './config-state.ts';
import { mkdir, writeFile, remove } from '../utils/file-utils.ts';
import { join } from 'path';
import YAML from 'js-yaml';
import { OutputFormat } from '../types.ts';
import type { Manifest } from '../types.ts';

describe('ConfigurationManager', () => {
  let testDir: string;
  let manifestPath: string;

  beforeEach(async () => {
    // Create unique test directory for each test
    testDir = join(process.cwd(), '.tmp', `config-tests-${Date.now()}`);
    manifestPath = join(testDir, 'manifest.yaml');
    await mkdir(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await remove(testDir);
  });

  test('loads manifest and merges with CLI options', async () => {
    // Create manifest
    const manifest: Manifest = {
      title: 'Test Book',
      authors: ['Test Author'],
      styles: ['themes/classic.css'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const manager = new ConfigurationManager(testDir, { verbose: true });
    await manager.initialize();

    const config = manager.getConfig();
    expect(config.verbose).toBe(true);
    expect(config.title).toBe('Test Book');
    expect(config.authors).toEqual(['Test Author']);
  });

  test('CLI options override manifest settings', async () => {
    // Create manifest with default timeout
    const manifest: Manifest = {
      title: 'Test Book',
      authors: ['Test Author'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const manager = new ConfigurationManager(testDir, {
      timeout: 5000,
      format: OutputFormat.HTML
    });
    await manager.initialize();

    const config = manager.getConfig();
    expect(config.timeout).toBe(5000);
    expect(config.format).toBe(OutputFormat.HTML);
  });

  test('provides defaults for missing values', async () => {
    // Create minimal manifest
    const manifest: Manifest = {
      title: 'Minimal Book',
      authors: ['Test Author'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const manager = new ConfigurationManager(testDir, {});
    await manager.initialize();

    const config = manager.getConfig();
    expect(config.verbose).toBe(false);
    expect(config.debug).toBe(false);
    expect(config.watch).toBe(false);
    expect(config.force).toBe(false);
    expect(config.timeout).toBeGreaterThan(0); // Has a default timeout
  });

  test('works without manifest file', async () => {
    // No manifest.yaml created
    const manager = new ConfigurationManager(testDir, { verbose: true });
    await manager.initialize();

    const config = manager.getConfig();
    expect(config.verbose).toBe(true);
    expect(config.input).toBe(testDir);
    expect(manager.getManifest()).toBeNull();
  });

  test('getBuildFormat returns correct format', async () => {
    const manager = new ConfigurationManager(testDir, { format: OutputFormat.HTML });
    await manager.initialize();

    expect(manager.getBuildFormat()).toBe(OutputFormat.HTML);
  });

  test('handles file input path', async () => {
    const testFile = join(testDir, 'test.md');
    await writeFile(testFile, '# Test');

    const manifest: Manifest = {
      title: 'Test',
      authors: ['Test Author'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const manager = new ConfigurationManager(testFile, {});
    await manager.initialize();

    const config = manager.getConfig();
    expect(config.title).toBe('Test');
    expect(config.input).toBe(testFile);
  });

  test('createConfigManager helper function', async () => {
    const manifest: Manifest = {
      title: 'Helper Test',
      authors: ['Test Author'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const manager = await createConfigManager(testDir, { verbose: true });

    const config = manager.getConfig();
    expect(config.title).toBe('Helper Test');
    expect(config.verbose).toBe(true);
  });

  test('preserves all CLI options', async () => {
    const manager = new ConfigurationManager(testDir, {
      output: 'custom.pdf',
      htmlOutput: 'custom.html',
      timeout: 10000,
      verbose: true,
      debug: true,
      format: OutputFormat.PDF,
      watch: true,
      force: true,
    });
    await manager.initialize();

    const config = manager.getConfig();
    expect(config.output).toBe('custom.pdf');
    expect(config.htmlOutput).toBe('custom.html');
    expect(config.timeout).toBe(10000);
    expect(config.verbose).toBe(true);
    expect(config.debug).toBe(true);
    expect(config.format).toBe(OutputFormat.PDF);
    expect(config.watch).toBe(true);
    expect(config.force).toBe(true);
  });

  test('handles manifest with styles', async () => {
    const manifest: Manifest = {
      title: 'Styled Book',
      authors: ['Test Author'],
      styles: ['custom1.css', 'custom2.css'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const manager = new ConfigurationManager(testDir, {});
    await manager.initialize();

    const config = manager.getConfig();
    expect(config.styles).toEqual(['custom1.css', 'custom2.css']);
  });

  test('handles manifest with file list', async () => {
    const manifest: Manifest = {
      title: 'Multi-file Book',
      authors: ['Test Author'],
      files: ['chapter1.md', 'chapter2.md', 'chapter3.md'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const manager = new ConfigurationManager(testDir, {});
    await manager.initialize();

    const config = manager.getConfig();
    expect(config.files).toEqual(['chapter1.md', 'chapter2.md', 'chapter3.md']);
  });

  test('default format is PDF', async () => {
    const manager = new ConfigurationManager(testDir, {});
    await manager.initialize();

    expect(manager.getBuildFormat()).toBe(OutputFormat.PDF);
  });

  test('handles minimal manifest', async () => {
    // Minimal valid manifest with only required fields
    const manifest: Manifest = {
      title: 'Minimal Book',
      authors: ['Test Author'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const manager = new ConfigurationManager(testDir, {});
    await manager.initialize();

    const config = manager.getConfig();
    expect(config.input).toBe(testDir);
    // Should still have defaults
    expect(config.verbose).toBe(false);
    expect(config.format).toBe(OutputFormat.PDF);
  });
});
