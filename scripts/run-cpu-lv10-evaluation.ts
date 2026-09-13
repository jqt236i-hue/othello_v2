#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import zlib = require('node:zlib');
import os = require('node:os');
import { LV10_SEARCH_CONFIG } from '../game/ai/cpu-lv10-search';
import { runLv10BrowserMatch } from './run-cpu-lv10-browser-match';
import { readFrozenLv9GameConditions,FROZEN_LV9_EXECUTION_LIMITS,FROZEN_LV9_MODEL_SETTINGS,verifyFrozenLv9ModelStatus } from './cpu-lv10-frozen-oracle';
import { verifyFrozenTransitionCoverage } from './cpu-lv10-frozen-verification';

type Color = 'black' | 'white';
type Condition = { pair: number; seed: number };
type GameScore = { pair: number; color: Color; score: number };
type ValidatedGame = { fingerprint:string; game:GameScore; detail:any; initialHash:string };
export type Lv10ValidationCache = Map<string,ValidatedGame>;
export const LV10_EVALUATION_PROTOCOL = Object.freeze({
    finalPairs: 50, finalGames: 100,
    acceptanceVersion: '2026-09-13-user-100-games-at-least-75-wins',
    minimumWinRate: .75,
    winRateDefinition: 'wins / all games; draws are not wins',
    confidence: 'paired percentile bootstrap, 20000 resamples, two-sided 95%',
    bootstrapSamples: 20000, bootstrapSeed: 10100493,
    concurrency: 2, timeoutMs: 1200000, noAcceptedActionTimeoutMs:60000, minimumFreeMemoryBytes: 2 * 1024 ** 3,
    frozenOpponent:{...FROZEN_LV9_EXECUTION_LIMITS,model:FROZEN_LV9_MODEL_SETTINGS},
    failurePolicy: 'Keep every trace and error. Any failed or unfinished game makes evaluation incomplete and ineligible for acceptance. No automatic retry or exclusion.'
});
const hash = (value: Buffer | string) => crypto.createHash('sha256').update(value).digest('hex');

export function verifyLv10StartingConditions(initial:any,conditions:ReturnType<typeof readFrozenLv9GameConditions>): void {
    // run-ui-level-match serializes the opening under game/card, whereas
    // individual action records use gameState/cardState.
    const cs=initial?.card,gs=initial?.game;
    if(!cs||!gs||gs.turnNumber!==0||gs.currentPlayer!==1||gs.consecutivePasses!==0)throw new Error('Invalid opening game state');
    for(const player of ['black','white']) {
        const cards=[...(cs.decks?.[player]||[]),...(cs.hands?.[player]||[])].sort();
        if(cs.charge?.[player]!==conditions.initialCharge || cs.chargeGainMultiplierByPlayer?.[player]!==conditions.chargeGainMultiplier
            || JSON.stringify(cards)!==JSON.stringify([...conditions.deckCardIds].sort()))throw new Error(`Starting perks/deck differ from frozen Lv9: ${player}`);
    }
}

export function makeLv10Conditions(label: string, pairs: number): Condition[] {
    if (!label.trim() || !Number.isInteger(pairs) || pairs < 1 || pairs > 200) throw new Error('Invalid condition declaration');
    const conditions = Array.from({ length:pairs }, (_,i) => ({ pair:i+1,
        seed:1000000000 + crypto.createHash('sha256').update(`lv10-condition-v1/${label}/${i+1}`).digest().readUInt32LE(0) % 2000000000 }));
    if (new Set(conditions.map(c => c.seed)).size !== pairs) throw new Error('Condition seed collision');
    return conditions;
}

type AcceptanceProtocol = {
    finalPairs:number; finalGames:number; minimumWinRate?:number; minimumScore?:number; minimumLower95?:number;
    acceptanceVersion?:string; bootstrapSeed:number; bootstrapSamples:number;
};

