/**
 * CSS utility functions for resolving imports and processing CSS files
 * Shared by both build and preview modes to ensure consistency
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readFile as fsReadFile } from 'fs/promises';
import { fileExists } from './file-utils.ts';
import type { ImportResolutionResult } from '../types.ts';

/**
 * Information about a CSS @import statement with line context
 * Used for enhanced error messages and debugging
 */
interface ImportInfo {
  /** The path specified in the @import statement (e.g., "theme/colors.css") */
  importPath: string;
  /** Line number where the import appears (1-indexed) */
  lineNumber: number;
  /** The full line content containing the import */
  lineContent: string;
  /** The full @import match string (e.g., '@import "file.css";') */
  fullMatch: string;
  /** Character index in the original CSS content */
  charIndex: number;
  /** Resolved absolute path (if successfully resolved) */
  resolvedPath?: string;
}

/**
 * Extract line number for a character index in text
 * @param text - The full text content
 * @param charIndex - Character position in the text
 * @returns 1-indexed line number
 */
function getLineNumber(text: string, charIndex: number): number {
  const upToIndex = text.substring(0, charIndex);
  return upToIndex.split('\n').length;
}

/**
 * Get the content of a specific line (1-indexed)
 * @param text - The full text content
 * @param lineNumber - 1-indexed line number
 * @returns The line content (without newline)
 */
function getLineContent(text: string, lineNumber: number): string {
  const lines = text.split('\n');
  return lines[lineNumber - 1] || '';
}

/**
 * Extract all @import statements with their line context
 * @param cssContent - CSS content to analyze
 * @returns Array of import information with line numbers and context
 */
function extractImports(cssContent: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const importRegex = /@import\s+(?:url\()?['"]([^'"]+)['"](?:\))?;?/g;

  let match;
  while ((match = importRegex.exec(cssContent)) !== null) {
    const importPath = match[1];
    const charIndex = match.index;
    const lineNumber = getLineNumber(cssContent, charIndex);
    const lineContent = getLineContent(cssContent, lineNumber);

    imports.push({
      importPath,
      lineNumber,
      lineContent: lineContent.trim(),
      fullMatch: match[0],
      charIndex,
    });
  }

  return imports;
}

/**
 * Recursively resolve @import statements in CSS
 *
 * This function processes CSS files to inline all @import statements, replacing them
 * with the actual content of the imported files. It handles nested imports, detects
 * circular dependencies, and collects both warnings and errors for caller inspection.
 *
 * Enhanced error messages include:
 * - File and line number references (e.g., "main.css:15")
 * - The actual @import statement that failed
 * - All paths searched when a file is not found
 * - Context for read errors
 *
 * @param cssContent - CSS content that may contain @imports
 * @param cssFilePath - Absolute path to the CSS file (for resolving relative @imports)
 * @param options - Configuration options
 * @param options.failOnMissing - If true, missing imports are errors; if false, warnings (default: true)
 * @param options.processedFiles - Internal: Set of already processed files (prevents circular imports)
 * @returns ImportResolutionResult with resolved CSS, warnings, and errors
 *
 * @example
 * ```typescript
 * const result = await resolveImports(cssContent, '/path/to/file.css');
 * if (result.errors.length > 0) {
 *   console.error('CSS import errors:', result.errors);
 *   throw new Error('Failed to resolve CSS imports');
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('CSS import warnings:', result.warnings);
 * }
 * return result.resolvedCSS;
 * ```
 */
