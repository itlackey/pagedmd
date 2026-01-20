/**
 * PDF Engine Detection and Selection
 *
 * Provides a unified interface for PDF generation using multiple engines:
 * - Vivliostyle CLI (bundled, default)
 * - Prince XML (optional, if installed locally)
 * - DocRaptor API (optional, cloud-based Prince)
 *
 * Engine selection priority:
 * 1. Explicitly specified engine in config/CLI
 * 2. Auto-detection:
 *    a. Prince if available locally (highest quality)
 *    b. DocRaptor if API key configured
 *    c. Vivliostyle (always available as bundled fallback)
 */

import { spawn } from "child_process";
import {
  checkPrinceInstalled,
  getPrinceVersion,
  generatePdfWithPrince,
  type PrincePdfOptions,
  type PrincePdfResult,
} from "./prince-wrapper.ts";
import {
  checkVivliostyleInstalled,
  getVivliostyleVersion,
  generatePdfWithVivliostyle,
  type VivliostylePdfOptions,
  type VivliostylePdfResult,
} from "./vivliostyle-wrapper.ts";
import {
  isDocRaptorConfigured,
  generatePdfWithDocRaptor,
  type DocRaptorPdfOptions,
  type DocRaptorPdfResult,
} from "./docraptor-wrapper.ts";
import { BuildError } from "../../utils/errors.ts";
import { debug, info, warn } from "../../utils/logger.ts";

/**
 * Supported PDF engines
 */
export type PdfEngine = "auto" | "vivliostyle" | "prince" | "docraptor";

/**
 * PDF engine availability status
 */
export interface PdfEngineStatus {
  engine: PdfEngine;
  available: boolean;
  version?: string;
  reason?: string;
}

/**
 * Unified PDF engine options
 */
export interface PdfEngineOptions {
  /**
   * Which engine to use ('auto' for automatic selection)
   */
  engine?: PdfEngine;

  /**
   * Path to Prince binary (if not in PATH)
   */
  princePath?: string;

  /**
   * DocRaptor API key
   */
  docraptorApiKey?: string;

  /**
   * Use DocRaptor in test mode (watermarked, unlimited)
   */
  docraptorTestMode?: boolean;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Debug mode
   */
  debug?: boolean;

  /**
   * Verbose output
   */
  verbose?: boolean;

  /**
   * Page size (e.g., 'A4', 'letter', '6in 9in')
   */
  size?: string;

  /**
   * Enable crop marks
   */
  cropMarks?: boolean;

  /**
   * Bleed area (e.g., '3mm', '0.125in')
   */
  bleed?: string;

  /**
   * Make press-ready (PDF/X-1a compatible)
   * Defaults to true for print-ready output
   * @default true
   */
  pressReady?: boolean;

  /**
   * PDF profile (Prince/DocRaptor: 'PDF/X-1a', 'PDF/X-3', 'PDF/X-4')
   */
  pdfProfile?: string;

  /**
   * ICC output intent path (Prince)
   */
  outputIntent?: string;

  /**
   * Convert colors to output intent
   */
  convertColors?: boolean;

  /**
   * Additional stylesheets
   */
  stylesheets?: string[];

  /**
   * Enable JavaScript processing
   */
  javascript?: boolean;
}

/**
 * Unified PDF generation result
 */
export interface PdfEngineResult {
  /**
   * Path to generated PDF
   */
  outputPath: string;

  /**
   * Generation duration in milliseconds
   */
  duration: number;

  /**
   * Engine used for generation
   */
  engine: PdfEngine;

  /**
   * Page count (if available)
   */
  pageCount?: number;

  /**
   * Whether generated in test mode (DocRaptor)
   */
  testMode?: boolean;
}

/**
 * Check if Prince is installed at specified path or in PATH
 */
