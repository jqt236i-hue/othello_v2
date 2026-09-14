import fs = require('node:fs');
import os = require('node:os');
import path = require('node:path');
import { spawnSync } from 'node:child_process';
import { freezeProductionRuntime } from '../scripts/freeze-production-runtime';
import { createProductionPosition } from '../src/engine/production-match';
import { observeLv10Position } from '../game/ai/cpu-lv10-observation';

test('a frozen production policy loads its catalog and executes independently from the source checkout', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cpu-runtime-freeze-'));
    const snapshot = path.join(parent, 'runtime');
    const manifest = freezeProductionRuntime(process.cwd(), snapshot);
    expect(manifest.files.some(file => file.path === 'cards/catalog.json')).toBe(true);
    const observation = observeLv10Position(createProductionPosition(914091, { black: 10, white: 10 }), 'black');
    fs.writeFileSync(path.join(parent, 'observation.json'), JSON.stringify(observation));
    const result = spawnSync(process.execPath, ['-e',
        "const p=require('./dist/game/ai/cpu-lv11-search'); const o=require('../observation.json'); const r=p.searchLv11(o,{maxTransitions:32}); if(!r.action||r.transitions>32)throw Error('Invalid isolated decision');console.log(JSON.stringify({version:r.version,action:r.action,thirdParty:Object.keys(require.cache).filter(f=>f.includes('node_modules'))}));"
    ], { cwd: snapshot, encoding: 'utf8', windowsHide: true });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout.trim().split('\n').pop()!).thirdParty).toEqual([]);
    expect(() => freezeProductionRuntime(process.cwd(), snapshot)).toThrow('already exists');
}, 60000);
