import {collectLv10Evaluation,makeLv10Conditions,runLv10Evaluation,summarizeLv10Pairs,verifyLv10StartingConditions} from '../scripts/run-cpu-lv10-evaluation';
import {FROZEN_LV9_MODEL_SETTINGS} from '../scripts/cpu-lv10-frozen-oracle';
import fs = require('node:fs');
import os = require('node:os');
import path = require('node:path');
import crypto = require('node:crypto');
import zlib = require('node:zlib');

test('a saved stop request prevents new games without creating a fake game failure or allowing automatic resume',async()=>{
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lv10-validation-test-'));
    try {
        fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify({mode:'final',conditions:[{pair:1,seed:123}],
            schedule:[{pair:1,seed:123,color:'black'},{pair:1,seed:123,color:'white'}],protocol:{concurrency:2}}));
        fs.writeFileSync(path.join(directory,'stop-request.json'),JSON.stringify({reason:'retired for improvement'}));
        const result=await runLv10Evaluation(directory);
        expect(result).toMatchObject({valid:false,completed:0,expected:2,errors:[],stopRequested:true,acceptanceEligible:false,result:null});
        expect(result.pending).toHaveLength(2);
        expect(fs.existsSync(path.join(directory,'stop-acknowledged.json'))).toBe(true);
        expect(await runLv10Evaluation(directory)).toEqual(result);
    } finally {
        if(path.dirname(directory)!==path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('lv10-validation-test-'))throw new Error('Invalid test cleanup path');
        fs.rmSync(directory,{recursive:true,force:true});
    }
});

test('a pre-launch failure is recorded against its condition and cannot be automatically retried',async()=>{
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lv10-validation-test-'));
    try {
        fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify({mode:'development',conditions:[{pair:1,seed:123}],
            schedule:[{pair:1,seed:123,color:'black'},{pair:1,seed:123,color:'white'}],
            protocol:{concurrency:1,minimumFreeMemoryBytes:Number.MAX_SAFE_INTEGER}}));
        await expect(runLv10Evaluation(directory)).rejects.toThrow('Free memory');
        expect(JSON.parse(fs.readFileSync(path.join(directory,'game-123-black.error.json'),'utf8')))
            .toMatchObject({pair:1,seed:123,color:'black',phase:'evaluation-host'});
        expect(collectLv10Evaluation(directory)).toMatchObject({valid:false,completed:0,expected:2});
        await expect(runLv10Evaluation(directory)).rejects.toThrow('automatic retries are disabled');
    } finally {
        if(path.dirname(directory)!==path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('lv10-validation-test-'))throw new Error('Invalid test cleanup path');
        fs.rmSync(directory,{recursive:true,force:true});
    }
});

