/**
 * Dimm City Markdown-it Plugin
 * Custom markdown extensions for Dimm City Operations Manual
 *
 * Features:
 * - Stat blocks with inline syntax
 * - Dice notation rendering
 * - Cross-references
 * - Trait/ability callouts
 * - District badges
 * - Challenge rating notation
 * - Roll prompts
 */

import type MarkdownIt from 'markdown-it';
import { StateInline, Token } from 'markdown-it/index.js';


export interface TTRPGPluginOptions {
    statBlocks: boolean;
    diceNotation: boolean;
    crossReferences: boolean;
    traitCallouts: boolean;
    challengeRatings: boolean;
}

// ============================================================================
// 1. STAT BLOCK INLINE SYNTAX
// ============================================================================

/**
 * Parses inline stat blocks: `{HP:12 DMG:3}`
 * Renders as styled stat display
 */
function parseStatBlock(state: StateInline, silent: boolean): boolean {
    const start = state.pos;
    const max = state.posMax;

    // Check for opening {HP:
    if (state.src.charCodeAt(start) !== 0x7b /* { */) return false;
    if (start + 3 >= max) return false;
    if (state.src.slice(start, start + 4) !== "{HP:") return false;

    // Find closing }
    let pos = start + 4;
    let foundEnd = false;
    while (pos < max) {
        if (state.src.charCodeAt(pos) === 0x7d /* } */) {
            foundEnd = true;
            break;
        }
        pos++;
    }

    if (!foundEnd) return false;

    const content = state.src.slice(start + 1, pos);

    if (!silent) {
        const token = state.push("stat_block", "span", 0);
        token.markup = "{}";
        token.content = content;
    }

    state.pos = pos + 1;
    return true;
}

function renderStatBlock(tokens: Token[], idx: number): string {
    const content = tokens[idx].content as string;
    const parts = content.split(/\s+/);

    let html = '<span class="stat-block">';
    parts.forEach((part) => {
        const [label, value] = part.split(":");
        if (label && value) {
            html += `<span class="stat-item"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></span>`;
        }
    });
    html += "</span>";

    return html;
}

// ============================================================================
// 2. DICE NOTATION RENDERING
// ============================================================================

/**
 * Parses dice notation: `1d6`, `2d10+5`, `3d8-2`
 * Renders as interactive dice display
 */
interface DiceMeta {
    count: string;
    sides: string;
    modifier: string;
}

function parseDiceNotation(state: StateInline, silent: boolean): boolean {
    const start = state.pos;
    const max = state.posMax;

    // Match pattern: NdN, NdN+N, NdN-N
    const re = /^(\d+)d(\d+)([+-]\d+)?/;
    const match = state.src.slice(start).match(re);

    if (!match) return false;

    const fullMatch = match[0];

    // Don't match if it's part of a word
    if (start > 0 && /\w/.test(state.src[start - 1])) return false;
    if (
        start + fullMatch.length < max &&
        /\w/.test(state.src[start + fullMatch.length])
    )
        return false;

    if (!silent) {
        const token = state.push("dice_notation", "span", 0);
        token.content = fullMatch;
        const meta: DiceMeta = {
            count: match[1],
            sides: match[2],
            modifier: match[3] || "",
        };
        token.meta = meta;
    }

    state.pos = start + fullMatch.length;
    return true;
}

function renderDiceNotation(tokens: Token[], idx: number): string {
    const meta = tokens[idx].meta as DiceMeta;
    const content = tokens[idx].content as string;

    return `<span class="dice-notation" data-dice="${content}" title="Roll ${content}"><span class="dice-icon">🎲</span><span class="dice-formula">${content}</span></span>`;
}

// ============================================================================
// 3. CROSS-REFERENCE SYNTAX
// ============================================================================

/**
 * Parses cross-references: `@[TYPE:identifier]` or `@[identifier]`
 * Examples: @[NPC:investigator], @[shadowkin], @[ITEM:flickerblade]
 */
function parseCrossReference(state: StateInline, silent: boolean): boolean {
    const start = state.pos;
    const max = state.posMax;

    // Check for @[
    if (state.src.charCodeAt(start) !== 0x40 /* @ */) return false;
    if (start + 1 >= max) return false;
    if (state.src.charCodeAt(start + 1) !== 0x5b /* [ */) return false;

    // Find closing ]
    let pos = start + 2;
    let foundEnd = false;
    while (pos < max) {
        if (state.src.charCodeAt(pos) === 0x5d /* ] */) {
            foundEnd = true;
            break;
        }
        pos++;
    }

    if (!foundEnd) return false;

    const content = state.src.slice(start + 2, pos);

    // Parse TYPE:identifier or just identifier
    const parts = content.split(":");
    let type = "ref";
    let identifier = content;

    if (parts.length === 2) {
        type = parts[0].toLowerCase();
        identifier = parts[1];
    }

    if (!silent) {
        const token = state.push("cross_reference", "a", 0);
        token.attrSet("class", `xref xref-${type}`);
        token.attrSet("data-ref-type", type);
        token.attrSet("data-ref-id", identifier);
        token.content = identifier;
    }

    state.pos = pos + 1;
    return true;
}

