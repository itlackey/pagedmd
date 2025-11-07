/**
 * Core Directives Markdown-it Plugin
 *
 * Universal auto-rules and explicit directives for professional book layout
 *
 * Auto-rules:
 * - H1 headings automatically start chapters on right pages
 * - Horizontal rules (---) become page breaks
 * - Blockquotes with [!type] syntax become callouts
 * - Images with .full-bleed class get .auto-art-page class
 *
 * Explicit directives (HTML comments):
 * - <!-- @page: template --> - Apply page template (chapter, art, body, etc.)
 * - <!-- @break --> - Create page break
 * - <!-- @spread: left|right|blank --> - Force page spread
 * - <!-- @columns: 1|2|3 --> - Set column layout
 *
 * This plugin uses a core rule to process tokens after parsing but before rendering.
 */

import type MarkdownIt from 'markdown-it';
import type { StateCore } from 'markdown-it/lib/rules_core/state_core.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import type { DirectiveType, PageTemplateName } from '../../types.ts';
import { warn } from '../../utils/logger.ts';

/**
 * Regular expression to match directive HTML comments
 * Matches: <!-- @directive --> or <!-- @directive: value -->
 * Value can include letters, numbers, hyphens, and underscores
 */
const DIRECTIVE_REGEX = /<!--\s*@(\w+)(?::\s*([\w-]+))?\s*-->/;

/**
 * Valid page template names
 * Includes both universal templates and common book sections
 */
const VALID_TEMPLATES: PageTemplateName[] = [
    'chapter', 'art', 'body', 'appendix', 'frontmatter',
    'cover', 'title-page', 'credits', 'toc', 'glossary', 'blank'
];

/**
 * Valid spread values
 */
const VALID_SPREADS = ['left', 'right', 'blank'];

/**
 * Valid column counts
 */
const VALID_COLUMNS = [1, 2, 3];

/**
 * Valid callout types with their default titles
 * Industry-standard callout types used across technical docs, textbooks, manuals
 */
const CALLOUT_TYPES = {
    note: 'Note',
    tip: 'Tip',
    warning: 'Warning',
    danger: 'Danger',
    info: 'Info',
} as const;

type CalloutType = keyof typeof CALLOUT_TYPES;

/**
 * Callout data extracted from blockquote
 */
