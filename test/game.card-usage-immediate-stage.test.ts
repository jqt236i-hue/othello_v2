import * as fs from 'fs';
import * as path from 'path';
import * as CardUsageImmediateStage from '../game/cards/card-usage-immediate-stage';

describe('card usage immediate stage', () => {
    test.each([
        ['THEORY_INCARNATION', 'applyTheoryIncarnationUsage'],
        ['CHAOS_SUMMON', 'applyChaosSummonUsage'],
        ['BOARD_EXECUTOR', 'applyBoardExecutorUsage']
    ])('preserves %s success and failure output', (cardType, methodName) => {
        const apply = jest.fn(() => ({ applied: true, cardType }));
        const options: any = {
            cardState: {}, gameState: {}, playerKey: 'black', cardType, prng: { random: () => 0 }, [methodName]: apply
        };
        expect(CardUsageImmediateStage.applyImmediateCardUsage(options)).toEqual({ handled: true, ok: true, result: { applied: true, cardType } });
        expect(apply).toHaveBeenCalledWith(options.cardState, options.gameState, 'black', options.prng);
        apply.mockReturnValueOnce({ applied: false });
        expect(CardUsageImmediateStage.applyImmediateCardUsage(options)).toEqual({ handled: true, ok: false, result: { applied: false } });
    });

    test('leaves unrelated card types untouched', () => {
        expect(CardUsageImmediateStage.applyImmediateCardUsage({
            cardState: {}, gameState: {}, playerKey: 'black', cardType: 'WORK_WILL', prng: null
        })).toEqual({ handled: false, ok: true });
    });

    test('keeps the effect resolver free of immediate mutation bodies', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'cards', 'effect-resolver.ts'), 'utf8');
        expect(source).toContain('CardUsageImmediateStage.applyImmediateCardUsage({');
        expect(source).not.toContain('const theoryRes = applyTheoryIncarnationUsage(');
        expect(source).not.toContain('const chaosRes = applyChaosSummonUsage(');
    });
});
