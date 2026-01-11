/**
 * Unit tests for path validation utilities
 */

import { describe, test, expect } from 'bun:test';
import { validateSafePath, validateOutputPath } from './path-validation.ts';
import path from 'path';
import type { OutputFormat } from '../types.ts';

describe('Path Validation', () => {
  describe('validateSafePath', () => {
    test('allows path within base directory', () => {
      const basePath = '/home/user';
      const targetPath = 'documents/file.txt';

      expect(() => validateSafePath(targetPath, basePath)).not.toThrow();
    });

    test('allows same directory', () => {
      const basePath = '/home/user';
      const targetPath = '.';

      expect(() => validateSafePath(targetPath, basePath)).not.toThrow();
    });

    test('throws error for path traversal attempts', () => {
      const basePath = '/home/user';
      const targetPath = '../etc/passwd';

      expect(() => validateSafePath(targetPath, basePath)).toThrow(/Path traversal attempt detected/);
    });

    test('throws error for absolute path outside base', () => {
      const basePath = '/home/user';
      const targetPath = '/etc/passwd';

      expect(() => validateSafePath(targetPath, basePath)).toThrow(/Path traversal attempt detected/);
    });

    test('allows nested directories within base', () => {
      const basePath = '/home/user/projects';
      const targetPath = 'myapp/src/components/Button.tsx';

      expect(() => validateSafePath(targetPath, basePath)).not.toThrow();
    });

    test('normalizes paths before validation', () => {
      const basePath = '/home/user';
      const targetPath = './documents/../documents/file.txt';

      expect(() => validateSafePath(targetPath, basePath)).not.toThrow();
    });
  });

  describe('validateOutputPath', () => {
    test('allows path that does not exist', () => {
      const result = validateOutputPath('pdf' as OutputFormat, '/tmp/nonexistent.pdf', false);

      expect(result.isValid).toBe(true);
      expect(result.conflictType).toBe('none');
    });

    test('skips validation when force=true', () => {
      const result = validateOutputPath('pdf' as OutputFormat, '/any/path', true);

      expect(result.isValid).toBe(true);
      expect(result.conflictType).toBe('none');
      expect(result.message).toContain('force');
    });

    test('detects parent directory missing', () => {
      const nonExistentParent = '/this/path/does/not/exist/file.pdf';
      const result = validateOutputPath('pdf' as OutputFormat, nonExistentParent, false);

      expect(result.isValid).toBe(false);
      expect(result.conflictType).toBe('parent-missing');
      expect(result.suggestedFix).toContain('mkdir');
    });

    // Note: Tests for existing directories/files would require creating temp files
    // and are better suited for integration tests
  });
});
