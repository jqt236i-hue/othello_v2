#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import {verifyProductionSelfplay} from './verify-production-selfplay';
import {summarizeProductionDecisions} from './run-production-selfplay';

const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=(value:string|Buffer)=>crypto.createHash('sha256').update(value).digest('hex');
const write=(file:string,value:unknown)=>fs.writeFileSync(file,JSON.stringify(value,null,2),{flag:'wx'});
function confirmMissing(pid:number){
    if(!Number.isInteger(pid)||pid<=0)throw new Error('Invalid process identity');
    try{process.kill(pid,0);}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return;throw error;}
    throw new Error(`Process ${pid} still exists; recovery refused`);
}

/** Recover process disappearance or a separately confirmed simultaneous
 * termination, never a recorded CPU exception. The
 * original journal/checkpoint stay byte-identical; resume uses a new attempt. */
export function recoverCpuExperiment(directoryInput:string,reason:string,options:{confirmedTerminationExitCode?:number}={}){
    if(!reason.trim())throw new Error('A concrete recovery reason is required');
    const directory=path.resolve(directoryInput),processFile=path.join(directory,'processes.json');
    const original=fs.readFileSync(processFile),history=JSON.parse(original.toString());
    const lockFile=path.join(directory,'run-lock.json');
    if(fs.existsSync(lockFile))confirmMissing(read(lockFile).pid);
    const terminationCode=options.confirmedTerminationExitCode;
    // Explicit recovery of the observed Windows termination event is kept
    // separate from missing-process recovery. Ordinary exit=1/CPU failures
    // must never become eligible merely because their owner has disappeared.
    if(terminationCode!==undefined&&terminationCode!==1073807364)throw new Error('Unsupported termination exit code');
    const affected=history.filter((entry:any)=>terminationCode===undefined?!entry.finishedAt:
        entry.code===terminationCode&&!entry.interruption);
    if(!affected.length)throw new Error('No unfinished process records');
    let terminationEvidence:any=null;
    if(terminationCode!==undefined){
        if(affected.length<2||history.some((entry:any)=>!entry.finishedAt||
            (entry.code!==0&&!entry.interruption&&!affected.includes(entry))))throw new Error('Termination event must cover every failed process');
        const stopFile=path.join(directory,'stop-request.json'),stop=read(stopFile);
        const stopAt=Date.parse(stop.requestedAt),times=affected.map((entry:any)=>Date.parse(entry.finishedAt));
        if(stop.reason!=='owner signal'||!Number.isFinite(stopAt)||times.some((time:number)=>!Number.isFinite(time)||time<stopAt||time-stopAt>1000))
            throw new Error('No matching simultaneous owner termination event');
        const stderr=affected.map((entry:any)=>{
            const file=entry.output+'.stderr.log',bytes=fs.readFileSync(file);
            if(bytes.toString().split(/\r?\n/).some(line=>line.trim()&&line.trim()!=='[presentation] BoardOps.emitPresentationEvent not available (events will be persisted)'))
                throw new Error('Termination stderr requires separate CPU failure inspection');
            return {slot:entry.slot,file,sha256:sha(bytes)};
        });
        terminationEvidence={exitCode:terminationCode,stopFile,stopSha256:sha(fs.readFileSync(stopFile)),stop,stderr,
            attribution:'Simultaneous recorded termination; initiating actor is unknown. No saved CPU exception is permitted.'};
    }
    for(const entry of affected)confirmMissing(entry.pid);
    const recoveredAt=new Date().toISOString(),recoveryFile=path.join(directory,`process-loss-${crypto.randomUUID()}.json`);
    const summaries:any[]=[];
    for(const entry of affected){
        const attempt=path.resolve(entry.output);
        if(!attempt.startsWith(directory+path.sep))throw new Error('Attempt outside experiment');
        if(fs.existsSync(path.join(attempt,'result.json'))||fs.existsSync(path.join(attempt,'failure.json')))
            throw new Error('A saved result/CPU failure requires separate inspection');
        const manifest=read(path.join(attempt,'manifest.json'));
        const checkpointFile=path.join(attempt,'checkpoint.json'),checkpoint=read(checkpointFile);
        const journalFile=path.join(attempt,'steps.ndjson'),bytes=fs.readFileSync(journalFile);
        if(!bytes.toString().endsWith('\n'))throw new Error('Partial journal must be preserved and repaired separately');
        const rows=bytes.toString().trimEnd().split('\n').map(line=>JSON.parse(line)),last=rows[rows.length-1];
        const runtime=require(path.join(manifest.commonRuntime.root,'dist/src/engine/production-match'));
        if(checkpoint.status!=='running'||checkpoint.identityHash!==manifest.identityHash
            ||checkpoint.decisions!==last.index||runtime.productionStateKey(checkpoint.state)!==runtime.productionStateKey(last.state)
            ||JSON.stringify(checkpoint.memories)!==JSON.stringify(last.memories))throw new Error('Checkpoint differs from durable journal');
        const match=new runtime.ProductionMatch(checkpoint.state);
        const decisions=rows.filter(row=>row.kind==='decision').map(row=>row.decision);
        const result={status:match.terminal?'complete':'stopped',result:match.terminal?match.result():null,
            identityHash:manifest.identityHash,decisions:checkpoint.decisions,elapsedMs:checkpoint.elapsedMs,
            metricsScope:'Durable journal only; process resources and any in-flight judgment were lost',
            black:summarizeProductionDecisions(decisions.filter(row=>row.player==='black')),
            white:summarizeProductionDecisions(decisions.filter(row=>row.player==='white')),
            resources:null,finalStateHash:sha(runtime.productionStateKey(checkpoint.state)),
            recovered:true,recoveryFile};
        const audit=verifyProductionSelfplay(attempt,new Set(),undefined,result);
        summaries.push({slot:entry.slot,pid:entry.pid,attempt,checkpointSha256:sha(fs.readFileSync(checkpointFile)),
            journalSha256:sha(bytes),identityHash:manifest.identityHash,decisions:checkpoint.decisions,
            replay:{valid:audit.valid,transitionCount:audit.transitionCount,finalStateHash:audit.finalStateHash},result});
    }
    // All candidates are validated before the first write; never choose a
    // subset based on outcome. Original process history is retained in full.
    write(recoveryFile,{schema:'cpu-process-loss-recovery.v1',recoveredAt,reason,originalProcessHistory:JSON.parse(original.toString()),
        originalProcessHistorySha256:sha(original),terminationEvidence,processAbsence:'All listed PIDs returned ESRCH before recovery',
        stoppedTime:'finishedAt is a conservative upper bound: process absence observation time',summaries});
    for(const summary of summaries)write(path.join(summary.attempt,'result.json'),summary.result);
    for(const entry of affected){
        const summary=summaries.find(item=>item.slot===entry.slot&&item.pid===entry.pid);
        const originalExit={code:entry.code,finishedAt:entry.finishedAt};
        entry.finishedAt=recoveredAt;entry.code=null;
        entry.interruption={kind:'process-loss',recoveryFile,checkpointSha256:summary.checkpointSha256,journalSha256:summary.journalSha256,
            ...(terminationCode!==undefined?{originalExit}: {})};
    }
    fs.writeFileSync(processFile,JSON.stringify(history,null,2));
    return {recoveryFile,recoveredAt,attempts:summaries.map(({slot,decisions,replay})=>({slot,decisions,replay}))};
}
if(require.main===module){try{
    const args=process.argv.slice(3),flag=args.find(arg=>arg.startsWith('--confirmed-termination-exit-code='));
    const code=flag?Number(flag.slice(flag.indexOf('=')+1)):undefined;
    console.log(JSON.stringify(recoverCpuExperiment(process.argv[2],args.filter(arg=>arg!==flag).join(' '),{confirmedTerminationExitCode:code})));}
catch(error){console.error(error);process.exitCode=1;}}