export function summarizeLv10Pairs(conditions: Condition[], games: GameScore[], protocol:AcceptanceProtocol=LV10_EVALUATION_PROTOCOL) {
    if (games.length !== conditions.length*2) throw new Error('Incomplete paired evaluation');
    const lookup = new Map<string,GameScore>();
    for (const game of games) {
        const key = `${game.pair}-${game.color}`;
        if (!['black','white'].includes(game.color) || ![0,.5,1].includes(game.score) || lookup.has(key)) throw new Error('Invalid or duplicate game');
        lookup.set(key,game);
    }
    const pairs = conditions.map(condition => {
        const black=lookup.get(`${condition.pair}-black`), white=lookup.get(`${condition.pair}-white`);
        if (!black || !white) throw new Error('Missing color in pair');
        return (black.score+white.score)/2;
    });
    let rng=protocol.bootstrapSeed;
    const random = () => { rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; return (rng>>>0)/4294967296; };
    const samples = Array.from({length:protocol.bootstrapSamples}, () => {
        let sum=0;
        for (let i=0;i<pairs.length;i++) sum+=pairs[Math.floor(random()*pairs.length)];
        return sum/pairs.length;
    }).sort((a,b)=>a-b);
    const confidence95=[samples[Math.floor(samples.length*.025)],samples[Math.ceil(samples.length*.975)-1]];
    const tally = (items:GameScore[]) => ({ games:items.length,wins:items.filter(g=>g.score===1).length,
        draws:items.filter(g=>g.score===.5).length,losses:items.filter(g=>g.score===0).length,
        winRate:items.filter(g=>g.score===1).length/items.length,
        score:items.reduce((sum,g)=>sum+g.score,0)/items.length });
    const total=tally(games);
    return { ...total, confidence95, pairScores:pairs, acceptanceVersion:protocol.acceptanceVersion||'legacy-score-rate',
        black:tally(games.filter(g=>g.color==='black')),white:tally(games.filter(g=>g.color==='white')),
        meetsFinalGate:conditions.length===protocol.finalPairs && games.length===protocol.finalGames
            && (protocol.minimumWinRate===undefined || total.winRate>=protocol.minimumWinRate)
            && (protocol.minimumScore===undefined || total.score>=protocol.minimumScore)
            && (protocol.minimumLower95===undefined || confidence95[0]>protocol.minimumLower95) };
}

function runtimeFiles(): string[] {
    const files: string[]=[];
    const walk=(directory:string) => {
        for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
            const full=path.join(directory,entry.name);
            if(entry.isDirectory()) walk(full); else if(entry.isFile()) files.push(full.replace(/\\/g,'/'));
        }
    };
    // Browser code, canonical rules bundled in its Workers, optional runtime
    // payloads, and the measurement/oracle host are all part of this lock.
    for(const directory of ['vite-dist','public','dist/scripts']) walk(directory);
    for(const file of ['index.html','index.vite.html','package-lock.json']) files.push(file);
    return files.sort();
}

function checkRuntime(manifest:any): void {
    for(const file of manifest.runtime) if(hash(fs.readFileSync(file.path))!==file.sha256) throw new Error(`Runtime changed since declaration: ${file.path}`);
}

