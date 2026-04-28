import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface FileInfo {
  src: string;
  typesPath: string;
  wrapperRequire: string;
  exportName: string;
}

const files: FileInfo[] = [
  { src: 'ui/deck-builder-controller.js', typesPath: '../../src/types', wrapperRequire: '../dist/ui/deck-builder-controller', exportName: 'DeckBuilderController' },
  { src: 'ui/bootstrap.js', typesPath: '../../src/types', wrapperRequire: '../dist/ui/bootstrap', exportName: 'UIBootstrap' },
  { src: 'ui/board-renderer.js', typesPath: '../../src/types', wrapperRequire: '../dist/ui/board-renderer', exportName: 'BoardRenderer' },
  { src: 'ui/story/story-steps.js', typesPath: '../../../src/types', wrapperRequire: '../../dist/ui/story/story-steps', exportName: 'StorySteps' },
  { src: 'ui/result-overlay.js', typesPath: '../../src/types', wrapperRequire: '../dist/ui/result-overlay', exportName: 'ResultOverlay' },
  { src: 'ui/handlers/match-mode.js', typesPath: '../../../src/types', wrapperRequire: '../../dist/ui/handlers/match-mode', exportName: 'MatchMode' },
  { src: 'ui/animation-utils.js', typesPath: '../../src/types', wrapperRequire: '../dist/ui/animation-utils', exportName: 'AnimationUtils' },
  { src: 'ui/diff-renderer.js', typesPath: '../../src/types', wrapperRequire: '../dist/ui/diff-renderer', exportName: 'DiffRenderer' },
  { src: 'ui/network-client.js', typesPath: '../../src/types', wrapperRequire: '../dist/ui/network-client', exportName: 'NetworkClient' },
  { src: 'ui/animation-engine.js', typesPath: '../../src/types', wrapperRequire: '../dist/ui/animation-engine', exportName: 'AnimationEngine' },
];

const boilerplate = (typesPath: string) => `// @ts-nocheck
import type { CardState, GameState, PlayerKey } from '${typesPath}';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

`;

const wrapperContent = (requirePath: string) => `"use strict";
/** @type {any} */
module.exports = require('${requirePath}');
`;

function isWrapper(content: string): boolean {
  return content.trimStart().startsWith('"use strict";') && content.includes('module.exports = require(');
}

function extractUMDBody(content: string): string | null {
  // Find "function (...) {" after "typeof self"
  const idx = content.indexOf("typeof self !== 'undefined' ? self : this, function");
  if (idx === -1) return null;
  
  const braceIdx = content.indexOf('{', idx);
  if (braceIdx === -1) return null;
  
  // Find the last "}));" which closes the factory and UMD
  const endIdx = content.lastIndexOf('}));');
  if (endIdx === -1) return null;
  
  return content.substring(braceIdx + 1, endIdx).trim();
}

function transformUMD(content: string, exportName: string): string | null {
  let body = extractUMDBody(content);
  if (!body) return null;
  
  // Replace "return { ... };" at the end with export
  // Match the last return statement
  const returnMatch = body.match(/return\s+([^;]+)\s*;\s*$/);
  if (returnMatch && returnMatch.index !== undefined) {
    body = body.substring(0, returnMatch.index) + `const ${exportName} = ${returnMatch[1]};\nexport = ${exportName};`;
  }
  
  return body;
}

function transformIIFE(content: string, rootVarName: string, exportName: string): string {
  // Remove starting IIFE
  let body = content.replace(/^\(function \(root\) \{\s*/, '');
  // Remove ending IIFE
  body = body.replace(/\}\(typeof window !== 'undefined' \? window : globalThis\)\);?\s*$/, '');
  
  // Replace root.XXX = ... with export
  const rootAssignRegex = new RegExp(`\\s*root\\.${rootVarName}\\s*=\\s*([^;]+);?`);
  const assignMatch = body.match(rootAssignRegex);
  if (assignMatch) {
    const varName = assignMatch[1].trim();
    body = body.replace(rootAssignRegex, `\nexport = ${varName};`);
  }
  
  return body;
}

function transformModuleExports(content: string, exportName: string): string {
  let transformed = content;
  
  // Replace conditional module.exports
  transformed = transformed.replace(
    /if\s*\(\s*typeof\s+module\s*!==\s*['"]undefined['"]\s*\u0026\u0026\s*module\.exports\s*\)\s*\{\s*module\.exports\s*=\s*([^}]+)\}\s*\}/,
    `const ${exportName} = $1;\nexport = ${exportName};`
  );
  
  // Replace direct module.exports at end
  transformed = transformed.replace(
    /module\.exports\s*=\s*([^;]+);?\s*$/,
    `const ${exportName} = $1;\nexport = ${exportName};`
  );
  
  return transformed;
}

function convertFile(fileInfo: FileInfo) {
  const srcPath = path.join(__dirname, '..', fileInfo.src);
  const content = fs.readFileSync(srcPath, 'utf8');
  
  if (isWrapper(content)) {
    console.log('Skipping (already wrapper):', fileInfo.src);
    return;
  }
  
  const dir = path.dirname(fileInfo.src);
  const baseName = path.basename(fileInfo.src, '.js');
  const tsPath = path.join(__dirname, '..', dir, baseName + '.ts');
  const jsPath = path.join(__dirname, '..', fileInfo.src);
  
  let tsBody: string | null = null;
  
  switch (baseName) {
    case 'deck-builder-controller':
      tsBody = transformUMD(content, 'DeckBuilderController');
      break;
    case 'bootstrap':
      tsBody = transformUMD(content, 'UIBootstrap');
      break;
    case 'story-steps':
      tsBody = transformUMD(content, 'StorySteps');
      break;
    case 'animation-engine':
      tsBody = transformUMD(content, 'AnimationEngine');
      break;
    case 'match-mode':
      tsBody = transformIIFE(content, 'MatchMode', 'MatchMode');
      break;
    case 'network-client':
      tsBody = transformIIFE(content, 'NetworkMatchClient', 'NetworkClient');
      break;
    case 'board-renderer':
      tsBody = transformModuleExports(content, 'BoardRenderer');
      break;
    case 'result-overlay':
      tsBody = transformModuleExports(content, 'ResultOverlay');
      break;
    case 'animation-utils':
      tsBody = transformModuleExports(content, 'AnimationUtils');
      break;
    case 'diff-renderer':
      tsBody = transformModuleExports(content, 'DiffRenderer');
      break;
    default:
      tsBody = content;
  }
  
  if (!tsBody) {
    console.error('ERROR: Failed to transform', fileInfo.src);
    return;
  }
  
  const finalTs = boilerplate(fileInfo.typesPath) + tsBody;
  
  fs.writeFileSync(tsPath, finalTs);
  fs.writeFileSync(jsPath, wrapperContent(fileInfo.wrapperRequire));
  
  console.log('Converted', fileInfo.src, '->', path.join(dir, baseName + '.ts'));
}

files.forEach(convertFile);
console.log('Done!');
