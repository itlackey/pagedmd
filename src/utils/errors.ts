/**
 * Simplified error classes for pagedmd
 *
 * Just the basics - this is a personal tool, not enterprise software.
 * Use standard Error class for most cases.
 */

/**
 * Error thrown when a build operation fails
 */
export class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildError';
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
