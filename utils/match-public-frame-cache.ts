import { freezeOwnedData } from '../shared/immutable-data';

// One accepted operation owns this cache. No cross-room or cross-viewer reuse.
export function getPublishPresentationFrames(options: Record<string, unknown>, viewerKey: string, build: () => unknown[]): unknown[] {
  const artifacts = options.__publishViewerArtifacts;
  if (!artifacts || typeof artifacts !== 'object') return build();
  const record = artifacts as Record<string, unknown>;
  if (!(record.presentationFramesByViewer instanceof Map)) record.presentationFramesByViewer = new Map<string, unknown[]>();
  const cache = record.presentationFramesByViewer as Map<string, unknown[]>;
  const existing = cache.get(viewerKey);
  if (existing) return existing;
  const frames = freezeOwnedData(build());
  cache.set(viewerKey, frames);
  return frames;
}
