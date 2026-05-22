import * as fs from 'fs';

const registryPath = 'public/module-registry.js';
const content = fs.readFileSync(registryPath, 'utf8');

const oldPattern = 'function isHumanVsHumanModeEnabled() {\\n    const debugHvH = !!(__uiImpl_turn_manager && __uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN);';

const newPattern = "function isHumanVsHumanModeEnabled() {\\n    const debugHvH = !!(\\n        (__uiImpl_turn_manager && __uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN) ||\\n        (typeof window !== 'undefined' && window.DEBUG_HUMAN_VS_HUMAN) ||\\n        (typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN)\\n    );";

if (content.includes(oldPattern)) {
  const fixed = content.split(oldPattern).join(newPattern);
  fs.writeFileSync(registryPath, fixed, 'utf8');
  console.log('OK: turn-manager isHumanVsHumanModeEnabled patched with triple fallback');
} else {
  console.log('WARN: old pattern not found in module-registry');
  const index = content.indexOf('humanVsHumanModeEnabled');
  if (index >= 0) {
    console.log('Found at position', index, 'context:', content.substring(index, index + 200));
  } else {
    console.log('isHumanVsHumanModeEnabled not found at all in file');
  }
}
