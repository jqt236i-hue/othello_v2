import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');

const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Read-only match diagnosis; no search or canonical transitions are executed.
 * Both winning and losing decisions remain in the source journals. */
export function inspectLv13Experiment(directory:string){
    const manifestFile=path.join(directory,'manifest.json'),manifest=read(manifestFile);
    const games=manifest.schedule.map((slot:any)=>{
        const root=path.join(directory,'games',slot.id);
        const attempts=fs.existsSync(root)?fs.readdirSync(root).filter(name=>/^attempt-\d+$/.test(name)).sort((a,b)=>Number(a.slice(8))-Number(b.slice(8))):[];
        if(!attempts.length)return {slot,status:'unstarted'};
        const last=path.join(root,attempts[attempts.length-1]),resultFile=path.join(last,'result.json');
        if(!fs.existsSync(resultFile))return {slot,status:fs.existsSync(path.join(last,'failure.json'))?'failed':'incomplete',attempts};
        const result=read(resultFile);
        if(result.status!=='complete')return {slot,status:result.status,attempts};
        const decisions:any[]=[];
        const sources=attempts.map(name=>{
            const file=path.join(root,name,'steps.ndjson'),bytes=fs.readFileSync(file,'utf8');
            if(!bytes.endsWith('\n'))throw new Error('Incomplete journal');
            for(const line of bytes.trimEnd().split('\n')){
                const row=JSON.parse(line);
                if(row.kind!=='decision')continue;
                const decision=row.decision,search=decision.search;
                decisions.push({index:row.index,player:row.player,turn:decision.turnNumber,action:decision.action,
                    input:row.memories?.[row.player]?.identity,
                    elapsedMs:decision.elapsedMs,searchMs:search?.elapsedMs,transitions:search?.transitions,
                    source:decision.source,outcome:decision.outcome,error:decision.error,
                    search});
            }
            return {path:path.resolve(file),sha256:hash(file)};
        });
        const timing=(candidate:boolean)=>{
            const selected=decisions.filter(d=>(d.player===slot.candidateColor)===candidate);
            const limit=candidate?4700:4800;
            const excess=selected.filter(d=>d.elapsedMs>limit||d.searchMs>limit||d.transitions>4096);
            return {count:selected.length,limitMs:limit,maxSearchMs:Math.max(0,...selected.map(d=>d.searchMs||0)),
                maxDecisionMs:Math.max(0,...selected.map(d=>d.elapsedMs||0)),maxTransitions:Math.max(0,...selected.map(d=>d.transitions||0)),
                internalOverruns:selected.filter(d=>d.searchMs>limit).length,outerOverruns:selected.filter(d=>d.elapsedMs>limit).length,
                transitionOverruns:selected.filter(d=>d.transitions>4096).length,
                overruns:excess.map(({input,search,...rest})=>rest),
                anomalies:selected.filter(d=>d.source!=='worker'||d.outcome!=='applied'||d.error).map(({input,search,...rest})=>rest)};
        };
        const outcome=result.result.winner==='draw'?'draw':result.result.winner===slot.candidateColor?'win':'loss';
        const turns=Math.max(0,...decisions.map(d=>d.turn));
        return {slot,status:'complete',outcome,turns,durationClass:turns<=20?'short':turns>=60?'long':'middle',
            sources,result:result.result,timing:{candidate:timing(true),opponent:timing(false)},decisions};
    });
    return {manifest:{path:path.resolve(manifestFile),sha256:hash(manifestFile)},games};
}

export function compareLv13Experiments(baselineDirectory:string,candidateDirectory:string){
    const baseline=inspectLv13Experiment(baselineDirectory),candidate=inspectLv13Experiment(candidateDirectory);
    if(JSON.stringify(baseline.games.map((g:any)=>g.slot))!==JSON.stringify(candidate.games.map((g:any)=>g.slot)))throw new Error('Comparison conditions differ');
    const comparisons=candidate.games.map((game:any,index:number)=>{
        const prior:any=baseline.games[index];
        if(game.status!=='complete'||prior.status!=='complete')throw new Error('Full comparison needs every game complete');
        const divergence=game.decisions.findIndex((decision:any,i:number)=>JSON.stringify(decision.action)!==JSON.stringify(prior.decisions[i]?.action));
        const before=prior.decisions[divergence],after=game.decisions[divergence];
        const sameInput=!!before&&!!after&&before.input===after.input;
        return {slot:game.slot,before:prior.outcome,after:game.outcome,beforeTurns:prior.turns,afterTurns:game.turns,
            beforeDurationClass:prior.durationClass,afterDurationClass:game.durationClass,
            rescuedLoss:prior.outcome==='loss'&&game.outcome==='win',
            brokenWin:prior.outcome==='win'&&game.outcome!=='win',
            firstDivergence:divergence<0?null:{index:divergence+1,sameInput,
                firstChangedSeat:after?.player,isCandidate:after?.player===game.slot.candidateColor,
                before,after}};
    });
    const tally=(color:string)=>{
        const rows=comparisons.filter((row:any)=>row.slot.candidateColor===color);
        return {before:{wins:rows.filter((r:any)=>r.before==='win').length,draws:rows.filter((r:any)=>r.before==='draw').length,losses:rows.filter((r:any)=>r.before==='loss').length},
            after:{wins:rows.filter((r:any)=>r.after==='win').length,draws:rows.filter((r:any)=>r.after==='draw').length,losses:rows.filter((r:any)=>r.after==='loss').length},
            rescuedLosses:rows.filter((r:any)=>r.rescuedLoss).map((r:any)=>r.slot.id),brokenWins:rows.filter((r:any)=>r.brokenWin).map((r:any)=>r.slot.id)};
    };
    return {schema:'cpu-lv13-comparison.v1',createdAt:new Date().toISOString(),baseline:baseline.manifest,candidate:candidate.manifest,
        black:tally('black'),white:tally('white'),comparisons,
        timing: candidate.games.map((g:any)=>({slot:g.slot,timing:g.timing})),
        caveat:'A first divergence in the unchanged opponent or differing time allocation prevents attributing every changed outcome solely to the policy hypothesis.'};
}

if(require.main===module){
    const [baseline,candidate,out]=process.argv.slice(2);
    fs.writeFileSync(out,JSON.stringify(compareLv13Experiments(baseline,candidate),null,2),{flag:'wx'});
}
