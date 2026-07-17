const Layout = require('../ui/board-visual/layout');

const topology = {
  baseRows: 8,
  baseCols: 10,
  minRow: -2,
  maxRow: 7,
  minCol: -1,
  maxCol: 8,
  renderRowOffset: 2,
  renderColOffset: 1,
  renderRows: 10,
  renderCols: 10,
  existingKeys: [],
  playableKeys: [],
  holeKeys: []
};

describe('BoardViewportLayout', () => {
  test('round-trips negative world coordinates through scene coordinates with scroll', () => {
    const layout = Layout.createBoardViewportLayout(topology, {
      revision: 7,
      cellSize: 40,
      camera: { scrollLeft: 30, scrollTop: 50, viewportWidth: 160, viewportHeight: 120 }
    });
    const scene = Layout.worldToScene(topology, layout, -2, 3);
    expect(scene).toEqual({ x: 130, y: -50 });
    expect(Layout.sceneToWorld(topology, layout, scene.x + 1, scene.y + 1)).toEqual({ row: -2, col: 3 });
  });

  test('client rect applies visualViewport offset without cancelling browser zoom', () => {
    const layout = Layout.createBoardViewportLayout(topology, {
      revision: 4,
      cellSize: 50,
      dpr: 3,
      frameInset: { left: 5, top: 7 },
      clientOrigin: { x: 100, y: 200 },
      visualViewport: { scale: 2, offsetLeft: 11, offsetTop: 13 },
      camera: { viewportWidth: 500, viewportHeight: 500 }
    });
    const rect = Layout.getCellClientRect(topology, layout, -2, -1);
    expect(layout.dpr).toBe(2);
    expect(layout.stageScale).toBe(1);
    expect(layout.cellScale).toBe(1);
    expect(layout.visualViewport.scale).toBe(2);
    expect(rect).toMatchObject({ left: 94, top: 194, width: 50, height: 50, layoutRevision: 4 });
  });

  test('rotated orientation remains invertible', () => {
    const layout = Layout.createBoardViewportLayout(topology, {
      cellSize: 32,
      orientation: 'rotated-180',
      camera: { viewportWidth: 320, viewportHeight: 320 }
    });
    const point = Layout.worldToScene(topology, layout, 1, 2);
    expect(Layout.sceneToWorld(topology, layout, point.x + 0.5, point.y + 0.5)).toEqual({ row: 1, col: 2 });
  });
});
