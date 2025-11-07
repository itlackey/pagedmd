/**
 * Tests for file utilities with focus on error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  copyDirectory,
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