interface CalloutData {
    type: CalloutType;
    title: string;
    firstParagraphIdx: number; // Index of the paragraph containing [!type]
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Find closest match from a list of valid options
 */
function findClosestMatch(input: string, validOptions: readonly string[]): string | null {
    let closestMatch: string | null = null;
    let minDistance = Infinity;

    for (const option of validOptions) {
        const distance = levenshteinDistance(input.toLowerCase(), option.toLowerCase());
        if (distance < minDistance && distance <= 2) { // Max 2 edits for suggestion
            minDistance = distance;
            closestMatch = option;
        }
    }

    return closestMatch;
}

/**
 * Parse a directive from HTML comment content
 * Returns null if not a directive or if invalid
 */
function parseDirective(content: string): { type: DirectiveType; value: string | number | null } | null {
    const match = content.match(DIRECTIVE_REGEX);
    if (!match) return null;

    const [, type, rawValue] = match;
    const value = rawValue?.trim() || null;

    // Validate and normalize directives
    switch (type) {
        case 'page':
            if (!value) {
                throw new Error(
                    `@page directive requires a template name.\n` +
                    `Usage: <!-- @page: template -->\n` +
                    `Valid templates: ${VALID_TEMPLATES.join(', ')}\n` +
                    `Example: <!-- @page: art -->`
                );
            }
            if (!VALID_TEMPLATES.includes(value as PageTemplateName)) {
                const suggestion = findClosestMatch(value, VALID_TEMPLATES);
                const didYouMean = suggestion ? `\nDid you mean "${suggestion}"?` : '';
                throw new Error(
                    `Invalid page template "${value}".${didYouMean}\n` +
                    `Valid templates: ${VALID_TEMPLATES.join(', ')}\n` +
                    `Example: <!-- @page: chapter -->`
                );
            }
            return { type: 'page', value };

        case 'break':
            return { type: 'break', value: null };

        case 'spread':
            if (!value) {
                throw new Error(
                    `@spread directive requires a value.\n` +
                    `Usage: <!-- @spread: direction -->\n` +
                    `Valid values: ${VALID_SPREADS.join(', ')}\n` +
                    `Example: <!-- @spread: right -->`
                );
            }
            if (!VALID_SPREADS.includes(value)) {
                const suggestion = findClosestMatch(value, VALID_SPREADS);
                const didYouMean = suggestion ? `\nDid you mean "${suggestion}"?` : '';
                throw new Error(
                    `Invalid spread value "${value}".${didYouMean}\n` +
                    `Valid values: ${VALID_SPREADS.join(', ')}\n` +
                    `Example: <!-- @spread: left -->`
                );
            }
            return { type: 'spread', value };

        case 'columns':
            if (!value) {
                throw new Error(
                    `@columns directive requires a value.\n` +
                    `Usage: <!-- @columns: number -->\n` +
                    `Valid values: ${VALID_COLUMNS.join(', ')}\n` +
                    `Example: <!-- @columns: 2 -->`
                );
            }
            const columnCount = parseInt(value, 10);
            if (!VALID_COLUMNS.includes(columnCount)) {
                throw new Error(
                    `Invalid column count "${value}".\n` +
                    `Valid values: ${VALID_COLUMNS.join(', ')}\n` +
                    `Example: <!-- @columns: 2 -->\n` +
                    `Note: Columns must be a number (1, 2, or 3)`
                );
            }
            return { type: 'columns', value: columnCount };

        default:
            // Unknown directive type - warn with helpful message
            const validDirectives = ['page', 'break', 'spread', 'columns'];
            const suggestion = findClosestMatch(type, validDirectives);
            const didYouMean = suggestion ? ` Did you mean "@${suggestion}"?` : '';
            warn(
                `Unknown directive "@${type}".${didYouMean}\n` +
                `Valid directives: ${validDirectives.map(d => `@${d}`).join(', ')}\n` +
                `See docs/markdown-style-guide.md for usage examples.`
            );
            return null;
    }
}

/**
 * Create a marker div for a directive
 * These are minimal, invisible elements that carry data attributes for CSS
 */
function createMarkerDiv(type: DirectiveType, value: string | number | null): string {
    const baseStyle = 'height:0;line-height:0;overflow:hidden;position:absolute;width:0;';

    switch (type) {
        case 'page':
            return `<div class="directive-marker" data-directive="page" data-value="${value}" style="${baseStyle}"></div>\n`;

        case 'break':
            // Manual break gets a marker to distinguish from HR auto-rule
            // This allows explicit-beats-implicit logic to work correctly
            return '<div class="page-break" data-directive="break"></div>\n';

        case 'spread':
            return `<div class="directive-marker" data-spread="${value}" style="${baseStyle}"></div>\n`;

        case 'columns':
            return `<div class="directive-marker" data-columns="${value}" style="${baseStyle}"></div>\n`;

        default:
            return '';
    }
}

/**
 * Parse callout syntax from blockquote content
 * Supports: [!type] or [!type] Custom Title
 * The first text token determines the type and optional title
 */
function parseCalloutSyntax(tokens: Token[], blockquoteIdx: number): CalloutData | null {
    // Look for the first paragraph_open after blockquote_open
    let paragraphIdx = -1;
    for (let i = blockquoteIdx + 1; i < tokens.length; i++) {
        if (tokens[i].type === 'paragraph_open') {
            paragraphIdx = i;
            break;
        }
        if (tokens[i].type === 'blockquote_close') {
            break;
        }
    }

    if (paragraphIdx === -1) return null;

    // Check if the next token is inline
    const inlineToken = tokens[paragraphIdx + 1];
    if (!inlineToken || inlineToken.type !== 'inline' || !inlineToken.children || inlineToken.children.length === 0) {
        return null;
    }

    // The first child should be a text token with [!type]
    const firstChild = inlineToken.children[0];
    if (firstChild.type !== 'text') return null;

    const firstText = firstChild.content.trim();

    // Match [!type] or [!type] Custom Title
    const match = firstText.match(/^\[!(\w+)\](?:\s+(.+))?$/);

    if (!match) return null;

    const type = match[1].toLowerCase() as CalloutType;
    if (!(type in CALLOUT_TYPES)) return null;

    // Use custom title from first text if provided, otherwise use default
    const customTitle = match[2]?.trim();
    const title = customTitle || CALLOUT_TYPES[type];

    return {
        type,
        title,
        firstParagraphIdx: paragraphIdx,
    };
}

/**
 * Transform blockquote tokens into callout HTML
 */
function transformBlockquoteToCallout(
    tokens: Token[],
    startIdx: number,
    calloutData: CalloutData,
    md: MarkdownIt
): void {
    const { type, title, firstParagraphIdx } = calloutData;

    // Find the blockquote_close index
    let endIdx = startIdx + 1;
    let depth = 1;
    while (endIdx < tokens.length && depth > 0) {
        if (tokens[endIdx].type === 'blockquote_open') depth++;
        if (tokens[endIdx].type === 'blockquote_close') depth--;
        endIdx++;
    }

    // Modify the first paragraph's inline token to remove [!type] text token and following softbreak
    const inlineToken = tokens[firstParagraphIdx + 1];
    if (inlineToken && inlineToken.type === 'inline' && inlineToken.children) {
        // Remove first child (text with [!type]) and second child (softbreak) if it exists
        if (inlineToken.children.length > 0 && inlineToken.children[0].type === 'text') {
            inlineToken.children.shift(); // Remove [!type] text

            // If the next token is a softbreak, remove it too
            if (inlineToken.children.length > 0 && inlineToken.children[0].type === 'softbreak') {
                inlineToken.children.shift(); // Remove softbreak
            }
        }

        // Update the inline token's content to match its children
        inlineToken.content = inlineToken.children.map(c => c.content).join('');

        // If no children left, remove the entire paragraph
        if (inlineToken.children.length === 0) {
            tokens.splice(firstParagraphIdx, 3); // Remove paragraph_open, inline, paragraph_close
            endIdx -= 3; // Adjust end index
        }
    }

    // Collect all remaining content tokens
    const contentTokens: Token[] = [];
    for (let i = startIdx + 1; i < endIdx - 1; i++) {
        contentTokens.push(tokens[i]);
    }

    // Render content tokens to HTML
    let contentHtml = '';
    if (contentTokens.length > 0) {
        contentHtml = md.renderer.render(contentTokens, md.options, {});
    }

    // Build callout HTML structure
    const calloutHtml = `<aside class="callout callout-${type}" role="note" aria-label="${type}">
<div class="callout-title">
<div class="callout-icon"></div>
<h3 class="callout-title-text">${md.utils.escapeHtml(title)}</h3>
</div>
<div class="callout-content">
${contentHtml}</div>
</aside>\n`;

    // Replace blockquote tokens with a single html_block
    const htmlToken = new tokens[startIdx].constructor('html_block', '', 0);
    htmlToken.content = calloutHtml;
    htmlToken.map = tokens[startIdx].map;

    // Remove all blockquote tokens and replace with html_block
    tokens.splice(startIdx, endIdx - startIdx, htmlToken);
}

/**
 * Check if an explicit directive exists near a given token index
 * This implements "explicit-beats-implicit" logic
 *
 * Looks for @page or @break directives within a proximity window
 * to prevent auto-rules from conflicting with manual directives
 *
 * Note: HR page breaks (from auto-rules) don't count as explicit directives.
 * Only manual <!-- @page: --> or <!-- @break --> directives trigger this.
 *
 * Window size of 10 tokens allows for several paragraphs between
 * directive and element (each paragraph = 3 tokens: open, inline, close)
 */
function hasExplicitDirectiveNearby(tokens: Token[], startIdx: number, windowSize: number = 10): boolean {
    // Check BACKWARDS only - explicit directives that come BEFORE an element
    // affect it, but directives AFTER (e.g., after a page break) should not
    // Also check a small window forward (2 tokens) to catch directives on same line
    const minIdx = Math.max(0, startIdx - windowSize);
    const maxIdx = Math.min(tokens.length - 1, startIdx + 2); // Small forward window

    for (let i = minIdx; i <= maxIdx; i++) {
        const token = tokens[i];

        // Check if this is a marker div created from an explicit directive
        if ((token.type === 'html_block' || token.type === 'html_inline') && token.content) {
            // Check for explicit directive markers
            // - data-directive="page" = explicit @page directive
            // - data-directive="break" = explicit @break directive
            // Note: page-break divs WITHOUT data-directive are from HR auto-rules
            if (token.content.includes('data-directive="page"') ||
                token.content.includes('data-directive="break"') ||
                token.content.match(/<!--\s*@(page|break)/)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Core rule that processes tokens to apply auto-rules and directives
 *
 * This runs after the markdown is parsed into tokens but before rendering.
 * It modifies tokens in place to add classes or transform them.
 */
function applyAutoRules(state: StateCore): boolean {
    const tokens = state.tokens;
    const md = state.md;

    // Track old container syntax usage for deprecation warnings
    const deprecationStats = { containerCount: 0, containerTypes: new Set<string>() };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Detect old container syntax (markdown-it-container tokens)
        if (token.type.startsWith('container_') && token.type.endsWith('_open')) {
            const containerType = token.type.replace(/^container_/, '').replace(/_open$/, '');
            deprecationStats.containerCount++;
            deprecationStats.containerTypes.add(containerType);
        }
    }

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Parse explicit directives from HTML comments FIRST
        // This must happen before auto-rules so hasExplicitDirectiveNearby works correctly
        if (token.type === 'html_block' || token.type === 'html_inline') {
            try {
                const directive = parseDirective(token.content);
                if (directive) {
                    // Replace the HTML comment with a marker div
                    token.content = createMarkerDiv(directive.type, directive.value);
                }
            } catch (error) {
                // Validation errors - throw with helpful message
                if (error instanceof Error) {
                    throw new Error(`Directive parsing error at line ${token.map?.[0] ?? 'unknown'}: ${error.message}`);
                }
                throw error;
            }
        }

        // Auto-rule for H1 headings
        // Add 'auto-chapter-start' class to make H1s start on right pages
        // Skip if explicit directive exists nearby
        if (token.type === 'heading_open' && token.tag === 'h1') {
            if (!hasExplicitDirectiveNearby(tokens, i)) {
                // Get existing class attribute or create empty string
                const existingClass = token.attrGet('class') || '';
                const newClass = existingClass
                    ? `${existingClass} auto-chapter-start`
                    : 'auto-chapter-start';
                token.attrSet('class', newClass);
            }
        }

        // Auto-rule for horizontal rules
        // Replace HR tokens with page break divs
        if (token.type === 'hr') {
            // Transform HR into an html_block containing page break div
            token.type = 'html_block';
            token.tag = '';
            token.content = '<div class="page-break"></div>\n';
        }

        // Auto-rule for full-bleed images
        // Detect images with 'full-bleed' class and add 'auto-art-page' class
        if (token.type === 'inline' && token.children) {
            for (const child of token.children) {
                if (child.type === 'image') {
                    // Check if image has 'full-bleed' class in its attributes
                    const classAttr = child.attrGet('class') || '';
                    if (classAttr.includes('full-bleed')) {
                        // Add 'auto-art-page' class
                        const newClass = classAttr
                            ? `${classAttr} auto-art-page`
                            : 'auto-art-page';
                        child.attrSet('class', newClass);
                    }
                }
            }
        }

        // Transform blockquotes with [!type] into callouts
        if (token.type === 'blockquote_open') {
            const calloutData = parseCalloutSyntax(tokens, i);
            if (calloutData) {
                transformBlockquoteToCallout(tokens, i, calloutData, md);
                // Don't increment i - we replaced multiple tokens with one
                continue;
            }
        }
    }

    // Return true to continue processing
    return true;
}

/**
 * Core Directives Plugin
 *
 * Registers the auto-rules processor as a core rule.
 * Core rules run after parsing but before rendering.
 */
function coreDirectivesPlugin(md: MarkdownIt): void {
    // Register the core rule
    // Using 'push' adds it to the end of the core rules chain
    md.core.ruler.push('core_auto_rules', applyAutoRules);
}

export default coreDirectivesPlugin;
