/**
 * Plugin system types for pagedmd
 *
 * Defines the interface for markdown-it plugins and the plugin loader system.
 */

import type MarkdownIt from 'markdown-it';

/**
 * markdown-it plugin function signature
 */
export type MarkdownItPlugin = (md: MarkdownIt, options?: any) => void;

/**
 * Plugin type discriminator
 */
export type PluginType = 'local' | 'package' | 'builtin' | 'remote';

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  keywords?: string[];
}

/**
 * Loaded plugin with all associated data
 */
export interface LoadedPlugin {
  /** Plugin name */
  name: string;

  /** The markdown-it plugin function */
  plugin: MarkdownItPlugin;

  /** Optional CSS to inject */
  css?: string;

  /** Plugin metadata */
  metadata: PluginMetadata;

  /** Plugin type */
  type: PluginType;

  /** Plugin priority (higher = loaded earlier) */
  priority: number;

  /** Plugin options passed from configuration */
  options?: Record<string, unknown>;
}

/**
 * Plugin configuration - string shorthand
 */
export type PluginConfigString = string;

/**
 * Plugin configuration - full object
 */
export interface PluginConfigObject {
  /** Plugin type (auto-detected if omitted) */
  type?: PluginType;

  /** Path to local plugin file */
  path?: string;

  /** Name of npm package or built-in plugin */
  name?: string;

  /** Version constraint for npm packages */
  version?: string;

  /** URL for remote plugins */
  url?: string;

  /** Integrity hash for remote plugins (required) */
  integrity?: string;

  /** Whether plugin is enabled */
  enabled?: boolean;

  /** Options to pass to the plugin */
  options?: Record<string, any>;

  /** Plugin priority (higher = loaded earlier) */
  priority?: number;
}

/**
 * Plugin configuration - union type
 */
export type PluginConfig = PluginConfigString | PluginConfigObject;

/**
 * Normalized plugin configuration (internal use)
 */
export interface NormalizedPluginConfig {
  type?: PluginType;
  path?: string;
  name?: string;
  version?: string;
  url?: string;
  integrity?: string;
  enabled: boolean;
  options: Record<string, any>;
  priority: number;
}

/**
 * Plugin loader options
 */
export interface PluginLoaderOptions {
  /** Base directory for resolving relative paths */
  baseDir: string;

  /** Strict mode - throw on plugin load failures */
  strict?: boolean;

  /** Enable verbose logging */
  verbose?: boolean;

  /** Enable plugin caching */
  cache?: boolean;
}

/**
 * Plugin module export format
 *
 * Plugins can export their function as default or named export,
 * and optionally include CSS and metadata.
 */
export interface PluginModule {
  /** Plugin function (default export) */
  default?: MarkdownItPlugin;

  /** Plugin function (named export) */
  plugin?: MarkdownItPlugin;

  /** Optional CSS to inject */
  css?: string;

  /** Plugin metadata */
  metadata?: Partial<PluginMetadata>;
}

/**
 * Plugin package.json pagedmd configuration
 */
export interface PluginPackageConfig {
  /** Plugin type */
  type: 'markdown-plugin';

  /** Path to CSS file (relative to package root) */
  css?: string;

  /** Plugin priority */
  priority?: number;

  /** Plugin-specific configuration */
  config?: Record<string, any>;
}

/**
 * Plugin validation error
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginName: string,
    public readonly pluginType: PluginType,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

/**
 * Plugin security error
 */
export class PluginSecurityError extends PluginError {
  constructor(
    message: string,
    pluginName: string,
    pluginType: PluginType
  ) {
    super(message, pluginName, pluginType);
    this.name = 'PluginSecurityError';
  }
}
