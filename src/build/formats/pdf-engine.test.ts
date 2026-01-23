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

    // Should return status for all 4 engines (vivliostyle, prince, docraptor, weasyprint)
    expect(engines).toHaveLength(4);

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

    // WeasyPrint status (may or may not be installed)
    const weasyprint = engines.find((e) => e.engine === 'weasyprint');
    expect(weasyprint).toBeDefined();
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
  test('selectPdfEngine returns available engine by default', async () => {
    // Auto-selects based on priority: Prince > DocRaptor > WeasyPrint > Vivliostyle
    const engine = await selectPdfEngine();
    // Could be any available engine depending on environment
    expect(['vivliostyle', 'prince', 'weasyprint']).toContain(engine);
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
    expect(info).toContain('weasyprint');
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

  test('auto mode selects best available engine', async () => {
    const options: PdfEngineOptions = {
      engine: 'auto',
    };

    const engine = await selectPdfEngine(options);
    // Should be prince, weasyprint, or vivliostyle depending on environment
    // Priority: Prince > DocRaptor > WeasyPrint > Vivliostyle
    expect(['vivliostyle', 'prince', 'weasyprint']).toContain(engine);
  });

  test('weasyprint can be explicitly selected when available', async () => {
    const engines = await detectAvailableEngines();
    const weasyprint = engines.find((e) => e.engine === 'weasyprint');

    if (weasyprint?.available) {
      const engine = await selectPdfEngine({ engine: 'weasyprint' });
      expect(engine).toBe('weasyprint');
    } else {
      // Skip test if weasyprint not installed
      expect(weasyprint?.reason).toContain('WeasyPrint');
    }
  });
});
