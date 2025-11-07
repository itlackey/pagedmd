// ============================================================================
// Preview Client for pagedmd (Vite + Build Watch Architecture)
// ============================================================================
//
// REFACTORED VERSION:
// - Toolbar UI controls (folder selection, page navigation, zoom, view mode)
// - Uses iframe's previewAPI directly via same-origin access
// - NO state duplication - iframe is source of truth
// - Listens to iframe events for page changes
//
// Architecture:
// - Preview server serves content via Vite with HMR
// - Iframe contains Paged.js with previewAPI exposed on window
// - Parent window delegates all operations to iframe API
//
// ============================================================================

// ============================================================================
// Client-Side State Management (Folder Selection Only)
// ============================================================================

const clientState = {
	currentFolder: '',  // Absolute path to input directory (for folder selector)
};

// ============================================================================
// Debug and Notification Utilities
// ============================================================================

function debugLog(message, isError = false) {
	console.log(message);
	const debugEl = document.getElementById("debug-console");
	if (debugEl) {
		debugEl.textContent = message;
		debugEl.className = isError ? "error" : "";
	}
}

function showError(title, message) {
	console.error(`${title}: ${message}`);
	debugLog(`❌ ${title}`, true);

	// Show toast notification if available
	if (typeof window.showToast === 'function') {
		window.showToast(title, message, 'error');
	}
}

function showSuccess(title, message) {
	console.log(`${title}: ${message}`);
	debugLog(`✓ ${title}`);

	if (typeof window.showToast === 'function') {
		window.showToast(title, message, 'success');
	}
}

// ============================================================================
// Folder Selection Modal
// ============================================================================

/**
 * Folder navigation state
 */
let currentPath = '';
let folderHistory = [];

/**
 * Open folder selection modal
 */
function openFolderModal() {
	const modal = document.getElementById('folder-modal');
	const overlay = document.getElementById('loading-overlay');

	modal.style.display = 'flex';
	if (overlay) overlay.style.display = 'none';

	// Start navigation from user's home directory
	const homeDir = '/home';  // Will be updated from server
	currentPath = clientState.currentFolder || homeDir;
	folderHistory = [currentPath];

	loadFolderList(currentPath);
}

/**
 * Close folder selection modal
 */
function closeFolderModal() {
	const modal = document.getElementById('folder-modal');
	modal.style.display = 'none';
}

/**
 * Load list of directories for given path
 */
async function loadFolderList(path) {
	try {
		const response = await fetch(`/api/directories?path=${encodeURIComponent(path)}`);

		if (!response.ok) {
			throw new Error(`Failed to load directories: ${response.status}`);
		}

		const data = await response.json();
		currentPath = data.currentPath;

		// Update current path display
		const pathDisplay = document.getElementById('current-path-display');
		pathDisplay.textContent = currentPath;

		// Render folder list
		const folderList = document.getElementById('folder-list');
		folderList.innerHTML = '';

		// Add "parent directory" option if not at root
		if (data.parent) {
			const parentDiv = createFolderItem('..', data.parent, true);
			folderList.appendChild(parentDiv);
		}

		// Add subdirectories
		data.directories.forEach(dir => {
			const itemDiv = createFolderItem(dir.name, dir.path, false);
			folderList.appendChild(itemDiv);
		});

	} catch (error) {
		console.error('Failed to load folder list:', error);
		showError('Folder List Error', 'Could not load directories. Check server logs.');
	}
}

/**
 * Create folder list item element
 */
function createFolderItem(name, path, isParent) {
	const div = document.createElement('div');
	div.className = 'folder-item';
	div.setAttribute('data-path', path);
	div.setAttribute('role', 'listitem');
	div.setAttribute('tabindex', '0');

	const icon = isParent ? '⬆️' : '📁';
	div.innerHTML = `
		<span class="folder-icon">${icon}</span>
		<span class="folder-name">${name}</span>
	`;

	// Click or Enter to navigate
	div.addEventListener('click', () => loadFolderList(path));
	div.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			loadFolderList(path);
		}
	});

	return div;
}

