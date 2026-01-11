/**
 * Plugin loader for pagedmd
 *
 * Loads and manages markdown-it plugins from multiple sources:
 * - Local files (.js, .ts)
 * - npm packages
 * - Built-in plugins
 * - Remote URLs (with integrity verification)
 */

import path from 'path';
import { pathToFileURL } from 'url';
import type MarkdownIt from 'markdown-it';
import { fileExists, readFile } from '../utils/file-utils.js';
import { validateStaticPath } from '../utils/path-security.js';
import { info, warn, debug } from '../utils/logger.js';
import type {
  PluginConfig,
  PluginType,
  NormalizedPluginConfig,
  LoadedPlugin,
  PluginLoaderOptions,
  PluginModule,
  MarkdownItPlugin,
  PluginMetadata,
  PluginPackageConfig,
} from '../types/plugin-types.js';
import { PluginError, PluginSecurityError } from '../types/plugin-types.js';

// Import built-in plugins
import ttrpgPlugin from './plugins/ttrpg-directives-plugin.js';
import dimmCityPlugin from './plugins/dimm-city-plugin.js';

/**
 * Plugin loader class
 *
 * Manages loading and caching of plugins from various sources.
 */
export class PluginLoader {
  private baseDir: string;
  private strict: boolean;
  private verbose: boolean;
  private enableCache: boolean;
  private cache: Map<string, LoadedPlugin>;
  private builtinPlugins: Map<string, MarkdownItPlugin>;

  constructor(options: PluginLoaderOptions) {
    this.baseDir = options.baseDir;
    this.strict = options.strict ?? false;
    this.verbose = options.verbose ?? false;
    this.enableCache = options.cache ?? true;
    this.cache = new Map();

    // Register built-in plugins (cast to MarkdownItPlugin to allow different option types)
    this.builtinPlugins = new Map<string, MarkdownItPlugin>([
      ['ttrpg', ttrpgPlugin as MarkdownItPlugin],
      ['dimmCity', dimmCityPlugin as MarkdownItPlugin],
    ]);
  }

  /**
   * Load a plugin from configuration
   *
   * @param config Plugin configuration
   * @returns Loaded plugin or null if disabled
   * @throws PluginError if loading fails in strict mode
   */
  async loadPlugin(config: PluginConfig): Promise<LoadedPlugin | null> {
    const normalized = this.normalizeConfig(config);

    if (!normalized.enabled) {
      return null;
    }

    // Check cache
    if (this.enableCache) {
      const cacheKey = this.getCacheKey(normalized);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.log(`Using cached plugin: ${cached.name}`);
        return cached;
      }
    }

    // Determine plugin type
    const type = normalized.type || this.detectType(normalized);

