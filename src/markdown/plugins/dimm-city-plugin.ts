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
import container from 'markdown-it-container';


export interface DimmCityPluginOptions {
    districtBadges: boolean;
    rollPrompts: boolean;
}

// ============================================================================
// DISTRICT BADGES
// ============================================================================

/**
 * Parses district badges: `#TechD`, `#EntD`, `#CommD`, `#ArcD`, `#Dark`
 * Renders as styled district badges
 */
interface DistrictMeta {
    name: string;
}

function parseDistrictBadge(state: StateInline, silent: boolean): boolean {
    const start = state.pos;
    const max = state.posMax;

    // Check for #
    if (state.src.charCodeAt(start) !== 0x23 /* # */) return false;

    // Check if preceded by whitespace or start of line
    if (start > 0 && !/\s/.test(state.src[start - 1])) return false;

    const districts = {
        TechD: "Tech District",
        EntD: "Entertainment District",
        CommD: "Commercial District",
        MarketD: "Market District",
        ArcD: "Archive District",
        Dark: "The Dark",
        TheDark: "The Dark",
    };

    let matched: { code: string; name: string; length: number } | null = null;
    for (const [code, name] of Object.entries(districts)) {
        if (state.src.slice(start + 1, start + 1 + code.length) === code) {
            // Check if followed by non-word character or end
            const endPos = start + 1 + code.length;
            if (endPos >= max || !/\w/.test(state.src[endPos])) {
                matched = { code, name, length: code.length };
                break;
            }
        }
    }

    if (!matched) return false;

    if (!silent) {
        const token = state.push("district_badge", "span", 0);
        token.content = matched.code;
        const meta: DistrictMeta = { name: matched.name };
        token.meta = meta;
    }

    state.pos = start + 1 + matched.length;
    return true;
}

function renderDistrictBadge(tokens: Token[], idx: number): string {
    const code = tokens[idx].content as string;
    const { name } = tokens[idx].meta as DistrictMeta;

    return `<span class="district-badge district-${code.toLowerCase()}" title="${name}">${code}</span>`;
}

// ============================================================================
// 7. ROLL PROMPTS
// ============================================================================

/**
 * Enhances "ROLL A DIE!" text with special styling
 */
function parseRollPrompt(state: StateInline, silent: boolean): boolean {
    const start = state.pos;
    const max = state.posMax;

    const phrases = ["ROLL A DIE!", "ROLL THE DIE", "ROLL A DIE"];

    let matched: string | null = null;
    for (const phrase of phrases) {
        if (state.src.slice(start, start + phrase.length) === phrase) {
            matched = phrase;
            break;
        }
    }

    if (!matched) return false;

    if (!silent) {
        const token = state.push("roll_prompt", "span", 0);
        token.content = matched;
    }

    state.pos = start + matched.length;
    return true;
}

function renderRollPrompt(tokens: Token[], idx: number): string {
    const content = tokens[idx].content as string;

    return `<span class="roll-prompt" title="Time to roll!"><span class="roll-icon">🎲</span><span class="roll-text">${content}</span></span>`;
}
// ============================================================================
// PLUGIN MAIN FUNCTION
// ============================================================================

const defaultOptions: DimmCityPluginOptions = {
    districtBadges: true,
    rollPrompts: true,
};

function dimmCityPlugin(
    md: MarkdownIt,
    options: Partial<DimmCityPluginOptions> = {},
): void {
    const config: DimmCityPluginOptions = {
        ...defaultOptions,
        ...options,
    };

    md
        .use(container, 'specialty')
        .use(container, 'learning-path')
        .use(container, 'aug', {
            validate: (params: string) => params.trim().split(' ', 2)[0] === 'aug',
            render: (tokens: { [x: string]: { nesting: number; }; }, idx: string | number) => {
                if (tokens[idx].nesting === 1) {
                    return '<div class="aug" data-augmented-ui>\n';
                } else {
                    return '</div>\n';
                }
            },
        })
        .use(container, 'aug-page', {
            validate: (params: string) => params.trim().split(' ', 2)[0] === 'aug-page',
            render: (tokens: { [x: string]: { nesting: number; }; }, idx: string | number) => {
                if (tokens[idx].nesting === 1) {
                    return '<div class="page aug" data-augmented-ui>\n';
                } else {
                    return '</div>\n';
                }
            },
        })
        .use(container, 'ability-continued', {
            validate: (params: string) =>
                params.trim().split(' ', 2)[0] === 'ability-continued',
            render: (tokens: { [x: string]: { nesting: number; }; }, idx: string | number) => {
                if (tokens[idx].nesting === 1) {
                    return '<div class="wrapper item ability continued">\n';
                } else {
                    return '</div>\n';
                }
            },
        })
        .use(container, 'ability', {
            validate: (params: string) => params.trim().split(' ', 2)[0] === 'ability',
            render: (tokens: { [x: string]: { nesting: number; }; }, idx: string | number) => {
                if (tokens[idx].nesting === 1) {
                    return '<div class="wrapper item ability">\n';
                } else {
                    return '</div>\n';
                }
            },
        })
        .use(container, 'item', {
            validate: (params: string) => params.trim().split(' ', 2)[0] === 'item',
            render: (tokens: { [x: string]: { nesting: number; }; }, idx: string | number) => {
                if (tokens[idx].nesting === 1) {
                    return '<div class="wrapper item">\n';
                } else {
                    return '</div>\n';
                }
            },
        });

    if (config.districtBadges) {
        md.inline.ruler.before(
            "emphasis",
            "district_badge",
            parseDistrictBadge,
        );
        md.renderer.rules.district_badge = renderDistrictBadge;
    }


    if (config.rollPrompts) {
        md.inline.ruler.before("emphasis", "roll_prompt", parseRollPrompt);
        md.renderer.rules.roll_prompt = renderRollPrompt;
    }

}

// ============================================================================
// EXPORTS
// ============================================================================

export default dimmCityPlugin;
