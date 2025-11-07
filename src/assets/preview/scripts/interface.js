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
			const pageElement = window.previewAPI.pages[pageIndex]?.element;

			if (pageElement) {
				pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}

			window.previewAPI.notifyPageChange();
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

	// Notify parent window of page changes
	notifyPageChange: () => {
		// Dispatch event that parent window can listen to
		window.dispatchEvent(new CustomEvent('pageChanged', {
			detail: {
				currentPage: window.previewAPI.currentPage + 1,
				totalPages: window.previewAPI.pages.length
			}
		}));
	},

	// Notify parent that rendering is complete
	notifyRenderingComplete: () => {
		window.dispatchEvent(new CustomEvent('renderingComplete', {
			detail: {
				totalPages: window.previewAPI.pages.length
			}
		}));

		// Also notify via flag for polling fallback
		window.pagedJsReady = true;
	}
};

// Function to detect which page is currently visible
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

// Paged.js Handler class
class Handler extends Paged.Handler {
	constructor(chunker, polisher, caller) {
		super(chunker, polisher, caller);
		// Store abort controller for cleanup
		this.scrollAbortController = null;
		this.scrollTimeout = null;
	}

	afterRendered(pages) {
		try {
			console.log(`✓ Paged.js rendered ${pages?.length} pages`);

			// Validate pages array
			if (!Array.isArray(pages) || pages.length === 0) {
				console.warn('Paged.js rendered with invalid or empty pages array');
				return;
			}


			// Update the API with rendered pages
			window.previewAPI.pages = pages;
			window.previewAPI.currentPage = 0;

			// Clean up existing scroll listener if any
			if (this.scrollAbortController) {
				this.scrollAbortController.abort();
			}

			// Create new abort controller for this session
			this.scrollAbortController = new AbortController();

			// Add scroll listener to detect page changes
			window.addEventListener('scroll', () => {
				clearTimeout(this.scrollTimeout);
				this.scrollTimeout = setTimeout(detectCurrentPage, 100);
			}, {
				passive: true,
				signal: this.scrollAbortController.signal
			});

			// Notify parent window that rendering is complete
			window.previewAPI.notifyRenderingComplete();
			window.previewAPI.notifyPageChange();

		} catch (error) {
			console.error('Error in afterRendered callback:', error);
			// Ensure we still notify even if there's an error
			window.previewAPI.notifyRenderingComplete();
		}
	}

	cleanup() {
		// Clean up resources
		if (this.scrollAbortController) {
			this.scrollAbortController.abort();
			this.scrollAbortController = null;
		}
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
			this.scrollTimeout = null;
		}
	}
}

// Store handler instance globally for cleanup
let handlerInstance = null;

Paged.registerHandlers(Handler);

// Initialize Paged.js after DOM is loaded
function initializePaged() {
	console.log('Initializing Paged.js preview...');
	const paged = new Paged.Previewer();

	// Store handler instance for cleanup
	if (paged.handlers && paged.handlers.length > 0) {
		handlerInstance = paged.handlers.find(h => h instanceof Handler);
	}

	paged.preview().catch(err => {
		console.error('Paged.js preview failed:', err);
	});
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializePaged);
} else {
	initializePaged();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
	if (handlerInstance && typeof handlerInstance.cleanup === 'function') {
		handlerInstance.cleanup();
	}
});
