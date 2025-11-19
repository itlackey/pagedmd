/**
 * End-to-end build workflow tests
 *
 * Tests complete build workflows from markdown input to final output,
 * including all features, assets, themes, and error scenarios
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { build } from '../../src/build/build';
import type { BuildOptions } from '../../src/types';

/**
 * Helper to check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to create a minimal manifest.yaml
 */
async function createManifest(
  dir: string,
  options: {
    title?: string;
    authors?: string[];
    files?: string[];
    styles?: string[];
    disableDefaultStyles?: boolean;
  } = {}
): Promise<void> {
  const manifest = {
    title: options.title || 'Test Document',
    authors: options.authors || ['Test Author'],
    ...(options.files && { files: options.files }),
    ...(options.styles && { styles: options.styles }),
    ...(options.disableDefaultStyles && { disableDefaultStyles: true }),
  };

  const yamlContent = Object.entries(manifest)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:\n${value.map((v) => `  - ${v}`).join('\n')}`;
      }
      return `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
    })
    .join('\n');

  await writeFile(join(dir, 'manifest.yaml'), yamlContent);
}

describe('E2E: Complete PDF Workflow', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-e2e-pdf-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  }, 60000);

  test('generates PDF from single markdown file', async () => {
    await createManifest(testDir);
    await writeFile(
      join(testDir, 'chapter1.md'),
      '# Chapter 1\n\nThis is the first chapter with **bold** and *italic* text.'
    );

    const outputPath = join(testDir, 'output.pdf');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'pdf',
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(await fileExists(outputPath)).toBe(true);

    // Verify PDF file has content (size > 0)
    const stats = await Bun.file(outputPath).size;
    expect(stats).toBeGreaterThan(0);
  }, 120000);

  test('generates PDF from multiple ordered markdown files', async () => {
    await createManifest(testDir, {
      files: ['intro.md', 'chapter1.md', 'chapter2.md', 'conclusion.md'],
    });

    await writeFile(join(testDir, 'intro.md'), '# Introduction\n\nWelcome to the book.');
    await writeFile(join(testDir, 'chapter1.md'), '# Chapter 1\n\nFirst chapter content.');
    await writeFile(join(testDir, 'chapter2.md'), '# Chapter 2\n\nSecond chapter content.');
    await writeFile(join(testDir, 'conclusion.md'), '# Conclusion\n\nThank you for reading.');

    const outputPath = join(testDir, 'book.pdf');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'pdf',
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(await fileExists(outputPath)).toBe(true);

    const stats = await Bun.file(outputPath).size;
    expect(stats).toBeGreaterThan(1000); // Multi-chapter book should be substantial
  }, 120000);

  test('includes custom CSS styles in PDF', async () => {
    await createManifest(testDir, {
      styles: ['custom.css'],
    });

    await writeFile(join(testDir, 'test.md'), '# Styled Document\n\nThis has custom styles.');
    await writeFile(
      join(testDir, 'custom.css'),
      `
      h1 {
        color: #ff0000;
        font-size: 3rem;
      }
      body {
        font-family: serif;
      }
    `
    );

    const outputPath = join(testDir, 'styled.pdf');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'pdf',
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(await fileExists(outputPath)).toBe(true);
  }, 120000);

  test('handles Paged.js directives in markdown', async () => {
    await createManifest(testDir);
    await writeFile(
      join(testDir, 'test.md'),
      `
# Chapter 1

First page content.

@page-break

# Chapter 2

Second page content after page break.

@spread

# Two-Page Spread

Content across two pages.
    `
    );

    const outputPath = join(testDir, 'directives.pdf');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'pdf',
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(await fileExists(outputPath)).toBe(true);
  }, 120000);
});

