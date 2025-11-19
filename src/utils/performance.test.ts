/**
 * Tests for performance monitoring utilities
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { PerformanceMonitor, formatDuration, isSlow } from './performance.ts';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  test('marks and measures duration between points', () => {
    monitor.mark('start');
    monitor.mark('end');

    const duration = monitor.measure('test operation', 'start', 'end');

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(typeof duration).toBe('number');
  });

  test('measures duration from mark to now when end mark omitted', () => {
    monitor.mark('start');

    const duration = monitor.measure('test operation', 'start');

    expect(duration).toBeGreaterThanOrEqual(0);
  });

  test('throws error when start mark not found', () => {
    expect(() => {
      monitor.measure('test', 'nonexistent');
    }).toThrow('Performance mark "nonexistent" not found');
  });

  test('throws error when end mark not found', () => {
    monitor.mark('start');

    expect(() => {
      monitor.measure('test', 'start', 'nonexistent');
    }).toThrow('Performance mark "nonexistent" not found');
  });

  test('stores multiple measurements', () => {
    monitor.mark('start1');
    monitor.mark('end1');
    monitor.measure('op1', 'start1', 'end1');

    monitor.mark('start2');
    monitor.mark('end2');
    monitor.measure('op2', 'start2', 'end2');

    const measures = monitor.getMeasures();
    expect(measures).toHaveLength(2);
    expect(measures[0]?.name).toBe('op1');
    expect(measures[1]?.name).toBe('op2');
  });

  test('calculates total duration across all measurements', () => {
    monitor.mark('start1');
    monitor.mark('end1');
    monitor.measure('op1', 'start1', 'end1');

    monitor.mark('start2');
    monitor.mark('end2');
    monitor.measure('op2', 'start2', 'end2');

    const total = monitor.getTotalDuration();
    expect(total).toBeGreaterThanOrEqual(0);
  });

  test('identifies slow operations above threshold', async () => {
    monitor.mark('start');

    // Sleep for a bit to create measurable duration
    await new Promise((resolve) => setTimeout(resolve, 10));

    monitor.mark('end');
    monitor.measure('slow op', 'start', 'end');

    const slowOps = monitor.getSlowOperations(5); // 5ms threshold
    expect(slowOps.length).toBeGreaterThan(0);
    expect(slowOps[0]?.name).toBe('slow op');
  });

  test('generates formatted report', () => {
    monitor.mark('start');
    monitor.mark('end');
    monitor.measure('test operation', 'start', 'end');

    const report = monitor.report();
    expect(report).toContain('test operation');
    expect(report).toMatch(/\d+ms/);
  });

  test('report includes total when multiple measurements', () => {
    monitor.mark('start1');
    monitor.mark('end1');
    monitor.measure('op1', 'start1', 'end1');

    monitor.mark('start2');
    monitor.mark('end2');
    monitor.measure('op2', 'start2', 'end2');

    const report = monitor.report();
    expect(report).toContain('Total:');
  });

  test('report can exclude total', () => {
    monitor.mark('start1');
    monitor.mark('end1');
    monitor.measure('op1', 'start1', 'end1');

    monitor.mark('start2');
    monitor.mark('end2');
    monitor.measure('op2', 'start2', 'end2');

    const report = monitor.report(false);
    expect(report).not.toContain('Total:');
  });

  test('resets all marks and measurements', () => {
    monitor.mark('start');
    monitor.mark('end');
    monitor.measure('test', 'start', 'end');

    monitor.reset();

    const measures = monitor.getMeasures();
    expect(measures).toHaveLength(0);
  });

  test('can be disabled to avoid overhead', () => {
    const disabled = new PerformanceMonitor(false);

    disabled.mark('start');
    disabled.mark('end');
    const duration = disabled.measure('test', 'start', 'end');

    expect(duration).toBe(0);
    expect(disabled.getMeasures()).toHaveLength(0);
    expect(disabled.isEnabled()).toBe(false);
  });

  test('is enabled by default', () => {
    expect(monitor.isEnabled()).toBe(true);
  });

  test('returns message when no measurements recorded', () => {
    const report = monitor.report();
    expect(report).toContain('No performance measurements recorded');
  });
});

describe('formatDuration', () => {
  test('formats milliseconds for durations under 1s', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
    expect(formatDuration(0)).toBe('0ms');
  });

  test('formats seconds for durations over 1s', () => {
    expect(formatDuration(1000)).toBe('1.00s');
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatDuration(10000)).toBe('10.00s');
  });
});

describe('isSlow', () => {
  test('returns true when duration exceeds default threshold', () => {
    expect(isSlow(6000)).toBe(true);
    expect(isSlow(10000)).toBe(true);
  });

  test('returns false when duration is below default threshold', () => {
    expect(isSlow(4000)).toBe(false);
    expect(isSlow(1000)).toBe(false);
  });

  test('uses custom threshold when provided', () => {
    expect(isSlow(1500, 1000)).toBe(true);
    expect(isSlow(500, 1000)).toBe(false);
  });

  test('default threshold is 5000ms', () => {
    expect(isSlow(5001)).toBe(true);
    expect(isSlow(4999)).toBe(false);
  });
});
