# Vivliostyle Flavored Markdown (VFM) Reference

VFM is a Markdown dialect optimized for book authoring, built on CommonMark and GitHub Flavored Markdown (GFM).

## Installation

```bash
npm install @vivliostyle/vfm
```

## Basic Usage

```javascript
import { stringify } from '@vivliostyle/vfm';

const markdown = `
# Chapter 1

This is content.
`;

const html = stringify(markdown);
```

## Frontmatter

Define metadata at the top of markdown files using YAML:

```markdown
---
title: 'Chapter Title'
author: 'Author Name'
lang: 'en'
dir: 'ltr'
class: 'chapter'
id: 'chapter-1'
---

# Content starts here
```

### Frontmatter Properties

| Property | Description | HTML Output |
|----------|-------------|-------------|
| `title` | Document title | `<title>` |
| `author` | Author name | `<meta name="author">` |
| `lang` | Language code | `<html lang="">` |
| `dir` | Text direction (ltr/rtl) | `<html dir="">` |
| `class` | Body class | `<body class="">` |
| `id` | Body ID | `<body id="">` |

### Nested Frontmatter

```markdown
---
title: 'My Document'
html:
  class: 'dark-theme'
  lang: 'en'
body:
  class: 'chapter introduction'
  id: 'intro'
vfm:
  math: true
  hardLineBreaks: false
---
```

### Theme in Frontmatter

```markdown
---
title: 'Chapter'
theme: './chapter-style.css'
---
```

---

## Text Formatting

### Basic (GFM Compatible)

```markdown
**bold** or __bold__
*italic* or _italic_
~~strikethrough~~
`inline code`
```

### Hard Line Breaks

When enabled (`hardLineBreaks: true`), single newlines become `<br>`:

```markdown
Line one
Line two becomes separate line
```

---

## Headings

```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

VFM wraps each heading and its content in a `<section>`:

```html
<section id="heading-1" class="level1">
  <h1>Heading 1</h1>
  <p>Content...</p>
</section>
```

---

## Code Blocks

### Basic Fenced Code

````markdown
```javascript
function hello() {
  console.log('Hello');
}
```
````

### Code with Filename

````markdown
```javascript:app.js
function main() {}
```
````

Outputs:
```html
<figure class="language-javascript">
  <figcaption>app.js</figcaption>
  <pre>
    <code class="language-javascript">
      function main() {}
    </code>
  </pre>
