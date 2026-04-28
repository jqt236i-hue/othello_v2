'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function cloneData(value: any, cloneFn?: any): any {
  if (typeof cloneFn === 'function') {
    return cloneFn(value);
  }
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).structuredClone === 'function') {
      return (globalThis as any).structuredClone(value);
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(value));
}

function normalizeSeatKey(value: any): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'black' || normalized === 'white') return normalized;
  return null;
}

interface SnapshotMeta {
  authority: string;
  version: number | null;
  projectedForSeat: string | null;
  turnStartReconciled: boolean;
  projectedSnapshotHash: string | null;
}

function getSnapshotMeta(snapshot: any): SnapshotMeta | null {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot._meta || typeof snapshot._meta !== 'object') {
    return null;
  }
  const meta = snapshot._meta;
  const rawVersion = meta.version;
  return {
    authority: String(meta.authority || '').trim().toLowerCase(),
    version: (rawVersion === null || typeof rawVersion === 'undefined' || (typeof rawVersion === 'string' && rawVersion.trim() === ''))
      ? null
      : (Number.isFinite(Number(rawVersion)) ? Number(rawVersion) : null),
    projectedForSeat: normalizeSeatKey(meta.projectedForSeat),
    turnStartReconciled: meta.turnStartReconciled !== false,
    projectedSnapshotHash: (typeof meta.projectedSnapshotHash === 'string' && meta.projectedSnapshotHash.trim())
      ? meta.projectedSnapshotHash.trim()
      : null
  };
}

function getSnapshotVersion(snapshot: any): number | null {
  const meta = getSnapshotMeta(snapshot);
  if (meta && meta.version !== null) return meta.version;
  return Number.isFinite(Number(snapshot && snapshot.stateVersion))
    ? Number(snapshot.stateVersion)
    : null;
}

function inspectAuthoritativeSnapshot(snapshot: any, options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const meta = getSnapshotMeta(snapshot);
  if (!meta) {
    return {
      ok: false,
      rejectionType: 'missing_authority_metadata',
      telemetryType: 'snapshot_authority_metadata_missing',
      telemetryDetails: {
        force: opts.force === true
      },
      meta: null,
      version: getSnapshotVersion(snapshot)
    };
  }
  if (meta.authority !== 'server') {
    return {
      ok: false,
      rejectionType: 'invalid_authority',
      telemetryType: 'snapshot_authority_rejected',
      telemetryDetails: {
        authority: meta.authority || null
      },
      meta,
      version: getSnapshotVersion(snapshot)
    };
  }

  const localSeatKey = normalizeSeatKey(opts.localSeatKey);
  if (meta.projectedForSeat && localSeatKey && meta.projectedForSeat !== localSeatKey) {
    return {
      ok: false,
      rejectionType: 'projection_mismatch',
      telemetryType: 'snapshot_projection_mismatch_rejected',
      telemetryDetails: {
        projectedForSeat: meta.projectedForSeat,
        localSeatKey
      },
      meta,
      version: getSnapshotVersion(snapshot)
    };
  }

  const version = getSnapshotVersion(snapshot);
  const currentAppliedVersion = Number.isFinite(Number(opts.currentAppliedVersion))
    ? Number(opts.currentAppliedVersion)
    : null;

  if (opts.skipVersionChecks === true) {
    return {
      ok: true,
      rejectionType: null,
      telemetryType: null,
      telemetryDetails: null,
      meta,
      version
    };
  }

  if (opts.force !== true && version === null) {
    return {
      ok: false,
      rejectionType: 'missing_state_version',
      telemetryType: 'snapshot_missing_state_version_rejected',
      telemetryDetails: {
        force: false
      },
      meta,
      version
    };
  }

  if (opts.force !== true && version !== null && currentAppliedVersion !== null && version <= currentAppliedVersion) {
    return {
      ok: false,
      rejectionType: 'stale_snapshot',
      telemetryType: 'snapshot_stale_rejected',
      telemetryDetails: {
        nextVersion: version,
        currentVersion: currentAppliedVersion,
        force: false
      },
      meta,
      version
    };
  }

  return {
    ok: true,
    rejectionType: null,
    telemetryType: null,
    telemetryDetails: null,
    meta,
    version
  };
}

function normalizeChargeValue(value: any): number {
  return Number.isFinite(Number(value))
    ? Math.trunc(Number(value))
    : 0;
}

function normalizeChargePlayerKey(value: any): string {
  return (value === 'white' || value === -1 || value === '-1')
    ? 'white'
    : 'black';
}

function normalizeChargeState(charge: any): any {
  const nextCharge = (charge && typeof charge === 'object')
    ? Object.assign({}, charge)
    : {};
  nextCharge.black = normalizeChargeValue(nextCharge.black);
  nextCharge.white = normalizeChargeValue(nextCharge.white);
  return nextCharge;
}

