import CardLogic = require('../game/logic/cards');
import Core = require('../game/logic/core');
import TurnPipeline = require('../game/turn/turn_pipeline');
import Adapter = require('../game/turn/pipeline_ui_adapter');
import Factory = require('../game/logic/card-resolution/special-stone-marker-factory');
import Registry = require('../shared/special-stone-registry-static');
import Shared = require('../shared-constants');
import { playPixiTheoryIncarnationEffect } from '../ui/pixi/effects/theory-incarnation';
import { REINCARNATION_ROULETTE_DELAYS_MS, reincarnationStepAt } from '../constants/reincarnation-animation';

function setup(owner = 'black') {
    const prng = { random: () => 0, shuffle: (items: any[]) => items };
    const cardState: any = CardLogic.createCardState(prng);
    const gameState: any = Core.createGameState();
    cardState.hands[owner] = ['reincarnation_will_01'];
    cardState.charge[owner] = 20;
    const row = 3, col = owner === 'black' ? 4 : 3;
    const marker = CardLogic.addMarker(cardState, 'specialStone', row, col, owner, { type: 'GHOST', remainingOwnerTurns: 1 });
    gameState.currentPlayer = owner === 'black' ? Shared.BLACK : Shared.WHITE;
    return { cardState, gameState, prng, row, col, marker, owner };
}

function use(s: any) {
    expect(CardLogic.applyCardUsage(s.cardState, s.gameState, s.owner, 'reincarnation_will_01', null, { prng: s.prng })).toBe(true);
}

function chooseType(type: string) {
    const candidates = Factory.buildTheoryIncarnationSpawnTable(Shared.CARD_DEFS, { SpecialStoneRegistry: Registry })
        .filter((entry: any) => entry.markerData.type !== 'GHOST');
    const index = candidates.findIndex((entry: any) => entry.markerData.type === type);
    expect(index).toBeGreaterThanOrEqual(0);
    return { random: () => (index + 0.1) / candidates.length };
}