test('progress caching preserves results and rechecks changed traces; final collection reads all files',()=>{
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lv10-validation-test-'));
    const hash=(bytes:Buffer)=>crypto.createHash('sha256').update(bytes).digest('hex');
    const initialState=JSON.stringify({game:{turnNumber:0,currentPlayer:1,consecutivePasses:0},card:{
        charge:{black:99,white:99},chargeGainMultiplierByPlayer:{black:2,white:2},
        decks:{black:['hard_01'],white:['hard_01']},hands:{black:[],white:[]}}});
    const conditions=Array.from({length:200},(_,i)=>({pair:i+1,seed:123+i})),schedule=conditions.flatMap(c=>['black','white'].map(color=>({...c,color})));
    try {
        fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify({mode:'final',label:'cache-test',conditions,schedule,
            baselineSha256:'fixture',search:{version:'fixture',maxTransitions:10},gameConditions:{initialCharge:99,
                chargeGainMultiplier:2,cardUseUnlockTurnNumber:6,deckCardIds:['hard_01']}}));
        for(const game of schedule) {
            const prefix=path.join(directory,`game-${game.seed}-${game.color}`);
            const bytes=zlib.gzipSync(JSON.stringify({initialState,audit:{records:[],gameOver:true,counts:game.color==='black'?{black:2,white:1}:{black:1,white:2},
                frozenOpponent:{baselineSha256:'fixture',answers:[{model:{...FROZEN_LV9_MODEL_SETTINGS,loaded:true,lastError:null}}]},
                lv10:{totals:{decisions:1},historyComplete:true,history:[{search:{version:'fixture',transitions:1}}]}}}));
            fs.writeFileSync(`${prefix}.json.gz`,bytes);
            fs.writeFileSync(`${prefix}.summary.json`,JSON.stringify({traceSha256:hash(bytes),rejections:[],pageErrors:[],durationMs:1}));
        }
        const cache=new Map(),first=collectLv10Evaluation(directory,cache);
        expect(first.valid).toBe(true);
        expect(cache.size).toBe(400);
        expect(first.result).toMatchObject({wins:400,meetsFinalGate:true});
        expect(collectLv10Evaluation(directory,cache)).toEqual(first);
        expect(collectLv10Evaluation(directory)).toEqual(first);
        const stopPath=path.join(directory,'stop-request.json');
        fs.writeFileSync(stopPath,JSON.stringify({reason:'explicit stop'}));
        expect(collectLv10Evaluation(directory,cache)).toMatchObject({valid:true,completed:400,stopRequested:true,acceptanceEligible:false,
            result:{wins:400,meetsFinalGate:false}});
        fs.unlinkSync(stopPath);
        const dispositionPath=path.join(directory,'disposition.json');
        fs.writeFileSync(dispositionPath,JSON.stringify({developmentOnly:true,reason:'used for improvement'}));
        const retired=collectLv10Evaluation(directory,cache);
        expect(retired).toMatchObject({valid:true,completed:400,mode:'development',declaredMode:'final',acceptanceEligible:false,
            result:{wins:400,winRate:1,meetsFinalGate:false}});
        expect(collectLv10Evaluation(directory)).toEqual(retired);
        fs.unlinkSync(dispositionPath);
        const summaryPath=path.join(directory,'game-123-black.summary.json'),summaryBytes=fs.readFileSync(summaryPath);
        fs.writeFileSync(summaryPath,JSON.stringify({...JSON.parse(summaryBytes.toString()),pageErrors:['uncaught exception']}));
        expect(()=>collectLv10Evaluation(directory,cache)).toThrow('Page exceptions');
        fs.writeFileSync(summaryPath,summaryBytes);
        fs.writeFileSync(path.join(directory,'game-123-black.json.gz'),'corrupted trace');
        expect(()=>collectLv10Evaluation(directory,cache)).toThrow();
        expect(()=>collectLv10Evaluation(directory)).toThrow();
    } finally {
        if(path.dirname(directory)!==path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('lv10-validation-test-'))throw new Error('Invalid test cleanup path');
        fs.rmSync(directory,{recursive:true,force:true});
    }
});

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
    expect(result).toMatchObject({games:400,wins:280,draws:0,losses:120,score:.7,winRate:.7,meetsFinalGate:false});
    expect(result.confidence95[0]).toBeGreaterThan(.62);
    expect(result.confidence95[0]).toBeLessThan(.65);
    expect(result.black.score).toBe(.7);
    expect(result.white.score).toBe(.7);
    expect(summarizeLv10Pairs(conditions.slice(0,8),games.slice(0,16)).meetsFinalGate).toBe(false);
});

test('the revised final gate requires at least 300 actual wins and does not substitute draw points',()=>{
    const conditions=makeLv10Conditions('strict-win-rate',200);
    const schedule=conditions.flatMap(c=>(['black','white'] as const).map(color=>({pair:c.pair,color})));
    const below=summarizeLv10Pairs(conditions,schedule.map((g,i)=>({...g,score:i<299?1:0})));
    expect(below).toMatchObject({wins:299,winRate:.7475,meetsFinalGate:false});
    const draws=summarizeLv10Pairs(conditions,schedule.map((g,i)=>({...g,score:i<299?1:.5})));
    expect(draws).toMatchObject({wins:299,draws:101,score:.87375,winRate:.7475,meetsFinalGate:false});
    const pass=summarizeLv10Pairs(conditions,schedule.map((g,i)=>({...g,score:i<300?1:0})));
    expect(pass).toMatchObject({wins:300,winRate:.75,meetsFinalGate:true});
    expect(pass.black.winRate).toBe(.75);
    expect(pass.white.winRate).toBe(.75);
    expect(pass.confidence95[0]).toBeGreaterThan(.5);
});

test('draws count as half a point; missing or duplicate paired games cannot pass',()=>{
    const conditions=makeLv10Conditions('draws',2);
    const games=conditions.flatMap(c=>(['black','white'] as const).map(color=>({pair:c.pair,color,score:color==='black'?1:.5})));
    const result=summarizeLv10Pairs(conditions,games);
    expect(result).toMatchObject({wins:2,draws:2,score:.75,winRate:.5,meetsFinalGate:false});
    expect(()=>summarizeLv10Pairs(conditions,games.slice(1))).toThrow('Incomplete');
    expect(()=>summarizeLv10Pairs(conditions,[...games.slice(0,3),games[0]])).toThrow('duplicate');
});
