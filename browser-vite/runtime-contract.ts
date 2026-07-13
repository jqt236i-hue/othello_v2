export type BrowserLane = 'classic' | 'vite';

export interface ClassicScriptContract {
  runtime: string;
  registry: string;
  layout: string;
  entry: string;
}

export interface RuntimeContractInspection {
  ready: boolean;
  missingGlobals: string[];
  invalidGlobals: string[];
  missingElements: string[];
}

export const REQUIRED_GLOBAL_TYPES = Object.freeze({
  gameState: 'object',
  cardState: 'object',
  initializeUI: 'function',
  resetGame: 'function',
  forceFullRender: 'function',
  LazyRuntimeLoaderModule: 'object'
} as const);

export const REQUIRED_ELEMENT_IDS = Object.freeze([
  'board',
  'resetBtn',
  'debugModeBtn',
  'gachaOpenBtn',
  'modeNetworkBtn',
  'handSkinBtn'
]);

const META_NAMES: Readonly<Record<keyof ClassicScriptContract, string>> = Object.freeze({
  runtime: 'card-reversi-classic-runtime',
  registry: 'card-reversi-classic-registry',
  layout: 'card-reversi-classic-layout',
  entry: 'card-reversi-classic-entry'
});

export function readClassicScriptContract(documentRef: Document): ClassicScriptContract {
  const entries = Object.entries(META_NAMES).map(([key, metaName]) => {
    const element = documentRef.querySelector(`meta[name="${metaName}"]`) as HTMLMetaElement | null;
    const value = String(element && element.content || '').trim();
    if (!value) throw new Error(`missing Vite compatibility metadata: ${metaName}`);
    return [key, value];
  });
  return Object.fromEntries(entries) as unknown as ClassicScriptContract;
}

export function inspectRuntimeContract(rootRef: Window, documentRef: Document): RuntimeContractInspection {
  const root = rootRef as unknown as Record<string, unknown>;
  const missingGlobals: string[] = [];
  const invalidGlobals: string[] = [];
  for (const [name, expectedType] of Object.entries(REQUIRED_GLOBAL_TYPES)) {
    if (typeof root[name] === 'undefined' || root[name] === null) {
      missingGlobals.push(name);
    } else if (typeof root[name] !== expectedType) {
      invalidGlobals.push(`${name}:${typeof root[name]}!=${expectedType}`);
    }
  }
  const missingElements = REQUIRED_ELEMENT_IDS.filter((id) => !documentRef.getElementById(id));
  return {
    ready: root.__uiInitialized === true
      && missingGlobals.length === 0
      && invalidGlobals.length === 0
      && missingElements.length === 0,
    missingGlobals,
    invalidGlobals,
    missingElements
  };
}
