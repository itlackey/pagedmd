# GitHub Issues - Code Review Remaining Items

This file contains all remaining issues from the comprehensive code review. Copy each section into a new GitHub issue.

---

## Issue 1: Add automated dependency vulnerability scanning

**Labels:** `security`, `ci/cd`, `dependencies`, `high-priority`

### Description
Currently there is no automated dependency vulnerability scanning in the CI/CD pipeline. This leaves the project vulnerable to known security issues in dependencies.

### Context
From code review (see CODE_REVIEW.md section on Dependency Security):
- No `bun audit` in CI pipeline
- No Dependabot or Renovate for automated updates
- No lock file integrity checks

### Priority
**High** - Security-related

### Impact
- Dependencies with known vulnerabilities may go undetected
- Manual security updates are error-prone
- No visibility into dependency security status

### Acceptance Criteria
- [ ] Add `bun audit` to CI workflow (`.github/workflows/ci.yml`)
- [ ] Configure Dependabot or Renovate for automated dependency updates
- [ ] Add lock file integrity check to CI
- [ ] Document security update process in CONTRIBUTING.md

### Implementation Guide

#### 1. Add to CI Workflow
```yaml
# .github/workflows/ci.yml
security-audit:
  name: Security Audit
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v1
    - run: bun install
    - run: bun audit || true  # Warn but don't fail build
```

#### 2. Setup Dependabot
Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

#### 3. Lock File Integrity
Add to CI:
```yaml
- name: Verify lock file
  run: bun install --frozen-lockfile
```

### Related Files
- `.github/workflows/ci.yml`
- `.github/dependabot.yml` (to create)
- `CODE_REVIEW.md` (line 400+)

---

## Issue 2: Fix Puppeteer installation failure in pagedjs-cli dependency

**Labels:** `testing`, `dependencies`, `ci/cd`, `medium-priority`

### Description
Integration tests fail because `pagedjs-cli` dependency cannot install Puppeteer/Chrome during `bun install`.

### Error
```
ERROR: Failed to set up Chrome r115.0.5790.98!
Download failed: server returned code 403
URL: https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/...
```

### Context
- Integration tests in `tests/integration/cli-build.test.ts` require PDF generation
- PDF generation uses `pagedjs-cli` which depends on Puppeteer
- Puppeteer tries to download Chrome binary during install but fails with 403
- Tests currently skip due to missing `pagedjs-cli`

### Priority
**Medium** - Blocks integration test execution

### Impact
- Integration tests for PDF generation cannot run
- Reduced confidence in build pipeline
- Manual testing required for PDF output

### Acceptance Criteria
- [ ] `bun install` completes successfully without Puppeteer errors
- [ ] Integration tests can generate PDFs for verification
- [ ] CI pipeline runs integration tests
- [ ] Document workaround/solution in README

### Proposed Solutions

#### Option 1: Skip Puppeteer Download (Recommended for tests)
```bash
# .github/workflows/ci.yml
env:
  PUPPETEER_SKIP_DOWNLOAD: true

# Use system Chrome or mock PDF generation in tests
```

#### Option 2: Use Alternative PDF Generator for Tests
- Replace `pagedjs-cli` with lighter mock in test environment
- Keep real `pagedjs-cli` for production builds
- Example: Mock the PDF generation step in tests

#### Option 3: Use Different Chrome Download Source
```json
// package.json
"config": {
  "puppeteer": {
    "downloadBaseUrl": "https://storage.googleapis.com/chrome-for-testing-public"
  }
}
```

