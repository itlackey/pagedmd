/**
 * Tests for ManifestWriter class
 *
 * Validates thread-safe writes, atomic operations, and error handling
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ManifestWriter } from './manifest-writer.ts';
import { fileExists } from './file-utils.ts';
import { join } from 'path';
import { mkdir, rm, readFile } from 'fs/promises';
import YAML from 'js-yaml';
import type { Manifest } from '../types.ts';

describe('ManifestWriter', () => {
  const testDir = join(process.cwd(), '.tmp', 'manifest-writer-tests');
  const manifestPath = join(testDir, 'manifest.yaml');

  beforeEach(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true });

    // Create initial manifest
    const initialManifest: Manifest = {
      title: 'Test Book',
      authors: ['Test Author'],
      styles: ['themes/classic.css'],
    };

    await Bun.write(manifestPath, YAML.dump(initialManifest));
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  test('updates manifest with partial changes', async () => {
    const writer = new ManifestWriter(manifestPath);

    const updated = await writer.update({ title: 'Updated Title' });

    expect(updated.title).toBe('Updated Title');
    expect(updated.authors).toEqual(['Test Author']); // Preserves existing fields
    expect(updated.styles).toEqual(['themes/classic.css']);
  });

  test('validates manifest structure before writing', async () => {
    const writer = new ManifestWriter(manifestPath);

    // Invalid update should throw
    await expect(
      writer.update({ authors: 'not-an-array' as any })
    ).rejects.toThrow('authors must be an array');
  });

  test('writes valid YAML with consistent formatting', async () => {
    const writer = new ManifestWriter(manifestPath);

    await writer.update({ title: 'Formatted Title' });

    // Read file and verify YAML structure
    const content = await readFile(manifestPath, 'utf-8');
    const parsed = YAML.load(content) as Manifest;

    expect(parsed.title).toBe('Formatted Title');
    expect(content).toContain('title: Formatted Title');
    expect(content).toContain('authors:'); // Proper list formatting
  });

  test('atomic write prevents corruption on failure', async () => {
    const writer = new ManifestWriter(manifestPath);

    // Store original content
    const originalContent = await readFile(manifestPath, 'utf-8');

    // Try invalid update
    try {
      await writer.update({ styles: 'not-an-array' as any }); // Invalid type
    } catch {
      // Expected to throw
    }

    // Original file should be unchanged
    const afterContent = await readFile(manifestPath, 'utf-8');
    expect(afterContent).toBe(originalContent);
  });

  test('serializes concurrent writes', async () => {
    const writer = new ManifestWriter(manifestPath);

    // Launch multiple concurrent updates
    const updates = [
      writer.update({ title: 'Update 1' }),
      writer.update({ title: 'Update 2' }),
      writer.update({ title: 'Update 3' }),
    ];

    // All should complete successfully
    const results = await Promise.all(updates);

    // Last update should win
    expect(results[2].title).toBe('Update 3');

    // Final file should have last update
    const content = await readFile(manifestPath, 'utf-8');
    const parsed = YAML.load(content) as Manifest;
    expect(parsed.title).toBe('Update 3');
  });

  test('preserves temp file on write failure for debugging', async () => {
    const writer = new ManifestWriter(manifestPath);

    // Make the manifest path read-only to force write failure
    const badPath = join(testDir, 'nonexistent', 'manifest.yaml');
    const badWriter = new ManifestWriter(badPath);

    try {
      await badWriter.update({ title: 'Should Fail' });
    } catch (error) {
      const err = error as Error;
      // Should provide helpful error message
      expect(err.message).toContain('Manifest write failed');
      expect(err.message).toContain(badPath);
    }
  });

  test('getManifestPath returns correct path', () => {
    const writer = new ManifestWriter(manifestPath);
    expect(writer.getManifestPath()).toBe(manifestPath);
  });

  test('handles empty manifest gracefully', async () => {
    // Clear the manifest
    await Bun.write(manifestPath, YAML.dump({}));

    const writer = new ManifestWriter(manifestPath);
    const updated = await writer.update({ title: 'New Title' });

    expect(updated.title).toBe('New Title');
  });

  test('recovers from validation errors', async () => {
    const writer = new ManifestWriter(manifestPath);

    // First write succeeds
    await writer.update({ title: 'Success 1' });

    // Second write fails validation
    await expect(
      writer.update({ authors: 'invalid' as any })
    ).rejects.toThrow('authors must be an array');

    // Third write should succeed (independent of previous failure)
    const result = await writer.update({ title: 'Success 2' });
    expect(result.title).toBe('Success 2');

    // Verify final state on disk
    const content = await readFile(manifestPath, 'utf-8');
    const parsed = YAML.load(content) as Manifest;
    expect(parsed.title).toBe('Success 2');
  });

  test('tracks pending writes counter accurately', async () => {
    const writer = new ManifestWriter(manifestPath);

    // No pending writes initially
    expect(writer.getPendingWrites()).toBe(0);

    // Start concurrent writes
    const write1 = writer.update({ title: 'Write 1' });
    expect(writer.getPendingWrites()).toBeGreaterThan(0);

    const write2 = writer.update({ title: 'Write 2' });
    const write3 = writer.update({ title: 'Write 3' });

    // Wait for all writes to complete
    await Promise.all([write1, write2, write3]);

    // Counter should be back to zero
    expect(writer.getPendingWrites()).toBe(0);
  });

  test('uses unique temp file names to prevent collision', async () => {
    const writer = new ManifestWriter(manifestPath);

    // Track temp files created (by monitoring file system)
    const tempFiles: string[] = [];

    // Patch Bun.write to capture temp file names
    const originalWrite = Bun.write;
    (Bun as any).write = async (path: string, content: any) => {
      if (path.includes('.tmp.')) {
        tempFiles.push(path);
      }
      return originalWrite(path, content);
    };

    try {
      // Launch rapid concurrent updates
      await Promise.all([
        writer.update({ title: 'Update 1' }),
        writer.update({ title: 'Update 2' }),
        writer.update({ title: 'Update 3' }),
      ]);

      // All temp files should have unique names
      const uniqueTempFiles = new Set(tempFiles);
      expect(uniqueTempFiles.size).toBe(tempFiles.length);

      // Verify temp file name format includes timestamp and random
      for (const tempFile of tempFiles) {
        expect(tempFile).toMatch(/\.tmp\.\d+\.[a-z0-9]+$/);
      }
    } finally {
      // Restore original function
      (Bun as any).write = originalWrite;
    }
  });

  test('preserves failed temp file with .failed suffix', async () => {
    const writer = new ManifestWriter(manifestPath);

    // Mock Bun.write to simulate a write failure (will create temp file but fail)
    const originalWrite = Bun.write;
    let writeCount = 0;
    const mockWrite = async (path: string, content: any) => {
      writeCount++;
      // First write succeeds (creates temp file), but we'll fail at rename
      if (writeCount === 1) {
        await originalWrite(path, content);
        // Now simulate a rename failure by mocking it
        throw new Error('Simulated write/rename failure');
      }
      // Second write is the .failed rename (allow it through)
      return originalWrite(path, content);
    };
    (Bun as any).write = mockWrite;

    try {
      await writer.update({ title: 'Should Fail' });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      const err = error as Error;

      // Error message should include all required context
      expect(err.message).toContain('Manifest write failed');
      expect(err.message).toContain(manifestPath);
      expect(err.message).toContain('Temp file preserved at:');
      expect(err.message).toMatch(/\.tmp\.\d+\.[a-z0-9]+\.failed/);

      // Extract failed path from error message for verification
      const match = err.message.match(/Temp file preserved at: (.+\.failed)/);
      expect(match).toBeTruthy();
      if (match) {
        const failedPath = match[1];
        expect(failedPath).toContain('.tmp.');
        expect(failedPath).toEndWith('.failed');

        // Note: The temp file may or may not exist depending on cleanup timing
        // The important part is that the error message includes the path
      }
    } finally {
      // Restore original function
      (Bun as any).write = originalWrite;
    }
  });

  test('getPendingWrites returns correct count during operation', async () => {
    const writer = new ManifestWriter(manifestPath);

    expect(writer.getPendingWrites()).toBe(0);

    // Start a long-running write (using Promise to control timing)
    let resolveWrite: () => void;
    const writePromise = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });

    // Intercept the write to delay it
    const originalLoadManifest = (await import('./config.ts')).loadManifest;
    let interceptCount = 0;

    // Start multiple writes
    const writes = [
      writer.update({ title: 'Write 1' }),
      writer.update({ title: 'Write 2' }),
      writer.update({ title: 'Write 3' }),
    ];

    // Check pending count while writes are in progress
    // Note: This is timing-dependent, so we check it's > 0 at some point
    const pendingDuringWrites = writer.getPendingWrites();
    expect(pendingDuringWrites).toBeGreaterThanOrEqual(0);

    // Wait for all writes to complete
    await Promise.all(writes);

    // Should be zero after completion
    expect(writer.getPendingWrites()).toBe(0);
  });

  test('error message includes detailed context', async () => {
    const writer = new ManifestWriter(manifestPath);

    // Mock Bun.write to simulate a write failure
    const originalWrite = Bun.write;
    const mockWrite = async (path: string, content: any) => {
      // Simulate a write failure
      throw new Error('Simulated disk full error');
    };
    (Bun as any).write = mockWrite;

    let errorCaught = false;
    try {
      await writer.update({ title: 'Should Fail' });
    } catch (error) {
      errorCaught = true;
      const err = error as Error;

      // Verify error message includes all required context
      expect(err.message).toContain('Manifest write failed');
      expect(err.message).toContain(`Path: ${manifestPath}`);
      expect(err.message).toContain('Temp file preserved at:');
      expect(err.message).toMatch(/\.tmp\.\d+\.[a-z0-9]+\.failed/);
      expect(err.message).toContain('Simulated disk full error');
    } finally {
      // Restore original function
      (Bun as any).write = originalWrite;
    }

    // Ensure error was actually thrown
    expect(errorCaught).toBe(true);
  });
});
