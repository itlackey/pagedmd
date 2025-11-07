/**
 * Print the iframe content on the current page
 */
function printIframe() {
    const iframe = document.querySelector('iframe');
    if (!iframe) {
        console.warn('No iframe found on page');
        return;
    }

    // Print the iframe's content window directly
    iframe.contentWindow.print();
}

// Set up keyboard shortcut (Ctrl/Cmd + P)
document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        printIframe();
    }
});

// Export for manual use
window.printPreviewToPDF = printIframe;
