/**
 * Asset Copier Utility
 *
 * Unified asset copying functionality used by format strategies.
 * Handles recursive directory traversal, file filtering, and error collection.
 */

import path from 'path';
import { promises as fs } from 'fs';
import { mkdir, isDirectory, readDirectory, fileExists } from '../utils/file-utils.js';
import { debug } from '../utils/logger.js';
import { FILENAMES, EXTENSIONS } from '../constants.js';

/**
 * Configuration options for asset copying
 */
export interface AssetCopyOptions {
  /** Source directory to copy from */
  sourceDir: string;
  /** Destination directory to copy to (creates 'assets' subdirectory) */
  destDir: string;
  /** File patterns to exclude (default: ['.md', 'manifest.yaml', 'index.html']) */
  excludePatterns?: string[];
  /** Whether to copy hidden files/directories (default: false) */
  includeHidden?: boolean;
  /** Whether to preserve file timestamps (default: false) */
  preserveTimestamps?: boolean;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
}

/**
 * Result of asset copying operation
 */
export interface AssetCopyResult {
  /** Number of files successfully copied */
  copiedFiles: number;
  /** Number of files skipped (filtered or errors) */
  skippedFiles: number;
  /** Errors encountered during copy (non-fatal) */
  errors: Array<{ file: string; error: Error }>;
}

/**
 * AssetCopier - Unified asset copying utility
 *
 * Copies assets from input directory to output directory with:
 * - Configurable filtering (exclude patterns, hidden files)
 * - Recursive directory traversal
 * - Error collection (continues on failures)
 * - Statistics tracking
 * - Preserves directory structure
 */
export class AssetCopier {
  private options: Required<AssetCopyOptions>;
  private stats = {
    copiedFiles: 0,
    skippedFiles: 0,
    errors: [] as Array<{ file: string; error: Error }>,
  };

  /**
   * Create a new AssetCopier with default options
   */
  constructor(options: AssetCopyOptions) {
    this.options = {
      excludePatterns: [EXTENSIONS.MARKDOWN, FILENAMES.MANIFEST, FILENAMES.OUTPUT_HTML],
      includeHidden: false,
      preserveTimestamps: false,
      verbose: false,
      ...options,
    };
  }

  /**
   * Copy assets from source to destination
   *
   * Process:
   * 1. Validate source directory exists
   * 2. Create destination assets directory
   * 3. Copy all files/directories (filtered)
   * 4. Return statistics
   *
   * @returns Statistics about the copy operation
   */
  async copyAssets(): Promise<AssetCopyResult> {
    // Reset statistics for this run
    this.stats = {
      copiedFiles: 0,
      skippedFiles: 0,
      errors: [],
    };

    const { sourceDir, destDir } = this.options;

    // Check if source exists first
    if (!(await fileExists(sourceDir))) {
      debug(`Source path not found, skipping asset copy: ${sourceDir}`);
      return this.getResult();
    }

    // Resolve source directory (handle both directory and file inputs)
    const inputDir = (await isDirectory(sourceDir)) ? sourceDir : path.dirname(sourceDir);

    // Read all entries in input directory
    const entries = await readDirectory(inputDir);

    for (const entry of entries) {
      const srcPath = path.join(inputDir, entry.name);

      // Apply filtering
      if (this.shouldSkip(entry.name)) {
        this.stats.skippedFiles++;
        continue;
      }

      try {
        if (entry.isDirectory()) {
          // Copy entire subdirectory directly to destination
          const destPath = path.join(destDir, entry.name);
          await this.copyDirectory(srcPath, destPath);
          if (this.options.verbose) {
            debug(`Copied directory: ${entry.name}`);
          }
        } else if (entry.isFile()) {
          // Copy file directly to destination
          const destPath = path.join(destDir, entry.name);
          await this.copyFile(srcPath, destPath);
          if (this.options.verbose) {
            debug(`Copied file: ${entry.name}`);
          }
        }
      } catch (error) {
        // Collect error and continue
        this.stats.errors.push({
          file: srcPath,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        this.stats.skippedFiles++;
      }
    }

    return this.getResult();
  }

  /**
   * Recursively copy directory with filtering
   *
   * @param src Source directory path
   * @param dest Destination directory path
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await mkdir(dest);
    const entries = await readDirectory(src);

    for (const entry of entries) {
      // Apply filtering at every level
      if (this.shouldSkip(entry.name)) {
        this.stats.skippedFiles++;
        continue;
      }

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      try {
        if (entry.isDirectory()) {
          await this.copyDirectory(srcPath, destPath);
        } else if (entry.isFile()) {
          await this.copyFile(srcPath, destPath);
        }
      } catch (error) {
        // Collect error and continue
        this.stats.errors.push({
          file: srcPath,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        this.stats.skippedFiles++;
      }
    }
  }

  /**
   * Copy a single file with optional timestamp preservation
   *
   * @param src Source file path
   * @param dest Destination file path
   */
  private async copyFile(src: string, dest: string): Promise<void> {
    await fs.copyFile(src, dest);
    this.stats.copiedFiles++;

    // Preserve timestamps if requested
    if (this.options.preserveTimestamps) {
      try {
        const stats = await fs.stat(src);
        await fs.utimes(dest, stats.atime, stats.mtime);
      } catch (error) {
        // Non-fatal: timestamp preservation failed
        debug(`Failed to preserve timestamps for ${dest}: ${error}`);
      }
    }
  }

  /**
   * Check if a file/directory should be skipped
   *
   * @param name File or directory name
   * @returns True if should be skipped
   */
  private shouldSkip(name: string): boolean {
    // Skip hidden files/directories if not included
    if (!this.options.includeHidden && name.startsWith('.')) {
      return true;
    }

    // Skip node_modules (always)
    if (name === 'node_modules') {
      return true;
    }

    // Check exclude patterns
    for (const pattern of this.options.excludePatterns) {
      if (pattern.startsWith('.')) {
        // Extension pattern (e.g., '.md')
        if (name.endsWith(pattern)) {
          return true;
        }
      } else {
        // Exact match (e.g., 'manifest.yaml')
        if (name === pattern) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get the current copy result
   */
  private getResult(): AssetCopyResult {
    return {
      copiedFiles: this.stats.copiedFiles,
      skippedFiles: this.stats.skippedFiles,
      errors: [...this.stats.errors],
    };
  }
}
