// ============================================================================
// Preview Client for dc-book-cli (Vite + Build Watch Architecture)
// ============================================================================
//
// REFACTORED VERSION (Phase 4):
// - Toolbar UI controls (folder selection, page navigation, zoom, view mode)
// - NO HTML fetching (Vite serves via iframe with automatic HMR)
// - NO WebSocket (Vite HMR handles live updates)
// - ~90% reduction in code complexity
//
// Architecture:
// - Preview server spawns build watch subprocess → builds to temp dir
// - Vite serves temp dir with HMR → iframe auto-refreshes
// - This script only manages toolbar UI state and folder selection
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
// Toolbar Event Handlers (Page Navigation, Zoom, View Mode)
// ============================================================================

/**
 * Current preview state
 */
const previewState = {
  currentPage: 1,
  totalPages: 0,
  viewMode: 'spread', // 'single' or 'spread'
  zoom: 1.0,
  pages: [] // Array of page elements from iframe
};

/**
 * Get iframe's content document (same-origin access)
 */
function getIframeDocument() {
  const iframe = document.getElementById('preview-iframe');
  if (iframe && iframe.contentDocument) {
    return iframe.contentDocument;
  }
  return null;
}

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

/**
 * Get all page elements from iframe
 */
function getPages() {
  const doc = getIframeDocument();
  if (!doc) return [];

  return Array.from(doc.querySelectorAll('.pagedjs_page'));
}

/**
 * Update page list and total count
 */
function updatePageList() {
  previewState.pages = getPages();
  previewState.totalPages = previewState.pages.length;
  updatePageDisplay();
}

/**
 * Update page display in toolbar
 */
function updatePageDisplay() {
  const pageInput = document.getElementById('page-input');
  const totalPagesEl = document.getElementById('total-pages');

  if (pageInput) {
    pageInput.value = previewState.currentPage;
    pageInput.max = previewState.totalPages;
  }

  if (totalPagesEl) {
    totalPagesEl.textContent = previewState.totalPages || '-';
  }
}

/**
 * Navigate to specific page
 */
