import { createPixiCellView } from '../ui/pixi/cell-view';
import { createPixiStoneView } from '../ui/pixi/stone-view';
import { createFakeRuntime, makeCell, materializedCell, viewContext } from './helpers/pixi-board-scene-fixtures';

const marker = (kind: string, data: any = {}) => ({ kind, owner: 'white', value: null, data });
const whiteStone = { owner: 'white', value: -1, specialType: null, status: {} };
const child = (root: any, label: string): any => {
  const value = root.children.find((candidate: any) => candidate.label === label);
  expect(value).toBeDefined();
  return value;
};
const cell = (options: any = {}) => materializedCell(makeCell('1,1', options));

describe('Pixi status visuals remain recognizable on the board', () => {
  test.each([null, 'WORK'])('living will adds a yellow aura to normal and special stones (%s) and clears on removal', (specialType) => {
    const view = createPixiStoneView(createFakeRuntime().runtime);
    const texture = {};
    const context = viewContext({ textures: { 'white-stone': texture, 'special-stone:WORK:white': texture } });
    const stone = { ...whiteStone, specialType };
    view.update(cell({ stone, markers: [marker('living-will-aura', { active: true })] }), context);
    const aura = child(view.root, 'pixi-stone-aura');
    expect(aura.commands).toContainEqual({ op: 'fill', style: { color: '#ffdc48', alpha: 0.28 } });
    expect(aura.commands.some((c: any) => c.op === 'circle' && c.args[2] > context.layout.cellSize / 2)).toBe(true);
    expect(child(view.root, 'pixi-stone-texture')).toMatchObject({ texture, visible: true });
    view.update(cell({ stone }), context);
    expect(aura.commands).toHaveLength(0);
  });

  test('poison tints the entire stone below its countdown without replacing the stone image', () => {
    const view = createPixiStoneView(createFakeRuntime().runtime);
    const texture = {};
    const context = viewContext({ textures: { 'white-stone': texture } });
    view.update(cell({ stone: whiteStone, markers: [marker('poisoned', { remainingTurns: 5 })] }), context);
    const tint = child(view.root, 'pixi-stone-status-overlay');
    expect(tint.commands).toContainEqual({ op: 'fill', style: { color: '#a733c5', alpha: 0.22 } });
    expect(tint.commands.find((c: any) => c.op === 'circle').args[2]).toBeGreaterThan(context.layout.cellSize * 0.4);
    const sprite = child(view.root, 'pixi-stone-texture');
    expect(sprite).toMatchObject({ texture, visible: true });
    expect(view.root.children.indexOf(tint)).toBeGreaterThan(view.root.children.indexOf(sprite));
    expect(view.root.children.indexOf(tint)).toBeLessThan(view.root.children.indexOf(child(view.root, 'pixi-stone-status-labels')));
    expect(view.getDiagnostics().statusLabels).toEqual([{ kind: 'poison', value: '5' }]);
    view.update(cell({ stone: whiteStone }), context);
    expect(tint.commands).toHaveLength(0);
  });

  test.each([false, true])('failed ice image draws blue ice and cracks with or without a stone (%s), then recovers', (occupied) => {
    const view = createPixiStoneView(createFakeRuntime().runtime);
    const frozen = cell({ stone: occupied ? whiteStone : null, markers: [marker('frozen', { remainingOwnerTurns: 3 })] });
    const failedResource = { texture: { whitePixel: true }, usedFallback: true };
    view.update(frozen, viewContext({ textures: { getResource: () => failedResource, get: () => failedResource.texture } }));
    expect(child(view.root, 'pixi-stone-marker-overlay').visible).toBe(false);
    const ice = child(view.root, 'pixi-stone-status-overlay');
    expect(ice.commands).toContainEqual({ op: 'fill', style: { color: '#8dc8ed', alpha: 0.62 } });
    expect(ice.commands.filter((c: any) => c.op === 'lineTo')).toHaveLength(2);
    expect(view.getDiagnostics()).toMatchObject({ visible: true, statusLabels: [{ kind: 'freeze', value: '3' }] });
    const iceTexture = {};
    view.update(frozen, viewContext({ stoneRevisionSignature: 'ice-loaded', textures: { 'special-stone:FREEZE:white': iceTexture } }));
    expect(child(view.root, 'pixi-stone-marker-overlay')).toMatchObject({ visible: true, texture: iceTexture });
    expect(ice.commands).toHaveLength(0);
    view.reset();
    expect(child(view.root, 'pixi-stone-marker-overlay').visible).toBe(false);
  });

  test.each([false, true])('holes use the hole image below shrink edges (shrink: %s), and clear on regeneration', (shrink) => {
    const view = createPixiCellView(createFakeRuntime().runtime);
    const texture = {};
    const context = viewContext({ cellRenderMode: 'base-only', textures: { 'board-hole': texture } });
    const hole = cell({ kind: 'hole', markers: [marker('blockade', {
      type: 'METEOR_HOLE', visualVariant: shrink ? 'BOARD_FRAME' : null, innerBoundaryMask: 'bottom'
    })] });
    view.update(hole, context);
    const image = child(view.surfaceRoot, 'pixi-cell-hole-texture');
    expect(image).toMatchObject({ texture, visible: true, alpha: shrink ? 0.82 : 1,
      width: context.layout.cellSize, height: context.layout.cellSize });
    expect(view.surfaceRoot.children.indexOf(image)).toBeLessThan(view.surfaceRoot.children.indexOf(child(view.surfaceRoot, 'pixi-cell-board-frame-hole-inner-edges')));
    view.update(cell(), context);
    expect(image.visible).toBe(false);
  });

  test('an unavailable hole image retains a dark hole rather than showing a white fallback texture', () => {
    const view = createPixiCellView(createFakeRuntime().runtime);
    const resource = { texture: { whitePixel: true }, usedFallback: true };
    view.update(cell({ kind: 'hole' }), viewContext({ textures: { getResource: () => resource, get: () => resource.texture } }));
    expect(child(view.surfaceRoot, 'pixi-cell-hole-texture').visible).toBe(false);
    expect(child(view.surfaceRoot, 'pixi-cell-surface-fill').commands).toContainEqual({ op: 'fill', style: { color: '#000000', alpha: 1 } });
  });
});
