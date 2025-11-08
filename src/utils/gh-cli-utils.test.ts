/**
 * Tests for GitHub CLI utilities
 */

import { test, expect, describe } from "bun:test";
import {
  parseGitHubUrl,
  getClonedReposDirectory,
} from "./gh-cli-utils";
import path from "path";

describe("parseGitHubUrl", () => {
  test("parses HTTPS URL", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  test("parses HTTPS URL with .git extension", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  test("parses SSH URL", () => {
    const result = parseGitHubUrl("git@github.com:owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  test("parses shorthand owner/repo format", () => {
    const result = parseGitHubUrl("owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  test("parses URL with trailing slash", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  test("returns null for invalid URL", () => {
    expect(parseGitHubUrl("not-a-valid-url")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseGitHubUrl("")).toBeNull();
  });

  test("returns null for URL without owner", () => {
    expect(parseGitHubUrl("https://github.com/repo")).toBeNull();
  });

  test("handles URL with extra path components", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/tree/main");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  test("trims whitespace", () => {
    const result = parseGitHubUrl("  owner/repo  ");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });
});

describe("getClonedReposDirectory", () => {
  test("returns path in .pagedmd/cloned-repos", () => {
    const dir = getClonedReposDirectory();
    expect(dir).toContain(".pagedmd");
    expect(dir).toContain("cloned-repos");
  });

  test("returns absolute path", () => {
    const dir = getClonedReposDirectory();
    expect(path.isAbsolute(dir)).toBe(true);
  });
});
