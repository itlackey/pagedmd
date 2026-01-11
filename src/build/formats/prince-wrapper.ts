/**
 * Prince CLI Wrapper
 *
 * Provides PDF generation using Prince XML typesetter.
 * Prince is a commercial tool that must be installed separately.
 *
 * Installation:
 *   - Download from https://www.princexml.com/
 *   - Or use Docker: docker pull princexml/prince
 *
 * Features:
 *   - PDF/X profiles (PDF/X-1a, PDF/X-3, PDF/X-4)
 *   - ICC color profiles and color conversion
 *   - CMYK output for print production
 *   - Advanced CSS Paged Media support
 */

import { spawn } from 'child_process';
import { BuildError } from '../../utils/errors.ts';
import { debug, info } from '../../utils/logger.ts';

/**
 * PDF profile options for print production
 */
export type PdfProfile = 'PDF/X-1a' | 'PDF/X-3' | 'PDF/X-4' | 'PDF/A-1a' | 'PDF/A-1b' | 'PDF/A-3a' | 'PDF/A-3b';

/**
 * Prince PDF generation options
 */
export interface PrincePdfOptions {
  /**
   * Timeout in milliseconds (default: 60000)
   */
  timeout?: number;

  /**
   * Debug mode - preserve temp files and log extra info
   */
  debug?: boolean;

  /**
   * PDF profile for print production
   */
  pdfProfile?: PdfProfile;

  /**
   * Path to ICC output intent file
   * Required for PDF/X profiles
   */
  outputIntent?: string;

  /**
   * Convert colors to the output intent color space
   * Required for actual color conversion (not just embedding profile)
   */
  convertColors?: boolean;

  /**
   * PDF/X-4 compliant file attachment (for source files)
   */
  attachments?: string[];

  /**
   * Additional stylesheets to apply
   */
  stylesheets?: string[];

  /**
   * User stylesheets (applied with higher specificity)
   */
  userStylesheets?: string[];

  /**
   * JavaScript processing
   */
  javascript?: boolean;

  /**
   * Maximum PDF passes for pagination
   */
  maxPasses?: number;

  /**
   * Verbose output
   */
  verbose?: boolean;
}

/**
 * Prince PDF generation result
 */
export interface PrincePdfResult {
  /**
   * Absolute path to generated PDF
   */
  outputPath: string;

  /**
   * Generation duration in milliseconds
   */
  duration: number;

  /**
   * Page count (if available)
   */
  pageCount?: number;
}

/**
 * Check if Prince is installed and available in PATH
 */
export async function checkPrinceInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const checkProcess = spawn('prince', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    checkProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    checkProcess.on('close', (code) => {
      if (code === 0 && output.includes('Prince')) {
        debug(`Prince detected: ${output.trim().split('\n')[0]}`);
        resolve(true);
      } else {
        resolve(false);
      }
    });

    checkProcess.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get Prince version string
 */
export async function getPrinceVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const process = spawn('prince', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        const firstLine = output.trim().split('\n')[0];
        resolve(firstLine || null);
      } else {
        resolve(null);
      }
    });

    process.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Build Prince command arguments
 */
function buildPrinceArgs(
  inputPath: string,
  outputPath: string,
  options: PrincePdfOptions
): string[] {
  const args: string[] = [];

  // Input file
  args.push(inputPath);

  // Output file
  args.push('-o', outputPath);

  // PDF profile
  if (options.pdfProfile) {
    args.push('--pdf-profile', options.pdfProfile);
  }

  // Output intent (ICC profile)
  if (options.outputIntent) {
    args.push('--pdf-output-intent', options.outputIntent);
  }

  // Color conversion
  if (options.convertColors) {
    args.push('--convert-colors');
  }

  // Additional stylesheets
  if (options.stylesheets) {
    for (const stylesheet of options.stylesheets) {
      args.push('-s', stylesheet);
    }
  }

  // User stylesheets
  if (options.userStylesheets) {
    for (const stylesheet of options.userStylesheets) {
      args.push('--style', stylesheet);
    }
  }

  // JavaScript
  if (options.javascript) {
    args.push('--javascript');
  }

  // Max passes
  if (options.maxPasses) {
    args.push('--max-passes', String(options.maxPasses));
  }

  // Verbose
  if (options.verbose) {
    args.push('--verbose');
  }

  // File attachments
  if (options.attachments) {
    for (const attachment of options.attachments) {
      args.push('--attach', attachment);
    }
  }

  return args;
}

/**
 * Generate PDF using Prince
 *
 * @param inputPath - Path to HTML file
 * @param outputPath - Path for output PDF
 * @param options - Prince options
 * @returns PDF generation result
 */
export async function generatePdfWithPrince(
  inputPath: string,
  outputPath: string,
  options: PrincePdfOptions = {}
): Promise<PrincePdfResult> {
  // Check if Prince is installed
  const isInstalled = await checkPrinceInstalled();
  if (!isInstalled) {
    throw new BuildError(
      'Prince is not installed or not in PATH. ' +
      'Download from https://www.princexml.com/ or use Docker: docker pull princexml/prince'
    );
  }

  const startTime = Date.now();
  const timeout = options.timeout || 60000;

  const args = buildPrinceArgs(inputPath, outputPath, options);

  debug(`Running: prince ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const princeProcess = spawn('prince', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    princeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      if (options.debug) {
        console.log(data.toString());
      }
    });

    princeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      if (options.debug) {
        console.error(data.toString());
      }
    });

    // Timeout handling
    const timeoutId = setTimeout(() => {
      princeProcess.kill('SIGTERM');
      reject(new BuildError(`Prince PDF generation timed out after ${timeout}ms`));
    }, timeout);

    princeProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (code === 0) {
        info(`Prince PDF generated in ${duration}ms`);

        // Extract page count from output if available
        let pageCount: number | undefined;
        const pageMatch = stdout.match(/(\d+)\s+pages?/i);
        if (pageMatch?.[1]) {
          pageCount = parseInt(pageMatch[1], 10);
        }

        resolve({
          outputPath,
          duration,
          pageCount,
        });
      } else {
        reject(new BuildError(
          `Prince PDF generation failed with code ${code}: ${stderr || stdout}`
        ));
      }
    });

    princeProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(new BuildError(`Failed to run Prince: ${err.message}`));
    });
  });
}
