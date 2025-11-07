/**
 * Simplified file utilities - core file I/O only
 *
 * Provides essential file operations: read, write, resolve paths, check existence
 */

import { promises as fs } from 'fs';
import path from 'path';
import { BuildError } from './errors.ts';

/**
 * Read a file as UTF-8 text
 * @throws Error if file doesn't exist or can't be read
 */
export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Write content to a file, creating parent directories if needed
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Resolve a file path to absolute
 * If already absolute, returns as-is
 * If relative, resolves from current working directory
 */
export function resolveAbsolutePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a directory or file recursively
 * Safe to call even if path doesn't exist
 */
export async function remove(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true });
}

/**
 * Create a directory, including parent directories if needed
 */
export async function mkdir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Check if a path is a directory
 */
export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read all files in a directory
 * @param dirPath Directory path to read
 * @returns Array of directory entries
 */
export async function readDirectory(dirPath: string): Promise<fs.Dirent[]> {
  return await fs.readdir(dirPath, { withFileTypes: true });
}

/**
 * Copy a directory recursively with comprehensive error handling
 *
 * Attempts to copy all files even if some fail. Collects all errors and reports them
 * together at the end, allowing the caller to decide if partial success is acceptable.
 *
 * @param src Source directory path
 * @param dest Destination directory path
 * @param overwrite Whether to overwrite existing files (default: true)
 * @throws {Error} If source doesn't exist or isn't a directory
 * @throws {BuildError} If any files fail to copy (includes details of all failures)
 */
export async function copyDirectory(
  src: string,
  dest: string,
  overwrite = true
): Promise<void> {
  // Validate source exists and is a directory
  if (!(await fileExists(src))) {
    throw new Error(`Source directory does not exist: ${src}`);
  }

  if (!(await isDirectory(src))) {
    throw new Error(`Source path is not a directory: ${src}`);
  }

  // Create destination directory
  await mkdir(dest);

  // Read directory entries
  const entries = await readDirectory(src);

  // Track all copy errors instead of failing immediately
  const errors: Array<{ path: string; error: Error }> = [];

  // Attempt to copy all entries, collecting errors along the way
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    try {
      if (entry.isDirectory()) {
        // Recursively copy subdirectories
        // Note: Recursive calls may throw FileCopyError, which we catch and record
        await copyDirectory(srcPath, destPath, overwrite);
      } else {
        // Check overwrite setting
        if (!overwrite && (await fileExists(destPath))) {
          continue;
        }

        // Attempt file copy
        await fs.copyFile(srcPath, destPath);
      }
    } catch (error) {
      // Collect error details for this file/directory
      errors.push({
        path: srcPath,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // If any copies failed, throw detailed error with all failures
  if (errors.length > 0) {
    const fileList = errors
      .map(({ path, error }) => `  - ${path}: ${error.message}`)
      .join('\n');
    throw new BuildError(
      `Failed to copy ${errors.length} file(s) from ${src} to ${dest}:\n${fileList}`
    );
  }
}

/**
 * Wait for a file to be created
 * Polls for file existence with exponential backoff
 *
 * @param filePath - Path to file to wait for
 * @param options - Configuration options
 * @param options.timeout - Maximum wait time in milliseconds (default: 10000)
 * @param options.interval - Initial polling interval in milliseconds (default: 10)
 * @returns Promise that resolves when file exists
 * @throws {Error} If timeout is reached before file appears
 */
export async function waitForFile(
  filePath: string,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 10000, interval: initialInterval = 10 } = options;
  const startTime = Date.now();
  let interval = initialInterval;
  const maxInterval = 500;

  while (Date.now() - startTime < timeout) {
    if (await fileExists(filePath)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
    // Exponential backoff: 10ms -> 20ms -> 40ms -> ... -> 500ms
    interval = Math.min(interval * 2, maxInterval);
  }

  throw new Error(
    `Timeout waiting for file ${filePath} (waited ${timeout}ms)`
  );
}

/**
 * Recursively copy only markdown, yaml, and css files from source to destination
 * Skips node_modules, .git, and other build artifacts
 *
 * @param src Source directory path
 * @param dest Destination directory path
 * @param extensions File extensions to copy (default: .md, .yaml, .yml, .css)
 */
export async function copyMarkdownFiles(
  src: string,
  dest: string,
  extensions: string[] = ['.md', '.yaml', '.yml', '.css']
): Promise<void> {
  // Patterns to ignore
  const ignorePatterns = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.tmp',
    '.DS_Store',
    '.pagedmd',
  ];

  // Check if path should be ignored
  const shouldIgnore = (filePath: string): boolean => {
    return ignorePatterns.some(pattern => filePath.includes(pattern));
  };

  // Create destination directory if it doesn't exist
  await mkdir(dest);

  // Read source directory entries
  const entries = await readDirectory(src);

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip ignored paths
    if (shouldIgnore(srcPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      await copyMarkdownFiles(srcPath, destPath, extensions);
    } else if (entry.isFile()) {
      // Check if file extension matches allowed list
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        // Use Bun's efficient file operations
        const fileContent = await Bun.file(srcPath).arrayBuffer();
        await Bun.write(destPath, fileContent);
      }
    }
  }
}

/**
 * Copy specific preview assets to temp directory root
 * Only copies: paged.polyfill.js, interface.css, interface.js
 *
 * @param assetsDir Source assets directory path
 * @param destDir Destination directory path (files copied to root)
 */
export async function copyPreviewAssets(
  assetsDir: string,
  destDir: string
): Promise<void> {
  const requiredFiles = ['paged.polyfill.js', 'interface.css', 'interface.js'];

  // Ensure destination directory exists
  await mkdir(destDir);

  for (const fileName of requiredFiles) {
    const srcPath = path.join(assetsDir, fileName);
    const destPath = path.join(destDir, fileName);

    // Check if file exists in source
    if (await fileExists(srcPath)) {
      // Copy file using Bun's efficient operations
      const fileContent = await Bun.file(srcPath).arrayBuffer();
      await Bun.write(destPath, fileContent);
    } else {
      // Log warning but continue (non-critical)
      console.warn(`Preview asset not found: ${fileName} (expected at ${srcPath})`);
    }
  }
}