async function checkPrinceAtPath(princePath?: string): Promise<boolean> {
  if (!princePath) {
    return checkPrinceInstalled();
  }

  return new Promise((resolve) => {
    const checkProcess = spawn(princePath, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    checkProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    checkProcess.on("close", (code) => {
      resolve(code === 0 && output.includes("Prince"));
    });

    checkProcess.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Detect all available PDF engines
 */
export async function detectAvailableEngines(
  options: PdfEngineOptions = {}
): Promise<PdfEngineStatus[]> {
  const results: PdfEngineStatus[] = [];

  // Check Vivliostyle (bundled, should always work)
  const vivliostyleAvailable = await checkVivliostyleInstalled();
  const vivliostyleVersion = vivliostyleAvailable ? await getVivliostyleVersion() : undefined;
  results.push({
    engine: "vivliostyle",
    available: vivliostyleAvailable,
    version: vivliostyleVersion || undefined,
    reason: vivliostyleAvailable ? undefined : "Vivliostyle CLI not found. Try: bun install",
  });

  // Check Prince
  const princeAvailable = await checkPrinceAtPath(options.princePath);
  const princeVersion = princeAvailable ? await getPrinceVersion() : undefined;
  results.push({
    engine: "prince",
    available: princeAvailable,
    version: princeVersion || undefined,
    reason: princeAvailable
      ? undefined
      : "Prince not installed. Download from https://www.princexml.com/",
  });

  // Check DocRaptor
  const docraptorAvailable = isDocRaptorConfigured(options.docraptorApiKey);
  results.push({
    engine: "docraptor",
    available: docraptorAvailable,
    reason: docraptorAvailable
      ? undefined
      : "DocRaptor API key not configured. Set DOCRAPTOR_API_KEY environment variable.",
  });

  return results;
}

/**
 * Select the best available PDF engine
 *
 * Priority:
 * 1. If engine explicitly specified, use it (error if unavailable)
 * 2. Prince if available (highest quality, commercial features)
 * 3. DocRaptor if configured (Prince in the cloud)
 * 4. Vivliostyle (always available as fallback)
 */
export async function selectPdfEngine(options: PdfEngineOptions = {}): Promise<PdfEngine> {
  const requestedEngine = options.engine || "auto";

  // If specific engine requested, validate it's available
  if (requestedEngine !== "auto") {
    const engines = await detectAvailableEngines(options);
    const engineStatus = engines.find((e) => e.engine === requestedEngine);

    if (!engineStatus?.available) {
      throw new BuildError(
        `Requested PDF engine '${requestedEngine}' is not available: ${engineStatus?.reason || "Unknown reason"}`
      );
    }

    debug(`Using requested PDF engine: ${requestedEngine}`);
    return requestedEngine;
  }

  // Auto-detect best engine
  const engines = await detectAvailableEngines(options);

  // Priority 1: Prince (if available)
  const prince = engines.find((e) => e.engine === "prince");
  if (prince?.available) {
    info(`PDF engine: Prince (${prince.version || "version unknown"})`);
    return "prince";
  }

  // Priority 2: DocRaptor (if configured)
  const docraptor = engines.find((e) => e.engine === "docraptor");
  if (docraptor?.available) {
    info("PDF engine: DocRaptor (cloud-based Prince)");
    return "docraptor";
  }

  // Priority 3: Vivliostyle (bundled fallback)
  const vivliostyle = engines.find((e) => e.engine === "vivliostyle");
  if (vivliostyle?.available) {
    info(`PDF engine: Vivliostyle (${vivliostyle.version || "version unknown"})`);
    return "vivliostyle";
  }

  // Should never happen since Vivliostyle is bundled
  throw new BuildError("No PDF engine available. This is unexpected - please reinstall pagedmd.");
}

/**
 * Convert unified options to Prince-specific options
 */
function toPrinceOptions(options: PdfEngineOptions): PrincePdfOptions {
  return {
    timeout: options.timeout,
    debug: options.debug,
    verbose: options.verbose,
    pdfProfile: options.pdfProfile as PrincePdfOptions["pdfProfile"],
    outputIntent: options.outputIntent,
    convertColors: options.convertColors,
    stylesheets: options.stylesheets,
    javascript: options.javascript,
  };
}

/**
 * Convert unified options to Vivliostyle-specific options
 * Note: pressReady defaults to true for PDF/X-1a output
 */
function toVivliostyleOptions(options: PdfEngineOptions): VivliostylePdfOptions {
  return {
    timeout: options.timeout,
    debug: options.debug,
    verbose: options.verbose,
    size: options.size,
    cropMarks: options.cropMarks,
    bleed: options.bleed,
    // Default to true for PDF/X-1a output; user can opt-out with pressReady: false
    pressReady: options.pressReady ?? true,
    stylesheets: options.stylesheets,
  };
}

/**
 * Convert unified options to DocRaptor-specific options
 */
function toDocRaptorOptions(options: PdfEngineOptions): DocRaptorPdfOptions {
  return {
    apiKey: options.docraptorApiKey,
    test: options.docraptorTestMode,
    timeout: options.timeout,
    debug: options.debug,
    verbose: options.verbose,
    javascript: options.javascript,
    princeOptions: options.pdfProfile
      ? {
          profile: options.pdfProfile,
          convert_colors: options.convertColors,
        }
      : undefined,
  };
}

/**
 * Generate PDF using the selected engine
 *
 * @param inputPath - Path to HTML file (for Prince/Vivliostyle) or HTML content (for DocRaptor)
 * @param outputPath - Path for output PDF
 * @param options - PDF generation options
 * @param htmlContent - HTML content (required for DocRaptor, optional for local engines)
 * @returns PDF generation result
 */
export async function generatePdf(
  inputPath: string,
  outputPath: string,
  options: PdfEngineOptions = {},
  htmlContent?: string
): Promise<PdfEngineResult> {
  const engine = await selectPdfEngine(options);

  // Warn if PDF/X profile requested but using Vivliostyle (which doesn't support it)
  if (engine === "vivliostyle" && options.pdfProfile?.toLowerCase().includes("pdf/x")) {
    warn(
      "PDF/X profile requested but Vivliostyle does not support native PDF/X output. " +
        "The generated PDF will be standard PDF. For PDF/X-1a compliance, use Prince engine or post-process with Ghostscript."
    );
  }

  switch (engine) {
    case "prince": {
      const result = await generatePdfWithPrince(inputPath, outputPath, toPrinceOptions(options));
      return {
        outputPath: result.outputPath,
        duration: result.duration,
        engine: "prince",
        pageCount: result.pageCount,
      };
    }

    case "vivliostyle": {
      const result = await generatePdfWithVivliostyle(
        inputPath,
        outputPath,
        toVivliostyleOptions(options)
      );
      return {
        outputPath: result.outputPath,
        duration: result.duration,
        engine: "vivliostyle",
        pageCount: result.pageCount,
      };
    }

    case "docraptor": {
      if (!htmlContent) {
        // Read HTML content from file for DocRaptor
        const fs = await import("fs/promises");
        htmlContent = await fs.readFile(inputPath, "utf-8");
      }
      const result = await generatePdfWithDocRaptor(
        htmlContent,
        outputPath,
        toDocRaptorOptions(options)
      );
      return {
        outputPath: result.outputPath,
        duration: result.duration,
        engine: "docraptor",
        testMode: result.testMode,
      };
    }

    default:
      throw new BuildError(`Unknown PDF engine: ${engine}`);
  }
}

/**
 * Get information about available PDF engines (for CLI help/status)
 */
export async function getEngineInfo(options: PdfEngineOptions = {}): Promise<string> {
  const engines = await detectAvailableEngines(options);
  const lines: string[] = ["Available PDF engines:"];

  for (const engine of engines) {
    const status = engine.available ? "✓" : "✗";
    const version = engine.version ? ` (${engine.version})` : "";
    const reason = engine.available ? "" : ` - ${engine.reason}`;
    lines.push(`  ${status} ${engine.engine}${version}${reason}`);
  }

  // Add note about default
  const selected = await selectPdfEngine(options).catch(() => "vivliostyle");
  lines.push("");
  lines.push(`Default: ${selected}`);

  return lines.join("\n");
}
