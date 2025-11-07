/**
 * PDF generation using pagedjs-cli via subprocess
 *
 * Uses subprocess spawn to work around Bun/pagedjs-cli ES module compatibility issues
 * Once Bun's module resolution is improved, this can be refactored to use direct import
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { BuildError } from '../../utils/errors.ts';
import { info, debug } from '../../utils/logger.ts';
import type { PDFGenerationResult } from '../../types.ts';

/**
 * Check if pagedjs-cli is installed and available
 * @throws BuildError if pagedjs-cli is not found
 */
async function checkPagedJsInstalled(): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const checkProcess = spawn('pagedjs-cli', ['--help'], { stdio: 'ignore' });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('pagedjs-cli not found'));
        }
      });

      checkProcess.on('error', reject);
    });
  } catch (error) {
    throw new BuildError(
      'pagedjs-cli is not installed or not in PATH. Run: bun install'
    );
  }
}

/**
 * Generate a PDF from an HTML file using PagedJS
 *
 * @param inputHtml - Absolute path to the input HTML file
 * @param outputPdf - Absolute path where the PDF should be written
 * @param options - Optional configuration
 * @param options.timeout - Timeout in milliseconds (default: TIMEOUTS.PDF_GENERATION)
 * @param options.debug - Enable debug output
 * @returns PDFGenerationResult with output path, duration, and success status
 * @throws BuildError if PDF generation fails
 */
export async function generatePDF(
  inputHtml: string,
  outputPdf: string,
  options?: {
    timeout?: number;
    debug?: boolean;
  }
): Promise<PDFGenerationResult> {
  const startTime = Date.now();

  // Ensure pagedjs-cli is available
  try {
    await checkPagedJsInstalled();
  } catch (error) {
    if (options?.debug) {
      debug('PATH:', process.env.PATH);
    }
    throw error;
  }

  info(`Generating PDF: ${outputPdf}`);

  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPdf);
  await fs.mkdir(outputDir, { recursive: true });

  // Run pagedjs-cli to generate PDF
  await new Promise<void>((resolve, reject) => {
    const args = [inputHtml, '-o', outputPdf];

    if (options?.timeout) {
      args.push('--timeout', options.timeout.toString());
    }

    const pagedProcess = spawn('pagedjs-cli', args, {
      stdio: options?.debug ? 'inherit' : 'pipe',
    });

    let errorOutput = '';

    if (!options?.debug && pagedProcess.stderr) {
      pagedProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    pagedProcess.on('close', (code) => {
      if (code === 0) {
        const duration = Date.now() - startTime;
        info(`PDF generated successfully in ${duration}ms: ${outputPdf}`);
        resolve();
      } else {
        const errorMessage = errorOutput
          ? `Process exited with code ${code}: ${errorOutput}`
          : `Process exited with code ${code}`;
        reject(new BuildError(errorMessage));
      }
    });

    pagedProcess.on('error', (err) => {
      reject(new BuildError(`Failed to spawn pagedjs-cli: ${err.message}`));
    });
  });

  const totalDuration = Date.now() - startTime;

  return {
    outputPath: outputPdf,
    duration: totalDuration,
    success: true,
  };
}
