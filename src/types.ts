/**
 * Shared TypeScript interfaces for pagedmd CLI
 *
 * These types define the core data structures used throughout the application
 * for configuration, build options, and preview settings.
 *
 * Type Safety Guidelines:
 * - No `any` types in public APIs
 * - Use `unknown` for truly unknown values
 * - Use proper generic constraints
 * - Document complex types with JSDoc
 */

import type { ServerWebSocket } from 'bun';

/**
 * Configuration object parsed from CLI arguments and configuration files
 */
export interface Config {
  /** Verbose logging enabled */
  verbose: boolean;
  /** Debug mode (preserves temporary files) */
  debug: boolean;
  /** Timeout for PDF generation in milliseconds */
  timeout: number;
}

/**
 * Output format types for build command
 */
export enum OutputFormat {
  HTML = 'html',
  PDF = 'pdf',
  PREVIEW = 'preview'
}

/**
 * Options for building PDF from markdown
 */
export interface BuildOptions {
  /** Input markdown file path or directory (optional, defaults to cwd) */
  input?: string;
  /** Output PDF file path (absolute, optional - defaults to input.pdf) */
  output?: string;
  /** Optional HTML output path (absolute, for debugging) */
  htmlOutput?: string;
  /** Timeout for PDF generation in milliseconds */
  timeout?: number;
  /** Verbose logging */
  verbose?: boolean;
  /** Debug mode (preserve temporary files) */
  debug?: boolean;
  /** Output format (html, pdf, or preview) */
  format?: OutputFormat;
  /** Enable watch mode for automatic rebuilds */
  watch?: boolean;
  /** Force overwrite existing output without validation */
  force?: boolean;
  /** Enable detailed performance profiling */
  profile?: boolean;
}

/**
 * Options for preview server (internal)
 * Used by preview-server.ts implementation
 */
export interface PreviewServerOptions  {
  /** Input markdown file path or directory (optional, defaults to cwd) */
  input?: string;
  /** Debug mode (preserve temporary files) */
  debug?: boolean;
  /** Port for preview server */
  port: number;
  /** Enable verbose logging */
  verbose: boolean;
  /** Disable file watching */
  noWatch: boolean;
  /** Automatically open browser (default: true) */
  openBrowser: boolean;
}

/**
 * Project manifest configuration (manifest.yaml)
 * Used for project metadata and custom CSS configuration
 */
export interface Manifest {
  /** Project title (overrides front matter) */
  title?: string;

  /** Project authors (array to support multiple authors) */
  authors?: string[];

  /** Page format configuration */
  format?: PageFormat;

  /** Custom CSS files (paths relative to manifest.yaml) */
  styles?: string[];

  /** Disable default styles (advanced use case) */
  disableDefaultStyles?: boolean;

  /** Markdown extensions to enable (e.g., ['ttrpg', 'dimm-city']). If not specified, all extensions are enabled. @deprecated Use plugins instead. */
  extensions?: string[];

  /** Markdown-it plugins to load (local files, npm packages, or built-in). */
  plugins?: Array<string | {
    type?: 'local' | 'package' | 'builtin' | 'remote';
    path?: string;
    name?: string;
    version?: string;
    url?: string;
    integrity?: string;
    enabled?: boolean;
    options?: Record<string, any>;
    priority?: number;
  }>;

  /** Ordered list of markdown files to include (paths relative to manifest.yaml). If not specified, all .md files are included in alphabetical order. */
  files?: string[];

  /** Additional book metadata for PDF output */
  metadata?: ManifestMetadata;
}

/**
 * Additional metadata for manifest configuration
 */
export interface ManifestMetadata {
  /** Primary author name (can differ from authors list) */
  author?: string;

  /** Publication date (free-form string, e.g., "2025-01-15" or "January 2025") */
  date?: string;

  /** ISBN (International Standard Book Number) */
  isbn?: string;
}

/**
 * Result from PDF generation
 */
export interface PDFGenerationResult {
  /** Path to generated PDF file */
  outputPath: string;
  /** Generation time in milliseconds */
  duration: number;
  /** Success status */
  success: boolean;
}

/**
 * TTRPG Directive System Types
 * Added for directive-based markdown system (spec 002)
 */

/**
 * Directive type for page layout control
 */
export type DirectiveType = 'page' | 'break' | 'spread' | 'columns';

/**
 * Page template names for Paged.js @page rules
 */
