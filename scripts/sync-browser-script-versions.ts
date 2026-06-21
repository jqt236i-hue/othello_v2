import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface BrowserScriptVersionEntry {
    relativePath: string;
}

interface SyncBrowserScriptVersionsOptions {
    rootDir?: string;
    indexPath?: string;
    entries?: BrowserScriptVersionEntry[];
    write?: boolean;
}

interface BrowserScriptVersionUpdate {
    relativePath: string;
    version: string;
    changed: boolean;
}

interface SyncBrowserScriptVersionsResult {
    html: string;
    indexPath: string;
    wroteFile: boolean;
    updates: BrowserScriptVersionUpdate[];
}

const DEFAULT_BROWSER_SCRIPT_VERSION_ENTRIES: readonly BrowserScriptVersionEntry[] = Object.freeze([
    { relativePath: 'public/runtime.js' },
    { relativePath: 'public/module-registry.js' },
    { relativePath: 'entry-browser.js' }
]);

function escapeRegExp(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeScriptVersionToken(filePath: string): string {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    return BigInt(`0x${hash.slice(0, 12)}`).toString(10);
}

function buildScriptTagPattern(relativePath: string): RegExp {
    const escapedPath = escapeRegExp(relativePath);
    return new RegExp(`(<script\\s+[^>]*src=["'])${escapedPath}(?:\\?v=[^"'<>]*)?(["'][^>]*><\\/script>)`);
}

function syncBrowserScriptVersions(options?: SyncBrowserScriptVersionsOptions): SyncBrowserScriptVersionsResult {
    const opts = (options && typeof options === 'object') ? options : {};
    const rootDir = opts.rootDir ? path.resolve(String(opts.rootDir)) : path.resolve(__dirname, '..');
    const indexPath = opts.indexPath ? path.resolve(String(opts.indexPath)) : path.join(rootDir, 'index.html');
    const entries = Array.isArray(opts.entries) && opts.entries.length > 0
        ? opts.entries.slice()
        : DEFAULT_BROWSER_SCRIPT_VERSION_ENTRIES.slice();
    const shouldWrite = opts.write !== false;

    if (!fs.existsSync(indexPath)) {
        throw new Error(`index file not found: ${indexPath}`);
    }

    let html = fs.readFileSync(indexPath, 'utf8');
    const updates: BrowserScriptVersionUpdate[] = [];

    for (const entry of entries) {
        const relativePath = String(entry && entry.relativePath ? entry.relativePath : '').trim();
        if (!relativePath) continue;
        const filePath = path.join(rootDir, relativePath);
        if (!fs.existsSync(filePath)) {
            throw new Error(`script file not found: ${filePath}`);
        }

        const version = computeScriptVersionToken(filePath);
        const pattern = buildScriptTagPattern(relativePath);
        if (!pattern.test(html)) {
            throw new Error(`script tag not found for ${relativePath} in ${indexPath}`);
        }

        const nextHtml = html.replace(pattern, `$1${relativePath}?v=${version}$2`);
        updates.push({
            relativePath,
            version,
            changed: nextHtml !== html
        });
        html = nextHtml;
    }

    let wroteFile = false;
    if (shouldWrite) {
        const current = fs.readFileSync(indexPath, 'utf8');
        if (current !== html) {
            fs.writeFileSync(indexPath, html, 'utf8');
            wroteFile = true;
        }
    }

    return {
        html,
        indexPath,
        wroteFile,
        updates
    };
}

export = {
    DEFAULT_BROWSER_SCRIPT_VERSION_ENTRIES,
    computeScriptVersionToken,
    syncBrowserScriptVersions
};
