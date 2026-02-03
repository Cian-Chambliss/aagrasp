# Grasp Replacement (Library Only)

Lightweight replacement for a subset of the original "grasp" library using:
- @babel/parser for parsing
- recast for AST traversal/printing
- esquery for CSS-like AST selectors (the "squery" part)

This package exposes a small API for programmatic search and replace over JavaScript/TypeScript source code. It is not a CLI. If you want a command-line utility like the original grasp, you can build one on top of this module.

## Install

Dependencies are already listed in `package.json`. If needed:

```bash
npm install
```

## API

```js
const grasp = require('aagrasp');

// Search for nodes
const nodes = grasp.search('squery', selector, code);

// Replace matched nodes; returns updated source code string
const out = grasp.replace('squery', selector, replacementCode, code);
```

Notes:
- Only the `squery` mode is supported (CSS-style AST selectors via `esquery`).
- `search` returns raw AST nodes (ESTree-compatible). You can inspect fields like `type`, `name`, `loc`, etc.
- `replace` expects `replacementCode` to parse to a single expression or statement. Wrap bare literals in parentheses, e.g. `("true")`.

## Selector Syntax (esquery)

This library uses [esquery](https://github.com/estools/esquery) selectors. A few handy examples:

- All identifiers: `Identifier`
- Identifiers with an exact name: `Identifier[name="foo"]`
- Identifiers matching a regex: `Identifier[name=/^foo$/]`
- String literals: `StringLiteral`
- String literals by value: `StringLiteral[value="hello"]`
- Calls to `replace`: `CallExpression[callee.property.name="replace"]`
- Variable declarations named `x`: `VariableDeclarator[id.name="x"]`

### Legacy Compatibility: `#/regex/flags`

For partial compatibility with older grasp examples, a selector of the form `#/regex/flags` is supported and interpreted as:

```
Identifier[name=/regex/flags]
```

That is, it selects identifier nodes whose `name` matches the supplied regular expression.

## Usage Examples (Node.js scripts)

1) Search for any identifier name matching a regex (legacy selector form):

```js
// search-identifiers.js
const grasp = require('aagrasp');

const code = "var fn = 'joe';";
const selector = "#/.+/"; // legacy form -> Identifier[name=/.+/]
const nodes = grasp.search('squery', selector, code);

console.log(nodes);
// Example output: [ Node { type: 'Identifier', name: 'fn', ... } ]
```

Run with:

```bash
node search-identifiers.js
```

2) Search using native esquery (no legacy):

```js
// search-strings.js
const grasp = require('aagrasp');

const code = "var fn = 'joe';";
const selector = 'StringLiteral[value=/.+/]';
const nodes = grasp.search('squery', selector, code);

console.log(nodes.map(n => n.value)); // ['joe']
```

3) Replace a string literal value:

```js
// replace-string.js
const grasp = require('aagrasp');

const code = 'const result = str.replace(/\\[.*?]/gs, "false");';
const selector = 'StringLiteral[value="false"]';
const replacement = '("true")'; // wrap a bare string so it parses as an expression

const out = grasp.replace('squery', selector, replacement, code);
console.log(out);
// => const result = str.replace(/\[.*?]/gs, ("true"));
```

4) Rename an identifier globally (basic example):

```js
// rename-identifier.js
const grasp = require('aagrasp');

const code = 'function fn() { return fn + 1 }';
const selector = 'Identifier[name="fn"]';
const replacement = 'renamed';

const out = grasp.replace('squery', selector, replacement, code);
console.log(out);
// function renamed() { return renamed + 1 }
```

## Differences from Original Grasp

- Only `squery` selectors are supported (no `equery`).
- Selectors are esquery syntax, not the original grasp dialect (aside from the `#/regex/` helper for identifiers).
- `replace` requires the replacement to parse to a single node. For string or numeric literals, wrap them in parentheses, e.g. `(42)`, `("text")`.

## Tips

- When in doubt about a selector, try it on https://astexplorer.net/ to inspect the AST and validate esquery selectors.
- For multi-statement replacements, replace at a statement boundary and provide a single statement (or an expression wrapped in an `ExpressionStatement`).
