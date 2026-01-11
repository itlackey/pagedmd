/**
 * Preview Engines Module
 *
 * Exports preview engine types, implementations, and registry.
 */

// Types
export type {
  PreviewEngineId,
  PreviewEngine,
  PreviewSettings,
  ViewerUrlOptions,
  StaticAssetOptions,
  HtmlInjectionResult,
  EngineRegistryEntry,
  PreviewAPI,
  PreviewEvents,
  PreviewEngineConfig,
} from './types';

// Engine implementations
export { pagedJsEngine, createPagedJsEngine } from './pagedjs-engine';
export {
  vivliostyleEngine,
  createVivliostyleEngine,
  registerVivliostyleEngine,
  VIVLIOSTYLE_VERSION,
} from './vivliostyle-engine';

// Registry
export {
  registerEngine,
  getEngine,
  getAllEngines,
  getAvailableEngineIds,
  isEngineAvailable,
  getDefaultEngine,
  getEngineOrDefault,
  validateEngineDependencies,
  getMergedSettings,
  initializeRegistry,
  setEngineEnabled,
  clearRegistry,
} from './registry';
