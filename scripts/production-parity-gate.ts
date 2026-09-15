#!/usr/bin/env node
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import zlib = require('node:zlib');
import { ProductionMatch, createProductionPosition, productionStateKey } from '../src/engine/production-match';
import { verifyProductionReplay, diffProductionStates } from './verify-production-replay';
import { productionRuntimeManifest } from './run-production-selfplay';
import Shared = require('../shared-constants');

const hash = (bytes: Buffer | string) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const receipt = (file: string) => ({ path: path.resolve(file), sha256: hash(fs.readFileSync(file)) });

/** Revalidate saved browser states against the current canonical runtime and
 * bind the evidence to the exact rules, candidate and fixed-compute report.
 * This gate does not claim that Lv11 has been adopted into the normal UI. */
export function establishProductionParityGate(candidateRoot: string, judgmentFile: string, traceFile: string, cardReportFile: string) {
    const candidate = productionRuntimeManifest(candidateRoot), common = productionRuntimeManifest(process.cwd());
    const judgment = read(judgmentFile), cardReport = read(cardReportFile);
    if (judgment.valid !== true || judgment.errors?.length || judgment.results?.length < 10
        || judgment.results.some((item: any) => item.differences?.length || item.missingScenarioSeeds?.length
            || !item.expected || !item.actual || diffProductionStates(item.expected, item.actual).length)) {
        throw new Error('Passing browser candidate judgment evidence is required');
    }
    const level = judgment.level === 12 ? 12 : 11;
    for (const [file, expected] of [[`game/ai/cpu-lv${level}-search.js`, judgment.searchSha256], [`game/ai/cpu-lv${level}-evaluation.js`, judgment.evaluationSha256]]) {
        if (hash(fs.readFileSync(path.join(candidate.root, 'dist', file))) !== expected
            || hash(fs.readFileSync(path.join(common.root, 'dist', file))) !== expected) throw new Error('Candidate differs from the browser judgment evidence');
    }
    const config = require(path.join(candidate.root, `dist/game/ai/cpu-lv${level}-search`))[`LV${level}_SEARCH_CONFIG`];
    for (const item of judgment.results) {
        if (item.requireAllScenarios && config.scenarioSeeds.some((seed: number) =>
            !item.expected.comparisonScenarioSeeds?.includes(seed) || !item.actual.comparisonScenarioSeeds?.includes(seed))) {
            throw new Error('Required browser scenario coverage is incomplete');
        }
    }
    const trace = JSON.parse(zlib.gunzipSync(fs.readFileSync(traceFile)).toString());
    const initialized = new ProductionMatch(createProductionPosition(trace.seed, { black: 10, white: 10 }));
    initialized.startTurn();
    if (trace.pageErrors?.length || !trace.audit?.result?.terminal
        || productionStateKey(initialized.snapshot()) !== productionStateKey(trace.initial)) {
        throw new Error('Browser full-game initialization or terminal evidence is invalid');
    }
    const replay = verifyProductionReplay(traceFile);
    if (!replay.valid || !replay.actions || !replay.boundaries) throw new Error('Current rules differ from the full browser game');
    if (cardReport.valid !== true || cardReport.pageErrors?.length || cardReport.cards?.length !== 200) throw new Error('All-card browser evidence is incomplete');
    if (!Array.isArray(Shared.CARD_DEFS)) throw new Error('Canonical card catalog is unavailable');
    const expectedCases = [...Shared.CARD_DEFS.map((card: any) => card.id), 'shinra-fusion']
        .flatMap(id => ['black', 'white'].map(side => `${id}/${side}`)).sort();
    if (JSON.stringify(cardReport.cards.map((card: any) => `${card.id}/${card.player}`).sort()) !== JSON.stringify(expectedCases)) throw new Error('All-card browser inventory is incomplete or duplicated');
    const artifacts = [receipt(judgmentFile), receipt(traceFile), receipt(cardReportFile)];
    let cardTransitions = 0;
    for (const card of cardReport.cards) {
        const file = path.join(path.dirname(cardReportFile), card.file), bytes = fs.readFileSync(file);
        if (!card.valid || !card.used || !card.completedCardTurn || hash(bytes) !== card.sha256) throw new Error('Card evidence failed or changed');
        const { fixture, actual } = JSON.parse(zlib.gunzipSync(bytes).toString());
        const match = new ProductionMatch(fixture.initial);
        if (fixture.transitions.length !== actual.length) throw new Error('Card transition count mismatch');
        fixture.transitions.forEach((step: any, index: number) => {
            const result = step.kind === 'turn_start' ? match.startTurn() : match.apply(step.action, undefined, step.player);
            if (!result || result.ok !== actual[index].ok || !!result.stopAction !== actual[index].stopAction
                || productionStateKey(result.after) !== productionStateKey(actual[index].state)) throw new Error(`Card browser state mismatch: ${card.id}/${card.player}/${index}`);
            cardTransitions++;
        });
        artifacts.push(receipt(file));
    }
    return { schema: 'production-cpu-parity-gate.v1', valid: true, createdAt: new Date().toISOString(),
        commonRuntimeSha256: common.sha256, candidateRuntimeSha256: candidate.sha256,
        candidateRoot: candidate.root, artifacts, evidence: { fullGameActions: replay.actions, fullGameBoundaries: replay.boundaries,
            cardCases: cardReport.cards.length, cardTransitions, fixedComputeJudgments: judgment.results.length },
        adoptionComplete: false };
}

export function verifyProductionParityGate(file: string, commonRoot: string, candidateRoot: string) {
    const gate = read(file);
    if (gate.schema !== 'production-cpu-parity-gate.v1' || gate.valid !== true || gate.evidence?.cardCases !== 200
        || gate.evidence?.fixedComputeJudgments < 10 || !gate.evidence?.fullGameActions) throw new Error('Production parity gate is not established');
    if (gate.commonRuntimeSha256 !== productionRuntimeManifest(commonRoot).sha256
        || gate.candidateRuntimeSha256 !== productionRuntimeManifest(candidateRoot).sha256) throw new Error('Production parity gate does not cover these exact runtimes');
    if (!Array.isArray(gate.artifacts) || gate.artifacts.length !== 203) throw new Error('Production parity evidence inventory is incomplete');
    for (const artifact of gate.artifacts) if (hash(fs.readFileSync(artifact.path)) !== artifact.sha256) throw new Error('Production parity evidence changed');
    return receipt(file);
}

if (require.main === module) {
    try {
        const [candidate, judgment, trace, cards, output] = process.argv.slice(2);
        const gate = establishProductionParityGate(candidate, judgment, trace, cards);
        fs.writeFileSync(output, JSON.stringify(gate, null, 2), { flag: 'wx' });
        console.log(JSON.stringify({ output, valid: gate.valid, evidence: gate.evidence }));
    } catch (error) { console.error(error); process.exitCode = 1; }
}
