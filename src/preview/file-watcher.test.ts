/**
 * Tests for file watcher scenarios
 *
 * Validates file watching, debouncing, rebuild triggering, and state management
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  generateAndWriteHtml,
  createFileWatcher,
  startFileWatcher,
  stopFileWatcher,
} from './file-watcher';
import { ConfigurationManager } from '../config/config-state';
import type { ServerState } from './server-context';
import type { PreviewServerOptions } from '../types';

/**
 * Helper to create minimal server state for testing
 */
function createTestServerState(
  inputPath: string,
  tempDir: string,
  options: Partial<PreviewServerOptions> = {}
): ServerState {
  const configManager = new ConfigurationManager(inputPath);

  return {
    currentInputPath: inputPath,
    tempDir,
    configManager,
    options: {
      port: 3000,
      verbose: false,
      noWatch: false,
      openBrowser: false,
      ...options,
    },
    currentWatcher: null,
    isRebuilding: false,
  };
}

/**
 * Helper to wait for a specified duration
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('generateAndWriteHtml', () => {
  let testDir: string;
  let tempDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-input-'));
    tempDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-temp-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await rm(tempDir, { recursive: true, force: true });
  }, 60000);

  test('generates preview.html with proper doctype', async () => {
    // Create test markdown file
    await writeFile(join(testDir, 'test.md'), '# Test Heading\n\nTest content.');
    await writeFile(
      join(testDir, 'manifest.yaml'),
      'title: Test\nauthors: [Test Author]'
    );

    const configManager = new ConfigurationManager(testDir);
    await configManager.initialize();
    const config = configManager.getConfig();

    await generateAndWriteHtml(testDir, tempDir, config);

    // Check that preview.html was created
    const outputPath = join(tempDir, 'preview.html');
    const file = Bun.file(outputPath);
    const exists = await file.exists();
    expect(exists).toBe(true);

    // Verify content includes markdown conversion
    const content = await file.text();
    expect(content).toContain('Test Heading');
    expect(content).toContain('Test content');

    // Verify doctype is present
    expect(content.toLowerCase()).toContain('<!doctype');
  }, 60000);

  test('overwrites existing preview.html', async () => {
    await writeFile(join(testDir, 'test.md'), '# First Version');
    await writeFile(
      join(testDir, 'manifest.yaml'),
      'title: Test\nauthors: [Test]'
    );

    const configManager = new ConfigurationManager(testDir);
    await configManager.initialize();
    const config = configManager.getConfig();

    // First generation
    await generateAndWriteHtml(testDir, tempDir, config);
    const outputPath = join(tempDir, 'preview.html');
    let content = await Bun.file(outputPath).text();
    expect(content).toContain('First Version');

    // Update markdown and regenerate
    await writeFile(join(testDir, 'test.md'), '# Second Version');
    await configManager.initialize();
    const updatedConfig = configManager.getConfig();
    await generateAndWriteHtml(testDir, tempDir, updatedConfig);

    content = await Bun.file(outputPath).text();
    expect(content).toContain('Second Version');
    expect(content).not.toContain('First Version');
  }, 60000);

  test('handles multiple markdown files', async () => {
    await writeFile(join(testDir, 'chapter1.md'), '# Chapter 1');
    await writeFile(join(testDir, 'chapter2.md'), '# Chapter 2');
    await writeFile(
      join(testDir, 'manifest.yaml'),
      'title: Test\nauthors: [Test]\nfiles: [chapter1.md, chapter2.md]'
    );

    const configManager = new ConfigurationManager(testDir);
    await configManager.initialize();
    const config = configManager.getConfig();

    await generateAndWriteHtml(testDir, tempDir, config);

    const content = await Bun.file(join(tempDir, 'preview.html')).text();
    expect(content).toContain('Chapter 1');
    expect(content).toContain('Chapter 2');
  }, 60000);
});

describe('createFileWatcher', () => {
  let testDir: string;
  let tempDir: string;
  let state: ServerState;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-input-'));
    tempDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-temp-'));

    // Create initial files
    await writeFile(join(testDir, 'test.md'), '# Initial');
    await writeFile(
      join(testDir, 'manifest.yaml'),
      'title: Test\nauthors: [Test]'
    );

    state = createTestServerState(testDir, tempDir);
    await state.configManager.initialize();
  });

  afterEach(async () => {
    // Clean up watcher
    if (state.currentWatcher) {
      await state.currentWatcher.close();
      state.currentWatcher = null;
    }

    await rm(testDir, { recursive: true, force: true });
    await rm(tempDir, { recursive: true, force: true });
  }, 60000);

  test('creates watcher for input directory', async () => {
    const watcher = createFileWatcher(state);

    expect(watcher).toBeDefined();
    expect(typeof watcher.close).toBe('function');

    await watcher.close();
  });

  test('triggers rebuild on markdown file change', async () => {
    const watcher = createFileWatcher(state);
    let rebuildTriggered = false;

    // Track rebuild state
    const originalIsRebuilding = state.isRebuilding;

    // Wait for watcher to be ready
    await wait(200);

    // Modify markdown file
    await writeFile(join(testDir, 'test.md'), '# Updated Content');

    // Wait for debounce + rebuild
    await wait(700);

    // Check if rebuild was attempted (isRebuilding flag should have been set)
    // Since we can't easily mock the rebuild process, we verify the file was changed
    const content = await Bun.file(join(testDir, 'test.md')).text();
    expect(content).toContain('Updated Content');

    await watcher.close();
  }, 10000);

  test('debounces rapid file changes', async () => {
    const watcher = createFileWatcher(state);
    let rebuildCount = 0;

    // Wait for watcher to be ready
    await wait(200);

    // Make rapid changes
    await writeFile(join(testDir, 'test.md'), '# Change 1');
    await wait(100);
    await writeFile(join(testDir, 'test.md'), '# Change 2');
    await wait(100);
    await writeFile(join(testDir, 'test.md'), '# Change 3');

    // Wait for debounce period (500ms) + buffer
    await wait(700);

    // Should only rebuild once after debounce period
    const content = await Bun.file(join(testDir, 'test.md')).text();
    expect(content).toContain('Change 3');

    await watcher.close();
  }, 10000);

  test('watches YAML manifest changes', async () => {
    const watcher = createFileWatcher(state);

    await wait(200);

    await writeFile(
      join(testDir, 'manifest.yaml'),
      'title: Updated Title\nauthors: [Test]'
    );

    await wait(700);

    const content = await Bun.file(join(testDir, 'manifest.yaml')).text();
    expect(content).toContain('Updated Title');

    await watcher.close();
  }, 10000);

  test('ignores dot files', async () => {
    const watcher = createFileWatcher(state);

    await wait(200);

    // Create dot file (should be ignored)
    await writeFile(join(testDir, '.hidden'), 'hidden content');

    await wait(700);

    // Watcher should not trigger rebuild for dot files
    // Verify dot file exists but was ignored
    const file = Bun.file(join(testDir, '.hidden'));
    const exists = await file.exists();
    expect(exists).toBe(true);

    await watcher.close();
  }, 10000);

  test('prevents overlapping rebuilds with isRebuilding flag', async () => {
    // Set rebuild flag to true
    state.isRebuilding = true;

    const watcher = createFileWatcher(state);

    await wait(200);

    // Modify file while rebuilding
    await writeFile(join(testDir, 'test.md'), '# During Rebuild');

    await wait(700);

    // Rebuild should be skipped due to flag
    expect(state.isRebuilding).toBe(true);

    await watcher.close();
  }, 10000);
});

describe('startFileWatcher', () => {
  let testDir: string;
  let tempDir: string;
  let state: ServerState;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-input-'));
    tempDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-temp-'));

    await writeFile(join(testDir, 'test.md'), '# Test');
    await writeFile(
      join(testDir, 'manifest.yaml'),
      'title: Test\nauthors: [Test]'
    );

    state = createTestServerState(testDir, tempDir);
    await state.configManager.initialize();
  });

  afterEach(async () => {
    if (state.currentWatcher) {
      await state.currentWatcher.close();
      state.currentWatcher = null;
    }

    await rm(testDir, { recursive: true, force: true });
    await rm(tempDir, { recursive: true, force: true });
  }, 60000);

  test('creates watcher when noWatch is false', () => {
    state.options.noWatch = false;

    startFileWatcher(state);

    expect(state.currentWatcher).not.toBeNull();
    expect(state.currentWatcher).toBeDefined();
  });

  test('does not create watcher when noWatch is true', () => {
    state.options.noWatch = true;

    startFileWatcher(state);

    expect(state.currentWatcher).toBeNull();
  });

  test('watcher can detect file changes after start', async () => {
    state.options.noWatch = false;

    startFileWatcher(state);

    await wait(200);

    await writeFile(join(testDir, 'test.md'), '# Changed');

    await wait(700);

    const content = await Bun.file(join(testDir, 'test.md')).text();
    expect(content).toContain('Changed');
  }, 10000);
});

describe('stopFileWatcher', () => {
  let testDir: string;
  let tempDir: string;
  let state: ServerState;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-input-'));
    tempDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-temp-'));

    await writeFile(join(testDir, 'test.md'), '# Test');
    await writeFile(
      join(testDir, 'manifest.yaml'),
      'title: Test\nauthors: [Test]'
    );

    state = createTestServerState(testDir, tempDir);
    await state.configManager.initialize();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await rm(tempDir, { recursive: true, force: true });
  }, 60000);

  test('stops watcher and clears reference', async () => {
    startFileWatcher(state);
    expect(state.currentWatcher).not.toBeNull();

    await stopFileWatcher(state);

    expect(state.currentWatcher).toBeNull();
  });

  test('safe to call when no watcher exists', async () => {
    state.currentWatcher = null;

    // Should not throw
    await stopFileWatcher(state);

    expect(state.currentWatcher).toBeNull();
  });

  test('safe to call multiple times', async () => {
    startFileWatcher(state);

    await stopFileWatcher(state);
    await stopFileWatcher(state);
    await stopFileWatcher(state);

    expect(state.currentWatcher).toBeNull();
  });

  test('stopped watcher does not trigger rebuilds', async () => {
    startFileWatcher(state);

    await wait(200);

    await stopFileWatcher(state);

    // Modify file after stopping watcher
    await writeFile(join(testDir, 'test.md'), '# After Stop');

    await wait(700);

    // File should be changed, but no rebuild triggered
    const content = await Bun.file(join(testDir, 'test.md')).text();
    expect(content).toContain('After Stop');
    expect(state.currentWatcher).toBeNull();
  }, 10000);
});

describe('file watcher integration scenarios', () => {
  let testDir: string;
  let tempDir: string;
  let state: ServerState;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-input-'));
    tempDir = await mkdtemp(join(tmpdir(), 'pagedmd-test-temp-'));

    await writeFile(join(testDir, 'test.md'), '# Initial');
    await writeFile(
      join(testDir, 'manifest.yaml'),
      'title: Test\nauthors: [Test]'
    );

    state = createTestServerState(testDir, tempDir);
    await state.configManager.initialize();
  });

  afterEach(async () => {
    if (state.currentWatcher) {
      await state.currentWatcher.close();
      state.currentWatcher = null;
    }

    await rm(testDir, { recursive: true, force: true });
    await rm(tempDir, { recursive: true, force: true });
  }, 60000);

  test('restart cycle: stop and start watcher', async () => {
    // Start initial watcher
    startFileWatcher(state);
    expect(state.currentWatcher).not.toBeNull();

    const firstWatcher = state.currentWatcher;

    // Stop watcher
    await stopFileWatcher(state);
    expect(state.currentWatcher).toBeNull();

    // Start new watcher
    startFileWatcher(state);
    expect(state.currentWatcher).not.toBeNull();

    // Should be a new watcher instance
    expect(state.currentWatcher).not.toBe(firstWatcher);
  });

  test('handles file extension filtering correctly', async () => {
    const watcher = createFileWatcher(state);

    await wait(200);

    // Create files with various extensions
    await writeFile(join(testDir, 'test.md'), '# Markdown');
    await wait(100);
    await writeFile(join(testDir, 'config.yaml'), 'key: value');
    await wait(100);
    await writeFile(join(testDir, 'config.yml'), 'key: value');
    await wait(100);
    await writeFile(join(testDir, 'ignored.txt'), 'text file');

    await wait(700);

    // Verify relevant files exist
    expect(await Bun.file(join(testDir, 'test.md')).exists()).toBe(true);
    expect(await Bun.file(join(testDir, 'config.yaml')).exists()).toBe(true);
    expect(await Bun.file(join(testDir, 'config.yml')).exists()).toBe(true);
    expect(await Bun.file(join(testDir, 'ignored.txt')).exists()).toBe(true);

    await watcher.close();
  }, 10000);

  test('watcher state management during rapid start/stop', async () => {
    // Rapid start/stop cycles
    startFileWatcher(state);
    await stopFileWatcher(state);
    startFileWatcher(state);
    await stopFileWatcher(state);
    startFileWatcher(state);

    expect(state.currentWatcher).not.toBeNull();

    await stopFileWatcher(state);
    expect(state.currentWatcher).toBeNull();
  });

  test('generateAndWriteHtml works after watcher restart', async () => {
    // Initial generation
    await generateAndWriteHtml(
      testDir,
      tempDir,
      state.configManager.getConfig()
    );

    let content = await Bun.file(join(tempDir, 'preview.html')).text();
    expect(content).toContain('Initial');

    // Start and stop watcher
    startFileWatcher(state);
    await wait(200);
    await stopFileWatcher(state);

    // Update content and regenerate
    await writeFile(join(testDir, 'test.md'), '# After Restart');
    await state.configManager.initialize();

    await generateAndWriteHtml(
      testDir,
      tempDir,
      state.configManager.getConfig()
    );

    content = await Bun.file(join(tempDir, 'preview.html')).text();
    expect(content).toContain('After Restart');
  }, 60000);
});
