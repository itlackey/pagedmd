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
  currentFolder: "", // Absolute path to input directory (for folder selector)
};

// Track rendering timeout to prevent race conditions
let renderingTimeoutId = null;

// ============================================================================
// Notification Utilities
// ============================================================================

function showError(title, message) {
  console.error(`${title}: ${message}`);

  // Show toast notification if available
  if (typeof window.showToast === "function") {
    window.showToast(title, message, "error");
  }
}

function showSuccess(title, message) {
  console.log(`${title}: ${message}`);

  if (typeof window.showToast === "function") {
    window.showToast(title, message, "success");
  }
}

function showInfo(title, message) {
  console.log(`${title}: ${message}`);

  if (typeof window.showToast === "function") {
    window.showToast(title, message, "info");
  }
}

function updateLoadingMessage(message) {
  const loadingEl = document.getElementById("loading-message");
  if (loadingEl) {
    loadingEl.textContent = message;
  }
}

// ============================================================================
// Folder Selection Modal
// ============================================================================

/**
 * Folder navigation state
 */
let currentPath = "";
let folderHistory = [];

/**
 * Open folder selection modal
 */
async function openFolderModal() {
  const modal = document.getElementById("folder-modal");
  const overlay = document.getElementById("loading-overlay");

  modal.style.display = "flex";
  if (overlay) overlay.style.display = "none";

  // Start navigation from current folder if available, otherwise fetch from server
  if (!currentPath) {
    // Fetch current directory from server (will return home if no path specified)
    try {
      const response = await fetch("/api/directories");
      const data = await response.json();
      currentPath = data.currentPath;
    } catch (error) {
      console.error("Failed to get current directory:", error);
      currentPath = ""; // Fallback
    }
  }

  folderHistory = [currentPath];
  loadFolderList(currentPath);
}

/**
 * Close folder selection modal
 */
function closeFolderModal() {
  const modal = document.getElementById("folder-modal");
  modal.style.display = "none";
}

/**
 * Load list of directories for given path
 */
async function loadFolderList(path) {
  try {
    const response = await fetch(
      `/api/directories?path=${encodeURIComponent(path)}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to load directories: ${response.status}`);
    }

    const data = await response.json();
    currentPath = data.currentPath;

    // Update current path display
    const pathDisplay = document.getElementById("current-path-display");
    pathDisplay.textContent = currentPath;

    // Render folder list
    const folderList = document.getElementById("folder-list");
    folderList.innerHTML = "";

    // Add "parent directory" option if not at root
    if (data.parent) {
      const parentDiv = createFolderItem("..", data.parent, true);
      folderList.appendChild(parentDiv);
    }

    // Add subdirectories
    data.directories.forEach((dir) => {
      const itemDiv = createFolderItem(dir.name, dir.path, false);
      folderList.appendChild(itemDiv);
    });
  } catch (error) {
    console.error("Failed to load folder list:", error);
    showError(
      "Folder List Error",
      "Could not load directories. Check server logs.",
    );
  }
}

/**
 * Create folder list item element
 */
function createFolderItem(name, path, isParent) {
  const div = document.createElement("div");
  div.className = "folder-item";
  div.setAttribute("data-path", path);
  div.setAttribute("role", "listitem");
  div.setAttribute("tabindex", "0");

  const iconSvg = isParent
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
  div.innerHTML = `
		<span class="folder-item-icon">${iconSvg}</span>
		<span class="folder-item-name">${name}</span>
	`;

  // Click or Enter to navigate
  div.addEventListener("click", () => loadFolderList(path));
  div.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
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
    console.log(`Switching to folder: ${path}`);

    const response = await fetch("/api/change-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
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
    showSuccess("Folder Changed", `Now previewing: ${path}`);

    // Clear rendering timeout from previous session
    if (renderingTimeoutId) {
      clearTimeout(renderingTimeoutId);
      renderingTimeoutId = null;
    }

    // Disable print button while new content loads
    const printBtn = document.getElementById("btn-print");
    if (printBtn) {
      printBtn.disabled = true;
      printBtn.setAttribute("aria-label", "Print (disabled while rendering)");
    }

    // Reload iframe to show new folder content
    const iframe = document.getElementById("preview-iframe");
    if (iframe) {
      updateLoadingMessage("Loading new folder content...");
      iframe.src = iframe.src; // Trigger reload
    }
  } catch (error) {
    console.error("Failed to switch folder:", error);
    showError("Folder Switch Failed", error.message);
  }
}