/**
 * Switch to selected folder
 */
async function switchToFolder(path) {
	try {
		debugLog(`Switching to folder: ${path}`);

		const response = await fetch('/api/change-folder', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path })
		});

		if (!response.ok) {
			throw new Error(`Failed to switch folder: ${response.status}`);
		}

		const data = await response.json();

		// Update client state
		clientState.currentFolder = path;

		// Close modal
		closeFolderModal();

		// Show success message
		showSuccess('Folder Changed', `Now previewing: ${path}`);

		// Reload iframe to show new folder content
		const iframe = document.getElementById('preview-iframe');
		if (iframe) {
			debugLog('Reloading iframe with new content...');
			iframe.src = iframe.src; // Trigger reload
		}

		debugLog(`✓ Switched to: ${path}`);

	} catch (error) {
		console.error('Failed to switch folder:', error);
		showError('Folder Switch Failed', error.message);
	}
}

// ============================================================================
// Iframe API Access - Direct same-origin communication
// ============================================================================

/**
 * Get iframe's content window (same-origin access)
 */
function getIframeWindow() {
	const iframe = document.getElementById('preview-iframe');
	if (iframe && iframe.contentWindow) {
		return iframe.contentWindow;
	}
	return null;
}

// No polling needed - iframe signals via events when ready

// ============================================================================
// Toolbar UI State Management
// ============================================================================

/**
 * Update page display in toolbar
 * Reads current state from iframe API
 */
function updatePageDisplay() {
	const iframeWin = getIframeWindow();
	if (!iframeWin || !iframeWin.previewAPI) return;

	const api = iframeWin.previewAPI;

	const currentPage = api.getCurrentPage();
	const totalPages = api.getTotalPages();

	const pageInput = document.getElementById('page-input');
	const totalPagesEl = document.getElementById('total-pages');

	if (pageInput) {
		pageInput.value = currentPage;
		pageInput.max = totalPages;
	}

	if (totalPagesEl) {
		totalPagesEl.textContent = totalPages || '-';
	}

	// Update navigation button states
	updateNavigationButtons(currentPage, totalPages);
}

/**
 * Update navigation button enabled/disabled states
 */
function updateNavigationButtons(currentPage, totalPages) {
	const firstBtn = document.getElementById('btn-first');
	const prevBtn = document.getElementById('btn-prev');
	const nextBtn = document.getElementById('btn-next');
	const lastBtn = document.getElementById('btn-last');

	const isFirstPage = currentPage <= 1;
	const isLastPage = currentPage >= totalPages;

	if (firstBtn) firstBtn.disabled = isFirstPage;
	if (prevBtn) prevBtn.disabled = isFirstPage;
	if (nextBtn) nextBtn.disabled = isLastPage;
	if (lastBtn) lastBtn.disabled = isLastPage;
}

// ============================================================================
// Toolbar Event Handlers - Delegate to Iframe API
// ============================================================================

/**
 * Navigate to specific page via iframe API
 */
function goToPage(pageNum) {
	const iframeWin = getIframeWindow();
	if (!iframeWin || !iframeWin.previewAPI) {
		debugLog('Preview API not ready', true);
		return;
	}

	iframeWin.previewAPI.goToPage(pageNum);
	// UI will be updated via pageChanged event from iframe
}

/**
 * Navigate to first page
 */
function goToFirstPage() {
	const iframeWin = getIframeWindow();
	if (iframeWin && iframeWin.previewAPI) {
		iframeWin.previewAPI.firstPage();
	}
}

/**
 * Navigate to previous page
 */
function goToPreviousPage() {
	const iframeWin = getIframeWindow();
	if (iframeWin && iframeWin.previewAPI) {
		iframeWin.previewAPI.prevPage();
	}
}

/**
 * Navigate to next page
 */
