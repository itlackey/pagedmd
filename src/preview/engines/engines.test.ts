/**
 * Tests for Preview Engine System
 */

import { test, expect, describe, beforeEach } from 'bun:test';
import {
  registerEngine,
  getEngine,
  getAllEngines,
  getDefaultEngine,
  getEngineOrDefault,
  isEngineAvailable,
  getAvailableEngineIds,
  clearRegistry,
  initializeRegistry,
} from './registry';
import { pagedJsEngine } from './pagedjs-engine';
import { vivliostyleEngine } from './vivliostyle-engine';

describe('Preview Engine Registry', () => {
  beforeEach(() => {
    clearRegistry();
    initializeRegistry();
  });

  test('initializes with both engines registered', () => {
    const engines = getAllEngines();
    expect(engines.length).toBe(2);
    expect(engines.map(e => e.id)).toContain('pagedjs');
    expect(engines.map(e => e.id)).toContain('vivliostyle');
  });

  test('returns pagedjs as default engine (higher priority)', () => {
    const defaultEngine = getDefaultEngine();
    expect(defaultEngine.id).toBe('pagedjs');
  });

  test('can get engine by ID', () => {
    const pagedjs = getEngine('pagedjs');
    const vivliostyle = getEngine('vivliostyle');

    expect(pagedjs?.id).toBe('pagedjs');
    expect(vivliostyle?.id).toBe('vivliostyle');
  });

  test('returns undefined for unknown engine', () => {
    const unknown = getEngine('unknown' as any);
    expect(unknown).toBeUndefined();
  });

  test('getEngineOrDefault returns requested engine', () => {
    const engine = getEngineOrDefault('vivliostyle');
    expect(engine.id).toBe('vivliostyle');
  });

  test('getEngineOrDefault falls back to default', () => {
    const engine = getEngineOrDefault('unknown' as any);
    expect(engine.id).toBe('pagedjs');
  });

  test('isEngineAvailable returns correct status', () => {
    expect(isEngineAvailable('pagedjs')).toBe(true);
    expect(isEngineAvailable('vivliostyle')).toBe(true);
    expect(isEngineAvailable('unknown' as any)).toBe(false);
  });

  test('getAvailableEngineIds returns all available engines', () => {
    const ids = getAvailableEngineIds();
    expect(ids).toContain('pagedjs');
    expect(ids).toContain('vivliostyle');
    expect(ids.length).toBe(2);
  });
});

describe('Paged.js Engine', () => {
  test('has correct metadata', () => {
    expect(pagedJsEngine.id).toBe('pagedjs');
    expect(pagedJsEngine.name).toBe('Paged.js');
    expect(pagedJsEngine.version).toBeDefined();
    expect(pagedJsEngine.description).toBeDefined();
  });

  test('provides default settings', () => {
    const settings = pagedJsEngine.getDefaultSettings();
    expect(settings.bookMode).toBe(false);
    expect(settings.renderAllPages).toBe(true);
    expect(settings.spread).toBe('auto');
    expect(settings.debugMode).toBe(false);
  });

  test('injects polyfill scripts into HTML', () => {
    const html = '<html><head></head><body>Content</body></html>';
    const settings = pagedJsEngine.getDefaultSettings();
    const result = pagedJsEngine.injectEngineScripts(html, settings);

    expect(result.html).toContain('paged.polyfill.js');
    expect(result.html).toContain('interface.js');
    expect(result.html).toContain('PagedConfig');
  });

  test('throws if HTML is missing head tag', () => {
    const html = '<html><body>Content</body></html>';
    const settings = pagedJsEngine.getDefaultSettings();

    expect(() => pagedJsEngine.injectEngineScripts(html, settings)).toThrow();
  });

  test('builds viewer URL correctly', () => {
    const url = pagedJsEngine.buildViewerUrl({
      projectId: 'test',
      previewBasePath: '/preview/',
      settings: pagedJsEngine.getDefaultSettings(),
    });

    expect(url).toBe('/preview/preview.html');
  });

  test('adds cache bust to viewer URL', () => {
    const url = pagedJsEngine.buildViewerUrl({
      projectId: 'test',
      previewBasePath: '/preview/',
      settings: pagedJsEngine.getDefaultSettings(),
      cacheBust: '12345',
    });

    expect(url).toBe('/preview/preview.html?v=12345');
  });
});

describe('Vivliostyle Engine', () => {
  test('has correct metadata', () => {
    expect(vivliostyleEngine.id).toBe('vivliostyle');
    expect(vivliostyleEngine.name).toBe('Vivliostyle');
    expect(vivliostyleEngine.version).toBeDefined();
    expect(vivliostyleEngine.description).toBeDefined();
  });

  test('provides default settings', () => {
    const settings = vivliostyleEngine.getDefaultSettings();
    expect(settings.bookMode).toBe(false);
    expect(settings.renderAllPages).toBe(false); // Read mode by default
    expect(settings.spread).toBe('auto');
    expect(settings.debugMode).toBe(false);
  });

  test('adds doctype if missing', () => {
    const html = '<html><head></head><body>Content</body></html>';
    const settings = vivliostyleEngine.getDefaultSettings();
    const result = vivliostyleEngine.injectEngineScripts(html, settings);

    expect(result.html).toStartWith('<!DOCTYPE html>');
  });

  test('preserves existing doctype', () => {
    const html = '<!DOCTYPE html>\n<html><head></head><body>Content</body></html>';
    const settings = vivliostyleEngine.getDefaultSettings();
    const result = vivliostyleEngine.injectEngineScripts(html, settings);

    // Should not add duplicate doctype
    const doctypeCount = (result.html.match(/<!DOCTYPE/gi) || []).length;
    expect(doctypeCount).toBe(1);
  });

  test('builds viewer URL with hash parameters', () => {
    const url = vivliostyleEngine.buildViewerUrl({
      projectId: 'test',
      previewBasePath: '/preview/',
      settings: vivliostyleEngine.getDefaultSettings(),
    });

    expect(url).toContain('/vendor/vivliostyle/index.html#');
    expect(url).toContain('src=');
    expect(url).toContain('bookMode=false');
    expect(url).toContain('renderAllPages=false');
    expect(url).toContain('spread=auto');
  });

  test('builds viewer URL for book mode', () => {
    const settings = {
      ...vivliostyleEngine.getDefaultSettings(),
      bookMode: true,
    };
    const url = vivliostyleEngine.buildViewerUrl({
      projectId: 'test',
      previewBasePath: '/preview/',
      settings,
    });

    expect(url).toContain('bookMode=true');
    expect(url).toContain('publication.html');
  });

  test('includes style paths in viewer URL', () => {
    const settings = {
      ...vivliostyleEngine.getDefaultSettings(),
      stylePath: '/styles/author.css',
      userStylePath: '/styles/user.css',
    };
    const url = vivliostyleEngine.buildViewerUrl({
      projectId: 'test',
      previewBasePath: '/preview/',
      settings,
    });

    expect(url).toContain('style=');
    expect(url).toContain('userStyle=');
  });
});
