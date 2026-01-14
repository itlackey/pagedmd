// Bun text loader imports - CSS content inlined at build time
// Core styles (universal for any book)
import coreVariables from "../../assets/core/core-variables.css" with { type: "text" };
import coreTypography from "../../assets/core/core-typography.css" with { type: "text" };
import coreLayout from "../../assets/core/core-layout.css" with { type: "text" };
import coreComponents from "../../assets/core/core-components.css" with { type: "text" };

// Utility styles
import bookReset from "../../assets/core/book-reset.css" with { type: "text" };

// Plugin styles (TTRPG and Dimm City)
import ttrpgComponents from "../../assets/plugins/ttrpg-components.css" with { type: "text" };
import dimmCityComponents from "../../assets/plugins/dimm-city-components.css" with { type: "text" };

/**
 * Default styles for DC Book CLI
 * Bundled at build time using Bun's text loader
 *
 * This concatenates all CSS files in the correct order:
 * 1. Core Variables - Universal design tokens
 * 2. TTRPG Variables - Game-specific tokens (inherits core)
 * 3. Book Reset - Print-specific resets (DEPRECATED - uses legacy variables)
 * 4. Book Reset Compat - Compatibility layer mapping legacy → modern variables
 * 5. Core Typography - Universal typography baseline
 * 6. Core Layout - @page templates, auto-rules, directive markers
 * 7. Core Components - Universal callout system
 * 8. TTRPG Components - Game-specific components (stat blocks, etc.)
 * 9. Layouts - Layout utilities
 *
 * Note: Files are imported explicitly (not via @import statements)
 * to ensure proper inlining when bundled into HTML.
 *
 * Compatibility Layer:
 * The book-reset-compat.css file provides backward compatibility for
 * legacy CSS variables. It maps old variables (--primary-color, etc.)
 * to new unified variables (--color-text, etc.). This ensures existing
 * user stylesheets continue working during the migration period.
 *
 * Themes are loaded via manifest.yaml:
 * - classic.css (default)
 * - modern.css
 * - dark.css
 * - parchment.css
 * - zine.css
 * - dimm-city.css (now uses unified core-* variables)
 * - bw.css (black & white theme for draft printing)
 */
export const defaultStyles = `
${coreVariables}
${bookReset}
${coreTypography}
${coreLayout}
${coreComponents}
`;
