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
  let placementHand: any = null;

  function cancelPlacementHand(): void {
    if (!placementHand) return;
    const hand = placementHand;
    placementHand = null;
    hand.approve(false);
    hand.abort.abort();
  }

  function setPreviewHints(previewHints: any[], options?: any): boolean {
    if (typeof cfg.setPreviewHints !== 'function') return false;
    cfg.setPreviewHints(previewHints, options);
    return true;
  }

  function clear(options?: any): boolean {
    const hadHand = !!placementHand;
    cancelPlacementHand();
    if (!activeFeedback) return hadHand;
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
    cancelPlacementHand();
    activeFeedback = {
      token,
      cellKey: `${row},${col}`,
      roomId: session.roomId,
      sessionEpoch: session.sessionEpoch,
      operationId: null,
      owner
    };
    if (owner && typeof cfg.playPlacementHand === 'function') {
      let approve: (accepted: boolean) => void = () => {};
      const accepted = new Promise<boolean>((resolve) => { approve = resolve; });
      const abort = new AbortController();
      const hand = { ...activeFeedback, approve, abort, contact: null as any };
      placementHand = hand;
      try {
        hand.contact = Promise.resolve(cfg.playPlacementHand(owner, row, col, {
          waitForPlacement: accepted,
          signal: abort.signal,
          preserveInputLock: true
        })).catch(() => { if (placementHand === hand) cancelPlacementHand(); });
      } catch (_error) {
        cancelPlacementHand();
      }
    }
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
    if (placementHand?.token === activeFeedback.token) placementHand.operationId = operationId;
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
    // Intake can precede playback. Keep the approaching hand until its exact
    // authoritative frame is dispatched; only the waiting cell hint ends here.
    activeFeedback = null;
    setPreviewHints([], { deferRender: true });
    return true;
  }

  async function preparePlayback(frame: any): Promise<any[]> {
    const events = Array.isArray(frame?.playbackEvents) ? frame.playbackEvents : [];
    const hand = placementHand;
    if (!hand || !hand.operationId || String(frame?.operationId || '') !== hand.operationId
      || !isSameSession(hand, readSessionIdentity(cfg))) return events;
    const index = events.findIndex((event: any) => {
      if (event?.type !== 'place_hand_animation') return false;
      const target = event.targets?.[0];
      return target && `${Number(target.r ?? target.row)},${Number(target.col)}` === hand.cellKey
        && normalizeOwner(target.player ?? target.owner) === hand.owner;
    });
    if (index < 0) {
      cancelPlacementHand();
      return events;
    }
    hand.approve(true);
    await hand.contact;
    if (placementHand !== hand || !isSameSession(hand, readSessionIdentity(cfg))) return events;
    // Retain event order and DTOs in the canonical journal. This local copy
    // records that exactly this hand approach has already reached contact.
    // Keep the completed record until the next placement/session boundary so a
    // safe dispatcher retry cannot play the same approach and sound twice.
    return events.map((event: any, eventIndex: number) => eventIndex === index
      ? { ...event, meta: { ...event.meta, localPlacementHandComplete: true } }
      : event);
  }

  function settlePlacement(token: any, result?: any): boolean {
    if (placementHand?.token === String(token || '') && result?.ok !== true) cancelPlacementHand();
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
    preparePlayback,
    clear,
    getActiveFeedback
  };
}

const NetworkPlacementFeedbackModule = {
  createNetworkPlacementFeedbackController
};

export = NetworkPlacementFeedbackModule;
