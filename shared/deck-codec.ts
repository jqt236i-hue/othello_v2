/**
 * @file deck-codec.ts
 * @description Deck encoding/decoding utilities
 */

(function (root: any, factory: (deckSpecHelpers: any) => any) {
    if (root && root.DeckSpecHelpers) {
        root.DeckCodecModule = factory(root.DeckSpecHelpers);
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./deck-spec'));
    } else {
        root.DeckCodecModule = factory(root.DeckSpecHelpers);
    }
}(typeof self !== 'undefined' ? self : this, function (DeckSpecHelpers: any) {
    'use strict';

    const CODEC_VERSION = 1;

    interface DeckCodeError extends Error {
        code: string;
        details?: unknown;
    }

    function createDeckCodeError(code: string, message?: string, details?: unknown): DeckCodeError {
        const error = new Error(String(message || code || 'DECK_CODE_ERROR')) as DeckCodeError;
        error.code = String(code || 'DECK_CODE_ERROR');
        if (typeof details !== 'undefined') {
            error.details = details;
        }
        return error;
    }

    function ensureDeckSpecHelpers(): any {
        if (!DeckSpecHelpers || typeof DeckSpecHelpers.normalizeDeckSpec !== 'function') {
            throw createDeckCodeError('DECK_SPEC_HELPERS_MISSING', 'DeckSpecHelpers が読み込まれていません');
        }
        return DeckSpecHelpers;
    }

    function getDeckCodeHeader(deckSpec: Record<string, unknown>): string {
        const helpers = ensureDeckSpecHelpers();
        const catalogVersion = Number(deckSpec && deckSpec.catalogVersion) || helpers.getCatalogVersion();
        return `D${CODEC_VERSION}C${catalogVersion}:`;
    }

    interface DeckEntry {
        cardId: string;
        count: number;
    }

    interface DeckSpec {
        version: number;
        catalogVersion: number;
        cards: DeckEntry[];
    }

    function encodeDeckSpec(deckSpec: DeckSpec): string {
        const helpers = ensureDeckSpecHelpers();
        const normalized = helpers.normalizeDeckSpec(deckSpec, { requireFullDeck: false });
        const body = normalized.cards
            .map((entry: DeckEntry) => `${entry.cardId}${entry.count > 1 ? `*${entry.count}` : ''}`)
            .join('.');
        return `${getDeckCodeHeader(normalized)}${body}`;
    }

    interface ParsedDeckCode {
        version: number;
        catalogVersion: number;
        body: string;
    }

    function parseDeckCode(deckCode: unknown): ParsedDeckCode {
        const raw = String(deckCode || '').trim();
        if (!raw) {
            throw createDeckCodeError('DECK_CODE_REQUIRED', 'deckCode が空です');
        }

        const match = raw.match(/^D(\d+)C(\d+):(.*)$/i);
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

    function decodeDeckCode(deckCode: unknown): DeckSpec {
        const helpers = ensureDeckSpecHelpers();
        const parsed = parseDeckCode(deckCode);
        const rawTokens = parsed.body === ''
            ? []
            : parsed.body.split('.');
        const tokens = rawTokens.map((token: string) => token.trim());
        if (tokens.some((token: string) => !token)) {
            throw createDeckCodeError('DECK_CODE_TOKEN_INVALID', 'deckCode の token が不正です');
        }

        const cards = tokens.map((token: string) => {
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
        }, { requireFullDeck: false });
    }

    interface SafeDecodeResult {
        ok: boolean;
        deckSpec: DeckSpec | null;
        error: DeckCodeError | null;
    }

    function safeDecodeDeckCode(deckCode: unknown): SafeDecodeResult {
        try {
            return { ok: true, deckSpec: decodeDeckCode(deckCode), error: null };
        } catch (error) {
            return { ok: false, deckSpec: null, error: error as DeckCodeError };
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

export {};
