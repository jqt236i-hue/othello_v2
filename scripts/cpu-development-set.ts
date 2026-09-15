import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import type { ExperimentSlot } from './cpu-experiment-protocol';

export type DevelopmentSetReference = { path: string; sha256: string };
const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
function receipt(reference: DevelopmentSetReference) {
    const bytes = fs.readFileSync(reference.path);
    if (hash(bytes) !== reference.sha256) throw new Error('Development set evidence changed');
    return JSON.parse(bytes.toString('utf8'));
}

/** A common development set includes every completed game of each audited
 * source trial. Its order and provenance are bound before any comparison.
 * No per-candidate selection, fresh seed, or formal reuse is permitted. */
export function loadAuditedDevelopmentSet(reference: DevelopmentSetReference, ledger: readonly any[]) {
    const set = receipt(reference);
    if (set.schema !== 'cpu-common-development-set.v1' || set.formalReuse !== false
        || !Array.isArray(set.sources) || !set.sources.length
        || typeof set.rulesRuntime?.root !== 'string' || !/^[a-f0-9]{64}$/.test(set.rulesRuntime?.sha256)) throw new Error('Invalid common development set');
    const schedule: ExperimentSlot[] = [], provenance: any[] = [];
    const seen = new Set<number>();
    for (let sourceIndex = 0; sourceIndex < set.sources.length; sourceIndex++) {
        const source = set.sources[sourceIndex], manifest = receipt(source.manifest), audit = receipt(source.audit);
        if (manifest.spec?.mode !== 'acceptance' || manifest.spec?.acceptance !== 'lv12'
            || audit.valid !== true || audit.manifestSha256 !== source.manifest.sha256
            || !ledger.some(entry => entry.mode === 'acceptance' && path.resolve(entry.directory) === path.dirname(path.resolve(source.manifest.path)))) {
            throw new Error('Common development source must be an issued audited Lv12 formal trial');
        }
        const count = audit.earlyStopped === true ? 10 : audit.complete === true ? 30 : 0;
        if (!count || audit.completed !== count || audit.games?.length !== count || manifest.schedule?.length !== 30) {
            throw new Error('Common development source must include every completed game');
        }
        const slots = manifest.schedule.slice(0, count);
        for (let index = 0; index < count; index += 2) {
            const a = slots[index], b = slots[index + 1], condition = schedule.length / 2 + 1;
            if (seen.has(a.seed) || a.seed !== b.seed || a.condition !== b.condition
                || a.candidateColor === b.candidateColor) throw new Error('Duplicate or incomplete development pair');
            seen.add(a.seed);
            let initial: string | undefined;
            for (const slot of [a, b]) {
                const game = audit.games.find((entry: any) => entry.slot.id === slot.id);
                if (!game?.valid || game.status !== 'complete' || JSON.stringify(game.slot) !== JSON.stringify(slot)
                    || !/^[a-f0-9]{64}$/.test(game.initialSha256)
                    || (initial !== undefined && initial !== game.initialSha256)) throw new Error('Development source game/deal mismatch');
                initial = game.initialSha256;
                const id = `${condition}-${slot.candidateColor}`;
                schedule.push({ id, condition, seed: slot.seed, candidateColor: slot.candidateColor });
                provenance.push({ id, sourceIndex, sourceSlot: slot.id, initialSha256: game.initialSha256 });
            }
        }
    }
    if (JSON.stringify(set.schedule) !== JSON.stringify(schedule) || JSON.stringify(set.provenance) !== JSON.stringify(provenance)) {
        throw new Error('Common development order or source membership changed');
    }
    return { schedule, rulesRuntime: set.rulesRuntime as { root: string; sha256: string },
        evidence: { reference: { path: path.resolve(reference.path), sha256: reference.sha256 },
        sources: set.sources, provenance, rulesRuntime: set.rulesRuntime,
        scope: 'Fixed common development set; all source conditions remain forbidden for formal reuse' } };
}
