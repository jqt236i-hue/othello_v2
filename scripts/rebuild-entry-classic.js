// Regenerate entry-browser.js from original script order WITHOUT .js extensions
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read original index.html
let originalHtml = execSync('git show HEAD:index.html', { encoding: 'utf8', cwd: process.cwd() });

// Extract script src paths
const scriptRegex = /<script\s[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/g;
let match;
const scripts = [];
while ((match = scriptRegex.exec(originalHtml)) !== null) {
  const src = match[1];
  // Skip onnxruntime
  if (src.includes('onnxruntime') || src.includes('ort.min')) continue;
  // Convert to dist path WITHOUT .js extension
  let distPath = src.replace(/\.js$/, '');
  if (!distPath.startsWith('dist/')) {
    distPath = 'dist/' + distPath;
  }
  scripts.push(distPath);
}

console.log('Found ' + scripts.length + ' script tags');

// Build entry-browser.js
const result = [];
result.push('// ===== Classic browser runtime entry =====');
result.push('// Loads modules in original index.html order via module-registry');
result.push('');
result.push('// _require / __require aliases (used by dist modules internally)');
result.push('window._require = window.require;');
result.push('window.__require = window.require;');
result.push('var _require = window.require;');
result.push('');
result.push('var gameState;');
result.push('var cardState;');
result.push('var boardConfig;');
result.push('var prng;');
result.push('var deckSpec;');
result.push('var __uiImpl_turn_manager = {};');
result.push('');

let modN = 1;
for (const distPath of scripts) {
  const varName = '_mod' + (modN++);
  result.push('// ' + distPath);
  result.push('try {');
  result.push('  var ' + varName + ' = require("./' + distPath + '");');
  result.push('} catch (e) {');
  result.push('  console.warn("[boot] skip " + "' + distPath + ': " + e.message);');
  result.push('}');
  result.push('');
}

// Critical global contract (after all loads)
result.push('// ===== Global contract restoration =====');
result.push('if (typeof window.CoreLogic !== "undefined") window.CoreLogic = window.CoreLogic;');
result.push('if (typeof window.CardLogic !== "undefined") window.CardLogic = window.CardLogic;');
result.push('if (typeof window.CardSystem !== "undefined") window.CardSystem = window.CardSystem;');
result.push('');
result.push('// ===== Browser runtime shims =====');
result.push('window.getElement = function(k) {');
result.push('  var m = {board:"board",boardFrame:"board-frame",deckBlack:"deck-black",deckWhite:"deck-white",handBlack:"hand-black",handWhite:"hand-white",chargeBlack:"charge-black",chargeWhite:"charge-white",log:"log",handLayer:"handLayer",heldStone:"heldStone",cardFxLayer:"card-fx-layer",handImage:"handImage",cpuCharacterImg:"cpu-character-img",cpuLevelLabel:"cpu-level-label"};');
result.push('  return m[k] ? document.getElementById(m[k]) : null;');
result.push('};');
result.push('window.initializeElementCache = function() {};');
result.push('window.clearElementCache = function() {};');

fs.writeFileSync('entry-browser.js', result.join('\n'));
console.log('Written entry-browser.js');
