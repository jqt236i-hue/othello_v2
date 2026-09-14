import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import { productionRuntimeManifest } from './run-production-selfplay';

const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');

/** Copy the complete Node game runtime, including the catalog JSON loaded by
 * its compiled wrapper. No junctions or mutable dependency links are used.
 * The production policy/runtime currently imports Node built-ins only. */
export function freezeProductionRuntime(root: string, destination: string) {
    if (fs.existsSync(destination)) throw new Error('Runtime snapshot already exists');
    const manifest = productionRuntimeManifest(root);
    for (const file of manifest.files) {
        const source = path.join(manifest.root, file.path), target = path.join(destination, file.path);
        const bytes = fs.readFileSync(source);
        if (hash(bytes) !== file.sha256) throw new Error(`Runtime changed while copying: ${file.path}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes, { flag: 'wx' });
    }
    const result = productionRuntimeManifest(destination);
    if (result.sha256 !== manifest.sha256) throw new Error('Frozen runtime differs from source');
    const sources: any[] = [];
    for (const file of manifest.files) {
        if (!file.path.startsWith('dist/') || !file.path.endsWith('.js')) continue;
        const relative = file.path.slice(5, -3) + '.ts', source = path.join(manifest.root, relative);
        if (!fs.existsSync(source)) continue;
        const bytes = fs.readFileSync(source), target = path.join(destination, 'source-at-declaration', relative);
        fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' });
        sources.push({ path: relative, sha256: hash(bytes) });
    }
    fs.writeFileSync(path.join(destination, 'snapshot.json'), JSON.stringify({ originalRoot: manifest.root,
        runtimeSha256: result.sha256, sources, at: new Date().toISOString() }, null, 2), { flag: 'wx' });
    return result;
}
