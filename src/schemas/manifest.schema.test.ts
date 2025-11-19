/**
 * Tests for Manifest Zod schema validation
 *
 * Tests runtime validation of manifest.yaml structure
 */

import { describe, test, expect } from 'bun:test';
import { ManifestSchema, formatManifestErrors } from './manifest.schema.ts';
import { ZodError } from 'zod';

describe('ManifestSchema Validation', () => {
  test('validates minimal valid manifest', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Test Book');
      expect(result.data.authors).toEqual(['Author One']);
    }
  });

  test('validates complete manifest with all optional fields', () => {
    const manifest = {
      title: 'Complete Book',
      authors: ['Author One', 'Author Two'],
      description: 'A comprehensive book',
      page: {
        size: 'letter',
        margins: {
          top: '0.75in',
          bottom: '0.75in',
          inside: '1in',
          outside: '0.75in',
        },
        bleed: '0.125in',
      },
      styles: ['themes/classic.css', 'custom.css'],
      files: ['intro.md', 'chapter1.md', 'conclusion.md'],
      extensions: ['ttrpg', 'dimmCity'],
      disableDefaultStyles: true,
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page?.size).toBe('letter');
      expect(result.data.styles).toHaveLength(2);
      expect(result.data.extensions).toContain('ttrpg');
    }
  });

  test('rejects manifest with missing title', () => {
    const manifest = {
      authors: ['Author One'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.path).toContain('title');
    }
  });

  test('rejects manifest with empty title', () => {
    const manifest = {
      title: '',
      authors: ['Author One'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('cannot be empty');
    }
  });

  test('rejects manifest with missing authors', () => {
    const manifest = {
      title: 'Test Book',
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('authors');
    }
  });

  test('rejects manifest with empty authors array', () => {
    const manifest = {
      title: 'Test Book',
      authors: [],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('At least one author');
    }
  });

  test('rejects manifest with empty author name', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One', ''],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('cannot be empty');
    }
  });

  test('provides default empty array for styles', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.styles).toEqual([]);
    }
  });

  test('rejects absolute style paths', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      styles: ['/absolute/path/style.css'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('relative, not absolute');
    }
  });

  test('rejects style paths with parent directory traversal', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      styles: ['../../../etc/passwd'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('cannot reference parent directories');
    }
  });

  test('rejects empty style path', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      styles: [''],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('cannot be empty');
    }
  });

  test('rejects invalid extension name', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      extensions: ['invalidExtension'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("must be one of: 'ttrpg', 'dimmCity', 'containers'");
    }
  });

  test('accepts valid extension names', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      extensions: ['ttrpg', 'dimmCity', 'containers'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
  });

  test('provides default false for disableDefaultStyles', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.disableDefaultStyles).toBe(false);
    }
  });

  test('accepts disableDefaultStyles as true', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      disableDefaultStyles: true,
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.disableDefaultStyles).toBe(true);
    }
  });

  test('validates page configuration with all fields', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      page: {
        size: 'a4',
        margins: {
          top: '2cm',
          bottom: '2cm',
          inside: '2.5cm',
          outside: '2cm',
        },
        bleed: '3mm',
      },
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page?.size).toBe('a4');
      expect(result.data.page?.bleed).toBe('3mm');
    }
  });

  test('provides default page size', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      page: {
        margins: {
          top: '1in',
          bottom: '1in',
          inside: '1in',
          outside: '1in',
        },
      },
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page?.size).toBe('letter');
    }
  });

  test('rejects wrong type for title', () => {
    const manifest = {
      title: 123,
      authors: ['Author One'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
  });

  test('rejects wrong type for authors', () => {
    const manifest = {
      title: 'Test Book',
      authors: 'Not an array',
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
  });

  test('accepts optional description', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      description: 'This is a test book',
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('This is a test book');
    }
  });

  test('accepts optional files array', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      files: ['chapter1.md', 'chapter2.md'],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toHaveLength(2);
    }
  });

  test('rejects empty file path', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      files: [''],
    };

    const result = ManifestSchema.safeParse(manifest);

    expect(result.success).toBe(false);
  });
});

describe('formatManifestErrors', () => {
  test('formats single error correctly', () => {
    const manifest = {
      title: '',
      authors: ['Author One'],
    };

    const result = ManifestSchema.safeParse(manifest);

    if (!result.success) {
      const formatted = formatManifestErrors(result.error);

      expect(formatted).toContain('Invalid manifest.yaml');
      expect(formatted).toContain('title:');
      expect(formatted).toContain('cannot be empty');
    }
  });

  test('formats multiple errors correctly', () => {
    const manifest = {
      title: '',
      authors: [],
    };

    const result = ManifestSchema.safeParse(manifest);

    if (!result.success) {
      const formatted = formatManifestErrors(result.error);

      expect(formatted).toContain('title:');
      expect(formatted).toContain('authors:');
    }
  });

  test('formats nested path errors', () => {
    const manifest = {
      title: 'Test Book',
      authors: ['Author One'],
      styles: ['/absolute/path'],
    };

    const result = ManifestSchema.safeParse(manifest);

    if (!result.success) {
      const formatted = formatManifestErrors(result.error);

      expect(formatted).toContain('styles.0:');
    }
  });
});
