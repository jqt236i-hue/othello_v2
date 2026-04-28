"use strict";
/**
 * @file deck-codec.ts
 * @description Deck encoding/decoding utilities
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./deck-spec'));
    }
    else {
        root.DeckCodecModule = factory(root.DeckSpecHelpers);
    }
}(typeof self !== 'undefined' ? self : this, function (DeckSpecHelpers) {
    'use strict';
    const CODEC_VERSION = 1;
    function createDeckCodeError(code, message, details) {
        const error = new Error(String(message || code || 'DECK_CODE_ERROR'));
        error.code = String(code || 'DECK_CODE_ERROR');
        if (typeof details !== 'undefined') {
            error.details = details;
        }
        return error;
    }
    function ensureDeckSpecHelpers() {
        if (!DeckSpecHelpers || typeof DeckSpecHelpers.normalizeDeckSpec !== 'function') {
            throw createDeckCodeError('DECK_SPEC_HELPERS_MISSING', 'DeckSpecHelpers が読み込まれていません');
        }
        return DeckSpecHelpers;
    }
    function getDeckCodeHeader(deckSpec) {
        const helpers = ensureDeckSpecHelpers();
        const catalogVersion = Number(deckSpec && deckSpec.catalogVersion) || helpers.getCatalogVersion();
        return `D${CODEC_VERSION}C${catalogVersion}:`;
    }
    function encodeDeckSpec(deckSpec) {
        const helpers = ensureDeckSpecHelpers();
        const normalized = helpers.normalizeDeckSpec(deckSpec);
        const body = normalized.cards
            .map((entry) => `${entry.cardId}${entry.count > 1 ? `*${entry.count}` : ''}`)
            .join('.');
        return `${getDeckCodeHeader(normalized)}${body}`;
    }
    function parseDeckCode(deckCode) {
        const raw = String(deckCode || '').trim();
        if (!raw) {
            throw createDeckCodeError('DECK_CODE_REQUIRED', 'deckCode が空です');
        }
        const match = raw.match(/^D(\d+)C(\d+):(.+)$/i);
        if (!match) {
            throw createDeckCodeError('DECK_CODE_INVALID', 'deckCode の形式が不正です');
        }
        const version = Number(match[1]);
        if (!Number.isInteger(version) || version !== CODEC_VERSION) {
            throw createDeckCodeError('DECK_CODE_VERSION_UNSUPPORTED', `未対応の deckCode version です: ${match[1]}`);
        }
        const catalogVersion = Number(match[2]);
        if (!Number.isInteger(catalogVersion) || catalogVersion < 1) {
            throw createDeckCodeError('DECK_CODE_CATALOG_INVALID', 'deckCode の catalogVersion が不正です');
        }
        return {
            version,
            catalogVersion,
            body: match[3]
        };
    }
    function decodeDeckCode(deckCode) {
        const helpers = ensureDeckSpecHelpers();
        const parsed = parseDeckCode(deckCode);
        const tokens = parsed.body.split('.').map((token) => token.trim()).filter((token) => token);
        if (tokens.length === 0) {
            throw createDeckCodeError('DECK_CODE_EMPTY', 'deckCode にカード情報がありません');
        }
        const cards = tokens.map((token) => {
            const match = token.match(/^([A-Za-z0-9_-]+)(?:\*(\d+))?$/);
            if (!match) {
                throw createDeckCodeError('DECK_CODE_TOKEN_INVALID', `deckCode の token が不正です: ${token}`);
            }
            return {
                cardId: match[1],
                count: Number(match[2] || 1)
            };
        });
        return helpers.normalizeDeckSpec({
            version: helpers.DECK_SPEC_VERSION || 1,
            catalogVersion: parsed.catalogVersion,
            cards
        });
    }
    function safeDecodeDeckCode(deckCode) {
        try {
            return { ok: true, deckSpec: decodeDeckCode(deckCode), error: null };
        }
        catch (error) {
            return { ok: false, deckSpec: null, error: error };
        }
    }
    return {
        CODEC_VERSION,
        createDeckCodeError,
        encodeDeckSpec,
        decodeDeckCode,
        safeDecodeDeckCode
    };
}));
//# sourceMappingURL=deck-codec.js.map