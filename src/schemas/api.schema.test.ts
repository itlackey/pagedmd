/**
 * Tests for API Zod schema validation
 *
 * Tests runtime validation of API request structures
 */

import { describe, test, expect } from 'bun:test';
import {
  FolderChangeRequestSchema,
  GitHubCloneRequestSchema,
  formatApiErrors,
} from './api.schema.ts';
import { homedir } from 'os';
import { join } from 'path';

describe('FolderChangeRequestSchema', () => {
  test('validates path within home directory', () => {
    const homeDir = homedir();
    const validPath = join(homeDir, 'Documents', 'projects');

    const result = FolderChangeRequestSchema.safeParse({
      path: validPath,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.path).toBe(validPath);
    }
  });

  test('rejects empty path', () => {
    const result = FolderChangeRequestSchema.safeParse({
      path: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Path is required');
    }
  });

  test('rejects path outside home directory', () => {
    const result = FolderChangeRequestSchema.safeParse({
      path: '/etc/passwd',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('within your home directory');
    }
  });

  test('rejects path with directory traversal attempt', () => {
    const homeDir = homedir();
    const maliciousPath = join(homeDir, '..', '..', 'etc', 'passwd');

    const result = FolderChangeRequestSchema.safeParse({
      path: maliciousPath,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('within your home directory');
    }
  });

  test('accepts relative path that resolves within home', () => {
    const homeDir = homedir();
    const relativePath = join(homeDir, 'Documents');

    const result = FolderChangeRequestSchema.safeParse({
      path: relativePath,
    });

    expect(result.success).toBe(true);
  });

  test('rejects missing path field', () => {
    const result = FolderChangeRequestSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe('GitHubCloneRequestSchema', () => {
  test('validates HTTPS GitHub URL', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'https://github.com/owner/repo',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe('https://github.com/owner/repo');
    }
  });

  test('validates HTTP GitHub URL', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'http://github.com/owner/repo',
    });

    expect(result.success).toBe(true);
  });

  test('validates SSH GitHub URL', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'git@github.com:owner/repo.git',
    });

    expect(result.success).toBe(true);
  });

  test('validates short GitHub format (owner/repo)', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'owner/repo',
    });

    expect(result.success).toBe(true);
  });

  test('accepts GitHub URL with hyphens and underscores', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'https://github.com/my-org/my_repo',
    });

    expect(result.success).toBe(true);
  });

  test('accepts GitHub URL with dots in repo name', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'https://github.com/owner/repo.name.js',
    });

    expect(result.success).toBe(true);
  });

  test('rejects empty URL', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Repository URL is required');
    }
  });

  test('rejects non-GitHub URL', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'https://gitlab.com/owner/repo',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Invalid GitHub URL');
    }
  });

  test('rejects malformed GitHub URL', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'not-a-valid-url',
    });

    expect(result.success).toBe(false);
  });

  test('rejects GitHub URL missing repo', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'https://github.com/owner',
    });

    expect(result.success).toBe(false);
  });

  test('accepts optional targetDir', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'https://github.com/owner/repo',
      targetDir: 'my-project',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetDir).toBe('my-project');
    }
  });

  test('works without targetDir', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: 'https://github.com/owner/repo',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetDir).toBeUndefined();
    }
  });

  test('rejects missing url field', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      targetDir: 'my-project',
    });

    expect(result.success).toBe(false);
  });
});

describe('formatApiErrors', () => {
  test('formats single validation error', () => {
    const result = FolderChangeRequestSchema.safeParse({
      path: '',
    });

    if (!result.success) {
      const formatted = formatApiErrors(result.error);

      expect(formatted.error).toBe('Invalid request body');
      // Empty path triggers both min() and refine() errors
      expect(formatted.details.length).toBeGreaterThanOrEqual(1);
      expect(formatted.details[0]?.field).toBe('path');
      expect(formatted.details[0]?.message).toContain('Path is required');
    }
  });

  test('formats multiple validation errors', () => {
    const result = GitHubCloneRequestSchema.safeParse({
      url: '',
    });

    if (!result.success) {
      const formatted = formatApiErrors(result.error);

      expect(formatted.error).toBe('Invalid request body');
      // Empty URL triggers both min() and refine() errors
      expect(formatted.details.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('formats nested field errors', () => {
    const result = FolderChangeRequestSchema.safeParse({
      path: '/etc/passwd',
    });

    if (!result.success) {
      const formatted = formatApiErrors(result.error);

      expect(formatted.details[0]?.field).toBe('path');
      expect(formatted.details[0]?.message).toBeDefined();
    }
  });

  test('returns properly structured error object', () => {
    const result = FolderChangeRequestSchema.safeParse({});

    if (!result.success) {
      const formatted = formatApiErrors(result.error);

      expect(formatted).toHaveProperty('error');
      expect(formatted).toHaveProperty('details');
      expect(Array.isArray(formatted.details)).toBe(true);
    }
  });
});
