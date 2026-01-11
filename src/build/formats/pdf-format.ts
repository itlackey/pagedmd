/**
 * PDF Format Strategy
 *
 * Generates print-ready PDF output using multiple engine options:
 * - Vivliostyle CLI (bundled, default)
 * - Prince XML (optional, highest quality)
 * - DocRaptor API (optional, cloud-based Prince)
 *
 * Features:
 * - Automatic engine detection and selection
 * - PDF/X profiles for print production
 * - ICC color profiles and color conversion
 * - Crop marks and bleed support
 *
 * Usage:
 *   pagedmd build --format pdf
 *   pagedmd build --format pdf --pdf-engine prince
 *   pagedmd build --format pdf --pdf-engine vivliostyle
 */

import path from 'path';
import { promises as fs } from 'fs';
import { generatePdf, type PdfEngineOptions, type PdfEngine } from './pdf-engine.ts';
import { writeFile, mkdir, remove, isDirectory, readDirectory, copyDirectory as copyDir } from '../../utils/file-utils.ts';
import { info, debug } from '../../utils/logger.ts';
import { validateOutputPath } from '../../utils/path-validation.ts';
import { BUILD, FILENAMES, EXTENSIONS } from '../../constants.ts';
import type { FormatStrategy, BuildOptions, OutputValidation, OutputFormat, PdfEngineType, PdfConfig } from '../../types.ts';

/**
 * Extended build options for PDF generation
 */
export interface PdfBuildOptions extends BuildOptions {
  /**
   * PDF profile for print production (Prince/DocRaptor)
   */
  pdfProfile?: string;

  /**
   * Path to ICC output intent file
   */
  outputIntent?: string;

  /**
   * Convert colors to output intent color space
   */
  convertColors?: boolean;

  /**
   * Enable press-ready output (Vivliostyle)
   */
  pressReady?: boolean;

  /**
   * Enable crop marks
   */
  cropMarks?: boolean;

  /**
   * Bleed area for crop marks
   */
  bleed?: string;

  /**
   * PDF configuration from manifest
   */
  pdfConfig?: PdfConfig;
}

/**
 * PDF Format Strategy
 *
 * Generates PDF using the best available engine.
 */
export class PdfFormatStrategy implements FormatStrategy {
  private options: Partial<PdfEngineOptions>;

  constructor(options: Partial<PdfEngineOptions> = {}) {
    this.options = options;
  }

  /**
   * Build PDF output using the selected engine
   *
   * Process:
   * 1. Create .tmp/[basename]/ directory
   * 2. Copy assets to build directory
   * 3. Write HTML to .tmp/[basename]/index.html
   * 4. Run PDF engine to generate PDF
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

    // Build engine options from build options and manifest config
    const engineOptions = this.buildEngineOptions(options);

    const result = await generatePdf(tempHtml, absoluteOutputPath, engineOptions, htmlContent);

    info(`PDF generated: ${result.outputPath} (engine: ${result.engine})`);
    if (result.pageCount) {
      info(`  Page count: ${result.pageCount}`);
    }
    if (result.testMode) {
      info(`  Note: Generated in test mode (watermarked)`);
    }

    return result.outputPath;
  }

  /**
   * Build PDF engine options from build options and manifest config
   */
  private buildEngineOptions(options: BuildOptions): PdfEngineOptions {
    const extendedOptions = options as PdfBuildOptions;
    const pdfConfig = extendedOptions.pdfConfig;

    // Start with strategy defaults
    const engineOptions: PdfEngineOptions = {
      ...this.options,
      timeout: options.timeout,
      debug: options.debug,
      verbose: options.verbose,
    };

    // Apply CLI options (highest priority)
    if (options.pdfEngine) {
      engineOptions.engine = options.pdfEngine as PdfEngine;
    } else if (pdfConfig?.engine) {
      engineOptions.engine = pdfConfig.engine as PdfEngine;
    }

    if (options.princePath) {
      engineOptions.princePath = options.princePath;
    } else if (pdfConfig?.princePath) {
      engineOptions.princePath = pdfConfig.princePath;
    }

    if (options.docraptorApiKey) {
      engineOptions.docraptorApiKey = options.docraptorApiKey;
    } else if (pdfConfig?.docraptor?.apiKey) {
      engineOptions.docraptorApiKey = pdfConfig.docraptor.apiKey;
    }

    if (options.docraptorTestMode !== undefined) {
      engineOptions.docraptorTestMode = options.docraptorTestMode;
    } else if (pdfConfig?.docraptor?.testMode !== undefined) {
      engineOptions.docraptorTestMode = pdfConfig.docraptor.testMode;
    }

    // Apply PDF-specific options from extended options
    if (extendedOptions.pdfProfile) {
      engineOptions.pdfProfile = extendedOptions.pdfProfile;
    } else if (pdfConfig?.profile) {
      engineOptions.pdfProfile = pdfConfig.profile;
    }

    if (extendedOptions.outputIntent) {
      engineOptions.outputIntent = extendedOptions.outputIntent;
    } else if (pdfConfig?.outputIntent) {
      engineOptions.outputIntent = pdfConfig.outputIntent;
    }

    if (extendedOptions.convertColors !== undefined) {
      engineOptions.convertColors = extendedOptions.convertColors;
    } else if (pdfConfig?.convertColors !== undefined) {
      engineOptions.convertColors = pdfConfig.convertColors;
    }

    if (extendedOptions.pressReady !== undefined) {
      engineOptions.pressReady = extendedOptions.pressReady;
    } else if (pdfConfig?.pressReady !== undefined) {
      engineOptions.pressReady = pdfConfig.pressReady;
    }

    if (extendedOptions.cropMarks !== undefined) {
      engineOptions.cropMarks = extendedOptions.cropMarks;
    } else if (pdfConfig?.cropMarks !== undefined) {
      engineOptions.cropMarks = pdfConfig.cropMarks;
    }

    if (extendedOptions.bleed) {
      engineOptions.bleed = extendedOptions.bleed;
    } else if (pdfConfig?.bleed) {
      engineOptions.bleed = pdfConfig.bleed;
    }

    return engineOptions;
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

/**
 * Factory function to create PDF strategy with options
 */
export function createPdfStrategy(options?: Partial<PdfEngineOptions>): PdfFormatStrategy {
  return new PdfFormatStrategy(options);
}