function goToNextPage() {
	const iframeWin = getIframeWindow();
	if (iframeWin && iframeWin.previewAPI) {
		iframeWin.previewAPI.nextPage();
	}
}

/**
 * Navigate to last page
 */
function goToLastPage() {
	const iframeWin = getIframeWindow();
	if (iframeWin && iframeWin.previewAPI) {
		iframeWin.previewAPI.lastPage();
	}
}

/**
 * Change view mode (single/two-column) via iframe API
 */
function setViewMode(mode) {
	const iframeWin = getIframeWindow();
	if (!iframeWin || !iframeWin.previewAPI) return;

	const api = iframeWin.previewAPI;

	// Update button states
	const singleBtn = document.getElementById('btn-single');
	const twoColumnBtn = document.getElementById('btn-two-column');

	if (singleBtn) {
		singleBtn.classList.toggle('active', mode === 'single');
	}

	if (twoColumnBtn) {
		twoColumnBtn.classList.toggle('active', mode === 'two-column');
	}

	// Apply view mode via API
	api.setViewMode(mode);
}

/**
 * Change zoom level via iframe API
 */
function setZoom(zoom) {
	const iframeWin = getIframeWindow();
	if (!iframeWin || !iframeWin.previewAPI) return;

	const api = iframeWin.previewAPI;

	if (zoom === 'fit-width') {
		// Calculate fit-width zoom
		const doc = iframeWin.document;
		const firstPage = doc.querySelector('.pagedjs_page');
		if (!firstPage) return;

		const containerWidth = iframeWin.innerWidth - 40; // Account for padding
		const pageWidth = firstPage.offsetWidth;
		const scale = containerWidth / pageWidth;

		api.setZoom(scale);
	} else {
		api.setZoom(zoom);
	}
}

/**
 * Toggle debug mode (show/hide crop marks and page boxes)
 */
function toggleDebugMode() {
	const iframeWin = getIframeWindow();
	if (!iframeWin || !iframeWin.previewAPI) {
		debugLog('Preview API not ready', true);
		return;
	}

	const api = iframeWin.previewAPI;
	const isDebug = api.toggleDebugMode();

	// Update button state
	const debugBtn = document.getElementById('btn-debug');
	if (debugBtn) {
		if (isDebug) {
			debugBtn.classList.add('active');
		} else {
			debugBtn.classList.remove('active');
		}
	}

	debugLog(`Debug mode ${isDebug ? 'enabled' : 'disabled'}`);
}

// ============================================================================
// Iframe Event Listeners
// ============================================================================

/**
 * Handle page change events from iframe
 */
function onPageChanged(event) {
	const { currentPage, totalPages } = event.detail;
	debugLog(`Page changed: ${currentPage}/${totalPages}`);
	updatePageDisplay();
}

/**
 * Handle rendering complete event from iframe
 * This fires when Paged.js has finished rendering all pages
 */
function onRenderingComplete(event) {
	const { totalPages } = event.detail;
	debugLog(`✓ Rendering complete: ${totalPages} pages`);

	// Update UI with initial page state
	updatePageDisplay();

	// Apply default view mode (two-column)
	setViewMode('two-column');

	// Apply default zoom
	setZoom(1.0);

	debugLog('✓ Preview initialized and ready');
}

/**
 * Setup event listeners on iframe window
 */
function setupIframeEventListeners() {
	const iframeWin = getIframeWindow();
	if (!iframeWin) {
		debugLog('Cannot setup iframe listeners - window not accessible', true);
		return;
	}

	// Listen for page change events
	iframeWin.addEventListener('pageChanged', onPageChanged);

	// Listen for rendering complete events
	iframeWin.addEventListener('renderingComplete', onRenderingComplete);

	debugLog('✓ Iframe event listeners registered');
}

// ============================================================================
// Toolbar Control Initialization
// ============================================================================

/**
 * Initialize toolbar button event listeners
 */
