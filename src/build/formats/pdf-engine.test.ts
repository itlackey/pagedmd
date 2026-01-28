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

    // Should return status for all 3 engines (weasyprint, prince, docraptor)
    expect(engines).toHaveLength(3);

    // WeasyPrint status (should be installed via postinstall)
    const weasyprint = engines.find((e) => e.engine === 'weasyprint');
    expect(weasyprint).toBeDefined();
    // WeasyPrint should be available if postinstall ran correctly
    if (weasyprint?.available) {
      expect(weasyprint.version).toContain('WeasyPrint');
    }

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
  test('selectPdfEngine returns available engine by default', async () => {
    // Auto-selects based on priority: Prince > DocRaptor > WeasyPrint
    const engine = await selectPdfEngine();
    // Could be any available engine depending on environment
    expect(['prince', 'weasyprint']).toContain(engine);
  });

  test('selectPdfEngine respects explicit WeasyPrint choice', async () => {
    const engines = await detectAvailableEngines();
    const weasyprint = engines.find((e) => e.engine === 'weasyprint');

    if (weasyprint?.available) {
      const engine = await selectPdfEngine({ engine: 'weasyprint' });
      expect(engine).toBe('weasyprint');
    } else {
      // Skip test if weasyprint not installed - should not happen in normal setup
      console.log('Skipping test: WeasyPrint not available');
    }
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
    expect(info).toContain('weasyprint');
    expect(info).toContain('prince');
    expect(info).toContain('docraptor');
    expect(info).toContain('Default:');
  }, 30000); // Increase timeout for engine detection
});

describe('Engine Options', () => {
  test('options are passed correctly to weasyprint', async () => {
    const engines = await detectAvailableEngines();
    const weasyprint = engines.find((e) => e.engine === 'weasyprint');

    if (weasyprint?.available) {
      const options: PdfEngineOptions = {
        engine: 'weasyprint',
        timeout: 60000,
        debug: true,
        verbose: true,
        pressReady: true,
      };

      // This should not throw
      const engine = await selectPdfEngine(options);
      expect(engine).toBe('weasyprint');
    } else {
      console.log('Skipping test: WeasyPrint not available');
    }
  });

  test('auto mode selects best available engine', async () => {
    const options: PdfEngineOptions = {
      engine: 'auto',
    };

    const engine = await selectPdfEngine(options);
    // Should be prince or weasyprint depending on environment
    // Priority: Prince > DocRaptor > WeasyPrint
    expect(['prince', 'weasyprint']).toContain(engine);
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
