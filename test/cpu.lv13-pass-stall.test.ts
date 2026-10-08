import {searchLv13} from '../game/ai/cpu-lv13-search';
import Core = require('../game/logic/core');
const fixture=require('./fixtures/cpu-lv13-pass-stall.json');

// Black has no stones and neither side can place. Under the old rule a second pass did
// not count while the opponent held a usable card, and two CPUs once passed for hundreds
// of turns. Since 2026-10-08 the second pass always ends the game (01-rulebook.md 8.2),
// so here White's pass is a terminal win (33-0) and the searcher takes it.
test('after the opponent passes, the second pass ends the game and a winning side takes it',()=>{
    const before=JSON.stringify(fixture.observation);
    const gameState=fixture.observation.gameState;
    expect(gameState.consecutivePasses).toBe(1);
    expect(Core.isGameOver(gameState)).toBe(false);
    expect(Core.isGameOver(Core.applyPass(gameState))).toBe(true);
    const discs=gameState.board.flat();
    expect(discs.filter((value:number)=>value===Core.WHITE).length).toBeGreaterThan(discs.filter((value:number)=>value===Core.BLACK).length);

    const result=searchLv13(fixture.observation,{publicRecipes:fixture.publicRecipes,maxTransitions:2048});
    expect(result.action?.type).toBe('pass');
    expect(JSON.stringify(fixture.observation)).toBe(before);
},120000);
