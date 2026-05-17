// @ts-nocheck
'use strict';

const path = require('path');
const DeckSpecHelpers = require('../shared/deck-spec');
const CardCatalog = require(path.resolve(process.cwd(), 'cards', 'catalog.json'));

const DEFAULT_SELFPLAY_WHITE_DECK_CODE = DeckSpecHelpers.getCpuLv6WhiteDeckCode();

function normalizeOptionalDeckCode(value: any): string | null {
    const normalized = String(value || '').trim();
    return normalized ? normalized : null;
}

function decodeDeckCodeToCardIds(deckCode: any): string[] | null {
    const normalized = normalizeOptionalDeckCode(deckCode);
    if (!normalized) return null;
    const deckSpec = decodeDeckCodeWithSourceCatalog(normalized);
    const cardIds: string[] = [];
    deckSpec.cards.forEach((entry: any) => {
        for (let index = 0; index < entry.count; index += 1) {
            cardIds.push(entry.cardId);
        }
    });
    return cardIds;
}

function getSourceCatalogVersion(): number {
    const version = Number(CardCatalog && CardCatalog.version);
    return Number.isInteger(version) && version >= 1 ? version : 1;
}

function getEnabledSourceCardIds(): Set<string> {
    const cards = Array.isArray(CardCatalog && CardCatalog.cards) ? CardCatalog.cards : [];
    return new Set(cards
        .filter((card: any) => card && card.id && card.enabled !== false)
        .map((card: any) => String(card.id)));
}

function decodeDeckCodeWithSourceCatalog(deckCode: string) {
    const match = String(deckCode || '').trim().match(/^D(\d+)C(\d+):(.+)$/i);
    if (!match) throw new Error('deckCode の形式が不正です');
    const deckVersion = Number(match[1]);
    if (!Number.isInteger(deckVersion) || deckVersion !== 1) {
        throw new Error(`未対応の deckCode version です: ${match[1]}`);
    }
    const catalogVersion = Number(match[2]);
    const currentCatalogVersion = getSourceCatalogVersion();
    if (!Number.isInteger(catalogVersion) || catalogVersion !== currentCatalogVersion) {
        throw new Error(`catalogVersion が一致しません: expected=${currentCatalogVersion}, actual=${match[2]}`);
    }
    const enabledCardIds = getEnabledSourceCardIds();
    const countsByCardId = new Map<string, number>();
    String(match[3] || '').split('.').map((token) => token.trim()).filter(Boolean).forEach((token) => {
        const tokenMatch = token.match(/^([A-Za-z0-9_-]+)(?:\*(\d+))?$/);
        if (!tokenMatch) throw new Error(`deckCode の token が不正です: ${token}`);
        const cardId = tokenMatch[1];
        if (!enabledCardIds.has(cardId)) throw new Error(`未登録カードです: ${cardId}`);
        const count = Number(tokenMatch[2] || 1);
        if (!Number.isInteger(count) || count < 1) throw new Error(`カード枚数が不正です: ${cardId}`);
        countsByCardId.set(cardId, (countsByCardId.get(cardId) || 0) + count);
    });
    const cards: any[] = [];
    let total = 0;
    countsByCardId.forEach((count, cardId) => {
        if (count > 3) throw new Error(`同一カードは 3 枚までです: ${cardId}`);
        total += count;
        cards.push({ cardId, count });
    });
    const expectedSize = DeckSpecHelpers && DeckSpecHelpers.CUSTOM_DECK_SIZE ? DeckSpecHelpers.CUSTOM_DECK_SIZE : 30;
    if (total !== expectedSize) throw new Error(`カスタムデッキは ${expectedSize} 枚固定です`);
    return { version: 1, catalogVersion, cards };
}

function resolveInitialDeckCardIdsByPlayer(options: any) {
    const opts = options && typeof options === 'object' ? options : {};
    const blackDeck = decodeDeckCodeToCardIds(opts.blackDeckCode);
    const whiteDeck = decodeDeckCodeToCardIds(opts.whiteDeckCode);
    if (!blackDeck && !whiteDeck) return null;
    return {
        black: blackDeck || null,
        white: whiteDeck || null
    };
}

function buildDeckCodeArgs(options: any): string[] {
    const opts = options && typeof options === 'object' ? options : {};
    const args: string[] = [];
    const blackDeckCode = normalizeOptionalDeckCode(opts.blackDeckCode);
    const whiteDeckCode = normalizeOptionalDeckCode(opts.whiteDeckCode);
    if (blackDeckCode) args.push('--black-deck-code', blackDeckCode);
    if (whiteDeckCode) args.push('--white-deck-code', whiteDeckCode);
    else if (Object.prototype.hasOwnProperty.call(opts, 'whiteDeckCode')) args.push('--no-white-deck-code');
    return args;
}

export {
    DEFAULT_SELFPLAY_WHITE_DECK_CODE,
    normalizeOptionalDeckCode,
    decodeDeckCodeToCardIds,
    resolveInitialDeckCardIdsByPlayer,
    buildDeckCodeArgs
};
