const fs = require('fs');
const content = fs.readFileSync('public/module-registry.js', 'utf8');

// The module-registry stores module code as JS strings with literal \n sequences
const oldPattern = 'function isHumanVsHumanModeEnabled() {\\n    const debugHvH = !!(__uiImpl_turn_manager && __uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN);';

const newPattern = 'function isHumanVsHumanModeEnabled() {\\n    const debugHvH = !!(\\n        (__uiImpl_turn_manager && __uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN) ||\\n        (typeof window !== \'undefined\' && window.DEBUG_HUMAN_VS_HUMAN) ||\\n        (typeof globalThis !== \'undefined\' && globalThis.DEBUG_HUMAN_VS_HUMAN)\\n    );';

if (content.includes(oldPattern)) {
    const fixed = content.split(oldPattern).join(newPattern);
    fs.writeFileSync('public/module-registry.js', fixed, 'utf8');
    console.log('OK: turn-manager isHumanVsHumanModeEnabled patched with triple fallback');
} else {
    console.log('WARN: old pattern not found in module-registry');
    // Debug: find all isHumanVsHumanModeEnabled blocks
    const idx = content.indexOf('humanVsHumanModeEnabled');
    if (idx >= 0) {
        console.log('Found at position', idx, 'context:', content.substring(idx, idx + 200));
    } else {
        console.log('isHumanVsHumanModeEnabled not found at all in file');
    }
}