// ============================================================================
// Iframe API Access - Direct same-origin communication
// ============================================================================

/**
 * Get iframe's content window (same-origin access)
 */
function getIframeWindow() {
  const iframe = document.getElementById("preview-iframe");
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

  const pageInput = document.getElementById("page-input");
  const totalPagesEl = document.getElementById("total-pages");

  if (pageInput) {
    pageInput.value = currentPage;
    pageInput.max = totalPages;
  }

  if (totalPagesEl) {
    totalPagesEl.textContent = totalPages || "-";
  }

  // Update navigation button states
  updateNavigationButtons(currentPage, totalPages);
}

/**
 * Update navigation button enabled/disabled states
 */
function updateNavigationButtons(currentPage, totalPages) {
  const firstBtn = document.getElementById("btn-first");
  const prevBtn = document.getElementById("btn-prev");
  const nextBtn = document.getElementById("btn-next");
  const lastBtn = document.getElementById("btn-last");

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
    showError("Preview Not Ready", "Please wait for preview to finish loading.");
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
  const singleBtn = document.getElementById("btn-single");
  const twoColumnBtn = document.getElementById("btn-two-column");

  if (singleBtn) {
    singleBtn.classList.toggle("active", mode === "single");
  }

  if (twoColumnBtn) {
    twoColumnBtn.classList.toggle("active", mode === "two-column");
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

  if (zoom === "fit-width") {
    // Calculate fit-width zoom
    const doc = iframeWin.document;
    const firstPage = doc.querySelector(".pagedjs_page");
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
    showError("Preview Not Ready", "Please wait for preview to finish loading.");
    return;
  }

  const api = iframeWin.previewAPI;
  const isDebug = api.toggleDebugMode();

  // Update button state
  const debugBtn = document.getElementById("btn-debug");
  if (debugBtn) {
    if (isDebug) {
      debugBtn.classList.add("active");
    } else {
      debugBtn.classList.remove("active");
    }
  }

  showInfo("Debug Mode", `Debug mode ${isDebug ? "enabled" : "disabled"}`);
}

/**
 * Print the iframe content (save as PDF)
 * Accesses iframe's contentWindow to trigger browser print dialog
 */
function printPreview() {
  const iframeWin = getIframeWindow();
  if (!iframeWin) {
    showError("Print Failed", "Preview window is not available. Try refreshing the page.");
    return;
  }

  // Check if print button is disabled (belt-and-suspenders with keyboard shortcut check)
  const printBtn = document.getElementById("btn-print");
  if (printBtn && printBtn.disabled) {
    showError("Print Not Ready", "Please wait for rendering to complete.");
    return;
  }

  try {
    // Validate iframe is still attached and accessible
    if (!iframeWin.document || iframeWin.closed) {
      throw new Error("Preview window is no longer valid");
    }

    iframeWin.print();
    console.log("Print dialog opened");
  } catch (error) {
    console.error("Print failed:", error);

    // Provide specific, actionable error message
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    showError(
      "Print Error",
      `Unable to open print dialog: ${errorMsg}. Try refreshing the page or check browser popup settings.`
    );
  }
}

/**
 * Change the background color of the iframe body
 */
function changeBackgroundColor(color) {
  const iframeWin = getIframeWindow();
  if (!iframeWin) {
    return;
  }

  try {
    // Update the body background color
    if (iframeWin.document && iframeWin.document.body) {
      iframeWin.document.body.style.backgroundColor = color;
      console.log(`Background color changed to ${color}`);
    }
  } catch (error) {
    console.error("Failed to change background color:", error);
  }
}

/**
 * Update the toolbar title with the document title from iframe
 */
function updateDocumentTitle() {
  const iframeWin = getIframeWindow();
  const titleElement = document.getElementById("document-title");

  if (!titleElement) {
    return;
  }

  try {
    if (iframeWin && iframeWin.document && iframeWin.document.title) {
      const docTitle = iframeWin.document.title;
      titleElement.textContent = docTitle;
      console.log(`Document title set to: ${docTitle}`);
    }
  } catch (error) {
    console.error("Failed to update document title:", error);
  }
}

// ============================================================================
// Iframe Event Listeners
// ============================================================================

/**
 * Handle page change events from iframe
 */
function onPageChanged(event) {
  const { currentPage, totalPages } = event.detail;
  console.log(`Page changed: ${currentPage}/${totalPages}`);
  updatePageDisplay();
}

/**
 * Handle rendering complete event from iframe
 * This fires when Paged.js has finished rendering all pages
 */
function onRenderingComplete(event) {
  const { totalPages } = event.detail;
  console.log(`✓ Rendering complete: ${totalPages} pages`);

  // Hide loading overlay now that rendering is complete
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.remove("active");
  }

  // Fade in the iframe now that content is ready
  const iframe = document.getElementById("preview-iframe");
  if (iframe) {
    iframe.classList.add("ready");
  }

  // Update document title from iframe
  updateDocumentTitle();

  // Update UI with initial page state
  updatePageDisplay();

  // Apply default view mode (two-column)
  setViewMode("two-column");

  // Apply default zoom
  setZoom(1.0);

  // Enable print button now that rendering is complete
  const printBtn = document.getElementById("btn-print");
  if (printBtn) {
    printBtn.disabled = false;
    printBtn.setAttribute("aria-label", "Print preview (save as PDF)");
  }

  console.log("✓ Preview initialized and ready");
  showSuccess("Preview Ready", `${totalPages} pages loaded successfully`);
}