</figure>
```

### Syntax Highlighting

VFM uses Prism for syntax highlighting. Supported languages include:
- `javascript`, `typescript`, `jsx`, `tsx`
- `css`, `scss`, `sass`, `less`
- `html`, `xml`, `svg`
- `json`, `yaml`
- `python`, `ruby`, `go`, `rust`
- `bash`, `shell`
- Many more...

---

## Links and Images

### Links

```markdown
[Link text](https://example.com)
[Link with title](https://example.com "Title")
```

### Images

```markdown
![Alt text](image.jpg)
![Alt text](image.jpg "Title")
```

### Images with Size

```markdown
![Alt text](image.jpg){width=300}
![Alt text](image.jpg){width=50%}
![Alt text](image.jpg){width=300 height=200}
```

---

## Figures and Captions

### Image with Caption

```markdown
![Figure caption](image.jpg)
```

When an image is alone in a paragraph, VFM wraps it in `<figure>`:

```html
<figure>
  <img src="image.jpg" alt="Figure caption">
  <figcaption>Figure caption</figcaption>
</figure>
```

### Prevent Figure Wrapping

Add text on the same line:

```markdown
![Alt text](image.jpg) Some text
```

---

## Tables (GFM)

```markdown
| Header 1 | Header 2 | Header 3 |
|----------|:--------:|---------:|
| Left     | Center   | Right    |
| Cell     | Cell     | Cell     |
```

### Table Alignment

- `:---` Left align
- `:---:` Center align
- `---:` Right align

---

## Lists

### Unordered

```markdown
- Item 1
- Item 2
  - Nested item
  - Another nested
- Item 3
```

### Ordered

```markdown
1. First
2. Second
3. Third
```

### Task Lists

```markdown
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task
```

---

## Footnotes

### Reference Style

```markdown
Here is some text[^1] with a footnote[^note].

[^1]: This is the first footnote.
[^note]: This is a named footnote.
```

### Inline Footnotes

```markdown
Here is text^[This is an inline footnote].
```

### Output Structure

```html
<p>
  Here is some text
  <a id="fnref1" href="#fn1" class="footnote-ref" role="doc-noteref">
    <sup>1</sup>
  </a>
</p>

<section class="footnotes" role="doc-endnotes">
  <hr>
  <ol>
    <li id="fn1" role="doc-endnote">
      This is the first footnote.
      <a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a>
    </li>
  </ol>
</section>
```

---

## Ruby Text (Furigana)

For Japanese/Chinese text with pronunciation guides:

```markdown
{漢字|かんじ}
{東京|とうきょう}
```

Outputs:
```html
<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>
```

---

## Math (Optional)

Enable in frontmatter or config:

```markdown
---
vfm:
  math: true
---

Inline math: $E = mc^2$

Display math:
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

---

## Attributes

### On Block Elements

```markdown
{#custom-id .custom-class data-value="test"}
# Heading with attributes

{.highlight}
This paragraph has a class.
```

### On Inline Elements

```markdown
[Link]{.special}(https://example.com)
**bold text**{.emphasis}
```

---

## Raw HTML

HTML can be included directly:

```markdown
<div class="custom-wrapper">

Markdown content inside HTML.

</div>
```

---

## Sectionization

VFM automatically wraps content in sections based on headings:

**Input:**
```markdown
# Chapter 1

Introduction text.

## Section 1.1

Section content.

## Section 1.2

More content.

# Chapter 2

Next chapter.
```

**Output Structure:**
```html
<section id="chapter-1" class="level1">
  <h1>Chapter 1</h1>
  <p>Introduction text.</p>
  
  <section id="section-1.1" class="level2">
    <h2>Section 1.1</h2>
    <p>Section content.</p>
  </section>
  
  <section id="section-1.2" class="level2">
    <h2>Section 1.2</h2>
    <p>More content.</p>
  </section>
</section>

<section id="chapter-2" class="level1">
  <h1>Chapter 2</h1>
  <p>Next chapter.</p>
</section>
```

---

## API Reference

### stringify()

Convert markdown to HTML string:

```javascript
import { stringify } from '@vivliostyle/vfm';

const html = stringify(markdown, options);
```

### Options

```javascript
const options = {
  // Use hard line breaks
  hardLineBreaks: false,
  
  // Disable HTML formatting
  disableFormatHtml: false,
  
  // Custom styles
  style: ['./style.css'],
  
  // Partial HTML (no doctype/html/head/body)
  partial: false,
  
  // Language
  language: 'en',
  
  // Title
  title: 'Document Title',
};
```

### readMetadata()

Extract frontmatter metadata:

```javascript
import { readMetadata } from '@vivliostyle/vfm';

const metadata = readMetadata(markdown);
// Returns: { title, author, lang, ... }
```

### VFile Support

```javascript
import { stringify } from '@vivliostyle/vfm';
import { read } from 'to-vfile';

const file = await read('document.md');
const html = stringify(file);
```

---

## vivliostyle.config.js Integration

### Basic Config

```javascript
module.exports = {
  title: 'My Book',
  author: 'Author Name',
  language: 'en',
  size: 'A5',
  theme: './themes/book.css',
  entry: [
    'chapters/01-intro.md',
    'chapters/02-main.md',
    'chapters/03-conclusion.md',
  ],
  output: [
    'book.pdf',
  ],
};
```

### VFM Options in Config

```javascript
module.exports = {
  // ...
  vfm: {
    hardLineBreaks: false,
    disableFormatHtml: false,
  },
};
```

### Custom Document Processor

```javascript
const unified = require('unified');
const remarkParse = require('remark-parse');
const remarkRehype = require('remark-rehype');
const rehypeStringify = require('rehype-stringify');

module.exports = {
  // ...
  documentProcessor: (options, metadata) => {
    return unified()
      .use(remarkParse)
      .use(customPlugin)
      .use(remarkRehype)
      .use(rehypeStringify);
  },
};
```

---

## CSS Selectors for VFM Output

### Section Levels

```css
section.level1 { }  /* h1 sections */
section.level2 { }  /* h2 sections */
section.level3 { }  /* h3 sections */
```

### Footnotes

```css
.footnotes { }
.footnote-ref { }
.footnote-back { }
.footnote-item { }
```

### Code Figures

```css
figure[class^='language-'] { }
figure[class^='language-'] figcaption { }
figure[class^='language-'] pre { }
figure[class^='language-'] code { }
```

### Ruby Text

```css
ruby { }
ruby rt { }
ruby rp { }
```

---

## Migration from markdown-it-container

### Simple Containers

**markdown-it-container:**
```markdown
::: warning
Warning content
:::
```

**VFM attribute approach:**
```markdown
{.warning}
Warning content
```

### Complex Containers

For containers requiring custom HTML structure, use raw HTML or custom processor:

```markdown
<aside class="warning">
  <p class="warning-title">Warning</p>
  
  Warning content here.
  
</aside>
```

Or create custom unified plugin in `documentProcessor`.

---

## Best Practices for Books

### Chapter Structure

```markdown
---
title: 'Chapter 1: Introduction'
class: 'chapter'
---

# Introduction {.chapter-title}

Opening paragraph...

## Background

Section content...
```

### CSS for Print

```css
/* Target VFM sections */
section.level1 {
  break-before: right;
}

section.level1 > h1 {
  string-set: chapter-title content();
}

/* Footnotes at page bottom */
.footnotes {
  float: footnote;
}

/* Code blocks */
figure[class^='language-'] {
  break-inside: avoid;
  font-size: 0.9em;
}
```

### Running Headers from VFM

```css
/* Use section titles as running headers */
section.level1 > h1 {
  string-set: chapter content();
}

section.level2 > h2 {
  string-set: section content();
}

@page :left {
  @top-left {
    content: string(chapter);
  }
}

@page :right {
  @top-right {
    content: string(section);
  }
}
```
