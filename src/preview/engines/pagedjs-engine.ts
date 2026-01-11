/**
 * Paged.js Preview Engine
 *
 * Implements the PreviewEngine interface for Paged.js.
 * This wraps the current preview behavior to allow switching
 * between Paged.js and Vivliostyle engines.
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
 * Paged.js Preview Engine Implementation
 *
 * Paged.js works by injecting a polyfill that transforms the DOM
 * to simulate CSS Paged Media. The content is loaded directly into
 * the preview page and paginated client-side.
 */
export const pagedJsEngine: PreviewEngine = {
  id: 'pagedjs' as PreviewEngineId,
  name: 'Paged.js',
  version: '0.4.3',
  description: 'Client-side CSS Paged Media polyfill for paginated preview',

  /**
   * Get asset paths that need to be copied to temp directory
   */
  getAssetPaths(assetsSourceDir: string): string[] {
    return [
      'preview/scripts/paged.polyfill.js',
      'preview/scripts/interface.js',
      'preview/styles/interface.css',
      'preview/styles/view-single.css',
      'preview/styles/view-two-column.css',
      'preview/styles/debug.css',
    ];
  },

  /**
   * Inject Paged.js polyfill scripts into HTML
   *
   * Adds the polyfill before </head> tag to enable client-side pagination.
   * Same pattern used in preview-format.ts and routes.ts.
   */
  injectEngineScripts(html: string, settings: PreviewSettings): HtmlInjectionResult {
    if (!html.includes('</head>')) {
      throw new Error('HTML is missing required </head> tag for polyfill injection');
    }

    const polyfillScript = `
    <script>
      // Disable auto mode - we'll initialize manually
      window.PagedConfig = {
        auto: false
      };
    </script>
    <script src="/preview/scripts/paged.polyfill.js"></script>
    <script src="/preview/scripts/interface.js"></script>
    <link rel="stylesheet" href="/preview/styles/interface.css">
  `;

    const injectedHtml = html.replace('</head>', `${polyfillScript}</head>`);

    if (injectedHtml === html) {
      throw new Error('Failed to inject polyfill script - HTML unchanged after replace operation');
    }

    return {
      html: injectedHtml,
      additionalScripts: [
        '/preview/scripts/paged.polyfill.js',
        '/preview/scripts/interface.js',
      ],
      additionalStyles: [
        '/preview/styles/interface.css',
      ],
    };
  },

  /**
   * Build URL for the preview iframe
   *
   * For Paged.js, we simply return the path to preview.html
   * since the content is paginated in-place.
   */
  buildViewerUrl(options: ViewerUrlOptions): string {
    const { previewBasePath, cacheBust } = options;

    // Paged.js loads the HTML directly
    let url = `${previewBasePath}preview.html`;

    // Add cache bust if provided
    if (cacheBust) {
      url += `?v=${cacheBust}`;
    }

    return url;
  },

  /**
   * Get default settings for Paged.js
   */
  getDefaultSettings(): PreviewSettings {
    return {
      bookMode: false,
      renderAllPages: true, // Paged.js always renders all pages
      spread: 'auto',
      debugMode: false,
      zoom: 1.0,
      viewMode: 'two-column',
    };
  },

  /**
   * Validate that Paged.js dependencies are available
   */
  async validateDependencies(assetsDir: string): Promise<boolean> {
    const requiredFiles = [
      'preview/scripts/paged.polyfill.js',
      'preview/scripts/interface.js',
      'preview/styles/interface.css',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(assetsDir, file);
      if (!(await fileExists(filePath))) {
        console.error(`Missing required Paged.js asset: ${filePath}`);
        return false;
      }
    }

    return true;
  },
};

/**
 * Create a Paged.js engine instance (for testing or custom configuration)
 */
export function createPagedJsEngine(): PreviewEngine {
  return { ...pagedJsEngine };
}
