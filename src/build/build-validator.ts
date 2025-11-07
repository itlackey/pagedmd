/**
 * Simplified build validation for pagedmd
 *
 * Just the essentials - verify required files exist.
 * This is a personal tool, not production software.
 */

import { existsSync } from 'fs';

/**
 * Validate that input path exists
 *
 * @param inputPath - Path to validate
 * @throws Error if path doesn't exist
 */
export function validateInputExists(inputPath: string): void {
  if (!existsSync(inputPath)) {
    throw new Error(`Input path not found: ${inputPath}`);
  }
}

/**
 * Validate that output directory's parent exists
 * (We'll create the file itself, but parent directory must exist)
 *
 * @param outputPath - Output file path
 * @throws Error if parent directory doesn't exist
 */
export function validateOutputParent(outputPath: string): void {
  const path = require('path');
  const parentDir = path.dirname(outputPath);

  if (!existsSync(parentDir)) {
    throw new Error(`Output directory not found: ${parentDir}`);
  }
}
