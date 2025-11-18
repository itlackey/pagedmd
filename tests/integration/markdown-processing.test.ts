/**
 * Integration tests for markdown processing pipeline
 *
 * Tests the complete markdown-to-HTML conversion with plugins and directives
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdir, writeFile, remove } from '../../src/utils/file-utils.ts';
import { processMarkdownFiles, generateHtmlFromMarkdown } from '../../src/markdown/markdown.ts';
import type { ResolvedConfig } from '../../src/config/config-state.ts';
import YAML from 'js-yaml';
import type { Manifest } from '../../src/types.ts';

describe('Markdown Processing Integration Tests', () => {
  let testDir: string;
  let config: ResolvedConfig;

  beforeEach(async () => {
    testDir = join(process.cwd(), '.tmp', `markdown-tests-${Date.now()}`);
    await mkdir(testDir);

    config = {
      verbose: false,
      debug: false,
      timeout: 60000,
      input: testDir,
    } as ResolvedConfig;
  });

  afterEach(async () => {
    await remove(testDir);
  });

  test('processes basic markdown to HTML', async () => {
    const mdPath = join(testDir, 'test.md');
    await writeFile(mdPath, '# Hello World\n\nThis is a **test**.');

    const result = await processMarkdownFiles(testDir, config);

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('test');
    expect(result[0]?.html).toContain('<h1');
    expect(result[0]?.html).toContain('Hello World');
    expect(result[0]?.html).toContain('<strong>test</strong>');
  });

  test('processes multiple markdown files', async () => {
    await writeFile(join(testDir, 'chapter-1.md'), '# Chapter 1');
    await writeFile(join(testDir, 'chapter-2.md'), '# Chapter 2');
    await writeFile(join(testDir, 'chapter-3.md'), '# Chapter 3');

    const result = await processMarkdownFiles(testDir, config);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.slug).sort()).toEqual(['chapter-1', 'chapter-2', 'chapter-3']);
  });

  test('respects manifest file ordering', async () => {
    await writeFile(join(testDir, 'intro.md'), '# Introduction');
    await writeFile(join(testDir, 'conclusion.md'), '# Conclusion');
    await writeFile(join(testDir, 'body.md'), '# Body');

    const configWithFiles: ResolvedConfig = {
      ...config,
      files: ['intro.md', 'body.md', 'conclusion.md'],
    };

    const result = await processMarkdownFiles(testDir, configWithFiles);

    expect(result).toHaveLength(3);
    expect(result[0]?.slug).toBe('intro');
    expect(result[1]?.slug).toBe('body');
    expect(result[2]?.slug).toBe('conclusion');
  });

  test('handles TTRPG directives when enabled', async () => {
    const mdPath = join(testDir, 'game.md');
    await writeFile(
      mdPath,
      '# Monster\n\n{HP:25 AC:15}\n\n**Special Ability:** Roll 2d6+3 for damage.'
    );

    const configWithTtrpg: ResolvedConfig = {
      ...config,
      extensions: ['ttrpg'],
    };

    const result = await processMarkdownFiles(testDir, configWithTtrpg);

    expect(result[0]?.html).toContain('HP');
    expect(result[0]?.html).toContain('25');
    expect(result[0]?.html).toContain('2d6+3');
  });

  test('handles Dimm City syntax when enabled', async () => {
    const mdPath = join(testDir, 'district.md');
    await writeFile(mdPath, '# District Guide\n\n#TechD - Technology District');

    const configWithDimm: ResolvedConfig = {
      ...config,
      extensions: ['dimm-city'],
    };

    const result = await processMarkdownFiles(testDir, configWithDimm);

    expect(result[0]?.html).toContain('TechD');
  });

  test('generates complete HTML document with metadata', async () => {
    const mdPath = join(testDir, 'test.md');
    const manifestPath = join(testDir, 'manifest.yaml');

    await writeFile(mdPath, '# Test Document\n\nContent here.');

    const manifest: Manifest = {
      title: 'My Test Book',
      authors: ['Author One', 'Author Two'],
    };
    await writeFile(manifestPath, YAML.dump(manifest));

    const html = await generateHtmlFromMarkdown(testDir, config);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>My Test Book</title>');
    expect(html).toContain('Author One, Author Two');
    expect(html).toContain('Test Document');
  });

  test('throws error for empty directory', async () => {
    await expect(processMarkdownFiles(testDir, config)).rejects.toThrow();
  });

  test('throws error when manifest file is missing from files list', async () => {
    await writeFile(join(testDir, 'exists.md'), '# Exists');

    const configWithMissingFile: ResolvedConfig = {
      ...config,
      files: ['exists.md', 'missing.md'],
    };

    await expect(processMarkdownFiles(testDir, configWithMissingFile)).rejects.toThrow(
      /File not found/
    );
  });

  test('processes single markdown file (not directory)', async () => {
    const mdPath = join(testDir, 'single.md');
    await writeFile(mdPath, '# Single File\n\nJust one file.');

    const result = await processMarkdownFiles(mdPath, config);

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('single');
    expect(result[0]?.html).toContain('Single File');
  });

  test('handles markdown with images and links', async () => {
    const mdPath = join(testDir, 'media.md');
    await writeFile(
      mdPath,
      '# Media Test\n\n![Alt text](image.png)\n\n[Link text](https://example.com)'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('<img');
    expect(result[0]?.html).toContain('image.png');
    expect(result[0]?.html).toContain('<a');
    expect(result[0]?.html).toContain('https://example.com');
  });

  test('handles markdown with code blocks', async () => {
    const mdPath = join(testDir, 'code.md');
    await writeFile(
      mdPath,
      '# Code Example\n\n```javascript\nconst x = 42;\nconsole.log(x);\n```'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('<pre>');
    expect(result[0]?.html).toContain('<code');
    expect(result[0]?.html).toContain('const x = 42');
  });

  test('handles markdown with tables', async () => {
    const mdPath = join(testDir, 'table.md');
    await writeFile(
      mdPath,
      '# Table\n\n| Name | Value |\n|------|-------|\n| A    | 1     |\n| B    | 2     |'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('<table');
    expect(result[0]?.html).toContain('<th>');
    expect(result[0]?.html).toContain('<td>');
  });
});