#### Option 4: Pre-install Chrome in CI
```yaml
# .github/workflows/ci.yml
- name: Setup Chrome
  uses: browser-actions/setup-chrome@latest

- name: Set Puppeteer env
  run: |
    export PUPPETEER_SKIP_DOWNLOAD=true
    export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

### Related Files
- `package.json` (pagedjs-cli dependency)
- `tests/integration/cli-build.test.ts`
- `.github/workflows/ci.yml`

### Testing Steps
1. Remove `node_modules` and `bun.lock`
2. Apply fix
3. Run `bun install`
4. Verify no Puppeteer errors
5. Run `bun test tests/integration/`
6. Verify PDF generation works

---

## Issue 3: Clean up commented code and remove backup files

**Labels:** `code-quality`, `cleanup`, `low-priority`

### Description
Post-refactoring cleanup needed to remove temporary backup files and commented-out code.

### Context
From code review (CODE_REVIEW.md):
- Commented-out code exists in some files
- `src/server-old.ts` backup file should be removed after refactoring verification

### Priority
**Low** - Code quality improvement

### Impact
- Cleaner codebase
- Reduced confusion for contributors
- Smaller repository size

### Acceptance Criteria
- [ ] Remove `src/server-old.ts` backup file
- [ ] Search for and remove commented-out code
- [ ] Verify all tests still pass after cleanup
- [ ] No functionality changes, only removals

### Implementation Steps

#### 1. Remove Backup File
```bash
git rm src/server-old.ts
```

#### 2. Find Commented Code
```bash
# Search for commented code blocks
grep -r "^[[:space:]]*\/\/" src/ | grep -v "\/\/ " | head -20

# Or use ripgrep
rg "^[[:space:]]*\/\/[^\/]" src/
```

#### 3. Review and Remove
Common patterns to look for:
- `// console.log(...)`
- `// const oldVersion = ...`
- Multi-line commented blocks
- Debug statements left in

#### 4. Keep These Comments
Do NOT remove:
- JSDoc comments (`/** ... */`)
- Explanatory comments with space after `//`
- License headers
- TODO/FIXME comments (create issues for these)

#### 5. Verify
```bash
bun test
bun run lint
bun run type-check
```

### Files to Check
- `src/server-old.ts` (DELETE)
- `src/**/*.ts` (search for commented code)
- Look especially in recently modified files

---

## Issue 4: Add comprehensive JSDoc comments to refactored preview modules

**Labels:** `documentation`, `enhancement`, `low-priority`

### Description
The recently refactored preview server modules need more detailed JSDoc comments for better developer experience and code maintainability.

### Context
From code review:
- New modules in `src/preview/` have basic documentation
- Some complex functions lack detailed JSDoc
- Parameter descriptions and return types need expansion
- Examples would help developers understand usage

### Priority
**Low** - Documentation improvement

### Impact
- Better IntelliSense/autocomplete in IDEs
- Easier onboarding for new contributors
- Self-documenting code
- Improved API clarity

### Acceptance Criteria
- [ ] All exported functions have JSDoc comments
- [ ] Complex internal functions have JSDoc
- [ ] Parameters and return types are documented
- [ ] Add usage examples where helpful
- [ ] Document error conditions and edge cases

### Files Needing Documentation

#### Priority 1 (Public APIs)
- `src/preview/api-middleware.ts`
  - `createApiMiddleware()` - Main middleware factory
  - Route handlers (`handleHeartbeat`, etc.)

- `src/preview/lifecycle.ts`
  - `initializePreviewDirectories()`
  - `restartPreview()`
  - `shutdownServer()`
  - `checkForAutoShutdown()`

- `src/preview/file-watcher.ts`
  - `createFileWatcher()`
  - `generateAndWriteHtml()`

#### Priority 2 (Helper Functions)
- `src/preview/vite-setup.ts`
  - `createConfiguredViteServer()`
  - `findAvailablePort()`

### JSDoc Template

```typescript
/**
 * Brief one-line description
 *
 * Longer description with:
 * - What the function does
 * - When to use it
 * - Important behavior notes
 *
 * @param paramName - Description of parameter
 * @param options - Configuration options
 * @param options.verbose - Enable verbose logging
 * @returns Description of return value
 * @throws {ErrorType} When error condition occurs
 *
 * @example
 * ```typescript
 * const result = await functionName(input, { verbose: true });
 * console.log(result);
 * ```
 */
export async function functionName(
  paramName: string,
  options: Options
): Promise<Result> {
  // implementation
}
```

### Examples of Good Documentation

See existing examples in:
- `src/types.ts` - Interface documentation
- `src/utils/file-utils.ts` - Function documentation
- `src/config/config-state.ts` - Class documentation

