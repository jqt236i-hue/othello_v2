'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const TRANSACTION_ERROR_CODES = Object.freeze({
  INIT_UNAVAILABLE: 'init-unavailable',
  CATALOG_EMPTY: 'catalog-empty',
  INSUFFICIENT_OBSERVATION_STONES: 'insufficient-observation-stones',
  ROLL_FAILED: 'roll-failed'
});

function resolveGachaHelpersModule(): any {
  try {
    return _require('../../shared/gacha-helpers.js');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaHelpersModule) return (globalThis as any).GachaHelpersModule;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveObservationCatalogAccessModule(): any {
  try {
    return _require('./catalog-access.js');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).ObservationGachaCatalogAccessModule) {
      return (globalThis as any).ObservationGachaCatalogAccessModule;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function resolveGachaProgressStorageModule(): any {
  try {
    return _require('../storage/gacha-progress.js');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaProgressStorage) return (globalThis as any).GachaProgressStorage;
  } catch (e) { /* ignore */ }
  return null;
}

function getCatalogItems(options?: any): any[] {
  const opts = (options && typeof options === 'object') ? options : {};
  if (Array.isArray(opts.catalogItems)) {
    return opts.catalogItems.filter(Boolean);
  }
  const catalogAccessModule = opts.catalogAccessModule || resolveObservationCatalogAccessModule();
  if (!catalogAccessModule || typeof catalogAccessModule.getObservationCatalogItems !== 'function') {
    return [];
  }
  return catalogAccessModule.getObservationCatalogItems(opts);
}

function getObservationStoneBalance(rootRef: any, options?: any): number {
  const opts = (options && typeof options === 'object') ? options : {};
  const storageModule = opts.storageModule || resolveGachaProgressStorageModule();
  if (!storageModule || typeof storageModule.getObservationStones !== 'function') return 0;
  return storageModule.getObservationStones(rootRef);
}

function normalizePullCount(value: number): number {
  return value === 10 ? 10 : 1;
}

function buildFailure(code: string, messageData?: any): { ok: false; code: string; messageData: any } {
  return {
    ok: false,
    code,
    messageData: (messageData && typeof messageData === 'object') ? messageData : {}
  };
}

function commitPullTransaction(rootRef: any, pullCount: number, options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const helpersModule = opts.helpersModule || resolveGachaHelpersModule();
  const storageModule = opts.storageModule || resolveGachaProgressStorageModule();
  const catalogItems = getCatalogItems(Object.assign({ root: rootRef }, opts));

  if (!helpersModule || !storageModule) {
    return buildFailure(TRANSACTION_ERROR_CODES.INIT_UNAVAILABLE);
  }
  if (!catalogItems.length) {
    return buildFailure(TRANSACTION_ERROR_CODES.CATALOG_EMPTY);
  }

  const count = normalizePullCount(pullCount);
  const cost = count === 10
    ? helpersModule.OBSERVATION_STONE_TEN_PULL_COST
    : helpersModule.OBSERVATION_STONE_PULL_COST;
  const spendResult = storageModule.spendObservationStones(rootRef, cost);
  if (!spendResult || spendResult.ok !== true) {
    const missing = spendResult && Number.isFinite(Number(spendResult.missing))
      ? Math.max(0, Math.floor(Number(spendResult.missing)))
      : Math.max(0, cost - getObservationStoneBalance(rootRef, { storageModule }));
    return buildFailure(TRANSACTION_ERROR_CODES.INSUFFICIENT_OBSERVATION_STONES, {
      cost,
      missing
    });
  }

  const pulls: any[] = [];
  const rollFn = typeof helpersModule.rollObservationGacha === 'function'
    ? helpersModule.rollObservationGacha
    : helpersModule.rollHandGacha;
  for (let i = 0; i < count; i += 1) {
    const pull = typeof rollFn === 'function'
      ? rollFn(catalogItems, { randomFn: opts.randomFn })
      : null;
    if (!pull || !pull.item) {
      storageModule.awardObservationStones(rootRef, cost);
      return buildFailure(TRANSACTION_ERROR_CODES.ROLL_FAILED, {
        cost,
        count
      });
    }
    pulls.push(pull);
  }

  const applyResult = storageModule.applyPullResults(rootRef, pulls);
  return {
    ok: true,
    code: 'ok',
    count,
    cost,
    pulls,
    newlyUnlockedIds: applyResult.newlyUnlockedIds,
    alreadyOwnedIds: applyResult.alreadyOwnedIds,
    state: applyResult.state,
    newCount: applyResult.newlyUnlockedIds.length,
    duplicateCount: pulls.length - applyResult.newlyUnlockedIds.length
  };
}

const GachaTransaction = {
  TRANSACTION_ERROR_CODES,
  getCatalogItems,
  getObservationStoneBalance,
  commitPullTransaction
};

export = GachaTransaction;
