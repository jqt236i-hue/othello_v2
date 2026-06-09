(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.SpecialCardRegistry = factory();
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function () {
    'use strict';

    const INVIOLABLE_SPECIAL_CARD_IDS = Object.freeze([
        'theory_incarnation_01',
        'board_executor_01',
        'observer_will_01'
    ]);
    const INVIOLABLE_SPECIAL_CARD_ID_SET: ReadonlySet<string> = new Set(INVIOLABLE_SPECIAL_CARD_IDS);
    const SPECIAL_CARD_PRESENTATION_BY_ID: Readonly<Record<string, any>> = Object.freeze({
        theory_incarnation_01: Object.freeze({
            cardId: 'theory_incarnation_01',
            markerType: 'THEORY_INCARNATION',
            displayName: '理論の化身',
            cinematicKey: 'theory_incarnation',
            quote: '盤上の全ては、我が理論の内に収束する',
            quoteLines: Object.freeze([
                '盤上の全ては、',
                '我が理論の内に収束する'
            ]),
            manifestBackgroundKey: 'theory_incarnation_world',
            manifestBackgroundImage: 'assets/images/background/manifest-worlds/理論の世界.png',
            characterImage: 'assets/images/special-cards/characters/theory_incarnation.png',
            manifestBgmKey: 'theory_incarnation_path',
            manifestBgmTrack: Object.freeze({
                name: '理論の道',
                file: 'assets/audio/bgm/manifest-stones/理論の道-BPM135.mp3',
                loopStart: 0,
                loopEnd: 28.444444
            })
        }),
        board_executor_01: Object.freeze({
            cardId: 'board_executor_01',
            markerType: 'BOARD_EXECUTOR',
            displayName: '盤界の執行者',
            cinematicKey: 'board_executor',
            quote: '盤界の名において執行する。彷徨える魂よ、今ここに収束せよ',
            quoteLines: Object.freeze([
                '盤界の名において執行する。',
                '彷徨える魂よ、今ここに収束せよ'
            ]),
            manifestBackgroundKey: 'board_executor_world',
            manifestBackgroundImage: 'assets/images/background/manifest-worlds/執行の世界.png',
            characterImage: 'assets/images/special-cards/characters/board_executor.png',
            manifestBgmKey: 'board_executor_path',
            manifestBgmTrack: Object.freeze({
                name: '執行の道',
                file: 'assets/audio/bgm/manifest-stones/執行の道-bpm150.mp3',
                loopStart: 0,
                loopEnd: 51.2
            })
        }),
        observer_will_01: Object.freeze({
            cardId: 'observer_will_01',
            markerType: 'OBSERVER_WILL',
            displayName: '盤理の観測者',
            cinematicKey: 'observer_will',
            quote: '我が観測をもって、悲しき輪廻に新たな一手を示そう',
            quoteLines: Object.freeze([
                '我が観測をもって、悲しき',
                '輪廻に新たな一手を示そう'
            ]),
            manifestBackgroundKey: 'observer_will_world',
            manifestBackgroundImage: 'assets/images/background/manifest-worlds/観測の世界.png',
            characterImage: 'assets/images/special-cards/characters/observer_will.png',
            manifestBgmKey: 'observer_will_path',
            manifestBgmTrack: Object.freeze({
                name: '観測の道',
                file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3',
                loopStart: 9.6,
                loopEnd: 62.4
            })
        })
    });
    const SPECIAL_CARD_ID_BY_MARKER_TYPE: Readonly<Record<string, string>> = Object.freeze(
        Object.fromEntries(Object.entries(SPECIAL_CARD_PRESENTATION_BY_ID).map(([cardId, meta]: [string, any]) => [
            String(meta.markerType || '').toUpperCase(),
            cardId
        ]))
    );

    function normalizeCardId(cardId: unknown): string {
        return typeof cardId === 'string' ? cardId.trim() : '';
    }

    function getInviolableSpecialCardIds(): string[] {
        return INVIOLABLE_SPECIAL_CARD_IDS.slice();
    }

    function isInviolableSpecialCardId(cardId: unknown): boolean {
        const normalized = normalizeCardId(cardId);
        return !!normalized && INVIOLABLE_SPECIAL_CARD_ID_SET.has(normalized);
    }

    function clonePresentationMetadata(meta: any): any {
        if (!meta || typeof meta !== 'object') return null;
        const cloned = Object.assign({}, meta);
        if (meta.manifestBgmTrack && typeof meta.manifestBgmTrack === 'object') {
            cloned.manifestBgmTrack = Object.assign({}, meta.manifestBgmTrack);
        }
        return cloned;
    }

    function getSpecialCardPresentation(cardId: unknown): any {
        const normalized = normalizeCardId(cardId);
        if (!normalized) return null;
        return clonePresentationMetadata(SPECIAL_CARD_PRESENTATION_BY_ID[normalized]);
    }

    function getSpecialCardPresentationByMarkerType(markerType: unknown): any {
        const type = typeof markerType === 'string' ? markerType.trim().toUpperCase() : '';
        if (!type) return null;
        const cardId = SPECIAL_CARD_ID_BY_MARKER_TYPE[type];
        return cardId ? clonePresentationMetadata(SPECIAL_CARD_PRESENTATION_BY_ID[cardId]) : null;
    }

    return Object.freeze({
        getInviolableSpecialCardIds,
        getSpecialCardPresentation,
        getSpecialCardPresentationByMarkerType,
        isInviolableSpecialCardId
    });
}));

export {};
