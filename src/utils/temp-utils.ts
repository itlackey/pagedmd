/**
 * Temporary directory utilities for preview server
 *
 * Provides functions for creating and managing temporary preview directories.
 */

import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import path from 'path';
import { rm, mkdir } from 'fs/promises';

/**
 * Generate a unique temporary directory name
 * Pattern: /tmp/pagedmd-preview-{timestamp}-{random}/
 *
 * @returns Absolute path to unique temp directory (not yet created)
 */
export function generateTempDirName(): string {
  const timestamp = Date.now();
  const randomId = randomBytes(8).toString('hex'); // Increased from 3 to 8 bytes for better collision resistance
  return path.join(tmpdir(), `pagedmd-preview-${timestamp}-${randomId}`);
}

/**
 * Create a temporary directory for preview output
 *
 * @param dirPath - Optional path (if not provided, generates unique name)
 * @returns Path to created directory
 * @throws Error if directory creation fails
 */
export async function createTempDir(dirPath?: string): Promise<string> {
  const tempDir = dirPath || generateTempDirName();

  try {
    await mkdir(tempDir, { recursive: true });
    return tempDir;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create temp directory ${tempDir}: ${message}`);
  }
}

/**
 * Clean up temporary directory
 * Deletes directory and all contents
 *
 * @param dirPath - Path to temp directory to delete
 * @param force - If true, ignore errors (default: true)
 * @throws Error if deletion fails and force=false
 */
export async function cleanupTempDir(dirPath: string, force = true): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force });
  } catch (error) {
    if (!force) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to cleanup temp directory ${dirPath}: ${message}`);
    }
    // Log warning instead of silently ignoring
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Failed to cleanup ${dirPath}: ${message}`);
  }
}
