import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface ExtractOptions {
    inputPath?: string;
    outputPath?: string;
    limit?: number;
    primaryTag?: string;
}

interface ExtractArgs {
    input: string;
    out: string;
    summaryOut: string;
    limit: number;
    primaryTag: string;
    help: boolean;
}

interface ExtractSummary {
    schemaVersion: string;
    generatedAt: string;
    inputPath: string;
    outputPath: string;
    recordsRead: number;
    recordsWritten: number;
    parseErrors: number;
    hardcaseTagCounts: Record<string, number>;
    primaryTagCounts: Record<string, number>;
    actionTypeCounts: Record<string, number>;
    pendingTypeCounts: Record<string, number>;
    seedFamilyCounts: Record<string, number>;
    dataLaneCounts: Record<string, number>;
}

function buildDefaultHardcaseOutPath(inputPath: string): string {
    const resolvedInputPath = path.resolve(process.cwd(), String(inputPath || 'data/selfplay.ndjson'));
    const dir = path.dirname(resolvedInputPath);
    const ext = path.extname(resolvedInputPath) || '.ndjson';
    const base = path.basename(resolvedInputPath, ext);
    return path.join(dir, `${base}.hardcase${ext}`);
}

function buildDefaultSummaryOutPath(outputPath: string): string {
    const resolvedOutputPath = path.resolve(process.cwd(), String(outputPath || 'data/selfplay.hardcase.ndjson'));
    const ext = path.extname(resolvedOutputPath) || '.json';
    return `${resolvedOutputPath.slice(0, -ext.length)}.summary.json`;
}

function isHardcaseRecord(record: any): boolean {
    if (!record || typeof record !== 'object') return false;
    if (record.isHardcase === true) return true;
    return Array.isArray(record.hardcaseTags) && record.hardcaseTags.length > 0;
}

function incrementCounter(map: Record<string, number>, key: any) {
    const safeKey = String(key || 'unknown').trim() || 'unknown';
    map[safeKey] = Number(map[safeKey] || 0) + 1;
}

function createSummary(inputPath: string, outputPath: string): ExtractSummary {
    return {
        schemaVersion: 'hardcase_extract.v1',
        generatedAt: new Date().toISOString(),
        inputPath,
        outputPath,
        recordsRead: 0,
        recordsWritten: 0,
        parseErrors: 0,
        hardcaseTagCounts: {},
        primaryTagCounts: {},
        actionTypeCounts: {},
        pendingTypeCounts: {},
        seedFamilyCounts: {},
        dataLaneCounts: {}
    };
}

function addRecordToSummary(summary: ExtractSummary, record: any) {
    summary.recordsWritten += 1;
    incrementCounter(summary.actionTypeCounts, record && record.actionType ? record.actionType : 'unknown');
    incrementCounter(summary.pendingTypeCounts, record && record.pendingType ? record.pendingType : 'none');
    incrementCounter(summary.seedFamilyCounts, record && record.seedFamily ? record.seedFamily : 'unknown');
    incrementCounter(summary.dataLaneCounts, record && record.dataLane ? record.dataLane : 'unknown');
    incrementCounter(summary.primaryTagCounts, record && record.hardcasePrimaryTag ? record.hardcasePrimaryTag : 'unknown');
    const tags = Array.isArray(record && record.hardcaseTags) ? record.hardcaseTags : [];
    for (const tag of tags) incrementCounter(summary.hardcaseTagCounts, tag);
}