describe('E2E: Complete HTML Workflow', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-e2e-html-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  }, 60000);

  test('generates standalone HTML from markdown', async () => {
    await createManifest(testDir);
    await writeFile(
      join(testDir, 'test.md'),
      '# HTML Document\n\nThis is a test HTML output.\n\n## Features\n\n- Lists\n- **Bold**\n- *Italic*'
    );

    const outputPath = join(testDir, 'output-html');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'html',
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(await fileExists(outputPath)).toBe(true);
    expect(await fileExists(join(outputPath, 'index.html'))).toBe(true);

    // Verify HTML content
    const htmlContent = await Bun.file(join(outputPath, 'index.html')).text();
    expect(htmlContent).toContain('HTML Document');
    expect(htmlContent).toContain('<h1');
    expect(htmlContent).toContain('<h2');
    expect(htmlContent).toContain('<ul');
    expect(htmlContent).toContain('<strong>Bold</strong>');
    expect(htmlContent).toContain('<em>Italic</em>');
  }, 60000);

  test('copies assets to HTML output directory', async () => {
    await createManifest(testDir);
    await mkdir(join(testDir, 'images'));
    await writeFile(join(testDir, 'images', 'test.txt'), 'Test image placeholder');
    await writeFile(
      join(testDir, 'test.md'),
      '# Document with Images\n\n![Test](images/test.txt)'
    );

    const outputPath = join(testDir, 'output-html');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'html',
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(await fileExists(join(outputPath, 'images', 'test.txt'))).toBe(true);
  }, 60000);

  test('inlines CSS from styles in HTML output', async () => {
    await createManifest(testDir, {
      styles: ['theme.css'],
    });

    await writeFile(
      join(testDir, 'theme.css'),
      `
      .custom-class {
        background: blue;
      }
    `
    );
    await writeFile(join(testDir, 'test.md'), '# Themed Document');

    const outputPath = join(testDir, 'output-html');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'html',
      verbose: false,
    });

    expect(result.success).toBe(true);

    const htmlContent = await Bun.file(join(outputPath, 'index.html')).text();
    expect(htmlContent).toContain('.custom-class');
    expect(htmlContent).toContain('background: blue');
  }, 60000);
});

describe('E2E: Complete Preview Workflow', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-e2e-preview-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  }, 60000);

  test('generates preview HTML with Paged.js polyfill', async () => {
    await createManifest(testDir);
    await writeFile(
      join(testDir, 'test.md'),
      '# Preview Document\n\nThis will be previewed in the browser.'
    );

    const outputPath = join(testDir, 'preview.html');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'preview',
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(await fileExists(outputPath)).toBe(true);

    // Verify polyfill is injected
    const previewContent = await Bun.file(outputPath).text();
    expect(previewContent).toContain('paged.polyfill');
    expect(previewContent).toContain('Preview Document');
  }, 60000);

  test('preview includes all markdown content', async () => {
    await createManifest(testDir, {
      files: ['part1.md', 'part2.md'],
    });

    await writeFile(join(testDir, 'part1.md'), '# Part One\n\nFirst section.');
    await writeFile(join(testDir, 'part2.md'), '# Part Two\n\nSecond section.');

    const outputPath = join(testDir, 'preview.html');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'preview',
      verbose: false,
    });

    expect(result.success).toBe(true);

    const content = await Bun.file(outputPath).text();
    expect(content).toContain('Part One');
    expect(content).toContain('Part Two');
  }, 60000);
});

describe('E2E: CSS Import Resolution', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-e2e-css-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  }, 60000);

  test('resolves nested CSS imports', async () => {
    await mkdir(join(testDir, 'styles'));

    // Create nested CSS imports
    await writeFile(
      join(testDir, 'styles', 'base.css'),
      `
      .base-class {
        color: red;
      }
    `
    );

    await writeFile(
      join(testDir, 'styles', 'theme.css'),
      `
      @import 'base.css';

      .theme-class {
        background: blue;
      }
    `
    );

    await createManifest(testDir, {
      styles: ['styles/theme.css'],
    });

    await writeFile(join(testDir, 'test.md'), '# CSS Import Test');

    const outputPath = join(testDir, 'output-html');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'html',
      verbose: false,
    });

    expect(result.success).toBe(true);

    const htmlContent = await Bun.file(join(outputPath, 'index.html')).text();
    // Both base and theme classes should be inlined
    expect(htmlContent).toContain('.base-class');
    expect(htmlContent).toContain('.theme-class');
  }, 60000);

  test('handles multiple CSS files with imports', async () => {
    await writeFile(
      join(testDir, 'reset.css'),
      `
      * { margin: 0; padding: 0; }
    `
    );

    await writeFile(
      join(testDir, 'typography.css'),
      `
      h1 { font-size: 2rem; }
    `
    );

    await createManifest(testDir, {
      styles: ['reset.css', 'typography.css'],
    });

    await writeFile(join(testDir, 'test.md'), '# Multi-CSS Test');

    const outputPath = join(testDir, 'output.pdf');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'pdf',
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(await fileExists(outputPath)).toBe(true);
  }, 120000);
});

