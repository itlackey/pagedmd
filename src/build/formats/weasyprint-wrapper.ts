/**
 * WeasyPrint CLI Wrapper
 *
 * PDF generation using WeasyPrint - a Python HTML/CSS to PDF converter.
 * Requires WeasyPrint v68.0 or higher installed via pip.
 *
 * Installation: pip install 'weasyprint>=68.0'
 *
 * Features:
 *   - Open-source CSS Paged Media implementation
 *   - DriveThru RPG compatible PDF output
 *   - PDF/A variant support for archival
 *   - Image and font optimization
 */

import { spawn } from "child_process";
import { BuildError } from "../../utils/errors.ts";
import { debug, info, warn } from "../../utils/logger.ts";

/**
 * WeasyPrint PDF generation options
 */
export interface WeasyPrintPdfOptions {
  /**
   * Timeout in milliseconds (default: 120000)
   */
  timeout?: number;

  /**
   * Debug mode - extra logging
   */
  debug?: boolean;

  /**
   * Verbose output
   */
  verbose?: boolean;

  /**
   * Additional CSS stylesheets to apply
   */
  stylesheets?: string[];

  /**
   * Base URL for resolving relative URLs in the HTML
   */
  baseUrl?: string;

  /**
   * PDF variant: pdf/a-1b, pdf/a-2b, pdf/a-3b, pdf/ua-1
   */
  pdfVariant?: "pdf/a-1b" | "pdf/a-2b" | "pdf/a-3b" | "pdf/ua-1";

  /**
   * Optimize file size: images, fonts, all, none
   */
  optimizeSize?: "images" | "fonts" | "all" | "none";

  /**
   * Custom path to weasyprint executable
   */
  weasyPrintPath?: string;
}

/**
 * WeasyPrint PDF generation result
 */
export interface WeasyPrintPdfResult {
  /**
   * Absolute path to generated PDF
   */
  outputPath: string;

  /**
   * Generation duration in milliseconds
   */
  duration: number;

  /**
   * Page count (if available from output)
   */
  pageCount?: number;
}

/**
 * Minimum required WeasyPrint version
 */
const MIN_VERSION = "68.0";

/**
 * Check if WeasyPrint is installed with required version
 *
 * @param weasyPrintPath - Optional custom path to weasyprint executable
 * @returns true if WeasyPrint v68.0+ is available
 */
export async function checkWeasyPrintInstalled(
  weasyPrintPath?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = weasyPrintPath || "weasyprint";
    const proc = spawn(cmd, ["--version"], { stdio: ["ignore", "pipe", "pipe"] });

    let output = "";
    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (output += data.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve(false);
        return;
      }

      // Check version >= 68.0
      // WeasyPrint version output: "WeasyPrint version 68.0"
      const match = output.match(/(\d+)\.(\d+)/);
      if (match && match[1] && match[2]) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        const meetsVersion = major > 68 || (major === 68 && minor >= 0);
        if (!meetsVersion) {
          debug(`WeasyPrint version ${major}.${minor} is below minimum ${MIN_VERSION}`);
        }
        resolve(meetsVersion);
      } else {
        debug("Could not parse WeasyPrint version from output");
        resolve(false);
      }
    });

    proc.on("error", () => resolve(false));
  });
}

/**
 * Get WeasyPrint version string
 *
 * @param weasyPrintPath - Optional custom path to weasyprint executable
 * @returns Version string like "WeasyPrint 68.0" or null if not available
 */
export async function getWeasyPrintVersion(
  weasyPrintPath?: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const cmd = weasyPrintPath || "weasyprint";
    const proc = spawn(cmd, ["--version"], { stdio: ["ignore", "pipe", "pipe"] });

    let output = "";
    proc.stdout.on("data", (data) => (output += data.toString()));

    proc.on("close", (code) => {
      if (code === 0) {
        const match = output.match(/(\d+\.\d+(?:\.\d+)?)/);
        resolve(match ? `WeasyPrint ${match[1]}` : null);
      } else {
        resolve(null);
      }
    });

    proc.on("error", () => resolve(null));
  });
}

/**
 * Build WeasyPrint command arguments
 */
function buildWeasyPrintArgs(
  inputPath: string,
  outputPath: string,
  options: WeasyPrintPdfOptions
): string[] {
  const args: string[] = [inputPath, outputPath];

  // Additional stylesheets
  if (options.stylesheets) {
    for (const css of options.stylesheets) {
      args.push("-s", css);
    }
  }

  // Base URL for relative paths
  if (options.baseUrl) {
    args.push("--base-url", options.baseUrl);
  }

  // PDF variant (PDF/A)
  if (options.pdfVariant) {
    args.push("--pdf-variant", options.pdfVariant);
  }

  // Size optimization
  if (options.optimizeSize) {
    args.push("--optimize-size", options.optimizeSize);
  }

  // Debug or verbose mode
  if (options.debug) {
    args.push("-d");
  } else if (options.verbose) {
    args.push("-v");
  }

  return args;
}

/**
 * Generate PDF using WeasyPrint
 *
 * @param inputPath - Path to HTML file
 * @param outputPath - Path for output PDF
 * @param options - WeasyPrint options
 * @returns PDF generation result
 */
export async function generatePdfWithWeasyPrint(
  inputPath: string,
  outputPath: string,
  options: WeasyPrintPdfOptions = {}
): Promise<WeasyPrintPdfResult> {
  const isInstalled = await checkWeasyPrintInstalled(options.weasyPrintPath);

  if (!isInstalled) {
    throw new BuildError(
      `WeasyPrint v${MIN_VERSION}+ is not installed.\n\n` +
        "Install with:\n" +
        `  pip install 'weasyprint>=${MIN_VERSION}'\n\n` +
        "See: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html"
    );
  }

  const startTime = Date.now();
  const timeout = options.timeout || 120000;

  const args = buildWeasyPrintArgs(inputPath, outputPath, options);
  const cmd = options.weasyPrintPath || "weasyprint";

  debug(`Running: ${cmd} ${args.join(" ")}`);

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
      if (options.debug || options.verbose) {
        console.log(data.toString());
      }
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
      if (options.debug || options.verbose) {
        console.error(data.toString());
      }
    });

    const timeoutId = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new BuildError(`WeasyPrint timed out after ${timeout}ms`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (code === 0) {
        info(`WeasyPrint PDF generated in ${duration}ms`);

        // Try to extract page count from output
        let pageCount: number | undefined;
        const pageMatch = stdout.match(/(\d+)\s+pages?/i) || stderr.match(/(\d+)\s+pages?/i);
        if (pageMatch?.[1]) {
          pageCount = parseInt(pageMatch[1], 10);
        }

        resolve({
          outputPath,
          duration,
          pageCount,
        });
      } else {
        reject(new BuildError(`WeasyPrint failed (code ${code}):\n${stderr || stdout}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(new BuildError(`Failed to run WeasyPrint: ${err.message}`));
    });
  });
}
