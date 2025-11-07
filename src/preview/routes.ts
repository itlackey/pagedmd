/**
 * API Route Handlers for Preview Server
 *
 * Provides HTTP route handlers for directory listing and folder switching.
 * All routes enforce home directory security boundaries.
 *
 * Route handlers:
 * - handleListDirectories: GET /api/directories - List subdirectories with navigation
 * - handleChangeFolder: POST /api/change-folder - Switch working directory
 */

import { readdir, stat } from "fs/promises";
import { join, resolve, dirname } from "path";
import type {
  DirectoryListResponse,
  FolderChangeResponse,
  DirectoryEntry,
} from "../types";
import {
  isWithinHomeDirectory,
  getHomeDirectory,
} from "../utils/path-security";
import { error as logError } from "../utils/logger";

/**
 * Helper function to check if a path is a directory
 *
 * @param path - Path to check
 * @returns True if path exists and is a directory
 */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Helper function to check if a file or directory exists
 *
 * @param path - Path to check
 * @returns True if path exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a JSON response with proper headers
 *
 * @param data - Data to serialize as JSON
 * @param status - HTTP status code (default: 200)
 * @returns Response with JSON content type
 */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create an error response with JSON body
 *
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @returns Response with error JSON
 */
function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * List directories under a given path
 *
 * Reads directory contents and filters to only include subdirectories.
 * Hidden directories (starting with '.') are excluded.
 *
 * @param basePath - Directory to list
 * @returns Array of directory entries sorted alphabetically
 */
