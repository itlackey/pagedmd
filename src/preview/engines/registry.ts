/**
 * Preview Engine Registry
 *
 * Manages available preview engines and provides methods for
 * selecting and configuring them.
 */

import type {
  PreviewEngine,
  PreviewEngineId,
  EngineRegistryEntry,
  PreviewSettings,
} from './types';
import { pagedJsEngine } from './pagedjs-engine';
import { vivliostyleEngine } from './vivliostyle-engine';

/**
 * Registry of available preview engines
 */
const engineRegistry: Map<PreviewEngineId, EngineRegistryEntry> = new Map();

/**
 * Register a preview engine
 */
export function registerEngine(
  engine: PreviewEngine,
  options: { enabled?: boolean; priority?: number } = {}
): void {
  const { enabled = true, priority = 100 } = options;

  engineRegistry.set(engine.id, {
    engine,
    enabled,
    priority,
  });
}

/**
 * Get a preview engine by ID
 */
export function getEngine(id: PreviewEngineId): PreviewEngine | undefined {
  const entry = engineRegistry.get(id);
  return entry?.enabled ? entry.engine : undefined;
}

/**
 * Get all registered engines
 */
export function getAllEngines(): PreviewEngine[] {
  return Array.from(engineRegistry.values())
    .filter(entry => entry.enabled)
    .sort((a, b) => b.priority - a.priority)
    .map(entry => entry.engine);
}

/**
 * Get available engine IDs
 */
export function getAvailableEngineIds(): PreviewEngineId[] {
  return getAllEngines().map(engine => engine.id);
}

/**
 * Check if an engine is available
 */
export function isEngineAvailable(id: PreviewEngineId): boolean {
  const entry = engineRegistry.get(id);
  return entry?.enabled ?? false;
}

/**
 * Get the default engine (highest priority enabled engine)
 */
export function getDefaultEngine(): PreviewEngine {
  const engines = getAllEngines();
  if (engines.length === 0) {
    throw new Error('No preview engines registered');
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return engines[0]!;
}

/**
 * Get or fallback engine
 * Returns the requested engine if available, otherwise returns the default
 */
export function getEngineOrDefault(id: PreviewEngineId): PreviewEngine {
  return getEngine(id) ?? getDefaultEngine();
}

/**
 * Validate engine dependencies
 */
export async function validateEngineDependencies(
  id: PreviewEngineId,
  assetsDir: string
): Promise<boolean> {
  const engine = getEngine(id);
  if (!engine) {
    return false;
  }
  return engine.validateDependencies(assetsDir);
}

/**
 * Get merged settings (default + user overrides)
 */
export function getMergedSettings(
  id: PreviewEngineId,
  userSettings: Partial<PreviewSettings> = {}
): PreviewSettings {
  const engine = getEngine(id);
  if (!engine) {
    throw new Error(`Engine not found: ${id}`);
  }

  const defaults = engine.getDefaultSettings();
  return {
    ...defaults,
    ...userSettings,
  };
}

/**
 * Initialize the engine registry with default engines
 */
export function initializeRegistry(): void {
  // Register Paged.js as the default engine (highest priority for backward compatibility)
  registerEngine(pagedJsEngine, { enabled: true, priority: 100 });

  // Register Vivliostyle as an alternative engine (lower priority)
  registerEngine(vivliostyleEngine, { enabled: true, priority: 50 });
}

/**
 * Enable or disable an engine
 */
export function setEngineEnabled(id: PreviewEngineId, enabled: boolean): void {
  const entry = engineRegistry.get(id);
  if (entry) {
    entry.enabled = enabled;
  }
}

/**
 * Clear the registry (for testing)
 */
export function clearRegistry(): void {
  engineRegistry.clear();
}

// Initialize registry on module load
initializeRegistry();
