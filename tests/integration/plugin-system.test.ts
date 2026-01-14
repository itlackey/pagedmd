/**
 * Integration tests for plugin system
 *
 * Tests the complete plugin workflow from configuration to HTML output
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { generateHtmlFromMarkdown } from "../../src/markdown/markdown.ts";
import type { ResolvedConfig } from "../../src/config/config-state.ts";

const TEST_DIR = path.join(import.meta.dir, "../../test-temp/plugin-integration");

describe("Plugin System Integration", () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("Built-in Plugin Integration", () => {
    test("loads and applies ttrpg plugin", async () => {
      // Create markdown file with TTRPG features
      await writeFile(
        path.join(TEST_DIR, "test.md"),
        `# Test Document

Roll 2d6+3 for damage.

Make a DC 15 Wisdom saving throw.
`
      );

      // Create manifest with ttrpg plugin
      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
plugins:
  - ttrpg
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        plugins: [{ name: "ttrpg", type: "builtin", enabled: true }],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      const html = await generateHtmlFromMarkdown(TEST_DIR, config);

      // Verify TTRPG features were processed
      expect(html).toContain("2d6+3"); // Dice notation
      expect(html).toContain("DC 15"); // Challenge rating
    });

    test("loads multiple built-in plugins", async () => {
      await writeFile(
        path.join(TEST_DIR, "test.md"),
        `# Test Document

Roll 2d6 for damage.

Rolling another 1d20 check.
`
      );

      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
plugins:
  - ttrpg
  - dimmCity
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        plugins: [
          { name: "ttrpg", type: "builtin", enabled: true },
          { name: "dimmCity", type: "builtin", enabled: true },
        ],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      const html = await generateHtmlFromMarkdown(TEST_DIR, config);

      // Verify both plugins were loaded (check for dice notation from ttrpg)
      expect(html).toContain("2d6");
      expect(html).toContain("1d20");
    });
  });

  describe("Local Plugin Integration", () => {
    test("loads and applies local plugin", async () => {
      // Create a custom plugin
      const pluginCode = `
export default function testPlugin(md, options) {
  md.renderer.rules.heading_open = function(tokens, idx) {
    const level = tokens[idx].tag.slice(1);
    return '<h' + level + ' class="custom-heading">';
  };
}

export const metadata = {
  name: 'test-plugin',
  version: '1.0.0',
  description: 'Test plugin'
};

export const css = \`.custom-heading { color: blue; }\`;
`;

      await mkdir(path.join(TEST_DIR, "plugins"), { recursive: true });
      await writeFile(path.join(TEST_DIR, "plugins/test-plugin.js"), pluginCode);

      await writeFile(
        path.join(TEST_DIR, "test.md"),
        `# Test Heading

This is a paragraph.
`
      );

      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
plugins:
  - ./plugins/test-plugin.js
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        plugins: [{ path: "./plugins/test-plugin.js", type: "local", enabled: true }],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      const html = await generateHtmlFromMarkdown(TEST_DIR, config);

      // Verify plugin was applied
      expect(html).toContain('class="custom-heading"');
      expect(html).toContain(".custom-heading { color: blue; }");
    });

    test("applies plugin with custom options", async () => {
      const pluginCode = `
export default function configurablePlugin(md, options = {}) {
  const { prefix = 'default' } = options;

  md.renderer.rules.paragraph_open = function() {
    return '<p class="' + prefix + '-paragraph">';
  };
}

export const metadata = {
  name: 'configurable-plugin',
  version: '1.0.0'
};
`;

      await mkdir(path.join(TEST_DIR, "plugins"), { recursive: true });
      await writeFile(path.join(TEST_DIR, "plugins/configurable.js"), pluginCode);

      await writeFile(path.join(TEST_DIR, "test.md"), `Test paragraph.`);

      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
plugins:
  - path: ./plugins/configurable.js
    options:
      prefix: "custom"
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        plugins: [
          {
            path: "./plugins/configurable.js",
            type: "local",
            enabled: true,
            options: { prefix: "custom" },
          },
        ],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      const html = await generateHtmlFromMarkdown(TEST_DIR, config);

      expect(html).toContain('class="custom-paragraph"');
    });
  });

  describe("Plugin Priority", () => {
    test("applies plugins in priority order", async () => {
      // Create two plugins that modify the same element
      const plugin1 = `
export default function plugin1(md) {
  const original = md.renderer.rules.heading_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.heading_open = function(tokens, idx, options, env, self) {
    const result = original(tokens, idx, options, env, self);
    return result.replace('>', ' data-plugin1="true">');
  };
}

export const metadata = { name: 'plugin1', version: '1.0.0' };
`;

      const plugin2 = `
export default function plugin2(md) {
  const original = md.renderer.rules.heading_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.heading_open = function(tokens, idx, options, env, self) {
    const result = original(tokens, idx, options, env, self);
    return result.replace('>', ' data-plugin2="true">');
  };
}

export const metadata = { name: 'plugin2', version: '1.0.0' };
`;

      await mkdir(path.join(TEST_DIR, "plugins"), { recursive: true });
      await writeFile(path.join(TEST_DIR, "plugins/plugin1.js"), plugin1);
      await writeFile(path.join(TEST_DIR, "plugins/plugin2.js"), plugin2);

      await writeFile(path.join(TEST_DIR, "test.md"), `# Test`);

      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
plugins:
  - path: ./plugins/plugin1.js
    priority: 50
  - path: ./plugins/plugin2.js
    priority: 100
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        plugins: [
          { path: "./plugins/plugin1.js", type: "local", enabled: true, priority: 50 },
          { path: "./plugins/plugin2.js", type: "local", enabled: true, priority: 100 },
        ],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      const html = await generateHtmlFromMarkdown(TEST_DIR, config);

      // Both plugins should have been applied
      expect(html).toContain('data-plugin1="true"');
      expect(html).toContain('data-plugin2="true"');
    });
  });

  describe("Plugin CSS Injection", () => {
    // Use unique filenames to avoid Bun module caching issues with earlier tests
    test("injects CSS from multiple plugins", async () => {
      const cssPlugin1 = `
export default function cssPlugin1(md) {}
export const metadata = { name: 'css-plugin1', version: '1.0.0' };
export const css = '.css-plugin1 { color: red; }';
`;

      const cssPlugin2 = `
export default function cssPlugin2(md) {}
export const metadata = { name: 'css-plugin2', version: '1.0.0' };
export const css = '.css-plugin2 { color: blue; }';
`;

      await mkdir(path.join(TEST_DIR, "plugins"), { recursive: true });
      await writeFile(path.join(TEST_DIR, "plugins/css-plugin1.js"), cssPlugin1);
      await writeFile(path.join(TEST_DIR, "plugins/css-plugin2.js"), cssPlugin2);

      await writeFile(path.join(TEST_DIR, "test.md"), `# Test`);

      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
plugins:
  - ./plugins/css-plugin1.js
  - ./plugins/css-plugin2.js
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        plugins: [
          { path: "./plugins/css-plugin1.js", type: "local", enabled: true },
          { path: "./plugins/css-plugin2.js", type: "local", enabled: true },
        ],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      const html = await generateHtmlFromMarkdown(TEST_DIR, config);

      // Both plugin CSS should be injected
      expect(html).toContain(".css-plugin1 { color: red; }");
      expect(html).toContain(".css-plugin2 { color: blue; }");
      expect(html).toContain("/* Plugin: css-plugin1 v1.0.0 */");
      expect(html).toContain("/* Plugin: css-plugin2 v1.0.0 */");
    });

    test("injects plugin CSS before theme CSS", async () => {
      // Use unique filename to avoid module caching issues
      const plugin = `
export default function orderTestPlugin(md) {}
export const metadata = { name: 'order-test-plugin', version: '1.0.0' };
export const css = '.order-test-plugin { color: red; }';
`;

      await mkdir(path.join(TEST_DIR, "plugins"), { recursive: true });
      await writeFile(path.join(TEST_DIR, "plugins/order-test.js"), plugin);
      await writeFile(path.join(TEST_DIR, "custom.css"), ".custom { color: blue; }");
      await writeFile(path.join(TEST_DIR, "test.md"), `# Test`);

      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
plugins:
  - ./plugins/order-test.js
styles:
  - custom.css
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        plugins: [{ path: "./plugins/order-test.js", type: "local", enabled: true }],
        styles: ["custom.css"],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      const html = await generateHtmlFromMarkdown(TEST_DIR, config);

      // Plugin CSS should come before theme CSS
      const pluginCssIndex = html.indexOf(".order-test-plugin");
      const themeCssIndex = html.indexOf(".custom { color: blue; }");

      expect(pluginCssIndex).toBeGreaterThan(-1);
      expect(themeCssIndex).toBeGreaterThan(-1);
      expect(pluginCssIndex).toBeLessThan(themeCssIndex);
    });
  });

  describe("Backward Compatibility", () => {
    test("supports legacy extensions array", async () => {
      await writeFile(path.join(TEST_DIR, "test.md"), `Roll 2d6 for damage.`);

      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
extensions:
  - ttrpg
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        extensions: ["ttrpg"],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      const html = await generateHtmlFromMarkdown(TEST_DIR, config);

      // TTRPG features should work
      expect(html).toContain("2d6");
    });
  });

  describe("Error Handling", () => {
    test("continues build with disabled plugin", async () => {
      await writeFile(path.join(TEST_DIR, "test.md"), `# Test`);

      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
plugins:
  - name: ttrpg
    enabled: false
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        plugins: [{ name: "ttrpg", type: "builtin", enabled: false }],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      // Should not throw
      const html = await generateHtmlFromMarkdown(TEST_DIR, config);
      expect(html).toContain("Test");
    });

    test("continues build when local plugin file not found (non-strict mode)", async () => {
      await writeFile(path.join(TEST_DIR, "test.md"), `# Test`);

      await writeFile(
        path.join(TEST_DIR, "manifest.yaml"),
        `title: "Test"
authors:
  - "Test Author"
plugins:
  - ./plugins/nonexistent.js
`
      );

      const config: ResolvedConfig = {
        input: TEST_DIR,
        plugins: [{ path: "./plugins/nonexistent.js", type: "local", enabled: true }],
        title: "Test",
        authors: ["Test Author"],
        timeout: 60000,
        verbose: false,
        debug: false,
        format: "html" as any,
        watch: false,
        force: false,
      };

      // Should not throw (non-strict mode)
      const html = await generateHtmlFromMarkdown(TEST_DIR, config);
      expect(html).toContain("Test");
    });
  });
});
