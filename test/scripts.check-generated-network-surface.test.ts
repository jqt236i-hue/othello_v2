import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    checkGeneratedNetworkSurface,
    collectNetworkSurfaceMarkersFromText,
    compareNetworkSurfaceMarkers
} from '../scripts/check-generated-network-surface';

function writeFixture(rootDir: string, relativePath: string, text: string): void {
    const fullPath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, text, 'utf8');
}

describe('generated network surface checker', () => {
    test('detects stale generated network surface markers', () => {
        const source = collectNetworkSurfaceMarkersFromText(`
            const SSE_RESUME_BUFFER_LIMIT = 8;
            const PRESENTATION_JOURNAL_LIMIT = 8;
            room.presentationJournalBaseVisualSeq = 1;
            room.presentationJournalBaseSnapshotByViewer = {};
        `);
        const stale = collectNetworkSurfaceMarkersFromText(`
            const SSE_RESUME_BUFFER_LIMIT = 96;
        `);

        expect(compareNetworkSurfaceMarkers({ source, generated: stale })).toEqual([
            'SSE_RESUME_BUFFER_LIMIT mismatch: source=8 generated=96',
            'PRESENTATION_JOURNAL_LIMIT missing from generated',
            'presentationJournalBaseVisualSeq missing from generated',
            'presentationJournalBaseSnapshotByViewer missing from generated'
        ]);
    });

    test('checks all configured generated paths against source markers', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'network-surface-'));
        const sourceText = `
            const SSE_RESUME_BUFFER_LIMIT = 8;
            const PRESENTATION_JOURNAL_LIMIT = 8;
            room.presentationJournalBaseVisualSeq = 1;
            room.presentationJournalBaseSnapshotByViewer = {};
        `;
        writeFixture(rootDir, 'utils/match-authority.ts', sourceText);
        writeFixture(rootDir, 'dist/utils/match-authority.js', sourceText);
        writeFixture(rootDir, 'public/module-registry.js', sourceText);
        writeFixture(rootDir, 'worker-public/public/module-registry.js', sourceText);

        expect(checkGeneratedNetworkSurface(rootDir)).toEqual([]);

        writeFixture(rootDir, 'public/module-registry.js', 'const SSE_RESUME_BUFFER_LIMIT = 96;');

        expect(checkGeneratedNetworkSurface(rootDir)).toEqual([
            'public/module-registry.js: SSE_RESUME_BUFFER_LIMIT mismatch: source=8 generated=96',
            'public/module-registry.js: PRESENTATION_JOURNAL_LIMIT missing from generated',
            'public/module-registry.js: presentationJournalBaseVisualSeq missing from generated',
            'public/module-registry.js: presentationJournalBaseSnapshotByViewer missing from generated'
        ]);
    });
});