async function listDirectories(basePath: string): Promise<DirectoryEntry[]> {
  try {
    // Read directory with file type information
    const entries = await readdir(basePath, { withFileTypes: true });

    // Filter to directories only, exclude hidden directories
    const directories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => ({
        name: entry.name,
        path: join(basePath, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return directories;
  } catch (error) {
    // Return empty array on error (likely permission denied or path doesn't exist)
    return [];
  }
}

/**
 * Handle GET /api/directories - List subdirectories with navigation
 *
 * Query parameters:
 * - path: Directory to list (optional, defaults to home directory)
 *
 * Security:
 * - Path must be within home directory boundary
 * - If path is outside home, falls back to home directory
 * - Hidden directories (starting with '.') are excluded
 *
 * Response includes:
 * - currentPath: Resolved path being listed
 * - homeDirectory: User's home directory
 * - isAtHome: Whether current path equals home directory
 * - parent: Parent directory path (undefined if at home or if parent is outside home)
 * - directories: Array of subdirectories sorted alphabetically
 *
 * Error handling:
 * - ENOENT (path doesn't exist): 404 with error message
 * - EACCES (permission denied): 403 with error message
 * - Other errors: 500 with error message
 *
 * @param request - HTTP request with optional 'path' query parameter
 * @returns JSON response with DirectoryListResponse
 */
export async function handleListDirectories(
  request: Request
): Promise<Response> {
  try {
    // Extract path from query parameters
    const url = new URL(request.url);
    let basePath = url.searchParams.get("path") || getHomeDirectory();

    // Security check: ensure path is within home directory
    const homeDir = getHomeDirectory();
    if (!isWithinHomeDirectory(basePath, homeDir)) {
      basePath = homeDir;
    }

    // Validate path exists
    if (!(await fileExists(basePath))) {
      return errorResponse("Directory does not exist", 404);
    }

    // Validate path is a directory
    if (!(await isDirectory(basePath))) {
      return errorResponse("Path is not a directory", 400);
    }

    // List subdirectories
    const directories = await listDirectories(basePath);
    const isAtHome = resolve(basePath) === resolve(homeDir);

    // Calculate parent directory (only if not at home)
    let parentPath: string | undefined;
    if (!isAtHome) {
      const parent = dirname(basePath);
      // Only include parent if it's within home directory
      if (isWithinHomeDirectory(parent, homeDir)) {
        parentPath = parent;
      }
    }

    // Build response
    const response: DirectoryListResponse = {
      currentPath: basePath,
      homeDirectory: homeDir,
      isAtHome,
      parent: parentPath,
      directories,
    };

    return jsonResponse(response);
  } catch (error) {
    // Handle specific error codes with null-safe access
    const err = error as any; // Use any for safe property access

    if (err?.code === "ENOENT") {
      return errorResponse("Directory does not exist", 404);
    }

    if (err?.code === "EACCES") {
      return errorResponse("Permission denied", 403);
    }

    // Generic error
    const message = err?.message || String(error);
    return errorResponse(`Failed to list directories: ${message}`, 500);
  }
}

/**
 * Handle POST /api/change-folder - Switch working directory
 *
 * Request body:
 * - path: New directory path (required)
 *
 * Security:
 * - Path must be within home directory boundary
 * - Path must exist and be a directory
 *
 * Callback:
 * - Calls onFolderChange(path) to restart preview with new directory
 *
 * Success response:
 * - success: true
 * - path: Resolved path to new directory
 *
 * Error handling:
 * - Invalid JSON: 400 with error message
 * - Missing path field: 400 with error message
 * - Path not a string: 400 with error message
 * - Empty path: 400 with error message
 * - Path outside home: 403 with error message
 * - Path doesn't exist: 404 with error message
 * - Path not a directory: 400 with error message
 * - Restart failure: 500 with error message
 *
 * @param request - HTTP POST request with JSON body
 * @param onFolderChange - Callback to restart preview with new directory
 * @returns JSON response with FolderChangeResponse
 */
export async function handleChangeFolder(
  request: Request,
  onFolderChange: (newPath: string) => Promise<void>
): Promise<Response> {
  try {
    // Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      const response: FolderChangeResponse = {
        success: false,
        error: "Invalid JSON in request body",
      };
      return jsonResponse(response, 400);
    }

    // Validate body is an object
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      const response: FolderChangeResponse = {
        success: false,
        error: "Request body must be an object",
      };
      return jsonResponse(response, 400);
    }

    // Extract and validate path field
    const { path: newPath } = body as Record<string, unknown>;

    // Check if path field exists
    if (newPath === undefined || newPath === null) {
      const response: FolderChangeResponse = {
        success: false,
        error: "Missing required field: path",
      };
      return jsonResponse(response, 400);
    }

    // Check if path is a string
    if (typeof newPath !== "string") {
      const response: FolderChangeResponse = {
        success: false,
        error: 'Field "path" must be a string',
      };
      return jsonResponse(response, 400);
    }

    // Check if path is non-empty
    if (newPath.trim() === "") {
      const response: FolderChangeResponse = {
        success: false,
        error: "Field \"path\" cannot be empty or whitespace-only",
      };
      return jsonResponse(response, 400);
    }

    // Security check: validate path is within home directory
    const homeDir = getHomeDirectory();
    if (!isWithinHomeDirectory(newPath, homeDir)) {
      const response: FolderChangeResponse = {
        success: false,
        error: "Path is outside home directory",
      };
      return jsonResponse(response, 403);
    }

    // Validate path exists and is a directory
    if (!(await fileExists(newPath))) {
      const response: FolderChangeResponse = {
        success: false,
        error: "Path does not exist",
      };
      return jsonResponse(response, 404);
    }

    if (!(await isDirectory(newPath))) {
      const response: FolderChangeResponse = {
        success: false,
        error: "Path is not a directory",
      };
      return jsonResponse(response, 400);
    }

    // Call the restart callback
    try {
      await onFolderChange(newPath);
    } catch (error) {
      const response: FolderChangeResponse = {
        success: false,
        error: `Failed to restart preview: ${(error as Error).message}`,
      };
      return jsonResponse(response, 500);
    }

    // Success response
    const response: FolderChangeResponse = {
      success: true,
      path: newPath,
    };
    return jsonResponse(response);
  } catch (error) {
    // Generic error handler with null-safe access
    const err = error as any;
    const message = err?.message || String(error);
    logError(`Error in handleChangeFolder: ${message}`);
    const response: FolderChangeResponse = {
      success: false,
      error: `Failed to change folder: ${message}`,
    };
    return jsonResponse(response, 500);
  }
}