export type PageTemplateName =
  | 'chapter'      // Chapter openings (auto-applied to H1)
  | 'art'          // Full-bleed artwork (auto-applied to .full-bleed images)
  | 'body'         // Body content (default) - universal for all book types
  | 'appendix'     // Back matter
  | 'frontmatter'  // Title page, TOC (roman numerals)
  | 'cover'        // Book cover (full-bleed, no page numbers)
  | 'title-page'   // Title page (no page numbers)
  | 'credits'      // Credits page
  | 'toc'          // Table of contents
  | 'glossary'     // Glossary/index (two-column friendly)
  | 'blank';       // Intentionally blank pages

/**
 * Callout types for blockquote syntax
 */
export type CalloutType = 'note' | 'tip' | 'warning' | 'danger' | 'info';

/**
 * Directive parsed from HTML comment
 */
export interface Directive {
  /** Directive category */
  type: DirectiveType;
  /** Directive value (null for 'break' type) */
  value: string | number | null;
  /** Location in source markdown (for error reporting) */
  sourcePosition?: { line: number; column: number };
}

/**
 * Styled content block (callout)
 */
export interface Callout {
  /** Visual style and indicator */
  type: CalloutType;
  /** Custom title (defaults to capitalized type name) */
  title?: string;
  /** Markdown content (will be parsed) */
  content: string;
}

/**
 * Character or monster ability
 */
export interface Ability {
  /** Ability name */
  name: string;
  /** Markdown description */
  description: string;
  /** Cost to use (optional) */
  cost?: string;
  /** Range (optional) */
  range?: string;
}

/**
 * Structured stat block for characters/monsters
 */
export interface ProfileContainer {
  /** Character/monster name */
  name: string;
  /** Portrait image path (optional) */
  image?: string;
  /** Key-value stats */
  attributes?: Record<string, string | number>;
  /** Special abilities/traits */
  abilities?: Ability[];
  /** Flavor text */
  description?: string;
}

/**
 * Page format configuration
 */
export interface PageFormat {
  /** Page size (e.g., '6in 9in', 'A4', '8.5in 11in') */
  size?: string;
  /** Margins (e.g., '0.75in 0.5in' or '20mm') */
  margins?: string;
  /** Bleed zone (e.g., '0.125in', '3mm') */
  bleed?: string;
  /** Color mode for output */
  colorMode?: 'rgb' | 'cmyk';
}

/**
 * WebSocket client connection tracking
 *
 * Used by preview server to track connected clients.
 */
export interface WebSocketClient {
  /** WebSocket connection */
  ws: ServerWebSocket<unknown>;
}

/**
 * WebSocket message types for live updates
 */
export type WebSocketMessage =
  | { type: 'content-update'; trigger: 'markdown' | 'css' | 'manifest'; html: string }
  | { type: 'files-changed'; files: string[] }  // Phase 3: Simplified unified message
  | { type: 'pong' }
  // Legacy message types (backward compatibility)
  | { type: 'reload' }
  | { type: 'html-update'; html: string }
  | { type: 'css-update'; timestamp: number; files?: string[] };

/**
 * Options for Dimm City markdown plugin
 *
 * Controls which inline syntax extensions are enabled.
 */
export interface DimmCityPluginOptions {
  /** Enable stat block syntax: {HP:12 DMG:3} */
  statBlocks?: boolean;
  /** Enable dice notation: 2d6+3 */
  diceNotation?: boolean;
  /** Enable cross references: @[NPC:investigator] */
  crossReferences?: boolean;
  /** Enable trait callouts: ::trait[Shadow Step] */
  traitCallouts?: boolean;
  /** Enable district badges: #TechD, #Dark */
  districtBadges?: boolean;
  /** Enable challenge ratings: CR:4 */
  challengeRatings?: boolean;
  /** Enable roll prompts: ROLL A DIE! */
  rollPrompts?: boolean;
  /** Enable terminology auto-styling */
  terminology?: boolean;
}

/**
 * File watch event
 */
export interface FileWatchEvent {
  /** Type of file system event */
  eventType: 'rename' | 'change';
  /** File name that changed (relative to watched directory) */
  filename: string | null;
}

/**
 * Directory entry for folder navigation
 */
export interface DirectoryEntry {
  /** Directory name */
  name: string;
  /** Full path to directory */
  path: string;
}

/**
 * API response for directory listing
 */
export interface DirectoryListResponse {
  /** Current path being listed */
  currentPath: string;
  /** User's home directory */
  homeDirectory: string;
  /** Whether current path is the home directory */
  isAtHome: boolean;
  /** Parent directory path (undefined if at home or if parent is outside home) */
  parent?: string;
  /** List of subdirectories */
  directories: DirectoryEntry[];
}

/**
 * API response for folder change
 */
export interface FolderChangeResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** New path (if successful) */
  path?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * API response for current folder
 */
