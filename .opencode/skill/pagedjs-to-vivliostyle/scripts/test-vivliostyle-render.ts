#!/usr/bin/env bun
/**
 * Test Vivliostyle rendering and compare outputs
 * Helps verify migration from PagedJS produces similar results
 */

import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';
import { $ } from 'bun';

interface TestConfig {
  input: string;
  config?: string;
  output: string;
  size?: string;
  theme?: string;
}

interface TestResult {
  success: boolean;
  input: string;
  output: string;
  duration: number;
  pageCount?: number;
  error?: string;
}

async function checkVivliostyleCLI(): Promise<boolean> {
  try {
    await $`npx @vivliostyle/cli --version`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function runPreview(config: TestConfig): Promise<void> {
  const args: string[] = ['preview'];

  if (config.config) {
    args.push('-c', config.config);
  } else {
    args.push(config.input);
  }

  if (config.size) {
    args.push('-s', config.size);
  }

  if (config.theme) {
    args.push('-T', config.theme);
  }

  console.log(`\nStarting preview: npx @vivliostyle/cli ${args.join(' ')}`);
  console.log('Press Ctrl+C to stop preview\n');

  await $`npx @vivliostyle/cli ${args}`;
}

async function runBuild(config: TestConfig): Promise<TestResult> {
  const startTime = Date.now();
  const args: string[] = ['build'];

  if (config.config) {
    args.push('-c', config.config);
  } else {
    args.push(config.input);
  }

  args.push('-o', config.output);

  if (config.size) {
    args.push('-s', config.size);
  }

  if (config.theme) {
    args.push('-T', config.theme);
  }

  try {
    const result = await $`npx @vivliostyle/cli ${args}`.text();
    const duration = Date.now() - startTime;

    // Try to extract page count from output
    const pageMatch = result.match(/(\d+)\s+pages?/i);
    const pageCount = pageMatch ? parseInt(pageMatch[1]) : undefined;

    return {
      success: true,
      input: config.input,
      output: config.output,
      duration,
      pageCount
    };
  } catch (error) {
    return {
      success: false,
      input: config.input,
      output: config.output,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function findInputFiles(dir: string): string[] {
  const files: string[] = [];
  const validExtensions = ['.html', '.htm', '.md', '.xhtml'];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isFile() && validExtensions.includes(extname(entry).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function printResults(results: TestResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('Test Results');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    console.log('\n✅ Successful builds:');
    for (const result of successful) {
      const pages = result.pageCount ? ` (${result.pageCount} pages)` : '';
      console.log(`  ${basename(result.input)} → ${basename(result.output)}${pages}`);
      console.log(`    Duration: ${(result.duration / 1000).toFixed(2)}s`);
    }
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed builds:');
    for (const result of failed) {
      console.log(`  ${basename(result.input)}`);
      console.log(`    Error: ${result.error}`);
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${successful.length} | Failed: ${failed.length}`);
}

function printHelp(): void {
  console.log(`
Vivliostyle Rendering Test Tool

Usage: bun run test-vivliostyle-render.ts <command> [options]

Commands:
  preview <input>        Open Vivliostyle preview for input file
  build <input> <output> Build PDF from input file
  test <directory>       Test all HTML/MD files in directory
  check                  Check if Vivliostyle CLI is installed

Options:
  -c, --config <file>    Path to vivliostyle.config.js
  -s, --size <size>      Page size (A4, A5, letter, etc.)
  -T, --theme <css>      Theme CSS file path

Examples:
  # Preview a document
  bun run test-vivliostyle-render.ts preview index.html

  # Build a PDF
  bun run test-vivliostyle-render.ts build chapters/01.md output.pdf

  # Use config file
  bun run test-vivliostyle-render.ts build -c vivliostyle.config.js book.pdf

  # Test all files in a directory
  bun run test-vivliostyle-render.ts test ./chapters/

  # Check installation
  bun run test-vivliostyle-render.ts check
`);
}

// Parse command line arguments
function parseArgs(args: string[]): { command: string; options: Record<string, string>; positional: string[] } {
  const options: Record<string, string> = {};
  const positional: string[] = [];
  let command = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (i === 0 && !arg.startsWith('-')) {
      command = arg;
      continue;
    }

    if (arg === '-c' || arg === '--config') {
      options.config = args[++i];
    } else if (arg === '-s' || arg === '--size') {
      options.size = args[++i];
    } else if (arg === '-T' || arg === '--theme') {
      options.theme = args[++i];
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { command, options, positional };
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const { command, options, positional } = parseArgs(args);

  switch (command) {
    case 'check': {
      console.log('Checking Vivliostyle CLI installation...');
      const installed = await checkVivliostyleCLI();
      if (installed) {
        console.log('✅ Vivliostyle CLI is installed');
        await $`npx @vivliostyle/cli --version`;
      } else {
        console.log('❌ Vivliostyle CLI not found');
        console.log('\nInstall with: npm install -g @vivliostyle/cli');
        process.exit(1);
      }
      break;
    }

    case 'preview': {
      const input = positional[0] || options.config;
      if (!input) {
        console.error('Error: No input file specified');
        process.exit(1);
      }

      const config: TestConfig = {
        input,
        config: options.config,
        output: '',
        size: options.size,
        theme: options.theme
      };

      await runPreview(config);
      break;
    }

    case 'build': {
      const input = positional[0];
      const output = positional[1] || 'output.pdf';

      if (!input && !options.config) {
        console.error('Error: No input file specified');
        process.exit(1);
      }

      const config: TestConfig = {
        input: input || '',
        config: options.config,
        output,
        size: options.size,
        theme: options.theme
      };

      console.log('Building PDF...');
      const result = await runBuild(config);
      printResults([result]);

      process.exit(result.success ? 0 : 1);
      break;
    }

    case 'test': {
      const dir = positional[0] || '.';
      const outputDir = positional[1] || './test-output';

      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const files = findInputFiles(dir);

      if (files.length === 0) {
        console.log(`No HTML or Markdown files found in ${dir}`);
        process.exit(0);
      }

      console.log(`Found ${files.length} files to test`);

      const results: TestResult[] = [];

      for (const file of files) {
        const name = basename(file, extname(file));
        const output = join(outputDir, `${name}.pdf`);

        console.log(`\nBuilding: ${basename(file)}`);

        const config: TestConfig = {
          input: file,
          output,
          size: options.size,
          theme: options.theme
        };

        const result = await runBuild(config);
        results.push(result);
      }

      printResults(results);

      const failed = results.filter(r => !r.success);
      process.exit(failed.length > 0 ? 1 : 0);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
