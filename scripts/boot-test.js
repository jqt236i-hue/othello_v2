/**
 * Quick Playwright test to verify browser boot path.
 */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[cjs]') || text.includes('[boot]') || text.includes('Error') || text.includes('error') || msg.type() === 'error') {
            console.log('[' + msg.type() + ']', text.substring(0, 200));
        }
    });
    
    page.on('pageerror', err => {
        console.log('PAGE ERROR:', err.message.substring(0, 200));
    });
    
    await page.goto('http://127.0.0.1:8000/?debug=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('Page loaded, title:', await page.title());
    
    // Wait for a bit to let scripts execute
    await page.waitForTimeout(5000);
    
    // Check runtime globals
    const globals = await page.evaluate(() => {
        return {
            hasRequire: typeof window.require === 'function',
            hasCjsRegister: typeof window.__cjsRegister === 'function',
            registryKeys: Object.keys(window.__cjsRegistry || {}).length,
            hasCoreLogic: typeof window.CoreLogic !== 'undefined',
            hasCardLogic: typeof window.CardLogic !== 'undefined',
            boardChildren: (document.getElementById('board') || {}).children ? document.getElementById('board').children.length : -1,
            hasResetGame: typeof window.resetGame === 'function',
            readyState: document.readyState
        };
    });
    console.log('Globals:', JSON.stringify(globals, null, 2));
    
    // Take a screenshot
    await page.screenshot({ path: 'playwright-boot-test.png' });
    console.log('Screenshot saved');
    
    await browser.close();
})();