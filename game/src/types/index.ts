declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * Central type exports for the Card Reversi game
 */
var __createBinding = (module.exports && module.exports.__createBinding) || function(o: any, m: any, k: any, k2?: any) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
};
var __exportStar = (module.exports && module.exports.__exportStar) || function(m: any, exports: any) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./player"), exports);
__exportStar(require("./board"), exports);
__exportStar(require("./card"), exports);
__exportStar(require("./game"), exports);
__exportStar(require("./events"), exports);

export {};
