#!/usr/bin/env bun
/**
 * Validate CSS for Vivliostyle compatibility
 * Checks for PagedJS-specific patterns and suggests conversions
 */

import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  line: number;
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  file: string;
  issues: ValidationIssue[];
  isValid: boolean;
}

// PagedJS-specific patterns to detect
const PAGEDJS_PATTERNS = [
  {
    pattern: /--pagedjs-[\w-]+/g,
    message: 'PagedJS custom property detected',
    type: 'error' as const,
    suggestion: 'Replace with standard CSS or @page properties'
  },
  {
    pattern: /\.pagedjs_[\w-]+/g,
    message: 'PagedJS generated class selector detected',
    type: 'error' as const,
    suggestion: 'Remove - these are runtime-generated classes'
  },
  {
    pattern: /Paged\.registerHandlers/g,
    message: 'PagedJS JavaScript handler detected',
    type: 'error' as const,
    suggestion: 'Convert to VFM plugin or pre-processing script'
  },
  {
    pattern: /window\.PagedConfig/g,
    message: 'PagedJS configuration detected',
    type: 'error' as const,
    suggestion: 'Use vivliostyle.config.js instead'
  },
];

// Patterns that need attention but may work
const WARNING_PATTERNS = [
  {
    pattern: /break-inside:\s*avoid-(page|column|region)/g,
    message: 'Specific avoid-* value used',
    type: 'warning' as const,
    suggestion: 'Vivliostyle treats all avoid-* as "avoid"'
  },
  {
    pattern: /@page\s*:first\s*\{/g,
    message: ':first page selector',
    type: 'info' as const,
    suggestion: 'In multi-doc books, :first only matches first page of first document. Use :nth(1) for first page of each document.'
  },
  {
    pattern: /position:\s*running\s*\([^)]+\)/g,
    message: 'Running element detected',
    type: 'info' as const,
    suggestion: 'Ensure the element with position:running() exists in HTML output from VFM'
  },
];

// Valid Vivliostyle-specific features
const VIVLIOSTYLE_FEATURES = [
  /env\s*\(\s*(pub-title|doc-title)\s*\)/g,
  /@page\s*:nth\s*\(/g,
  /float-reference:\s*(page|column|region)/g,
  /crop-offset:/g,
  /margin-(inside|outside):/g,
  /repeat-on-break:/g,
];

function validateCSS(cssContent: string, filename: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const lines = cssContent.split('\n');

  // Check each line
  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for PagedJS patterns
    for (const { pattern, message, type, suggestion } of PAGEDJS_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        issues.push({
          type,
          line: lineNum,
          message,
          suggestion
        });
      }
    }

    // Check for warning patterns
    for (const { pattern, message, type, suggestion } of WARNING_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        issues.push({
          type,
          line: lineNum,
          message,
          suggestion
        });
      }
    }
  });

  // Check for Vivliostyle features (informational)
  for (const pattern of VIVLIOSTYLE_FEATURES) {
    pattern.lastIndex = 0;
    if (pattern.test(cssContent)) {
      issues.push({
        type: 'info',
        line: 0,
        message: `Vivliostyle-specific feature detected: ${pattern.source}`,
      });
    }
  }

  // Check for required @page rule
  if (!/@page\s*\{/.test(cssContent) && !/@page\s*:/.test(cssContent)) {
    issues.push({
      type: 'warning',
      line: 0,
      message: 'No @page rule found',
      suggestion: 'Add @page rule to define page size and margins'
    });
  }

  return {
    file: filename,
    issues,
    isValid: !issues.some(i => i.type === 'error')
  };
}

function printResults(result: ValidationResult): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`File: ${result.file}`);
  console.log(`Status: ${result.isValid ? '✅ Valid' : '❌ Issues Found'}`);
  console.log('='.repeat(60));

  if (result.issues.length === 0) {
    console.log('No issues found.');
    return;
  }

  const errors = result.issues.filter(i => i.type === 'error');
  const warnings = result.issues.filter(i => i.type === 'warning');
  const infos = result.issues.filter(i => i.type === 'info');

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    for (const issue of errors) {
      console.log(`  Line ${issue.line}: ${issue.message}`);
      if (issue.suggestion) {
        console.log(`    → ${issue.suggestion}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    for (const issue of warnings) {
      console.log(`  Line ${issue.line}: ${issue.message}`);
      if (issue.suggestion) {
        console.log(`    → ${issue.suggestion}`);
      }
    }
  }

  if (infos.length > 0) {
    console.log('\nℹ️  INFO:');
    for (const issue of infos) {
      const lineInfo = issue.line > 0 ? `Line ${issue.line}: ` : '';
      console.log(`  ${lineInfo}${issue.message}`);
      if (issue.suggestion) {
        console.log(`    → ${issue.suggestion}`);
      }
    }
  }

  console.log(`\nSummary: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`);
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: bun run validate-css.ts <css-file> [css-file2] ...

Validates CSS files for Vivliostyle compatibility and identifies
PagedJS-specific patterns that need conversion.

Examples:
  bun run validate-css.ts styles/print.css
  bun run validate-css.ts styles/*.css
`);
  process.exit(0);
}

let hasErrors = false;

for (const filepath of args) {
  if (!existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    hasErrors = true;
    continue;
  }

  try {
    const content = readFileSync(filepath, 'utf-8');
    const result = validateCSS(content, basename(filepath));
    printResults(result);

    if (!result.isValid) {
      hasErrors = true;
    }
  } catch (error) {
    console.error(`Error reading ${filepath}:`, error);
    hasErrors = true;
  }
}

process.exit(hasErrors ? 1 : 0);
