/**
 * Tests for API route handlers
 *
 * Validates directory listing and folder change functionality
 */

import { test, expect, describe } from "bun:test";
import { handleListDirectories, handleChangeFolder } from "./routes";
import { getHomeDirectory } from "../utils/path-security";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("handleListDirectories", () => {
  test("returns home directory when no path parameter provided", async () => {
    const request = new Request("http://localhost:3000/api/directories");
    const response = await handleListDirectories(request);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.currentPath).toBe(getHomeDirectory());
    expect(data.isAtHome).toBe(true);
    expect(data.parent).toBeUndefined();
    expect(Array.isArray(data.directories)).toBe(true);
  });

  test("returns 404 for non-existent directory within home", async () => {
    const homeDir = getHomeDirectory();
    const nonExistentPath = join(homeDir, "definitely-does-not-exist-" + Date.now());
    const request = new Request(
      `http://localhost:3000/api/directories?path=${encodeURIComponent(
        nonExistentPath
      )}`
    );
    const response = await handleListDirectories(request);

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toContain("does not exist");
  });

  test("falls back to home directory for paths outside home", async () => {
    const outsidePath = "/tmp/outside-home-" + Date.now();
    const request = new Request(
      `http://localhost:3000/api/directories?path=${encodeURIComponent(
        outsidePath
      )}`
    );
    const response = await handleListDirectories(request);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.currentPath).toBe(getHomeDirectory());
    expect(data.isAtHome).toBe(true);
  });

  test("lists subdirectories correctly", async () => {
    // Create temp directory within home directory
    const homeDir = getHomeDirectory();
    const tempDir = await mkdtemp(join(homeDir, ".pagedmd-test-"));
    await mkdir(join(tempDir, "subdir1"));
    await mkdir(join(tempDir, "subdir2"));
    await mkdir(join(tempDir, ".hidden")); // Should be excluded

    try {
      const request = new Request(
        `http://localhost:3000/api/directories?path=${encodeURIComponent(
          tempDir
        )}`
      );
      const response = await handleListDirectories(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.currentPath).toBe(tempDir);
      expect(data.directories.length).toBe(2);
      expect(data.directories[0].name).toBe("subdir1");
      expect(data.directories[1].name).toBe("subdir2");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("includes parent directory when not at home", async () => {
    // Create temp directory within home directory
    const homeDir = getHomeDirectory();
    const tempDir = await mkdtemp(join(homeDir, ".pagedmd-test-"));
    const subDir = join(tempDir, "subdir");
    await mkdir(subDir);

    try {
      const request = new Request(
        `http://localhost:3000/api/directories?path=${encodeURIComponent(
          subDir
        )}`
      );
      const response = await handleListDirectories(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.currentPath).toBe(subDir);
      expect(data.isAtHome).toBe(false);
      expect(data.parent).toBe(tempDir);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("handleChangeFolder", () => {
  test("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost:3000/api/change-folder", {
      method: "POST",
      body: "not valid json",
    });

    const mockCallback = async () => {};
    const response = await handleChangeFolder(request, mockCallback);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid JSON");
  });

  test("returns 400 for missing path field", async () => {
    const request = new Request("http://localhost:3000/api/change-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const mockCallback = async () => {};
    const response = await handleChangeFolder(request, mockCallback);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Missing required field");
  });

  test("returns 400 for non-string path", async () => {
    const request = new Request("http://localhost:3000/api/change-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: 123 }),
    });

    const mockCallback = async () => {};
    const response = await handleChangeFolder(request, mockCallback);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("must be a string");
  });

  test("returns 400 for empty path", async () => {
    const request = new Request("http://localhost:3000/api/change-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "   " }),
    });

    const mockCallback = async () => {};
    const response = await handleChangeFolder(request, mockCallback);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("cannot be empty");
  });

  test("returns 404 for non-existent path", async () => {
    const homeDir = getHomeDirectory();
    const nonExistentPath = join(homeDir, "definitely-does-not-exist-" + Date.now());
    const request = new Request("http://localhost:3000/api/change-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: nonExistentPath }),
    });

    const mockCallback = async () => {};
    const response = await handleChangeFolder(request, mockCallback);

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("does not exist");
  });

  test("successfully changes folder and calls callback", async () => {
    // Create temp directory within home directory
    const homeDir = getHomeDirectory();
    const tempDir = await mkdtemp(join(homeDir, ".pagedmd-test-"));

    try {
      let callbackCalled = false;
      let callbackPath = "";

      const mockCallback = async (newPath: string) => {
        callbackCalled = true;
        callbackPath = newPath;
      };

      const request = new Request("http://localhost:3000/api/change-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: tempDir }),
      });

      const response = await handleChangeFolder(request, mockCallback);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.path).toBe(tempDir);
      expect(callbackCalled).toBe(true);
      expect(callbackPath).toBe(tempDir);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("returns 500 when callback throws error", async () => {
    const homeDir = getHomeDirectory();
    const tempDir = await mkdtemp(join(homeDir, ".pagedmd-test-"));

    try {
      const mockCallback = async () => {
        throw new Error("Restart failed");
      };

      const request = new Request("http://localhost:3000/api/change-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: tempDir }),
      });

      const response = await handleChangeFolder(request, mockCallback);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to restart preview");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
