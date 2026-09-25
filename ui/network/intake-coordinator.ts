import type { NetworkSnapshotEnvelope } from './intake-envelope';

const FrameContract = require('../../shared/network-presentation-frame');

export interface NetworkIntakeApplyMeta {
  source: string;
  roomId: string | null;
  operationId: string | null;
  stateVersion: number | null;
  visualSeq: number | null;
  force: boolean;
  skipResultOverlay: boolean;
  trackedPublish?: unknown;
  applyOptions?: Record<string, unknown>;
  playbackEvents?: unknown[];
  presentationFrames?: unknown[];
}

export interface NetworkIntakeBoardRefreshMeta extends NetworkIntakeApplyMeta {
  reason: string;
}

export interface NetworkIntakeCoordinatorConfig {
  getRoomId?: () => string | null;
  getAppliedStateVersion?: () => number | null;
  getPlaybackActive?: () => boolean | null;
  getVisualCursor?: () => { visualSeq?: number | null; visualVersion?: number | null } | null;
  applyCanonicalSnapshot?: (snapshot: unknown, meta: NetworkIntakeApplyMeta) => boolean;
  enqueuePresentationFrames?: (frames: unknown[], meta: NetworkIntakeApplyMeta) => number;
  recoverPresentationContinuity?: (
    envelope: NetworkSnapshotEnvelope,
    meta: NetworkIntakeApplyMeta & { reason: string }
  ) => boolean;
  requestBoardRefresh?: (meta: NetworkIntakeBoardRefreshMeta) => boolean;
  recordTrace?: (type: string, details: Record<string, unknown>) => void;
}

export interface NetworkIntakeSubmitResult {
  appliedSnapshot: boolean;
  enqueuedFrameCount: number;
  requestedBoardRefresh: boolean;
  duplicateOperation: boolean;
  skippedReason: string | null;
  recoveredVisualContinuity?: boolean;
}

