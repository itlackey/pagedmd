/**
 * Integration tests for CLI build command
 *
 * Tests the complete build pipeline from CLI invocation to output generation
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdir, writeFile, remove, fileExists } from '../../src/utils/file-utils.ts';
import { executeBuildProcess } from '../../src/cli.ts';
import YAML from 'js-yaml';
import type { Manifest } from '../../src/types.ts';

describe('CLI Build Command Integration Tests', () => {
  let testDir: string;
  let manifestPath: string;
  let markdownPath: string;

  beforeEach(async () => {
    // Create unique test directory
    testDir = join(process.cwd(), '.tmp', `cli-build-tests-${Date.now()}`);
    manifestPath = join(testDir, 'manifest.yaml');
    markdownPath = join(testDir, 'test.md');
    await mkdir(testDir);

    // Create minimal manifest
    const manifest: Manifest = {
      title: 'Test Document',
      authors: ['Test Author'],
      styles: [],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    // Create test markdown file
    await writeFile(
      markdownPath,
      '# Test Chapter\n\nThis is a test document.\n\n## Section\n\nSome content here.'
    );
  });

  afterEach(async () => {
    // Clean up test directory
    await remove(testDir);
  });

  test('builds PDF from markdown directory', async () => {
    const outputPath = join(testDir, 'output.pdf');

    await executeBuildProcess(
      {
        output: outputPath,
        timeout: '60000',
        verbose: false,
        debug: false,
        format: 'pdf',
      },
      testDir
    );

    // Verify output file was created
    expect(await fileExists(outputPath)).toBe(true);
  });

  test('builds HTML from markdown directory', async () => {
    const outputPath = join(testDir, 'output-html');

    await executeBuildProcess(
      {
        output: outputPath,
        timeout: '60000',
        verbose: false,
        debug: false,
        format: 'html',
      },
      testDir
    );

    // Verify output directory and index.html exist
    expect(await fileExists(outputPath)).toBe(true);
    expect(await fileExists(join(outputPath, 'index.html'))).toBe(true);
  });

  test('builds with custom timeout', async () => {
    const outputPath = join(testDir, 'output.pdf');

    await executeBuildProcess(
      {
        output: outputPath,
        timeout: '120000', // 2 minutes
        verbose: false,
        debug: false,
        format: 'pdf',
      },
      testDir
    );

    expect(await fileExists(outputPath)).toBe(true);
  });

  test('saves intermediate HTML when requested', async () => {
    const outputPath = join(testDir, 'output.pdf');
    const htmlOutputPath = join(testDir, 'intermediate.html');

    await executeBuildProcess(
      {
        output: outputPath,
        htmlOutput: htmlOutputPath,
        timeout: '60000',
        verbose: false,
        debug: false,
        format: 'pdf',
      },
      testDir
    );

    // Verify both PDF and intermediate HTML exist
    expect(await fileExists(outputPath)).toBe(true);
    expect(await fileExists(htmlOutputPath)).toBe(true);
  });

  test('throws error for invalid input path', async () => {
    const outputPath = join(testDir, 'output.pdf');
    const nonExistentPath = join(testDir, 'does-not-exist');

    await expect(
      executeBuildProcess(
        {
          output: outputPath,
          timeout: '60000',
          verbose: false,
          debug: false,
          format: 'pdf',
        },
        nonExistentPath
      )
    ).rejects.toThrow();
  });

  test('throws error for invalid timeout value', async () => {
    const outputPath = join(testDir, 'output.pdf');

    await expect(
      executeBuildProcess(
        {
          output: outputPath,
          timeout: 'invalid',
          verbose: false,
          debug: false,
          format: 'pdf',
        },
        testDir
      )
    ).rejects.toThrow(/Invalid timeout value/);
  });

  test('throws error for negative timeout', async () => {
    const outputPath = join(testDir, 'output.pdf');

    await expect(
      executeBuildProcess(
        {
          output: outputPath,
          timeout: '-1000',
          verbose: false,
          debug: false,
          format: 'pdf',
        },
        testDir
      )
    ).rejects.toThrow(/Invalid timeout value/);
  });

  test('builds successfully with verbose mode', async () => {
    const outputPath = join(testDir, 'output.pdf');

    // Should not throw and should complete successfully
    await executeBuildProcess(
      {
        output: outputPath,
        timeout: '60000',
        verbose: true, // Enable verbose logging
        debug: false,
        format: 'pdf',
      },
      testDir
    );

    expect(await fileExists(outputPath)).toBe(true);
  });

  test('processes multiple markdown files in order', async () => {
    // Create multiple markdown files
    await writeFile(join(testDir, 'chapter-01.md'), '# Chapter 1\n\nFirst chapter.');
    await writeFile(join(testDir, 'chapter-02.md'), '# Chapter 2\n\nSecond chapter.');
    await writeFile(join(testDir, 'chapter-03.md'), '# Chapter 3\n\nThird chapter.');

    // Update manifest with explicit file order
    const manifest: Manifest = {
      title: 'Multi-Chapter Book',
      authors: ['Test Author'],
      files: ['chapter-01.md', 'chapter-02.md', 'chapter-03.md'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const outputPath = join(testDir, 'output.pdf');

    await executeBuildProcess(
      {
        output: outputPath,
        timeout: '60000',
        verbose: false,
        debug: false,
        format: 'pdf',
      },
      testDir
    );

    expect(await fileExists(outputPath)).toBe(true);
  });
});