function renderCrossReference(tokens: Token[], idx: number): string {
    const type = tokens[idx].attrGet("data-ref-type") ?? "ref";
    const id = tokens[idx].attrGet("data-ref-id") ?? "";
    const className = tokens[idx].attrGet("class") ?? "";

    // Generate link based on type
    const href = `#${type}-${id.toLowerCase().replace(/\s+/g, "-")}`;

    return `<a href="${href}" class="${className}" data-ref-type="${type}" data-ref-id="${id}" title="See ${type}: ${id}">${id}</a>`;
}

// ============================================================================
// 4. TRAIT/ABILITY CALLOUTS
// ============================================================================

/**
 * Parses trait callouts: `::trait[Shadow Step]` or `::ability[Umbral Strike]`
 * Renders as styled callout boxes
 */
interface TraitMeta {
    type: string;
}

function parseTraitCallout(state: StateInline, silent: boolean): boolean {
    const start = state.pos;
    const max = state.posMax;

    // Check for ::trait[ or ::ability[
    if (state.src.charCodeAt(start) !== 0x3a /* : */) return false;
    if (start + 1 >= max || state.src.charCodeAt(start + 1) !== 0x3a)
        return false;

    const match = state.src
        .slice(start)
        .match(/^::(trait|ability)\[([^\]]+)\]/);

    if (!match) return false;

    const fullMatch = match[0];
    const calloutType = match[1];
    const content = match[2];

    if (!silent) {
        const token = state.push("trait_callout", "span", 0);
        token.markup = `::${calloutType}`;
        const meta: TraitMeta = { type: calloutType };
        token.meta = meta;
        token.content = content;
    }

    state.pos = start + fullMatch.length;
    return true;
}

function renderTraitCallout(tokens: Token[], idx: number): string {
    const { type } = tokens[idx].meta as TraitMeta;
    const content = tokens[idx].content as string;

    const icon = type === "trait" ? "⚡" : "💫";

    return `<span class="callout callout-${type}"><span class="callout-icon">${icon}</span><span class="callout-content">${content}</span></span>`;
}


// ============================================================================
// 6. CHALLENGE RATING NOTATION
// ============================================================================

/**
 * Parses challenge ratings: `CR:3`, `CR:12`
 * Renders as styled challenge rating display
 */
function parseChallengeRating(state: StateInline, silent: boolean): boolean {
    const start = state.pos;
    const max = state.posMax;

    // Match CR:N pattern
    const match = state.src.slice(start).match(/^CR:(\d+)/);

    if (!match) return false;

    const fullMatch = match[0];
    const rating = match[1];

    // Check context
    if (start > 0 && /\w/.test(state.src[start - 1])) return false;

    if (!silent) {
        const token = state.push("challenge_rating", "span", 0);
        token.content = rating;
    }

    state.pos = start + fullMatch.length;
    return true;
}

function renderChallengeRating(tokens: Token[], idx: number): string {
    const rating = tokens[idx].content as string;
    const difficulty =
        parseInt(rating, 10) <= 3
            ? "easy"
            : parseInt(rating, 10) <= 7
              ? "medium"
              : parseInt(rating, 10) <= 12
                ? "hard"
                : "deadly";

    return `<span class="challenge-rating cr-${difficulty}" data-cr="${rating}"><span class="cr-label">CR</span><span class="cr-value">${rating}</span></span>`;
}




// ============================================================================
// PLUGIN MAIN FUNCTION
// ============================================================================

const defaultOptions: TTRPGPluginOptions = {
    statBlocks: true,
    diceNotation: true,
    crossReferences: true,
    traitCallouts: true,
    challengeRatings: true
};

function ttrpgPlugin(
    md: MarkdownIt,
    options: Partial<TTRPGPluginOptions> = {},
): void {
    const config: TTRPGPluginOptions = {
        ...defaultOptions,
        ...options,
    };

    // Register inline parsers
    if (config.statBlocks) {
        md.inline.ruler.before("emphasis", "stat_block", parseStatBlock);
        md.renderer.rules.stat_block = renderStatBlock;
    }

    if (config.diceNotation) {
        md.inline.ruler.before("emphasis", "dice_notation", parseDiceNotation);
        md.renderer.rules.dice_notation = renderDiceNotation;
    }

    if (config.crossReferences) {
        md.inline.ruler.before(
            "emphasis",
            "cross_reference",
            parseCrossReference,
        );
        md.renderer.rules.cross_reference = renderCrossReference;
    }

    if (config.traitCallouts) {
        md.inline.ruler.before("emphasis", "trait_callout", parseTraitCallout);
        md.renderer.rules.trait_callout = renderTraitCallout;
    }


    if (config.challengeRatings) {
        md.inline.ruler.before(
            "emphasis",
            "challenge_rating",
            parseChallengeRating,
        );
        md.renderer.rules.challenge_rating = renderChallengeRating;
    }

}

// ============================================================================
// EXPORTS
// ============================================================================

export default ttrpgPlugin;
