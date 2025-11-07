/**
 * Application-wide constants
 *
 * Centralized location for all magic numbers and configuration values
 * used throughout the application. This improves maintainability and makes
 * it easier to adjust timeouts, limits, and other values.
 */

/**
 * Network-related constants
 */
export const NETWORK = {
  /** Default port for preview server */
  DEFAULT_PORT: 3579,
  /** Minimum valid port number (below this are privileged) */
  MIN_PORT: 1024,
  /** Maximum valid port number */
  MAX_PORT: 65535,
} as const;

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  /** Default timeout for operations */
  DEFAULT: 60000, // 60 seconds
  /** Timeout for PDF generation via pagedjs-cli */
  PDF_GENERATION: 60000, // 60 seconds
} as const;

/**
 * Test-specific timing constants
 */
export const TEST_TIMEOUTS = {
  /** Safety margin for file watcher tests (4x debounce for race condition buffer) */
  WATCHER_BUFFER: 400, // 400ms = 4 * DEBOUNCE.FILE_WATCH
  /** Write protection window used in manifest update tests */
  MANIFEST_WRITE_PROTECTION_BUFFER: 200, // 200ms
} as const;

/**
 * Debounce delays in milliseconds
 */
export const DEBOUNCE = {
  /** Debounce delay for file watch events */
  FILE_WATCH: 100, // 100ms
  /** Server write protection window to ensure watcher sees flag */
  MANIFEST_WRITE_PROTECTION: 200, // 200ms
} as const;

/**
 * File and data size limits
 */
export const LIMITS = {
  /** Maximum file size for processing (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Maximum number of files to process */
  MAX_FILES: 1000,
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Verbose logging disabled by default */
  VERBOSE: false,
  /** Debug mode disabled by default */
  DEBUG: false,
  /** Default timeout (same as TIMEOUTS.DEFAULT) */
  TIMEOUT: TIMEOUTS.DEFAULT,
  /** Default port (same as NETWORK.DEFAULT_PORT) */
  PORT: NETWORK.DEFAULT_PORT,
  /** File watching enabled by default */
  NO_WATCH: false,
  /** Browser auto-open enabled by default */
  OPEN_BROWSER: true,
} as const;

/**
 * Extension configuration
 */
export const EXTENSIONS = {
  /** Markdown file extension */
  MARKDOWN: '.md',
  /** YAML file extension */
  YAML: '.yaml',
  /** CSS file extension */
  CSS: '.css',
} as const;

/**
 * File names
 */
export const FILENAMES = {
  /** Manifest configuration file */
  MANIFEST: 'manifest.yaml',
  /** Generated HTML file in build directory */
  OUTPUT_HTML: 'index.html',
} as const;

/**
 * Build directory configuration
 */
export const BUILD = {
  /** Temporary build directory name */
  TEMP_DIR: '.tmp',
} as const;
