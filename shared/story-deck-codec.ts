(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./story-deck-spec'));
    } else {
        root.StoryDeckCodecModule = factory(root.StoryDeckSpecHelpers);
    }
}(typeof self !== 'undefined' ? self : this as Record<string, unknown>, function (StoryDeckSpecHelpers: unknown) {
    'use strict';

    interface DeckCodeError extends Error {
        code: string;
        details?: unknown;
    }

    interface ParsedDeckCode {
        version: number;
        catalogVersion: number;
        ruleSetId: string;
        body: string;
    }

    interface DeckSpecHelpers {
        normalizeStoryDeckSpec: (input: unknown) => unknown;
        getCatalogVersion: () => number;
        DEFAULT_RULE_SET_ID?: string;
        STORY_DECK_SPEC_VERSION?: number;
    }

    const CODEC_VERSION = 1;

    function createStoryDeckCodeError(code: string, message: string, details?: unknown): DeckCodeError {
        const error = new Error(String(message || code || 'STORY_DECK_CODE_ERROR')) as DeckCodeError;
        error.code = String(code || 'STORY_DECK_CODE_ERROR');
        if (typeof details !== 'undefined') {
            error.details = details;
        }
        return error;
    }

    function ensureStoryDeckSpecHelpers(): DeckSpecHelpers {
        if (
            !StoryDeckSpecHelpers ||
            typeof (StoryDeckSpecHelpers as DeckSpecHelpers).normalizeStoryDeckSpec !== 'function'
        ) {
            throw createStoryDeckCodeError('STORY_DECK_SPEC_HELPERS_MISSING', 'StoryDeckSpecHelpers が読み込まれていません');
        }
        return StoryDeckSpecHelpers as DeckSpecHelpers;
    }

    function getDeckCodeHeader(deckSpec: unknown): string {
        const helpers = ensureStoryDeckSpecHelpers();
        const spec = deckSpec as Record<string, unknown> | null;
        const catalogVersion = Number(spec && spec.catalogVersion) || helpers.getCatalogVersion();
        const ruleSetId = String(spec && spec.ruleSetId || helpers.DEFAULT_RULE_SET_ID || '').trim();
        return `SD${CODEC_VERSION}C${catalogVersion}R${ruleSetId}:`;
    }

    function encodeStoryDeckSpec(deckSpec: unknown): string {
        const helpers = ensureStoryDeckSpecHelpers();
        const normalized = helpers.normalizeStoryDeckSpec(deckSpec) as { cards: Array<{ cardId: string; count: number }> };
        const body = normalized.cards
            .map((entry) => `${entry.cardId}${entry.count > 1 ? `*${entry.count}` : ''}`)
            .join('.');
        return `${getDeckCodeHeader(normalized)}${body}`;
    }

    function parseStoryDeckCode(deckCode: unknown): ParsedDeckCode {
        const raw = String(deckCode || '').trim();
        if (!raw) {
            throw createStoryDeckCodeError('STORY_DECK_CODE_REQUIRED', 'storyDeckCode が空です');
        }

        const match = raw.match(/^SD(\d+)C(\d+)R([A-Za-z0-9_-]+):(.+)$/i);
        if (!match) {
            throw createStoryDeckCodeError('STORY_DECK_CODE_INVALID', 'storyDeckCode の形式が不正です');
        }

        const version = Number(match[1]);
        if (!Number.isInteger(version) || version !== CODEC_VERSION) {
            throw createStoryDeckCodeError('STORY_DECK_CODE_VERSION_UNSUPPORTED', `未対応の storyDeckCode version です: ${match[1]}`);
        }

        const catalogVersion = Number(match[2]);
        if (!Number.isInteger(catalogVersion) || catalogVersion < 1) {
            throw createStoryDeckCodeError('STORY_DECK_CODE_CATALOG_INVALID', 'storyDeckCode の catalogVersion が不正です');
        }

        return {
            version,
            catalogVersion,
            ruleSetId: String(match[3] || '').trim(),
            body: match[4]
        };
    }

    function decodeStoryDeckCode(deckCode: unknown): unknown {
        const helpers = ensureStoryDeckSpecHelpers();
        const parsed = parseStoryDeckCode(deckCode);
        const tokens = parsed.body.split('.').map((token) => token.trim()).filter((token) => token);
        if (tokens.length === 0) {
            throw createStoryDeckCodeError('STORY_DECK_CODE_EMPTY', 'storyDeckCode にカード情報がありません');
        }

        const cards = tokens.map((token) => {
            const match = token.match(/^([A-Za-z0-9_-]+)(?:\*(\d+))?$/);
            if (!match) {
                throw createStoryDeckCodeError('STORY_DECK_CODE_TOKEN_INVALID', `storyDeckCode の token が不正です: ${token}`);
            }
            return {
                cardId: match[1],
                count: Number(match[2] || 1)
            };
        });

        return helpers.normalizeStoryDeckSpec({
            version: helpers.STORY_DECK_SPEC_VERSION || 1,
            catalogVersion: parsed.catalogVersion,
            ruleSetId: parsed.ruleSetId,
            cards
        });
    }

    function safeDecodeStoryDeckCode(deckCode: unknown): { ok: boolean; deckSpec: unknown | null; error: DeckCodeError | null } {
        try {
            return { ok: true, deckSpec: decodeStoryDeckCode(deckCode), error: null };
        } catch (error) {
            return { ok: false, deckSpec: null, error: error as DeckCodeError };
        }
    }

    return {
        CODEC_VERSION,
        createStoryDeckCodeError,
        encodeStoryDeckSpec,
        decodeStoryDeckCode,
        safeDecodeStoryDeckCode
    };
}));