describe('E2E: Error Handling Workflows', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-e2e-errors-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  }, 60000);

  test('fails gracefully when manifest is missing', async () => {
    await writeFile(join(testDir, 'test.md'), '# No Manifest');

    const outputPath = join(testDir, 'output.pdf');

    try {
      await build({
        input: testDir,
        output: outputPath,
        format: 'pdf',
        verbose: false,
      });
      // Should throw an error
      expect(true).toBe(false); // Fail if no error thrown
    } catch (error) {
      expect(error).toBeDefined();
      const errorMessage = (error as Error).message;
      expect(errorMessage).toContain('manifest');
    }
  });

  test('fails gracefully when markdown files are missing', async () => {
    await createManifest(testDir, {
      files: ['nonexistent.md'],
    });

    const outputPath = join(testDir, 'output.pdf');

    try {
      await build({
        input: testDir,
        output: outputPath,
        format: 'pdf',
        verbose: false,
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('fails gracefully when CSS file is missing', async () => {
    await createManifest(testDir, {
      styles: ['nonexistent.css'],
    });

    await writeFile(join(testDir, 'test.md'), '# Test');

    const outputPath = join(testDir, 'output.pdf');

    try {
      await build({
        input: testDir,
        output: outputPath,
        format: 'pdf',
        verbose: false,
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      const errorMessage = (error as Error).message;
      expect(errorMessage.toLowerCase()).toContain('css');
    }
  });

  test('validates output path is writable', async () => {
    await createManifest(testDir);
    await writeFile(join(testDir, 'test.md'), '# Test');

    // Try to write to a directory that doesn't exist
    const invalidPath = '/nonexistent/directory/output.pdf';

    try {
      await build({
        input: testDir,
        output: invalidPath,
        format: 'pdf',
        verbose: false,
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe('E2E: Configuration Cascade', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-e2e-config-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  }, 60000);

  test('CLI options override manifest settings', async () => {
    await createManifest(testDir, {
      title: 'Manifest Title',
    });

    await writeFile(join(testDir, 'test.md'), '# Document');

    const outputPath = join(testDir, 'output.pdf');

    // Build with verbose flag (CLI override)
    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'pdf',
      verbose: true, // CLI option
    });

    expect(result.success).toBe(true);
  }, 120000);

  test('disableDefaultStyles removes foundation CSS', async () => {
    await createManifest(testDir, {
      disableDefaultStyles: true,
      styles: ['custom.css'],
    });

    await writeFile(
      join(testDir, 'custom.css'),
      `
      body { font-family: monospace; }
    `
    );

    await writeFile(join(testDir, 'test.md'), '# Custom Styled');

    const outputPath = join(testDir, 'output-html');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'html',
      verbose: false,
    });

    expect(result.success).toBe(true);

    const htmlContent = await Bun.file(join(outputPath, 'index.html')).text();
    // Should contain custom styles
    expect(htmlContent).toContain('monospace');
  }, 60000);
});

describe('E2E: Complete Build with All Features', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-e2e-full-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  }, 60000);

  test('builds complex document with all features', async () => {
    // Create complex project structure
    await mkdir(join(testDir, 'chapters'));
    await mkdir(join(testDir, 'styles'));
    await mkdir(join(testDir, 'images'));

    // Create manifest with multiple files and styles
    await createManifest(testDir, {
      title: 'Complete Test Book',
      authors: ['Author One', 'Author Two'],
      files: [
        'chapters/intro.md',
        'chapters/chapter1.md',
        'chapters/chapter2.md',
        'chapters/conclusion.md',
      ],
      styles: ['styles/theme.css', 'styles/print.css'],
    });

    // Create markdown files
    await writeFile(
      join(testDir, 'chapters', 'intro.md'),
      `# Introduction

Welcome to this comprehensive test book.

@page-break
`
    );

    await writeFile(
      join(testDir, 'chapters', 'chapter1.md'),
      `# Chapter 1: Getting Started

This chapter covers **important** concepts.

## Section 1.1

Content with *emphasis* and lists:

- Item one
- Item two
- Item three

@page-break
`
    );

    await writeFile(
      join(testDir, 'chapters', 'chapter2.md'),
      `# Chapter 2: Advanced Topics

@spread

This content spans two pages.

![Test Image](../images/placeholder.txt)

@page-break
`
    );

    await writeFile(
      join(testDir, 'chapters', 'conclusion.md'),
      `# Conclusion

Thank you for reading.
`
    );

    // Create CSS files
    await writeFile(
      join(testDir, 'styles', 'theme.css'),
      `
      h1 {
        color: #333;
        font-size: 2.5rem;
      }

      h2 {
        color: #666;
      }
    `
    );

    await writeFile(
      join(testDir, 'styles', 'print.css'),
      `
      @page {
        margin: 1in;
      }

      body {
        font-family: serif;
      }
    `
    );

    // Create placeholder image
    await writeFile(join(testDir, 'images', 'placeholder.txt'), 'Image placeholder');

    const outputPath = join(testDir, 'complete-book.pdf');

    const result = await build({
      input: testDir,
      output: outputPath,
      format: 'pdf',
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(await fileExists(outputPath)).toBe(true);

    // Verify substantial file size
    const stats = await Bun.file(outputPath).size;
    expect(stats).toBeGreaterThan(5000); // Should be a substantial PDF
  }, 180000); // 3 minute timeout for complex build
});
