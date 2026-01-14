# Markdown-it Reference

Reference for markdown-it parser and markdown-it-container plugin used in book authoring workflows.

## markdown-it Basics

### Installation

```bash
npm install markdown-it
```

### Basic Usage

```javascript
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();
const result = md.render('# Hello World');

// Inline only (no paragraph wrapping)
const inline = md.renderInline('**bold** text');
```

### Configuration Presets

```javascript
// CommonMark strict mode
const md = new MarkdownIt('commonmark');

// Default (GFM-like)
const md = new MarkdownIt();
const md = new MarkdownIt('default');

// Minimal (paragraphs and text only)
const md = new MarkdownIt('zero');

// Full features
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});
```

### Configuration Options

```javascript
const md = new MarkdownIt({
  // Enable HTML tags in source
  html: false,
  
  // Use '/' to close single tags (<br />)
  xhtmlOut: false,
  
  // Convert '\n' in paragraphs to <br>
  breaks: false,
  
  // CSS language prefix for fenced blocks
  langPrefix: 'language-',
  
  // Autoconvert URL-like text to links
  linkify: false,
  
  // Enable smartquotes and other transforms
  typographer: false,
  
  // Quote characters for typographer
  quotes: '""''',
  
  // Syntax highlighting function
  highlight: function(str, lang) {
    // Return highlighted HTML or ''
    return '';
  }
});
```

### Enable/Disable Rules

```javascript
const md = new MarkdownIt()
  .disable(['link', 'image'])
  .enable(['link'])
  .enable('image');
```

### Plugin System

```javascript
import MarkdownIt from 'markdown-it';
import plugin1 from 'markdown-it-plugin1';
import plugin2 from 'markdown-it-plugin2';

const md = new MarkdownIt()
  .use(plugin1)
  .use(plugin2, { option: 'value' });
```

---

## markdown-it-container

Create custom block containers with fence-like syntax.

### Installation

```bash
npm install markdown-it-container
```

### Basic Usage

```javascript
import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';

const md = new MarkdownIt()
  .use(container, 'warning');
```

**Markdown Input:**
```markdown
::: warning
*Here be dragons*
:::
```

**HTML Output:**
```html
<div class="warning">
  <em>Here be dragons</em>
</div>
```

### Custom Rendering

```javascript
md.use(container, 'warning', {
  validate: function(params) {
    return params.trim().match(/^warning\s+(.*)$/);
  },
  
  render: function(tokens, idx) {
    const m = tokens[idx].info.trim().match(/^warning\s+(.*)$/);
    
    if (tokens[idx].nesting === 1) {
      // Opening tag
      return '<div class="warning"><p class="warning-title">' +
             md.utils.escapeHtml(m[1]) + '</p>\n';
    } else {
      // Closing tag
      return '</div>\n';
    }
  }
});
```

**Markdown Input:**
```markdown
::: warning Important Notice
Please read carefully!
:::
```

**HTML Output:**
```html
<div class="warning">
  <p class="warning-title">Important Notice</p>
  <p>Please read carefully!</p>
</div>
```

### Options Reference

```javascript
md.use(container, name, {
  // Validate container opening
  // params: text after :::name
  // Returns boolean
  validate: function(params) {
    return params.trim() === '';
  },
  
  // Custom rendering function
  // tokens: array of tokens
  // idx: index of current token
  // Returns HTML string
  render: function(tokens, idx) {
    if (tokens[idx].nesting === 1) {
      return '<div class="' + name + '">\n';
    } else {
      return '</div>\n';
    }
  },
  
  // Custom marker character (default: ':')
  marker: ':',
});
```

### Common Container Patterns

#### Callout Boxes

```javascript
// Warning callout
md.use(container, 'warning', {
  render: (tokens, idx) => {
    return tokens[idx].nesting === 1
      ? '<aside class="callout warning">\n'
      : '</aside>\n';
  }
});

// Info callout
md.use(container, 'info', {
  render: (tokens, idx) => {
    return tokens[idx].nesting === 1
      ? '<aside class="callout info">\n'
      : '</aside>\n';
  }
});

// Tip callout
md.use(container, 'tip', {
  render: (tokens, idx) => {
    return tokens[idx].nesting === 1
      ? '<aside class="callout tip">\n'
      : '</aside>\n';
  }
});
```

#### Spoiler/Details

```javascript
md.use(container, 'spoiler', {
  validate: function(params) {
    return params.trim().match(/^spoiler\s+(.*)$/);
  },
  
  render: function(tokens, idx) {
    const m = tokens[idx].info.trim().match(/^spoiler\s+(.*)$/);
    
    if (tokens[idx].nesting === 1) {
      return '<details><summary>' +
             md.utils.escapeHtml(m[1]) +
             '</summary>\n';
    } else {
      return '</details>\n';
    }
  }
});
```

**Usage:**
```markdown
::: spoiler Click to reveal
Hidden content here
:::
```

#### Columns/Grid

```javascript
md.use(container, 'columns', {
  render: (tokens, idx) => {
    return tokens[idx].nesting === 1
      ? '<div class="columns">\n'
      : '</div>\n';
  }
});

md.use(container, 'column', {
  render: (tokens, idx) => {
    return tokens[idx].nesting === 1
      ? '<div class="column">\n'
      : '</div>\n';
  }
});
```

**Usage:**
```markdown
::: columns
::: column
Left content
:::
::: column
Right content
:::
:::
```

#### Figure with Caption

```javascript
md.use(container, 'figure', {
  validate: function(params) {
    return params.trim().match(/^figure\s+(.*)$/);
  },
  
  render: function(tokens, idx) {
    const m = tokens[idx].info.trim().match(/^figure\s+(.*)$/);
    
    if (tokens[idx].nesting === 1) {
      return '<figure>\n';
    } else {
      return '<figcaption>' +
             md.utils.escapeHtml(m[1]) +
             '</figcaption>\n</figure>\n';
    }
  }
});
```

