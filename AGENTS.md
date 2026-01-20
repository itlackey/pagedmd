# AGENTS.md (pagedmd)

## TL;DR

- Runtime: Bun >= 1.0, Node >= 22; TS ESM (`type: module`)
- Purpose: Markdown -> HTML -> PDF (Vivliostyle bundled; optional Prince/DocRaptor)
- Docs: `CLAUDE.md`, `.github/copilot-instructions.md`, `docs/ARCHITECTURE.md`
- Cursor rules: none in `.cursor/rules/` or `.cursorrules`

## Commands

```bash
# deps
bun install

# build distributable (dist/)
bun run build

# run from source
bun src/cli.ts build [input]
bun src/cli.ts preview [input]

# lint/format/typecheck
bun run lint
bun run lint:fix
bun run format
bun run format:check
bun run type-check

# tests
bun test
bun test src/utils/css-utils.test.ts        # single test file
bun test --watch                            # watch
bun run test:coverage
```

Preview note: changes in `src/assets/` require preview server restart (assets bundled at startup).

## Style + Architecture Rules

**Config cascade**: CLI > `manifest.yaml` > defaults.

**CSS cascade**: default styles -> plugin CSS -> theme styles -> user styles.

**Prettier** (`.prettierrc.json`): `semi: true`, `"` quotes, `printWidth: 100`, `trailingComma: es5`, `endOfLine: lf`.

**ESLint** (`.eslintrc.json`):

- errors: no `any`, no unused vars (allow `_` prefix), no floating promises, no unsafe-any flows
- `no-console` warn (allow `console.warn/error`), `eqeqeq`, `prefer-const`, `no-var`, `no-throw-literal`

**TypeScript** (`tsconfig.json`): `strict`, `noUncheckedIndexedAccess`, `allowImportingTsExtensions`, `moduleResolution: bundler`.

**Imports**:

- ESM only; prefer relative imports within `src/`
- use `import type { ... }` for type-only imports
- group: built-ins -> deps -> internal

**Naming**:

- files: kebab-case; classes/types: PascalCase; funcs/vars: camelCase

**Errors**:

- build failures: throw `BuildError`
- config/manifest issues: throw `ConfigError(message, suggestion?)`

**Logging**:

- prefer `src/utils/logger.ts` (`debug/info/warn/error`) over raw console.

**Safety**:

- validate user paths via `src/utils/path-security.ts` + `src/utils/path-validation.ts`.

## Where to Look

- CLI: `src/cli.ts`
- Build: `src/build/build.ts`, `src/build/formats/pdf-format.ts`, `src/build/formats/vivliostyle-wrapper.ts`
- Markdown + CSS inlining: `src/markdown/markdown.ts`, `src/utils/css-utils.ts`
- Manifest schema: `src/schemas/manifest.schema.ts`
- Errors: `src/utils/errors.ts`
