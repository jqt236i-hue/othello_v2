import CardBoardExpansionApply = require('../../logic/card-resolution/board-expansion-apply');

const root = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);

if (root && !root.CardBoardExpansionApply) {
    root.CardBoardExpansionApply = CardBoardExpansionApply;
}

export = CardBoardExpansionApply;
