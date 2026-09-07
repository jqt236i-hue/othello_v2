import { createObjectPool, type ObjectPool } from './pools';
import {
    addPixiChild,
    clearPixiGraphics,
    createPixiContainer,
    createPixiGraphics,
    createPixiSprite,
    removeAndDestroyPixiChildren,
    removePixiFromParent,
    destroyPixiDisplayObject,
    setPixiPosition,
    setPixiScale,
    type PixiStaticViewRuntime
} from './cell-view';

export interface SourceTrajectoryView {
  readonly root: any;
  readonly mask: any;
  readonly graphics: any;
  readonly preparedRoot: any;
  readonly sprite: any | null;
}

/** Owns creation, reuse cleanup and destruction of trajectory display objects. */
export function createSourceTrajectoryViewPool(runtime: PixiStaticViewRuntime, maxRetainedEffects: number): ObjectPool<SourceTrajectoryView> {
  return createObjectPool({
    create: () => {
      const root = createPixiContainer(runtime, 'pixi-source-trajectory');
      const mask = createPixiGraphics(runtime, 'pixi-source-trajectory-mask');
      const graphics = createPixiGraphics(runtime, 'pixi-source-trajectory-graphics');
      const preparedRoot = createPixiContainer(runtime, 'pixi-source-trajectory-prepared');
      const sprite = createPixiSprite(runtime, 'pixi-source-trajectory-sprite');
      addPixiChild(root, graphics, preparedRoot, sprite);
      root.eventMode = 'none';
      return Object.freeze({ root, mask, graphics, preparedRoot, sprite });
    },
    reset: (view) => {
      view.root.mask = null;
      clearPixiGraphics(view.mask);
      clearPixiGraphics(view.graphics);
      removeAndDestroyPixiChildren(view.preparedRoot);
      if (view.sprite) {
        view.sprite.texture = runtime.Texture?.EMPTY || null;
        view.sprite.visible = false;
        view.sprite.alpha = 1;
        view.sprite.rotation = 0;
        setPixiPosition(view.sprite, 0, 0);
        setPixiScale(view.sprite, 1, 1);
      }
      setPixiPosition(view.root, 0, 0);
      setPixiScale(view.root, 1, 1);
      view.root.rotation = 0;
      view.root.alpha = 1;
      view.root.visible = false;
      removePixiFromParent(view.root);
      removePixiFromParent(view.mask);
    },
    destroy: (view) => {
      view.root.mask = null;
      destroyPixiDisplayObject(view.root);
      destroyPixiDisplayObject(view.mask);
    },
    maxRetained: maxRetainedEffects
  });
}
