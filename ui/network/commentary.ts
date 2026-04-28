'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function createNetworkCommentaryController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);
  let commentaryContextHelpers: any = null;
  let commentaryBroker: any = null;

  function resolveFromGlobal(name: string): any {
    try {
      if (rootRef && rootRef[name]) return rootRef[name];
    } catch (e) { /* ignore */ }
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any)[name]) return (globalThis as any)[name];
    } catch (e) { /* ignore */ }
    return null;
  }

  function resolveCommentaryContextHelpers(): any {
    if (commentaryContextHelpers) return commentaryContextHelpers;

    commentaryContextHelpers = resolveFromGlobal('CommentaryContextHelpers');
    if (commentaryContextHelpers) return commentaryContextHelpers;

    try {
      commentaryContextHelpers = _require('../../shared/commentary-context-helpers');
      if (commentaryContextHelpers) return commentaryContextHelpers;
    } catch (e) { /* ignore */ }

    return null;
  }

  function resolveCommentaryBroker(): any {
    if (commentaryBroker) return commentaryBroker;
    commentaryBroker = resolveFromGlobal('CommentaryBroker');
    if (commentaryBroker) return commentaryBroker;
    try {
      commentaryBroker = _require('../commentary-broker');
      if (commentaryBroker) return commentaryBroker;
    } catch (e) { /* ignore */ }
    return null;
  }

  function ensureCommentaryBrokerInitialized(): any {
    const broker = resolveCommentaryBroker();
    if (!broker || typeof broker.initBroker !== 'function') return broker;
    try {
      broker.initBroker({
        root: rootRef,
        addLog: resolveLogWriter(),
        getShowHeroSpeechBubble: () => {
          try {
            if (rootRef && typeof rootRef.showHeroSpeechBubble === 'function') {
              return rootRef.showHeroSpeechBubble;
            }
          } catch (e) { /* ignore */ }
          return null;
        },
        getShowCpuSpeechBubble: () => {
          try {
            if (rootRef && typeof rootRef.showCpuSpeechBubble === 'function') {
              return rootRef.showCpuSpeechBubble;
            }
          } catch (e) { /* ignore */ }
          return null;
        }
      });
    } catch (e) { /* ignore */ }
    return broker;
  }

  function resolveState(): any {
    return (typeof cfg.getState === 'function' && cfg.getState()) || {};
  }

  function resolveLogWriter(): any {
    if (typeof cfg.addLog === 'function') return cfg.addLog;

    try {
      if (rootRef && typeof rootRef.addLog === 'function') {
        return rootRef.addLog.bind(rootRef);
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof globalThis !== 'undefined' && typeof (globalThis as any).addLog === 'function') {
        return (globalThis as any).addLog.bind(globalThis);
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function countDiscsFromBoard(board: any): any {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.countDiscsFromBoard === 'function') {
      return helpers.countDiscsFromBoard(board);
    }
    return { black: 0, white: 0 };
  }

  function resolvePhaseByTurn(turnNumber: number, occupiedCells: number): string {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.resolvePhaseByTurn === 'function') {
      return helpers.resolvePhaseByTurn(turnNumber, occupiedCells);
    }
    return 'middle';
  }

  function resolveAdvantageLabel(playerKey: string, counts: any): string {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.resolveAdvantageLabel === 'function') {
      return helpers.resolveAdvantageLabel(playerKey, counts);
    }
    return 'even';
  }

  function normalizePlayerKey(value: any): string {
    if (typeof cfg.normalizePlayerKey === 'function') {
      return cfg.normalizePlayerKey(value);
    }
    const normalized = String(value || '').trim().toLowerCase();
    if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
    return 'black';
  }

  function buildFallbackEventType(actionType: string, cardId?: string): string {
    const action = String(actionType || '').toLowerCase();
    if (action === 'pass') return 'pass';
    if (action === 'use_card') return 'card_used';
    if (cardId) return 'card_used';
    return 'turn_start';
  }

  function buildBoardSignature(board: any): string {
    try {
      return JSON.stringify(Array.isArray(board) ? board : []);
    } catch (e) {
      return '';
    }
  }

  function hasCardUseAnimation(playbackEvents: any[]): boolean {
    const events = Array.isArray(playbackEvents) ? playbackEvents : [];
    for (const ev of events) {
      const type = String(ev && ev.type || '').trim();
      if (type === 'card_use_animation' || type === 'CARD_USED') return true;
    }
    return false;
  }

  function resolveCardId(payload: any, snapshot: any, actorKey: string, playbackEvents: any[], runtimeHelpers: any): string | null {
    const playbackCardId = (runtimeHelpers && typeof runtimeHelpers.extractCardIdFromPlaybackEvents === 'function')
      ? runtimeHelpers.extractCardIdFromPlaybackEvents(playbackEvents)
      : null;
    if (playbackCardId) return playbackCardId;
    if (payload && payload.cardId) return String(payload.cardId);

    const lastUsedCardByPlayer = snapshot
      && snapshot.cardState
      && snapshot.cardState.lastUsedCardByPlayer
      && typeof snapshot.cardState.lastUsedCardByPlayer === 'object'
      ? snapshot.cardState.lastUsedCardByPlayer
      : null;
    if (!lastUsedCardByPlayer) return null;

    const actorCardId = lastUsedCardByPlayer[actorKey];
    return actorCardId ? String(actorCardId) : null;
  }

  function emitHeroReactionToRemoteCard(payload: any, snapshot: any, actorKey: string, playbackEvents: any[]): void {
    if (!payload || payload.ok !== true) return;
    if (hasCardUseAnimation(playbackEvents)) return;

    const state = resolveState();
    const localSeatKey = (normalizePlayerKey as any)(state.seatKey || '', 'black');
    if (!localSeatKey || actorKey === localSeatKey) return;

    const gameStateSnapshot = snapshot && snapshot.gameState ? snapshot.gameState : null;
    if (!gameStateSnapshot || !Array.isArray(gameStateSnapshot.board)) return;

    let runtimeHelpers = resolveFromGlobal('CommentaryRuntimeHelpers');
    if (!runtimeHelpers) {
      try {
        runtimeHelpers = _require('../../shared/commentary-runtime-helpers');
      } catch (e) { /* ignore */ }
    }
    const counts = countDiscsFromBoard(gameStateSnapshot.board);
    const turnNumber = Number.isFinite(gameStateSnapshot.turnNumber) ? gameStateSnapshot.turnNumber : null;
    const cardId = resolveCardId(payload, snapshot, actorKey, playbackEvents, runtimeHelpers);
    const commentaryKey = [
      'hero',
      localSeatKey,
      actorKey,
      turnNumber !== null ? turnNumber : '',
      cardId || '',
      buildBoardSignature(gameStateSnapshot.board)
    ].join('|');
    const broker = ensureCommentaryBrokerInitialized();
    if (!broker || typeof broker.requestCommentaryAndShow !== 'function') return;
    broker.requestCommentaryAndShow({
      eventType: 'card_used_by_enemy',
      playerKey: localSeatKey,
      speakerRole: 'hero',
      turnNumber,
      counts,
      board: gameStateSnapshot.board,
      cardId,
      dedupeScope: 'hero-network-card',
      dedupeKey: commentaryKey
    });
  }

  function emitSnapshotCommentary(payload: any, snapshot: any, isSelfOperation: boolean, playbackEvents: any[]): void {
    if (isSelfOperation) return;
    if (!payload || payload.ok !== true) return;

    const actorKey = normalizePlayerKey(payload.playerKey || '');
    const state = resolveState();
    if (!actorKey || actorKey === state.seatKey) return;

    const gameStateSnapshot = snapshot && snapshot.gameState ? snapshot.gameState : null;
    if (!gameStateSnapshot || !Array.isArray(gameStateSnapshot.board)) return;

    const counts = countDiscsFromBoard(gameStateSnapshot.board);
    const turnNumber = Number.isFinite(gameStateSnapshot.turnNumber) ? gameStateSnapshot.turnNumber : null;
    let runtimeHelpers = resolveFromGlobal('CommentaryRuntimeHelpers');
    if (!runtimeHelpers) {
      try {
        runtimeHelpers = _require('../../shared/commentary-runtime-helpers');
      } catch (e) { /* ignore */ }
    }
    const cardId = resolveCardId(payload, snapshot, actorKey, playbackEvents, runtimeHelpers);
    const eventType = (runtimeHelpers && typeof runtimeHelpers.resolveCommentaryEventType === 'function')
      ? runtimeHelpers.resolveCommentaryEventType(payload.actionType, cardId)
      : (buildFallbackEventType as any)(payload.actionType, cardId);
    const broker = ensureCommentaryBrokerInitialized();
    if (!broker || typeof broker.requestCommentaryAndShow !== 'function') return;
    broker.requestCommentaryAndShow({
      eventType,
      playerKey: actorKey,
      speakerRole: 'cpu',
      turnNumber,
      counts,
      board: gameStateSnapshot.board,
      cardId
    });

    if (eventType === 'card_used') {
      emitHeroReactionToRemoteCard(payload, snapshot, actorKey, playbackEvents);
    }
  }

  return {
    emitSnapshotCommentary
  };
}

const NetworkCommentary = {
  createNetworkCommentaryController
};

export = NetworkCommentary;
