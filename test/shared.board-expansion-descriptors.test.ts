import { createExpansionDescriptors } from "../shared/board/expansion-descriptors";

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
      { side: "left", row: 1, col: -1, owner: 1 },
      { side: "right", row: 2, col: 5, owner: -1 },
      { side: "top", row: -1, col: 3, owner: 0 },
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
});
