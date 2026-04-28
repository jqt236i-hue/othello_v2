"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const phaseHelpers = __importStar(require("../game/turn/turn_pipeline_phase_helpers.js"));
describe('turn_pipeline_phase_helpers special stone speech catalog', () => {
    test('preserves OBSERVER and WORK speech exactly', () => {
        expect(phaseHelpers.getSpecialStoneBubbleSpeech('OBSERVER')).toEqual({
            placeLines: [
                '今日も観測しますかっと',
                '盤理は観測するためにある',
                '観測最高！'
            ],
            lostLine: '盤理観測してる場合じゃなかったわ',
            living_will_restored: [
                '観測再開っと、まだ盤理は追える。',
                '消えかけたけど、観測ログは続行だよ。',
                '戻った戻った、まだ盤面を見てるからね。'
            ]
        });
        expect(phaseHelpers.getSpecialStoneBubbleSpeech('WORK')).toEqual({
            placeLines: [
                'ここで稼いで一発逆転や！',
                '布石いっぱい掘るでー！',
                'ワイには夢があるんや！',
                '一攫千金や！'
            ],
            lostLine: 'あああああああああああああ',
            living_will_restored: [
                'まだ稼げる！ ここから巻き返しや！',
                '持ち直したで！ もうひと掘りや！',
                '危なかったわ、でもまだ働けるで！'
            ],
            incomeLinesByStep: {
                1: '布石＋1 初儲けや！',
                2: '布石＋2 もっと掘るでー！',
                3: '布石＋4 順調やな！',
                4: '布石＋8 ぼろ儲けや！',
                5: '布石＋16 これで家族が養える...！'
            }
        });
    });
    test('exposes required scenario keys and scenario-based lookup helpers', () => {
        expect(phaseHelpers.SPECIAL_STONE_BUBBLE_SCENARIO_KEYS).toEqual(expect.arrayContaining([
            'place',
            'destroy',
            'duration_end',
            'proliferation_triggered',
            'time_stop_triggered',
            'regen_triggered',
            'ghost_protected',
            'inherit_selected',
            'inherit_applied',
            'escape_exploded',
            'absolute_protected_promoted',
            'special_destroy_triggered',
            'living_will_restored'
        ]));
        const gluttonousPlaceLines = phaseHelpers.getSpecialStoneBubbleSpeechLines('GLUTTONOUS', 'place');
        expect(gluttonousPlaceLines).toHaveLength(5);
        expect(gluttonousPlaceLines).toContain('いっぱい食べる俺が好き');
        expect(phaseHelpers.pickSpecialStoneBubbleSpeechLine('GLUTTONOUS', 'place', { random: () => 0 })).toBe('いっぱい食べる俺が好き');
        const ghostProtectedLines = phaseHelpers.getSpecialStoneBubbleSpeech('GHOST', 'ghost_protected');
        expect(ghostProtectedLines).toHaveLength(5);
        expect(ghostProtectedLines[0]).toBe('当たってないよ。');
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ESCAPE_HYPERACTIVE', 'place')).toEqual([
            '近寄らないで！ 私、逃げるから！',
            '生き残るためなら何だってするよ！',
            '追われる前に走るのが一番だよ！',
            'ここから先は逃走劇だよ！',
            '捕まるわけにはいかないの！'
        ]);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ESCAPE_HYPERACTIVE', 'destroy')).toEqual([
            '逃げ損ねるなんて、やっぱり悔しいよ…！',
            '囲まれると、さすがに怖いよ…！',
            '足場を奪われた時点で負けだったよ！',
            '追手が多すぎるってば！',
            '今回の逃走はここまでみたい…！'
        ]);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ESCAPE_HYPERACTIVE', 'escape_exploded')).toEqual([
            '行き場がないなら、もう吹き飛ぶしかないよ！',
            '逃げ道なしなら、景気よく爆ぜるね！',
            '追い詰めたつもりでも、巻き添えだからね！',
            'もう無理！ 派手に散ってやるんだから！',
            '捕まるくらいなら盤ごと荒らしちゃうよ！'
        ]);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('INHERITED_HYPERACTIVE', 'inherit_selected')).toHaveLength(5);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('INHERITED_HYPERACTIVE', 'inherit_applied')).toHaveLength(5);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('PROLIFERATION', 'proliferation_triggered')).toHaveLength(5);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('WILL_HUNTER_KING', 'special_destroy_triggered')).toHaveLength(5);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ESCAPE_HYPERACTIVE', 'escape_exploded')).toHaveLength(5);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('ABSOLUTE_PROTECTED', 'absolute_protected_promoted')).toHaveLength(5);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('DRAGON', 'living_will_restored')).toHaveLength(5);
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('OBSERVER', 'living_will_restored')).toEqual([
            '観測再開っと、まだ盤理は追える。',
            '消えかけたけど、観測ログは続行だよ。',
            '戻った戻った、まだ盤面を見てるからね。'
        ]);
    });
    test('keeps excluded stones and unsupported scenarios out of the catalog', () => {
        expect(phaseHelpers.getSpecialStoneBubbleSpeech('GOLD')).toBeNull();
        expect(phaseHelpers.getSpecialStoneBubbleSpeech('TRAP')).toBeNull();
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('GLUTTONOUS', 'duration_end')).toBeNull();
        expect(phaseHelpers.getSpecialStoneBubbleSpeechLines('OBSERVER', 'duration_end')).toBeNull();
    });
});
//# sourceMappingURL=game.turn-pipeline-phase-helpers.special-stone-speech.test.js.map