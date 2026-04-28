"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const normalized = normalizePlayerKey(playerKey);
if (!cardState || !normalized)
    return { changed: false, before: 0, after: 0, delta: 0 };
ensureChargeState(cardState);
const beforeRaw = Number(cardState.charge[normalized] || 0);
const safeBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
const add = Number(amount);
const safeAdd = Number.isFinite(add) ? add : 0;
return setChargeWithDelta(cardState, normalized, safeBefore + safeAdd, reason, meta);
module.exports = utils;
//# sourceMappingURL=utils.js.map