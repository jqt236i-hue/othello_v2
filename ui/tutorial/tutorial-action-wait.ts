'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const DISABLED_CLASS = 'tutorial-disabled-target';
const HIGHLIGHT_CLASS = 'tutorial-highlight-target';
const INTERACTIVE_SELECTOR = [
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '#board .cell',
  '#handWrapper .card-item',
  '#card-detail-panel',
  '#rulesHelpBtn',
  '#resetBtn',
  '#debugModeBtn',
  '#gachaOpenBtn',
  '#modeCpuBtn',
  '#modeNetworkBtn',
  '#leaderboardOpenBtn',
  '#humanVsHumanBtn'
].join(', ');

function queryAll(rootRef: any, selector: string): any[] {
  if (!rootRef || !selector) return [];
  return Array.prototype.slice.call(rootRef.querySelectorAll(selector));
}

function uniqElements(elements: any[]): any[] {
  const seen = new Set();
  const out: any[] = [];
  for (const el of elements || []) {
    if (!el || seen.has(el)) continue;
    seen.add(el);
    out.push(el);
  }
  return out;
}

function normalizeCardId(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.id) return String(value.id);
  return null;
}

function toDescriptorList(value: any): any[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function getObserverMarkerKeys(cardState: any): Set<string> {
  if (!cardState || !Array.isArray(cardState.markers)) return new Set();
  const set = new Set<string>();
  for (const marker of cardState.markers) {
    if (!marker || !marker.data) continue;
    if (String(marker.data.type || '').toUpperCase() !== 'OBSERVER') continue;
    set.add(`${marker.row},${marker.col}`);
  }
  return set;
}

function createTutorialActionWait(options?: any): any {
  const opts = options && typeof options === 'object' ? options : {};
  const rootRef = opts.root || (typeof document !== 'undefined' ? document : null);
  const overlayRoot = opts.overlay || null;
  const resolveDescriptorTargets = typeof opts.resolveDescriptorTargets === 'function'
    ? opts.resolveDescriptorTargets
    : function () { return []; };

  let cleanup: () => void = function () {};

  function clearMarks(): void {
    if (!rootRef || !rootRef.querySelectorAll) return;
    queryAll(rootRef, `.${DISABLED_CLASS}`).forEach((el: any) => el.classList.remove(DISABLED_CLASS));
    queryAll(rootRef, `.${HIGHLIGHT_CLASS}`).forEach((el: any) => el.classList.remove(HIGHLIGHT_CLASS));
  }

  function computeSuccess(step: any, context: any, baseline: any): boolean {
    const condition = step && step.successCondition ? step.successCondition : {};
    const gameState = context && context.root ? context.root.gameState : null;
    const cardState = context && context.root ? context.root.cardState : null;
    const blackValue = (context && context.blackValue) || 1;

    if (condition.playerPlacedStone === true) {
      return !!(gameState && Number(gameState.turnNumber) > baseline.turnNumber);
    }

    if (condition.selectedCardId) {
      return !!(cardState && String(cardState.selectedCardId || '') === String(condition.selectedCardId));
    }

    if (condition.usedCardId) {
      const lastUsedId = normalizeCardId(cardState && cardState.lastUsedCardByPlayer && cardState.lastUsedCardByPlayer.black);
      return lastUsedId === String(condition.usedCardId);
    }

    if (condition.playerPlacedOnNumericCell === true) {
      const target = context && typeof context.getFlag === 'function'
        ? context.getFlag('numericTargetCell', null)
        : null;
      if (!target || !gameState || !Array.isArray(gameState.board)) return false;
      return gameState.board[target.row] && gameState.board[target.row][target.col] === blackValue
        && Number(gameState.turnNumber) > baseline.turnNumber;
    }

    if (condition.playerPlacedStoneAfterObserver === true) {
      if (!gameState || !cardState) return false;
      const currentMarkers = getObserverMarkerKeys(cardState);
      const hasNewObserver = Array.from(currentMarkers).some((key: string) => !baseline.observerMarkerKeys.has(key));
      return hasNewObserver && Number(gameState.turnNumber) > baseline.turnNumber;
    }

    return false;
  }

  function buildBaseline(context: any): any {
    const rootObj = context && context.root ? context.root : {};
    return {
      turnNumber: Number(rootObj.gameState && rootObj.gameState.turnNumber) || 0,
      observerMarkerKeys: getObserverMarkerKeys(rootObj.cardState)
    };
  }

  function resolveTargetsByDescriptors(descriptors: any, context: any): any[] {
    return uniqElements(
      toDescriptorList(descriptors).flatMap((descriptor: any) => resolveDescriptorTargets(descriptor, context))
    );
  }

  function hasMatchingDescendant(element: any, targets: any[]): boolean {
    if (!element || typeof element.contains !== 'function') return false;
    return (targets || []).some((target: any) => target && target !== element && element.contains(target));
  }

  function getLockMode(step: any): string {
    const value = step && step.lockMode ? String(step.lockMode) : 'exclusive';
    return value === 'targeted' ? 'targeted' : 'exclusive';
  }

  function buildLockSnapshot(step: any, context: any): any {
    const highlightTargets = resolveTargetsByDescriptors(step && step.highlight, context);
    const explicitLockedTargets = resolveTargetsByDescriptors(step && step.lock, context);
    const allInteractive = queryAll(rootRef, INTERACTIVE_SELECTOR).filter((el: any) => {
      if (!el) return false;
      if (overlayRoot && overlayRoot.contains(el)) return false;
      return true;
    });
    return {
      highlightTargets,
      explicitLockedTargets,
      allInteractive,
      lockMode: getLockMode(step)
    };
  }

  function shouldDisableInteractive(element: any, snapshot: any): boolean {
    if (!element || !snapshot) return false;
    const highlightSet = new Set(snapshot.highlightTargets);
    const explicitLockSet = new Set(snapshot.explicitLockedTargets);
    const highlighted = highlightSet.has(element) || hasMatchingDescendant(element, snapshot.highlightTargets);
    if (highlighted) return false;
    if (explicitLockSet.has(element) || hasMatchingDescendant(element, snapshot.explicitLockedTargets)) {
      return true;
    }
    return snapshot.lockMode === 'exclusive';
  }

  function refreshLocks(step: any, context: any): void {
    clearMarks();
    if (!rootRef || !rootRef.querySelectorAll) return;
    const snapshot = buildLockSnapshot(step, context);
    for (const el of snapshot.allInteractive) {
      if (shouldDisableInteractive(el, snapshot)) {
        el.classList.add(DISABLED_CLASS);
      } else {
        el.classList.remove(DISABLED_CLASS);
      }
    }
    for (const el of snapshot.highlightTargets) {
      el.classList.remove(DISABLED_CLASS);
      el.classList.add(HIGHLIGHT_CLASS);
    }
  }

  function waitFor(step: any, context: any): Promise<any> {
    cleanup();
    const baseline = buildBaseline(context);
    let resolved = false;
    const subscriptions: any[] = [];
    let intervalId: any = null;

    const tryResolve = (resolve: any) => {
      if (resolved) return;
      refreshLocks(step, context);
      if (!computeSuccess(step, context, baseline)) return;
      resolved = true;
      cleanup();
      resolve(true);
    };

    cleanup = function () {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      const gameEvents = context && context.root && context.root.GameEvents && context.root.GameEvents.gameEvents;
      for (const entry of subscriptions) {
        try {
          if (gameEvents && typeof gameEvents.off === 'function') {
            gameEvents.off(entry.type, entry.handler);
          }
        } catch (e) { /* ignore */ }
      }
      subscriptions.length = 0;
      clearMarks();
    };

    return new Promise((resolve) => {
      refreshLocks(step, context);
      intervalId = setInterval(() => tryResolve(resolve), 90);
      const gameEvents = context && context.root && context.root.GameEvents && context.root.GameEvents.gameEvents;
      const eventTypes = context && context.root && context.root.GameEvents && context.root.GameEvents.EVENT_TYPES
        ? context.root.GameEvents.EVENT_TYPES
        : null;
      if (gameEvents && eventTypes && typeof gameEvents.on === 'function') {
        const bind = (type: string) => {
          const handler = function () { tryResolve(resolve); };
          subscriptions.push({ type, handler });
          gameEvents.on(type, handler);
        };
        bind(eventTypes.BOARD_UPDATED);
        bind(eventTypes.CARD_STATE_CHANGED);
        bind(eventTypes.GAME_STATE_CHANGED);
      }
    });
  }

  return {
    waitFor,
    cleanup: function () {
      cleanup();
      cleanup = function () {};
    }
  };
}

const TutorialActionWait = {
  createTutorialActionWait
};

export = TutorialActionWait;
