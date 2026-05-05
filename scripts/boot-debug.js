const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Intercept console for ALL messages
    const logs = [];
    page.on('console', msg => {
        logs.push({ type: msg.type(), text: msg.text().substring(0, 300) });
    });
    page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message.substring(0, 300) }));
    
    await page.goto('http://127.0.0.1:8000/?debug=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(8000);
    
    // Check detailed state
    const detailed = await page.evaluate(() => {
        const r = [];
        // Check __cjsRegistry
        r.push('registryKeys: ' + Object.keys(window.__cjsRegistry || {}).length);
        // Check registry variable directly via require's lookup
        // Try to access registry via closure - we can't, but we can check if _r was set
        r.push('_r is __cjsRegister: ' + (typeof window._r === 'function'));
        r.push('__cjsRegister is function: ' + (typeof window.__cjsRegister === 'function'));
        // Check if script tags were loaded
        const scripts = document.querySelectorAll('script');
        r.push('Script tags: ' + scripts.length);
        scripts.forEach((s, i) => {
            const src = s.src || 'inline';
            r.push('  [' + i + '] ' + src.substring(src.lastIndexOf('/') + 1));
        });
        return r.join('\n');
    });
    console.log('Detailed state:');
    console.log(detailed);
    
    // Search for __cjsRegister calls
    const cjsLogs = logs.filter(l => l.text.includes('_r(') || l.text.includes('__cjsRegister') || l.text.includes('registry'));
    console.log('\nRelevant console entries (' + cjsLogs.length + '):');
    cjsLogs.forEach(l => console.log(l.type + ': ' + l.text.substring(0, 150)));
    
    console.log('\nFirst 20 console entries:');
    logs.slice(0, 20).forEach(l => console.log('  [' + l.type + '] ' + l.text.substring(0, 200)));
    
    await browser.close();
})();
