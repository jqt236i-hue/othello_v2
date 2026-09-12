import {makeLv10Conditions,summarizeLv10Pairs,verifyLv10StartingConditions} from '../scripts/run-cpu-lv10-evaluation';

test('both seats must actually start with the frozen perks and complete deck, independent of deal order',()=>{
    const conditions={initialCharge:99,chargeGainMultiplier:2,cardUseUnlockTurnNumber:6,deckCardIds:['hard_01','gold_stone']};
    const state={game:{turnNumber:0,currentPlayer:1,consecutivePasses:0},card:{charge:{black:99,white:99},
        chargeGainMultiplierByPlayer:{black:2,white:2},decks:{black:['hard_01'],white:['gold_stone','hard_01']},hands:{black:['gold_stone'],white:[]}}};
    expect(()=>verifyLv10StartingConditions(state,conditions)).not.toThrow();
    expect(()=>verifyLv10StartingConditions({},conditions)).toThrow('Invalid opening');
    state.card.charge.white=0;
    expect(()=>verifyLv10StartingConditions(state,conditions)).toThrow('Starting perks/deck');
    state.card.charge.white=99;state.card.decks.white=['hard_01'];
    expect(()=>verifyLv10StartingConditions(state,conditions)).toThrow('Starting perks/deck');
});

test('conditions are reproducible, unique and separated by declaration label',()=>{
    const a=makeLv10Conditions('development-a',200),b=makeLv10Conditions('held-out-b',200);
    expect(a).toEqual(makeLv10Conditions('development-a',200));
    expect(new Set(a.map(c=>c.seed)).size).toBe(200);
    expect(a.some(c=>b.some(d=>d.seed===c.seed))).toBe(false);
});

test('both colors of a pair are resampled together and the final gate requires 400 games',()=>{
    const conditions=makeLv10Conditions('test',200);
    const games=conditions.flatMap(c=>(['black','white'] as const).map(color=>({pair:c.pair,color,score:c.pair<=140?1:0})));
    const result=summarizeLv10Pairs(conditions,games);
    expect(result).toMatchObject({games:400,wins:280,draws:0,losses:120,score:.7,meetsFinalGate:true});
    expect(result.confidence95[0]).toBeGreaterThan(.62);
    expect(result.confidence95[0]).toBeLessThan(.65);
    expect(result.black.score).toBe(.7);
    expect(result.white.score).toBe(.7);
    expect(summarizeLv10Pairs(conditions.slice(0,8),games.slice(0,16)).meetsFinalGate).toBe(false);
});

test('draws count as half a point; missing or duplicate paired games cannot pass',()=>{
    const conditions=makeLv10Conditions('draws',2);
    const games=conditions.flatMap(c=>(['black','white'] as const).map(color=>({pair:c.pair,color,score:color==='black'?1:.5})));
    const result=summarizeLv10Pairs(conditions,games);
    expect(result).toMatchObject({wins:2,draws:2,score:.75,meetsFinalGate:false});
    expect(()=>summarizeLv10Pairs(conditions,games.slice(1))).toThrow('Incomplete');
    expect(()=>summarizeLv10Pairs(conditions,[...games.slice(0,3),games[0]])).toThrow('duplicate');
});
