// Regenerate entry-browser.js from original layout but wrap requires in try-catch
const fs = require('fs');
const path = require('path');

// Read original index.html to extract script order (from git)
let originalHtml;
try {
  const { execSync } = require('child_process');
  originalHtml = execSync('git show HEAD:index.html', { encoding: 'utf8', cwd: process.cwd() });
} catch (e) {
  // fallback: read current file
  originalHtml = fs.readFileSync('index.html', 'utf8');
}

// Extract script src paths
const scriptRegex = /<script\s[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/g;
let match;
const scripts = [];
while ((match = scriptRegex.exec(originalHtml)) !== null) {
  const src = match[1];
  // Skip onnxruntime (external)
  if (src.includes('onnxruntime') || src.includes('ort.min')) continue;
  // Convert to dist path
  let distPath = src;
  if (!src.startsWith('dist/')) {
    distPath = path.join('dist', src).replace(/\\/g, '/');
  }
  scripts.push(distPath);
}

console.log('Found ' + scripts.length + ' script tags from original index.html');

// Build entry-browser.js
const result = [];
result.push('// ===== Load all modules in original index.html order =====');
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
  result.push('var ' + varName + ' = null;');
  result.push('try {');
  result.push('  ' + varName + ' = require("./' + distPath + '");');
  result.push('  if (' + varName + ') Object.assign(window, ' + varName + ');');
  result.push('} catch (e) {');
  result.push('  console.warn("[boot] skip " + "' + distPath + ': " + e.message);');
  result.push('}');
  result.push('');
}

// Add explicit window assignments for known-critical modules (belt-and-suspenders)
result.push('// ===== Critical global contract restoration =====');
result.push('if (window.CoreLogic) Object.assign(window, window.CoreLogic);');
result.push('if (window.CardLogic) Object.assign(window, window.CardLogic);');
result.push('if (window.CardSystem) Object.assign(window, window.CardSystem);');
result.push('if (window.GameEvents) window.gameEvents = window.GameEvents;');
result.push('if (window.GameEventEmitter) window.GameEvents = window.GameEvents;');
result.push('');
result.push('// ===== Browser runtime shims =====');
result.push('window.getElement = function(k) {');
result.push('  var m = {board:"board",boardFrame:"board-frame",deckBlack:"deck-black",deckWhite:"deck-white",handBlack:"hand-black",handWhite:"hand-white",chargeBlack:"charge-black",chargeWhite:"charge-white",log:"log",handLayer:"handLayer",heldStone:"heldStone",cardFxLayer:"card-fx-layer",handImage:"handImage",cpuCharacterImg:"cpu-character-img",cpuLevelLabel:"cpu-level-label"};');
result.push('  return m[k] ? document.getElementById(m[k]) : null;');
result.push('};');
result.push('window.initializeElementCache = function() {};');
result.push('window.clearElementCache = function() {};');

fs.writeFileSync('entry-browser.js', result.join('\n'));
console.log('Written entry-browser.js with try-catch wrapping');
