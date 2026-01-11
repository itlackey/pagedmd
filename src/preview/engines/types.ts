/**
 * Preview Engine Types
 *
 * Defines the abstraction layer for different preview rendering engines.
 * This allows swapping between Paged.js and Vivliostyle (and potentially others)
 * without changing the core preview server logic.
 */

/**
 * Supported preview engine identifiers
 */
export type PreviewEngineId = 'pagedjs' | 'vivliostyle';

/**
 * Preview rendering settings
 * These control how the preview engine renders and displays content
 */
export interface PreviewSettings {
  /**
   * Book mode enables TOC panel and multi-document loading (Vivliostyle-specific)
   * When true, the viewer loads a publication.html with <nav role="doc-toc">
   * When false, loads a single concatenated book.html
   */
  bookMode: boolean;

  /**
   * Render all pages for accurate print pagination
   * - true: Slower, but accurate page count for print (Vivliostyle "Print" mode)
   * - false: Faster viewing, may have approximate pagination (Vivliostyle "Read" mode)
   */
  renderAllPages: boolean;

  /**
   * Spread display mode
   * - 'auto': Automatically choose based on viewport
   * - 'true': Always show page spreads (facing pages)
   * - 'false': Single page view
   */
  spread: 'auto' | 'true' | 'false';

  /**
   * Optional user stylesheet path for additional styling
   * Applied with higher specificity than author styles
   */
  userStylePath?: string;

  /**
   * Optional stylesheet path for author styling
   */
  stylePath?: string;

  /**
   * Debug mode - show crop marks, page boxes, etc.
   */
  debugMode?: boolean;

  /**
   * Zoom level (1.0 = 100%)
   */
  zoom?: number;

  /**
   * View mode for layout (single or two-column)
   */
  viewMode?: 'single' | 'two-column';
}

/**
 * Options for building the viewer URL
 */
export interface ViewerUrlOptions {
  /**
   * Unique identifier for the current project/folder
   */
  projectId: string;

  /**
   * Base path where preview content is served
   * Example: '/__preview/project-id/'
   */
  previewBasePath: string;

  /**
   * Preview settings to apply
   */
  settings: PreviewSettings;

  /**
   * Cache bust parameter for forcing reload
   */
  cacheBust?: string;
}

/**
 * Options for registering static assets
 */
export interface StaticAssetOptions {
  /**
   * The Vite dev server or Bun app instance
   */
  app: unknown;

  /**
   * Mount path for static assets
   * Example: '/vendor/vivliostyle'
   */
  mountPath: string;

  /**
   * Path to the assets source directory
   */
  assetsSourceDir: string;
}

/**
 * Interface for injecting engine-specific scripts into HTML
 */
export interface HtmlInjectionResult {
  /**
   * HTML content with engine scripts injected
   */
  html: string;

  /**
   * List of additional script paths to be served
   */
  additionalScripts?: string[];

  /**
   * List of additional stylesheet paths to be served
   */
  additionalStyles?: string[];
}

/**
 * Preview Engine Interface
 *
 * Each preview engine (Paged.js, Vivliostyle) implements this interface
 * to provide a consistent API for the preview server.
 */
export interface PreviewEngine {
  /**
   * Unique identifier for this engine
   */
  readonly id: PreviewEngineId;

  /**
   * Human-readable name for the engine
   */
  readonly name: string;

  /**
   * Version of the engine
   */
  readonly version: string;

  /**
   * Description of the engine's capabilities
   */
  readonly description: string;

  /**
   * Get the paths to static assets that need to be copied to temp directory
   *
   * @param assetsSourceDir - Base path to assets directory
   * @returns Array of relative paths to copy
   */
  getAssetPaths(assetsSourceDir: string): string[];

  /**
   * Inject engine-specific scripts and styles into HTML content
   *
   * @param html - Original HTML content
   * @param settings - Preview settings
   * @returns HTML with engine scripts injected
   */
  injectEngineScripts(html: string, settings: PreviewSettings): HtmlInjectionResult;

  /**
   * Build the URL to load in the preview iframe
   *
   * For Paged.js: Returns path to preview.html (same-origin)
   * For Vivliostyle: Returns path to Vivliostyle Viewer with URL params
   *
   * @param options - Viewer URL options
   * @returns URL string for iframe src
   */
  buildViewerUrl(options: ViewerUrlOptions): string;

  /**
   * Get default preview settings for this engine
   *
   * @returns Default PreviewSettings
   */
  getDefaultSettings(): PreviewSettings;

  /**
   * Validate that all required dependencies are available
   *
   * @param assetsDir - Path to assets directory
   * @returns True if engine is ready to use
   */
  validateDependencies(assetsDir: string): Promise<boolean>;
}

/**
 * Engine registry entry with metadata
 */
export interface EngineRegistryEntry {
  /**
   * The engine implementation
   */
  engine: PreviewEngine;

  /**
   * Whether this engine is enabled
   */
  enabled: boolean;

  /**
   * Priority for engine selection (higher = preferred)
   */
  priority: number;
}

/**
 * Preview API contract that engines must support
 * This is exposed on window.previewAPI in the iframe
 */
export interface PreviewAPI {
  /**
   * Array of page references
   */
  pages: unknown[];

  /**
   * Current page index (0-based internally)
   */
  currentPage: number;

  /**
   * Get total number of pages
   */
  getTotalPages(): number;

  /**
   * Get current page number (1-based for display)
   */
  getCurrentPage(): number;

  /**
   * Navigate to a specific page (1-based)
   */
  goToPage(pageNum: number): void;

  /**
   * Navigate to first page
   */
  firstPage(): void;

  /**
   * Navigate to previous page
   */
  prevPage(): void;

  /**
   * Navigate to next page
   */
  nextPage(): void;

  /**
   * Navigate to last page
   */
  lastPage(): void;

  /**
   * Set view mode (single or two-column)
   */
  setViewMode(mode: 'single' | 'two-column'): void;

  /**
   * Set zoom level
   */
  setZoom(zoomLevel: number): void;

  /**
   * Toggle debug mode
   * @returns Current debug mode state after toggle
   */
  toggleDebugMode(): boolean;

  /**
   * Notify parent window of page change
   */
  notifyPageChange(): void;

  /**
   * Notify parent window that rendering is complete
   */
  notifyRenderingComplete(): void;
}

/**
 * Events dispatched by the preview iframe
 */
export interface PreviewEvents {
  /**
   * Fired when the current page changes
   */
  pageChanged: CustomEvent<{
    currentPage: number;
    totalPages: number;
  }>;

  /**
   * Fired when rendering is complete
   */
  renderingComplete: CustomEvent<{
    totalPages: number;
  }>;
}

/**
 * Configuration for the engine selection in manifest.yaml
 */
export interface PreviewEngineConfig {
  /**
   * Engine to use for preview
   * @default 'pagedjs'
   */
  engine?: PreviewEngineId;

  /**
   * Engine-specific settings
   */
  settings?: Partial<PreviewSettings>;
}
