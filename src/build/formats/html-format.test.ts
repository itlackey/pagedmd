/**
 * Tests for HTML format strategy
 *
 * Tests the HTML output generation including directory creation,
 * file writing, and asset copying
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdir, writeFile, remove, fileExists, readFile } from '../../utils/file-utils.ts';
import { HtmlFormatStrategy } from './html-format.ts';
import type { BuildOptions } from '../../types.ts';

describe('HTML Format Strategy', () => {
  let testDir: string;
  let strategy: HtmlFormatStrategy;
  let options: BuildOptions;

  beforeEach(async () => {
    testDir = join(process.cwd(), '.tmp', `html-format-tests-${Date.now()}`);
    await mkdir(testDir);
    strategy = new HtmlFormatStrategy();

    options = {
      input: testDir,
      output: join(testDir, 'output-html'),
      format: 'html',
      verbose: false,
      debug: false,
    };
  });

  afterEach(async () => {
    await remove(testDir);
  });

  test('builds HTML directory with index.html', async () => {
    const htmlContent = '<html><body><h1>Test</h1></body></html>';

    const outputPath = await strategy.build(options, htmlContent);

    expect(await fileExists(outputPath)).toBe(true);
    expect(await fileExists(join(outputPath, 'index.html'))).toBe(true);

    const written = await readFile(join(outputPath, 'index.html'));
    expect(written).toContain('<h1>Test</h1>');
  });

  test('creates output directory if it does not exist', async () => {
    const htmlContent = '<html><body>Test</body></html>';
    const outputPath = join(testDir, 'nested', 'deep', 'output');

    options.output = outputPath;

    await strategy.build(options, htmlContent);

    expect(await fileExists(outputPath)).toBe(true);
    expect(await fileExists(join(outputPath, 'index.html'))).toBe(true);
  });

  test('copies assets from input directory', async () => {
    // Create test assets
    const assetsDir = join(testDir, 'assets');
    await mkdir(assetsDir);
    await writeFile(join(assetsDir, 'style.css'), 'body { color: red; }');
    await writeFile(join(assetsDir, 'logo.png'), 'fake-image-data');

    const htmlContent = '<html><body>Test</body></html>';

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

    const htmlContent = '<html><body>Test</body></html>';

    const outputPath = await strategy.build(options, htmlContent);

    // Markdown file should not be copied
    expect(await fileExists(join(outputPath, 'test.md'))).toBe(false);
    // Other files should be copied
    expect(await fileExists(join(outputPath, 'other.txt'))).toBe(true);
  });

  test('does not copy manifest.yaml in non-debug mode', async () => {
    await writeFile(join(testDir, 'manifest.yaml'), 'title: Test');

    const htmlContent = '<html><body>Test</body></html>';
    options.debug = false;

    const outputPath = await strategy.build(options, htmlContent);

    expect(await fileExists(join(outputPath, 'manifest.yaml'))).toBe(false);
  });

  test('copies manifest.yaml in debug mode', async () => {
    await writeFile(join(testDir, 'manifest.yaml'), 'title: Test');

    const htmlContent = '<html><body>Test</body></html>';
    options.debug = true;

    const outputPath = await strategy.build(options, htmlContent);

    expect(await fileExists(join(outputPath, 'manifest.yaml'))).toBe(true);
  });

  test('validates output path correctly', () => {
    const result = strategy.validateOutputPath('/test/output', false);

    expect(result.valid).toBe(true);
    expect(result.path).toBe('/test/output');
  });

  test('cleanup does nothing (HTML has no temp files)', async () => {
    // HTML format doesn't create temp files, so cleanup should be a no-op
    await expect(strategy.cleanup(options)).resolves.toBeUndefined();
  });

  test('preserves nested directory structure', async () => {
    // Create nested assets
    const nestedDir = join(testDir, 'images', 'photos');
    await mkdir(nestedDir);
    await writeFile(join(nestedDir, 'photo.jpg'), 'fake-photo-data');

    const htmlContent = '<html><body>Test</body></html>';

    const outputPath = await strategy.build(options, htmlContent);

    // Verify nested structure is preserved
    expect(await fileExists(join(outputPath, 'images', 'photos', 'photo.jpg'))).toBe(true);
  });

  test('handles empty input directory gracefully', async () => {
    const htmlContent = '<html><body>Empty</body></html>';

    const outputPath = await strategy.build(options, htmlContent);

    // Should still create index.html even with no assets
    expect(await fileExists(join(outputPath, 'index.html'))).toBe(true);
  });

  test('overwrites existing output directory', async () => {
    // Create existing output with old content
    await mkdir(options.output!);
    await writeFile(join(options.output!, 'old-file.txt'), 'old content');

    const htmlContent = '<html><body>New</body></html>';

    await strategy.build(options, htmlContent);

    // index.html should exist with new content
    expect(await fileExists(join(options.output!, 'index.html'))).toBe(true);
    const content = await readFile(join(options.output!, 'index.html'));
    expect(content).toContain('New');
  });
});
