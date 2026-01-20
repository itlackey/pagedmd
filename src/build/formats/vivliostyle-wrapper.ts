/**
 * Vivliostyle CLI Wrapper
 *
 * Provides PDF generation using Vivliostyle CLI.
 * Vivliostyle is bundled with pagedmd for zero-config PDF generation.
 *
 * Features:
 *   - Open-source CSS Paged Media implementation
 *   - PDF/X-1a output by default (press-ready)
 *   - Custom page sizes and crop marks
 *   - Browser-based rendering (Chromium)
 */

import { spawn } from "child_process";
import path from "path";
import { BuildError } from "../../utils/errors.ts";
import { debug, info } from "../../utils/logger.ts";

/**
 * Vivliostyle PDF generation options
 */
export interface VivliostylePdfOptions {
  /**
   * Timeout in seconds (default: 300)
   */
  timeout?: number;

  /**
   * Debug mode - preserve temp files and log extra info
   */
  debug?: boolean;

  /**
   * Page size (e.g., 'A4', 'letter', '6in,9in')
   */
  size?: string;

  /**
   * Enable crop marks for printing
   */
  cropMarks?: boolean;

  /**
   * Bleed area for crop marks (e.g., '3mm', '0.125in')
   */
  bleed?: string;

  /**
   * Crop offset distance (e.g., '13mm')
   */
  cropOffset?: string;

  /**
   * Additional CSS code to inject
   */
  css?: string;

  /**
   * Additional stylesheet paths
   */
  stylesheets?: string[];

  /**
   * User stylesheets (applied with higher specificity)
   */
  userStylesheets?: string[];

  /**
   * Make PDF press-ready (PDF/X-1a compatible)
   * Defaults to true for print-ready output
   * @default true
   */
  pressReady?: boolean;

  /**
   * Preflight mode for print preparation
   */
  preflight?: "press-ready" | "press-ready-local";

  /**
   * Preflight options (e.g., 'gray-scale', 'enforce-outline')
   */
  preflightOptions?: string[];

  /**
   * Theme package or path
   */
  themes?: string[];

  /**
   * Document title
   */
  title?: string;

  /**
   * Document author
   */
  author?: string;

  /**
   * Document language
   */
  language?: string;

  /**
   * Reading progression direction
   */
  readingProgression?: "ltr" | "rtl";

  /**
   * Verbose output
   */
  verbose?: boolean;

  /**
   * Path to executable browser (Chrome/Chromium)
   */
  executableBrowser?: string;
}

/**
 * Vivliostyle PDF generation result
 */
export interface VivliostylePdfResult {
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
 * Get the path to the bundled Vivliostyle CLI
 * Uses the locally installed package from node_modules
 */
function getVivliostyleBin(): string {
  // Source nvm and use newer Node version to support import assertions
  return "bash";
}

/**
 * Check if Vivliostyle CLI is available
 * Since it's bundled with pagedmd, this should always return true
 */
export async function checkVivliostyleInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const vivPath = path.join(
      process.cwd(),
      "node_modules",
      "@vivliostyle",
      "cli",
      "dist",
      "cli.js"
    );
    // Source nvm to use Node 22 which supports import assertions
    const checkProcess = spawn(
      "bash",
      ["-lc", `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null 2>&1 && node "${vivPath}" --version`],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let output = "";
    checkProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    checkProcess.on("close", (code) => {
      // Vivliostyle version output looks like "cli: 10.2.1\ncore: 2.39.1"
      if (code === 0 && (output.includes("cli:") || output.includes("vivliostyle"))) {
        debug(`Vivliostyle detected: ${output.trim().split("\n")[0]}`);
        resolve(true);
      } else {
        resolve(false);
      }
    });

    checkProcess.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Get Vivliostyle version string
 */
export async function getVivliostyleVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const vivPath = path.join(
      process.cwd(),
      "node_modules",
      "@vivliostyle",
      "cli",
      "dist",
      "cli.js"
    );
    const cmd = `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null 2>&1 && node "${vivPath}" --version`;
    const versionProcess = spawn("bash", ["-lc", cmd], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    versionProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    versionProcess.on("close", (code) => {
      if (code === 0) {
        // Parse "cli: 10.2.1\ncore: 2.39.1" format
        const cliMatch = output.match(/cli:\s*([\d.]+)/);
        if (cliMatch?.[1]) {
          resolve(`Vivliostyle CLI ${cliMatch[1]}`);
        } else {
          const firstLine = output.trim().split("\n")[0];
          resolve(firstLine || null);
        }
      } else {
        resolve(null);
      }
    });

    versionProcess.on("error", () => {
      resolve(null);
    });
  });
}

/**
 * Build Vivliostyle command arguments
 */
