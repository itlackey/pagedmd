/**
 * Performance monitoring utilities
 *
 * Provides timing and performance measurement for build operations
 */

import { performance } from 'perf_hooks';

/**
 * Performance measurement result
 */
export interface PerformanceMeasure {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

/**
 * Performance monitor for tracking build stage timings
 *
 * @example
 * const perf = new PerformanceMonitor();
 * perf.mark('start');
 * // ... do work
 * perf.mark('end');
 * const duration = perf.measure('Task', 'start', 'end');
 * console.log(perf.report());
 */
export class PerformanceMonitor {
  private marks = new Map<string, number>();
  private measures: PerformanceMeasure[] = [];
  private enabled: boolean;

  /**
   * Create a new performance monitor
   *
   * @param enabled - Whether monitoring is enabled (default: true)
   */
  constructor(enabled = true) {
    this.enabled = enabled;
  }

  /**
   * Mark a point in time with a name
   *
   * @param name - Name for this mark
   */
  mark(name: string): void {
    if (!this.enabled) return;
    this.marks.set(name, performance.now());
  }

  /**
   * Measure duration between two marks
   *
   * @param name - Name for this measurement
   * @param startMark - Name of start mark
   * @param endMark - Name of end mark (optional, uses current time if omitted)
   * @returns Duration in milliseconds
   * @throws Error if start mark not found
   */
  measure(name: string, startMark: string, endMark?: string): number {
    if (!this.enabled) return 0;

    const start = this.marks.get(startMark);
    if (start === undefined) {
      throw new Error(`Performance mark "${startMark}" not found`);
    }

    const end = endMark ? this.marks.get(endMark) : performance.now();
    if (end === undefined) {
      throw new Error(`Performance mark "${endMark}" not found`);
    }

    const duration = end - start;
    this.measures.push({
      name,
      duration,
      startTime: start,
      endTime: end,
    });

    return duration;
  }

  /**
   * Get all measurements
   *
   * @returns Array of performance measurements
   */
  getMeasures(): PerformanceMeasure[] {
    return [...this.measures];
  }

  /**
   * Get total duration across all measurements
   *
   * @returns Total duration in milliseconds
   */
  getTotalDuration(): number {
    return this.measures.reduce((sum, m) => sum + m.duration, 0);
  }

  /**
   * Check if any measurement exceeded a threshold
   *
   * @param thresholdMs - Threshold in milliseconds
   * @returns Measurements that exceeded the threshold
   */
  getSlowOperations(thresholdMs: number): PerformanceMeasure[] {
    return this.measures.filter((m) => m.duration > thresholdMs);
  }

  /**
   * Format measurements as a human-readable report
   *
   * @param includeTotal - Whether to include total duration (default: true)
   * @returns Formatted report string
   */
  report(includeTotal = true): string {
    if (!this.enabled || this.measures.length === 0) {
      return 'No performance measurements recorded';
    }

    const lines = this.measures.map((m) => {
      const durationStr = m.duration < 1000
        ? `${m.duration.toFixed(2)}ms`
        : `${(m.duration / 1000).toFixed(2)}s`;
      return `  ${m.name}: ${durationStr}`;
    });

    if (includeTotal && this.measures.length > 1) {
      const total = this.getTotalDuration();
      const totalStr = total < 1000
        ? `${total.toFixed(2)}ms`
        : `${(total / 1000).toFixed(2)}s`;
      lines.push(`  Total: ${totalStr}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset all marks and measurements
   */
  reset(): void {
    this.marks.clear();
    this.measures = [];
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Format duration in human-readable format
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "1.23s" or "456ms")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Check if duration is slow based on threshold
 *
 * @param ms - Duration in milliseconds
 * @param thresholdMs - Threshold in milliseconds (default: 5000)
 * @returns True if duration exceeds threshold
 */
export function isSlow(ms: number, thresholdMs = 5000): boolean {
  return ms > thresholdMs;
}
