#!/usr/bin/env bun
/**
 * Convert PagedJS CSS to Vivliostyle-compatible CSS
 * Automated conversion helper with manual review suggestions
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { basename, dirname, join } from 'path';

interface Conversion {
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  description: string;
}

// Automatic conversions
const AUTO_CONVERSIONS: Conversion[] = [
  {
    pattern: /var\(--pagedjs-pagebox-width\)/g,
    replacement: '/* TODO: Define width in @page { size: } */',
    description: 'PagedJS page width variable'
  },
  {
    pattern: /var\(--pagedjs-pagebox-height\)/g,
    replacement: '/* TODO: Define height in @page { size: } */',
    description: 'PagedJS page height variable'
  },
  {
    pattern: /var\(--pagedjs-margin-top\)/g,
    replacement: '/* TODO: Use margin-top in @page rule */',
    description: 'PagedJS margin-top variable'
  },
  {
    pattern: /var\(--pagedjs-margin-bottom\)/g,
    replacement: '/* TODO: Use margin-bottom in @page rule */',
    description: 'PagedJS margin-bottom variable'
  },
  {
    pattern: /var\(--pagedjs-margin-left\)/g,
    replacement: '/* TODO: Use margin-left in @page rule */',
    description: 'PagedJS margin-left variable'
  },
  {
    pattern: /var\(--pagedjs-margin-right\)/g,
    replacement: '/* TODO: Use margin-right in @page rule */',
    description: 'PagedJS margin-right variable'
  },
];

// Patterns to remove (PagedJS runtime classes)
const REMOVE_PATTERNS: RegExp[] = [
  /\.pagedjs_page[^{]*\{[^}]*\}/gs,
  /\.pagedjs_page_content[^{]*\{[^}]*\}/gs,
  /\.pagedjs_margin[^{]*\{[^}]*\}/gs,
  /\.pagedjs_bleed[^{]*\{[^}]*\}/gs,
  /\.pagedjs_marks[^{]*\{[^}]*\}/gs,
  /\.pagedjs_sheet[^{]*\{[^}]*\}/gs,
  /\.pagedjs_area[^{]*\{[^}]*\}/gs,
];

// Patterns that need manual review
const REVIEW_PATTERNS = [
  {
    pattern: /:root\s*\{[^}]*--pagedjs[^}]*\}/gs,
    message: 'PagedJS custom properties in :root',
    action: 'Move page-related values to @page rule'
  },
  {
    pattern: /break-inside:\s*avoid-(page|column|region)/g,
    message: 'Specific avoid-* value',
    action: 'Consider using just "avoid" - Vivliostyle treats all avoid-* values as avoid'
  },
];

interface ConversionResult {
  original: string;
  converted: string;
  changes: string[];
  needsReview: string[];
}

function convertCSS(cssContent: string): ConversionResult {
  let converted = cssContent;
  const changes: string[] = [];
  const needsReview: string[] = [];

  // Apply automatic conversions
  for (const { pattern, replacement, description } of AUTO_CONVERSIONS) {
    pattern.lastIndex = 0;
    if (pattern.test(converted)) {
      pattern.lastIndex = 0;
      converted = converted.replace(pattern, replacement as string);
      changes.push(`Converted: ${description}`);
    }
  }

  // Remove PagedJS runtime class rules
  for (const pattern of REMOVE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(converted)) {
      pattern.lastIndex = 0;
      converted = converted.replace(pattern, '/* Removed PagedJS runtime class */');
      changes.push('Removed PagedJS runtime class rule');
    }
  }

  // Check for patterns needing manual review
  for (const { pattern, message, action } of REVIEW_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(converted)) {
      needsReview.push(`${message}\n    Action: ${action}`);
    }
  }

  // Clean up multiple empty lines
  converted = converted.replace(/\n{3,}/g, '\n\n');

  // Add Vivliostyle compatibility header
  if (changes.length > 0) {
    const header = `/**
 * Converted from PagedJS to Vivliostyle
 * Generated: ${new Date().toISOString()}
 * 
 * Review TODOs and verify output matches original.
 */

`;
    converted = header + converted;
  }

  return {
    original: cssContent,
    converted,
    changes,
    needsReview
  };
}

function addVivliostyleEnhancements(css: string): string {
  let enhanced = css;

  // Add env() suggestion if running headers exist
  if (/string-set:/.test(css) && !/env\s*\(/.test(css)) {
    enhanced += `

/* Vivliostyle Enhancement: Consider using env() for titles
@page {
  @top-left {
    content: env(pub-title);  // Publication title
  }
  @top-right {
    content: env(doc-title);  // Current document title
  }
}
*/`;
  }

  // Add :nth() suggestion if :first is used
  if (/@page\s*:first/.test(css)) {
    enhanced += `

/* Vivliostyle Enhancement: :nth() for multi-document books
   
   :first only matches the first page of the FIRST document.
   Use :nth(1) to match the first page of EACH document:
   
   @page :nth(1) {
     // Styles for first page of each chapter
   }
   
   @page chapter:nth(1) {
     counter-increment: chapter;
   }
*/`;
  }

  return enhanced;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: bun run convert-pagedjs-css.ts <input.css> [output.css]

Converts PagedJS-specific CSS to Vivliostyle-compatible CSS.

Options:
  --enhance    Add Vivliostyle enhancement suggestions
  --dry-run    Show changes without writing file

Examples:
  bun run convert-pagedjs-css.ts styles/print.css
  bun run convert-pagedjs-css.ts styles/print.css styles/vivliostyle.css
  bun run convert-pagedjs-css.ts styles/print.css --enhance --dry-run
`);
  process.exit(0);
}

const inputFile = args[0];
const enhance = args.includes('--enhance');
const dryRun = args.includes('--dry-run');

// Determine output file
let outputFile = args.find(a => !a.startsWith('--') && a !== inputFile);
if (!outputFile && !dryRun) {
  const dir = dirname(inputFile);
  const name = basename(inputFile, '.css');
  outputFile = join(dir, `${name}.vivliostyle.css`);
}

if (!existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

try {
  const content = readFileSync(inputFile, 'utf-8');
  const result = convertCSS(content);

  let finalCSS = result.converted;
  if (enhance) {
    finalCSS = addVivliostyleEnhancements(finalCSS);
  }

  console.log('\n' + '='.repeat(60));
  console.log('PagedJS to Vivliostyle CSS Conversion');
  console.log('='.repeat(60));

  if (result.changes.length > 0) {
    console.log('\n✅ Changes made:');
    result.changes.forEach(c => console.log(`  • ${c}`));
  } else {
    console.log('\nNo automatic conversions needed.');
  }

  if (result.needsReview.length > 0) {
    console.log('\n⚠️  Manual review needed:');
    result.needsReview.forEach(r => console.log(`  • ${r}`));
  }

  if (dryRun) {
    console.log('\n--- DRY RUN: Converted CSS ---');
    console.log(finalCSS);
    console.log('--- END DRY RUN ---');
  } else if (outputFile) {
    writeFileSync(outputFile, finalCSS);
    console.log(`\n✅ Output written to: ${outputFile}`);
  }

  console.log('\nNext steps:');
  console.log('  1. Review TODO comments in the converted CSS');
  console.log('  2. Run validate-css.ts on the output');
  console.log('  3. Test with: npx @vivliostyle/cli preview');

} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
