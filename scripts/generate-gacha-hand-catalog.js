const { generateObservationGachaCatalogs } = require('./generate-observation-gacha-catalog');

function generateGachaHandCatalog(options = {}) {
    return generateObservationGachaCatalogs(options);
}

if (require.main === module) {
    try {
        const result = generateGachaHandCatalog();
        console.log('[gacha-hand-catalog] compatibility wrapper -> generate-observation-gacha-catalog.js');
        console.log('[gacha-hand-catalog] generated', result.outPath);
        process.exit(0);
    } catch (e) {
        console.error('[gacha-hand-catalog] failed', e);
        process.exit(2);
    }
}

module.exports = {
    generateGachaHandCatalog,
    generateObservationGachaCatalogs
};