    try {
      let loaded: LoadedPlugin;

      switch (type) {
        case 'local':
          loaded = await this.loadLocalPlugin(normalized);
          break;

        case 'package':
          loaded = await this.loadPackagePlugin(normalized);
          break;

        case 'builtin':
          loaded = await this.loadBuiltinPlugin(normalized);
          break;

        case 'remote':
          loaded = await this.loadRemotePlugin(normalized);
          break;

        default:
          throw new Error(`Unknown plugin type: ${type}`);
      }

      // Apply priority from config
      loaded.priority = normalized.priority;

      // Cache loaded plugin
      if (this.enableCache) {
        const cacheKey = this.getCacheKey(normalized);
        this.cache.set(cacheKey, loaded);
      }

      this.log(`✓ Loaded ${type} plugin: ${loaded.metadata.name} v${loaded.metadata.version}`);

      return loaded;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const pluginName = normalized.name || normalized.path || normalized.url || 'unknown';

      if (this.strict) {
        throw new PluginError(
          `Failed to load plugin ${pluginName}: ${errorMessage}`,
          pluginName,
          type,
          error instanceof Error ? error : undefined
        );
      } else {
        warn(`Failed to load plugin ${pluginName}: ${errorMessage}`);
        return null;
      }
    }
  }

  /**
   * Load multiple plugins
   *
   * @param configs Array of plugin configurations
   * @returns Array of loaded plugins (nulls filtered out)
   */
  async loadPlugins(configs: PluginConfig[]): Promise<LoadedPlugin[]> {
    const results = await Promise.all(
      configs.map((config) => this.loadPlugin(config))
    );

    // Filter out nulls and sort by priority (higher first)
    return results
      .filter((plugin): plugin is LoadedPlugin => plugin !== null)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Normalize plugin configuration
   */
  private normalizeConfig(config: PluginConfig): NormalizedPluginConfig {
    if (typeof config === 'string') {
      return {
        type: undefined,
        path: config,
        name: config,
        enabled: true,
        options: {},
        priority: 100,
      };
    }

    return {
      type: config.type,
      path: config.path,
      name: config.name,
      version: config.version,
      url: config.url,
      integrity: config.integrity,
      enabled: config.enabled ?? true,
      options: config.options ?? {},
      priority: config.priority ?? 100,
    };
  }

  /**
   * Auto-detect plugin type from configuration
   */
  private detectType(config: NormalizedPluginConfig): PluginType {
    // Local file - starts with ./ or ../ or ends with .js/.ts
    if (
      config.path?.match(/^\.\.?\//) ||
      config.path?.match(/\.(m?js|ts)$/)
    ) {
      return 'local';
    }

    // Remote URL
    if (config.url || config.path?.startsWith('http')) {
      return 'remote';
    }

    // Built-in plugin
    if (config.name && this.builtinPlugins.has(config.name)) {
      return 'builtin';
    }

    // Default to npm package
    return 'package';
  }

  /**
   * Load plugin from local file
   */
  private async loadLocalPlugin(
    config: NormalizedPluginConfig
  ): Promise<LoadedPlugin> {
    if (!config.path) {
      throw new Error('Local plugin requires path');
    }

    const pluginPath = path.resolve(this.baseDir, config.path);

    // Security validation
    try {
      const validation = await validateStaticPath(pluginPath, this.baseDir);
      if (!validation.valid) {
        throw new PluginSecurityError(
          validation.error || 'Path validation failed',
          config.path,
          'local'
        );
      }
    } catch (error) {
      throw new PluginSecurityError(
        error instanceof Error ? error.message : String(error),
        config.path,
        'local'
      );
    }

    // Check file exists
    if (!(await fileExists(pluginPath))) {
      throw new Error(
        `Plugin file not found: ${config.path}\n` +
          `Resolved to: ${pluginPath}\n` +
          `Make sure the file exists and the path is correct.`
      );
    }

    try {
      // Dynamic import (Bun supports .ts files natively)
      const fileUrl = pathToFileURL(pluginPath).href;
      const module: PluginModule = await import(fileUrl);

      // Extract plugin function
      const pluginFn = module.default || module.plugin;
      if (!pluginFn || typeof pluginFn !== 'function') {
        throw new Error(
          'Plugin must export a default function or named "plugin" function'
        );
      }

      // Extract metadata
      const metadata: PluginMetadata = {
        name:
          module.metadata?.name ||
          path.basename(pluginPath, path.extname(pluginPath)),
        version: module.metadata?.version || '0.0.0',
        description: module.metadata?.description || 'Local plugin',
        author: module.metadata?.author,
        homepage: module.metadata?.homepage,
        keywords: module.metadata?.keywords,
      };

      return {
        name: config.path,
        plugin: pluginFn,
        css: module.css,
        metadata,
        type: 'local',
        priority: config.priority,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('export')) {
        throw new Error(
          `Failed to load plugin ${config.path}: ${error.message}\n` +
            `Make sure your plugin exports a default function:\n` +
            `  export default function myPlugin(md, options) { ... }`
        );
      }
      throw error;
    }
  }

  /**
   * Load plugin from npm package
   */
  private async loadPackagePlugin(
    config: NormalizedPluginConfig
  ): Promise<LoadedPlugin> {
    if (!config.name) {
      throw new Error('Package plugin requires name');
    }

    const packageName = config.name;

    try {
      // Resolve package path
      const packagePath = path.join(
        this.baseDir,
        'node_modules',
        packageName
      );

      if (!(await fileExists(packagePath))) {
        throw new Error(
          `Plugin package not found: ${packageName}\n` +
            `Run: npm install ${packageName}\n` +
            `Or: bun add ${packageName}`
        );
      }

      // Load package.json
      const pkgJsonPath = path.join(packagePath, 'package.json');
      const pkgJsonContent = await readFile(pkgJsonPath);
      const pkgJson = JSON.parse(pkgJsonContent);

      // Validate version if specified
      if (config.version) {
        // Simple version check (not full semver for now)
        if (!this.satisfiesVersion(pkgJson.version, config.version)) {
          throw new Error(
            `Plugin ${packageName} version ${pkgJson.version} ` +
              `does not satisfy ${config.version}`
          );
        }
      }

      // Import plugin
      const pluginEntryPoint = path.join(
        packagePath,
        pkgJson.main || 'index.js'
      );
      const fileUrl = pathToFileURL(pluginEntryPoint).href;
      const module: PluginModule = await import(fileUrl);

      // Extract plugin function
      const pluginFn = module.default || module.plugin;
      if (!pluginFn || typeof pluginFn !== 'function') {
        throw new Error(
          `Package ${packageName} does not export a valid plugin function`
        );
      }

      // Load CSS if specified in package.json
      const pagedmdConfig: PluginPackageConfig | undefined =
        pkgJson.pagedmd;
      let css: string | undefined;

      if (pagedmdConfig?.css) {
        const cssPath = path.join(packagePath, pagedmdConfig.css);
        if (await fileExists(cssPath)) {
          css = await readFile(cssPath);
        }
      }

      // Build metadata
      const metadata: PluginMetadata = {
        name: packageName,
        version: pkgJson.version,
        description: pkgJson.description || '',
        author:
          typeof pkgJson.author === 'string'
            ? pkgJson.author
            : pkgJson.author?.name,
        homepage: pkgJson.homepage,
        keywords: pkgJson.keywords,
        ...module.metadata,
      };

      return {
        name: packageName,
        plugin: pluginFn,
        css,
        metadata,
        type: 'package',
        priority: pagedmdConfig?.priority ?? config.priority,
      };
    } catch (error) {
      throw new Error(
        `Failed to load package plugin ${packageName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load built-in plugin
   */
  private async loadBuiltinPlugin(
    config: NormalizedPluginConfig
  ): Promise<LoadedPlugin> {
    if (!config.name) {
      throw new Error('Built-in plugin requires name');
    }

    const pluginName = config.name;
    const plugin = this.builtinPlugins.get(pluginName);

    if (!plugin) {
      const available = Array.from(this.builtinPlugins.keys()).join(', ');
      throw new Error(
        `Unknown built-in plugin: ${pluginName}\n` +
          `Available built-in plugins: ${available}`
      );
    }

    // Try to load CSS for built-in plugins
    let css: string | undefined;
    const cssFileName = `${pluginName.toLowerCase()}-components.css`;
    const cssPath = path.join(
      this.baseDir,
      'src/assets/plugins',
      cssFileName
    );

    if (await fileExists(cssPath)) {
      css = await readFile(cssPath);
    }

    const metadata: PluginMetadata = {
      name: pluginName,
      version: '1.0.0',
      description: `Built-in ${pluginName} plugin`,
    };

    return {
      name: pluginName,
      plugin,
      css,
      metadata,
      type: 'builtin',
      priority: config.priority,
    };
  }

  /**
   * Load plugin from remote URL
   */
  private async loadRemotePlugin(
    config: NormalizedPluginConfig
  ): Promise<LoadedPlugin> {
    throw new Error(
      'Remote plugins are not yet supported.\n' +
        'This feature will be added in a future version.\n' +
        'For now, please use local files or npm packages.'
    );
  }

  /**
   * Simple version satisfaction check
   * TODO: Use proper semver library
   */
  private satisfiesVersion(actual: string, expected: string): boolean {
    // Remove leading ^ or ~
    const cleanExpected = expected.replace(/^[~^]/, '');

    // For now, just do simple version comparison
    // This should be replaced with proper semver checking
    return actual === cleanExpected || actual.startsWith(cleanExpected);
  }

  /**
   * Generate cache key for plugin configuration
   */
  private getCacheKey(config: NormalizedPluginConfig): string {
    return JSON.stringify({
      type: config.type,
      path: config.path,
      name: config.name,
      version: config.version,
      url: config.url,
    });
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      info(message);
    } else {
      debug(message);
    }
  }

  /**
   * Clear plugin cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get list of available built-in plugins
   */
  getBuiltinPlugins(): string[] {
    return Array.from(this.builtinPlugins.keys());
  }
}

/**
 * Create a plugin loader instance
 *
 * @param baseDir Base directory for resolving plugin paths
 * @param options Additional options
 * @returns PluginLoader instance
 */
export function createPluginLoader(
  baseDir: string,
  options?: Partial<PluginLoaderOptions>
): PluginLoader {
  return new PluginLoader({
    baseDir,
    ...options,
  });
}
