// ============================================================================
// Paged.js Preview Handler - Exposes previewAPI for toolbar integration
// ============================================================================
//
// This script provides the previewAPI interface that the pagedmd toolbar
// expects. It works with Paged.js polyfill for CSS Paged Media rendering.
//
// Architecture:
// - Paged.js renders the document into paginated pages
// - This handler exposes navigation and view controls via window.previewAPI
// - Parent window (toolbar) communicates via same-origin iframe access
//
// ============================================================================

(function() {
  'use strict';

  // ============================================================================
  // Preview API - Exposed on window for parent toolbar access
  // ============================================================================

  window.previewAPI = {
    pages: [],
    currentPage: 0,

    /**
     * Get total number of pages
     */
    getTotalPages: function() {
      return window.previewAPI.pages.length;
    },

    /**
     * Get current page number (1-indexed)
     */
    getCurrentPage: function() {
      return window.previewAPI.currentPage + 1;
    },

    /**
     * Navigate to a specific page (1-indexed)
     */
    goToPage: function(pageNum) {
      const pageIndex = pageNum - 1;
      if (pageIndex >= 0 && pageIndex < window.previewAPI.pages.length) {
        window.previewAPI.currentPage = pageIndex;
        const pageElement = window.previewAPI.pages[pageIndex]?.element;
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        window.previewAPI.notifyPageChange();
      }
    },

    /**
     * Navigate to first page
     */
    firstPage: function() {
      window.previewAPI.goToPage(1);
    },

    /**
     * Navigate to previous page
     */
    prevPage: function() {
      if (window.previewAPI.currentPage > 0) {
        window.previewAPI.goToPage(window.previewAPI.currentPage);
      }
    },

    /**
     * Navigate to next page
     */
    nextPage: function() {
      if (window.previewAPI.currentPage < window.previewAPI.pages.length - 1) {
        window.previewAPI.goToPage(window.previewAPI.currentPage + 2);
      }
    },

    /**
     * Navigate to last page
     */
    lastPage: function() {
      window.previewAPI.goToPage(window.previewAPI.pages.length);
    },

    /**
     * Set view mode (single or two-column)
     */
    setViewMode: function(mode) {
      const viewLinkId = 'view-mode-styles';
      const existingLink = document.getElementById(viewLinkId);
      if (existingLink) existingLink.remove();

      // Apply view mode CSS
      const style = document.createElement('style');
      style.id = viewLinkId;

      if (mode === 'single') {
        style.textContent = `
          .pagedjs_pages {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
          }
          .pagedjs_page {
            margin: 0 auto;
          }
        `;
      } else if (mode === 'two-column') {
        style.textContent = `
          .pagedjs_pages {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
            padding: 20px;
          }
          .pagedjs_page {
            margin: 0;
          }
        `;
      }

      document.head.appendChild(style);
      console.log('View mode set to:', mode);
    },

    /**
     * Legacy support for single page mode
     */
    setSinglePageMode: function() {
      window.previewAPI.setViewMode('single');
    },

    /**
     * Legacy support for two-column mode
     */
    setTwoColumnMode: function() {
      window.previewAPI.setViewMode('two-column');
    },

    /**
     * Set zoom level
     */
    setZoom: function(zoomLevel) {
      const container = document.querySelector('.pagedjs_pages');
      if (container) {
        container.style.transform = 'scale(' + zoomLevel + ')';
        container.style.transformOrigin = 'top center';
      }
      console.log('Zoom set to:', zoomLevel);
    },

    /**
     * Toggle debug mode (show crop marks and page boxes)
     */
    toggleDebugMode: function() {
      const debugLinkId = 'debug-mode-styles';
      let debugLink = document.getElementById(debugLinkId);

      if (debugLink) {
        debugLink.remove();
        console.log('Debug mode disabled');
        return false;
      } else {
        const style = document.createElement('style');
        style.id = debugLinkId;
        style.textContent = `
          .pagedjs_page {
            outline: 2px solid rgba(255, 0, 0, 0.3);
            outline-offset: -2px;
          }
          .pagedjs_margin-top-left-corner-holder,
          .pagedjs_margin-top-right-corner-holder,
          .pagedjs_margin-bottom-left-corner-holder,
          .pagedjs_margin-bottom-right-corner-holder {
            background: rgba(255, 0, 0, 0.1);
          }
          .pagedjs_margin-left,
          .pagedjs_margin-right {
            background: rgba(0, 255, 0, 0.05);
          }
          .pagedjs_margin-top,
          .pagedjs_margin-bottom {
            background: rgba(0, 0, 255, 0.05);
          }
          .pagedjs_area {
            outline: 1px dashed rgba(0, 0, 255, 0.3);
          }
        `;
        document.head.appendChild(style);
        console.log('Debug mode enabled');
        return true;
      }
    },

    /**
     * Notify parent window of page change
     */
    notifyPageChange: function() {
      window.dispatchEvent(new CustomEvent('pageChanged', {
        detail: {
          currentPage: window.previewAPI.currentPage + 1,
          totalPages: window.previewAPI.pages.length
        }
      }));
    },

    /**
     * Notify parent that rendering is complete
     */
    notifyRenderingComplete: function() {
      window.dispatchEvent(new CustomEvent('renderingComplete', {
        detail: { totalPages: window.previewAPI.pages.length }
      }));
      window.pagedJsReady = true;
    }
  };

  // ============================================================================
  // Scroll-Based Page Detection
  // ============================================================================

  /**
   * Detect current page based on scroll position
   */
  function detectCurrentPage() {
    const viewportMiddle = window.innerHeight / 2;
    for (let i = 0; i < window.previewAPI.pages.length; i++) {
      const element = window.previewAPI.pages[i]?.element;
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
        if (window.previewAPI.currentPage !== i) {
          window.previewAPI.currentPage = i;
          window.previewAPI.notifyPageChange();
        }
        return;
      }
    }
  }

  // ============================================================================
  // Paged.js Handler
  // ============================================================================

  /**
   * Custom Paged.js handler to capture page information
   */
  class PagedPreviewHandler extends Paged.Handler {
    constructor(chunker, polisher, caller) {
      super(chunker, polisher, caller);
      this.scrollAbortController = null;
      this.scrollTimeout = null;
    }

    /**
     * Called after Paged.js has finished rendering all pages
     */
    afterRendered(pages) {
      console.log('Paged.js rendered', pages?.length || 0, 'pages');

      // Store page references for navigation
      window.previewAPI.pages = pages || [];
      window.previewAPI.currentPage = 0;

      // Clean up old scroll listener
      if (this.scrollAbortController) {
        this.scrollAbortController.abort();
      }
      this.scrollAbortController = new AbortController();

      // Set up scroll-based page detection
      window.addEventListener('scroll', function() {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(detectCurrentPage, 100);
      }.bind(this), { passive: true, signal: this.scrollAbortController.signal });

      // Notify that rendering is complete
      window.previewAPI.notifyRenderingComplete();
      window.previewAPI.notifyPageChange();
    }
  }

  // Register the custom handler with Paged.js
  Paged.registerHandlers(PagedPreviewHandler);

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize Paged.js rendering
   */
  function initializePagedJs() {
    console.log('Initializing Paged.js preview...');

    // Start Paged.js preview rendering
    var previewer = new Paged.Previewer();
    previewer.preview().then(function(flow) {
      console.log('Paged.js preview complete');
    }).catch(function(error) {
      console.error('Paged.js rendering error:', error);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePagedJs);
  } else {
    initializePagedJs();
  }

})();
