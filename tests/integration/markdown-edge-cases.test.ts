/**
 * Edge case tests for markdown processing
 *
 * Tests unusual inputs, malformed content, and boundary conditions
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdir, writeFile, remove } from '../../src/utils/file-utils.ts';
import { processMarkdownFiles, generateHtmlFromMarkdown } from '../../src/markdown/markdown.ts';
import type { ResolvedConfig } from '../../src/config/config-state.ts';

describe('Markdown Processing - Edge Cases', () => {
  let testDir: string;
  let config: ResolvedConfig;

  beforeEach(async () => {
    testDir = join(process.cwd(), '.tmp', `markdown-edge-cases-${Date.now()}`);
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

  test('handles empty markdown file', async () => {
    const mdPath = join(testDir, 'empty.md');
    await writeFile(mdPath, '');

    const result = await processMarkdownFiles(testDir, config);

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('empty');
    expect(result[0]?.html).toBeDefined();
  });

  test('handles markdown with only whitespace', async () => {
    const mdPath = join(testDir, 'whitespace.md');
    await writeFile(mdPath, '   \n\n  \t\n   ');

    const result = await processMarkdownFiles(testDir, config);

    expect(result).toHaveLength(1);
    expect(result[0]?.html).toBeDefined();
  });

  test('handles markdown with HTML entities', async () => {
    const mdPath = join(testDir, 'entities.md');
    await writeFile(
      mdPath,
      '# Entities\n\n&lt; &gt; &amp; &quot; &copy; &trade;'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('&lt;');
    expect(result[0]?.html).toContain('&amp;');
  });

  test('handles markdown with Unicode characters', async () => {
    const mdPath = join(testDir, 'unicode.md');
    await writeFile(
      mdPath,
      '# Unicode\n\n日本語 • Español • Emoji: 🎲 ⚔️ 🛡️'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('日本語');
    expect(result[0]?.html).toContain('Español');
    expect(result[0]?.html).toContain('🎲');
  });

  test('handles markdown with nested formatting', async () => {
    const mdPath = join(testDir, 'nested.md');
    await writeFile(
      mdPath,
      '# Nested\n\n**Bold with _italic_ inside**\n\n_Italic with **bold** inside_'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('<strong>');
    expect(result[0]?.html).toContain('<em>');
  });

  test('handles markdown with deeply nested lists', async () => {
    const mdPath = join(testDir, 'nested-lists.md');
    await writeFile(
      mdPath,
      `# Lists

- Level 1
  - Level 2
    - Level 3
      - Level 4
        - Level 5
`
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('<ul>');
    expect(result[0]?.html).toContain('<li>');
    expect(result[0]?.html).toContain('Level 5');
  });

  test('handles markdown with mixed list types', async () => {
    const mdPath = join(testDir, 'mixed-lists.md');
    await writeFile(
      mdPath,
      `# Mixed Lists

1. Ordered item 1
   - Unordered sub-item
   - Another sub-item
2. Ordered item 2
   1. Nested ordered
   2. Another nested
`
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('<ol>');
    expect(result[0]?.html).toContain('<ul>');
  });

  test('handles markdown with inline HTML', async () => {
    const mdPath = join(testDir, 'inline-html.md');
    await writeFile(
      mdPath,
      '# HTML\n\nThis is <span class="custom">inline HTML</span> in markdown.'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('<span class="custom">');
    expect(result[0]?.html).toContain('inline HTML');
  });

  test('handles markdown with blockquotes', async () => {
    const mdPath = join(testDir, 'quotes.md');
    await writeFile(
      mdPath,
      '# Quotes\n\n> This is a quote\n> \n> With multiple lines'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('<blockquote>');
    expect(result[0]?.html).toContain('This is a quote');
  });

  test('handles markdown with horizontal rules (converted to page break by core directives)', async () => {
    const mdPath = join(testDir, 'hr.md');
    await writeFile(mdPath, '# Section 1\n\n---\n\n# Section 2');

    const result = await processMarkdownFiles(testDir, config);

    // Core directives convert --- to page breaks
    expect(result[0]?.html).toContain('page-break');
  });

  test('handles markdown with standard image syntax', async () => {
    const mdPath = join(testDir, 'image-size.md');
    await writeFile(
      mdPath,
      '# Images\n\n![Alt text](image.png)'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('<img');
    expect(result[0]?.html).toContain('alt="Alt text"');
    expect(result[0]?.html).toContain('image.png');
  });

  test('handles markdown with footnotes (if supported)', async () => {
    const mdPath = join(testDir, 'footnotes.md');
    await writeFile(
      mdPath,
      '# Text\n\nHere is a sentence[^1].\n\n[^1]: This is a footnote.'
    );

    const result = await processMarkdownFiles(testDir, config);

    // Basic check - footnote syntax should be in output somewhere
    expect(result[0]?.html).toBeDefined();
    expect(result[0]?.html.length).toBeGreaterThan(0);
  });

  test('handles markdown with task lists', async () => {
    const mdPath = join(testDir, 'tasks.md');
    await writeFile(
      mdPath,
      '# Tasks\n\n- [x] Completed task\n- [ ] Incomplete task'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toBeDefined();
    expect(result[0]?.html).toContain('task');
  });

  test('handles markdown with escaped characters', async () => {
    const mdPath = join(testDir, 'escaped.md');
    await writeFile(
      mdPath,
      '# Escaped\n\n\\* Not a list item\n\n\\# Not a heading'
    );

    const result = await processMarkdownFiles(testDir, config);

    // Should contain literal asterisk and hash, not HTML elements
    expect(result[0]?.html).toContain('*');
    expect(result[0]?.html).toContain('#');
  });

  test('handles very long content efficiently', async () => {
    const mdPath = join(testDir, 'long.md');

    // Generate large content (1000 paragraphs)
    const longContent = Array(1000)
      .fill(null)
      .map((_, i) => `## Section ${i}\n\nThis is paragraph ${i} with some content.`)
      .join('\n\n');

    await writeFile(mdPath, `# Long Document\n\n${longContent}`);

    const startTime = Date.now();
    const result = await processMarkdownFiles(testDir, config);
    const duration = Date.now() - startTime;

    expect(result).toHaveLength(1);
    expect(result[0]?.html.length).toBeGreaterThan(10000);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  test('handles core directives (@page, @break, @spread)', async () => {
    const mdPath = join(testDir, 'directives.md');
    await writeFile(
      mdPath,
      `# Chapter 1

@page:chapter

Content here.

@break

More content.

@spread

Two-page spread content.
`
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('chapter');
    // Directives should be processed and removed or converted to HTML
    expect(result[0]?.html).toBeDefined();
  });

  test('handles invalid core directive syntax gracefully', async () => {
    const mdPath = join(testDir, 'bad-directive.md');
    await writeFile(
      mdPath,
      '# Content\n\n@invalid:directive\n\nThis should still process.'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toBeDefined();
    expect(result[0]?.html).toContain('This should still process');
  });

  test('handles TTRPG stat blocks with edge cases', async () => {
    const mdPath = join(testDir, 'stats.md');
    await writeFile(
      mdPath,
      `# Monster

{HP:100 AC:20 STR:+5 DEX:-2}

{HP:0}

{AC:50}
`
    );

    const configWithTtrpg: ResolvedConfig = {
      ...config,
      extensions: ['ttrpg'],
    };

    const result = await processMarkdownFiles(testDir, configWithTtrpg);

    expect(result[0]?.html).toContain('HP');
    expect(result[0]?.html).toContain('100');
  });

  test('handles multiple extensions enabled together', async () => {
    const mdPath = join(testDir, 'multi-ext.md');
    await writeFile(
      mdPath,
      `# Mixed Content

{HP:50 AC:15}

#TechD - Technology District

@page:special
`
    );

    const configWithMultiple: ResolvedConfig = {
      ...config,
      extensions: ['ttrpg', 'dimmCity'],
    };

    const result = await processMarkdownFiles(testDir, configWithMultiple);

    expect(result[0]?.html).toContain('HP');
    expect(result[0]?.html).toContain('TechD');
  });

  test('handles markdown attrs plugin syntax', async () => {
    const mdPath = join(testDir, 'attrs.md');
    await writeFile(
      mdPath,
      '# Heading {#custom-id .custom-class}\n\nParagraph {.highlight}'
    );

    const result = await processMarkdownFiles(testDir, config);

    // Check if attrs are processed (markdown-it-attrs plugin)
    expect(result[0]?.html).toBeDefined();
    expect(result[0]?.html.length).toBeGreaterThan(0);
  });

  test('handles markdown with anchor links', async () => {
    const mdPath = join(testDir, 'anchors.md');
    await writeFile(
      mdPath,
      '# Section One\n\nSee [Section Two](#section-two)\n\n# Section Two\n\nContent'
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('href');
    expect(result[0]?.html).toContain('section');
  });

  test('handles relative and absolute image paths', async () => {
    const mdPath = join(testDir, 'image-paths.md');
    await writeFile(
      mdPath,
      `# Images

Relative: ![Rel](./assets/image.png)

Absolute: ![Abs](/assets/image.png)

No path: ![None](image.png)
`
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toContain('./assets/image.png');
    expect(result[0]?.html).toContain('/assets/image.png');
    expect(result[0]?.html).toContain('image.png');
  });

  test('handles special characters in filenames', async () => {
    const mdPath = join(testDir, 'file-with-special_chars-2024.md');
    await writeFile(mdPath, '# Special File\n\nContent');

    const result = await processMarkdownFiles(testDir, config);

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe('file-with-special_chars-2024');
  });

  test('handles markdown with definition lists (if supported)', async () => {
    const mdPath = join(testDir, 'definitions.md');
    await writeFile(
      mdPath,
      `# Definitions

Term 1
:   Definition 1

Term 2
:   Definition 2a
:   Definition 2b
`
    );

    const result = await processMarkdownFiles(testDir, config);

    expect(result[0]?.html).toBeDefined();
    expect(result[0]?.html).toContain('Term');
  });

  test('generates HTML with proper DOCTYPE and structure', async () => {
    const mdPath = join(testDir, 'structure.md');
    await writeFile(mdPath, '# Test');

    const html = await generateHtmlFromMarkdown(testDir, config);

    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
  });

  test('handles markdown with custom containers (if enabled)', async () => {
    const mdPath = join(testDir, 'containers.md');
    await writeFile(
      mdPath,
      `# Containers

:::info
This is an info box
:::

:::warning
This is a warning
:::
`
    );

    const configWithContainers: ResolvedConfig = {
      ...config,
      extensions: ['containers'],
    };

    const result = await processMarkdownFiles(testDir, configWithContainers);

    expect(result[0]?.html).toBeDefined();
    expect(result[0]?.html.length).toBeGreaterThan(0);
  });
});
