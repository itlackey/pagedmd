/**
 * Preview wrapper utilities
 *
 * Injects Paged.js polyfill into HTML for offline paginated viewing
 */
import previewInterfaceCss from "./interface.css" with  {type: 'text'};
import previewInterfaceJs from "./interface.js" with  {type: 'text'};


/**
 * Inject Paged.js polyfill script tags into HTML head
 *
 * Adds Paged.js polyfill before </head> tag to enable client-side pagination
 * Same pattern used in preview server routes.ts:666-672
 *
 * @param html HTML content to inject polyfill into
 * @returns HTML with polyfill script tags injected
 * @throws Error if HTML is missing </head> tag or assets are invalid
 */
export function injectPagedJsPolyfill(html: string): string {
  // Validate input HTML has required structure
  if (!html.includes('</head>')) {
    throw new Error('HTML is missing required </head> tag for polyfill injection');
  }

  // Validate that imported assets exist and are non-empty
  if (!previewInterfaceCss || typeof previewInterfaceCss !== 'string') {
    throw new Error('Preview interface CSS failed to load or is invalid');
  }

  if (!previewInterfaceJs || typeof previewInterfaceJs !== 'string') {
    throw new Error('Preview interface JavaScript failed to load or is invalid');
  }

  // Validate assets have actual content (not just whitespace)
  if (previewInterfaceCss.trim().length === 0) {
    throw new Error('Preview interface CSS is empty');
  }

  if (previewInterfaceJs.trim().length === 0) {
    throw new Error('Preview interface JavaScript is empty');
  }

  const polyfillScript = `
    <script>
      // Disable auto mode - we'll initialize manually
      window.PagedConfig = {
        auto: false
      };
    </script>
    <script src="/paged.polyfill.js"></script>
    <style>${previewInterfaceCss}</style>
    <script>
      ${previewInterfaceJs}
    </script>
  `;

  // Inject before closing </head> tag
  const injectedHtml = html.replace('</head>', `${polyfillScript}</head>`);

  // Verify injection occurred (paranoid check)
  if (injectedHtml === html) {
    throw new Error('Failed to inject polyfill script - HTML unchanged after replace operation');
  }

  return injectedHtml;
}
