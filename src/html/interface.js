// ============================================================================
// Paged.js Preview Handler - Exposes API for toolbar controls
// ============================================================================

// Create window.previewAPI immediately (before Paged.js runs)
window.previewAPI = {
    pages: [],
    currentPage: 0,

    getTotalPages: () => window.previewAPI.pages.length,
    getCurrentPage: () => window.previewAPI.currentPage + 1,

    goToPage: (pageNum) => {
        const pageIndex = pageNum - 1;
        if (pageIndex >= 0 && pageIndex < window.previewAPI.pages.length) {
            window.previewAPI.currentPage = pageIndex;
            window.previewAPI.pages[pageIndex]?.element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.previewAPI.updateUI();
        }
    },

    firstPage: () => window.previewAPI.goToPage(1),

    prevPage: () => {
        if (window.previewAPI.currentPage > 0) {
            window.previewAPI.goToPage(window.previewAPI.currentPage);
        }
    },

    nextPage: () => {
        if (window.previewAPI.currentPage < window.previewAPI.pages.length - 1) {
            window.previewAPI.goToPage(window.previewAPI.currentPage + 2);
        }
    },

    lastPage: () => window.previewAPI.goToPage(window.previewAPI.pages.length),

    setSinglePageMode: () => {
        document.body.classList.remove('spread-view');
        document.body.classList.add('single-view');
    },

    setSpreadMode: () => {
        document.body.classList.remove('single-view');
        document.body.classList.add('spread-view');
    },

    setZoom: (zoomLevel) => {
        const container = document.querySelector('.pagedjs_pages');
        if (container) {
            // zoomLevel is already a decimal (0.5, 1, 1.5, etc.)
            container.style.transform = `scale(${zoomLevel})`;
            container.style.transformOrigin = 'top center';
        }
    },

    updateUI: () => {
        // Dispatch event for parent window toolbar to update
        window.dispatchEvent(new CustomEvent('pageChanged', {
            detail: {
                currentPage: window.previewAPI.currentPage + 1,
                totalPages: window.previewAPI.pages.length
            }
        }));
    }
};

// Function to detect which page is currently visible
function detectCurrentPage() {
    const viewportMiddle = window.innerHeight / 2;

    for (let i = 0; i < window.previewAPI.pages.length; i++) {
        const element = window.previewAPI.pages[i]?.element;
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        // Check if page center is in viewport
        const pageCenter = rect.top + (rect.height / 2);

        if (rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
            if (window.previewAPI.currentPage !== i) {
                window.previewAPI.currentPage = i;
                window.previewAPI.updateUI();
            }
            return;
        }
    }
}

// Paged.js Handler class
class Handler extends Paged.Handler {
    afterRendered(pages) {
        console.log(`✓ Paged.js rendered ${pages.length} pages`);

        // Update the API with rendered pages
        window.previewAPI.pages = pages;
        window.previewAPI.currentPage = 0;
        window.previewAPI.updateUI();

        // Add scroll listener to detect page changes
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(detectCurrentPage, 100);
        }, { passive: true });

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('afterPreviewRendered', {
            detail: { totalPages: pages.length }
        }));
    }
}

Paged.registerHandlers(Handler);
