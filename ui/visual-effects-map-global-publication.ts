'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function publishGameVisualEffectsMap(sharedMap: any): any {
  if (!sharedMap || !sharedMap.STONE_VISUAL_EFFECTS) return sharedMap;

  const root = (typeof globalThis !== 'undefined') ? globalThis as any : null;
  const browserRoot = (typeof window !== 'undefined') ? window as any : null;
  const targets = [root, browserRoot].filter((target, index, values) => target && values.indexOf(target) === index);

  for (const target of targets) {
    target.GameVisualEffectsMap = sharedMap;
    target.STONE_VISUAL_EFFECTS = sharedMap.STONE_VISUAL_EFFECTS;
    target.PENDING_TYPE_TO_EFFECT_KEY = sharedMap.PENDING_TYPE_TO_EFFECT_KEY;
    target.SPECIAL_TYPE_TO_EFFECT_KEY = sharedMap.SPECIAL_TYPE_TO_EFFECT_KEY;
  }

  try {
    const uiBootstrap = (typeof _require === 'function')
      ? _require('../shared/ui-bootstrap-shared')
      : null;
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
      uiBootstrap.registerUIGlobals({
        GameVisualEffectsMap: sharedMap,
        STONE_VISUAL_EFFECTS: sharedMap.STONE_VISUAL_EFFECTS
      });
    }
  } catch (e) { /* UI bootstrap registration is optional */ }

  try {
    if (root && typeof root.__visualEffectsMapReady === 'function') {
      root.__visualEffectsMapReady();
    }
  } catch (e) { /* UI notification is optional */ }

  return sharedMap;
}

export = { publishGameVisualEffectsMap };
