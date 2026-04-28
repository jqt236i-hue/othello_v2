import observationGachaModule = require('./generate-observation-gacha-catalog');
const { generateObservationGachaCatalogs } = observationGachaModule;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface GachaHandCatalogOptions {
  root?: string;
  observationOutPath?: string;
  handAdapterOutPath?: string;
  genericOutPath?: string;
  outPath?: string;
  write?: boolean;
  persist?: boolean;
}

function generateGachaHandCatalog(options: GachaHandCatalogOptions = {}): any {
    return generateObservationGachaCatalogs(options);
}

if (require.main === module) {
    try {
        const result = generateGachaHandCatalog();
        console.log('[gacha-hand-catalog] compatibility wrapper -> generate-observation-gacha-catalog.js');
        console.log('[gacha-hand-catalog] generated', (result as any).outPath);
        process.exit(0);
    } catch (e) {
        console.error('[gacha-hand-catalog] failed', e);
        process.exit(2);
    }
}

export = { 
    generateGachaHandCatalog,
    generateObservationGachaCatalogs
 } as any;
