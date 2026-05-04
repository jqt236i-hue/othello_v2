declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * Board-related type definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORTHOGONAL_DIRECTIONS = exports.DIRECTIONS = void 0;
exports.DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
];
exports.ORTHOGONAL_DIRECTIONS = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
];

export {};
