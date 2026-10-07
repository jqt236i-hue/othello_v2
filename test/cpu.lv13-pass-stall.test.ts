import {searchLv13} from '../game/ai/cpu-lv13-search';
import Core = require('../game/logic/core');
import * as CardLogic from '../game/logic/cards.js';
const fixture=require('./fixtures/cpu-lv13-pass-stall.json');

// Black has no stones and neither side can place. When the opponent still has a
// usable card after a no-action pass, a second pass does not count (01-rulebook.md 8.2),
// and two CPUs once passed for hundreds of turns. The searcher must spend a card
// instead of passing again.
function cloneObservation(){
    return JSON.parse(JSON.stringify(fixture.observation));
}

test('after the opponent passes, a pass that does not end the game is replaced by a card turn',()=>{
    const observation=cloneObservation();
    // 黒の手札を、合法手が無くても使える対象選択カードにして「相手に行動が残る」状況を作る。
    observation.cardState.hands.black[0]='destroy_01';
    expect(observation.gameState.consecutivePasses).toBe(1);
    expect(Core.isGameOver(observation.gameState)).toBe(false);
    expect(CardLogic.hasUsableCard(observation.cardState,{...observation.gameState,currentPlayer:1},'black')).toBe(true);
    const before=JSON.stringify(observation);
    const result=searchLv13(observation,{publicRecipes:fixture.publicRecipes,maxTransitions:2048});
    // 手札破壊は同じ手番内の自由行動なので、カード使用の前に挟まってもよい。パスで終える案は選ばない。
    expect(['use_card','destroy_hand_card']).toContain(result.action?.type);
    expect(result.candidates!.every(candidate=>[candidate.action,...candidate.continuation]
        .some((action:any)=>action.type==='use_card'))).toBe(true);
    expect(JSON.stringify(observation)).toBe(before);
},120000);

test('when the opponent cannot act at all, passing ends the game and is allowed',()=>{
    // 元の局面: 黒の手札は配置依存カードだけなので、合法手が無い黒は何も使えず、白のパスで終局する。
    const observation=cloneObservation();
    expect(CardLogic.hasUsableCard(observation.cardState,{...observation.gameState,currentPlayer:1},'black')).toBe(false);
    const before=JSON.stringify(observation);
    const result=searchLv13(observation,{publicRecipes:fixture.publicRecipes,maxTransitions:2048});
    expect(result.action).toBeTruthy();
    expect(JSON.stringify(observation)).toBe(before);
},120000);