export function prepareLv10Evaluation(directory:string, mode:'development'|'final', label:string, count?:number, replayDirectory?:string, concurrency:number=LV10_EVALUATION_PROTOCOL.concurrency) {
    if(!Number.isInteger(concurrency) || concurrency<1 || concurrency>4)throw new Error('Evaluation concurrency must be between 1 and 4');
    const out=path.resolve(directory), manifestPath=path.join(out,'manifest.json');
    if (fs.existsSync(manifestPath)) throw new Error('Evaluation already declared');
    const replayBytes=replayDirectory?fs.readFileSync(path.join(replayDirectory,'manifest.json')):null;
    const replay=replayBytes?JSON.parse(replayBytes.toString()):null;
    if(replay && (mode!=='development'||replay.mode!=='development')) throw new Error('Only development conditions can be explicitly replayed here');
    const pairs=mode==='final'?LV10_EVALUATION_PROTOCOL.finalPairs:(replay?.conditions.length??count??8);
    if (mode==='final' && count!==undefined && count!==LV10_EVALUATION_PROTOCOL.finalPairs)
        throw new Error(`Final evaluation requires exactly ${LV10_EVALUATION_PROTOCOL.finalPairs} pairs`);
    const conditions:Condition[]=replay?.conditions || makeLv10Conditions(label,pairs);
    const ledgerPath=path.resolve('data/cpu-lv10/issued-conditions.json');
    const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):[];
    const used=new Set<number>(ledger.flatMap((entry:any)=>entry.seeds));
    if(!replay && conditions.some(c=>used.has(c.seed))) throw new Error('Conditions were previously issued; choose a fresh label');
    const baseline=fs.readFileSync('data/cpu-lv10/baseline-v1/manifest.json');
    const manifest={ schema:'cpu-lv10-evaluation.v1',mode,label,createdAt:new Date().toISOString(),
        conditions,protocol:{...LV10_EVALUATION_PROTOCOL,concurrency},search:LV10_SEARCH_CONFIG,
        replays:replayBytes?{directory:path.resolve(replayDirectory!),manifestSha256:hash(replayBytes),developmentOnly:true}:null,
        baselineSha256:hash(baseline),
        gameConditions:readFrozenLv9GameConditions(),
        initialCondition:'Standard opening; seed controls initial deals, number cells and canonical PRNG. Deck/perks are identical Lv9 conditions on both colors. Each seed is played with the algorithms swapped.',
        schedule:conditions.flatMap(c=>(c.pair%2?['black','white']:['white','black']).map(color=>({...c,color}))),
        environment:{node:process.version,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemory:os.totalmem(),freeMemoryAtDeclaration:os.freemem()},
        runtime:runtimeFiles().map(file=>({path:file,sha256:hash(fs.readFileSync(file))})) };
    fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2),{flag:'wx'});
    ledger.push({label,mode,directory:out,createdAt:manifest.createdAt,seeds:conditions.map(c=>c.seed)});
    fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));
    return {directory:out,pairs,games:pairs*2,concurrency,manifestSha256:hash(fs.readFileSync(manifestPath))};
}