/**
 * Setup event listeners on iframe window
 */
function setupIframeEventListeners() {
  const iframeWin = getIframeWindow();
  if (!iframeWin) {
    console.error("Cannot setup iframe listeners - window not accessible");
    return;
  }

  // Listen for page change events
  iframeWin.addEventListener("pageChanged", onPageChanged);

  // Listen for rendering complete events
  iframeWin.addEventListener("renderingComplete", onRenderingComplete);

  console.log("✓ Iframe event listeners registered");
}

// ============================================================================
// Toolbar Control Initialization
// ============================================================================

/**
 * Exit the preview server
 */
async function exitPreviewServer() {
  try {
    // Show shutdown overlay immediately
    const shutdownOverlay = document.getElementById("shutdown-overlay");
    if (shutdownOverlay) {
      shutdownOverlay.classList.add("active");
    }

    // Call shutdown API
    const response = await fetch("/api/shutdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Shutdown failed: ${response.status}`);
    }

    console.log("Server shutdown initiated");
  } catch (error) {
    console.error("Failed to shutdown server:", error);
    showError("Shutdown Failed", error.message);

    // Hide shutdown overlay on error
    const shutdownOverlay = document.getElementById("shutdown-overlay");
    if (shutdownOverlay) {
      shutdownOverlay.classList.remove("active");
    }
  }
}

/**
 * Initialize toolbar button event listeners
 */
