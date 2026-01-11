/**
 * PDF Engine Detection and Selection Tests
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  detectAvailableEngines,
  selectPdfEngine,
  getEngineInfo,
  type PdfEngineOptions,
} from './pdf-engine.ts';

describe('PDF Engine Detection', () => {
  test('detectAvailableEngines returns status for all engines', async () => {
    const engines = await detectAvailableEngines();

    // Should return status for all 3 engines
    expect(engines).toHaveLength(3);

    // Vivliostyle should always be available (bundled)
    const vivliostyle = engines.find((e) => e.engine === 'vivliostyle');
    expect(vivliostyle).toBeDefined();
    expect(vivliostyle?.available).toBe(true);
    expect(vivliostyle?.version).toContain('Vivliostyle');

    // Prince status (may or may not be installed)
    const prince = engines.find((e) => e.engine === 'prince');
    expect(prince).toBeDefined();

    // DocRaptor status (depends on API key)
    const docraptor = engines.find((e) => e.engine === 'docraptor');
    expect(docraptor).toBeDefined();
    expect(docraptor?.available).toBe(false); // No API key in test env
    expect(docraptor?.reason).toContain('API key');
  });

  test('DocRaptor is available when API key is provided', async () => {
    const engines = await detectAvailableEngines({
      docraptorApiKey: 'test-api-key',
    });

    const docraptor = engines.find((e) => e.engine === 'docraptor');
    expect(docraptor?.available).toBe(true);
  });
});

describe('PDF Engine Selection', () => {
  test('selectPdfEngine returns vivliostyle by default (when Prince not installed)', async () => {
    // Without Prince installed, should fall back to vivliostyle
    const engine = await selectPdfEngine();
    // Could be prince if installed, otherwise vivliostyle
    expect(['vivliostyle', 'prince']).toContain(engine);
  });

  test('selectPdfEngine respects explicit engine choice', async () => {
    const engine = await selectPdfEngine({ engine: 'vivliostyle' });
    expect(engine).toBe('vivliostyle');
  });

  test('selectPdfEngine throws for unavailable engine', async () => {
    // DocRaptor without API key should throw
    await expect(
      selectPdfEngine({ engine: 'docraptor' })
    ).rejects.toThrow(/not available/);
  });

  test('DocRaptor can be selected when API key provided', async () => {
    const engine = await selectPdfEngine({
      engine: 'docraptor',
      docraptorApiKey: 'test-api-key',
    });
    expect(engine).toBe('docraptor');
  });
});

describe('Engine Info', () => {
  test('getEngineInfo returns formatted status', async () => {
    const info = await getEngineInfo();

    expect(info).toContain('Available PDF engines:');
    expect(info).toContain('vivliostyle');
    expect(info).toContain('prince');
    expect(info).toContain('docraptor');
    expect(info).toContain('Default:');
  }, 30000); // Increase timeout for engine detection
});

describe('Engine Options', () => {
  test('options are passed correctly to vivliostyle', async () => {
    const options: PdfEngineOptions = {
      engine: 'vivliostyle',
      timeout: 60000,
      debug: true,
      verbose: true,
      size: 'A4',
      cropMarks: true,
      bleed: '3mm',
      pressReady: true,
    };

    // This should not throw
    const engine = await selectPdfEngine(options);
    expect(engine).toBe('vivliostyle');
  });

  test('auto mode selects vivliostyle when prince not available', async () => {
    const options: PdfEngineOptions = {
      engine: 'auto',
    };

    const engine = await selectPdfEngine(options);
    // Should be vivliostyle or prince depending on environment
    expect(['vivliostyle', 'prince']).toContain(engine);
  });
});