export async function resolveImports(
  cssContent: string,
  cssFilePath: string,
  options: {
    failOnMissing?: boolean;
    processedFiles?: Set<string>;
  } = {}
): Promise<ImportResolutionResult> {
  const {
    failOnMissing = true,
    processedFiles = new Set<string>()
  } = options;

  const warnings: string[] = [];
  const errors: string[] = [];

  // Detect circular imports
  if (processedFiles.has(cssFilePath)) {
    const circularChain = Array.from(processedFiles).join(' → ') + ' → ' + cssFilePath;
    errors.push(`Circular import detected: ${circularChain}`);
    return { resolvedCSS: '', warnings, errors };
  }

  // Track this file in the import chain
  const newProcessedFiles = new Set(processedFiles);
  newProcessedFiles.add(cssFilePath);

  const cssDir = path.dirname(cssFilePath);

  // Extract all imports with line context
  const imports = extractImports(cssContent);

  // Filter out external URLs
  const localImports = imports.filter(imp =>
    !imp.importPath.startsWith('http://') &&
    !imp.importPath.startsWith('https://') &&
    !imp.importPath.startsWith('//')
  );

  let resolvedCSS = cssContent;

  // Get bundled assets directory for resolving absolute paths (e.g., /plugins/foo.css)
  // When running from dist/cli.js (bundled): assets are in dist/assets/
  // When running from src/utils/css-utils.ts: assets are in src/assets/
  const thisFilePath = fileURLToPath(import.meta.url);
  const thisFileDir = path.dirname(thisFilePath);
  const { existsSync } = await import('fs');

  // Try multiple possible locations
  const possibleAssetsDirs = [
    path.join(thisFileDir, 'assets'),       // Same dir as bundled file: dist/assets
    path.join(thisFileDir, '../assets'),    // One level up: src/assets (when in src/utils/)
    path.join(thisFileDir, '../../assets'), // Two levels up: src/assets (fallback)
  ];

  let bundledAssetsDir = possibleAssetsDirs[0]; // Default
  for (const dir of possibleAssetsDirs) {
    if (existsSync(dir)) {
      bundledAssetsDir = dir;
      break;
    }
  }

  // Process imports in reverse order to avoid offset issues
  for (const importInfo of localImports.reverse()) {
    const { importPath: file, fullMatch: match } = importInfo;
    let importPath: string;

    // Handle absolute paths (e.g., /plugins/foo.css, /themes/dark.css)
    // These reference bundled assets, not filesystem root
    if (file.startsWith('/')) {
      importPath = path.join(bundledAssetsDir, file.substring(1));
    } else {
      // Relative paths - resolve relative to current CSS file's directory
      importPath = path.resolve(cssDir, file);
    }

    if (await fileExists(importPath)) {
      try {
        const importedContent = await fsReadFile(importPath, 'utf-8');

        // Recursively resolve imports in the imported file
        const nestedResult = await resolveImports(
          importedContent,
          importPath,
          {
            failOnMissing,
            processedFiles: newProcessedFiles
          }
        );

        // Merge warnings and errors from nested resolution
        warnings.push(...nestedResult.warnings);
        errors.push(...nestedResult.errors);

        // Replace @import with resolved content (with debugging comment)
        const relativeSourcePath = path.basename(cssFilePath);
        resolvedCSS = resolvedCSS.replace(
          match,
          `\n/* From: ${file} (${relativeSourcePath}) */\n${nestedResult.resolvedCSS}\n/* End: ${file} */\n`
        );
      } catch (error) {
        // Enhanced read error message
        const relativeSourcePath = path.basename(cssFilePath);
        const errorMsg =
          `CSS import file found but could not be read: ${importPath}\n` +
          `  Referenced in: ${relativeSourcePath}\n` +
          `  Import: @import "${file}"\n` +
          `  Error: ${(error as Error).message}`;

        if (failOnMissing) {
          errors.push(errorMsg);
        } else {
          warnings.push(errorMsg);
        }
        // Keep the @import statement if resolution fails
      }
    } else {
      // Enhanced "not found" error message
      const relativeSourcePath = path.basename(cssFilePath);
      const errorMsg =
        `CSS import file not found: ${file}\n` +
        `  Referenced in: ${relativeSourcePath}\n` +
        `  Resolved path: ${importPath}`;

      if (failOnMissing) {
        errors.push(errorMsg);
      } else {
        warnings.push(errorMsg);
      }
      // Keep the @import statement if file doesn't exist
    }
  }

  return { resolvedCSS, warnings, errors };
}
