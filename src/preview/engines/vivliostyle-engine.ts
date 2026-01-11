/**
 * Vivliostyle Preview Engine
 *
 * Implements the PreviewEngine interface for Vivliostyle Viewer.
 * Vivliostyle loads documents via URL parameters in an embedded viewer.
 *
 * Unlike Paged.js which injects a polyfill into the HTML, Vivliostyle
 * is a complete viewer application that loads content via its own viewer.
 */

import path from 'path';
import { fileExists } from '../../utils/file-utils';
import type {
  PreviewEngine,
  PreviewEngineId,
  PreviewSettings,
  ViewerUrlOptions,
  HtmlInjectionResult,
} from './types';

/**
 * Vivliostyle Viewer version
 */
export const VIVLIOSTYLE_VERSION = '2.39.1';

/**
 * Vivliostyle Preview Engine Implementation
 *
 * Vivliostyle works by loading documents into its own viewer application.
 * The viewer is loaded as an iframe and content is passed via URL hash parameters.
 *
 * URL parameter format:
 * - #src=<document_URL> - Document to load
 * - &bookMode=[true|false] - Enable book mode (TOC, multi-file)
 * - &renderAllPages=[true|false] - Render all pages for print accuracy
 * - &spread=[true|false|auto] - Page spread view
 * - &style=<stylesheet_URL> - Additional author stylesheet
 * - &userStyle=<user_stylesheet_URL> - User stylesheet (higher specificity)
 */
export const vivliostyleEngine: PreviewEngine = {
  id: 'vivliostyle' as PreviewEngineId,
  name: 'Vivliostyle',
  version: VIVLIOSTYLE_VERSION,
  description: 'Professional CSS typesetting engine with EPUB/Web publications support',

  /**
   * Get asset paths that need to be copied to temp directory
   *
   * Vivliostyle's viewer is self-contained in the vendor directory.
   * We also include our custom interface adapter.
   */
  getAssetPaths(assetsSourceDir: string): string[] {
    return [
      // Vivliostyle Viewer distribution
      'vendor/vivliostyle/index.html',
      'vendor/vivliostyle/js/vivliostyle-viewer.js',
      'vendor/vivliostyle/css',
      'vendor/vivliostyle/fonts',
      'vendor/vivliostyle/resources',
      // Custom interface adapter for previewAPI compatibility
      'preview/scripts/vivliostyle-interface.js',
      // Shared preview styles (used by both engines)
      'preview/styles/interface.css',
      'preview/styles/view-single.css',
      'preview/styles/view-two-column.css',
      'preview/styles/debug.css',
    ];
  },

  /**
   * Inject Vivliostyle-compatible scripts into HTML
   *
   * Unlike Paged.js, Vivliostyle doesn't need script injection into the content HTML.
   * The content HTML is loaded by the Vivliostyle Viewer, not rendered in place.
   *
   * However, we do need to ensure the HTML is valid and has proper structure.
   */
  injectEngineScripts(html: string, settings: PreviewSettings): HtmlInjectionResult {
    // Vivliostyle loads HTML as-is, no polyfill injection needed
    // The viewer application handles all rendering
    //
    // We could add some minimal changes to help Vivliostyle:
    // - Ensure proper DOCTYPE
    // - Add viewport meta tag
    // - Add language attribute

    let modifiedHtml = html;

    // Ensure DOCTYPE is present
    if (!html.trim().toLowerCase().startsWith('<!doctype')) {
      modifiedHtml = '<!DOCTYPE html>\n' + modifiedHtml;
    }

    // Add Vivliostyle-friendly meta tags if not present
    if (!modifiedHtml.includes('data-vivliostyle')) {
      modifiedHtml = modifiedHtml.replace(
        '<html',
        '<html data-vivliostyle-paginated="true"'
      );
    }

    return {
      html: modifiedHtml,
      // The viewer loads its own scripts
      additionalScripts: [],
      additionalStyles: [],
    };
  },

  /**
   * Build URL for the Vivliostyle Viewer
   *
   * Returns a URL pointing to the Vivliostyle Viewer with parameters
   * configured via the URL hash.
   *
   * Example output:
   * /vendor/vivliostyle/index.html#src=/preview.html&bookMode=false&renderAllPages=true&spread=auto
   */
  buildViewerUrl(options: ViewerUrlOptions): string {
    const { previewBasePath, settings, cacheBust } = options;

    // Build the source document URL
    // For now, we use a single concatenated HTML file
    const srcUrl = settings.bookMode
      ? `${previewBasePath}publication.html`
      : `${previewBasePath}preview.html`;

    // Build URL hash parameters
    const params = new URLSearchParams();

    // Add cache bust to source URL if provided
    const finalSrcUrl = cacheBust ? `${srcUrl}?v=${cacheBust}` : srcUrl;

    // Build parameter string (Vivliostyle uses hash, not query string for some params)
    const hashParams: string[] = [];

    // Source document (required)
    hashParams.push(`src=${encodeURIComponent(finalSrcUrl)}`);

    // Book mode
    hashParams.push(`bookMode=${settings.bookMode ? 'true' : 'false'}`);

    // Render all pages (true for print accuracy, false for read mode)
    hashParams.push(`renderAllPages=${settings.renderAllPages ? 'true' : 'false'}`);

    // Spread view mode
    hashParams.push(`spread=${settings.spread}`);

    // Additional author stylesheet
    if (settings.stylePath) {
      hashParams.push(`style=${encodeURIComponent(settings.stylePath)}`);
    }

    // User stylesheet (higher specificity)
    if (settings.userStylePath) {
      hashParams.push(`userStyle=${encodeURIComponent(settings.userStylePath)}`);
    }

    // Construct the final URL
    const viewerPath = '/vendor/vivliostyle/index.html';
    return `${viewerPath}#${hashParams.join('&')}`;
  },

  /**
   * Get default settings for Vivliostyle
   */
  getDefaultSettings(): PreviewSettings {
    return {
      bookMode: false, // Single HTML file mode
      renderAllPages: false, // Fast read mode by default
      spread: 'auto', // Auto-detect based on viewport
      debugMode: false,
      zoom: 1.0,
      viewMode: 'two-column',
    };
  },

  /**
   * Validate that Vivliostyle dependencies are available
   */
  async validateDependencies(assetsDir: string): Promise<boolean> {
    const requiredFiles = [
      'vendor/vivliostyle/index.html',
      'vendor/vivliostyle/js/vivliostyle-viewer.js',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(assetsDir, file);
      if (!(await fileExists(filePath))) {
        console.error(`Missing required Vivliostyle asset: ${filePath}`);
        return false;
      }
    }

    return true;
  },
};

/**
 * Create a Vivliostyle engine instance (for testing or custom configuration)
 */
export function createVivliostyleEngine(): PreviewEngine {
  return { ...vivliostyleEngine };
}

/**
 * Register Vivliostyle engine with the registry
 *
 * Call this to enable Vivliostyle as a preview option.
 * By default, Vivliostyle is registered with lower priority than Paged.js
 * for backward compatibility.
 */
export function registerVivliostyleEngine(): void {
  // Dynamic import to avoid circular dependency
  import('./registry').then(({ registerEngine }) => {
    registerEngine(vivliostyleEngine, {
      enabled: true,
      priority: 50, // Lower priority than Paged.js (100)
    });
  });
}
