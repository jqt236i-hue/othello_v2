#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import zlib = require('node:zlib');
import { collectLv10Evaluation, LV10_EVALUATION_PROTOCOL } from './run-cpu-lv10-evaluation';

function distribution(values: number[]) {
    const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
    return {n:sorted.length,median:sorted.length?sorted[Math.floor((sorted.length-1)*.5)]:null,
        p95:sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:null,max:sorted.length?sorted[sorted.length-1]:null};
}

/** Union nested thinking intervals without presentation or double-counting.
 * The comparison runner disables minimum-think waits before initialization;
 * the original Lv9 records those under move-candidates when they are enabled. */
export function lv10ComparisonThinkingMs(entries: any[]): number {
    const intervals=entries.filter(e=>String(e.stage).startsWith('card-')
        || e.stage==='move-candidates' || e.stage==='tactical-safety')
        .map(e=>[e.startMs,e.endMs]).filter(e=>e.every(Number.isFinite)&&e[1]>=e[0]).sort((a,b)=>a[0]-b[0]);
    let end=-Infinity,total=0;
    for(const [start,nextEnd] of intervals) {
        total+=Math.max(0,nextEnd-Math.max(start,end));end=Math.max(end,nextEnd);
    }
    return total;
}

export function frozenLv9InvocationTimes(answers:any[]): number[] {
    if(!answers.some(answer=>answer.turnPlan))return answers.map(answer=>lv10ComparisonThinkingMs(answer.performanceEntries||[]));
    const invocations=new Map<string,any[]>();
    for(const entry of answers.flatMap(answer=>answer.performanceEntries||[])) {
        if(!String(entry.stage).startsWith('card-') && entry.stage!=='move-candidates' && entry.stage!=='tactical-safety')continue;
        const key=entry.runId==null?`correlation:${entry.correlationId}`:`run:${entry.runId}`;
        if(!invocations.has(key))invocations.set(key,[]);
        invocations.get(key)!.push(entry);
    }
    return [...invocations.values()].map(lv10ComparisonThinkingMs);
}

