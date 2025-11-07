/**
 * Tests for preview-wrapper validation
 */
import { test, expect } from "bun:test";
import { injectPagedJsPolyfill } from "./preview-wrapper.ts";

test("injectPagedJsPolyfill throws error if HTML missing </head> tag", () => {
  const invalidHtml = "<html><body>Test</body></html>";

  expect(() => injectPagedJsPolyfill(invalidHtml)).toThrow(
    "HTML is missing required </head> tag for polyfill injection"
  );
});

test("injectPagedJsPolyfill successfully injects into valid HTML", () => {
  const validHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test</title>
      </head>
      <body>
        <h1>Test</h1>
      </body>
    </html>
  `;

  const result = injectPagedJsPolyfill(validHtml);

  // Should contain the injected script
  expect(result).toContain("window.PagedConfig");
  expect(result).toContain("paged.polyfill.js");

  // Should still contain original content
  expect(result).toContain("<h1>Test</h1>");

  // Should have injected before </head>
  expect(result.indexOf("window.PagedConfig")).toBeLessThan(result.indexOf("</head>"));
});

test("injectPagedJsPolyfill validates assets are loaded", () => {
  // This test verifies that the function checks for valid CSS and JS
  // The imports happen at module load time, so if we got here, they passed validation
  const validHtml = "<html><head></head><body></body></html>";

  // Should not throw with valid HTML when assets are properly loaded
  expect(() => injectPagedJsPolyfill(validHtml)).not.toThrow();
});
