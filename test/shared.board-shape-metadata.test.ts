import { createBoardShapeMetadata } from "../shared/board/shape-metadata";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board shape metadata", () => {
  test("attaches non-enumerable shape data and clones mutable shape state independently", () => {
    const leaf = createBoardShapeMetadata({
      metaKey: SharedBoardUtils.BOARD_SHAPE_META_KEY,
      defaultRows: 8,
      defaultCols: 8,
      toBoardCellKey: SharedBoardUtils.toBoardCellKey,
      normalizeOwner: (value) => (value === 1 || value === -1 ? value : 0),
      resolveBoardConfig: SharedBoardUtils.resolveBoardConfig,
      isMainBoardCell: SharedBoardUtils.isMainBoardCell,
      collectExpansionDescriptors: SharedBoardUtils.collectExpansionDescriptors,
    });
    const board = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => 0),
    );
    const options = {
      boardExpansion: { cells: [{ side: "right", row: 1, col: 4, owner: -1 }] },
      cardState: {
        markers: [
          {
            kind: "specialStone",
            row: 0,
            col: 0,
            data: { type: "METEOR_HOLE" },
          },
        ],
      },
    };
    leaf.attachBoardShape(board, options);
    const meta = leaf.getBoardShapeMeta(board)!;
    const clone = leaf.cloneBoard(board);
    const clonedMeta = leaf.getBoardShapeMeta(clone)!;

    expect(Object.keys(board)).not.toContain(
      SharedBoardUtils.BOARD_SHAPE_META_KEY,
    );
    expect(meta.playableKeys.has("0,0")).toBe(false);
    expect(meta.expansionOwnerByKey["1,4"]).toBe(-1);
    expect(clonedMeta).not.toBe(meta);
    expect(clonedMeta.playableKeys).not.toBe(meta.playableKeys);
    clonedMeta.expansionOwnerByKey["1,4"] = 1;
    expect(meta.expansionOwnerByKey["1,4"]).toBe(-1);
    expect(SharedBoardUtils.getBoardShapeMeta(board)).toMatchObject({
      minRow: 0,
      maxRow: 3,
      minCol: 0,
      maxCol: 4,
    });
  });

  test("excludes base-shape void without treating it as a meteor hole", () => {
    const board = Array.from({ length: 10 }, () => Array(10).fill(0));
    SharedBoardUtils.attachBoardShape(board, {
      boardConfig: { rows: 10, cols: 10, shape: "circle" },
    });

    const meta = SharedBoardUtils.getBoardShapeMeta(board)!;
    expect(meta.playableKeys.size).toBe(80);
    expect(meta.playableKeys.has("0,0")).toBe(false);
    expect(meta.meteorHoleKeys.has("0,0")).toBe(false);
    expect(meta.playableKeys.has("4,4")).toBe(true);
    expect(meta.standard8x8).toBe(false);
  });
});
