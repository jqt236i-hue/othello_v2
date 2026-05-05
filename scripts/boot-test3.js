const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const logs = [];
    page.on('console', msg => logs.push({ type: msg.type(), text: msg.text().substring(0, 300) }));
    page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message.substring(0, 300) }));
    
    await page.goto('http://127.0.0.1:8000/?debug=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(15000);
    
    // Test specific module loading
    const modTest = await page.evaluate(() => {
        const results = {};
        const testModules = [
            'game/logic/core',
            'game/logic/cards',
            'game/logic/cards/defs',
            'game/logic/cards/utils',
            'game/logic/cards/selectors',
            'game/logic/cards/flips',
            'game/game-core-logic',
            'card-system',
            'ui'
        ];
        for (const mod of testModules) {
            try {
                const m = require('./dist/' + mod);
                results[mod] = { ok: true, type: typeof m, keys: m ? Object.keys(m).slice(0, 10) : [] };
            } catch (e) {
                results[mod] = { ok: false, error: e.message.substring(0, 100) };
            }
        }
        return results;
    });
    console.log('Module loading results:');
    for (const [mod, result] of Object.entries(modTest)) {
        console.log('  ' + mod + ': ' + (result.ok ? 'OK (' + result.type + ', ' + result.keys.join(',') + ')' : 'FAIL - ' + result.error));
    }
    
    // Check final window state
    const winState = await page.evaluate(() => {
        const w = {};
        w.CoreLogic = typeof window.CoreLogic;
        if (window.CoreLogic) w.CoreLogicKeys = Object.keys(window.CoreLogic).slice(0, 5);
        w.CardLogic = typeof window.CardLogic;
        if (window.CardLogic) w.CardLogicKeys = Object.keys(window.CardLogic).slice(0, 5);
        w.resetGame = typeof window.resetGame;
        w.boardChildren = (document.getElementById('board') || { children: { length: -1 } }).children.length;
        return w;
    });
    console.log('\nWindow state:', JSON.stringify(winState, null, 2));
    
    // Show all remaining errors
    const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror');
    console.log('\nRemaining errors (' + errors.length + '):');
    errors.forEach(l => console.log('  [' + l.type + '] ' + l.text.substring(0, 200)));
    
    await browser.close();
})();
