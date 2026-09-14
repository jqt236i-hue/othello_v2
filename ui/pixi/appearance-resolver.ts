import type { BoardAppearanceDescriptor } from '../board-visual/types';
import BoardSkinRuntime = require('../board-skin/runtime');
import StoneSkinRuntime = require('../stone-skin/runtime');
import CustomSkinStorage = require('../custom-skin/storage');
import GameVisualEffectsMap = require('../../game/visual-effects-map');

export type BoardAppearanceResourceRole = 'board' | 'black-stone' | 'white-stone' | 'special-stone';

export interface BoardAppearanceResourceDescriptor {
  readonly role: BoardAppearanceResourceRole;
  readonly url: string;
  readonly customSkinId: string | null;
  readonly sourceBlob: Blob | null;
  readonly contentFingerprint: string;
}
export interface BoardAppearanceSelection {
  readonly boardSkinId?: string | null;
  readonly boardFrameSkinId?: string | null;
  readonly stoneSkinId?: string | null;
  readonly baseUri?: string | null;
}

export interface ResolvedBoardAppearance {
  readonly descriptor: BoardAppearanceDescriptor;
  readonly resources: readonly BoardAppearanceResourceDescriptor[];
  readonly contentFingerprint: string;
}

export interface BoardAppearanceObjectUrlLease {
  readonly urls: readonly string[];
  release(): boolean;
}

interface BoardSkinResourceLike {
  skinId: string;
  imagePath: string;
  sourceBlob: Blob | null;
  contentFingerprint: string;
}

interface BoardFrameSkinResourceLike {
  skinId: string;
  imagePath: string;
  layout: Readonly<Record<string, number>>;
  sourceBlob: Blob | null;
  contentFingerprint: string;
}

interface StoneSkinResourceLike {
  skinId: string;
  blackImagePath: string;
  whiteImagePath: string;
  blackSourceBlob: Blob | null;
  whiteSourceBlob: Blob | null;
  contentFingerprint: string;
}

