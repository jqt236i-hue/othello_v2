"use strict";
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./story-deck-spec'));
    }
    else {
        root.StoryDeckCodecModule = factory(root.StoryDeckSpecHelpers);
    }
}(typeof self !== 'undefined' ? self : this, function (StoryDeckSpecHelpers) {
    'use strict';
    const CODEC_VERSION = 1;
    function createStoryDeckCodeError(code, message, details) {
        const error = new Error(String(message || code || 'STORY_DECK_CODE_ERROR'));
        error.code = String(code || 'STORY_DECK_CODE_ERROR');
        if (typeof details !== 'undefined') {
            error.details = details;
        }
        return error;
    }
    function ensureStoryDeckSpecHelpers() {
        if (!StoryDeckSpecHelpers ||
            typeof StoryDeckSpecHelpers.normalizeStoryDeckSpec !== 'function') {
            throw createStoryDeckCodeError('STORY_DECK_SPEC_HELPERS_MISSING', 'StoryDeckSpecHelpers が読み込まれていません');
        }
        return StoryDeckSpecHelpers;
    }
    function getDeckCodeHeader(deckSpec) {
        const helpers = ensureStoryDeckSpecHelpers();
        const spec = deckSpec;
        const catalogVersion = Number(spec && spec.catalogVersion) || helpers.getCatalogVersion();
        const ruleSetId = String(spec && spec.ruleSetId || helpers.DEFAULT_RULE_SET_ID || '').trim();
        return `SD${CODEC_VERSION}C${catalogVersion}R${ruleSetId}:`;
    }
    function encodeStoryDeckSpec(deckSpec) {
        const helpers = ensureStoryDeckSpecHelpers();
        const normalized = helpers.normalizeStoryDeckSpec(deckSpec);
        const body = normalized.cards
            .map((entry) => `${entry.cardId}${entry.count > 1 ? `*${entry.count}` : ''}`)
            .join('.');
        return `${getDeckCodeHeader(normalized)}${body}`;
    }
    function parseStoryDeckCode(deckCode) {
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
    function decodeStoryDeckCode(deckCode) {
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
    function safeDecodeStoryDeckCode(deckCode) {
        try {
            return { ok: true, deckSpec: decodeStoryDeckCode(deckCode), error: null };
        }
        catch (error) {
            return { ok: false, deckSpec: null, error: error };
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
//# sourceMappingURL=story-deck-codec.js.map