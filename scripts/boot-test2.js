const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const logs = [];
    page.on('console', msg => {
        logs.push({ type: msg.type(), text: msg.text().substring(0, 300) });
    });
    page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message.substring(0, 300) }));
    
    await page.goto('http://127.0.0.1:8000/?debug=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(10000);
    
    // Try to actually require a module
    const modTest = await page.evaluate(() => {
        const result = {};
        try {
            const mod = require('./dist/constants/animation-constants');
            result.animationConstants = typeof mod;
            if (mod && mod.ANIMATION_TIMINGS) {
                result.hasAnimationTimings = true;
                result.animationTimingKeys = Object.keys(mod.ANIMATION_TIMINGS).length;
            } else {
                result.hasAnimationTimings = false;
            }
        } catch (e) {
            result.animationConstantsError = e.message;
        }
        
        try {
            const shared = require('./dist/shared-constants');
            result.sharedConstants = typeof shared;
        } catch (e) {
            result.sharedConstantsError = e.message;
        }
        
        try {
            const cardSystem = require('./dist/card-system');
            result.cardSystem = typeof cardSystem;
        } catch (e) {
            result.cardSystemError = e.message;
        }
        
        return result;
    });
    console.log('Module test:', JSON.stringify(modTest, null, 2));
    
    // Check errors/warnings count
    const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror');
    const warnings = logs.filter(l => l.type === 'warning');
    const bootSkips = logs.filter(l => l.text.includes('[boot] skip'));
    console.log('\nErrors:', errors.length, 'Warnings:', warnings.length, 'Boot skips:', bootSkips.length);
    console.log('First 5 boot skips:');
    bootSkips.slice(0, 5).forEach(l => console.log('  ' + l.text.substring(0, 150)));
    
    // Check window state
    const winState = await page.evaluate(() => {
        return {
            hasCoreLogic: typeof window.CoreLogic,
            hasCardLogic: typeof window.CardLogic,
            hasResetGame: typeof window.resetGame,
            boardChildren: (document.getElementById('board') || { children: { length: -1 } }).children.length,
            hasRequire: typeof window.require === 'function',
            requireWorks: (function() { try { window.require('./dist/shared-constants'); return true; } catch(e) { return false; } })()
        };
    });
    console.log('\nWindow state:', JSON.stringify(winState, null, 2));
    
    await browser.close();
})();
