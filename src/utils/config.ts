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
 * Validate manifest structure and types
 * @throws Error with clear message if validation fails
 */
export function validateManifest(manifest: unknown, manifestPath: string): Manifest {
  if (typeof manifest !== 'object' || manifest === null) {
    throw new Error(`Invalid manifest at ${manifestPath}: must be a YAML object`);
  }

  // Check if manifest is an array (YAML lists become arrays)
  if (Array.isArray(manifest)) {
    throw new Error(`Invalid manifest at ${manifestPath}: must be a YAML object, not a list`);
  }

  const m = manifest as Record<string, unknown>;

  // Validate title field
  if (m.title !== undefined && typeof m.title !== 'string') {
    throw new Error(
      `Invalid manifest at ${manifestPath}: title must be a string, got ${typeof m.title}`
    );
  }

  // Validate authors field
  if (m.authors !== undefined) {
    if (!Array.isArray(m.authors)) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: authors must be an array, got ${typeof m.authors}`
      );
    }
    // Validate each author is a string
    for (let i = 0; i < m.authors.length; i++) {
      if (typeof m.authors[i] !== 'string') {
        throw new Error(
          `Invalid manifest at ${manifestPath}: authors[${i}] must be a string, got ${typeof m.authors[i]}`
        );
      }
    }
  }

  // Validate styles field
  if (m.styles !== undefined) {
    if (!Array.isArray(m.styles)) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: styles must be an array, got ${typeof m.styles}`
      );
    }

    // Validate each style path
    m.styles.forEach((style, index) => {
      if (typeof style !== 'string') {
        throw new Error(
          `Invalid manifest at ${manifestPath}: styles[${index}] must be a string, got ${typeof style}`
        );
      }

      // Reject absolute paths (they won't be copied correctly)
      if (path.isAbsolute(style)) {
        throw new Error(
          `Invalid manifest at ${manifestPath}: styles[${index}] must be a relative path, got absolute path "${style}"`
        );
      }

      // Reject paths that go outside the input directory
      const normalized = path.normalize(style);
      if (normalized.startsWith('..')) {
        throw new Error(
          `Invalid manifest at ${manifestPath}: styles[${index}] cannot reference paths outside the input directory ("${style}")`
        );
      }
    });
  }

  // Validate disableDefaultStyles field
  if (m.disableDefaultStyles !== undefined && typeof m.disableDefaultStyles !== 'boolean') {
    throw new Error(
      `Invalid manifest at ${manifestPath}: disableDefaultStyles must be a boolean, got ${typeof m.disableDefaultStyles}`
    );
  }

  // Validate format field
  if (m.format !== undefined) {
    if (typeof m.format !== 'object' || m.format === null || Array.isArray(m.format)) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: format must be an object, got ${typeof m.format}`
      );
    }

    const format = m.format as Record<string, unknown>;

    // Validate format.size
    if (format.size !== undefined && typeof format.size !== 'string') {
      throw new Error(
        `Invalid manifest at ${manifestPath}: format.size must be a string, got ${typeof format.size}`
      );
    }

    // Validate format.margins
    if (format.margins !== undefined && typeof format.margins !== 'string') {
      throw new Error(
        `Invalid manifest at ${manifestPath}: format.margins must be a string, got ${typeof format.margins}`
      );
    }

    // Validate format.bleed
    if (format.bleed !== undefined && typeof format.bleed !== 'string') {
      throw new Error(
        `Invalid manifest at ${manifestPath}: format.bleed must be a string, got ${typeof format.bleed}`
      );
    }

    // Validate format.colorMode
    if (format.colorMode !== undefined) {
      if (typeof format.colorMode !== 'string') {
        throw new Error(
          `Invalid manifest at ${manifestPath}: format.colorMode must be a string, got ${typeof format.colorMode}`
        );
      }
      if (format.colorMode !== 'rgb' && format.colorMode !== 'cmyk') {
        throw new Error(
          `Invalid manifest at ${manifestPath}: format.colorMode must be 'rgb' or 'cmyk', got '${format.colorMode}'`
        );
      }
    }

    // Check for unknown format fields
    const validFormatFields = new Set(['size', 'margins', 'bleed', 'colorMode']);
    const unknownFormatFields = Object.keys(format).filter(key => !validFormatFields.has(key));
    if (unknownFormatFields.length > 0) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: unknown format fields: ${unknownFormatFields.join(', ')}. Valid fields are: ${Array.from(validFormatFields).join(', ')}`
      );
    }
  }

  // Validate extensions field
  if (m.extensions !== undefined) {
    if (!Array.isArray(m.extensions)) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: extensions must be an array, got ${typeof m.extensions}`
      );
    }
    // Validate each extension is a string
    for (let i = 0; i < m.extensions.length; i++) {
      if (typeof m.extensions[i] !== 'string') {
        throw new Error(
          `Invalid manifest at ${manifestPath}: extensions[${i}] must be a string, got ${typeof m.extensions[i]}`
        );
      }
    }
  }

  // Validate files field
  if (m.files !== undefined) {
    if (!Array.isArray(m.files)) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: files must be an array, got ${typeof m.files}`
      );
    }

    // Validate each file path
    m.files.forEach((file, index) => {
      if (typeof file !== 'string') {
        throw new Error(
          `Invalid manifest at ${manifestPath}: files[${index}] must be a string, got ${typeof file}`
        );
      }

      // Reject absolute paths (they won't be processed correctly)
      if (path.isAbsolute(file)) {
        throw new Error(
          `Invalid manifest at ${manifestPath}: files[${index}] must be a relative path, got absolute path "${file}"`
        );
      }

      // Reject paths that go outside the input directory
      const normalized = path.normalize(file);
      if (normalized.startsWith('..')) {
        throw new Error(
          `Invalid manifest at ${manifestPath}: files[${index}] cannot reference paths outside the input directory ("${file}")`
        );
      }

      // Require .md extension
      if (!file.endsWith(EXTENSIONS.MARKDOWN)) {
        throw new Error(
          `Invalid manifest at ${manifestPath}: files[${index}] must have ${EXTENSIONS.MARKDOWN} extension, got "${file}"`
        );
      }
    });
  }

  // Validate metadata field
  if (m.metadata !== undefined) {
    if (typeof m.metadata !== 'object' || m.metadata === null || Array.isArray(m.metadata)) {
      throw new Error(
        `Invalid manifest at ${manifestPath}: metadata must be an object, got ${typeof m.metadata}`
      );
    }

    const metadata = m.metadata as Record<string, unknown>;

    // Validate metadata.author
    if (metadata.author !== undefined && typeof metadata.author !== 'string') {
      throw new Error(
        `Invalid manifest at ${manifestPath}: metadata.author must be a string, got ${typeof metadata.author}`
      );
    }

    // Validate metadata.date
    if (metadata.date !== undefined && typeof metadata.date !== 'string') {
      throw new Error(
        `Invalid manifest at ${manifestPath}: metadata.date must be a string, got ${typeof metadata.date}`
      );
    }

    // Validate metadata.isbn
    if (metadata.isbn !== undefined && typeof metadata.isbn !== 'string') {
      throw new Error(
        `Invalid manifest at ${manifestPath}: metadata.isbn must be a string, got ${typeof metadata.isbn}`
      );
    }
   
  }

  // Check for unknown fields and warn (helps catch typos)
  const validFields = new Set(['title', 'authors', 'format', 'styles', 'disableDefaultStyles', 'extensions', 'files', 'metadata']);
  const unknownFields = Object.keys(m).filter(key => !validFields.has(key));
  if (unknownFields.length > 0) {
    throw new Error(
      `Invalid manifest at ${manifestPath}: unknown fields: ${unknownFields.join(', ')}. Valid fields are: ${Array.from(validFields).join(', ')}`
    );
  }

  return m as Manifest;
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
