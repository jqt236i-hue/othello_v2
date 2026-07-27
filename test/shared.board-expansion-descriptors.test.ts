import {
  createExpansionDescriptors,
  DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
} from "../shared/board/expansion-descriptors";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board expansion descriptors", () => {
  test("keeps side inference, implicit columns, and first-cell ownership fixture-equivalent", () => {
    const leaf = createExpansionDescriptors({
      resolveOuterBounds: SharedBoardUtils.resolveOuterBounds,
      isMainBoardCell: SharedBoardUtils.isMainBoardCell,
      normalizeOwner: (value) => (value === 1 || value === -1 ? value : 0),
    });
    const state = { boardConfig: { rows: 4, cols: 5 } };
    const expansion = {
      active: true,
      side: "right",
      row: 2,
      owner: -1,
      cells: [
        { side: "left", row: 1, owner: 1 },
        { side: "right", row: 2, owner: -1 },
        { side: "right", row: 2, col: 5, owner: 1 },
        { side: "top", row: -1, col: 3, owner: 99 },
        { side: "top", row: 0, col: 0, owner: 1 },
      ],
    };
    const expected = [
      { side: "top", row: -1, col: 3, owner: 0 },
      { side: "left", row: 1, col: -1, owner: 1 },
      { side: "right", row: 2, col: 5, owner: -1 },
    ];

    expect(leaf.collectExpansionDescriptors(expansion, state)).toEqual(
      expected,
    );
    expect(
      SharedBoardUtils.collectExpansionDescriptors(expansion, state),
    ).toEqual(expected);
    expect(leaf.isExpansionCoordinate(0, 0, state)).toBe(false);
    expect(leaf.isExpansionCoordinate(-1, 0, state)).toBe(true);
  });

  test("reads only bounded dense own indices and never invokes a caller iterator", () => {
    const state = { boardConfig: { rows: 4, cols: 4 } };
    const valid = { side: "right", row: 1, col: 4, owner: -1 };
    let iteratorCalls = 0;
    const cells: any[] = [valid];
    Object.defineProperty(cells, Symbol.iterator, {
      value: function* spoofedIterator() {
        iteratorCalls += 1;
        yield { side: "left", row: 1, col: -1, owner: 1 };
      },
    });

    expect(
      SharedBoardUtils.collectExpansionDescriptors({ cells }, state),
    ).toEqual([valid]);
    expect(iteratorCalls).toBe(0);

    const emptyCells: any[] = [];
    Object.defineProperty(emptyCells, Symbol.iterator, {
      value: function* spoofedEmptyIterator() {
        iteratorCalls += 1;
        yield valid;
      },
    });
    expect(
      SharedBoardUtils.collectExpansionDescriptors(
        { cells: emptyCells },
        state,
      ),
    ).toEqual([]);
    expect(iteratorCalls).toBe(0);
  });

  test("captures array length once and rejects accessor-backed entries without invoking them", () => {
    const state = { boardConfig: { rows: 4, cols: 4 } };
    const valid = { side: "right", row: 1, col: 4, owner: -1 };
    let lengthReads = 0;
    const variableLength = new Proxy([valid], {
      get(target, property, receiver) {
        if (property === "length") {
          lengthReads += 1;
          return lengthReads === 1 ? 1 : Number.POSITIVE_INFINITY;
        }
        return Reflect.get(target, property, receiver);
      },
    });

    expect(
      SharedBoardUtils.collectExpansionDescriptors(
        { cells: variableLength },
        state,
      ),
    ).toEqual([valid]);
    expect(lengthReads).toBe(1);

    let getterCalls = 0;
    const accessorCells: any[] = [];
    Object.defineProperty(accessorCells, 0, {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return valid;
      },
    });
    accessorCells.length = 1;
    expect(() =>
      SharedBoardUtils.collectExpansionDescriptors(
        { cells: accessorCells },
        state,
      ),
    ).toThrow(/bounded dense array/);
    expect(getterCalls).toBe(0);
  });

  test("fails closed on sparse or oversized expansion descriptor arrays", () => {
    const state = { boardConfig: { rows: 4, cols: 4 } };
    const sparseCells: any[] = new Array(1);
    expect(() =>
      SharedBoardUtils.collectExpansionDescriptors(
        { cells: sparseCells },
        state,
      ),
    ).toThrow(/bounded dense array/);

    const oversizedCells = new Array(
      DEFAULT_BOARD_MAX_SHAPE_ENTRIES + 1,
    );
    expect(() =>
      SharedBoardUtils.collectExpansionDescriptors(
        { cells: oversizedCells },
        state,
      ),
    ).toThrow(/bounded dense array/);
  });
});
