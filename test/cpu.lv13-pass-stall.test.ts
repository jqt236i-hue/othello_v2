import {searchLv13} from '../game/ai/cpu-lv13-search';
import Core = require('../game/logic/core');
const fixture=require('./fixtures/cpu-lv13-pass-stall.json');

// Black has no stones and neither side can place. Both hold usable cards. Two CPUs once passed for
// hundreds of turns here. Since 2026-10-09 a second pass ends the game only when the player who passed
// first still cannot act (01-rulebook.md 8.2): Black passed without an action and can act now, so
// White's pass would hand the turn back. The searcher must spend a card instead of passing again.
test('after the opponent passes, a pass that does not end the game is replaced by a card turn',()=>{
    const before=JSON.stringify(fixture.observation);
    expect(fixture.observation.gameState.consecutivePasses).toBe(1);
    expect(fixture.observation.gameState.lastPassHadAction).toBeUndefined();
    expect(Core.isGameOver(fixture.observation.gameState)).toBe(false);
    const result=searchLv13(fixture.observation,{publicRecipes:fixture.publicRecipes,maxTransitions:2048});
    expect(result.action?.type).not.toBe('pass');
    expect(result.candidates!.every(candidate=>[candidate.action,...candidate.continuation]
        .some((action:any)=>action.type==='use_card'))).toBe(true);
    expect(JSON.stringify(fixture.observation)).toBe(before);
},120000);
