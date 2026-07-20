import {
  addPixiChild,
  createPixiSprite,
  destroyPixiDisplayObject,
  removePixiFromParent,
  setPixiPosition,
  type PixiStaticViewRuntime
} from './cell-view';

export interface PixiStaticBoardLayerOptions {
  readonly runtime: PixiStaticViewRuntime & {
    readonly RenderTexture?: { create(options: any): any };
  };
  readonly renderer?: any;
  readonly parent: any;
}

export interface PixiStaticBoardBakeOptions {
  readonly source: any;
  readonly signature: string;
  readonly width: number;
  readonly height: number;
  readonly resolution: number;
  readonly sceneOffsetX: number;
  readonly sceneOffsetY: number;
}

export interface PixiStaticBoardLayerDiagnostics {
  readonly bakeCount: number;
  readonly bakeSkipCount: number;
  readonly patchBakeCount: number;
  readonly attachedObjectCount: number;
  readonly temporaryObjectCount: 0;
  readonly texturePhysicalWidth: number;
  readonly texturePhysicalHeight: number;
  readonly signature: string | null;
  readonly patchActive: boolean;
}

export interface PixiStaticBoardLayer {
  applyBase(options: PixiStaticBoardBakeOptions): boolean;
  applyPatch(options: PixiStaticBoardBakeOptions | null): void;
  setPatchAlpha(alpha: number): void;
  invalidate(): void;
  reset(): void;
  destroy(): void;
  getDiagnostics(): PixiStaticBoardLayerDiagnostics;
}

interface SyntheticRenderTexture {
  readonly width: number;
  readonly height: number;
  readonly resolution: number;
  destroyed: boolean;
  destroy(): void;
}

function normalizedDimension(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.ceil(numeric)) : 1;
}

function normalizedResolution(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.min(2, numeric) : 1;
}

function destroyTexture(texture: any): void {
  if (!texture || typeof texture.destroy !== 'function') return;
  texture.destroy(true);
}

function createSyntheticTexture(width: number, height: number, resolution: number): SyntheticRenderTexture {
  return {
    width,
    height,
    resolution,
    destroyed: false,
    destroy() { this.destroyed = true; }
  };
}

export function createPixiStaticBoardLayer(
  options: PixiStaticBoardLayerOptions
): PixiStaticBoardLayer {
  if (!options?.runtime || !options.parent) {
    throw new Error('Pixi static board layer requires runtime and parent');
  }
  const runtime = options.runtime;
  const renderer = options.renderer || null;
  const sprite = createPixiSprite(runtime, 'pixi-static-board-texture');
  const patchSprite = createPixiSprite(runtime, 'pixi-static-board-topology-patch');
  if (!sprite || !patchSprite) throw new Error('Pixi static board layer requires Sprite support');
  sprite.visible = false;
  patchSprite.visible = false;
  addPixiChild(options.parent, sprite);
  let texture: any = null;
  let patchTexture: any = null;
  let signature: string | null = null;
  let bakeCount = 0;
  let bakeSkipCount = 0;
  let patchBakeCount = 0;
  let texturePhysicalWidth = 0;
  let texturePhysicalHeight = 0;
  let destroyed = false;

  const assertAlive = () => {
    if (destroyed) throw new Error('Pixi static board layer is destroyed');
  };

  const renderTexture = (bake: PixiStaticBoardBakeOptions): any => {
    const width = normalizedDimension(bake.width);
    const height = normalizedDimension(bake.height);
    const resolution = normalizedResolution(bake.resolution);
    const renderTextureFactory = (runtime as any).RenderTexture;
    if (!renderer) {
      return createSyntheticTexture(width, height, resolution);
    }
    if (!renderTextureFactory || typeof renderTextureFactory.create !== 'function') {
      throw new Error('Pixi RenderTexture runtime is unavailable');
    }
    const candidate = renderTextureFactory.create({ width, height, resolution });
    try {
      const sourcePosition = bake.source?.position;
      const previousX = Number(sourcePosition?.x) || 0;
      const previousY = Number(sourcePosition?.y) || 0;
      setPixiPosition(bake.source, previousX - bake.sceneOffsetX, previousY - bake.sceneOffsetY);
      try {
        renderer.render({ container: bake.source, target: candidate, clear: true });
      } finally {
        setPixiPosition(bake.source, previousX, previousY);
      }
      return candidate;
    } catch (error) {
      destroyTexture(candidate);
      throw error;
    }
  };

  const installTexture = (target: any, nextTexture: any, bake: PixiStaticBoardBakeOptions) => {
    target.texture = nextTexture;
    target.visible = true;
    target.alpha = 1;
    setPixiPosition(target, bake.sceneOffsetX, bake.sceneOffsetY);
    target.width = normalizedDimension(bake.width);
    target.height = normalizedDimension(bake.height);
  };

  return Object.freeze({
    applyBase(bake: PixiStaticBoardBakeOptions) {
      assertAlive();
      if (signature === bake.signature && texture) {
        bakeSkipCount += 1;
        return false;
      }
      const nextTexture = renderTexture(bake);
      const previous = texture;
      texture = nextTexture;
      signature = bake.signature;
      bakeCount += 1;
      texturePhysicalWidth = normalizedDimension(bake.width) * normalizedResolution(bake.resolution);
      texturePhysicalHeight = normalizedDimension(bake.height) * normalizedResolution(bake.resolution);
      installTexture(sprite, nextTexture, bake);
      destroyTexture(previous);
      return true;
    },
    applyPatch(bake: PixiStaticBoardBakeOptions | null) {
      assertAlive();
      const previous = patchTexture;
      patchTexture = null;
      patchSprite.visible = false;
      removePixiFromParent(patchSprite);
      if (bake) {
        patchTexture = renderTexture(bake);
        patchBakeCount += 1;
        installTexture(patchSprite, patchTexture, bake);
        addPixiChild(options.parent, patchSprite);
      }
      destroyTexture(previous);
    },
    setPatchAlpha(alpha: number) {
      if (destroyed || !patchTexture) return;
      patchSprite.alpha = Math.max(0, Math.min(1, Number(alpha) || 0));
      patchSprite.visible = true;
    },
    invalidate() {
      if (destroyed) return;
      signature = null;
    },
    reset() {
      if (destroyed) return;
      signature = null;
      texturePhysicalWidth = 0;
      texturePhysicalHeight = 0;
      sprite.visible = false;
      patchSprite.visible = false;
      removePixiFromParent(patchSprite);
      sprite.texture = runtime.Texture?.EMPTY || null;
      patchSprite.texture = runtime.Texture?.EMPTY || null;
      destroyTexture(texture);
      destroyTexture(patchTexture);
      texture = null;
      patchTexture = null;
    },
    destroy() {
      if (destroyed) return;
      this.reset();
      destroyed = true;
      removePixiFromParent(sprite);
      removePixiFromParent(patchSprite);
      destroyPixiDisplayObject(sprite);
      destroyPixiDisplayObject(patchSprite);
    },
    getDiagnostics() {
      return Object.freeze({
        bakeCount,
        bakeSkipCount,
        patchBakeCount,
        attachedObjectCount: destroyed ? 0 : (patchTexture ? 2 : 1),
        temporaryObjectCount: 0 as const,
        texturePhysicalWidth,
        texturePhysicalHeight,
        signature,
        patchActive: !!patchTexture
      });
    }
  });
}
