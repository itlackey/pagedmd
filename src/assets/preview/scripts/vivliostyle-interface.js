// ============================================================================
// Vivliostyle Interface Adapter - Exposes previewAPI for toolbar compatibility
// ============================================================================
//
// This script adapts Vivliostyle's internal API to the previewAPI interface
// that the pagedmd toolbar expects. It runs inside the Vivliostyle viewer
// iframe and communicates with the parent window.
//
// Vivliostyle uses Knockout.js for its internal state management. We access
// its navigation and viewer state through the global variables exposed by
// the viewer.
//
// ============================================================================

(function () {
  'use strict';

  // Wait for Vivliostyle to be ready
  function waitForVivliostyle(callback) {
    const maxAttempts = 100;
    let attempts = 0;

    function check() {
      attempts++;

      // Check if Vivliostyle's navigation object is available
      // The viewer exposes 'navigation' and 'viewer' on window via Knockout
      if (
        typeof window.navigation !== 'undefined' &&
        typeof window.viewer !== 'undefined'
      ) {
        callback();
        return;
      }

      if (attempts >= maxAttempts) {
        console.warn('Vivliostyle interface: Timeout waiting for Vivliostyle viewer');
        return;
      }

      setTimeout(check, 100);
    }

    check();
  }

  // Create the previewAPI object
  function createPreviewAPI() {
    // Vivliostyle exposes these via Knockout observables
    // We need to access them carefully

    const api = {
      // Page tracking
      pages: [],
      currentPage: 0,

      // Get total pages from Vivliostyle's navigation
      getTotalPages: function () {
        try {
          if (window.navigation && window.navigation.totalPages) {
            // totalPages might be a Knockout observable
            const total = typeof window.navigation.totalPages === 'function'
              ? window.navigation.totalPages()
              : window.navigation.totalPages;
            return parseInt(total, 10) || 0;
          }
        } catch (e) {
          console.error('Vivliostyle interface: Error getting total pages', e);
        }
        return 0;
      },

      // Get current page from Vivliostyle
      getCurrentPage: function () {
        try {
          if (window.navigation && window.navigation.pageNumber) {
            const pageNum = typeof window.navigation.pageNumber === 'function'
              ? window.navigation.pageNumber()
              : window.navigation.pageNumber;
            return parseInt(pageNum, 10) || 1;
          }
        } catch (e) {
          console.error('Vivliostyle interface: Error getting current page', e);
        }
        return 1;
      },

      // Navigate to a specific page
      goToPage: function (pageNum) {
        try {
          if (window.navigation && window.navigation.pageNumber) {
            // Vivliostyle's pageNumber is a Knockout observable
            if (typeof window.navigation.pageNumber === 'function') {
              window.navigation.pageNumber(String(pageNum));
            }
            api.notifyPageChange();
          }
        } catch (e) {
          console.error('Vivliostyle interface: Error navigating to page', e);
        }
      },

      // Navigate to first page
      firstPage: function () {
        try {
          if (window.navigation && window.navigation.navigateToFirst) {
            window.navigation.navigateToFirst();
            api.notifyPageChange();
          }
        } catch (e) {
          console.error('Vivliostyle interface: Error navigating to first page', e);
        }
      },

      // Navigate to previous page
      prevPage: function () {
        try {
          if (window.navigation && window.navigation.navigateToPrevious) {
            window.navigation.navigateToPrevious();
            api.notifyPageChange();
          }
        } catch (e) {
          console.error('Vivliostyle interface: Error navigating to previous page', e);
        }
      },

      // Navigate to next page
      nextPage: function () {
        try {
          if (window.navigation && window.navigation.navigateToNext) {
            window.navigation.navigateToNext();
            api.notifyPageChange();
          }
        } catch (e) {
          console.error('Vivliostyle interface: Error navigating to next page', e);
        }
      },

      // Navigate to last page
      lastPage: function () {
        try {
          if (window.navigation && window.navigation.navigateToLast) {
            window.navigation.navigateToLast();
            api.notifyPageChange();
          }
        } catch (e) {
          console.error('Vivliostyle interface: Error navigating to last page', e);
        }
      },

      // Set view mode (single or two-column spread)
      setViewMode: function (mode) {
        try {
          if (window.settingsPanel && window.settingsPanel.state) {
            const pageViewMode = window.settingsPanel.state.pageViewMode;
            if (typeof pageViewMode === 'function') {
              if (mode === 'single') {
                pageViewMode('singlePage');
              } else if (mode === 'two-column') {
                pageViewMode('spread');
              } else {
                pageViewMode('autoSpread');
              }
              // Apply the settings
              if (window.settingsPanel.apply) {
                window.settingsPanel.apply();
              }
            }
          }
          console.log(`View mode set to: ${mode}`);
        } catch (e) {
          console.error('Vivliostyle interface: Error setting view mode', e);
        }
      },

      // Legacy support
      setSinglePageMode: function () {
        api.setViewMode('single');
      },
      setTwoColumnMode: function () {
        api.setViewMode('two-column');
      },

      // Set zoom level
      setZoom: function (zoomLevel) {
        try {
          if (window.navigation) {
            // Vivliostyle uses text scaling, convert zoom to font size percentage
            const percentage = Math.round(zoomLevel * 100);
            if (window.settingsPanel && window.settingsPanel.state &&
                window.settingsPanel.state.pageStyle &&
                window.settingsPanel.state.pageStyle.viewerFontSizePercent) {
              const fontSizeObs = window.settingsPanel.state.pageStyle.viewerFontSizePercent;
              if (typeof fontSizeObs === 'function') {
                fontSizeObs(percentage);
                if (window.settingsPanel.apply) {
                  window.settingsPanel.apply();
                }
              }
            }
          }
          console.log(`Zoom set to: ${zoomLevel}`);
        } catch (e) {
          console.error('Vivliostyle interface: Error setting zoom', e);
        }
      },

      // Toggle debug mode (crop marks)
      toggleDebugMode: function () {
        try {
          if (window.settingsPanel && window.settingsPanel.state &&
              window.settingsPanel.state.pageStyle) {
            const cropMarksObs = window.settingsPanel.state.pageStyle.cropMarksSpecified;
            if (typeof cropMarksObs === 'function') {
              const current = cropMarksObs();
              cropMarksObs(!current);
              if (window.settingsPanel.apply) {
                window.settingsPanel.apply();
              }
              console.log(`Debug mode ${!current ? 'enabled' : 'disabled'}`);
              return !current;
            }
          }
        } catch (e) {
          console.error('Vivliostyle interface: Error toggling debug mode', e);
        }
        return false;
      },

      // Notify parent window of page change
      notifyPageChange: function () {
        window.dispatchEvent(new CustomEvent('pageChanged', {
          detail: {
            currentPage: api.getCurrentPage(),
            totalPages: api.getTotalPages()
          }
        }));
      },

      // Notify parent that rendering is complete
      notifyRenderingComplete: function () {
        window.dispatchEvent(new CustomEvent('renderingComplete', {
          detail: {
            totalPages: api.getTotalPages()
          }
        }));
        window.vivliostyleReady = true;
      }
    };

    return api;
  }

  // Initialize the interface
  function initialize() {
    console.log('Initializing Vivliostyle interface adapter...');

    waitForVivliostyle(function () {
      console.log('Vivliostyle viewer detected, creating previewAPI...');

      // Create and expose previewAPI
      window.previewAPI = createPreviewAPI();

      // Subscribe to Vivliostyle's page changes
      try {
        if (window.navigation && window.navigation.pageNumber) {
          const pageNumberObs = window.navigation.pageNumber;
          if (typeof pageNumberObs.subscribe === 'function') {
            pageNumberObs.subscribe(function () {
              window.previewAPI.notifyPageChange();
            });
          }
        }

        // Watch for viewer status changes
        if (window.viewer && window.viewer.state && window.viewer.state.status) {
          const statusObs = window.viewer.state.status;
          if (typeof statusObs.subscribe === 'function') {
            statusObs.subscribe(function (status) {
              if (status === 'complete' || status === 'interactive') {
                console.log('Vivliostyle rendering complete');
                window.previewAPI.notifyRenderingComplete();
              }
            });
          }
        }
      } catch (e) {
        console.error('Vivliostyle interface: Error setting up observers', e);
      }

      // Check if already rendered
      try {
        if (window.viewer && window.viewer.state && window.viewer.state.status) {
          const status = typeof window.viewer.state.status === 'function'
            ? window.viewer.state.status()
            : window.viewer.state.status;
          if (status === 'complete' || status === 'interactive') {
            window.previewAPI.notifyRenderingComplete();
          }
        }
      } catch (e) {
        console.error('Vivliostyle interface: Error checking initial status', e);
      }

      console.log('✓ Vivliostyle interface adapter initialized');
    });
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
