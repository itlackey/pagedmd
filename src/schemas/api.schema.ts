/**
 * Zod schemas for API request validation
 *
 * Validates incoming API requests with type-safe validation
 */

import { z } from 'zod';
import { homedir } from 'os';
import path from 'path';

/**
 * Folder change request schema
 */
export const FolderChangeRequestSchema = z.object({
  path: z
    .string()
    .min(1, 'Path is required')
    .refine(
      (p) => {
        // Ensure path is absolute and within home directory
        const absPath = path.resolve(p);
        const homeDir = homedir();
        return absPath.startsWith(homeDir);
      },
      {
        message: 'Path must be within your home directory',
      }
    )
    .describe('Absolute path to directory'),
});

export type FolderChangeRequest = z.infer<typeof FolderChangeRequestSchema>;

/**
 * GitHub clone request schema
 */
export const GitHubCloneRequestSchema = z.object({
  url: z
    .string()
    .min(1, 'Repository URL is required')
    .refine(
      (url) => {
        // Accept various GitHub URL formats
        const githubPatterns = [
          /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+/,
          /^git@github\.com:[\w-]+\/[\w.-]+\.git$/,
          /^[\w-]+\/[\w.-]+$/, // Short format: owner/repo
        ];
        return githubPatterns.some((pattern) => pattern.test(url));
      },
      {
        message: 'Invalid GitHub URL. Use: https://github.com/owner/repo, git@github.com:owner/repo.git, or owner/repo',
      }
    )
    .describe('GitHub repository URL'),

  targetDir: z
    .string()
    .optional()
    .describe('Optional target directory (defaults to repo name)'),
});

export type GitHubCloneRequest = z.infer<typeof GitHubCloneRequestSchema>;

/**
 * Format Zod validation errors into readable JSON error response
 *
 * @param error Zod validation error
 * @returns Formatted error object
 */
export function formatApiErrors(error: z.ZodError): {
  error: string;
  details: Array<{ field: string; message: string }>;
} {
  return {
    error: 'Invalid request body',
    details: error.issues.map((issue) => ({
      field: issue.path.join('.') || 'request',
      message: issue.message,
    })),
  };
}