async function extractHardcases(options: ExtractOptions): Promise<ExtractSummary> {
    const inputPath = path.resolve(process.cwd(), String(options && options.inputPath ? options.inputPath : ''));
    const outputPath = path.resolve(process.cwd(), String(options && options.outputPath ? options.outputPath : buildDefaultHardcaseOutPath(inputPath)));
    const summary = createSummary(inputPath, outputPath);
    const limit = Number.isFinite(options && options.limit) ? Math.max(0, Math.floor(options.limit!)) : 0;
    const primaryTag = options && typeof options.primaryTag === 'string' && options.primaryTag.trim()
        ? options.primaryTag.trim()
        : '';

    if (!inputPath || !fs.existsSync(inputPath)) {
        throw new Error(`input file not found: ${inputPath || '(empty)'}`);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const reader = readline.createInterface({
        input: fs.createReadStream(inputPath, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    const writer = fs.createWriteStream(outputPath, { encoding: 'utf8' });

    try {
        for await (const rawLine of reader) {
            const line = String(rawLine || '').trim();
            if (!line) continue;
            summary.recordsRead += 1;
            let record: any = null;
            try {
                record = JSON.parse(line);
            } catch (_) {
                summary.parseErrors += 1;
                continue;
            }
            if (!isHardcaseRecord(record)) continue;
            if (primaryTag) {
                const primary = String(record && record.hardcasePrimaryTag ? record.hardcasePrimaryTag : '').trim();
                const tags = Array.isArray(record && record.hardcaseTags)
                    ? record.hardcaseTags.map((one: any) => String(one || '').trim())
                    : [];
                if (primary !== primaryTag && !tags.includes(primaryTag)) continue;
            }
            writer.write(`${JSON.stringify(record)}\n`);
            addRecordToSummary(summary, record);
            if (limit > 0 && summary.recordsWritten >= limit) break;
        }
    } finally {
        await new Promise<void>((resolve) => writer.end(resolve));
        reader.close();
    }

    summary.generatedAt = new Date().toISOString();
    return summary;
}

function parseArgs(argv: string[]): ExtractArgs {
    const args: ExtractArgs = {
        input: '',
        out: '',
        summaryOut: '',
        limit: 0,
        primaryTag: '',
        help: false
    };
    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || '');
        if (token === '--help' || token === '-h') { args.help = true; continue; }
        if (token === '--input') { args.input = String(argv[++i] || '').trim(); continue; }
        if (token === '--out' || token === '-o') { args.out = String(argv[++i] || '').trim(); continue; }
        if (token === '--summary-out') { args.summaryOut = String(argv[++i] || '').trim(); continue; }
        if (token === '--limit') { args.limit = Number(argv[++i]); continue; }
        if (token === '--primary-tag') { args.primaryTag = String(argv[++i] || '').trim(); continue; }
    }
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/extract-hardcases.js --input <selfplay.ndjson> [options]',
        '',
        'Options:',
        '      --input <path>        Input NDJSON path',
        '  -o, --out <path>          Output hardcase NDJSON path',
        '      --summary-out <path>  Output summary JSON path',
        '      --limit <n>           Optional max records to write',
        '      --primary-tag <tag>   Filter by hardcase primary tag',
        '  -h, --help                Show this help'
    ].join('\n'));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    if (!args.input) throw new Error('--input is required');
    const outputPath = args.out ? path.resolve(process.cwd(), args.out) : buildDefaultHardcaseOutPath(args.input);
    const summary = await extractHardcases({
        inputPath: args.input,
        outputPath,
        limit: args.limit,
        primaryTag: args.primaryTag
    });
    const summaryOut = args.summaryOut
        ? path.resolve(process.cwd(), args.summaryOut)
        : buildDefaultSummaryOutPath(outputPath);
    fs.mkdirSync(path.dirname(summaryOut), { recursive: true });
    fs.writeFileSync(summaryOut, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`[hardcase-extract] out=${outputPath}`);
    console.log(`[hardcase-extract] summary=${summaryOut}`);
    console.log(`[hardcase-extract] records=${summary.recordsWritten}/${summary.recordsRead} parseErrors=${summary.parseErrors}`);
}

if (require.main === module) {
    main().catch((err: any) => {
        console.error('[hardcase-extract] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

export = { 
    buildDefaultHardcaseOutPath,
    buildDefaultSummaryOutPath,
    isHardcaseRecord,
    extractHardcases
 } as any;
