import type { NetworkSnapshotEnvelope } from './intake-envelope';

export interface NetworkIntakeApplyMeta {
  source: string;
  operationId: string | null;
  stateVersion: number | null;
  visualSeq: number | null;
  force: boolean;
  skipResultOverlay: boolean;
}

export interface NetworkIntakeBoardRefreshMeta extends NetworkIntakeApplyMeta {
  reason: string;
}

export interface NetworkIntakeCoordinatorConfig {
  getAppliedStateVersion?: () => number | null;
  applyCanonicalSnapshot?: (snapshot: unknown, meta: NetworkIntakeApplyMeta) => boolean;
  enqueuePresentationFrames?: (frames: unknown[], meta: NetworkIntakeApplyMeta) => number;
  requestBoardRefresh?: (meta: NetworkIntakeBoardRefreshMeta) => boolean;
  recordTrace?: (type: string, details: Record<string, unknown>) => void;
}

export interface NetworkIntakeSubmitResult {
  appliedSnapshot: boolean;
  enqueuedFrameCount: number;
  requestedBoardRefresh: boolean;
  duplicateOperation: boolean;
  skippedReason: string | null;
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

function createApplyMeta(envelope: NetworkSnapshotEnvelope): NetworkIntakeApplyMeta {
  return {
    source: envelope.source,
    operationId: envelope.operationId,
    stateVersion: envelope.stateVersion,
    visualSeq: envelope.visualSeq,
    force: envelope.force === true,
    skipResultOverlay: envelope.skipResultOverlay === true
  };
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

  function enqueueFrames(envelope: NetworkSnapshotEnvelope, meta: NetworkIntakeApplyMeta): number {
    if (!Array.isArray(envelope.presentationFrames) || envelope.presentationFrames.length <= 0) return 0;
    const unseenFrames: unknown[] = [];
    for (const frame of envelope.presentationFrames) {
      const visualSeq = frameVisualSeq(frame);
      if (visualSeq !== null && seenByVisualSeq.has(visualSeq)) continue;
      unseenFrames.push(frame);
    }
    if (unseenFrames.length <= 0) return 0;
    const accepted = typeof cfg.enqueuePresentationFrames === 'function'
      ? toIntegerOrNull(cfg.enqueuePresentationFrames(unseenFrames, meta)) ?? 0
      : unseenFrames.length;
    if (accepted > 0) {
      for (const frame of unseenFrames) {
        const visualSeq = frameVisualSeq(frame);
        if (visualSeq !== null) seenByVisualSeq.add(visualSeq);
      }
    }
    return accepted;
  }

  function submit(envelope: NetworkSnapshotEnvelope): NetworkIntakeSubmitResult {
    const key = operationVersionKey(envelope);
    const meta = createApplyMeta(envelope);
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

    const enqueuedFrameCount = enqueueFrames(envelope, meta);
    let requestedBoardRefresh = false;
    if (
      appliedSnapshot
      && enqueuedFrameCount <= 0
      && (!Array.isArray(envelope.playbackEvents) || envelope.playbackEvents.length <= 0)
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
      skippedReason
    };
    trace('network_intake_submit', {
      source: envelope.source,
      operationId: envelope.operationId,
      stateVersion: envelope.stateVersion,
      visualSeq: envelope.visualSeq,
      appliedSnapshot,
      enqueuedFrameCount,
      requestedBoardRefresh,
      skippedReason
    });
    return result;
  }

  return {
    submit
  };
}
