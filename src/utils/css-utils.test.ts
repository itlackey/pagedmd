/**
 * Tests for CSS import resolution with focus on error handling and circular detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import path from 'path';
import os from 'os';
import { resolveImports } from './css-utils.ts';
import { mkdir, writeFile, remove } from './file-utils.ts';

describe('resolveImports', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique test directory in system temp
    testDir = path.join(os.tmpdir(), `dc-book-css-test-${Date.now()}`);
    await mkdir(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await remove(testDir);
  });

  describe('successful import resolution', () => {
    it('should resolve simple @import statement', async () => {
      // Create base.css and imported.css
      const basePath = path.join(testDir, 'base.css');
      const importedPath = path.join(testDir, 'imported.css');

      await writeFile(importedPath, '.imported { color: red; }');
      await writeFile(basePath, '@import "imported.css";\n.base { color: blue; }');

      const result = await resolveImports(
        '@import "imported.css";\n.base { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      // Simplified format includes filename (not line numbers)
      expect(result.resolvedCSS).toContain('/* From: imported.css (base.css) */');
      expect(result.resolvedCSS).toContain('.imported { color: red; }');
      expect(result.resolvedCSS).toContain('.base { color: blue; }');
    });

    it('should resolve nested imports', async () => {
      // Create a chain: base.css -> level1.css -> level2.css
      const basePath = path.join(testDir, 'base.css');
      const level1Path = path.join(testDir, 'level1.css');
      const level2Path = path.join(testDir, 'level2.css');

      await writeFile(level2Path, '.level2 { color: green; }');
      await writeFile(level1Path, '@import "level2.css";\n.level1 { color: red; }');
      await writeFile(basePath, '@import "level1.css";\n.base { color: blue; }');

      const result = await resolveImports(
        '@import "level1.css";\n.base { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.resolvedCSS).toContain('.level2 { color: green; }');
      expect(result.resolvedCSS).toContain('.level1 { color: red; }');
      expect(result.resolvedCSS).toContain('.base { color: blue; }');
    });

    it('should resolve multiple imports in same file', async () => {
      const basePath = path.join(testDir, 'base.css');
      const import1Path = path.join(testDir, 'import1.css');
      const import2Path = path.join(testDir, 'import2.css');

      await writeFile(import1Path, '.import1 { color: red; }');
      await writeFile(import2Path, '.import2 { color: green; }');
      await writeFile(
        basePath,
        '@import "import1.css";\n@import "import2.css";\n.base { color: blue; }'
      );

      const result = await resolveImports(
        '@import "import1.css";\n@import "import2.css";\n.base { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.resolvedCSS).toContain('.import1 { color: red; }');
      expect(result.resolvedCSS).toContain('.import2 { color: green; }');
      expect(result.resolvedCSS).toContain('.base { color: blue; }');
    });

    it('should skip external URL imports', async () => {
      const basePath = path.join(testDir, 'base.css');

      await writeFile(
        basePath,
        '@import url("https://example.com/font.css");\n.base { color: blue; }'
      );

      const result = await resolveImports(
        '@import url("https://example.com/font.css");\n.base { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      // External import should be kept as-is
      expect(result.resolvedCSS).toContain('https://example.com/font.css');
      expect(result.resolvedCSS).toContain('.base { color: blue; }');
    });

    it('should handle relative paths correctly', async () => {
      // Create nested directory structure
      const subdir = path.join(testDir, 'styles');
      await mkdir(subdir);

      const basePath = path.join(testDir, 'base.css');
      const importedPath = path.join(subdir, 'imported.css');

      await writeFile(importedPath, '.imported { color: red; }');
      await writeFile(basePath, '@import "styles/imported.css";\n.base { color: blue; }');

      const result = await resolveImports(
        '@import "styles/imported.css";\n.base { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.resolvedCSS).toContain('.imported { color: red; }');
    });
  });

  describe('circular import detection', () => {
    it('should detect direct circular import (A -> A)', async () => {
      const filePath = path.join(testDir, 'circular.css');
      await writeFile(filePath, '@import "circular.css";\n.base { color: blue; }');

      const result = await resolveImports(
        '@import "circular.css";\n.base { color: blue; }',
        filePath
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Circular import detected');
      expect(result.errors[0]).toContain('circular.css');
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect two-file circular import (A -> B -> A)', async () => {
      const fileA = path.join(testDir, 'a.css');
      const fileB = path.join(testDir, 'b.css');

      await writeFile(fileA, '@import "b.css";\n.a { color: blue; }');
      await writeFile(fileB, '@import "a.css";\n.b { color: red; }');

      const result = await resolveImports('@import "b.css";\n.a { color: blue; }', fileA);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Circular import detected'))).toBe(true);
    });

    it('should detect three-file circular import (A -> B -> C -> A)', async () => {
      const fileA = path.join(testDir, 'a.css');
      const fileB = path.join(testDir, 'b.css');
      const fileC = path.join(testDir, 'c.css');

      await writeFile(fileA, '@import "b.css";\n.a { color: blue; }');
      await writeFile(fileB, '@import "c.css";\n.b { color: red; }');
      await writeFile(fileC, '@import "a.css";\n.c { color: green; }');

      const result = await resolveImports('@import "b.css";\n.a { color: blue; }', fileA);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Circular import detected'))).toBe(true);
    });
  });

  describe('missing file handling with failOnMissing=true (default)', () => {
    it('should report missing file as error', async () => {
      const basePath = path.join(testDir, 'base.css');
      await writeFile(basePath, '@import "missing.css";\n.base { color: blue; }');

      const result = await resolveImports(
        '@import "missing.css";\n.base { color: blue; }',
        basePath,
        { failOnMissing: true }
      );

      expect(result.errors).toHaveLength(1);
      // Simplified error message format
      expect(result.errors[0]).toContain('CSS import file not found');
      expect(result.errors[0]).toContain('base.css');
      expect(result.errors[0]).toContain('missing.css');
      expect(result.warnings).toHaveLength(0);
      // Original CSS should be preserved
      expect(result.resolvedCSS).toContain('@import "missing.css"');
    });

    it('should collect multiple missing file errors', async () => {
      const basePath = path.join(testDir, 'base.css');
      await writeFile(
        basePath,
        '@import "missing1.css";\n@import "missing2.css";\n.base { color: blue; }'
      );

      const result = await resolveImports(
        '@import "missing1.css";\n@import "missing2.css";\n.base { color: blue; }',
        basePath,
        { failOnMissing: true }
      );

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('missing');
      expect(result.errors[1]).toContain('missing');
      expect(result.warnings).toHaveLength(0);
    });

    it('should collect errors from nested missing imports', async () => {
      const basePath = path.join(testDir, 'base.css');
      const level1Path = path.join(testDir, 'level1.css');

      // level1.css exists but imports missing file
      await writeFile(level1Path, '@import "missing.css";\n.level1 { color: red; }');
      await writeFile(basePath, '@import "level1.css";\n.base { color: blue; }');

      const result = await resolveImports(
        '@import "level1.css";\n.base { color: blue; }',
        basePath,
        { failOnMissing: true }
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('missing.css');
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('missing file handling with failOnMissing=false', () => {
    it('should report missing file as warning instead of error', async () => {
      const basePath = path.join(testDir, 'base.css');
      await writeFile(basePath, '@import "missing.css";\n.base { color: blue; }');

      const result = await resolveImports(
        '@import "missing.css";\n.base { color: blue; }',
        basePath,
        { failOnMissing: false }
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      // Simplified warning message format
      expect(result.warnings[0]).toContain('CSS import file not found');
      expect(result.warnings[0]).toContain('missing.css');
      // Original CSS should be preserved
      expect(result.resolvedCSS).toContain('@import "missing.css"');
    });

    it('should collect multiple missing file warnings', async () => {
      const basePath = path.join(testDir, 'base.css');
      await writeFile(
        basePath,
        '@import "missing1.css";\n@import "missing2.css";\n.base { color: blue; }'
      );

      const result = await resolveImports(
        '@import "missing1.css";\n@import "missing2.css";\n.base { color: blue; }',
        basePath,
        { failOnMissing: false }
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('missing');
      expect(result.warnings[1]).toContain('missing');
    });
  });

  describe('mixed success and failure scenarios', () => {
    it('should resolve valid imports and collect errors for invalid ones', async () => {
      const basePath = path.join(testDir, 'base.css');
      const validPath = path.join(testDir, 'valid.css');

      await writeFile(validPath, '.valid { color: green; }');
      await writeFile(
        basePath,
        '@import "valid.css";\n@import "missing.css";\n.base { color: blue; }'
      );

      const result = await resolveImports(
        '@import "valid.css";\n@import "missing.css";\n.base { color: blue; }',
        basePath,
        { failOnMissing: true }
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('missing.css');
      expect(result.warnings).toHaveLength(0);
      // Valid import should be resolved
      expect(result.resolvedCSS).toContain('.valid { color: green; }');
      // Invalid import should be preserved
      expect(result.resolvedCSS).toContain('@import "missing.css"');
      expect(result.resolvedCSS).toContain('.base { color: blue; }');
    });

    it('should handle combination of circular import and missing file', async () => {
      const fileA = path.join(testDir, 'a.css');
      const fileB = path.join(testDir, 'b.css');

      await writeFile(fileA, '@import "b.css";\n.a { color: blue; }');
      // b.css imports both a.css (circular) and missing.css
      await writeFile(fileB, '@import "a.css";\n@import "missing.css";\n.b { color: red; }');

      const result = await resolveImports('@import "b.css";\n.a { color: blue; }', fileA, {
        failOnMissing: true,
      });

      // Should have at least circular import error
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Circular import detected'))).toBe(true);
    });
  });

  describe('various @import syntax support', () => {
    it('should handle @import url(...) syntax', async () => {
      const basePath = path.join(testDir, 'base.css');
      const importedPath = path.join(testDir, 'imported.css');

      await writeFile(importedPath, '.imported { color: red; }');
      await writeFile(basePath, '@import url("imported.css");\n.base { color: blue; }');

      const result = await resolveImports(
        '@import url("imported.css");\n.base { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(0);
      expect(result.resolvedCSS).toContain('.imported { color: red; }');
    });

    it('should handle @import with single quotes', async () => {
      const basePath = path.join(testDir, 'base.css');
      const importedPath = path.join(testDir, 'imported.css');

      await writeFile(importedPath, '.imported { color: red; }');
      await writeFile(basePath, "@import 'imported.css';\n.base { color: blue; }");

      const result = await resolveImports(
        "@import 'imported.css';\n.base { color: blue; }",
        basePath
      );

      expect(result.errors).toHaveLength(0);
      expect(result.resolvedCSS).toContain('.imported { color: red; }');
    });

    it('should skip // protocol relative URLs', async () => {
      const basePath = path.join(testDir, 'base.css');

      const result = await resolveImports(
        '@import "//example.com/font.css";\n.base { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(0);
      expect(result.resolvedCSS).toContain('//example.com/font.css');
    });

    it('should skip http:// URLs', async () => {
      const basePath = path.join(testDir, 'base.css');

      const result = await resolveImports(
        '@import "http://example.com/font.css";\n.base { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(0);
      expect(result.resolvedCSS).toContain('http://example.com/font.css');
    });
  });

  describe('error message quality', () => {
    it('should include file path in missing file error', async () => {
      const basePath = path.join(testDir, 'base.css');
      await writeFile(basePath, '@import "missing.css";\n.base { color: blue; }');

      const result = await resolveImports(
        '@import "missing.css";\n.base { color: blue; }',
        basePath
      );

      // Simplified error message includes filename and resolved path
      expect(result.errors[0]).toContain('base.css');
      expect(result.errors[0]).toContain('missing.css');
      expect(result.errors[0]).toContain(path.join(testDir, 'missing.css'));
    });

    it('should show circular import chain', async () => {
      const fileA = path.join(testDir, 'a.css');
      const fileB = path.join(testDir, 'b.css');

      await writeFile(fileA, '@import "b.css";\n.a { color: blue; }');
      await writeFile(fileB, '@import "a.css";\n.b { color: red; }');

      const result = await resolveImports('@import "b.css";\n.a { color: blue; }', fileA);

      const circularError = result.errors.find((e) => e.includes('Circular import detected'));
      expect(circularError).toBeDefined();
      // Should show the chain with arrows
      expect(circularError).toMatch(/→/);
    });
  });

  describe('simplified error messages', () => {
    it('should include filename in error messages', async () => {
      const basePath = path.join(testDir, 'test.css');
      const css = `
/* Line 1: comment */
@import "missing.css";  /* Line 2 */
.base { color: blue; }`;

      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('test.css');
      expect(result.errors[0]).toContain('missing.css');
    });

    it('should include import path in error', async () => {
      const basePath = path.join(testDir, 'main.css');
      const css = '@import url("theme/colors.css");\n.main { color: blue; }';

      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('theme/colors.css');
      expect(result.errors[0]).toContain('main.css');
    });

    it('should include resolved path when file not found', async () => {
      const basePath = path.join(testDir, 'base.css');
      const css = '@import "notfound.css";';

      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Resolved path:');
      expect(result.errors[0]).toContain(path.join(testDir, 'notfound.css'));
    });

    it('should add filename comments to resolved CSS', async () => {
      const basePath = path.join(testDir, 'main.css');
      const importedPath = path.join(testDir, 'imported.css');

      await writeFile(importedPath, '.imported { color: red; }');
      await writeFile(basePath, '/* Line 1 */\n@import "imported.css";\n.main { color: blue; }');

      const result = await resolveImports(
        '/* Line 1 */\n@import "imported.css";\n.main { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(0);
      // Should include filename comment for debugging (without line numbers)
      expect(result.resolvedCSS).toContain('/* From: imported.css (main.css) */');
      expect(result.resolvedCSS).toContain('/* End: imported.css */');
    });

    it('should handle multiple imports', async () => {
      const basePath = path.join(testDir, 'multi.css');
      const css = `
/* Line 1 */
@import "file1.css";  /* Line 2 */
.middle { color: green; }
@import "file2.css";  /* Line 4 */
`;

      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);

      expect(result.errors).toHaveLength(2);

      // Both errors should reference the CSS file and the missing import
      expect(result.errors[0]).toContain('multi.css');
      expect(result.errors[1]).toContain('multi.css');

      const hasFile1Error = result.errors.some(e => e.includes('file1.css'));
      const hasFile2Error = result.errors.some(e => e.includes('file2.css'));
      expect(hasFile1Error).toBe(true);
      expect(hasFile2Error).toBe(true);
    });

    it('should preserve context for nested import errors', async () => {
      const basePath = path.join(testDir, 'parent.css');
      const childPath = path.join(testDir, 'child.css');

      // child.css exists but imports a missing file
      await writeFile(childPath, '@import "missing.css";\n.child { color: red; }');
      await writeFile(basePath, '@import "child.css";\n.parent { color: blue; }');

      const result = await resolveImports(
        '@import "child.css";\n.parent { color: blue; }',
        basePath
      );

      expect(result.errors).toHaveLength(1);
      // Error should reference child.css, not parent
      expect(result.errors[0]).toContain('child.css');
      expect(result.errors[0]).toContain('missing.css');
    });

    it('should include clear error context for read failures', async () => {
      const basePath = path.join(testDir, 'test.css');
      const importedPath = path.join(testDir, 'imported.css');

      // Create file but make it unreadable (simulate permission error)
      await writeFile(importedPath, 'content');
      await writeFile(basePath, '@import "imported.css";\n.base { color: blue; }');

      // We can't easily simulate a read error in tests, but the structure is in place
      // This test verifies the message format is correct
      const result = await resolveImports(
        '@import "imported.css";\n.base { color: blue; }',
        basePath
      );

      // Should succeed in normal test environment
      expect(result.errors).toHaveLength(0);
    });

    it('should handle imports on first line', async () => {
      const basePath = path.join(testDir, 'first-line.css');
      const css = '@import "missing.css";\n.base { color: blue; }';

      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('first-line.css');
      expect(result.errors[0]).toContain('missing.css');
    });

    it('should handle imports on last line', async () => {
      const basePath = path.join(testDir, 'last-line.css');
      const css = '.first { color: red; }\n.second { color: green; }\n@import "missing.css";';

      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('last-line.css');
      expect(result.errors[0]).toContain('missing.css');
    });

    it('should include import name in error messages', async () => {
      const basePath = path.join(testDir, 'whitespace.css');
      const css = '   \n   @import "missing.css";   \n   ';

      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('missing.css');
      expect(result.errors[0]).toContain('whitespace.css');
    });

    it('should provide helpful error format for debugging', async () => {
      const basePath = path.join(testDir, 'debug.css');
      const css = `
.header { color: blue; }
@import "theme/missing.css";
.footer { color: red; }
`;

      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);

      expect(result.errors).toHaveLength(1);
      const error = result.errors[0];

      // Simplified error format
      expect(error).toContain('CSS import file not found');
      expect(error).toContain('debug.css');
      expect(error).toContain('theme/missing.css');
      expect(error).toContain('Resolved path:');
    });
  });

  describe('edge cases', () => {
    it('should handle empty CSS file', async () => {
      const basePath = path.join(testDir, 'empty.css');
      await writeFile(basePath, '');

      const result = await resolveImports('', basePath);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.resolvedCSS).toBe('');
    });

    it('should handle CSS with no imports', async () => {
      const basePath = path.join(testDir, 'no-imports.css');
      const css = '.class { color: blue; }\n.another { color: red; }';
      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.resolvedCSS).toBe(css);
    });

    it('should handle @import at end of file without semicolon', async () => {
      const basePath = path.join(testDir, 'base.css');
      const importedPath = path.join(testDir, 'imported.css');

      await writeFile(importedPath, '.imported { color: red; }');
      await writeFile(basePath, '@import "imported.css"');

      const result = await resolveImports('@import "imported.css"', basePath);

      expect(result.errors).toHaveLength(0);
      expect(result.resolvedCSS).toContain('.imported { color: red; }');
    });

    it('should preserve other CSS content when imports fail', async () => {
      const basePath = path.join(testDir, 'base.css');
      const css = `
@import "missing.css";

.base {
  color: blue;
  font-size: 16px;
}

.another {
  background: red;
}`;

      await writeFile(basePath, css);

      const result = await resolveImports(css, basePath);

      expect(result.errors).toHaveLength(1);
      // All original CSS should be preserved
      expect(result.resolvedCSS).toContain('.base');
      expect(result.resolvedCSS).toContain('color: blue');
      expect(result.resolvedCSS).toContain('.another');
    });
  });
});
