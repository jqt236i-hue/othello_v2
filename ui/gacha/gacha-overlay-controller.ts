'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function resolveGachaHelpersModule(): any {
  try {
    return _require('../../shared/gacha-helpers.js');
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GachaHelpersModule) return (globalThis as any).GachaHelpersModule;
  } catch (e) { /* ignore */ }
  return null;
}

function buildTransactionFailureMessage(transaction: any): string {
  if (!transaction || transaction.ok === true) return 'ガチャを引けませんでした';
  const data = (transaction.messageData && typeof transaction.messageData === 'object')
    ? transaction.messageData
    : {};
  switch (transaction.code) {
  case 'init-unavailable':
    return 'ガチャ機能を初期化できません';
  case 'catalog-empty':
    return 'ガチャ報酬が未登録です';
  case 'insufficient-observation-stones': {
    const missing = Math.max(0, Math.floor(Number(data.missing) || 0));
    return `観測石が足りません（あと${missing}個）`;
  }
  case 'roll-failed':
    return '抽選対象の報酬が不足しています';
  default:
    return 'ガチャを引けませんでした';
  }
}

function createGachaOverlayController(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
  const view = opts.view || null;
  const helpersModule = opts.helpersModule || resolveGachaHelpersModule();
  const transactionModule = opts.transactionModule || null;
  const revealPlayer = opts.revealPlayer || null;
  const dispatchInventoryUpdated = typeof opts.dispatchInventoryUpdated === 'function'
    ? opts.dispatchInventoryUpdated
    : function () {};
  if (!view || !transactionModule || !helpersModule) return null;

  const state = {
    isOpen: false,
    isAnimating: false
  };

  function getCatalogItems(): any[] {
    return transactionModule.getCatalogItems(opts.transactionOptions);
  }

  function getObservationStoneBalance(): number {
    return transactionModule.getObservationStoneBalance(rootRef, opts.transactionOptions);
  }

  function syncViewState(): any {
    const catalogItems = getCatalogItems();
    const balance = getObservationStoneBalance();
    view.syncBalanceAndButtons({
      balance,
      hasCatalog: catalogItems.length > 0,
      isAnimating: state.isAnimating,
      singlePullCost: helpersModule.OBSERVATION_STONE_PULL_COST,
      tenPullCost: helpersModule.OBSERVATION_STONE_TEN_PULL_COST
    });
    view.renderDetails(catalogItems, helpersModule);
    return {
      balance,
      catalogItems,
      hasCatalog: catalogItems.length > 0
    };
  }

  function refresh(refreshOptions?: any): any {
    const ro = (refreshOptions && typeof refreshOptions === 'object') ? refreshOptions : {};
    const snapshot = syncViewState();
    if (ro.keepStatus === true) return snapshot;

    if (!snapshot.hasCatalog) {
      view.writeStatus('ガチャ報酬が未登録です', true);
      return snapshot;
    }
    view.writeStatus('観測石を集めて手の見た目や配置音を解放できます', false);
    return snapshot;
  }

  function setBusyState(visible: boolean): void {
    state.isAnimating = visible === true;
    view.setBusyState(state.isAnimating);
    syncViewState();
  }

  function setOverlayVisible(visible: boolean, overlayOptions?: any): boolean {
    const oo = (overlayOptions && typeof overlayOptions === 'object') ? overlayOptions : {};
    if (visible !== true && state.isAnimating === true && oo.force !== true) return false;

    state.isOpen = visible === true;
    view.setOverlayVisible(state.isOpen);
    if (!state.isOpen) return true;

    refresh();
    view.focusPrimaryAction();
    return true;
  }

  async function playPullPresentation(transaction: any): Promise<any> {
    const safeTransaction = (transaction && typeof transaction === 'object') ? transaction : null;
    if (!safeTransaction || safeTransaction.ok !== true) return null;

    setBusyState(true);
    view.setResultsBusy(true);
    view.writeStatus('観測が収束しています...', false);

    try {
      if (revealPlayer && typeof revealPlayer.play === 'function') {
        try {
          await revealPlayer.play(safeTransaction);
        } catch (e) { /* ignore */ }
      }

      view.renderPullResults(safeTransaction.pulls, safeTransaction.newlyUnlockedIds);
      dispatchInventoryUpdated(rootRef, {
        pulls: safeTransaction.pulls,
        newlyUnlockedIds: safeTransaction.newlyUnlockedIds,
        alreadyOwnedIds: safeTransaction.alreadyOwnedIds,
        state: safeTransaction.state
      });
      view.writeStatus(
        `新規 ${safeTransaction.newCount}件 / 所持済み ${safeTransaction.duplicateCount}件`,
        false
      );
    } finally {
      view.setResultsBusy(false);
      setBusyState(false);
    }

    return {
      pulls: safeTransaction.pulls,
      newlyUnlockedIds: safeTransaction.newlyUnlockedIds,
      alreadyOwnedIds: safeTransaction.alreadyOwnedIds,
      state: safeTransaction.state
    };
  }

  async function performPull(pullCount: number): Promise<any> {
    if (state.isAnimating) return null;
    const transaction = transactionModule.commitPullTransaction(rootRef, pullCount, Object.assign({}, opts.transactionOptions, {
      randomFn: opts.randomFn
    }));
    if (!transaction || transaction.ok !== true) {
      refresh({ keepStatus: true });
      view.writeStatus(buildTransactionFailureMessage(transaction), true);
      return null;
    }

    view.renderPullResults([], []);
    refresh({ keepStatus: true });
    return playPullPresentation(transaction);
  }

  function toggleDetails(): boolean {
    if (state.isAnimating) return false;
    view.setDetailsVisible(!view.isDetailsVisible());
    return true;
  }

  function initialize(): void {
    view.renderPullResults([], []);
    view.setDetailsVisible(false);
    refresh();
    setOverlayVisible(false, { force: true });
  }

  return {
    initialize,
    refresh,
    performPull,
    toggleDetails,
    getCatalogItems,
    openOverlay: function () {
      return setOverlayVisible(true);
    },
    closeOverlay: function (co?: any) {
      return setOverlayVisible(false, co);
    },
    handleEscape: function () {
      if (!state.isOpen || state.isAnimating) return false;
      return setOverlayVisible(false);
    },
    handleOverlayBackgroundClick: function (event: Event) {
      if (state.isAnimating || !event) return false;
      if (event.target !== view.refs.overlay) return false;
      return setOverlayVisible(false);
    },
    isOpen: function () {
      return state.isOpen;
    },
    isAnimating: function () {
      return state.isAnimating;
    }
  };
}

const GachaOverlayController = {
  buildTransactionFailureMessage,
  createGachaOverlayController
};

export = GachaOverlayController;
