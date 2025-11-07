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
 */
export function injectPagedJsPolyfill(html: string): string {
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
  return html.replace('</head>', `${polyfillScript}</head>`);
}
