/**
 * @file smart.js
 * @description AI level select handlers
 */

/**
 * AI レベル選択の設定
 * Setup smart level selects
 */
function setupSmartSelects(smartBlack, smartWhite) {
    const smartOptions = [
        { v: '1', t: 'Lv1: 盤喰いの小鬼' },
        { v: '2', t: 'Lv2: 反転の影' },
        { v: '3', t: 'Lv3: 布石を紡ぐ者' },
        { v: '4', t: 'Lv4: 盤面支配者' },
        { v: '5', t: 'Lv5: 終局を告げる者' },
        { v: '6', t: 'Lv6: 盤理の観測者' },
        { v: '7', t: 'LvMax: 理論の化身' }
    ];

    if (smartBlack) {
        smartOptions.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.v;
            el.textContent = opt.t;
            smartBlack.appendChild(el);
        });
        smartBlack.value = String(cpuSmartness.black || 1);
        smartBlack.addEventListener('change', async (e) => {
            const newLevel = Number(e.target.value) || 1;
            cpuSmartness.black = newLevel;
            console.log(`[CPU Level] Black changed to level ${cpuSmartness.black}`);
            // Reload policy if MCCFR is available
            if (typeof CpuPolicy !== 'undefined' && CpuPolicy.loadPolicyForLevel) {
                try {
                    mccfrPolicy = await CpuPolicy.loadPolicyForLevel(cpuSmartness.black);
                    addLog(`黒レベル ${cpuSmartness.black} のポリシーを読み込みました`);
                } catch (err) {
                    console.warn('Policy reload failed:', err);
                }
            }
        });
    }

    if (smartWhite) {
        smartOptions.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.v;
            el.textContent = opt.t;
            smartWhite.appendChild(el);
        });
        smartWhite.value = String(cpuSmartness.white || 1);
        smartWhite.addEventListener('change', async (e) => {
            const newLevel = Number(e.target.value) || 1;
            cpuSmartness.white = newLevel;
            console.log(`[CPU Level] White changed to level ${cpuSmartness.white}`);
            updateCpuCharacter();
            // Reload policy for new level
            if (typeof CpuPolicy !== 'undefined' && CpuPolicy.loadPolicyForLevel) {
                try {
                    mccfrPolicy = await CpuPolicy.loadPolicyForLevel(cpuSmartness.white);
                    addLog(`レベル ${cpuSmartness.white} のポリシーを読み込みました`);
                } catch (err) {
                    console.warn('Policy reload failed:', err);
                }
            }
        });
    }
}

if (typeof window !== 'undefined') {
    window.setupSmartSelects = setupSmartSelects;
}