export function collectLv10Evaluation(directory:string, validatedGames?:Lv10ValidationCache) {
    const out=path.resolve(directory),manifestBytes=fs.readFileSync(path.join(out,'manifest.json'));
    const manifest=JSON.parse(manifestBytes.toString()),manifestHash=hash(manifestBytes);
    const dispositionPath=path.join(out,'disposition.json');
    const disposition=fs.existsSync(dispositionPath)?JSON.parse(fs.readFileSync(dispositionPath,'utf8')):null;
    const mode=disposition?.developmentOnly===true?'development':manifest.mode;
    const stopRequested=fs.existsSync(path.join(out,'stop-request.json'));
    const acceptanceEligible=mode==='final'&&!stopRequested;
    const games:GameScore[]=[], errors:any[]=[],pending:any[]=[],details:any[]=[];
    const initialByPair=new Map<number,string>();
    const record=(entry:ValidatedGame) => {
        if(initialByPair.has(entry.game.pair)&&initialByPair.get(entry.game.pair)!==entry.initialHash)throw new Error(`Initial conditions differ within pair ${entry.game.pair}`);
        initialByPair.set(entry.game.pair,entry.initialHash);
        games.push(entry.game);details.push(entry.detail);
    };
    for(const scheduled of manifest.schedule) {
        const prefix=path.join(out,`game-${scheduled.seed}-${scheduled.color}`);
        if(fs.existsSync(`${prefix}.error.json`)) {errors.push({...scheduled,error:JSON.parse(fs.readFileSync(`${prefix}.error.json`,'utf8'))});continue;}
        if(!fs.existsSync(`${prefix}.summary.json`)) {pending.push(scheduled);continue;}
        const summaryBytes=fs.readFileSync(`${prefix}.summary.json`),summary=JSON.parse(summaryBytes.toString());
        if(summary.pageErrors?.length)throw new Error(`Page exceptions in completed game: ${prefix}`);
        const stat=fs.statSync(`${prefix}.json.gz`);
        const fingerprint=`${manifestHash}/${hash(summaryBytes)}/${stat.size}/${stat.mtimeMs}`;
        const cached=validatedGames?.get(prefix);
        if(cached?.fingerprint===fingerprint){record(cached);continue;}
        const bytes=fs.readFileSync(`${prefix}.json.gz`),trace=JSON.parse(zlib.gunzipSync(bytes).toString());
        const audit=trace.audit;
        const gameConditions=manifest.gameConditions || readFrozenLv9GameConditions();
        verifyLv10StartingConditions(JSON.parse(trace.initialState),gameConditions);
        if(audit.records.some((record:any)=>record.ok && record.action.type==='use_card'
            && record.before.gameState.turnNumber<gameConditions.cardUseUnlockTurnNumber))throw new Error(`Card used before the shared unlock turn: ${prefix}`);
        if(hash(bytes)!==summary.traceSha256 || !audit.gameOver || audit.oracleVerificationErrors?.length
            || audit.frozenOpponent?.baselineSha256!==manifest.baselineSha256) throw new Error(`Invalid trace: ${prefix}`);
        if(!audit.frozenOpponent.answers?.length)throw new Error(`Missing frozen opponent decisions: ${prefix}`);
        for(const answer of audit.frozenOpponent.answers)verifyFrozenLv9ModelStatus(answer.model);
        if(manifest.protocol?.frozenOpponent?.verifyAutomaticPasses) {
            verifyFrozenTransitionCoverage(audit,scheduled.color==='black'?'white':'black');
        }
        const decisions=audit.lv10.history || audit.lv10.recent;
        if(audit.lv10.history && (!audit.lv10.historyComplete || audit.lv10.history.length!==audit.lv10.totals.decisions)) {
            throw new Error(`Incomplete decision timing history: ${prefix}`);
        }
        if(audit.lv10.totals.decisions<1 || decisions.some((decision:any)=>decision.search
            && (decision.search.version!==manifest.search.version || decision.search.transitions>manifest.search.maxTransitions))) {
            throw new Error(`Browser search differs from the declared candidate: ${prefix}`);
        }
        const initialHash=hash(trace.initialState);
        const own=audit.counts[scheduled.color], other=audit.counts[scheduled.color==='black'?'white':'black'];
        const score=own===other ? .5 : own>other ? 1 : 0;
        const entry={fingerprint,initialHash,game:{...scheduled,score},detail:{...scheduled,counts:audit.counts,initialStateSha256:initialHash,traceSha256:hash(bytes),
            rejections:summary.rejections,pageErrors:summary.pageErrors,lv10:summary.lv10,durationMs:summary.durationMs,
            frozenTransportRecoveries:audit.frozenOpponent.answers.flatMap((answer:any)=>answer.transportRecoveries||[])}};
        validatedGames?.set(prefix,entry);record(entry);
    }
    const valid=errors.length===0&&pending.length===0;
    const result=valid?summarizeLv10Pairs(manifest.conditions,games,manifest.protocol):null;
    if(result&&!acceptanceEligible)result.meetsFinalGate=false;
    return {schema:'cpu-lv10-evaluation-report.v1',mode,declaredMode:manifest.mode,disposition,stopRequested,acceptanceEligible,label:manifest.label,
        valid,completed:games.length,expected:manifest.schedule.length,errors,pending,details,
        result};
}

