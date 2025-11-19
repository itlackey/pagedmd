/**
 * Zod schema for manifest.yaml validation
 *
 * Provides runtime validation for manifest configuration with helpful error messages
 */

import { z } from 'zod';
import path from 'path';

/**
 * Page configuration schema
 */
const PageSchema = z.object({
  size: z.string().default('letter').describe('Page size (e.g., letter, a4, 6x9)'),
  margins: z
    .object({
      top: z.string().describe('Top margin (e.g., 0.75in, 2cm)'),
      bottom: z.string().describe('Bottom margin'),
      inside: z.string().describe('Inside/left margin'),
      outside: z.string().describe('Outside/right margin'),
    })
    .describe('Page margins'),
  bleed: z.string().optional().describe('Bleed area for print (e.g., 0.125in)'),
});

/**
 * Markdown extension options
 */
const ExtensionSchema = z.enum(['ttrpg', 'dimmCity', 'containers'], {
  errorMap: () => ({
    message: "Extension must be one of: 'ttrpg', 'dimmCity', 'containers'",
  }),
});

/**
 * Complete manifest schema
 *
 * Validates the entire manifest.yaml structure with runtime type checking
 */
export const ManifestSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required and cannot be empty')
    .describe('Document title'),

  authors: z
    .array(z.string().min(1, 'Author name cannot be empty'))
    .min(1, 'At least one author is required')
    .describe('List of authors'),

  description: z
    .string()
    .optional()
    .describe('Document description'),

  page: PageSchema.optional().describe('Page format configuration'),

  styles: z
    .array(
      z.string()
        .min(1, 'Style path cannot be empty')
        .refine((p) => !path.isAbsolute(p), {
          message: 'Style paths must be relative, not absolute',
        })
        .refine((p) => !path.normalize(p).startsWith('..'), {
          message: 'Style paths cannot reference parent directories (..)',
        })
    )
    .default([])
    .describe('List of CSS files to include'),

  files: z
    .array(
      z.string().min(1, 'File path cannot be empty')
    )
    .optional()
    .describe('Explicit file ordering (optional)'),

  extensions: z
    .array(ExtensionSchema)
    .optional()
    .describe('Markdown extensions to enable'),

  disableDefaultStyles: z
    .boolean()
    .optional()
    .default(false)
    .describe('Disable default CSS styles'),
});

/**
 * Infer TypeScript type from schema
 */
export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Format Zod validation errors into readable messages
 *
 * @param error Zod validation error
 * @returns Formatted error message
 */
export function formatManifestErrors(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `  - ${path || 'manifest'}: ${issue.message}`;
  });

  return `Invalid manifest.yaml:\n${issues.join('\n')}`;
}
