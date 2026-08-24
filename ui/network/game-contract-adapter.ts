'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

import CardDefinitions = require('../../game/logic/cards/defs');

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

type ModuleResolver = (requirePath: string, globalKey: string) => any;

interface NetworkGameContractAdapterOptions {
  root?: any;
  cardLogicModule?: any;
  pendingCoordinatorModule?: any;
  pendingSelectionContractModule?: any;
  moduleResolver?: ModuleResolver;
}

function resolveRuntimeRoot(root?: any): any {
  if (root && typeof root === 'object') return root;
  try {
    if (typeof globalThis !== 'undefined') return globalThis as any;
  } catch (e) { /* ignore */ }
  return {};
}

function resolveModule(defaultRoot: any, resolver: ModuleResolver | undefined, requirePath: string, globalKey: string): any {
  if (typeof resolver === 'function') {
    const resolved = resolver(requirePath, globalKey);
    if (resolved) return resolved;
  }
  try {
    if (typeof _require === 'function') {
      const mod = _require(requirePath);
      if (mod) return mod;
    }
  } catch (e) { /* ignore */ }
  try {
    if (defaultRoot && defaultRoot[globalKey]) return defaultRoot[globalKey];
  } catch (e) { /* ignore */ }
  return null;
}

function createNetworkGameContractAdapter(options?: NetworkGameContractAdapterOptions): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const root = resolveRuntimeRoot(opts.root);
  let cardLogicModule = Object.prototype.hasOwnProperty.call(opts, 'cardLogicModule')
    ? opts.cardLogicModule
    : undefined;
  let pendingCoordinatorModule = Object.prototype.hasOwnProperty.call(opts, 'pendingCoordinatorModule')
    ? opts.pendingCoordinatorModule
    : undefined;
  let pendingSelectionContractModule = Object.prototype.hasOwnProperty.call(opts, 'pendingSelectionContractModule')
    ? opts.pendingSelectionContractModule
    : undefined;

  function getCardLogicModule(): any {
    if (typeof cardLogicModule !== 'undefined') return cardLogicModule || null;
    cardLogicModule = root && root.CardLogic ? root.CardLogic : null;
    return cardLogicModule || null;
  }

  function getPendingCoordinatorModule(): any {
    if (typeof pendingCoordinatorModule !== 'undefined') return pendingCoordinatorModule || null;
    pendingCoordinatorModule = resolveModule(root, opts.moduleResolver, '../../game/turn/pending-coordinator', 'PendingCoordinator');
    return pendingCoordinatorModule || null;
  }

  function getPendingSelectionContractModule(): any {
    if (typeof pendingSelectionContractModule !== 'undefined') return pendingSelectionContractModule || null;
    pendingSelectionContractModule = resolveModule(root, opts.moduleResolver, '../../game/turn/pending-selection-contract', 'PendingSelectionContract');
    return pendingSelectionContractModule || null;
  }

  function resolveCardTypeForId(cardId: any): string | null {
    if (!cardId) return null;
    const cardLogic = getCardLogicModule();
    if (cardLogic && typeof cardLogic.getCardDef === 'function') {
      const def = cardLogic.getCardDef(cardId);
      if (def && def.type) return String(def.type);
    }
    if (CardDefinitions && typeof CardDefinitions.getCardType === 'function') {
      const cardType = CardDefinitions.getCardType(String(cardId));
      if (cardType) return String(cardType);
    }
    if (CardDefinitions && typeof CardDefinitions.getCardDef === 'function') {
      const def = CardDefinitions.getCardDef(String(cardId));
      if (def && def.type) return String(def.type);
    }
    return null;
  }

  function getPendingSelectionContract(cardType: any): any {
    if (!cardType) return null;
    const pendingCoordinator = getPendingCoordinatorModule();
    if (pendingCoordinator && typeof pendingCoordinator.getPendingSelectionContract === 'function') {
      try {
        return pendingCoordinator.getPendingSelectionContract(cardType) || null;
      } catch (e) { /* ignore */ }
    }
    const pendingSelectionContract = getPendingSelectionContractModule();
    if (!pendingSelectionContract || typeof pendingSelectionContract.getPendingSelectionContract !== 'function') return null;
    try {
      return pendingSelectionContract.getPendingSelectionContract(cardType) || null;
    } catch (e) { /* ignore */ }
    return null;
  }

  function shouldDeferNetworkPublishForPendingType(cardType: any): boolean {
    if (!cardType) return false;
    const pendingCoordinator = getPendingCoordinatorModule();
    if (pendingCoordinator && typeof pendingCoordinator.shouldDeferNetworkPublishForPendingType === 'function') {
      try {
        return pendingCoordinator.shouldDeferNetworkPublishForPendingType(cardType) === true;
      } catch (e) {
        return false;
      }
    }
    const pendingSelectionContract = getPendingSelectionContractModule();
    if (pendingSelectionContract && typeof pendingSelectionContract.shouldDeferNetworkPublishForPendingType === 'function') {
      try {
        return pendingSelectionContract.shouldDeferNetworkPublishForPendingType(cardType) === true;
      } catch (e) {
        return false;
      }
    }
    const contract = getPendingSelectionContract(cardType);
    return !!(contract && contract.deferNetworkPublish === true);
  }

  function getPendingEffectType(cardStateValue: any, playerKey: any, normalizePlayerKey?: any): any {
    const pendingCoordinator = getPendingCoordinatorModule();
    if (!pendingCoordinator || typeof pendingCoordinator.getPendingEffectType !== 'function') return null;
    try {
      const resolvedPlayerKey = typeof normalizePlayerKey === 'function'
        ? normalizePlayerKey(playerKey)
        : playerKey;
      return pendingCoordinator.getPendingEffectType(cardStateValue, resolvedPlayerKey);
    } catch (e) {
      return null;
    }
  }

  function syncPendingSelectionActionCache(pendingState: any, syncOptions?: any): any {
    const pendingCoordinator = getPendingCoordinatorModule();
    if (pendingCoordinator && typeof pendingCoordinator.syncPendingSelectionActionCache === 'function') {
      try {
        return pendingCoordinator.syncPendingSelectionActionCache(pendingState, syncOptions);
      } catch (e) { /* ignore */ }
    }
    return { cleared: [], retained: [] };
  }

  function applyPendingSelectionCardContext(params: any, actor: any, pendingSelectionState?: any, extraOptions?: any): any {
    const pendingCoordinator = getPendingCoordinatorModule();
    if (pendingCoordinator && typeof pendingCoordinator.applyPendingSelectionCardContext === 'function') {
      try {
        return pendingCoordinator.applyPendingSelectionCardContext(params, actor, pendingSelectionState, extraOptions);
      } catch (e) { /* ignore */ }
    }
    return params;
  }

  return {
    resolveCardTypeForId,
    getPendingSelectionContract,
    shouldDeferNetworkPublishForPendingType,
    getPendingEffectType,
    syncPendingSelectionActionCache,
    applyPendingSelectionCardContext
  };
}

export = {
  createNetworkGameContractAdapter
};
