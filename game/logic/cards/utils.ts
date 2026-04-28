// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../../src/types';

const normalized = normalizePlayerKey(playerKey);
        if (!cardState || !normalized) return { changed: false, before: 0, after: 0, delta: 0 };
        ensureChargeState(cardState);
        const beforeRaw = Number(cardState.charge[normalized] || 0);
        const safeBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
        const add = Number(amount);
        const safeAdd = Number.isFinite(add) ? add : 0;
        return setChargeWithDelta(cardState, normalized, safeBefore + safeAdd, reason, meta);

export = utils;