**Usage:**
```markdown
::: figure A beautiful sunset
![Sunset](sunset.jpg)
:::
```

### Nesting Containers

Use more colons for outer containers:

```markdown
:::: outer
Content in outer

::: inner
Content in inner
:::

More outer content
::::
```

### Escaping Markers

```markdown
\::: not-a-container
This is plain text
:::
```

---

## Converting to Vivliostyle VFM

### VFM Equivalents

VFM (Vivliostyle Flavored Markdown) uses different syntax for some features:

| markdown-it-container | VFM Equivalent |
|----------------------|----------------|
| `::: class-name` | `{.class-name}` attribute |
| `::: id-name` | `{#id-name}` attribute |
| Custom containers | Custom VFM plugins |

### Attribute Syntax in VFM

```markdown
<!-- VFM class attribute -->
{.warning}
This paragraph has warning class.

<!-- VFM ID attribute -->
{#section-1}
# Heading with ID

<!-- Multiple attributes -->
{.note .important #my-note}
Important note here.
```

### Custom Container Migration

For complex containers, create custom unified plugins:

```javascript
// vivliostyle.config.js
const unified = require('unified');
const remarkParse = require('remark-parse');
const remarkDirective = require('remark-directive');
const remarkRehype = require('remark-rehype');
const rehypeStringify = require('rehype-stringify');

// Custom directive plugin
function myDirectivePlugin() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type === 'containerDirective') {
        if (node.name === 'warning') {
          const data = node.data || (node.data = {});
          data.hName = 'aside';
          data.hProperties = { class: 'callout warning' };
        }
      }
    });
  };
}

module.exports = {
  // ...
  documentProcessor: (options, metadata) => {
    return unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(myDirectivePlugin)
      .use(remarkRehype)
      .use(rehypeStringify);
  }
};
```

### Alternative: Pre-process Markdown

Convert markdown-it-container syntax before Vivliostyle processes it:

```javascript
// preprocess.js
const MarkdownIt = require('markdown-it');
const container = require('markdown-it-container');

const md = new MarkdownIt({ html: true })
  .use(container, 'warning')
  .use(container, 'note')
  .use(container, 'tip');

function preprocess(markdown) {
  // Convert ::: containers to HTML
  return md.render(markdown);
}

module.exports = { preprocess };
```

---

## Token Structure

Understanding tokens helps with debugging and custom plugins:

```javascript
const md = new MarkdownIt();
const tokens = md.parse('# Hello\n\nWorld');

// Token structure
{
  type: 'heading_open',   // Token type
  tag: 'h1',              // HTML tag
  nesting: 1,             // 1=open, 0=self-close, -1=close
  level: 0,               // Nesting level
  children: null,         // Child tokens (for inline)
  content: '',            // Content string
  markup: '#',            // Markup character(s)
  info: '',               // Additional info
  meta: null,             // Metadata
  block: true,            // Block or inline
  hidden: false,          // Should render?
  map: [0, 1],            // Source line mapping
}
```

### Container Token Structure

```javascript
// Opening container_warning_open
{
  type: 'container_warning_open',
  tag: 'div',
  nesting: 1,
  info: 'warning Title',  // Text after :::warning
  markup: ':::',
  block: true,
}

// Closing container_warning_close
{
  type: 'container_warning_close',
  tag: 'div',
  nesting: -1,
  markup: ':::',
  block: true,
}
```

---

## Common Plugins for Books

### Footnotes

```bash
npm install markdown-it-footnote
```

```javascript
import footnote from 'markdown-it-footnote';
md.use(footnote);
```

```markdown
Here is a footnote reference[^1].

[^1]: Here is the footnote content.
```

### Table of Contents

```bash
npm install markdown-it-toc-done-right markdown-it-anchor
```

```javascript
import anchor from 'markdown-it-anchor';
import toc from 'markdown-it-toc-done-right';

md.use(anchor, { permalink: true })
  .use(toc);
```

### Attributes

```bash
npm install markdown-it-attrs
```

```javascript
import attrs from 'markdown-it-attrs';
md.use(attrs);
```

```markdown
# Heading {#custom-id .custom-class}

Paragraph {data-custom="value"}
```

### Task Lists

```bash
npm install markdown-it-task-lists
```

```javascript
import taskLists from 'markdown-it-task-lists';
md.use(taskLists);
```

```markdown
- [x] Completed task
- [ ] Incomplete task
```

### Subscript/Superscript

```bash
npm install markdown-it-sub markdown-it-sup
```

```javascript
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
md.use(sub).use(sup);
```

```markdown
H~2~O (subscript)
E=mc^2^ (superscript)
```

---

## Debugging Tips

### Inspect Tokens

```javascript
const md = new MarkdownIt();
const tokens = md.parse(markdown);
console.log(JSON.stringify(tokens, null, 2));
```

### Test Container Parsing

```javascript
const md = new MarkdownIt()
  .use(container, 'test', {
    validate: (params) => {
      console.log('Validating:', params);
      return true;
    },
    render: (tokens, idx) => {
      console.log('Token:', tokens[idx]);
      return tokens[idx].nesting === 1 ? '<div>' : '</div>';
    }
  });

md.render('::: test foo\nContent\n:::');
```

### Render Debug Mode

```javascript
const md = new MarkdownIt();

// Override renderer for debugging
md.renderer.rules.text = (tokens, idx) => {
  console.log('Text token:', tokens[idx]);
  return md.utils.escapeHtml(tokens[idx].content);
};
```
