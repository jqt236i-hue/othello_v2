'use strict';

function normalizeRoomId(value: any): string {
  return String(value || '').trim().toUpperCase();
}

function normalizeOperationId(value: any): string {
  return String(value || '').trim();
}

function normalizeOwner(value: any): 'black' | 'white' | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'black' || normalized === '1') return 'black';
  if (normalized === 'white' || normalized === '-1') return 'white';
  return null;
}

function readSessionIdentity(config: any): any {
  if (!config || typeof config.getSessionIdentity !== 'function') return null;
  const raw = config.getSessionIdentity();
  if (!raw || raw.active !== true) return null;
  const roomId = normalizeRoomId(raw.roomId);
  if (!roomId) return null;
  return Object.freeze({
    roomId,
    sessionEpoch: Object.prototype.hasOwnProperty.call(raw, 'sessionEpoch')
      ? raw.sessionEpoch
      : null
  });
}

function isSameSession(left: any, right: any): boolean {
  return !!left
    && !!right
    && left.roomId === right.roomId
    && left.sessionEpoch === right.sessionEpoch;
}

function createNetworkPlacementFeedbackController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  let nextToken = 0;
  let activeFeedback: any = null;

  function setPreviewHints(previewHints: any[], options?: any): boolean {
    if (typeof cfg.setPreviewHints !== 'function') return false;
    cfg.setPreviewHints(previewHints, options);
    return true;
  }

  function clear(options?: any): boolean {
    if (!activeFeedback) return false;
    activeFeedback = null;
    setPreviewHints([], options);
    return true;
  }

  function beginPlacement(action: any, playerKey?: any): string | null {
    const row = Number(action && action.row);
    const col = Number(action && action.col);
    const owner = normalizeOwner(playerKey);
    const session = readSessionIdentity(cfg);
    if (!session || !Number.isInteger(row) || !Number.isInteger(col)) return null;
    if (typeof cfg.setPreviewHints !== 'function') return null;

    const token = `network-placement:${++nextToken}`;
    activeFeedback = {
      token,
      cellKey: `${row},${col}`,
      roomId: session.roomId,
      sessionEpoch: session.sessionEpoch,
      operationId: null,
      owner
    };
    setPreviewHints([{
      cellKey: activeFeedback.cellKey,
      kind: 'network-pending-placement',
      ...(owner ? { owner } : {})
    }]);
    return token;
  }

  function bindOperation(token: any, metadata?: any): boolean {
    if (!activeFeedback || String(token || '') !== activeFeedback.token) return false;
    const session = readSessionIdentity(cfg);
    if (!isSameSession(activeFeedback, session)) {
      clear();
      return false;
    }
    const operationId = normalizeOperationId(metadata && metadata.operationId);
    if (!operationId) return false;
    const roomId = normalizeRoomId(metadata && metadata.roomId);
    if (roomId && roomId !== activeFeedback.roomId) return false;
    if (
      metadata
      && Object.prototype.hasOwnProperty.call(metadata, 'sessionEpoch')
      && metadata.sessionEpoch !== activeFeedback.sessionEpoch
    ) {
      return false;
    }
    activeFeedback = { ...activeFeedback, operationId };
    return true;
  }

  function acceptForIntake(envelope?: any, intakeResult?: any): boolean {
    if (!activeFeedback || !activeFeedback.operationId) return false;
    const session = readSessionIdentity(cfg);
    if (!isSameSession(activeFeedback, session)) return clear({ deferRender: true });
    if (!envelope || envelope.intakeError) return false;
    const operationId = normalizeOperationId(envelope && envelope.operationId);
    if (!operationId || operationId !== activeFeedback.operationId) return false;
    const roomId = normalizeRoomId(envelope && envelope.roomId);
    if (!roomId || roomId !== activeFeedback.roomId) return false;
    const accepted = !!intakeResult && (
      intakeResult.appliedSnapshot === true
      || Number(intakeResult.enqueuedFrameCount) > 0
      || intakeResult.requestedBoardRefresh === true
      || intakeResult.duplicateOperation === true
    );
    if (!accepted || intakeResult.skippedReason === 'room_mismatch') return false;
    return clear({ deferRender: true });
  }

  function settlePlacement(token: any, result?: any): boolean {
    if (!activeFeedback || String(token || '') !== activeFeedback.token) return false;
    // Accepted publish responses have already passed submitNetworkSnapshotEnvelope.
    // The verified intake callback owns the visual handoff; a raw success result
    // must never settle presentation feedback by itself.
    if (result && result.ok === true) return false;
    return clear();
  }

  function getActiveFeedback(): any {
    return activeFeedback ? Object.freeze({ ...activeFeedback }) : null;
  }

  return {
    beginPlacement,
    bindOperation,
    acceptForIntake,
    settlePlacement,
    clear,
    getActiveFeedback
  };
}

const NetworkPlacementFeedbackModule = {
  createNetworkPlacementFeedbackController
};

export = NetworkPlacementFeedbackModule;