### Testing
No code changes, so tests remain the same. Verify:
- JSDoc renders correctly in IDE
- No TypeScript errors from JSDoc types
- Documentation is accurate

---

## Issue 5: Create SECURITY.md with vulnerability reporting policy

**Labels:** `documentation`, `security`, `low-priority`

### Description
Add a SECURITY.md file to document security policies and vulnerability reporting procedures.

### Context
From code review (CODE_REVIEW.md):
- Missing SECURITY.md documentation
- No documented vulnerability reporting process
- GitHub recommends SECURITY.md for all public repos

Note: While this is a single-user local app, having security documentation:
- Shows professionalism
- Helps if project becomes multi-user
- Provides guidance for dependency vulnerabilities

### Priority
**Low** - Documentation (but good practice)

### Impact
- Clear security expectations
- Documented vulnerability reporting
- GitHub displays in Security tab
- Better project governance

### Acceptance Criteria
- [ ] Create `SECURITY.md` in repository root
- [ ] Document supported versions
- [ ] Provide vulnerability reporting instructions
- [ ] Link to dependency security process
- [ ] Keep it concise (single-user app)

### Implementation

See complete SECURITY.md template in issue details on GitHub.

Key sections:
1. Supported Versions table
2. Reporting a Vulnerability process
3. Security Best Practices (users & contributors)
4. Dependency Security process
5. Known Issues links
6. Security Features list

### Related Files
- `CONTRIBUTING.md` - Link security guidelines
- `README.md` - Add security badge
- `.github/workflows/ci.yml` - Security audit job

---

## Issue 6: Replace 'any' type casts with proper type narrowing

**Labels:** `type-safety`, `code-quality`, `enhancement`, `low-priority`

### Description
Improve type safety by replacing remaining `any` type casts with proper TypeScript type narrowing and guards.

### Context
From code review (CODE_REVIEW.md):
- Some `as any` casts remain in the codebase
- Specifically in `src/utils/config.ts` around line 423
- While functional, these reduce type safety benefits

### Priority
**Low** - Type safety improvement (nice-to-have)

### Impact
- Better compile-time type checking
- Catches potential runtime errors earlier
- Improved IDE autocomplete
- Better code documentation

### Acceptance Criteria
- [ ] Identify all `as any` casts in codebase
- [ ] Replace with proper type guards or narrowing
- [ ] Add runtime validation where needed
- [ ] All tests still pass
- [ ] No new TypeScript errors

### Implementation Guide

#### 1. Find All 'any' Casts
```bash
# Search for 'as any' casts
rg "as any" src/

# Search for type assertions that might hide issues
rg "as \w+" src/ | grep -v "as const"
```

#### 2. Type Narrowing Pattern Example

**Before (with 'any'):**
```typescript
const validFormats = ['html', 'pdf', 'preview'] as const;
const normalized = format.toLowerCase();

if (!validFormats.includes(normalized as any)) {
  throw new Error('Invalid format');
}
```

**After (with type guard):**
```typescript
const validFormats = ['html', 'pdf', 'preview'] as const;
type ValidFormat = typeof validFormats[number];

function isValidFormat(value: string): value is ValidFormat {
  return validFormats.includes(value as ValidFormat);
}

const normalized = format.toLowerCase();
if (!isValidFormat(normalized)) {
  throw new Error('Invalid format');
}

return normalized; // TypeScript now knows it's ValidFormat
```

### Files to Check
- `src/utils/config.ts` (line ~423)
- Search entire codebase for other instances

### Testing
```bash
bun run type-check
bun test
bun run lint
```

### Alternative: Runtime Validation
Consider using Zod for complex validation needs with automatic TypeScript inference.

---

## Summary

**Total Issues:** 6
- **High Priority:** 1 (Dependency scanning)
- **Medium Priority:** 1 (Puppeteer fix)
- **Low Priority:** 4 (Cleanup, docs, type safety)

**Estimated Effort:**
- Quick wins (<1 hour): Issues #1, #3
- Moderate (1-2 hours): Issues #2, #5
- Low effort (30-60 min): Issues #4, #6

**Current Status:** 76% complete (25/33 items addressed)
**Target:** A+ grade (90%+ complete)
