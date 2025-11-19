/**
 * Simplified configuration parsing and validation
 *
 * Transforms CLI arguments into Config and BuildOptions objects
 * as defined in types.ts
 */

import path, { join } from 'path';
import YAML from 'js-yaml';
import { Config, BuildOptions, Manifest } from '../types.ts';
import { fileExists, isDirectory } from './file-utils.ts';
import { debug as logDebug, info } from './logger.ts';
import { DEFAULTS, FILENAMES, EXTENSIONS } from '../constants.ts';
import { ManifestSchema, formatManifestErrors } from '../schemas/manifest.schema.ts';

/**
 * Create a Config object from CLI options
 */
export function createConfig(options: {
  verbose?: boolean;
  debug?: boolean;
  timeout?: number;
}): Config {
  return {
    verbose: options.verbose ?? DEFAULTS.VERBOSE,
    debug: options.debug ?? DEFAULTS.DEBUG,
    timeout: options.timeout ?? DEFAULTS.TIMEOUT,
  };
}

/**
 * Create BuildOptions from CLI arguments
 */
export function createBuildOptions(
  input: string | undefined,
  options: {
    output?: string;
    htmlOutput?: string;
    timeout?: number;
    verbose?: boolean;
    debug?: boolean;
  }
): BuildOptions {
  return {
    input: input ? resolvePath(input) : undefined,
    output: options.output ? resolvePath(options.output) : undefined,
    htmlOutput: options.htmlOutput ? resolvePath(options.htmlOutput) : undefined,
    timeout: options.timeout ?? DEFAULTS.TIMEOUT,
    verbose: options.verbose ?? DEFAULTS.VERBOSE,
    debug: options.debug ?? DEFAULTS.DEBUG,
  };
}

/**
 * Validate manifest structure and types using Zod schema
 *
 * @param manifest - Raw manifest data parsed from YAML
 * @param manifestPath - Path to manifest file (for error messages)
 * @returns Validated manifest data
 * @throws Error with clear message if validation fails
 */
export function validateManifest(manifest: unknown, manifestPath: string): Manifest {
  // Use Zod schema for runtime validation
  const result = ManifestSchema.safeParse(manifest);

  if (!result.success) {
    // Format Zod errors into user-friendly message
    const errorMessage = formatManifestErrors(result.error);
    throw new Error(`${errorMessage}\n\nManifest location: ${manifestPath}`);
  }

  return result.data;
}


/**
 * Ensure manifest.yaml exists, creating with defaults if missing
 *
 * Creates a minimal manifest with default extensions and styles if no manifest exists.
 *
 * @param inputPath - Input markdown file or directory path
 * @returns Absolute path to manifest.yaml (existing or newly created)
 */
export async function ensureManifest(inputPath: string): Promise<string> {
  const inputDir = (await isDirectory(inputPath)) ? inputPath : path.dirname(inputPath);
  const manifestPath = path.join(inputDir, FILENAMES.MANIFEST);

  if (!(await fileExists(manifestPath))) {
    // Detect project type from folder name
    const folderName = path.basename(inputDir).toLowerCase();
    const isDimmCity = folderName.includes('dimm') ||
                       folderName.includes('dc-') ||
                       folderName.includes('dimmcity');

    const initial: Manifest = isDimmCity
      ? {
          extensions: ['dimm-city'],
          styles: ['themes/dimm-city.css', 'plugins/dimm-city-components.css']
        }
      : {
          extensions: ['ttrpg'],
          styles: ['themes/classic.css']
        };

    const yamlOptions = { indent: 2, lineWidth: 80, noRefs: true };
    await Bun.write(manifestPath, YAML.dump(initial, yamlOptions));
    info(`Created manifest.yaml in ${inputDir} (${isDimmCity ? 'Dimm City' : 'generic TTRPG'} defaults)`);
  }

  return manifestPath;
}

/**
 * Load manifest from YAML file using Bun's native YAML support
 * Looks for manifest.yaml in input directory
 *
 * @param inputPath - Input markdown file or directory path (defaults to cwd)
 * @returns Parsed manifest or null if no manifest found
 * @throws Error if manifest exists but is invalid YAML or has invalid structure
 */
export async function loadManifest(inputPath: string = process.cwd()): Promise<Manifest | null> {
  // Determine input directory
  const inputDir = await isDirectory(inputPath)
    ? inputPath
    : path.dirname(inputPath);

  const manifestPath = path.join(inputDir, FILENAMES.MANIFEST);

  // Check if manifest exists
  if (!(await fileExists(manifestPath))) {
    logDebug('No manifest.yaml found, using defaults');
    return null;
  }

  try {
    // Bun can directly import YAML files
    // Add cache-busting timestamp to ensure fresh imports in tests
    const manifest = await import(`${manifestPath}?t=${Date.now()}`);

    // Import returns module with default export
    // Validate structure and types before returning
    const manifestData = validateManifest(manifest.default, manifestPath);

    logDebug(`Loaded manifest from ${manifestPath}`);
    return manifestData;
  } catch (error) {
    const err = error as Error;

    // Re-throw validation errors as-is (they have clear messages)
    if (err.message.includes('Invalid manifest')) {
      throw err;
    }

    // Detect YAML syntax errors
    // Common error patterns from Bun's YAML parser:
    // - SyntaxError instances
    // - Messages containing: "YAML", "parse", "token", "implicit key", "indentation"
    const yamlErrorPatterns = ['YAML', 'parse', 'token', 'implicit key', 'indentation'];
    const isYamlError = err instanceof SyntaxError ||
                        yamlErrorPatterns.some(pattern => err.message.includes(pattern));

    if (isYamlError) {
      throw new Error(
        `Invalid YAML syntax in ${manifestPath}:\n` +
        `${err.message}\n\n` +
        `Common YAML issues:\n` +
        `  - Incorrect indentation (use spaces, not tabs)\n` +
        `  - Missing colons after keys\n` +
        `  - Unquoted strings with special characters\n` +
        `  - List items must start with "- "\n\n` +
        `Validate your YAML at: https://www.yamllint.com/`
      );
    }

    // Generic error for other issues
    throw new Error(
      `Failed to load manifest at ${manifestPath}: ${err.message}`
    );
  }
}

/**
 * Resolve a path to absolute
 * If already absolute, returns as-is
 * If relative, resolves from current working directory
 */
function resolvePath(filePath: string): string {
  if (filePath === '.') {
    return process.cwd();
  }
  // Check if already absolute
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return join(process.cwd(), filePath);
}

/**
 * Valid output format types
 */
type ValidFormat = 'html' | 'pdf' | 'preview';

/**
 * Type guard to check if a string is a valid format
 * @param value String to check
 * @returns True if value is a valid format
 */
function isValidFormat(value: string): value is ValidFormat {
  const validFormats: readonly ValidFormat[] = ['html', 'pdf', 'preview'] as const;
  return validFormats.includes(value as ValidFormat);
}

/**
 * Validate format option value
 * @param format Format string to validate
 * @returns Lowercase format string if valid
 * @throws Error if format is invalid
 */
export function validateFormatOption(format: string): ValidFormat {
  const validFormats: readonly ValidFormat[] = ['html', 'pdf', 'preview'] as const;
  const normalized = format.toLowerCase();

  if (!isValidFormat(normalized)) {
    throw new Error(
      `Invalid format '${format}'. Valid formats: ${validFormats.join(', ')}`
    );
  }

  return normalized;
}
