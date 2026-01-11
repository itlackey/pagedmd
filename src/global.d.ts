/**
 * Global type declarations for pagedmd
 */

// CSS file imports with Bun's text loader
declare module '*.css' {
  const content: string;
  export default content;
}