function buildVivliostyleArgs(
  inputPath: string,
  outputPath: string,
  options: VivliostylePdfOptions
): string[] {
  const args: string[] = ["build"];

  // Input file
  args.push(inputPath);

  // Output file
  args.push("-o", outputPath);

  // Page size
  if (options.size) {
    args.push("-s", options.size);
  }

  // Crop marks
  if (options.cropMarks) {
    args.push("--crop-marks");
  }

  // Bleed
  if (options.bleed) {
    args.push("--bleed", options.bleed);
  }

  // Crop offset
  if (options.cropOffset) {
    args.push("--crop-offset", options.cropOffset);
  }

  // Custom CSS
  if (options.css) {
    args.push("--css", options.css);
  }

  // Additional stylesheets
  if (options.stylesheets) {
    for (const stylesheet of options.stylesheets) {
      args.push("--style", stylesheet);
    }
  }

  // User stylesheets
  if (options.userStylesheets) {
    for (const stylesheet of options.userStylesheets) {
      args.push("--user-style", stylesheet);
    }
  }

  // Press-ready (PDF/X-1a) - enabled by default for print-ready output
  // Users can opt-out by explicitly setting pressReady: false
  if (options.pressReady !== false) {
    args.push("--press-ready");
  }

  // Preflight mode
  if (options.preflight) {
    args.push("--preflight", options.preflight);
  }

  // Preflight options
  if (options.preflightOptions) {
    for (const opt of options.preflightOptions) {
      args.push("--preflight-option", opt);
    }
  }

  // Themes
  if (options.themes) {
    for (const theme of options.themes) {
      args.push("-T", theme);
    }
  }

  // Title
  if (options.title) {
    args.push("--title", options.title);
  }

  // Author
  if (options.author) {
    args.push("--author", options.author);
  }

  // Language
  if (options.language) {
    args.push("-l", options.language);
  }

  // Reading progression
  if (options.readingProgression) {
    args.push("--reading-progression", options.readingProgression);
  }

  // Timeout (in seconds)
  if (options.timeout) {
    // Convert ms to seconds for vivliostyle
    const timeoutSeconds = Math.ceil(options.timeout / 1000);
    args.push("-t", String(timeoutSeconds));
  }

  // Executable browser path
  if (options.executableBrowser) {
    args.push("--executable-browser", options.executableBrowser);
  }

  return args;
}

/**
 * Generate PDF using Vivliostyle CLI
 *
 * @param inputPath - Path to HTML file
 * @param outputPath - Path for output PDF
 * @param options - Vivliostyle options
 * @returns PDF generation result
 */
export async function generatePdfWithVivliostyle(
  inputPath: string,
  outputPath: string,
  options: VivliostylePdfOptions = {}
): Promise<VivliostylePdfResult> {
  // Check if Vivliostyle is available
  const isInstalled = await checkVivliostyleInstalled();
  if (!isInstalled) {
    throw new BuildError(
      "Vivliostyle CLI is not available.\n\n" +
        "To fix this:\n" +
        "  1. Run: npm install  (or: bun install)\n" +
        "  2. Verify @vivliostyle/cli is in package.json\n" +
        "  3. Check installation: npm list @vivliostyle/cli\n\n" +
        "If the problem persists, try: npm install @vivliostyle/cli --save-dev"
    );
  }

  const startTime = Date.now();
  // Default timeout: 5 minutes (in ms), vivliostyle uses seconds
  const timeoutMs = options.timeout || 300000;

  const args = buildVivliostyleArgs(inputPath, outputPath, { ...options, timeout: timeoutMs });
  const vivPath = path.join(process.cwd(), "node_modules", "@vivliostyle", "cli", "dist", "cli.js");
  const cmd = `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null 2>&1 && node "${vivPath}" ${args.join(" ")}`;

  debug(`Running: ${cmd}`);

  return new Promise((resolve, reject) => {
    const vivliostyleProcess = spawn("bash", ["-lc", cmd], {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: path.dirname(inputPath),
    });

    let stdout = "";
    let stderr = "";

    vivliostyleProcess.stdout.on("data", (data) => {
      stdout += data.toString();
      if (options.debug || options.verbose) {
        console.log(data.toString());
      }
    });

    vivliostyleProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      if (options.debug || options.verbose) {
        console.error(data.toString());
      }
    });

    // Timeout handling (internal, in case vivliostyle's own timeout fails)
    const timeoutId = setTimeout(() => {
      vivliostyleProcess.kill("SIGTERM");
      reject(new BuildError(`Vivliostyle PDF generation timed out after ${timeoutMs}ms`));
    }, timeoutMs + 10000); // Give extra 10s buffer beyond vivliostyle's timeout

    vivliostyleProcess.on("close", (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (code === 0) {
        info(`Vivliostyle PDF generated in ${duration}ms`);

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
        reject(
          new BuildError(`Vivliostyle PDF generation failed with code ${code}: ${stderr || stdout}`)
        );
      }
    });

    vivliostyleProcess.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(new BuildError(`Failed to run Vivliostyle: ${err.message}`));
    });
  });
}
