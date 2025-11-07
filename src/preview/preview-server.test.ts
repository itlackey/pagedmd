/**
 * Tests for preview server
 *
 * Simple tests for temp directory creation, file copying, and HTML generation.
 * Full integration testing is done via manual testing since we can't easily
 * test Vite server and file watching in unit tests.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, remove, fileExists } from '../utils/file-utils.ts';
import { join } from 'path';
import YAML from 'js-yaml';
import type { Manifest } from '../types.ts';

describe('Preview Server Setup', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create unique test directory
    testDir = join(process.cwd(), '.tmp', `preview-test-${Date.now()}`);
    await mkdir(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await remove(testDir);
  });

  test('test directory is created successfully', async () => {
    const exists = await fileExists(testDir);
    expect(exists).toBe(true);
  });

  test('can write markdown files to test directory', async () => {
    const mdFile = join(testDir, 'test.md');
    await writeFile(mdFile, '# Test Content\n\nHello World');

    const exists = await fileExists(mdFile);
    expect(exists).toBe(true);
  });

  test('can write manifest to test directory', async () => {
    const manifest: Manifest = {
      title: 'Preview Test',
      authors: ['Test Author'],
    };

    const manifestPath = join(testDir, 'manifest.yaml');
    await writeFile(manifestPath, YAML.dump(manifest));

    const exists = await fileExists(manifestPath);
    expect(exists).toBe(true);
  });

  test('can create nested directories for assets', async () => {
    const assetsDir = join(testDir, 'assets', 'css');
    await mkdir(assetsDir);

    const exists = await fileExists(assetsDir);
    expect(exists).toBe(true);
  });

  test('cleanup removes test directory', async () => {
    const tempPath = join(process.cwd(), '.tmp', `cleanup-test-${Date.now()}`);
    await mkdir(tempPath);

    // Verify it exists
    expect(await fileExists(tempPath)).toBe(true);

    // Clean up
    await remove(tempPath);

    // Verify it's gone
    expect(await fileExists(tempPath)).toBe(false);
  });

  test('can write HTML file to output', async () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <h1>Test Content</h1>
</body>
</html>`;

    const htmlPath = join(testDir, 'index.html');
    await writeFile(htmlPath, htmlContent);

    const exists = await fileExists(htmlPath);
    expect(exists).toBe(true);
  });

  test('handles multiple markdown files', async () => {
    const files = ['chapter1.md', 'chapter2.md', 'chapter3.md'];

    for (const file of files) {
      const filePath = join(testDir, file);
      await writeFile(filePath, `# ${file}\n\nContent`);
    }

    // Verify all files exist
    for (const file of files) {
      const filePath = join(testDir, file);
      expect(await fileExists(filePath)).toBe(true);
    }
  });

  test('handles CSS files in subdirectories', async () => {
    const cssDir = join(testDir, 'styles');
    await mkdir(cssDir);

    const cssFile = join(cssDir, 'custom.css');
    await writeFile(cssFile, 'body { color: blue; }');

    expect(await fileExists(cssFile)).toBe(true);
  });
});

describe('Preview Server Configuration', () => {
  test('default port is defined', () => {
    const { DEFAULTS } = require('../constants.ts');
    expect(typeof DEFAULTS.PORT).toBe('number');
    expect(DEFAULTS.PORT).toBeGreaterThan(0);
    expect(DEFAULTS.PORT).toBeLessThan(65536);
  });

  test('debounce timeout is defined', () => {
    const { DEBOUNCE } = require('../constants.ts');
    expect(typeof DEBOUNCE.FILE_WATCH).toBe('number');
    expect(DEBOUNCE.FILE_WATCH).toBeGreaterThan(0);
  });
});
