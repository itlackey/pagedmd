/**
 * Simplified error handling for pagedmd
 *
 * This is a personal tool - just basic error logging, no enterprise complexity.
 */

import { error as logError } from './logger.ts';

/**
 * Simple helper to log and re-throw errors
 *
 * @param error - Error to handle
 * @param context - Optional context message
 * @throws Always re-throws the error after logging
 */
export function handleError(error: unknown, context?: string): never {
  const message = error instanceof Error ? error.message : String(error);
  const fullMessage = context ? `${context}: ${message}` : message;

  logError(fullMessage);

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(fullMessage);
}
