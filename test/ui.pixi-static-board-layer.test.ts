import { createPixiStaticBoardLayer } from '../ui/pixi/static-board-layer';

class Point {
  x = 0;
  y = 0;
  set(x: number, y = x) { this.x = x; this.y = y; }
}

class DisplayObject {
  label = '';
  parent: DisplayObject | null = null;
  children: DisplayObject[] = [];
  position = new Point();
  visible = true;
  alpha = 1;
  width = 0;
  height = 0;
  texture: any = null;
  destroyed = false;

  constructor(options?: any) { this.label = String(options?.label || ''); }
  addChild(...children: DisplayObject[]) {
    for (const child of children) {
      child.removeFromParent();
      child.parent = this;
      this.children.push(child);
    }
  }
  removeChild(child: DisplayObject) {
    this.children = this.children.filter((value) => value !== child);
    if (child.parent === this) child.parent = null;
  }
  removeFromParent() { this.parent?.removeChild(this); }
  destroy(options?: { children?: boolean }) {
    this.removeFromParent();
    if (options?.children) this.children.splice(0).forEach((child) => child.destroy({ children: true }));
    this.destroyed = true;
  }
}

class Container extends DisplayObject {}
class Graphics extends DisplayObject {}
class Sprite extends DisplayObject {
  constructor(options?: any) {
    super(options);
    this.texture = options?.texture || null;
  }
}

describe('Pixi static board layer', () => {
  test('bakes one retained texture, skips stable signatures, and releases topology patches', () => {
    const textures: any[] = [];
    const runtime = {
      Container,
      Graphics,
      Sprite,
      Texture: { EMPTY: { id: 'empty' } },
      RenderTexture: {
        create: jest.fn((options: any) => {
          const texture = { ...options, destroy: jest.fn() };
          textures.push(texture);
          return texture;
        })
      }
    };
    const renderer = { render: jest.fn() };
    const parent = new Container({ label: 'parent' });
    const source = new Container({ label: 'source' });
    source.position.set(12, 18);
    const layer = createPixiStaticBoardLayer({ runtime, renderer, parent });
    const base = {
      source,
      signature: 'surface:1',
      width: 320,
      height: 320,
      resolution: 2,
      sceneOffsetX: 32,
      sceneOffsetY: 32
    };

    expect(layer.applyBase(base)).toBe(true);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render.mock.calls[0][0]).toMatchObject({ container: source, target: textures[0], clear: true });
    expect(source.position).toMatchObject({ x: 12, y: 18 });
    expect(parent.children.map((child) => child.label)).toEqual(['pixi-static-board-texture']);
    expect(layer.getDiagnostics()).toMatchObject({
      bakeCount: 1,
      attachedObjectCount: 1,
      temporaryObjectCount: 0,
      texturePhysicalWidth: 640,
      texturePhysicalHeight: 640
    });

    expect(layer.applyBase(base)).toBe(false);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(layer.getDiagnostics().bakeSkipCount).toBe(1);

    layer.applyPatch({ ...base, signature: 'surface:1:patch' });
    layer.setPatchAlpha(0.35);
    expect(parent.children.map((child) => child.label)).toEqual([
      'pixi-static-board-texture',
      'pixi-static-board-topology-patch'
    ]);
    expect(parent.children[1].alpha).toBeCloseTo(0.35);
    expect(layer.getDiagnostics()).toMatchObject({ patchActive: true, attachedObjectCount: 2 });

    layer.applyPatch(null);
    expect(parent.children).toHaveLength(1);
    expect(textures[1].destroy).toHaveBeenCalled();
    layer.destroy();
    expect(parent.children).toHaveLength(0);
    expect(textures[0].destroy).toHaveBeenCalled();
  });
});
