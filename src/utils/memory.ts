/**
 * Memory usage tracking utilities
 *
 * Provides memory monitoring and reporting for build operations
 */

import { debug } from './logger.ts';

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  /** Resident Set Size - total memory allocated */
  rss: number;
  /** Heap memory used */
  heapUsed: number;
  /** Total heap size */
  heapTotal: number;
  /** External memory (C++ objects) */
  external: number;
  /** Array buffers */
  arrayBuffers: number;
  /** Timestamp of snapshot */
  timestamp: number;
}

/**
 * Get current memory usage
 *
 * @returns Memory usage snapshot
 */
export function getMemoryUsage(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    timestamp: Date.now(),
  };
}

/**
 * Format bytes as human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "45.67 MB")
 */
export function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Log current memory usage with a label
 *
 * @param label - Label for this measurement
 */
export function logMemoryUsage(label: string): void {
  const usage = getMemoryUsage();
  debug(`[Memory: ${label}]`, {
    rss: formatBytes(usage.rss),
    heapUsed: formatBytes(usage.heapUsed),
    heapTotal: formatBytes(usage.heapTotal),
    external: formatBytes(usage.external),
  });
}

/**
 * Memory monitor for tracking peak usage
 */
export class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private enabled: boolean;

  /**
   * Create a new memory monitor
   *
   * @param enabled - Whether monitoring is enabled (default: true)
   */
  constructor(enabled = true) {
    this.enabled = enabled;
  }

  /**
   * Take a memory snapshot with a label
   *
   * @param label - Label for this snapshot
   */
  snapshot(label?: string): void {
    if (!this.enabled) return;

    const snap = getMemoryUsage();
    this.snapshots.push(snap);

    if (label) {
      debug(`[Memory Snapshot: ${label}]`, {
        heapUsed: formatBytes(snap.heapUsed),
        rss: formatBytes(snap.rss),
      });
    }
  }

  /**
   * Get peak memory usage across all snapshots
   *
   * @returns Peak memory snapshot
   */
  getPeak(): MemorySnapshot | null {
    if (this.snapshots.length === 0) return null;

    return this.snapshots.reduce((peak, current) =>
      current.heapUsed > peak.heapUsed ? current : peak
    );
  }

  /**
   * Get memory usage delta between first and last snapshot
   *
   * @returns Delta in bytes, or null if insufficient snapshots
   */
  getDelta(): number | null {
    if (this.snapshots.length < 2) return null;

    const first = this.snapshots[0]!;
    const last = this.snapshots[this.snapshots.length - 1]!;

    return last.heapUsed - first.heapUsed;
  }

  /**
   * Format memory report
   *
   * @returns Formatted report string
   */
  report(): string {
    if (!this.enabled || this.snapshots.length === 0) {
      return 'No memory snapshots recorded';
    }

    const lines: string[] = [];
    const peak = this.getPeak();
    const delta = this.getDelta();

    if (peak) {
      lines.push(`  Peak Heap: ${formatBytes(peak.heapUsed)}`);
      lines.push(`  Peak RSS: ${formatBytes(peak.rss)}`);
    }

    if (delta !== null) {
      const sign = delta >= 0 ? '+' : '';
      lines.push(`  Delta: ${sign}${formatBytes(delta)}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset all snapshots
   */
  reset(): void {
    this.snapshots = [];
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Check if heap usage is high
 *
 * @param thresholdMB - Threshold in megabytes (default: 512)
 * @returns True if heap usage exceeds threshold
 */
export function isHighMemoryUsage(thresholdMB = 512): boolean {
  const usage = getMemoryUsage();
  const heapMB = usage.heapUsed / 1024 / 1024;
  return heapMB > thresholdMB;
}
