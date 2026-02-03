"use strict";

// Replacement for the 'grasp' module using recast and @babel/parser.
// Supports a basic subset of 'squery' using esquery CSS selectors over the ESTree AST.

const recast = require("recast");
const babelParser = require("@babel/parser");
const esquery = require("esquery");

function parse(code) {
  // Configure Babel parser to handle common modern JS/TS features.
  const parser = {
    parse(source) {
      return babelParser.parse(source, {
        sourceType: "unambiguous",
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        plugins: [
          // JS
          "jsx",
          "classProperties",
          "classPrivateProperties",
          "classPrivateMethods",
          "decorators-legacy",
          "doExpressions",
          "objectRestSpread",
          "exportDefaultFrom",
          "exportNamespaceFrom",
          "dynamicImport",
          "numericSeparator",
          "optionalChaining",
          "nullishCoalescingOperator",
          "logicalAssignment",
          "topLevelAwait",
          // TS (parsed but emitted as ESTree-compatible by recast)
          "typescript"
        ]
      });
    }
  };
  return recast.parse(code, { parser });
}

function print(nodeOrAst) {
  return recast.print(nodeOrAst).code;
}

function ensureSquery(mode) {
  if (mode !== "squery") {
    throw new Error("Only 'squery' mode is supported by this replacement");
  }
}

function search(mode, selector, code) {
  ensureSquery(mode);
  if (typeof code !== "string") throw new Error("Expected 'code' to be a string");
  if (!selector) return [];
  const ast = parse(code);
  const nodes = esquery.query(ast.program || ast, selector);
  // Return array of source code snippets for each matched node
  return nodes.map(n => print(n));
}

function replace(mode, selector, replacement, code) {
  ensureSquery(mode);
  if (typeof code !== "string") throw new Error("Expected 'code' to be a string");
  if (typeof replacement !== "string") throw new Error("Replacement must be a string of JS code");

  const ast = parse(code);
  const t = recast.types;
  const matched = new Set(esquery.query(ast.program || ast, selector));

  // Parse replacement once; we will pick the first item as the node template.
  const replAst = parse(replacement);
  let replNode = null;
  const prog = replAst.program || replAst;
  if (prog.body && prog.body.length === 1) {
    const first = prog.body[0];
    if (first.type === "ExpressionStatement") {
      replNode = first.expression;
    } else {
      replNode = first;
    }
  } else if (prog && prog.type && prog.type !== "Program") {
    replNode = prog;
  }
  if (!replNode) {
    throw new Error("Replacement must parse to a single expression or statement");
  }

  // Walk AST and replace any node that is in matched set
  t.visit(ast, {
    visitNode(path) {
      if (matched.has(path.node)) {
        // Clone replacement to avoid sharing node objects
        const clone = JSON.parse(JSON.stringify(replNode));
        // If target is a Statement position, ensure we replace with a Statement
        const parentPath = path.parent;
        const isStatementContext = !!(parentPath && parentPath.name === "body" && parentPath.node && (parentPath.node.type === "Program" || parentPath.node.type === "BlockStatement"));

        if (isStatementContext && !/Statement$/.test(clone.type)) {
          // Wrap expression as an ExpressionStatement when replacing statements
          path.replace({ type: "ExpressionStatement", expression: clone });
        } else {
          path.replace(clone);
        }
        return false; // Don't traverse into replaced node
      }
      this.traverse(path);
    }
  });

  return print(ast);
}

module.exports = {
  search,
  replace
};