export async function runLv10Evaluation(directory:string) {
    const out=path.resolve(directory),manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
    const pending=manifest.schedule.filter((game:any)=>!fs.existsSync(path.join(out,`game-${game.seed}-${game.color}.summary.json`)));
    const validationCache:Lv10ValidationCache=new Map();
    if(collectLv10Evaluation(out,validationCache).errors.length) throw new Error('Existing failed games require investigation; automatic retries are disabled');
    let previousCpu: ReturnType<typeof os.cpus> | null=null;
    const captureResources=() => {
        const cpus=os.cpus();
        let total=0,idle=0;
        if(previousCpu) for(let i=0;i<cpus.length;i++) {
            const before=previousCpu[i]?.times,after=cpus[i].times;
            if(!before)continue;
            total+=Object.values(after).reduce((a,b)=>a+b,0)-Object.values(before).reduce((a,b)=>a+b,0);
            idle+=after.idle-before.idle;
        }
        previousCpu=cpus;
        fs.appendFileSync(path.join(out,'resources.jsonl'),JSON.stringify({time:new Date().toISOString(),
            freeMemoryBytes:os.freemem(),hostRssBytes:process.memoryUsage().rss,
            systemCpuBusyFraction:total>0?1-idle/total:null})+'\n');
    };
    captureResources();
    const resourceTimer=setInterval(captureResources,5000);
    resourceTimer.unref();
    let cursor=0, failure:unknown=null;
    const shouldStopLaunching=() => {
        if(!fs.existsSync(path.join(out,'stop-request.json')))return false;
        const acknowledgement=path.join(out,'stop-acknowledged.json');
        if(!fs.existsSync(acknowledgement))fs.writeFileSync(acknowledgement,JSON.stringify({
            time:new Date().toISOString(),policy:'Finish active games and preserve every record; do not launch remaining games or accept this evaluation.'
        },null,2),{flag:'wx'});
        return true;
    };
    const work=async () => {
        while(cursor<pending.length&&!failure&&!shouldStopLaunching()) {
            const game=pending[cursor++];
            try {
                if(os.freemem()<manifest.protocol.minimumFreeMemoryBytes) throw new Error('Free memory below declared launch threshold');
                checkRuntime(manifest);
                const result=await runLv10BrowserMatch({...game,out,timeoutMs:manifest.protocol.timeoutMs});
                console.log(JSON.stringify({pair:game.pair,color:game.color,score:result.score,counts:result.counts,durationMs:result.durationMs}));
            } catch(error) {
                failure ||= error;
                // Startup, resource, runtime-lock and teardown failures may
                // happen outside the match recorder. Retain their scheduled
                // condition as an explicit failure instead of a pending game.
                const errorPath=path.join(out,`game-${game.seed}-${game.color}.error.json`);
                if(!fs.existsSync(errorPath))fs.writeFileSync(errorPath,JSON.stringify({...game,phase:'evaluation-host',
                    time:new Date().toISOString(),error:String(error),stack:error instanceof Error?error.stack:null}));
            }
            // Do not repeatedly decompress all earlier games while browser RPCs
            // are active. Final acceptance below always revalidates every file.
            const report=collectLv10Evaluation(out,validationCache);
            fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
        }
    };
    try { await Promise.all(Array.from({length:manifest.protocol.concurrency},()=>work())); }
    finally { clearInterval(resourceTimer);captureResources(); }
    if(failure)throw failure;
    const report=collectLv10Evaluation(out);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    return report;
}

if(require.main===module) {
    const [command,directory,mode,label,count,parallel]=process.argv.slice(2);
    Promise.resolve().then(()=>{
        if(command==='prepare' && ['development','final'].includes(mode)) return prepareLv10Evaluation(directory,mode as any,label,count?Number(count):undefined,undefined,parallel?Number(parallel):undefined);
        if(command==='prepare-replay')return prepareLv10Evaluation(directory,'development',label,undefined,mode,count?Number(count):undefined);
        if(command==='run')return runLv10Evaluation(directory);
        if(command==='summarize')return collectLv10Evaluation(directory);
        throw new Error('Usage: prepare <directory> <development|final> <label> [pairs] [parallel], prepare-replay <directory> <source-development-directory> <label> [parallel], run <directory>, summarize <directory>');
    }).then(result=>console.log(JSON.stringify(result)),error=>{console.error(error);process.exitCode=1;});
}
