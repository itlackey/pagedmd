/**
 * ManifestWriter - Thread-safe manifest.yaml writer with atomic operations
 *
 * Provides concurrent write protection using a promise chain pattern and
 * atomic file operations (temp file + rename) to prevent data corruption.
 *
 * IMPORTANT: Use a single ManifestWriter instance per manifest file.
 * Multiple instances targeting the same file can interleave writes.
 *
 * Usage:
 * ```typescript
 * // ✅ CORRECT: Single instance in preview server
 * const writer = new ManifestWriter('/path/to/manifest.yaml');
 * await writer.update({ title: 'A' });
 * await writer.update({ title: 'B' });
 *
 * // ❌ INCORRECT: Multiple instances
 * const writer1 = new ManifestWriter('/path/to/manifest.yaml');
 * const writer2 = new ManifestWriter('/path/to/manifest.yaml');
 * await Promise.all([
 *   writer1.update({ title: 'A' }),
 *   writer2.update({ title: 'B' })  // May interleave!
 * ]);
 * ```
 */

import { rename } from 'fs/promises';
import YAML from 'js-yaml';
import { loadManifest } from './config.ts';
import { validateManifest } from './config.ts';
import { error as logError } from './logger.ts';
import type { Manifest } from '../types.ts';

/**
 * Thread-safe manifest writer with atomic operations
 *
 * Serializes concurrent writes using a promise chain to prevent race conditions.
 * Uses atomic write pattern (temp file + rename) to prevent partial writes.
 *
 * IMPORTANT: Use a single ManifestWriter instance per manifest file.
 * Multiple instances targeting the same file can interleave writes.
 *
 * @example
 * // ✅ CORRECT: Single instance in preview server
 * const writer = new ManifestWriter('/path/manifest.yaml');
 * await writer.update({ title: 'A' });
 * await writer.update({ title: 'B' });
 *
 * // ❌ INCORRECT: Multiple instances
 * const writer1 = new ManifestWriter('/path/manifest.yaml');
 * const writer2 = new ManifestWriter('/path/manifest.yaml');
 * await Promise.all([
 *   writer1.update({ title: 'A' }),
 *   writer2.update({ title: 'B' })  // May interleave!
 * ]);
 */
export class ManifestWriter {
  /** Promise chain to serialize concurrent writes */
  private writeLock: Promise<void> = Promise.resolve();

  /** Absolute path to manifest.yaml file */
  private manifestPath: string;

  /** Number of pending write operations (for monitoring) */
  private pendingWrites: number = 0;

  /**
   * Create a new ManifestWriter
   * @param manifestPath - Absolute path to manifest.yaml file
   */
  constructor(manifestPath: string) {
    this.manifestPath = manifestPath;
  }

  /**
   * Get the number of pending write operations
   * @returns Number of writes currently in progress or queued
   */
  getPendingWrites(): number {
    return this.pendingWrites;
  }

  /**
   * Update manifest with partial changes
   *
   * Thread-safe: Serializes concurrent updates using promise chain
   * Atomic: Uses temp file + rename to prevent corruption
   * Error-isolated: Each write is independent, previous failures don't block subsequent writes
   *
   * @param updates - Partial manifest updates to apply
   * @returns Updated manifest after write completes
   * @throws Error if validation fails or I/O error occurs
   */
  async update(updates: Partial<Manifest>): Promise<Manifest> {
    // Increment pending writes counter for monitoring
    this.pendingWrites++;

    // Capture the current lock to wait for
    const previousLock = this.writeLock;

    // Create a new lock for this operation
    let releaseLock: () => void;
    this.writeLock = new Promise((resolve) => {
      releaseLock = resolve;
    });

    try {
      // Wait for previous operation (ignore failures to prevent error propagation)
      await previousLock.catch(() => {});

      // Perform THIS write independently
      // Load current manifest from disk (pass manifest path, it will extract directory)
      // loadManifest returns null if file doesn't exist
      const current = await loadManifest(this.manifestPath);

      // Merge updates (preserving existing fields, handle null case)
      const updated: Manifest = { ...(current || {}), ...updates };

      // Validate merged manifest structure
      const validated = validateManifest(updated, this.manifestPath);

      // Atomic write pattern: temp file + rename
      // Use unique temp file name to prevent collision on rapid updates
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const tempPath = `${this.manifestPath}.tmp.${timestamp}.${random}`;

      try {
        // Write to temp file with consistent YAML formatting
        const yamlContent = YAML.dump(validated, {
          indent: 2,
          lineWidth: 80,
          noRefs: true, // Disable anchors/aliases for cleaner output
        });

        await Bun.write(tempPath, yamlContent);

        // Atomic rename (overwrites target on all platforms)
        await rename(tempPath, this.manifestPath);

        return validated;
      } catch (err) {
        // Preserve failed temp file for debugging (rename to .failed)
        const failedPath = `${tempPath}.failed`;
        try {
          await rename(tempPath, failedPath);
        } catch {
          // Ignore cleanup errors (temp file may not exist)
        }

        const error = err as Error;
        logError(
          `Failed to write manifest: ${error.message}\n` +
            `Temp file preserved at: ${failedPath}`
        );
        throw new Error(
          `Manifest write failed: ${error.message}\n` +
            `Path: ${this.manifestPath}\n` +
            `Temp file preserved at: ${failedPath}`
        );
      }
    } finally {
      // Always release the lock and decrement pending writes counter
      this.pendingWrites--;
      releaseLock!();
    }
  }

  /**
   * Get the path to the manifest file being managed
   * @returns Absolute path to manifest.yaml
   */
  getManifestPath(): string {
    return this.manifestPath;
  }
}