export interface CurrentFolderResponse {
  /** Current input path (file or directory) */
  path: string;
  /** Current input directory */
  directory: string;
}

/**
 * API response for metadata
 */
export interface MetadataResponse {
  /** Title from manifest (if present) */
  title: string | null;
  /** Folder name */
  folderName: string;
  /** Display title (manifest title or folder name) */
  displayTitle: string;
  /** Error message (if metadata loading failed) */
  error?: string;
}

/**
 * Format-specific build strategy interface
 * Each format (PDF, HTML, Preview) implements this interface
 */
export interface FormatStrategy {
  /**
   * Execute build for this format
   * @param options Build configuration
   * @param htmlContent Generated HTML content
   * @returns Path to generated output
   */
  build(options: BuildOptions, htmlContent: string): Promise<string>;

  /**
   * Validate output path for this format
   * @param path Output path to validate
   * @param force Whether to skip validation
   * @returns Validation result
   */
  validateOutputPath(path: string, force: boolean): OutputValidation;

  /**
   * Clean up temporary files if any
   * @param options Build configuration
   */
  cleanup(options: BuildOptions): Promise<void>;
}

/**
 * Result of output path validation
 */
export interface OutputValidation {
  /** Whether output path is valid for format */
  isValid: boolean;
  /** Type of conflict detected */
  conflictType: 'none' | 'file-for-directory' | 'directory-for-file' | 'parent-missing';
  /** Human-readable error or success message */
  message: string;
  /** Suggestion for resolving conflict */
  suggestedFix: string | null;
}

/**
 * Runtime state for watch mode operation
 */
export interface WatchContext {
  /** Node.js file system watcher instance */
  watcher: ReturnType<typeof import('fs').watch> | null;
  /** Active debounce timer for change accumulation */
  debounceTimer: NodeJS.Timeout | null;
  /** Accumulated file paths pending rebuild */
  pendingChanges: Set<string>;
  /** Active output format for rebuilds */
  format: OutputFormat;
  /** Build configuration */
  buildOptions: BuildOptions;
  /** Flag to prevent overlapping builds */
  isBuilding: boolean;
  /** Timestamp of last successful build */
  lastBuildTime: number;
  /** Rebuild queued for after current build completes */
  pendingRebuildRequest: boolean;
  /** Count of consecutive build failures */
  consecutiveFailures: number;
  /** Timestamp of last failure for backoff calculations */
  lastFailureTime: number;
}

/**
 * Information about detected file system change
 */
export interface BuildFileChangeEvent {
  /** Absolute path to changed file */
  path: string;
  /** Type of change detected */
  type: 'add' | 'change' | 'unlink';
  /** Unix timestamp when change detected */
  timestamp: number;
  /** Whether file is an asset (image, font, etc.) */
  isAsset: boolean;
  /** Whether file is markdown (.md) */
  isMarkdown: boolean;
  /** Whether file is CSS (.css) */
  isCSS: boolean;
  /** Whether file is manifest.yaml */
  isManifest: boolean;
}

/**
 * Result from CSS import resolution
 * Used by css-utils.ts to report both success and failures
 */
export interface ImportResolutionResult {
  /** CSS content with all imports resolved and inlined */
  resolvedCSS: string;
  /** Non-critical warnings (e.g., missing files when failOnMissing=false) */
  warnings: string[];
  /** Critical errors (e.g., circular imports, missing files when failOnMissing=true) */
  errors: string[];
}

/**
 * GitHub authentication status response
 */
export interface GitHubAuthStatus {
  /** Whether gh CLI is installed */
  ghCliInstalled: boolean;
  /** Whether user is authenticated with GitHub */
  authenticated: boolean;
  /** GitHub username if authenticated */
  username?: string;
  /** Error message if status check failed */
  error?: string;
}

/**
 * GitHub clone request
 */
export interface GitHubCloneRequest {
  /** GitHub repository URL (https://github.com/owner/repo or owner/repo) */
  repoUrl: string;
  /** Optional target directory for cloning (defaults to ~/.pagedmd/cloned-repos) */
  targetDirectory?: string;
}

/**
 * GitHub clone response
 */
export interface GitHubCloneResponse {
  /** Whether clone was successful */
  success: boolean;
  /** Local path to cloned repository */
  localPath?: string;
  /** Error message if clone failed */
  error?: string;
}

/**
 * GitHub user information
 */
export interface GitHubUserInfo {
  /** GitHub username */
  username: string;
  /** Display name */
  name?: string;
}

/**
 * GitHub login response
 */
export interface GitHubLoginResponse {
  /** Whether login was successful */
  success: boolean;
  /** Error message if login failed */
  error?: string;
}
