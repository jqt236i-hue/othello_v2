import {
  createBoardMoveIdentity,
  normalizeBoardPosition,
  normalizeBoardPositionsStrict,
} from "../shared/board/move-codec";

describe("shared board move codec", () => {
  test("normalizes tuple and object coordinates into one canonical shape", () => {
    expect(normalizeBoardPosition([1, 2])).toEqual({ row: 1, col: 2 });
    expect(normalizeBoardPosition({ row: -1, col: 3 })).toEqual({
      row: -1,
      col: 3,
    });
    expect(
      normalizeBoardPositionsStrict([
        [1, 2],
        { row: -1, col: 3 },
      ]),
    ).toEqual([
      { row: 1, col: 2 },
      { row: -1, col: 3 },
    ]);
  });

  test("rejects malformed coordinates instead of partially projecting them", () => {
    expect(normalizeBoardPosition([1, 2, 3])).toBeNull();
    expect(normalizeBoardPosition([1])).toBeNull();
    expect(normalizeBoardPosition({ row: 1, col: 1.5 })).toBeNull();
    expect(
      normalizeBoardPositionsStrict([[1, 2], { row: "3", col: 4 }]),
    ).toBeNull();
  });

  test("move identity distinguishes omitted, empty, and different flip sets", () => {
    expect(createBoardMoveIdentity({ row: 2, col: 3 })).toBe(
      "2,3|omitted",
    );
    expect(createBoardMoveIdentity({ row: 2, col: 3, flips: [] })).toBe(
      "2,3|provided:",
    );
    expect(
      createBoardMoveIdentity({
        row: 2,
        col: 3,
        flips: [[3, 3], { row: 1, col: 3 }],
      }),
    ).toBe("2,3|provided:1,3;3,3");
    expect(
      createBoardMoveIdentity({
        row: 2,
        col: 3,
        flips: [[3, 2], { row: 1, col: 3 }],
      }),
    ).not.toBe("2,3|provided:1,3;3,3");
  });
});