describe('転生の意志', () => {
    test('コスト7、対象なし・布石不足なら消費しない', () => {
        const s = setup();
        s.cardState.markers = [];
        expect(CardLogic.getReincarnationTargets(s.cardState, s.gameState, 'black')).toEqual([]);
        expect(CardLogic.applyCardUsage(s.cardState, s.gameState, 'black', 'reincarnation_will_01')).toBe(false);
        expect(s.cardState.charge.black).toBe(20);
        expect(s.cardState.hands.black).toEqual(['reincarnation_will_01']);
        const poor = setup(); poor.cardState.charge.black = 6;
        expect(CardLogic.applyCardUsage(poor.cardState, poor.gameState, 'black', 'reincarnation_will_01')).toBe(false);
    });

    test.each(['black', 'white'])('自分の特殊石だけをその場で別種へ変換し、通常配置を続ける: %s', (owner) => {
        const s = setup(owner);
        CardLogic.addMarker(s.cardState, 'specialStone', s.row, s.col, owner, { type: 'GUARD', destroyEvadeRemaining: 2 });
        const boardBefore = JSON.stringify(s.gameState.board);
        use(s);
        expect(s.cardState.charge[owner]).toBe(13);
        expect(CardLogic.getSelectableTargets(s.cardState, s.gameState, owner)).toEqual([{ row: s.row, col: s.col }]);
        const invalid = CardLogic.applyReincarnationWill(s.cardState, s.gameState, owner, 4, 4, s.prng);
        expect(invalid.applied).toBe(false);
        expect(s.cardState.pendingEffectByPlayer[owner]).toBeTruthy();
        const result = TurnPipeline.applyTurn(s.cardState, s.gameState, owner, { type: 'place', reincarnationTarget: { row: s.row, col: s.col } }, chooseType('PERMA_PROTECTED'), { skipTurnStart: true });
        expect(result).toBeTruthy();
        expect(JSON.stringify(s.gameState.board)).toBe(boardBefore);
        expect(s.gameState.currentPlayer).toBe(owner === 'black' ? Shared.BLACK : Shared.WHITE);
        expect(s.cardState.pendingEffectByPlayer[owner]).toBeNull();
        expect(s.cardState.markers.some((m: any) => m.id === s.marker.id)).toBe(false);
        expect(s.cardState.markers.some((m: any) => m.data.type === 'GUARD')).toBe(true);
        const events = Adapter.mapToPlaybackEvents(result.presentationEvents, s.cardState, s.gameState);
        const roulette = events.find((e: any) => e.targets?.some((t: any) => t.reincarnation));
        expect(roulette.targets[0].before.special).toBe('GHOST');
        expect(roulette.targets[0].after.special).not.toBe('GHOST');
        expect(roulette.targets[0].previewStates.every((state: any) => !['GHOST', 'TRAP', 'TIME_BOMB'].includes(state.special))).toBe(true);
        const withSounds = Adapter.appendSoundEffectPlaybackEvents(events, result.events || []);
        const sounds = withSounds.filter((e: any) => e.type === 'sound_effect').flatMap((e: any) => e.targets.map((t: any) => t.soundKey));
        expect(sounds.filter((key: string) => key === 'reincarnation_will')).toHaveLength(1);
        expect(sounds).not.toContain('theory_incarnation_spawn');
    });

    test('通常石・付与状態だけの石・敵石・不可侵・顕現石を選べない', () => {
        const s = setup();
        s.cardState.markers = [];
        CardLogic.addMarker(s.cardState, 'specialStone', 3, 4, 'black', { type: 'GUARD' });
        CardLogic.addMarker(s.cardState, 'specialStone', 4, 4, 'white', { type: 'DRAGON' });
        CardLogic.addMarker(s.cardState, 'manifestStone', 4, 3, 'black', { type: 'THEORY_INCARNATION' });
        expect(CardLogic.getReincarnationTargets(s.cardState, s.gameState, 'black')).toEqual([]);
    });

    test.each(['TRAP', 'TIME_BOMB'])('自分の%sからも転生でき、元の罠・爆弾は残らない', (type) => {
        const s = setup(); s.cardState.markers = [];
        CardLogic.addMarker(s.cardState, 'specialStone', s.row, s.col, 'black', { type, hidden: true, remainingTurns: 3 });
        use(s);
        const result = CardLogic.applyReincarnationWill(s.cardState, s.gameState, 'black', s.row, s.col, s.prng);
        expect(result.applied).toBe(true);
        expect(s.cardState.markers.some((marker: any) => marker.data.type === type)).toBe(false);
        expect(['TRAP', 'TIME_BOMB']).not.toContain(result.type);
    });

    test('理論と同じ初期値で転生し、登場直後のドラゴン効果は確定演出後のphaseに出る', () => {
        const s = setup(); use(s);
        const candidates = Factory.buildTheoryIncarnationSpawnTable(Shared.CARD_DEFS, { SpecialStoneRegistry: Registry })
            .filter((entry: any) => entry.markerData.type !== 'GHOST');
        const index = candidates.findIndex((entry: any) => entry.markerData.type === 'DRAGON');
        expect(index).toBeGreaterThanOrEqual(0);
        const rng = { random: () => (index + 0.1) / candidates.length };
        const result = TurnPipeline.applyTurn(s.cardState, s.gameState, 'black', { type: 'place', reincarnationTarget: { row: 3, col: 4 } }, rng, { skipTurnStart: true });
        const marker = s.cardState.markers.find((m: any) => m.row === 3 && m.col === 4 && m.data.type === 'DRAGON');
        expect(marker.data.remainingOwnerTurns).toBeGreaterThan(1);
        expect(s.gameState.board[3][3]).toBe(Shared.BLACK);
        const events = Adapter.mapToPlaybackEvents(result.presentationEvents, s.cardState, s.gameState);
        const roulette = events.find((event: any) => event.targets?.some((target: any) => target.reincarnation));
        const flips = events.filter((event: any) => event.type === 'flip');
        expect(flips.length).toBeGreaterThan(0);
        expect(flips.every((event: any) => event.phase > roulette.phase)).toBe(true);
        expect(roulette.targets[0].after.special).toBe('DRAGON');
    });

    test('同じ乱数入力のリプレイは転生先と候補表示順も一致する', () => {
        const a = setup(), b = setup(); use(a); use(b);
        const one = CardLogic.applyReincarnationWill(a.cardState, a.gameState, 'black', a.row, a.col, a.prng);
        const two = CardLogic.applyReincarnationWill(b.cardState, b.gameState, 'black', b.row, b.col, b.prng);
        expect(one).toEqual(two);
        expect(a.cardState.markers).toEqual(b.cardState.markers);
        expect(a.cardState.presentationEvents).toEqual(b.cardState.presentationEvents);
    });
});

test('音源の切替境界を通り、2.5秒で最終石を表示して演出資源を解放する', async () => {
    expect(REINCARNATION_ROULETTE_DELAYS_MS.reduce((sum, ms) => sum + ms, 0)).toBe(2500);
    expect(reincarnationStepAt(62)).toBe(0);
    expect(reincarnationStepAt(62.5)).toBe(1);
    expect(reincarnationStepAt(2375)).toBe(19);
    const target: any = {
        row: 3, col: 4, owner: 'black', reincarnation: true,
        before: { color: 1, special: 'GHOST' }, after: { color: 1, special: 'DRAGON' },
        previewStates: [{ color: 1, special: 'WORK' }, { color: 1, special: 'SNIPER' }]
    };
    const seen: any[] = [];
    const projection: any = {
        acquireEffect: jest.fn(() => ({ id: 1 })), updateEffect: jest.fn(), releaseEffect: jest.fn(),
        setProjectedStone: jest.fn((_r, _c, visual) => seen.push(visual.stone.specialType)),
        timeline: { run: jest.fn(async (opts: any) => {
            opts.onStart?.();
            if (opts.effectFamily === 'reincarnation-roulette') {
                for (const ms of [0, 62.5, 2499, 2500]) opts.onUpdate(ms / 2500, { elapsedMs: ms, noAnimation: false });
                expect(seen[seen.length - 1]).toBe('DRAGON');
                expect(seen.slice(0, -1)).not.toContain('DRAGON');
            } else opts.onUpdate(1, { elapsedMs: 1800 });
        }) }
    };
    await playPixiTheoryIncarnationEffect({ type: 'theory_incarnation_spawn_roulette', targets: [target] } as any, projection);
    expect(seen).toEqual(['GHOST', 'WORK', 'SNIPER', 'SNIPER', 'DRAGON', 'DRAGON']);
    expect(projection.releaseEffect).toHaveBeenCalledWith({ id: 1 });
});