function toIntegerOrNull(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function operationVersionKey(envelope: NetworkSnapshotEnvelope): string | null {
  if (!envelope.operationId || envelope.stateVersion === null) return null;
  return `${envelope.operationId}:${envelope.stateVersion}`;
}

function frameVisualSeq(frame: unknown): number | null {
  const record = frame && typeof frame === 'object' ? frame as any : null;
  return toIntegerOrNull(record && record.visualSeq);
}

function lastPresentationVisualSeq(frames: unknown[]): number | null {
  let lastVisualSeq: number | null = null;
  for (const frame of frames) {
    const visualSeq = frameVisualSeq(frame);
    if (visualSeq === null || visualSeq <= 0) continue;
    lastVisualSeq = lastVisualSeq === null ? visualSeq : Math.max(lastVisualSeq, visualSeq);
  }
  return lastVisualSeq;
}

function createApplyMeta(envelope: NetworkSnapshotEnvelope): NetworkIntakeApplyMeta {
  return {
    source: envelope.source,
    roomId: envelope.roomId,
    operationId: envelope.operationId,
    stateVersion: envelope.stateVersion,
    visualSeq: envelope.visualSeq,
    force: envelope.force === true,
    skipResultOverlay: envelope.skipResultOverlay === true,
    trackedPublish: envelope.trackedPublish,
    applyOptions: envelope.applyOptions,
    playbackEvents: envelope.playbackEvents,
    presentationFrames: envelope.presentationFrames
  };
}

export function buildNetworkIntakeApplyOptions(meta: NetworkIntakeApplyMeta | null | undefined): Record<string, unknown> {
  const sourceMeta = meta && typeof meta === 'object' ? meta : null;
  const applyOptions = {
    ...((sourceMeta && sourceMeta.applyOptions && typeof sourceMeta.applyOptions === 'object') ? sourceMeta.applyOptions : {})
  };
  applyOptions.force = sourceMeta ? sourceMeta.force === true : false;
  applyOptions.skipResultOverlay = sourceMeta ? sourceMeta.skipResultOverlay === true : false;
  const frames = sourceMeta && Array.isArray(sourceMeta.presentationFrames) ? sourceMeta.presentationFrames : [];
  delete applyOptions.presentationFrames;
  if (frames.length > 0) {
    applyOptions.presentationFrameSource = sourceMeta && sourceMeta.source ? String(sourceMeta.source) : 'network_intake';
    const resultVisualSeq = lastPresentationVisualSeq(frames);
    if (resultVisualSeq !== null) {
      applyOptions.deferResultUntilVisualSeq = resultVisualSeq;
    }
    // Ordered frames own the board: the committed frame of each frame and the settle-time board
    // sync render the new state. The synchronous board render that GAME_STATE_CHANGED would
    // trigger on an idle client only rebuilds the pre-move visual snapshot (an equivalent frame
    // the controller discards), so the snapshot refresh tells the UI to leave the board to
    // presentation. Status / card UI refreshes are unaffected.
    applyOptions.boardRenderOwnedByPresentation = true;
  } else {
    delete applyOptions.deferResultUntilVisualSeq;
    delete applyOptions.boardRenderOwnedByPresentation;
  }
  applyOptions.networkRoomId = sourceMeta && sourceMeta.roomId ? String(sourceMeta.roomId) : null;
  applyOptions.networkOperationId = sourceMeta && sourceMeta.operationId ? String(sourceMeta.operationId) : null;
  // Canonical server intake never dispatches playback directly. Ordered
  // presentation is owned exclusively by NetworkPresentationTimeline.
  applyOptions.playbackEvents = [];
  applyOptions.shadowPlaybackEvents = [];
  delete applyOptions.shadowPlaybackSource;
  applyOptions.networkCanonicalIntake = true;
  // Canonical intake owns board delivery after snapshot application: either
  // ordered presentation frames drive the timeline, or requestBoardRefresh
  // issues the single no-playback sync below. Snapshot refreshUi must not
  // create a parallel board writer request for the same accepted envelope.
  applyOptions.skipBoardUpdate = true;
  applyOptions.source = sourceMeta && sourceMeta.source ? String(sourceMeta.source) : 'network_intake';
  return applyOptions;
}

function readPlaybackActive(config: NetworkIntakeCoordinatorConfig): boolean | null {
  if (typeof config.getPlaybackActive !== 'function') return null;
  try {
    const value = config.getPlaybackActive();
    return typeof value === 'boolean' ? value : null;
  } catch (e) {
    return null;
  }
}

function getTraceBoardWriter(enqueuedFrameCount: number, requestedBoardRefresh: boolean): string {
  if (enqueuedFrameCount > 0) return 'network_timeline';
  if (requestedBoardRefresh) return 'render_scheduler';
  return 'none';
}

function getTraceDecision(result: NetworkIntakeSubmitResult): string {
  if (result.recoveredVisualContinuity) return 'visual_rebased';
  if (result.requestedBoardRefresh) return 'refresh_requested';
  if (result.appliedSnapshot || result.enqueuedFrameCount > 0) return 'accepted';
  if (result.duplicateOperation) return 'deduped';
  if (result.skippedReason === 'stale_state_version') return 'stale';
  if (result.skippedReason === 'room_mismatch') return 'stale_session';
  if (result.skippedReason === 'apply_rejected') return 'rejected';
  return 'deferred';
}

export function createNetworkIntakeCoordinator(config?: NetworkIntakeCoordinatorConfig): any {
  const cfg = config && typeof config === 'object' ? config : {};
  const seenByVisualSeq = new Set<number>();
  const seenByOperationAndVersion = new Set<string>();

  function trace(type: string, details: Record<string, unknown>): void {
    if (typeof cfg.recordTrace !== 'function') return;
    try {
      cfg.recordTrace(type, details);
    } catch (e) {
      // Trace must not affect authoritative intake.
    }
  }

  function shouldApplySnapshot(envelope: NetworkSnapshotEnvelope, key: string | null): { ok: boolean; reason: string | null } {
    if (!envelope.snapshot) return { ok: false, reason: 'no_snapshot' };
    const currentRoomId = typeof cfg.getRoomId === 'function'
      ? String(cfg.getRoomId() || '').trim().toUpperCase()
      : '';
    const envelopeRoomId = String(envelope.roomId || '').trim().toUpperCase();
    if (currentRoomId && envelopeRoomId && currentRoomId !== envelopeRoomId) {
      return { ok: false, reason: 'room_mismatch' };
    }
    if (key && seenByOperationAndVersion.has(key)) return { ok: false, reason: 'duplicate_operation_state' };
    const appliedVersion = typeof cfg.getAppliedStateVersion === 'function'
      ? toIntegerOrNull(cfg.getAppliedStateVersion())
      : null;
    if (
      envelope.force !== true
      && appliedVersion !== null
      && envelope.stateVersion !== null
      && envelope.stateVersion <= appliedVersion
    ) {
      return { ok: false, reason: 'stale_state_version' };
    }
    return { ok: true, reason: null };
  }

  function readSnapshotVersion(snapshot: unknown): number | null {
    const record = snapshot && typeof snapshot === 'object' ? snapshot as any : null;
    return toIntegerOrNull(record && record._meta && record._meta.version)
      ?? toIntegerOrNull(record && record.stateVersion);
  }

  function normalizeUnseenFrames(envelope: NetworkSnapshotEnvelope): {
    frames: unknown[];
    invalidReason: string | null;
  } {
    if (!Array.isArray(envelope.presentationFrames) || envelope.presentationFrames.length <= 0) {
      return { frames: [], invalidReason: null };
    }
    const unseenFrames: unknown[] = [];
    for (const frame of envelope.presentationFrames) {
      let normalized: any = null;
      try {
        normalized = FrameContract.normalizePresentationFrame(frame);
      } catch (error: any) {
        return {
          frames: [],
          invalidReason: error && error.message ? String(error.message) : 'presentation_frame_invalid'
        };
      }
      if (!normalized.snapshotAfter || typeof normalized.snapshotAfter !== 'object') {
        return { frames: [], invalidReason: 'presentation_frame_snapshot_required' };
      }
      if (
        readSnapshotVersion(normalized.snapshotAfter) !== normalized.stateVersionTo
      ) {
        return { frames: [], invalidReason: 'presentation_frame_snapshot_version_mismatch' };
      }
      const envelopeRoomId = String(envelope.roomId || '').trim().toUpperCase();
      const frameRoomId = String(normalized.roomId || '').trim().toUpperCase();
      if (envelopeRoomId && frameRoomId && envelopeRoomId !== frameRoomId) {
        return { frames: [], invalidReason: 'presentation_frame_room_mismatch' };
      }
      const visualSeq = frameVisualSeq(normalized);
      if (visualSeq !== null && seenByVisualSeq.has(visualSeq)) continue;
      unseenFrames.push(normalized);
    }
    return { frames: unseenFrames, invalidReason: null };
  }

  function enqueueFrames(
    envelope: NetworkSnapshotEnvelope,
    meta: NetworkIntakeApplyMeta
  ): { accepted: number; invalidReason: string | null; partial: boolean } {
    const normalized = normalizeUnseenFrames(envelope);
    if (normalized.invalidReason) {
      return { accepted: 0, invalidReason: normalized.invalidReason, partial: false };
    }
    const unseenFrames = normalized.frames;
    if (unseenFrames.length <= 0) {
      return { accepted: 0, invalidReason: null, partial: false };
    }
    const accepted = typeof cfg.enqueuePresentationFrames === 'function'
      ? toIntegerOrNull(cfg.enqueuePresentationFrames(unseenFrames, meta)) ?? 0
      : unseenFrames.length;
    const partial = accepted !== unseenFrames.length;
    if (accepted > 0 && !partial) {
      for (const frame of unseenFrames) {
        const visualSeq = frameVisualSeq(frame);
        if (visualSeq !== null) seenByVisualSeq.add(visualSeq);
      }
    }
    return { accepted, invalidReason: null, partial };
  }

  function readVisualCursor(): { visualSeq: number | null; visualVersion: number | null } {
    if (typeof cfg.getVisualCursor !== 'function') {
      return { visualSeq: null, visualVersion: null };
    }
    try {
      const cursor = cfg.getVisualCursor() || {};
      return {
        visualSeq: toIntegerOrNull(cursor.visualSeq),
        visualVersion: toIntegerOrNull(cursor.visualVersion)
      };
    } catch (e) {
      return { visualSeq: null, visualVersion: null };
    }
  }

  function submit(envelope: NetworkSnapshotEnvelope): NetworkIntakeSubmitResult {
    const key = operationVersionKey(envelope);
    const meta = createApplyMeta(envelope);
    if (envelope.intakeError) {
      let recoveredVisualContinuity = false;
      if (typeof cfg.recoverPresentationContinuity === 'function') {
        recoveredVisualContinuity = cfg.recoverPresentationContinuity(envelope, {
          ...meta,
          reason: envelope.intakeError
        }) === true;
      }
      const result: NetworkIntakeSubmitResult = {
        appliedSnapshot: false,
        enqueuedFrameCount: 0,
        requestedBoardRefresh: false,
        duplicateOperation: false,
        skippedReason: envelope.intakeError,
        recoveredVisualContinuity
      };
      trace('network_intake_submit', {
        source: envelope.source,
        roomId: envelope.roomId,
        operationId: envelope.operationId,
        stateVersion: envelope.stateVersion,
        visualSeq: envelope.visualSeq,
        boardWriter: 'none',
        playbackActive: readPlaybackActive(cfg),
        decision: 'rejected',
        accepted: false,
        appliedSnapshot: false,
        enqueuedFrameCount: 0,
        requestedBoardRefresh: false,
        recoveredVisualContinuity,
        continuityGap: false,
        invalidFrameReason: envelope.intakeError,
        partialFrameEnqueue: false,
        reason: envelope.intakeError,
        skippedReason: envelope.intakeError
      });
      return result;
    }
    const visualCursorBefore = readVisualCursor();
    const applyDecision = shouldApplySnapshot(envelope, key);
    let appliedSnapshot = false;
    let skippedReason = applyDecision.reason;

    if (applyDecision.ok) {
      appliedSnapshot = typeof cfg.applyCanonicalSnapshot === 'function'
        ? cfg.applyCanonicalSnapshot(envelope.snapshot, meta) === true
        : true;
      skippedReason = appliedSnapshot ? null : 'apply_rejected';
      if (appliedSnapshot && key) {
        seenByOperationAndVersion.add(key);
      }
    }

    const frameResult = enqueueFrames(envelope, meta);
    const enqueuedFrameCount = frameResult.accepted;
    const cursorAdvances = (
      envelope.visualSeq !== null
      && (visualCursorBefore.visualSeq === null || envelope.visualSeq > visualCursorBefore.visualSeq)
    );
    const versionAdvances = (
      envelope.stateVersion !== null
      && (visualCursorBefore.visualVersion === null || envelope.stateVersion > visualCursorBefore.visualVersion)
    );
    const continuityGap = appliedSnapshot
      && enqueuedFrameCount <= 0
      && (cursorAdvances || versionAdvances || !!frameResult.invalidReason || frameResult.partial);
    let recoveredVisualContinuity = false;
    if (
      continuityGap
      && !(meta.applyOptions && meta.applyOptions.suppressContinuityRecovery === true)
      && typeof cfg.recoverPresentationContinuity === 'function'
    ) {
      recoveredVisualContinuity = cfg.recoverPresentationContinuity(envelope, {
        ...meta,
        reason: frameResult.invalidReason
          || (frameResult.partial ? 'presentation_frame_enqueue_partial' : 'presentation_cursor_advanced_without_frame')
      }) === true;
    }
    let requestedBoardRefresh = false;
    if (
      appliedSnapshot
      && enqueuedFrameCount <= 0
      && (!continuityGap || recoveredVisualContinuity)
    ) {
      requestedBoardRefresh = typeof cfg.requestBoardRefresh === 'function'
        ? cfg.requestBoardRefresh({
          ...meta,
          reason: 'snapshot_no_playback_visual_sync'
        }) === true
        : false;
    }

    const result: NetworkIntakeSubmitResult = {
      appliedSnapshot,
      enqueuedFrameCount,
      requestedBoardRefresh,
      duplicateOperation: key !== null && seenByOperationAndVersion.has(key) && !appliedSnapshot,
      skippedReason,
      recoveredVisualContinuity
    };
    const decision = getTraceDecision(result);
    trace('network_intake_submit', {
      source: envelope.source,
      roomId: envelope.roomId,
      operationId: envelope.operationId,
      stateVersion: envelope.stateVersion,
      visualSeq: envelope.visualSeq,
      boardWriter: getTraceBoardWriter(enqueuedFrameCount, requestedBoardRefresh),
      playbackActive: readPlaybackActive(cfg),
      decision,
      accepted: decision === 'accepted' || decision === 'refresh_requested' || decision === 'visual_rebased',
      appliedSnapshot,
      enqueuedFrameCount,
      requestedBoardRefresh,
      recoveredVisualContinuity,
      continuityGap,
      invalidFrameReason: frameResult.invalidReason,
      partialFrameEnqueue: frameResult.partial,
      reason: skippedReason,
      skippedReason
    });
    return result;
  }

  function reset(): void {
    seenByVisualSeq.clear();
    seenByOperationAndVersion.clear();
  }

  return {
    submit,
    reset
  };
}
