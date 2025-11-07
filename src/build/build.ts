/**
 * Simplified build orchestration for dc-book
 *
 * Orchestrates markdown→HTML→Output pipeline using format strategies
 * Supports multiple output formats: PDF, HTML, Preview
 */

import path from 'path';
import { generateHtmlFromMarkdown } from '../markdown/markdown.ts';
import { fileExists, writeFile } from '../utils/file-utils.ts';
import { info, error as logError, warn } from '../utils/logger.ts';
import { BuildError } from '../utils/errors.ts';
import { ConfigurationManager } from '../config/config-state.ts';
import { PdfFormatStrategy } from './formats/pdf-format.ts';
import { HtmlFormatStrategy } from './formats/html-format.ts';
import { PreviewFormatStrategy } from './formats/preview-format.ts';
import { validateInputExists } from './build-validator.ts';
import type { BuildOptions, PDFGenerationResult, FormatStrategy, OutputFormat } from '../types.ts';

/**
 * Get format strategy instance based on output format
 */
function getFormatStrategy(format: OutputFormat): FormatStrategy {
  switch (format) {
    case 'pdf' as OutputFormat:
      return new PdfFormatStrategy();
    case 'html' as OutputFormat:
      return new HtmlFormatStrategy();
    case 'preview' as OutputFormat:
      return new PreviewFormatStrategy();
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

/**
 * Build output from markdown file(s) using format-specific strategy
 *
 * Orchestrates the complete pipeline:
 * 0. Validate build options early (BEFORE any processing)
 * 1. Validate input path exists (defaults to cwd)
 * 2. Load manifest configuration
 * 3. Process markdown files to HTML
 * 4. Validate output path (unless --force)
 * 5. Execute format-specific build strategy (PDF/HTML/Preview)
 * 6. Clean up temporary files (format-dependent)
 *
 * @param options BuildOptions with input path, output path, format, etc.
 * @returns PDFGenerationResult with output path and duration
 * @throws BuildError if build fails
 */
export async function build(options: BuildOptions): Promise<PDFGenerationResult> {
  const startTime = Date.now();

  // STAGE 1: Resolve input path (defaults to cwd)
  options.input ??= process.cwd();

  // Default format to PDF if not specified
  options.format ??= 'pdf' as OutputFormat;

  if (options.verbose) {
    info('Build options:', JSON.stringify(options, null, 2));
  }

  // Simple validation: just check if input exists
  validateInputExists(options.input);

  const formatName = options.format.toString().toUpperCase();
  info(`Building ${formatName} from: ${options.input}`);

  // STAGE 2: Initialize Configuration Manager
  // This provides unified configuration with CLI > Manifest > Defaults precedence
  const configManager = new ConfigurationManager(options.input, options);
  await configManager.initialize(); // Load manifest asynchronously
  const config = configManager.getConfig();

  // STAGE 3: Process Markdown Files to HTML
  const html = await generateHtmlFromMarkdown(options.input, config);

  // Save HTML output if requested (debugging)
  if (options.htmlOutput) {
    await writeFile(options.htmlOutput, html);
    info(`HTML output saved to: ${options.htmlOutput}`);
  }

  // STAGE 4: Get format strategy
  const strategy = getFormatStrategy(options.format);

  // STAGE 5: Validate output path (unless --force)
  if (options.output) {
    const validation = strategy.validateOutputPath(options.output, options.force || false);
    if (!validation.isValid) {
      logError(validation.message);
      if (validation.suggestedFix) {
        logError(`Suggestion: ${validation.suggestedFix}`);
      }
      throw new Error('Output path validation failed');
    }
  }

  // STAGE 6: Execute format-specific build
  const outputPath = await strategy.build(options, html);

  // STAGE 7: Cleanup temporary files
  await strategy.cleanup(options);

  const totalDuration = Date.now() - startTime;
  info(`Build complete in ${totalDuration}ms → ${outputPath}`);

  return {
    outputPath,
    duration: totalDuration,
    success: true,
  };
}



