/**
 * Tests for Preview format strategy
 *
 * Tests the Preview output generation including directory creation,
 * file writing, and asset copying
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdir, writeFile, remove, fileExists, readFile } from '../../utils/file-utils.ts';
import { PreviewFormatStrategy } from './preview-format.ts';
import type { BuildOptions } from '../../types.ts';

describe('Preview Format Strategy - Build', () => {
  let testDir: string;
  let strategy: PreviewFormatStrategy;
  let options: BuildOptions;

  beforeEach(async () => {
    testDir = join(process.cwd(), '.tmp', `preview-format-tests-${Date.now()}`);
    await mkdir(testDir);
    strategy = new PreviewFormatStrategy();

    options = {
      input: testDir,
      output: join(testDir, 'output-preview'),
      format: 'preview',
      verbose: false,
      debug: false,
    };
  });

  afterEach(async () => {
    // Cleanup with extended timeout for slow file system operations
    try {
      await remove(testDir);
    } catch (error) {
      // Ignore cleanup errors to prevent test failures
      console.warn(`Cleanup failed for ${testDir}:`, error);
    }
  }, 60000); // 60 second timeout for cleanup (file system can be slow)

  test('builds Preview directory with preview.html', async () => {
    const htmlContent = '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>';

    const outputPath = await strategy.build(options, htmlContent);

    expect(await fileExists(outputPath)).toBe(true);
    expect(await fileExists(join(outputPath, 'preview.html'))).toBe(true);

    const written = await readFile(join(outputPath, 'preview.html'));
    expect(written).toContain('<h1>Test</h1>');
    expect(written).toContain('<!DOCTYPE html>');
  });

  test('adds doctype if missing', async () => {
    const htmlContent = '<html><head><title>Test</title></head><body>No doctype</body></html>';

    const outputPath = await strategy.build(options, htmlContent);
    const written = await readFile(join(outputPath, 'preview.html'));

    expect(written.trim().toLowerCase()).toMatch(/^<!doctype html>/);
  });

  test('preserves existing doctype', async () => {
    const htmlContent = '<!DOCTYPE html><html><head><title>Test</title></head><body>Has doctype</body></html>';

    const outputPath = await strategy.build(options, htmlContent);
    const written = await readFile(join(outputPath, 'preview.html'));

    // Should not have double doctype
    const doctypeMatches = written.match(/<!DOCTYPE/gi);
    expect(doctypeMatches?.length).toBe(1);
  });

  test('creates output directory if it does not exist', async () => {
    const htmlContent = '<html><head></head><body>Test</body></html>';
    const outputPath = join(testDir, 'nested', 'deep', 'output');

    options.output = outputPath;

    await strategy.build(options, htmlContent);

    expect(await fileExists(outputPath)).toBe(true);
    expect(await fileExists(join(outputPath, 'preview.html'))).toBe(true);
  }, 45000); // Extended timeout for nested directory creation and cleanup

  test('copies assets from input directory', async () => {
    // Create test assets
    const assetsDir = join(testDir, 'assets');
    await mkdir(assetsDir);
    await writeFile(join(assetsDir, 'style.css'), 'body { color: red; }');
    await writeFile(join(assetsDir, 'logo.png'), 'fake-image-data');

    const htmlContent = '<html><head></head><body>Test</body></html>';

    const outputPath = await strategy.build(options, htmlContent);

    // Verify assets were copied
    expect(await fileExists(join(outputPath, 'assets', 'style.css'))).toBe(true);
    expect(await fileExists(join(outputPath, 'assets', 'logo.png'))).toBe(true);

    const cssContent = await readFile(join(outputPath, 'assets', 'style.css'));
    expect(cssContent).toBe('body { color: red; }');
  });

  test('does not copy markdown files to output', async () => {
    await writeFile(join(testDir, 'test.md'), '# Test Markdown');
    await writeFile(join(testDir, 'other.txt'), 'text file');

    const htmlContent = '<html><head></head><body>Test</body></html>';

    const outputPath = await strategy.build(options, htmlContent);

    // Markdown file should not be copied
    expect(await fileExists(join(outputPath, 'test.md'))).toBe(false);
    // Other files should be copied
    expect(await fileExists(join(outputPath, 'other.txt'))).toBe(true);
  });

  test('preserves nested directory structure', async () => {
    // Create nested assets
    const nestedDir = join(testDir, 'images', 'photos');
    await mkdir(nestedDir);
    await writeFile(join(nestedDir, 'photo.jpg'), 'fake-photo-data');

    const htmlContent = '<html><head></head><body>Test</body></html>';

    const outputPath = await strategy.build(options, htmlContent);

    // Verify nested structure is preserved
    expect(await fileExists(join(outputPath, 'images', 'photos', 'photo.jpg'))).toBe(true);
  });

  test('handles empty input directory gracefully', async () => {
    const htmlContent = '<html><head></head><body>Empty</body></html>';

    const outputPath = await strategy.build(options, htmlContent);

    // Should still create preview.html even with no assets
    expect(await fileExists(join(outputPath, 'preview.html'))).toBe(true);
  });

  test('overwrites existing output directory', async () => {
    // Create existing output with old content
    await mkdir(options.output!);
    await writeFile(join(options.output!, 'old-file.txt'), 'old content');

    const htmlContent = '<html><head></head><body>New</body></html>';

    await strategy.build(options, htmlContent);

    // preview.html should exist with new content
    expect(await fileExists(join(options.output!, 'preview.html'))).toBe(true);
    const content = await readFile(join(options.output!, 'preview.html'));
    expect(content).toContain('New');
  });

  test('handles relative output paths', async () => {
    const htmlContent = '<html><head></head><body>Test</body></html>';

    // Use relative path
    options.output = 'relative-output';

    const outputPath = await strategy.build(options, htmlContent);

    // Should convert to absolute path
    expect(outputPath).toContain(process.cwd());
    expect(await fileExists(join(outputPath, 'preview.html'))).toBe(true);
  });

  test('uses input basename for default output path', async () => {
    const htmlContent = '<html><head></head><body>Test</body></html>';

    // Don't specify output, should use input basename + '-preview'
    options.output = undefined;

    const outputPath = await strategy.build(options, htmlContent);

    // Should contain input directory basename
    const inputBasename = testDir.split('/').pop();
    expect(outputPath).toContain(`${inputBasename}-preview`);
    expect(await fileExists(join(outputPath, 'preview.html'))).toBe(true);
  });

  test('validates output path correctly for non-existent path', () => {
    // Use testDir as parent (exists), with new child directory (doesn't exist)
    const outputPath = join(testDir, 'new-output');
    const result = strategy.validateOutputPath(outputPath, false);

    expect(result.isValid).toBe(true);
    expect(result.conflictType).toBe('none');
  });

  test('validates output path fails when parent directory missing', () => {
    // Use path with non-existent parent
    const result = strategy.validateOutputPath('/nonexistent/parent/output', false);

    expect(result.isValid).toBe(false);
    expect(result.conflictType).toBe('parent-missing');
  });

  test('cleanup does nothing (Preview has no temp files)', async () => {
    // Preview format doesn't create temp files, so cleanup should be a no-op
    await expect(strategy.cleanup(options)).resolves.toBeUndefined();
  });
});
