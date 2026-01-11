/**
 * DocRaptor API Wrapper
 *
 * Provides PDF generation using DocRaptor's Prince XML API service.
 * DocRaptor is a cloud-based HTML-to-PDF service powered by Prince XML.
 *
 * Features:
 *   - No local Prince installation required
 *   - Access to latest Prince features
 *   - PDF/X profiles supported
 *   - Test mode for unlimited free testing
 *
 * Usage:
 *   Set DOCRAPTOR_API_KEY environment variable or provide via manifest.yaml
 *
 * @see https://docraptor.com/documentation/api
 */

import { promises as fs } from 'fs';
import { BuildError } from '../../utils/errors.ts';
import { debug, info, warn } from '../../utils/logger.ts';

/**
 * DocRaptor API endpoint
 */
const DOCRAPTOR_API_URL = 'https://api.docraptor.com/docs';

/**
 * Prince options that can be passed to DocRaptor
 */
export interface DocRaptorPrinceOptions {
  /**
   * PDF profile for print production
   */
  profile?: string;

  /**
   * Media type for @media rules (screen, print)
   */
  media?: 'screen' | 'print';

  /**
   * Base URL for resolving relative URLs
   */
  baseurl?: string;

  /**
   * Enable JavaScript processing in Prince
   */
  javascript?: boolean;

  /**
   * ICC color profile URL
   */
  input_profile?: string;

  /**
   * Convert colors to output profile
   */
  convert_colors?: boolean;
}

/**
 * DocRaptor PDF generation options
 */
export interface DocRaptorPdfOptions {
  /**
   * DocRaptor API key (defaults to DOCRAPTOR_API_KEY env var)
   */
  apiKey?: string;

  /**
   * Test mode - creates watermarked PDFs that don't count against quota
   */
  test?: boolean;

  /**
   * Debug mode
   */
  debug?: boolean;

  /**
   * Document name (for DocRaptor dashboard)
   */
  name?: string;

  /**
   * Enable JavaScript processing
   */
  javascript?: boolean;

  /**
   * Referrer URL (required for some assets like Typekit)
   */
  referrer?: string;

  /**
   * Use asynchronous processing for large documents
   */
  async?: boolean;

  /**
   * Pipeline version to use (e.g., '10.1')
   */
  pipeline?: string;

  /**
   * Prince-specific options
   */
  princeOptions?: DocRaptorPrinceOptions;

  /**
   * Timeout in milliseconds (not a DocRaptor param, for local timeout)
   */
  timeout?: number;

  /**
   * Verbose output
   */
  verbose?: boolean;
}

/**
 * DocRaptor PDF generation result
 */
export interface DocRaptorPdfResult {
  /**
   * Absolute path to generated PDF
   */
  outputPath: string;

  /**
   * Generation duration in milliseconds
   */
  duration: number;

  /**
   * Whether the PDF was generated in test mode
   */
  testMode: boolean;
}

/**
 * Get DocRaptor API key from options or environment
 */
function getApiKey(options: DocRaptorPdfOptions): string | null {
  return options.apiKey || process.env.DOCRAPTOR_API_KEY || null;
}

/**
 * Check if DocRaptor API is configured
 */
export function isDocRaptorConfigured(apiKey?: string): boolean {
  return !!(apiKey || process.env.DOCRAPTOR_API_KEY);
}

/**
 * Build DocRaptor API request body
 */
function buildRequestBody(
  htmlContent: string,
  options: DocRaptorPdfOptions
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: 'pdf',
    document_content: htmlContent,
  };

  // Test mode
  if (options.test !== false) {
    // Default to test mode if not explicitly set to false
    body.test = options.test ?? true;
  }

  // Document name
  if (options.name) {
    body.name = options.name;
  }

  // JavaScript
  if (options.javascript) {
    body.javascript = true;
  }

  // Referrer
  if (options.referrer) {
    body.referrer = options.referrer;
  }

  // Async processing
  if (options.async) {
    body.async = true;
  }

  // Pipeline version
  if (options.pipeline) {
    body.pipeline = options.pipeline;
  }

  // Prince options
  if (options.princeOptions) {
    body.prince_options = options.princeOptions;
  }

  return body;
}

/**
 * Generate PDF using DocRaptor API
 *
 * @param htmlContent - HTML content to convert
 * @param outputPath - Path for output PDF
 * @param options - DocRaptor options
 * @returns PDF generation result
 */
export async function generatePdfWithDocRaptor(
  htmlContent: string,
  outputPath: string,
  options: DocRaptorPdfOptions = {}
): Promise<DocRaptorPdfResult> {
  const apiKey = getApiKey(options);

  if (!apiKey) {
    throw new BuildError(
      'DocRaptor API key not configured. ' +
      'Set DOCRAPTOR_API_KEY environment variable or provide apiKey in manifest.yaml pdf.docraptor options.'
    );
  }

  const startTime = Date.now();
  const timeout = options.timeout || 120000; // 2 minute default for API call

  // Build request body
  const requestBody = buildRequestBody(htmlContent, options);

  if (options.debug || options.verbose) {
    debug(`DocRaptor request: ${JSON.stringify({ ...requestBody, document_content: '[HTML content]' }, null, 2)}`);
  }

  // Make API request with Basic Auth
  const authString = Buffer.from(`${apiKey}:`).toString('base64');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(DOCRAPTOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `DocRaptor API error (${response.status})`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors) {
          errorMessage += `: ${errorJson.errors.join(', ')}`;
        } else if (errorJson.message) {
          errorMessage += `: ${errorJson.message}`;
        }
      } catch {
        if (errorText) {
          errorMessage += `: ${errorText}`;
        }
      }

      // Provide helpful hints for common errors
      if (response.status === 401) {
        errorMessage += '\nHint: Check that your DOCRAPTOR_API_KEY is correct.';
      } else if (response.status === 402) {
        errorMessage += '\nHint: Your DocRaptor account may have exceeded its quota. Try test mode.';
      } else if (response.status === 422) {
        errorMessage += '\nHint: The HTML content may have validation errors.';
      }

      throw new BuildError(errorMessage);
    }

    // Get PDF binary data
    const pdfBuffer = await response.arrayBuffer();

    // Write to file
    await fs.writeFile(outputPath, Buffer.from(pdfBuffer));

    const duration = Date.now() - startTime;
    const testMode = requestBody.test === true;

    if (testMode) {
      warn('DocRaptor: PDF generated in TEST MODE (watermarked). Set test: false for production.');
    }

    info(`DocRaptor PDF generated in ${duration}ms${testMode ? ' (test mode)' : ''}`);

    return {
      outputPath,
      duration,
      testMode,
    };
  } catch (error) {
    if (error instanceof BuildError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new BuildError(`DocRaptor API request timed out after ${timeout}ms`);
      }
      throw new BuildError(`DocRaptor API request failed: ${error.message}`);
    }

    throw new BuildError('DocRaptor API request failed with unknown error');
  }
}
