/**
 * Tests for file utilities with focus on error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  copyDirectory,
  copyMarkdownFiles,
  copyPreviewAssets,
  fileExists,
  isDirectory,
  mkdir,
  remove,
  writeFile,
} from './file-utils.ts';
import { BuildError } from './errors.ts';

describe('copyDirectory', () => {
  let testDir: string;
  let srcDir: string;
  let destDir: string;

  beforeEach(async () => {
    // Create a unique test directory in system temp
    testDir = path.join(os.tmpdir(), `dc-book-test-${Date.now()}`);
    srcDir = path.join(testDir, 'src');
    destDir = path.join(testDir, 'dest');

    await mkdir(srcDir);
    await mkdir(destDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await remove(testDir);
  });

  it('should successfully copy entire directory tree', async () => {
    // Create test structure:
    // src/
    //   file1.txt
    //   subdir/
    //     file2.txt
    //     nested/
    //       file3.txt
    await writeFile(path.join(srcDir, 'file1.txt'), 'content1');
    await mkdir(path.join(srcDir, 'subdir', 'nested'));
    await writeFile(path.join(srcDir, 'subdir', 'file2.txt'), 'content2');
    await writeFile(path.join(srcDir, 'subdir', 'nested', 'file3.txt'), 'content3');

    // Copy the entire structure
    await copyDirectory(srcDir, destDir);

    // Verify all files were copied
    expect(await fileExists(path.join(destDir, 'file1.txt'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'subdir', 'file2.txt'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'subdir', 'nested', 'file3.txt'))).toBe(true);

    // Verify contents
    const content1 = await fs.readFile(path.join(destDir, 'file1.txt'), 'utf-8');
    const content2 = await fs.readFile(path.join(destDir, 'subdir', 'file2.txt'), 'utf-8');
    const content3 = await fs.readFile(path.join(destDir, 'subdir', 'nested', 'file3.txt'), 'utf-8');

    expect(content1).toBe('content1');
    expect(content2).toBe('content2');
    expect(content3).toBe('content3');
  });

  it('should throw error when source directory does not exist', async () => {
    const nonExistentSrc = path.join(testDir, 'nonexistent');

    await expect(copyDirectory(nonExistentSrc, destDir)).rejects.toThrow(
      `Source directory does not exist: ${nonExistentSrc}`
    );
  });

  it('should throw error when source path is a file, not directory', async () => {
    const filePath = path.join(testDir, 'file.txt');
    await writeFile(filePath, 'content');

    await expect(copyDirectory(filePath, destDir)).rejects.toThrow(
      `Source path is not a directory: ${filePath}`
    );
  });

  it('should attempt to copy all files even if some fail', async () => {
    // Create test files
    await writeFile(path.join(srcDir, 'file1.txt'), 'content1');
    await writeFile(path.join(srcDir, 'file2.txt'), 'content2');
    await writeFile(path.join(srcDir, 'file3.txt'), 'content3');

    // Make file2.txt read-only by setting permissions to 000
    const file2Path = path.join(srcDir, 'file2.txt');
    await fs.chmod(file2Path, 0o000);

    try {
      // Attempt copy - should fail but try all files
      await copyDirectory(srcDir, destDir);
      // Should not reach here
      throw new Error('Should have thrown BuildError');
    } catch (error) {
      expect(error).toBeInstanceOf(BuildError);
      const buildError = error as BuildError;

      // Verify error includes details about failed file
      expect(buildError.message).toContain(file2Path);
      expect(buildError.message).toContain('Failed to copy');

      // Verify other files were still copied (partial success)
      expect(await fileExists(path.join(destDir, 'file1.txt'))).toBe(true);
      expect(await fileExists(path.join(destDir, 'file3.txt'))).toBe(true);
    } finally {
      // Restore permissions for cleanup
      await fs.chmod(file2Path, 0o644);
    }
  });

  it('should collect and report all failed file paths', async () => {
    // Create structure with multiple files
    await writeFile(path.join(srcDir, 'good1.txt'), 'content1');
    await writeFile(path.join(srcDir, 'bad1.txt'), 'content2');
    await writeFile(path.join(srcDir, 'bad2.txt'), 'content3');
    await writeFile(path.join(srcDir, 'good2.txt'), 'content4');

    // Make multiple files unreadable
    const bad1Path = path.join(srcDir, 'bad1.txt');
    const bad2Path = path.join(srcDir, 'bad2.txt');
    await fs.chmod(bad1Path, 0o000);
    await fs.chmod(bad2Path, 0o000);

    try {
      await copyDirectory(srcDir, destDir);
      throw new Error('Should have thrown BuildError');
    } catch (error) {
      expect(error).toBeInstanceOf(BuildError);
      const buildError = error as BuildError;

      // Should report 2 failures in message
      expect(buildError.message).toContain('Failed to copy 2 file');

      // Should include both failed file paths
      expect(buildError.message).toContain('bad1.txt');
      expect(buildError.message).toContain('bad2.txt');

      // Verify successful copies still happened
      expect(await fileExists(path.join(destDir, 'good1.txt'))).toBe(true);
      expect(await fileExists(path.join(destDir, 'good2.txt'))).toBe(true);
    } finally {
      // Restore permissions
      await fs.chmod(bad1Path, 0o644);
      await fs.chmod(bad2Path, 0o644);
    }
  });

  it('should handle recursive copy with nested failures', async () => {
    // Create nested structure
    await mkdir(path.join(srcDir, 'subdir1'));
    await mkdir(path.join(srcDir, 'subdir2'));
    await writeFile(path.join(srcDir, 'file1.txt'), 'content1');
    await writeFile(path.join(srcDir, 'subdir1', 'file2.txt'), 'content2');
    await writeFile(path.join(srcDir, 'subdir1', 'file3.txt'), 'content3');
    await writeFile(path.join(srcDir, 'subdir2', 'file4.txt'), 'content4');

    // Make files in different subdirectories unreadable
    const file2Path = path.join(srcDir, 'subdir1', 'file2.txt');
    const file4Path = path.join(srcDir, 'subdir2', 'file4.txt');
    await fs.chmod(file2Path, 0o000);
    await fs.chmod(file4Path, 0o000);

    try {
      await copyDirectory(srcDir, destDir);
      throw new Error('Should have thrown BuildError');
    } catch (error) {
      expect(error).toBeInstanceOf(BuildError);
      const buildError = error as BuildError;

      // Should collect failures from nested directories
      expect(buildError.message).toContain('Failed to copy 2 file');
      expect(buildError.message).toContain(file2Path);
      expect(buildError.message).toContain(file4Path);

      // Verify other files were copied
      expect(await fileExists(path.join(destDir, 'file1.txt'))).toBe(true);
      expect(await fileExists(path.join(destDir, 'subdir1', 'file3.txt'))).toBe(true);
    } finally {
      // Restore permissions
      await fs.chmod(file2Path, 0o644);
      await fs.chmod(file4Path, 0o644);
    }
  });

  it('should respect overwrite flag when false', async () => {
    // Create source files
    await writeFile(path.join(srcDir, 'file1.txt'), 'new content');

    // Create existing destination file with different content
    await writeFile(path.join(destDir, 'file1.txt'), 'original content');

    // Copy without overwriting
    await copyDirectory(srcDir, destDir, false);

    // Verify original content is preserved
    const content = await fs.readFile(path.join(destDir, 'file1.txt'), 'utf-8');
    expect(content).toBe('original content');
  });

  it('should overwrite by default when no overwrite flag specified', async () => {
    // Create source files
    await writeFile(path.join(srcDir, 'file1.txt'), 'new content');

    // Create existing destination file with different content
    await writeFile(path.join(destDir, 'file1.txt'), 'original content');

    // Copy (should overwrite by default)
    await copyDirectory(srcDir, destDir);

    // Verify new content replaced original
    const content = await fs.readFile(path.join(destDir, 'file1.txt'), 'utf-8');
    expect(content).toBe('new content');
  });

  it('should handle empty source directory', async () => {
    // Copy empty directory
    await copyDirectory(srcDir, destDir);

    // Verify destination exists and is empty
    expect(await isDirectory(destDir)).toBe(true);
    const entries = await fs.readdir(destDir);
    expect(entries.length).toBe(0);
  });

  it('should create destination directory if it does not exist', async () => {
    const newDestDir = path.join(testDir, 'new-dest');

    // Create source file
    await writeFile(path.join(srcDir, 'file1.txt'), 'content');

    // Copy to non-existent destination
    await copyDirectory(srcDir, newDestDir);

    // Verify destination was created and file copied
    expect(await isDirectory(newDestDir)).toBe(true);
    expect(await fileExists(path.join(newDestDir, 'file1.txt'))).toBe(true);
  });
});

describe('copyMarkdownFiles', () => {
  let testDir: string;
  let srcDir: string;
  let destDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `pagedmd-test-${Date.now()}`);
    srcDir = path.join(testDir, 'src');
    destDir = path.join(testDir, 'dest');

    await mkdir(srcDir);
  });

  afterEach(async () => {
    await remove(testDir);
  });

  it('should only copy markdown and config files', async () => {
    // Setup: create test files with various extensions
    await writeFile(path.join(srcDir, 'test.md'), '# Test');
    await writeFile(path.join(srcDir, 'manifest.yaml'), 'title: Test');
    await writeFile(path.join(srcDir, 'config.yml'), 'key: value');
    await writeFile(path.join(srcDir, 'style.css'), 'body {}');
    await writeFile(path.join(srcDir, 'ignore.txt'), 'should not copy');
    await writeFile(path.join(srcDir, 'ignore.js'), 'console.log("skip")');
    await writeFile(path.join(srcDir, 'image.png'), 'fake png data');

    // Execute
    await copyMarkdownFiles(srcDir, destDir);

    // Verify only allowed extensions were copied
    expect(await fileExists(path.join(destDir, 'test.md'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'manifest.yaml'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'config.yml'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'style.css'))).toBe(true);

    // These should NOT be copied
    expect(await fileExists(path.join(destDir, 'ignore.txt'))).toBe(false);
    expect(await fileExists(path.join(destDir, 'ignore.js'))).toBe(false);
    expect(await fileExists(path.join(destDir, 'image.png'))).toBe(false);
  });

  it('should skip node_modules directory', async () => {
    // Create node_modules with files
    await mkdir(path.join(srcDir, 'node_modules', 'package'));
    await writeFile(path.join(srcDir, 'node_modules', 'package', 'index.md'), '# Package');
    await writeFile(path.join(srcDir, 'node_modules', 'package.json'), '{}');

    // Create valid file at root
    await writeFile(path.join(srcDir, 'readme.md'), '# Readme');

    // Execute
    await copyMarkdownFiles(srcDir, destDir);

    // Verify node_modules was not copied
    expect(await fileExists(path.join(destDir, 'readme.md'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'node_modules'))).toBe(false);
  });

  it('should skip .git directory', async () => {
    // Create .git directory with files
    await mkdir(path.join(srcDir, '.git', 'refs'));
    await writeFile(path.join(srcDir, '.git', 'config'), 'git config');
    await writeFile(path.join(srcDir, 'readme.md'), '# Readme');

    // Execute
    await copyMarkdownFiles(srcDir, destDir);

    // Verify .git was not copied
    expect(await fileExists(path.join(destDir, 'readme.md'))).toBe(true);
    expect(await fileExists(path.join(destDir, '.git'))).toBe(false);
  });

  it('should skip build artifacts', async () => {
    // Create build directories
    await mkdir(path.join(srcDir, 'dist'));
    await mkdir(path.join(srcDir, 'build'));
    await mkdir(path.join(srcDir, '.tmp'));
    await writeFile(path.join(srcDir, 'dist', 'bundle.md'), '# Bundle');
    await writeFile(path.join(srcDir, 'build', 'output.md'), '# Output');
    await writeFile(path.join(srcDir, '.tmp', 'temp.md'), '# Temp');
    await writeFile(path.join(srcDir, 'source.md'), '# Source');

    // Execute
    await copyMarkdownFiles(srcDir, destDir);

    // Verify build directories were not copied
    expect(await fileExists(path.join(destDir, 'source.md'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'dist'))).toBe(false);
    expect(await fileExists(path.join(destDir, 'build'))).toBe(false);
    expect(await fileExists(path.join(destDir, '.tmp'))).toBe(false);
  });

  it('should recursively copy nested directories', async () => {
    // Create nested structure
    await mkdir(path.join(srcDir, 'chapters', 'chapter1'));
    await writeFile(path.join(srcDir, 'chapters', 'chapter1', 'intro.md'), '# Intro');
    await writeFile(path.join(srcDir, 'chapters', 'chapter1', 'styles.css'), 'h1 {}');
    await writeFile(path.join(srcDir, 'chapters', 'chapter1', 'ignore.txt'), 'skip');

    // Execute
    await copyMarkdownFiles(srcDir, destDir);

    // Verify nested structure preserved
    expect(await fileExists(path.join(destDir, 'chapters', 'chapter1', 'intro.md'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'chapters', 'chapter1', 'styles.css'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'chapters', 'chapter1', 'ignore.txt'))).toBe(false);
  });

  it('should handle custom extensions parameter', async () => {
    // Create files
    await writeFile(path.join(srcDir, 'doc.md'), '# Doc');
    await writeFile(path.join(srcDir, 'config.yaml'), 'key: value');
    await writeFile(path.join(srcDir, 'style.css'), 'body {}');

    // Execute with only .md extension
    await copyMarkdownFiles(srcDir, destDir, ['.md']);

    // Verify only .md files were copied
    expect(await fileExists(path.join(destDir, 'doc.md'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'config.yaml'))).toBe(false);
    expect(await fileExists(path.join(destDir, 'style.css'))).toBe(false);
  });

  it('should handle empty source directory', async () => {
    // Execute with empty directory
    await copyMarkdownFiles(srcDir, destDir);

    // Verify destination was created but is empty
    expect(await isDirectory(destDir)).toBe(true);
    const entries = await fs.readdir(destDir);
    expect(entries.length).toBe(0);
  });
});

describe('copyPreviewAssets', () => {
  let testDir: string;
  let assetsDir: string;
  let destDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `pagedmd-assets-test-${Date.now()}`);
    assetsDir = path.join(testDir, 'assets');
    destDir = path.join(testDir, 'dest');

    await mkdir(assetsDir);
  });

  afterEach(async () => {
    await remove(testDir);
  });

  it('should only copy required preview files', async () => {
    // Setup: create required and extra files
    await writeFile(path.join(assetsDir, 'paged.polyfill.js'), '// polyfill');
    await writeFile(path.join(assetsDir, 'interface.css'), '/* css */');
    await writeFile(path.join(assetsDir, 'interface.js'), '// js');
    await writeFile(path.join(assetsDir, 'other.js'), '// should not copy');
    await writeFile(path.join(assetsDir, 'preview.js'), '// should not copy');
    await writeFile(path.join(assetsDir, 'theme.css'), '/* should not copy */');

    // Execute
    await mkdir(destDir);
    await copyPreviewAssets(assetsDir, destDir);

    // Verify only required files were copied
    expect(await fileExists(path.join(destDir, 'paged.polyfill.js'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'interface.css'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'interface.js'))).toBe(true);

    // These should NOT be copied
    expect(await fileExists(path.join(destDir, 'other.js'))).toBe(false);
    expect(await fileExists(path.join(destDir, 'preview.js'))).toBe(false);
    expect(await fileExists(path.join(destDir, 'theme.css'))).toBe(false);
  });

  it('should copy files to destination root, not subdirectory', async () => {
    // Setup
    await writeFile(path.join(assetsDir, 'paged.polyfill.js'), '// polyfill');
    await writeFile(path.join(assetsDir, 'interface.css'), '/* css */');
    await writeFile(path.join(assetsDir, 'interface.js'), '// js');

    // Execute
    await mkdir(destDir);
    await copyPreviewAssets(assetsDir, destDir);

    // Verify files are at root of destination
    expect(await fileExists(path.join(destDir, 'paged.polyfill.js'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'interface.css'))).toBe(true);
    expect(await fileExists(path.join(destDir, 'interface.js'))).toBe(true);

    // Should NOT be in subdirectory
    expect(await fileExists(path.join(destDir, 'assets', 'paged.polyfill.js'))).toBe(false);
  });

  it('should handle missing files gracefully', async () => {
    // Setup: only create one of three required files
    await writeFile(path.join(assetsDir, 'paged.polyfill.js'), '// polyfill');
    // Missing: interface.css and interface.js

    // Execute - should not throw
    await mkdir(destDir);
    await copyPreviewAssets(assetsDir, destDir);

    // Verify existing file was copied
    expect(await fileExists(path.join(destDir, 'paged.polyfill.js'))).toBe(true);

    // Missing files should not exist
    expect(await fileExists(path.join(destDir, 'interface.css'))).toBe(false);
    expect(await fileExists(path.join(destDir, 'interface.js'))).toBe(false);
  });

  it('should create destination directory if it does not exist', async () => {
    // Setup
    await writeFile(path.join(assetsDir, 'paged.polyfill.js'), '// polyfill');

    // Execute with non-existent destination
    const newDestDir = path.join(testDir, 'new-dest');
    await copyPreviewAssets(assetsDir, newDestDir);

    // Verify destination was created and file copied
    expect(await isDirectory(newDestDir)).toBe(true);
    expect(await fileExists(path.join(newDestDir, 'paged.polyfill.js'))).toBe(true);
  });

  it('should verify file content is preserved', async () => {
    // Setup with specific content
    const polyfillContent = '// paged.js polyfill v0.1.0\nconsole.log("loaded");';
    const cssContent = '/* Interface styles */\n.preview { display: block; }';
    const jsContent = '// Interface script\nwindow.preview = true;';

    await writeFile(path.join(assetsDir, 'paged.polyfill.js'), polyfillContent);
    await writeFile(path.join(assetsDir, 'interface.css'), cssContent);
    await writeFile(path.join(assetsDir, 'interface.js'), jsContent);

    // Execute
    await mkdir(destDir);
    await copyPreviewAssets(assetsDir, destDir);

    // Verify content is identical
    const copiedPolyfill = await fs.readFile(path.join(destDir, 'paged.polyfill.js'), 'utf-8');
    const copiedCss = await fs.readFile(path.join(destDir, 'interface.css'), 'utf-8');
    const copiedJs = await fs.readFile(path.join(destDir, 'interface.js'), 'utf-8');

    expect(copiedPolyfill).toBe(polyfillContent);
    expect(copiedCss).toBe(cssContent);
    expect(copiedJs).toBe(jsContent);
  });
});
