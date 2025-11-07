/**
 * HTML Format Strategy
 *
 * Generates HTML directory structure directly to output location
 * No intermediate .tmp/ directory needed
 */

import path from 'path';
import { writeFile, mkdir } from '../../utils/file-utils.ts';
import { info } from '../../utils/logger.ts';
import { validateOutputPath } from '../../utils/path-validation.ts';
import { AssetCopier } from '../asset-copier.ts';
import { FILENAMES } from '../../constants.ts';
import type { FormatStrategy, BuildOptions, OutputValidation, OutputFormat } from '../../types.ts';

export class HtmlFormatStrategy implements FormatStrategy {
  /**
   * Build HTML output
   *
   * Process:
   * 1. Create output directory
   * 2. Write index.html
   * 3. Copy assets to output directory
   */
  async build(options: BuildOptions, htmlContent: string): Promise<string> {
    const inputBasename = path.basename(options.input || process.cwd());
    const outputPath = options.output || path.join(process.cwd(), `${inputBasename}-html`);

    // Ensure output path is absolute
    const absoluteOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(process.cwd(), outputPath);

    // Create output directory
    await mkdir(absoluteOutputPath);

    // Write index.html
    const indexPath = path.join(absoluteOutputPath, FILENAMES.OUTPUT_HTML);
    await writeFile(indexPath, htmlContent);
    info(`HTML written to: ${indexPath}`);

    // Copy assets from input directory to output directory
    const assetCopier = new AssetCopier({
      sourceDir: options.input || process.cwd(),
      destDir: absoluteOutputPath,
      verbose: options.verbose,
    });
    await assetCopier.copyAssets();

    return absoluteOutputPath;
  }

  /**
   * Validate output path for HTML format
   *
   * HTML format requires directory path, not file
   */
  validateOutputPath(path: string, force: boolean): OutputValidation {
    return validateOutputPath('html' as OutputFormat, path, force);
  }

  /**
   * Clean up temporary files
   *
   * HTML format has no temporary files - output is final
   */
  async cleanup(options: BuildOptions): Promise<void> {
    // No cleanup needed for HTML format
  }
}
