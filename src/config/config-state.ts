/**
 * Simplified Configuration Manager
 *
 * Merges CLI options with manifest.yaml settings and provides defaults.
 * This is a personal tool - no complex validation, just basic merging.
 */

import path from 'path';
import { BuildOptions, Manifest, OutputFormat } from '../types.ts';
import { loadManifest } from '../utils/config.ts';
import { isDirectory } from '../utils/file-utils.ts';
import { DEFAULTS } from '../constants.ts';

/**
 * Resolved configuration combining BuildOptions with Manifest properties
 * This is what markdown processing and other systems need - a unified config
 */
export type ResolvedConfig = BuildOptions & Manifest;

/**
 * Simple configuration manager that merges CLI options with manifest settings
 */
export class ConfigurationManager {
  private manifest: Manifest | null = null;
  private inputDir: string;
  private mergedConfig: BuildOptions;

  /**
   * Create a new configuration manager
   *
   * @param inputPath - Input file or directory path (defaults to cwd)
   * @param cliOptions - Options from CLI arguments
   */
  constructor(
    inputPath: string = process.cwd(),
    private cliOptions: Partial<BuildOptions> = {}
  ) {
    // Store input directory for later use
    this.inputDir = inputPath;

    // Create initial merged config (will be updated after manifest loads)
    this.mergedConfig = this.createDefaultConfig(inputPath);
  }

  /**
   * Load manifest and merge configuration
   * Call this before using getConfig()
   */
  async initialize(): Promise<void> {
    // Determine input directory
    const isDir = await isDirectory(this.inputDir);
    const inputDir = isDir ? this.inputDir : path.dirname(this.inputDir);

    // Load manifest if it exists
    this.manifest = await loadManifest(inputDir);

    // Merge all configuration sources
    this.mergedConfig = this.mergeConfiguration();
  }

  /**
   * Get the merged configuration (BuildOptions + Manifest)
   * Make sure to call initialize() first!
   *
   * @returns Merged configuration with all defaults applied
   */
  getConfig(): ResolvedConfig {
    return {
      ...this.mergedConfig,
      ...(this.manifest || {}),
    } as ResolvedConfig;
  }

  /**
   * Get the build format from configuration
   *
   * @returns Output format (pdf, html, or preview)
   */
  getBuildFormat(): OutputFormat {
    return this.mergedConfig.format ?? OutputFormat.PDF;
  }

  /**
   * Get the loaded manifest (may be null)
   */
  getManifest(): Manifest | null {
    return this.manifest;
  }

  /**
   * Create default configuration from input path and CLI options
   */
  private createDefaultConfig(inputPath: string): BuildOptions {
    return {
      input: inputPath,
      output: this.cliOptions.output,
      htmlOutput: this.cliOptions.htmlOutput,
      timeout: this.cliOptions.timeout ?? DEFAULTS.TIMEOUT,
      verbose: this.cliOptions.verbose ?? DEFAULTS.VERBOSE,
      debug: this.cliOptions.debug ?? DEFAULTS.DEBUG,
      format: this.cliOptions.format ?? OutputFormat.PDF,
      watch: this.cliOptions.watch ?? false,
      force: this.cliOptions.force ?? false,
    };
  }

  /**
   * Merge CLI options, manifest settings, and defaults
   * Priority: CLI > Manifest > Defaults
   */
  private mergeConfiguration(): BuildOptions {
    const defaults = this.createDefaultConfig(this.inputDir);

    // If no manifest, just return defaults
    if (!this.manifest) {
      return defaults;
    }

    // Merge manifest settings (CLI options already applied in defaults)
    // Note: Manifest doesn't override CLI options, only provides additional context
    return {
      ...defaults,
      // Keep all CLI options and defaults as-is
      // Manifest is used elsewhere for theme, styles, files, etc.
    };
  }
}

/**
 * Helper function to create and initialize a ConfigurationManager
 *
 * @param inputPath - Input file or directory path
 * @param cliOptions - Options from CLI arguments
 * @returns Initialized ConfigurationManager
 */
export async function createConfigManager(
  inputPath: string = process.cwd(),
  cliOptions: Partial<BuildOptions> = {}
): Promise<ConfigurationManager> {
  const manager = new ConfigurationManager(inputPath, cliOptions);
  await manager.initialize();
  return manager;
}
