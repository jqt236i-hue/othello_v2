declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../../src/types';

// These are provided externally (template context)
// NOTE: Wrapped in IIFE so TypeScript accepts the `return` statements (module-level
// return in CJS is valid JS but not valid TS). Template variables use `any` because
// the actual runtime shape differs from the static type definitions.
declare function normalizePlayerKey(playerKey: string | null): string | null;
declare function ensureChargeState(cs: any): void;
declare function setChargeWithDelta(cs: any, normalized: string, amount: number, reason: string, meta: any): { changed: boolean; before: number; after: number; delta: number };
declare let cardState: any;
declare let playerKey: string | null;
declare let amount: number;
declare let reason: string;
declare let meta: any;

void function ___utilsTemplate(): void {
  const normalized = normalizePlayerKey(playerKey);
  if (!cardState || !normalized) return;
  ensureChargeState(cardState);
  const beforeRaw = Number(cardState.charge !== undefined ? cardState.charge[normalized] : (cardState.charges ? cardState.charges[normalized] : 0));
  const safeBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
  const add = Number(amount);
  const safeAdd = Number.isFinite(add) ? add : 0;
  setChargeWithDelta(cardState, normalized, safeBefore + safeAdd, reason, meta);
}();

// utils is provided as a global by the build system (esbuild-banner.js)
declare const utils: any;

export = utils;