function initializeToolbarControls() {
  // Exit button
  const exitBtn = document.getElementById("btn-exit");
  if (exitBtn) {
    exitBtn.addEventListener("click", exitPreviewServer);
  }

  // Folder selection button
  const folderBtn = document.getElementById("btn-folder");
  if (folderBtn) {
    folderBtn.addEventListener("click", openFolderModal);
  }

  // Modal close button
  const closeBtn = document.getElementById("modal-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeFolderModal);
  }

  // "Open This Folder" button
  const openBtn = document.getElementById("btn-open-folder");
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      switchToFolder(currentPath);
    });
  }

  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("folder-modal");
      if (modal && modal.style.display === "flex") {
        closeFolderModal();
      }
    }
  });

  // Page navigation buttons
  const firstBtn = document.getElementById("btn-first");
  if (firstBtn) {
    firstBtn.addEventListener("click", goToFirstPage);
  }

  const prevBtn = document.getElementById("btn-prev");
  if (prevBtn) {
    prevBtn.addEventListener("click", goToPreviousPage);
  }

  const nextBtn = document.getElementById("btn-next");
  if (nextBtn) {
    nextBtn.addEventListener("click", goToNextPage);
  }

  const lastBtn = document.getElementById("btn-last");
  if (lastBtn) {
    lastBtn.addEventListener("click", goToLastPage);
  }

  // Page input
  const pageInput = document.getElementById("page-input");
  if (pageInput) {
    pageInput.addEventListener("change", (e) => {
      const page = parseInt(e.target.value, 10);
      if (!isNaN(page)) {
        goToPage(page);
      }
    });

    pageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const page = parseInt(e.target.value, 10);
        if (!isNaN(page)) {
          goToPage(page);
        }
      }
    });
  }

  // View mode buttons
  const singleBtn = document.getElementById("btn-single");
  if (singleBtn) {
    singleBtn.addEventListener("click", () => setViewMode("single"));
  }

  const twoColumnBtn = document.getElementById("btn-two-column");
  if (twoColumnBtn) {
    twoColumnBtn.addEventListener("click", () => setViewMode("two-column"));
  }

  // Zoom select
  const zoomSelect = document.getElementById("zoom-select");
  if (zoomSelect) {
    zoomSelect.addEventListener("change", (e) => {
      const value = e.target.value;

      if (value === "fit-width") {
        setZoom("fit-width");
      } else {
        const zoom = parseFloat(value);
        if (!isNaN(zoom)) {
          setZoom(zoom);
        }
      }
    });
  }

  // Debug mode button
  const debugBtn = document.getElementById("btn-debug");
  if (debugBtn) {
    debugBtn.addEventListener("click", toggleDebugMode);
  }

  // Print button
  const printBtn = document.getElementById("btn-print");
  if (printBtn) {
    printBtn.addEventListener("click", printPreview);
    // Start disabled - will be enabled when rendering completes
    printBtn.disabled = true;
  }

  // Background color button and picker
  const bgColorBtn = document.getElementById("btn-bg-color");
  const bgColorPicker = document.getElementById("bg-color-picker");

  if (bgColorBtn && bgColorPicker) {
    // When button is clicked, trigger the color picker
    bgColorBtn.addEventListener("click", () => {
      bgColorPicker.click();
    });

    // When color changes, update the iframe background
    bgColorPicker.addEventListener("input", (e) => {
      changeBackgroundColor(e.target.value);
    });
  }

  // Keyboard shortcut for print (Ctrl/Cmd+P)
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "p") {
      event.preventDefault();

      const printBtn = document.getElementById("btn-print");
      if (printBtn && printBtn.disabled) {
        showError("Print Not Ready", "Please wait for rendering to complete.");
        return;
      }

      printPreview();
    }
  });

  // Wait for iframe to load, then initialize
  const iframe = document.getElementById("preview-iframe");
  if (iframe) {
    iframe.addEventListener("load", onIframeLoad);
  }
}

/**
 * Handle iframe load event
 * Wait for Paged.js to finish rendering, then initialize
 */
function onIframeLoad() {
  // Clear any existing timeout from previous rendering
  if (renderingTimeoutId) {
    clearTimeout(renderingTimeoutId);
    renderingTimeoutId = null;
  }

  console.log("Iframe loaded, setting up event listeners...");
  updateLoadingMessage("Rendering pages...");

  // Show loading overlay while Paged.js renders
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.add("active");
  }

  // Hide iframe until rendering completes (will be shown by onRenderingComplete)
  const iframe = document.getElementById("preview-iframe");
  if (iframe) {
    iframe.classList.remove("ready");
  }

  // Setup event listeners - iframe will signal when ready via 'renderingComplete' event
  setupIframeEventListeners();

  // Set new timeout and store ID
  renderingTimeoutId = setTimeout(() => {
    const printBtn = document.getElementById("btn-print");
    if (printBtn && printBtn.disabled) {
      showError("Rendering Warning", "Preview rendering did not complete. Print may be incomplete.");
      printBtn.disabled = false;
    }
    renderingTimeoutId = null; // Clear ID after timeout fires
  }, 30000);

  console.log("✓ Waiting for renderingComplete event from iframe...");
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize preview client
 */
async function initializePreview() {
  try {
    console.log("Initializing preview...");
    updateLoadingMessage("Initializing preview...");

    // Show loading overlay while Paged.js is rendering
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.classList.add("active");
    }

    // Initialize toolbar controls
    initializeToolbarControls();

    // Set current folder from URL or default
    clientState.currentFolder = window.location.pathname.includes("/home")
      ? window.location.pathname
      : "/home";

    console.log("✓ Preview initialized");
  } catch (error) {
    console.error("Initialization failed:", error);
    showError("Initialization Error", error.message);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePreview);
} else {
  initializePreview();
}
