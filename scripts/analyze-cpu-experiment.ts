#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');

const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));

/** Post-run diagnosis only. Authoritative private states remain in the journal;
 * exported decision inputs are rebuilt through the normal player projection.
 * This does not rejudge actions or run any game/search transitions. */
export function analyzeCpuExperiment(directoryInput:string,output:string){
    if(fs.existsSync(output))throw new Error('Analysis output already exists');
    const directory=path.resolve(directoryInput),manifest=read(path.join(directory,'manifest.json'));
    const Core=require(path.join(manifest.commonRoot,'dist/game/logic/core'));
    const games:any[]=[];
    for(const slot of manifest.schedule){
        const gameRoot=path.join(directory,'games',slot.id);
        if(!fs.existsSync(gameRoot)){games.push({slot,status:'unstarted'});continue;}
        const attempts=fs.readdirSync(gameRoot).filter(name=>/^attempt-\d+$/.test(name)).sort((a,b)=>Number(a.slice(8))-Number(b.slice(8)));
        const decisions:any[]=[];
        const attemptReports:any[]=[];
        for(const attempt of attempts){
            const dir=path.join(gameRoot,attempt),resultFile=path.join(dir,'result.json');
            const result=fs.existsSync(resultFile)?read(resultFile):null;
            const failureFile=path.join(dir,'failure.json');
            const bytes=fs.readFileSync(path.join(dir,'steps.ndjson'));
            if(!bytes.toString().endsWith('\n'))throw new Error('Truncated or still-writing journal');
            const rows=bytes.toString().trimEnd().split('\n').map(line=>JSON.parse(line));
            const game=read(path.join(dir,'manifest.json'));
            for(const row of rows.filter(row=>row.kind==='decision')){
                const command=row.transitions.find((step:any)=>step.kind==='action');
                const before=Core.countDiscs(command.before.gameState,command.before.cardState);
                const after=Core.countDiscs(command.after.gameState,command.after.cardState);
                const side=row.player,other=side==='black'?'white':'black';
                const search=row.decision.search;
                const observation=require(path.join(game.identity.policies[side].spec.root,'dist/game/ai/cpu-lv10-observation'))
                    .observeLv10Position(command.before,side);
                decisions.push({index:row.index,side,candidate:side===slot.candidateColor,turn:row.decision.turnNumber,
                    action:row.decision.action,outcome:row.decision.outcome,source:row.decision.source,error:row.decision.error,
                    before,after,ownMaterial:before[side]-before[other],
                    materialChange:(after[side]-after[other])-(before[side]-before[other]),
                    ownHand:observation.cardState.hands[side],search,
                    publicInputSha256:crypto.createHash('sha256').update(JSON.stringify(observation)).digest('hex')});
            }
            attemptReports.push({attempt,result,failure:fs.existsSync(failureFile)?read(failureFile).error:null,
                journalSha256:crypto.createHash('sha256').update(bytes).digest('hex')});
        }
        const final=attemptReports[attemptReports.length-1]?.result;
        const tally=(candidate:boolean)=>{
            const rows=decisions.filter(row=>row.candidate===candidate);
            const actionCounts:Record<string,number>={},stops:Record<string,number>={};
            for(const row of rows){
                const action=row.action?.useCardId||row.action?.type||'none';actionCounts[action]=(actionCounts[action]||0)+1;
                const stop=row.search?.stopped||'none';stops[stop]=(stops[stop]||0)+1;
            }
            return {decisions:rows.length,actionCounts,stops,
                meanTransitions:rows.reduce((s,row)=>s+(row.search?.transitions||0),0)/Math.max(1,rows.length),
                meanSearchMs:rows.reduce((s,row)=>s+(row.search?.elapsedMs||0),0)/Math.max(1,rows.length),
                scenariosIncomplete:rows.filter(row=>(row.search?.comparisonScenarioSeeds?.length||0)<2).length,
                fallback:rows.filter(row=>row.source==='fallback').length,rejections:rows.filter(row=>row.outcome==='rejected').length,
                searchRejections:rows.reduce((s,row)=>s+(row.search?.rejectedCount||0),0)};
        };
        games.push({slot,status:final?.status||'incomplete',result:final?.result||null,
            won:final?.status==='complete'?final.result.winner===slot.candidateColor:null,
            attempts:attemptReports,candidate:tally(true),opponent:tally(false),decisions});
    }
    const result={schema:'cpu-experiment-analysis.v1',directory,createdAt:new Date().toISOString(),
        mode:'Recorded decisions only; no rejudgment and no additional games',games};
    fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx'});
    return {output,games:games.map(({decisions,attempts,...game})=>game)};
}

if(require.main===module){
    try{console.log(JSON.stringify(analyzeCpuExperiment(process.argv[2],process.argv[3])));}
    catch(error){console.error(error);process.exitCode=1;}
}