export function summarizeLv10Metrics(directory:string) {
    const out=path.resolve(directory),report=collectLv10Evaluation(out);
    if(!report.valid)throw new Error('Metrics require every declared game and pair to be valid');
    const finalEvaluationGames=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8')).protocol?.finalGames
        ?? LV10_EVALUATION_PROTOCOL.finalGames;
    const lv10={decisions:0,fallback:0,rejected:0,stale:0,noAction:0};
    const times:number[]=[],workerTimes:number[]=[],lv9Times:number[]=[],turnTimes:number[]=[],raf:number[]=[],longTasks:number[]=[];
    const stopped:Record<string,number>={},actionTypes:Record<string,number>={};
    let traceBytes=0,frozenAnswers=0,staleFrozenAnswers=0,actualRejectedAttempts=0,frozenPassPrngRepairs=0,verifiedAutomaticPasses=0;
    const perGame:any[]=[],losses:any[]=[];
    for(const game of report.details) {
        const tracePath=path.join(out,`game-${game.seed}-${game.color}.json.gz`),bytes=fs.readFileSync(tracePath);
        const trace=JSON.parse(zlib.gunzipSync(bytes).toString()),audit=trace.audit;
        const history=audit.lv10.history || audit.lv10.recent;
        if(history.length!==audit.lv10.totals.decisions)throw new Error(`Decision history was truncated: ${tracePath}`);
        traceBytes+=bytes.length;
        for(const key of Object.keys(lv10) as (keyof typeof lv10)[])lv10[key]+=audit.lv10.totals[key];
        const turns=new Map<string,number>();
        for(const decision of history) {
            times.push(decision.elapsedMs);
            if(decision.search?.elapsedMs!=null)workerTimes.push(decision.search.elapsedMs);
            if(decision.search)stopped[decision.search.stopped]=(stopped[decision.search.stopped]||0)+1;
            const actionType=decision.action?.type || 'none';actionTypes[actionType]=(actionTypes[actionType]||0)+1;
            const key=`${decision.player}/${decision.turnNumber}`;turns.set(key,(turns.get(key)||0)+decision.elapsedMs);
        }
        turnTimes.push(...turns.values());
        lv9Times.push(...frozenLv9InvocationTimes(audit.frozenOpponent.answers));
        frozenAnswers+=audit.frozenOpponent.answers.length;staleFrozenAnswers+=audit.oracleStaleAnswers||0;
        verifiedAutomaticPasses+=(audit.oracleActionVerifications||[]).filter((item:any)=>item.delivery==='automatic-pass').length;
        frozenPassPrngRepairs+=audit.frozenOpponent.answers.flatMap((answer:any)=>answer.attempts)
            .filter((attempt:any)=>attempt.passPrngInjected).length;
        actualRejectedAttempts+=audit.records.filter((r:any)=>!r.ok).length;
        const perf=audit.perf;
        const performanceCaptureValid=!!perf&&perf.visibilityValid&&perf.focusValid&&!perf.overflow&&!perf.invalidEntryCount;
        if(performanceCaptureValid){raf.push(...perf.rafIntervalsMs);longTasks.push(...perf.longTasks.map((t:any)=>t.durationMs));}
        perGame.push({pair:game.pair,seed:game.seed,color:game.color,turns:audit.final.gameState.turnNumber,
            decisions:history.length,durationMs:game.durationMs,performanceCaptureValid,lv10TimingMs:distribution(history.map((d:any)=>d.elapsedMs))});
        if(audit.counts[game.color]<audit.counts[game.color==='black'?'white':'black'])losses.push({pair:game.pair,seed:game.seed,color:game.color,
            tracePath,counts:audit.counts,lastDecisions:history.slice(-8).map((d:any)=>({turn:d.turnNumber,action:d.action,value:d.search?.value,stopped:d.search?.stopped})),
            lastAcceptedRecordIndexes:audit.records.map((r:any,i:number)=>r.ok?i:-1).filter((i:number)=>i>=0).slice(-12)});
    }
    const totalGameMs=report.details.reduce((sum,g)=>sum+g.durationMs,0);
    return {schema:'cpu-lv10-metrics.v1',result:report.result,lv10,lv10TimingMs:distribution(times),
        lv10WorkerMs:distribution(workerTimes),lv10AccumulatedThinkingPerTurnMs:distribution(turnTimes),lv9TimingMs:distribution(lv9Times),
        thinkingDefinition:'Per advisor/original invocation; real apply/presentation excluded, minimum-think waits disabled by benchmark mode. Lv9 uses the union of card-*, move-candidates, tactical-safety intervals.',
        stopped,actionTypes,frozenAnswers,staleFrozenAnswers,actualRejectedAttempts,frozenPassPrngRepairs,verifiedAutomaticPasses,totalTraceBytes:traceBytes,
        frozenTransportRecoveries:report.details.reduce((sum,game)=>sum+game.frozenTransportRecoveries.length,0),
        gameDurationMs:distribution(report.details.map(g=>g.durationMs)),totalGameMs,finalEvaluationGames,
        serialFinalEstimateHours:totalGameMs/report.details.length*finalEvaluationGames/3600000,
        validPerformanceGames:perGame.filter(g=>g.performanceCaptureValid).length,rafIntervalsMs:distribution(raf),longTasksMs:distribution(longTasks),perGame,losses};
}

if(require.main===module) {
    const directory=process.argv[2];
    const metrics=summarizeLv10Metrics(directory);
    fs.writeFileSync(path.join(directory,'metrics.json'),JSON.stringify(metrics,null,2));
    console.log(JSON.stringify({result:metrics.result,lv10:metrics.lv10,lv10TimingMs:metrics.lv10TimingMs,lv9TimingMs:metrics.lv9TimingMs,
        gameDurationMs:metrics.gameDurationMs,totalTraceBytes:metrics.totalTraceBytes,finalEvaluationGames:metrics.finalEvaluationGames,
        serialFinalEstimateHours:metrics.serialFinalEstimateHours}));
}
