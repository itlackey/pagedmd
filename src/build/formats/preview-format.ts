/**
 * Preview Format Strategy
 *
 * Generates HTML directory structure with Paged.js polyfill injected
 * Enables offline paginated viewing without running preview server
 */

import path from 'path';
import { writeFile, mkdir } from '../../utils/file-utils.ts';
import { info } from '../../utils/logger.ts';
import { validateOutputPath } from '../../utils/path-validation.ts';
import { injectPagedJsPolyfill } from '../../html/preview-wrapper.ts';
import { AssetCopier } from '../asset-copier.ts';
import type { FormatStrategy, BuildOptions, OutputValidation, OutputFormat } from '../../types.ts';

export class PreviewFormatStrategy implements FormatStrategy {
  /**
   * Build Preview output
   *
   * Process:
   * 1. Inject Paged.js polyfill into HTML
   * 2. Create output directory
   * 3. Write index.html with polyfill
   * 4. Copy assets to output directory
   */
  async build(options: BuildOptions, htmlContent: string): Promise<string> {
    // Inject Paged.js polyfill
    const htmlWithPolyfill = injectPagedJsPolyfill(htmlContent);

    const inputBasename = path.basename(options.input || process.cwd());
    const outputPath = options.output || path.join(process.cwd(), `${inputBasename}-preview`);

    // Ensure output path is absolute
    const absoluteOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(process.cwd(), outputPath);

    // Create output directory
    await mkdir(absoluteOutputPath);

    // Write preview.html with polyfill
    const previewFilePath = path.join(absoluteOutputPath, "preview.html");
    await writeFile(previewFilePath, htmlWithPolyfill);
    info(`Preview HTML written to: ${previewFilePath}`);

    // Copy assets from input directory to output directory
    const assetCopier = new AssetCopier({
      sourceDir: options.input || process.cwd(),
      destDir: absoluteOutputPath,
      includeHidden: false, // Exclude hidden files (.tmp, .git, etc.)
      verbose: options.verbose,
    });
    await assetCopier.copyAssets();

    return absoluteOutputPath;
  }

  /**
   * Validate output path for Preview format
   *
   * Preview format requires directory path, not file (same as HTML)
   */
  validateOutputPath(path: string, force: boolean): OutputValidation {
    return validateOutputPath('preview' as OutputFormat, path, force);
  }

  /**
   * Clean up temporary files
   *
   * Preview format has no temporary files - output is final
   */
  async cleanup(options: BuildOptions): Promise<void> {
    // No cleanup needed for Preview format
  }
}