function createAppearanceError(message: string, code: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

function resolveRootRef(rootRef: Window | Record<string, any> | null | undefined): Record<string, any> | null {
  if (rootRef && typeof rootRef === 'object') return rootRef as Record<string, any>;
  try {
    if (typeof window !== 'undefined' && window) return window as unknown as Record<string, any>;
  } catch (e) { /* explicit root is preferred */ }
  return null;
}

function resolveBaseUri(rootRef: Record<string, any> | null, explicitBaseUri?: string | null): string {
  const explicit = String(explicitBaseUri || '').trim();
  if (explicit) return explicit;
  const documentBaseUri = String(rootRef && rootRef.document && rootRef.document.baseURI || '').trim();
  if (documentBaseUri) return documentBaseUri;
  try {
    if (typeof document !== 'undefined' && document && document.baseURI) return String(document.baseURI);
  } catch (e) { /* handled below */ }
  throw createAppearanceError('appearance asset base URI is unavailable', 'appearance-base-uri-unavailable');
}

/** Catalogs provide raw paths. CSS url(...) text is intentionally not accepted here. */
export function resolveAppearanceAssetUrl(path: unknown, baseUri: string): string {
  const source = String(path || '').trim();
  if (!source) throw createAppearanceError('appearance asset URL is empty', 'appearance-asset-url-empty');
  if (/^url\s*\(/i.test(source)) {
    throw createAppearanceError('CSS url() values are not appearance asset descriptors', 'appearance-css-url-unsupported');
  }
  try {
    return new URL(source, baseUri).href;
  } catch (error) {
    throw createAppearanceError('appearance asset URL is invalid', 'appearance-asset-url-invalid');
  }
}

function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(source[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function fingerprint(value: unknown): string {
  return `fnv1a32:${fnv1a32(stableSerialize(value)).toString(16).padStart(8, '0')}`;
}

function isCustomSkinId(value: string): boolean {
  if (typeof CustomSkinStorage.isCustomSkin === 'function') {
    return CustomSkinStorage.isCustomSkin(value);
  }
  return value.startsWith('custom:');
}

function makeResource(
  role: BoardAppearanceResourceRole,
  url: string,
  skinId: string,
  sourceBlob: Blob | null,
  contentFingerprint: string
): BoardAppearanceResourceDescriptor {
  return Object.freeze({
    role,
    url,
    customSkinId: isCustomSkinId(skinId) ? skinId : null,
    sourceBlob,
    contentFingerprint
  });
}

export function resolveBoardAppearanceResources(
  rootRef: Window | Record<string, any> | null | undefined,
  selection: BoardAppearanceSelection = {}
): ResolvedBoardAppearance {
  const root = resolveRootRef(rootRef);
  const baseUri = resolveBaseUri(root, selection.baseUri);
  const board = BoardSkinRuntime.resolveBoardSkinResourceDescriptor(
    root as unknown as Window,
    selection.boardSkinId
  ) as BoardSkinResourceLike | null;
  const frame = BoardSkinRuntime.resolveBoardFrameSkinResourceDescriptor(
    root as unknown as Window,
    selection.boardFrameSkinId
  ) as BoardFrameSkinResourceLike | null;
  const stone = StoneSkinRuntime.resolveStoneSkinResourceDescriptor(
    root as unknown as Window,
    selection.stoneSkinId
  ) as StoneSkinResourceLike | null;
  if (!board || !frame || !stone) {
    throw createAppearanceError('appearance catalog descriptor is unavailable', 'appearance-catalog-unavailable');
  }

  const boardImageUrl = resolveAppearanceAssetUrl(board.imagePath, baseUri);
  const blackStoneImageUrl = resolveAppearanceAssetUrl(stone.blackImagePath, baseUri);
  const whiteStoneImageUrl = resolveAppearanceAssetUrl(stone.whiteImagePath, baseUri);
  const layout = Object.freeze({ ...frame.layout });
  const revisionSource = {
    boardSkinId: board.skinId,
    boardImageUrl,
    boardFrameSkinId: frame.skinId,
    boardFrameLayout: layout,
    stoneSkinId: stone.skinId,
    blackStoneImageUrl,
    whiteStoneImageUrl
  };
  const descriptor: BoardAppearanceDescriptor = Object.freeze({
    ...revisionSource,
    revision: fnv1a32(stableSerialize(revisionSource))
  });
  const resources = Object.freeze([
    makeResource('board', boardImageUrl, board.skinId, board.sourceBlob, board.contentFingerprint),
    makeResource('black-stone', blackStoneImageUrl, stone.skinId, stone.blackSourceBlob, stone.contentFingerprint),
    makeResource('white-stone', whiteStoneImageUrl, stone.skinId, stone.whiteSourceBlob, stone.contentFingerprint)
  ]);
  return Object.freeze({
    descriptor,
    resources,
    contentFingerprint: fingerprint({
      board: board.contentFingerprint,
      frame: frame.contentFingerprint,
      stone: stone.contentFingerprint,
      revisionSource
    })
  });
}

export function resolveBoardAppearanceDescriptor(
  rootRef: Window | Record<string, any> | null | undefined,
  selection: BoardAppearanceSelection = {}
): BoardAppearanceDescriptor {
  return resolveBoardAppearanceResources(rootRef, selection).descriptor;
}

export function acquireBoardAppearanceObjectUrlLease(
  rootRef: Window | Record<string, any> | null | undefined,
  appearance: ResolvedBoardAppearance | BoardAppearanceDescriptor
): BoardAppearanceObjectUrlLease {
  const root = resolveRootRef(rootRef);
  if (!root) throw createAppearanceError('custom skin lease root is unavailable', 'appearance-lease-root-unavailable');
  const resources = 'resources' in appearance
    ? appearance.resources
    : Object.freeze([
      makeResource('board', appearance.boardImageUrl, appearance.boardSkinId, null, ''),
      makeResource('black-stone', appearance.blackStoneImageUrl, appearance.stoneSkinId, null, ''),
      makeResource('white-stone', appearance.whiteStoneImageUrl, appearance.stoneSkinId, null, '')
    ]);
  const urlsBySkinId = new Map<string, string[]>();
  resources.forEach((resource) => {
    if (!resource.customSkinId) return;
    const urls = urlsBySkinId.get(resource.customSkinId) || [];
    if (!urls.includes(resource.url)) urls.push(resource.url);
    urlsBySkinId.set(resource.customSkinId, urls);
  });
  const leases: Array<{ release(): boolean }> = [];
  try {
    urlsBySkinId.forEach((urls, skinId) => {
      const lease = CustomSkinStorage.acquireCustomSkinObjectUrlLease(root, skinId, urls);
      if (!lease) throw createAppearanceError('custom skin object URL lease is unavailable', 'appearance-lease-unavailable');
      leases.push(lease);
    });
  } catch (error) {
    for (let index = leases.length - 1; index >= 0; index -= 1) leases[index].release();
    throw error;
  }
  const urls = Object.freeze(Array.from(urlsBySkinId.values()).flat());
  let released = false;
  return Object.freeze({
    urls,
    release: () => {
      if (released) return false;
      released = true;
      for (let index = leases.length - 1; index >= 0; index -= 1) leases[index].release();
      return true;
    }
  });
}

export function resolveSpecialStoneAppearanceResource(
  rootRef: Window | Record<string, any> | null | undefined,
  specialType: unknown,
  owner: unknown,
  baseUri?: string | null
): BoardAppearanceResourceDescriptor | null {
  const normalizedType = String(specialType || '').trim().toUpperCase();
  const effectKey = typeof GameVisualEffectsMap.getEffectKeyForSpecialType === 'function'
    ? GameVisualEffectsMap.getEffectKeyForSpecialType(specialType)
    : null;
  const effect = effectKey && GameVisualEffectsMap.STONE_VISUAL_EFFECTS
    ? GameVisualEffectsMap.STONE_VISUAL_EFFECTS[effectKey]
    : null;
  const effectPath = effect && typeof GameVisualEffectsMap.resolveEffectImagePath === 'function'
    ? GameVisualEffectsMap.resolveEffectImagePath(effect, { owner })
    : null;
  // Status-only visuals can have canonical built-in assets even without a
  // special-stone registry entry. Keep those assets in the Pixi resource
  // pipeline so they remain preloaded, bounded and transactionally committed
  // with the rest of the frame.
  const statusAssetPath = normalizedType === 'FREEZE'
    ? 'assets/images/other/ICE.png'
    : normalizedType === 'SEED'
      ? 'assets/images/other/seed.png'
      : normalizedType === 'BLOCKADE'
        ? 'assets/images/other/X.png'
        : normalizedType === 'METEOR_HOLE'
          ? 'assets/images/other/aaa.png'
          : null;
  const rawPath = effectPath || statusAssetPath;
  if (!rawPath) return null;
  const root = resolveRootRef(rootRef);
  const url = resolveAppearanceAssetUrl(rawPath, resolveBaseUri(root, baseUri));
  return makeResource('special-stone', url, '', null, fingerprint({ effectKey, owner, rawPath }));
}