function normalizeChargeDeltaEvent(event: any, fallbackSeq: number): any {
  if (!event || typeof event !== 'object') return null;
  const nextEvent = Object.assign({}, event);
  nextEvent.seq = Number.isFinite(Number(nextEvent.seq))
    ? Math.trunc(Number(nextEvent.seq))
    : fallbackSeq;
  nextEvent.player = normalizeChargePlayerKey(nextEvent.player);
  nextEvent.before = normalizeChargeValue(nextEvent.before);
  nextEvent.after = normalizeChargeValue(nextEvent.after);
  nextEvent.delta = Number.isFinite(Number(nextEvent.delta))
    ? normalizeChargeValue(nextEvent.delta)
    : (nextEvent.after - nextEvent.before);
  const popupKind = String(nextEvent.popupKind || '').trim().toLowerCase();
  const sourceType = (typeof nextEvent.sourceType === 'string') ? nextEvent.sourceType.trim() : '';
  if (popupKind === 'board') {
    const anchorRow = Number(nextEvent.anchorRow);
    const anchorCol = Number(nextEvent.anchorCol);
    if (Number.isFinite(anchorRow) && Number.isFinite(anchorCol)) {
      nextEvent.popupKind = 'board';
      nextEvent.anchorRow = Math.trunc(anchorRow);
      nextEvent.anchorCol = Math.trunc(anchorCol);
      if (sourceType) nextEvent.sourceType = sourceType;
      else delete nextEvent.sourceType;
    } else {
      delete nextEvent.popupKind;
      delete nextEvent.anchorRow;
      delete nextEvent.anchorCol;
      delete nextEvent.sourceType;
    }
  } else {
    delete nextEvent.popupKind;
    delete nextEvent.anchorRow;
    delete nextEvent.anchorCol;
    delete nextEvent.sourceType;
  }
  return nextEvent;
}

function normalizeChargeDeltaEventList(events: any[]): any[] {
  if (!Array.isArray(events)) return [];
  const normalizedEvents: any[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const normalizedEvent = normalizeChargeDeltaEvent(events[index], index + 1);
    if (normalizedEvent) normalizedEvents.push(normalizedEvent);
  }
  return normalizedEvents;
}

function normalizeChargeDataForSnapshot(cardState: any): any {
  if (!cardState || typeof cardState !== 'object') return cardState;
  cardState.charge = normalizeChargeState(cardState.charge);
  cardState.chargeDeltaEvents = normalizeChargeDeltaEventList(cardState.chargeDeltaEvents);
  return cardState;
}

function buildMissingChargeDeltaEvents(previousCardState: any, nextCardState: any, options?: any): any[] {
  const opts = (options && typeof options === 'object') ? options : {};
  if (opts.force === true) return [];
  if (!nextCardState || typeof nextCardState !== 'object') return [];
  if (Array.isArray(nextCardState.chargeDeltaEvents) && nextCardState.chargeDeltaEvents.length > 0) return [];

  const previousCharge = (previousCardState && previousCardState.charge && typeof previousCardState.charge === 'object')
    ? previousCardState.charge
    : null;
  const nextCharge = (nextCardState.charge && typeof nextCardState.charge === 'object')
    ? nextCardState.charge
    : null;
  if (!previousCharge || !nextCharge) return [];

  const events: any[] = [];
  let seq = 1;
  const playerKeys = ['black', 'white'];
  for (let index = 0; index < playerKeys.length; index += 1) {
    const playerKey = playerKeys[index];
    const before = normalizeChargeValue(previousCharge[playerKey]);
    const after = normalizeChargeValue(nextCharge[playerKey]);
    const delta = after - before;
    if (delta === 0) continue;
    events.push({
      seq,
      player: playerKey,
      before,
      after,
      delta,
      reason: 'network_snapshot_charge_sync'
    });
    seq += 1;
  }
  return events;
}

function sanitizeIncomingSnapshot(snapshot: any, options?: any): any {
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, reason: 'invalid_snapshot' };
  }
  if (!snapshot.gameState || typeof snapshot.gameState !== 'object') {
    return { ok: false, reason: 'invalid_game_state' };
  }
  if (!snapshot.cardState || typeof snapshot.cardState !== 'object') {
    return { ok: false, reason: 'invalid_card_state' };
  }

  const nextSnapshot = cloneData(snapshot, options && options.cloneData);
  const gameState = nextSnapshot.gameState;
  const cardState = nextSnapshot.cardState;
  const liveQueueCount = Array.isArray(cardState.presentationEvents) ? cardState.presentationEvents.length : 0;
  const persistentQueueCount = Array.isArray(cardState._presentationEventsPersist) ? cardState._presentationEventsPersist.length : 0;
  const hadCurrentActionMeta = Object.prototype.hasOwnProperty.call(cardState, '_currentActionMeta');
  const hadResultShown = Object.prototype.hasOwnProperty.call(gameState, '__resultShown');

  cardState.presentationEvents = [];
  cardState._presentationEventsPersist = [];
  delete cardState._currentActionMeta;
  delete gameState.__resultShown;
  normalizeChargeDataForSnapshot(cardState);

  return {
    ok: true,
    snapshot: nextSnapshot,
    transientStateStripped: (liveQueueCount > 0 || persistentQueueCount > 0 || hadCurrentActionMeta || hadResultShown)
      ? {
        liveQueueCount,
        persistentQueueCount,
        hadCurrentActionMeta,
        hadResultShown
      }
      : null
  };
}

const SnapshotCanonical = {
  normalizeSeatKey,
  getSnapshotMeta,
  getSnapshotVersion,
  inspectAuthoritativeSnapshot,
  normalizeChargeDeltaEvent,
  normalizeChargeDeltaEventList,
  normalizeChargeDataForSnapshot,
  buildMissingChargeDeltaEvents,
  sanitizeIncomingSnapshot
};

export = SnapshotCanonical;
