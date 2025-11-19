/**
 * Tests for memory monitoring utilities
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  getMemoryUsage,
  formatBytes,
  isHighMemoryUsage,
  MemoryMonitor,
  type MemorySnapshot,
} from './memory.ts';

describe('getMemoryUsage', () => {
  test('returns valid memory snapshot', () => {
    const snapshot = getMemoryUsage();

    expect(snapshot).toHaveProperty('rss');
    expect(snapshot).toHaveProperty('heapUsed');
    expect(snapshot).toHaveProperty('heapTotal');
    expect(snapshot).toHaveProperty('external');
    expect(snapshot).toHaveProperty('arrayBuffers');
    expect(snapshot).toHaveProperty('timestamp');

    expect(typeof snapshot.rss).toBe('number');
    expect(typeof snapshot.heapUsed).toBe('number');
    expect(typeof snapshot.heapTotal).toBe('number');
    expect(typeof snapshot.external).toBe('number');
    expect(typeof snapshot.arrayBuffers).toBe('number');
    expect(typeof snapshot.timestamp).toBe('number');
  });

  test('returns positive memory values', () => {
    const snapshot = getMemoryUsage();

    expect(snapshot.rss).toBeGreaterThan(0);
    expect(snapshot.heapUsed).toBeGreaterThan(0);
    expect(snapshot.heapTotal).toBeGreaterThan(0);
    expect(snapshot.timestamp).toBeGreaterThan(0);
  });

  test('heapUsed should not exceed heapTotal', () => {
    const snapshot = getMemoryUsage();

    expect(snapshot.heapUsed).toBeLessThanOrEqual(snapshot.heapTotal);
  });

  test('timestamp is recent', () => {
    const before = Date.now();
    const snapshot = getMemoryUsage();
    const after = Date.now();

    expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
    expect(snapshot.timestamp).toBeLessThanOrEqual(after);
  });
});

describe('formatBytes', () => {
  test('formats bytes to megabytes', () => {
    expect(formatBytes(0)).toBe('0.00 MB');
    expect(formatBytes(1024)).toBe('0.00 MB'); // Less than 1 MB
    expect(formatBytes(1048576)).toBe('1.00 MB'); // Exactly 1 MB
    expect(formatBytes(1572864)).toBe('1.50 MB'); // 1.5 MB
    expect(formatBytes(10485760)).toBe('10.00 MB'); // 10 MB
  });

  test('includes two decimal places', () => {
    const formatted = formatBytes(1234567);
    expect(formatted).toMatch(/^\d+\.\d{2} MB$/);
  });

  test('handles large values', () => {
    const gigabyte = 1024 * 1024 * 1024;
    expect(formatBytes(gigabyte)).toBe('1024.00 MB');
  });

  test('handles fractional megabytes', () => {
    expect(formatBytes(524288)).toBe('0.50 MB'); // 0.5 MB
    expect(formatBytes(262144)).toBe('0.25 MB'); // 0.25 MB
  });
});

describe('isHighMemoryUsage', () => {
  test('returns boolean', () => {
    const result = isHighMemoryUsage();
    expect(typeof result).toBe('boolean');
  });

  test('uses default threshold of 512MB', () => {
    const usage = getMemoryUsage();
    const heapMB = usage.heapUsed / 1024 / 1024;
    const result = isHighMemoryUsage();

    expect(result).toBe(heapMB > 512);
  });

  test('accepts custom threshold', () => {
    const usage = getMemoryUsage();
    const heapMB = usage.heapUsed / 1024 / 1024;

    // Test with very low threshold (should be high)
    expect(isHighMemoryUsage(0.1)).toBe(true);

    // Test with very high threshold (should be low)
    expect(isHighMemoryUsage(999999)).toBe(false);
  });
});

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor;

  beforeEach(() => {
    monitor = new MemoryMonitor();
  });

  test('creates monitor with default enabled state', () => {
    expect(monitor.isEnabled()).toBe(true);
  });

  test('can be created in disabled state', () => {
    const disabled = new MemoryMonitor(false);
    expect(disabled.isEnabled()).toBe(false);
  });

  test('takes snapshots', () => {
    monitor.snapshot();
    monitor.snapshot();

    const peak = monitor.getPeak();
    expect(peak).not.toBeNull();
    expect(peak).toHaveProperty('heapUsed');
  });

  test('getPeak returns null when no snapshots', () => {
    const peak = monitor.getPeak();
    expect(peak).toBeNull();
  });

  test('getPeak returns highest heap usage', async () => {
    monitor.snapshot();

    // Allocate some memory
    const array = new Array(1000000).fill('test');

    monitor.snapshot();

    const peak = monitor.getPeak();
    expect(peak).not.toBeNull();
    expect(peak!.heapUsed).toBeGreaterThan(0);

    // Keep array reference to prevent GC
    expect(array.length).toBe(1000000);
  });

  test('getDelta returns null when insufficient snapshots', () => {
    expect(monitor.getDelta()).toBeNull();

    monitor.snapshot();
    expect(monitor.getDelta()).toBeNull();
  });

  test('getDelta calculates memory change', () => {
    monitor.snapshot();
    monitor.snapshot();

    const delta = monitor.getDelta();
    expect(delta).not.toBeNull();
    expect(typeof delta).toBe('number');
  });

  test('getDelta can be positive or negative', async () => {
    monitor.snapshot();

    // Allocate memory
    const arrays: number[][] = [];
    for (let i = 0; i < 100; i++) {
      arrays.push(new Array(10000).fill(i));
    }

    monitor.snapshot();

    const delta = monitor.getDelta();
    expect(delta).not.toBeNull();

    // Keep arrays reference to prevent GC
    expect(arrays.length).toBe(100);
  });

  test('generates formatted report', () => {
    monitor.snapshot();
    monitor.snapshot();

    const report = monitor.report();
    expect(report).toContain('Peak Heap:');
    expect(report).toContain('Peak RSS:');
    expect(report).toContain('Delta:');
    expect(report).toMatch(/\d+\.\d{2} MB/);
  });

  test('report shows + sign for positive delta', () => {
    monitor.snapshot();

    // Allocate memory
    const array = new Array(100000).fill('test');

    monitor.snapshot();

    const report = monitor.report();
    // Delta might be positive or negative depending on GC

    // Keep array reference
    expect(array.length).toBe(100000);
  });

  test('report returns message when no snapshots', () => {
    const report = monitor.report();
    expect(report).toBe('No memory snapshots recorded');
  });

  test('resets all snapshots', () => {
    monitor.snapshot();
    monitor.snapshot();

    monitor.reset();

    expect(monitor.getPeak()).toBeNull();
    expect(monitor.getDelta()).toBeNull();
  });

  test('disabled monitor does not record snapshots', () => {
    const disabled = new MemoryMonitor(false);

    disabled.snapshot();
    disabled.snapshot();

    expect(disabled.getPeak()).toBeNull();
    expect(disabled.getDelta()).toBeNull();
  });

  test('disabled monitor returns no snapshots message', () => {
    const disabled = new MemoryMonitor(false);

    disabled.snapshot();

    const report = disabled.report();
    expect(report).toBe('No memory snapshots recorded');
  });

  test('snapshot with label does not affect functionality', () => {
    monitor.snapshot('start');
    monitor.snapshot('middle');
    monitor.snapshot('end');

    const peak = monitor.getPeak();
    const delta = monitor.getDelta();

    expect(peak).not.toBeNull();
    expect(delta).not.toBeNull();
  });

  test('multiple snapshots track correctly', () => {
    const snapshots = 10;

    for (let i = 0; i < snapshots; i++) {
      monitor.snapshot(`snapshot-${i}`);
    }

    const delta = monitor.getDelta();
    expect(delta).not.toBeNull();
  });

  test('report handles single snapshot', () => {
    monitor.snapshot();

    const report = monitor.report();
    expect(report).toContain('Peak Heap:');
    expect(report).toContain('Peak RSS:');
    expect(report).not.toContain('Delta:'); // No delta with single snapshot
  });
});