function initializeToolbarControls() {
	// Folder selection button
	const folderBtn = document.getElementById('btn-folder');
	if (folderBtn) {
		folderBtn.addEventListener('click', openFolderModal);
	}

	// Modal close button
	const closeBtn = document.getElementById('modal-close');
	if (closeBtn) {
		closeBtn.addEventListener('click', closeFolderModal);
	}

	// "Open This Folder" button
	const openBtn = document.getElementById('btn-open-folder');
	if (openBtn) {
		openBtn.addEventListener('click', () => {
			switchToFolder(currentPath);
		});
	}

	// Close modal on Escape key
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			const modal = document.getElementById('folder-modal');
			if (modal && modal.style.display === 'flex') {
				closeFolderModal();
			}
		}
	});

	// Page navigation buttons
	const firstBtn = document.getElementById('btn-first');
	if (firstBtn) {
		firstBtn.addEventListener('click', goToFirstPage);
	}

	const prevBtn = document.getElementById('btn-prev');
	if (prevBtn) {
		prevBtn.addEventListener('click', goToPreviousPage);
	}

	const nextBtn = document.getElementById('btn-next');
	if (nextBtn) {
		nextBtn.addEventListener('click', goToNextPage);
	}

	const lastBtn = document.getElementById('btn-last');
	if (lastBtn) {
		lastBtn.addEventListener('click', goToLastPage);
	}

	// Page input
	const pageInput = document.getElementById('page-input');
	if (pageInput) {
		pageInput.addEventListener('change', (e) => {
			const page = parseInt(e.target.value, 10);
			if (!isNaN(page)) {
				goToPage(page);
			}
		});

		pageInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				const page = parseInt(e.target.value, 10);
				if (!isNaN(page)) {
					goToPage(page);
				}
			}
		});
	}

	// View mode buttons
	const singleBtn = document.getElementById('btn-single');
	if (singleBtn) {
		singleBtn.addEventListener('click', () => setViewMode('single'));
	}

	const twoColumnBtn = document.getElementById('btn-two-column');
	if (twoColumnBtn) {
		twoColumnBtn.addEventListener('click', () => setViewMode('two-column'));
	}

	// Zoom select
	const zoomSelect = document.getElementById('zoom-select');
	if (zoomSelect) {
		zoomSelect.addEventListener('change', (e) => {
			const value = e.target.value;

			if (value === 'fit-width') {
				setZoom('fit-width');
			} else {
				const zoom = parseFloat(value);
				if (!isNaN(zoom)) {
					setZoom(zoom);
				}
			}
		});
	}

	// Debug mode button
	const debugBtn = document.getElementById('btn-debug');
	if (debugBtn) {
		debugBtn.addEventListener('click', toggleDebugMode);
	}

	// Wait for iframe to load, then initialize
	const iframe = document.getElementById('preview-iframe');
	if (iframe) {
		iframe.addEventListener('load', onIframeLoad);
	}
}

/**
 * Handle iframe load event
 * Wait for Paged.js to finish rendering, then initialize
 */
function onIframeLoad() {
	debugLog('Iframe loaded, setting up event listeners...');

	// Setup event listeners - iframe will signal when ready via 'renderingComplete' event
	setupIframeEventListeners();

	debugLog('✓ Waiting for renderingComplete event from iframe...');
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize preview client
 */
async function initializePreview() {
	try {
		debugLog('Initializing preview...');

		// Hide loading overlay (iframe handles its own loading state)
		const overlay = document.getElementById('loading-overlay');
		if (overlay) {
			overlay.style.display = 'none';
		}

		// Initialize toolbar controls
		initializeToolbarControls();

		// Set current folder from URL or default
		clientState.currentFolder = window.location.pathname.includes('/home')
			? window.location.pathname
			: '/home';

		debugLog('✓ Preview initialized');

	} catch (error) {
		console.error('Initialization failed:', error);
		showError('Initialization Error', error.message);
	}
}

// ============================================================================
// Entry Point
// ============================================================================

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializePreview);
} else {
	initializePreview();
}
