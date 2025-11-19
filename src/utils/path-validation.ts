/**
 * Path validation utilities for output path conflict detection
 *
 * Validates output paths against format requirements to prevent accidental data loss
 * and path traversal attacks
 */

import { existsSync, statSync } from 'fs';
import path from 'path';
import type { OutputFormat, OutputValidation } from '../types.ts';

/**
 * Validate that a path is safe and doesn't contain directory traversal
 *
 * @param targetPath Path to validate
 * @param basePath Base directory that the path should be contained within
 * @returns True if path is safe, false if it attempts directory traversal
 * @throws Error if path contains directory traversal attempt
 */
export function validateSafePath(targetPath: string, basePath: string): boolean {
  const normalizedTarget = path.normalize(targetPath);
  const normalizedBase = path.normalize(basePath);
  const resolvedTarget = path.resolve(normalizedBase, normalizedTarget);
  const resolvedBase = path.resolve(normalizedBase);

  // Check if the resolved target path is within the base directory
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new Error(
      `Path traversal attempt detected: "${targetPath}" attempts to access outside "${basePath}"`
    );
  }

  return true;
}

/**
 * Validate output path for a specific format
 *
 * @param format Output format (html, pdf, or preview)
 * @param outputPath Path to validate
 * @param force Whether to skip validation
 * @returns Validation result with conflict type and suggestions
 */
export function validateOutputPath(
  format: OutputFormat,
  outputPath: string,
  force: boolean
): OutputValidation {
  // Skip validation if force flag is set
  if (force) {
    return {
      isValid: true,
      conflictType: 'none',
      message: 'Output path validation skipped (--force)',
      suggestedFix: null
    };
  }

  // Check if parent directory exists
  const parentDir = path.dirname(outputPath);
  if (!existsSync(parentDir)) {
    return {
      isValid: false,
      conflictType: 'parent-missing',
      message: `Parent directory '${parentDir}' does not exist.`,
      suggestedFix: `Create the directory first: mkdir -p ${parentDir}`
    };
  }

  // Check if output path exists
  const pathExists = existsSync(outputPath);

  if (!pathExists) {
    // Path doesn't exist - valid for all formats
    return {
      isValid: true,
      conflictType: 'none',
      message: 'Output path is valid',
      suggestedFix: null
    };
  }

  // Path exists - check type against format requirements
  const stats = statSync(outputPath);
  const isFile = stats.isFile();
  const isDirectory = stats.isDirectory();

  // PDF format requires file path, not directory
  if (format === 'pdf') {
    if (isDirectory) {
      return {
        isValid: false,
        conflictType: 'directory-for-file',
        message: `Output path '${outputPath}' is a directory, but PDF format requires a file path.`,
        suggestedFix: `Use '${path.join(outputPath, 'output.pdf')}' or add --force to overwrite.`
      };
    }
    // Existing file is OK for PDF (will be overwritten)
    return {
      isValid: true,
      conflictType: 'none',
      message: 'Output path is valid (existing file will be overwritten)',
      suggestedFix: null
    };
  }

  // HTML and Preview formats require directory path, not file
  if (format === 'html' || format === 'preview') {
    if (isFile) {
      return {
        isValid: false,
        conflictType: 'file-for-directory',
        message: `Output path '${outputPath}' is a file, but ${format.toUpperCase()} format requires a directory path.`,
        suggestedFix: `Remove the file or use --force to overwrite.`
      };
    }
    // Existing directory is OK for HTML/Preview (will write into it)
    return {
      isValid: true,
      conflictType: 'none',
      message: 'Output path is valid (will write into existing directory)',
      suggestedFix: null
    };
  }

  // Should never reach here
  return {
    isValid: false,
    conflictType: 'none',
    message: `Unknown format: ${format}`,
    suggestedFix: null
  };
}
