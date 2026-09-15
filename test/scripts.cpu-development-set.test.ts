import fs = require('node:fs');
import path = require('node:path');
import os = require('node:os');
import crypto = require('node:crypto');
import { loadAuditedDevelopmentSet } from '../scripts/cpu-development-set';
import { makeExperimentSchedule, type ExperimentSpec } from '../scripts/cpu-experiment-protocol';

const sha = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const policy = { root: '.', module: 'game/ai/cpu-lv12-search', search: 'searchLv12', config: 'LV12_SEARCH_CONFIG' };
const spec: ExperimentSpec = { label: 'common-set-test', mode: 'development', acceptance: 'lv12', out: '.',
    paired: 20, blackOnly: 0, whiteOnly: 0, concurrency: 4, candidate: policy, opponent: policy };

test('fixed common set preserves whole audited trials, source deals, and order; rejects selection and formal reuse', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cpu-common-set-'));
    const save = (name: string, data: any) => {
        const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data)); return { path: file, sha256: sha(fs.readFileSync(file)) };
    };
    try {
        const ledger: any[] = [], sources: any[] = [], schedule: any[] = [], provenance: any[] = [];
        for (let sourceIndex = 0; sourceIndex < 2; sourceIndex++) {
            const original = makeExperimentSchedule({ ...spec, label: `source-${sourceIndex}`, paired: 15, mode: 'acceptance' }, new Set());
            const manifest = save(`source-${sourceIndex}/manifest.json`, { spec: { mode: 'acceptance', acceptance: 'lv12' }, ...original });
            ledger.push({ mode: 'acceptance', directory: path.dirname(manifest.path) });
            const slots = original.schedule.slice(0, sourceIndex ? 10 : 30);
            const games = slots.map(slot => ({ slot, valid: true, status: 'complete', initialSha256: sha(Buffer.from(String(slot.seed))) }));
            const audit = save(`source-${sourceIndex}/audit.json`, { valid: true, manifestSha256: manifest.sha256,
                earlyStopped: sourceIndex === 1, complete: sourceIndex === 0, completed: slots.length, games });
            sources.push({ manifest, audit });
            for (let i = 0; i < slots.length; i += 2) {
                const condition = schedule.length / 2 + 1;
                for (const slot of slots.slice(i, i + 2)) {
                    const id = `${condition}-${slot.candidateColor}`;
                    schedule.push({ id, condition, seed: slot.seed, candidateColor: slot.candidateColor });
                    provenance.push({ id, sourceIndex, sourceSlot: slot.id, initialSha256: sha(Buffer.from(String(slot.seed))) });
                }
            }
        }
        const data = { schema: 'cpu-common-development-set.v1', formalReuse: false, sources, schedule, provenance,
            rulesRuntime: { root, sha256: 'a'.repeat(64) } };
        const reference = save('set.json', data), replay = { ...spec, developmentSet: reference };
        const fixed = loadAuditedDevelopmentSet(reference, ledger);
        expect(fixed.schedule).toEqual(schedule);
        expect(makeExperimentSchedule(replay, new Set(schedule.map(s => s.seed)), fixed.schedule).schedule).toEqual(schedule);
        expect(() => makeExperimentSchedule({ ...replay, mode: 'acceptance', paired: 15 }, new Set(), fixed.schedule)).toThrow('only be replayed');
        expect(() => makeExperimentSchedule(replay, new Set(), fixed.schedule)).toThrow('unissued');
        expect(() => loadAuditedDevelopmentSet(reference, [])).toThrow('issued audited');
        expect(() => loadAuditedDevelopmentSet(save('subset.json', { ...data, schedule: schedule.slice(0, 10) }), ledger)).toThrow('order or source membership');
        expect(() => loadAuditedDevelopmentSet(save('reordered.json', { ...data, schedule: schedule.slice().reverse() }), ledger)).toThrow('order or source membership');
        expect(() => loadAuditedDevelopmentSet(save('deal.json', { ...data, provenance: provenance.map((p, i) => i ? p : { ...p, initialSha256: 'f'.repeat(64) }) }), ledger)).toThrow('order or source membership');
        fs.appendFileSync(reference.path, ' ');
        expect(() => loadAuditedDevelopmentSet(reference, ledger)).toThrow('evidence changed');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
