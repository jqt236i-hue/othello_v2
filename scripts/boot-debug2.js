const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const logs = [];
    page.on('console', msg => {
        logs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));
    
    await page.goto('http://127.0.0.1:8000/?debug=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(15000);
    
    // Find require-not-found logs
    const notFound = logs.filter(l => l.text.includes('require-not-found'));
    console.log('Not-found requires (' + notFound.length + '):');
    notFound.forEach(l => console.log('  ' + l.text));
    
    // Find init-dom related
    const initDom = logs.filter(l => l.text.includes('init-dom') || l.text.includes('bootstrap/init'));
    console.log('\ninit-dom related logs:');
    initDom.forEach(l => console.log('  [' + l.type + '] ' + l.text));
    
    // Screen state
    const winState = await page.evaluate(() => {
        return {
            CoreLogic: typeof window.CoreLogic,
            CardLogic: typeof window.CardLogic,
            resetGame: typeof window.resetGame,
            boardChildren: (document.getElementById('board') || { children: { length: -1 } }).children.length
        };
    });
    console.log('\nWindow state:', JSON.stringify(winState));
    
    // All errors
    const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror');
    console.log('\nAll errors (' + errors.length + '):');
    errors.forEach(l => console.log('  [' + l.type + '] ' + l.text.substring(0, 200)));
    
    await browser.close();
})();
