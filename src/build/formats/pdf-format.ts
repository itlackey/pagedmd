/**
 * PDF Format Strategy
 *
 * Generates single PDF file using intermediate .tmp/ directory
 * Uses pagedjs-cli for pagination
 */

import path from 'path';
import { promises as fs } from 'fs';
import { generatePDF } from './pagedjs-cli-wrapper.ts';
import { writeFile, mkdir, remove, isDirectory, readDirectory, copyDirectory as copyDir } from '../../utils/file-utils.ts';
import { info, debug } from '../../utils/logger.ts';
import { validateOutputPath } from '../../utils/path-validation.ts';
import { BUILD, FILENAMES, EXTENSIONS } from '../../constants.ts';
import type { FormatStrategy, BuildOptions, OutputValidation, OutputFormat } from '../../types.ts';

export class PdfFormatStrategy implements FormatStrategy {
  /**
   * Build PDF output
   *
   * Process:
   * 1. Create .tmp/[basename]/ directory
   * 2. Copy assets to build directory
   * 3. Write HTML to .tmp/[basename]/index.html
   * 4. Run pagedjs-cli to generate PDF
   * 5. Clean up .tmp/ directory (handled by cleanup() method)
   */
  async build(options: BuildOptions, htmlContent: string): Promise<string> {
    const inputBasename = path.basename(options.input || process.cwd());
    const buildDir = path.join(process.cwd(), BUILD.TEMP_DIR, inputBasename);

    // Create build directory
    await mkdir(buildDir);
    debug(`Created build directory: ${buildDir}`);

    // Copy assets to build directory
    await this.copyAssets(buildDir, options.input || process.cwd(), options.debug || false);

    // Write HTML to build directory
    const tempHtml = path.join(buildDir, FILENAMES.OUTPUT_HTML);
    await writeFile(tempHtml, htmlContent);
    debug(`Wrote HTML to: ${tempHtml}`);

    // Generate PDF
    const outputPath = options.output || `${inputBasename}.pdf`;
    const absoluteOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(process.cwd(), outputPath);

    const result = await generatePDF(tempHtml, absoluteOutputPath, {
      timeout: options.timeout,
      debug: options.debug,
    });

    info(`PDF generated: ${result.outputPath}`);

    return result.outputPath;
  }

  /**
   * Copy assets from input directory to build directory
   *
   * Copies all files except:
   * - .md files
   * - manifest.yaml (unless debug mode)
   */
  private async copyAssets(buildDir: string, inputPath: string, debugMode: boolean): Promise<void> {
    const inputDir = await isDirectory(inputPath) ? inputPath : path.dirname(inputPath);

    // Read all entries in input directory
    const entries = await readDirectory(inputDir);

    for (const entry of entries) {
      const srcPath = path.join(inputDir, entry.name);
      const destPath = path.join(buildDir, entry.name);

      // Always skip markdown files
      if (entry.name.endsWith(EXTENSIONS.MARKDOWN)) {
        continue;
      }

      // Skip manifest.yaml only in non-debug mode
      if (entry.name === FILENAMES.MANIFEST && !debugMode) {
        continue;
      }

      if (entry.isDirectory()) {
        // Copy entire subdirectory
        await copyDir(srcPath, destPath, true);
        debug(`Copied directory: ${entry.name}`);
      } else if (entry.isFile()) {
        // Copy file
        await fs.copyFile(srcPath, destPath);
        debug(`Copied file: ${entry.name}`);
      }
    }
  }

  /**
   * Validate output path for PDF format
   *
   * PDF format requires file path, not directory
   */
  validateOutputPath(path: string, force: boolean): OutputValidation {
    return validateOutputPath('pdf' as OutputFormat, path, force);
  }

  /**
   * Clean up temporary files
   *
   * Removes .tmp/[basename]/ directory unless debug mode
   */
  async cleanup(options: BuildOptions): Promise<void> {
    if (!options.debug) {
      const inputBasename = path.basename(options.input || process.cwd());
      const buildDir = path.join(process.cwd(), BUILD.TEMP_DIR, inputBasename);
      await remove(buildDir);
      debug(`Cleaned up build directory: ${buildDir}`);
    } else {
      const inputBasename = path.basename(options.input || process.cwd());
      const buildDir = path.join(process.cwd(), BUILD.TEMP_DIR, inputBasename);
      info(`Debug mode: temporary files preserved at ${buildDir}`);
    }
  }
}