function goToPage(pageNum) {
  const page = Math.max(1, Math.min(pageNum, previewState.totalPages));

  if (page === previewState.currentPage) {
    return; // Already on this page
  }

  previewState.currentPage = page;

  // Scroll to page in iframe
  const pageEl = previewState.pages[page - 1];
  if (pageEl) {
    pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  updatePageDisplay();
}

/**
 * Navigate to first page
 */
function goToFirstPage() {
  goToPage(1);
}

/**
 * Navigate to previous page
 */
function goToPreviousPage() {
  goToPage(previewState.currentPage - 1);
}

/**
 * Navigate to next page
 */
function goToNextPage() {
  goToPage(previewState.currentPage + 1);
}

/**
 * Navigate to last page
 */
function goToLastPage() {
  goToPage(previewState.totalPages);
}

/**
 * Change view mode (single/spread)
 */
function setViewMode(mode) {
  previewState.viewMode = mode;

  // Update button states
  const singleBtn = document.getElementById('btn-single');
  const spreadBtn = document.getElementById('btn-spread');

  if (singleBtn) {
    singleBtn.classList.toggle('active', mode === 'single');
  }

  if (spreadBtn) {
    spreadBtn.classList.toggle('active', mode === 'spread');
  }

  // Apply view mode to iframe
  applyViewMode(mode);
}

/**
 * Apply view mode to pages in iframe
 */
function applyViewMode(mode) {
  const doc = getIframeDocument();
  if (!doc) return;

  const pagesWrapper = doc.querySelector('.pagedjs_pages');
  if (!pagesWrapper) return;

  if (mode === 'single') {
    // Single page view: stack pages vertically
    pagesWrapper.style.display = 'flex';
    pagesWrapper.style.flexDirection = 'column';
    pagesWrapper.style.alignItems = 'center';
    pagesWrapper.style.gap = '20px';

    previewState.pages.forEach(page => {
      page.style.marginRight = '0';
    });

  } else {
    // Spread view: two-up layout
    pagesWrapper.style.display = 'flex';
    pagesWrapper.style.flexDirection = 'row';
    pagesWrapper.style.flexWrap = 'wrap';
    pagesWrapper.style.justifyContent = 'center';
    pagesWrapper.style.gap = '0';

    previewState.pages.forEach((page, index) => {
      // Add margin between spreads
      if (index % 2 === 1) {
        page.style.marginRight = '40px';
      } else {
        page.style.marginRight = '0';
      }
    });
  }
}

/**
 * Change zoom level
 */
function setZoom(zoom) {
  previewState.zoom = zoom;
  applyZoom(zoom);
}

/**
 * Apply zoom level to iframe
 */
function applyZoom(zoom) {
  const doc = getIframeDocument();
  if (!doc) return;

  const pagesWrapper = doc.querySelector('.pagedjs_pages');
  if (!pagesWrapper) return;

  if (zoom === 'fit-width') {
    // Fit to iframe width
    const iframeWin = getIframeWindow();
    if (!iframeWin) return;

    const containerWidth = iframeWin.innerWidth - 40; // Padding
    const pageWidth = previewState.pages[0]?.offsetWidth || 816; // Default 6in at 96dpi

    const scale = containerWidth / pageWidth;
    pagesWrapper.style.transform = `scale(${scale})`;
    pagesWrapper.style.transformOrigin = 'top center';

  } else {
    // Fixed zoom level
    pagesWrapper.style.transform = `scale(${zoom})`;
    pagesWrapper.style.transformOrigin = 'top center';
  }
}

/**
 * Track which page is currently visible in iframe
 */
function trackVisiblePage() {
  const iframeWin = getIframeWindow();
  if (!iframeWin || previewState.pages.length === 0) return;

  const scrollTop = iframeWin.scrollY;
  const windowHeight = iframeWin.innerHeight;
  const viewportCenter = scrollTop + (windowHeight / 2);

  // Find which page is at viewport center
  for (let i = 0; i < previewState.pages.length; i++) {
    const page = previewState.pages[i];
    const rect = page.getBoundingClientRect();
    const pageTop = scrollTop + rect.top;
    const pageBottom = pageTop + rect.height;

    if (viewportCenter >= pageTop && viewportCenter < pageBottom) {
      const newPage = i + 1;

      if (newPage !== previewState.currentPage) {
        previewState.currentPage = newPage;
        updatePageDisplay();
      }

      break;
    }
  }
}

/**
 * Setup iframe content monitoring
 */
function setupIframeMonitoring() {
  const iframeWin = getIframeWindow();
  if (!iframeWin) return;

  // Track scroll position in iframe
  let scrollTimeout;
  iframeWin.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(trackVisiblePage, 100);
  });

  debugLog('✓ Iframe monitoring active');
}

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

  const spreadBtn = document.getElementById('btn-spread');
  if (spreadBtn) {
    spreadBtn.addEventListener('click', () => setViewMode('spread'));
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

  // Wait for iframe to load, then initialize page tracking
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
  debugLog('Iframe loaded, waiting for Paged.js...');

  const iframeWin = getIframeWindow();
  if (!iframeWin) {
    showError('Preview Error', 'Could not access iframe window');
    return;
  }

  // Listen for afterPreviewRendered event from iframe
  iframeWin.addEventListener('afterPreviewRendered', (event) => {
    const { pageCount } = event.detail;

    debugLog(`✓ Paged.js ready: ${pageCount} pages`);

    // Update state with page information
    previewState.pages = getPages();
    previewState.totalPages = pageCount;

    // Update UI
    updatePageDisplay();

    // Apply initial view mode and zoom
    applyViewMode(previewState.viewMode);
    applyZoom(previewState.zoom);

    // Setup scroll tracking
    setupIframeMonitoring();
  });

  // Fallback: Poll for pages if event doesn't fire
  let pollAttempts = 0;
  const maxAttempts = 50; // 5 seconds max

  const pollInterval = setInterval(() => {
    pollAttempts++;

    const pages = getPages();

    if (pages.length > 0) {
      // Pages found! Initialize
      clearInterval(pollInterval);

      // Only initialize if not already done by event
      if (previewState.totalPages === 0) {
        previewState.pages = pages;
        previewState.totalPages = pages.length;

        debugLog(`✓ Paged.js ready (fallback): ${pages.length} pages`);

        // Update UI
        updatePageDisplay();

        // Apply initial view mode and zoom
        applyViewMode(previewState.viewMode);
        applyZoom(previewState.zoom);

        // Setup scroll tracking
        setupIframeMonitoring();
      }

    } else if (pollAttempts >= maxAttempts) {
      // Give up
      clearInterval(pollInterval);
      if (previewState.totalPages === 0) {
        showError('Preview Error', 'Paged.js failed to render pages. Check console for errors.');
      }
    }
  }, 100);
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
