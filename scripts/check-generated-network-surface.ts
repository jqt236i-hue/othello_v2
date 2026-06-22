import * as fs from 'fs';
import * as path from 'path';

export interface NetworkSurfaceMarkers {
    sseResumeBufferLimit: string | null;
    presentationJournalLimit: string | null;
    hasPresentationJournalBaseVisualSeq: boolean;
    hasPresentationJournalBaseSnapshotByViewer: boolean;
}

const DEFAULT_GENERATED_PATHS = [
    'dist/utils/match-authority.js',
    'public/module-registry.js',
    'worker-public/public/module-registry.js'
];

function matchConstant(text: string, name: string): string | null {
    const match = new RegExp(`\\b${name}\\s*=\\s*(\\d+)`).exec(text);
    return match ? match[1] : null;
}

export function collectNetworkSurfaceMarkersFromText(text: string): NetworkSurfaceMarkers {
    return {
        sseResumeBufferLimit: matchConstant(text, 'SSE_RESUME_BUFFER_LIMIT'),
        presentationJournalLimit: matchConstant(text, 'PRESENTATION_JOURNAL_LIMIT'),
        hasPresentationJournalBaseVisualSeq: text.includes('presentationJournalBaseVisualSeq'),
        hasPresentationJournalBaseSnapshotByViewer: text.includes('presentationJournalBaseSnapshotByViewer')
    };
}

export function compareNetworkSurfaceMarkers(input: {
    source: NetworkSurfaceMarkers;
    generated: NetworkSurfaceMarkers;
}): string[] {
    const errors: string[] = [];
    const { source, generated } = input;

    if (source.sseResumeBufferLimit !== generated.sseResumeBufferLimit) {
        errors.push(`SSE_RESUME_BUFFER_LIMIT mismatch: source=${source.sseResumeBufferLimit ?? 'missing'} generated=${generated.sseResumeBufferLimit ?? 'missing'}`);
    }

    if (source.presentationJournalLimit && !generated.presentationJournalLimit) {
        errors.push('PRESENTATION_JOURNAL_LIMIT missing from generated');
    } else if (source.presentationJournalLimit !== generated.presentationJournalLimit) {
        errors.push(`PRESENTATION_JOURNAL_LIMIT mismatch: source=${source.presentationJournalLimit ?? 'missing'} generated=${generated.presentationJournalLimit ?? 'missing'}`);
    }

    if (source.hasPresentationJournalBaseVisualSeq && !generated.hasPresentationJournalBaseVisualSeq) {
        errors.push('presentationJournalBaseVisualSeq missing from generated');
    }

    if (source.hasPresentationJournalBaseSnapshotByViewer && !generated.hasPresentationJournalBaseSnapshotByViewer) {
        errors.push('presentationJournalBaseSnapshotByViewer missing from generated');
    }

    return errors;
}

function readMarkers(rootDir: string, relativePath: string): NetworkSurfaceMarkers {
    const fullPath = path.join(rootDir, relativePath);
    return collectNetworkSurfaceMarkersFromText(fs.readFileSync(fullPath, 'utf8'));
}

export function checkGeneratedNetworkSurface(rootDir = process.cwd(), generatedPaths = DEFAULT_GENERATED_PATHS): string[] {
    const sourcePath = 'utils/match-authority.ts';
    const fullSourcePath = path.join(rootDir, sourcePath);
    if (!fs.existsSync(fullSourcePath)) {
        return [`${sourcePath} missing`];
    }

    const source = readMarkers(rootDir, sourcePath);
    const errors: string[] = [];
    for (const relativePath of generatedPaths) {
        const fullPath = path.join(rootDir, relativePath);
        if (!fs.existsSync(fullPath)) {
            errors.push(`${relativePath} missing`);
            continue;
        }
        const generated = readMarkers(rootDir, relativePath);
        for (const message of compareNetworkSurfaceMarkers({ source, generated })) {
            errors.push(`${relativePath}: ${message}`);
        }
    }
    return errors;
}

if (require.main === module) {
    const errors = checkGeneratedNetworkSurface(process.cwd());
    if (errors.length > 0) {
        for (const error of errors) {
            console.error(error);
        }
        process.exit(1);
    }
    console.log('generated network surface is in sync');
}
