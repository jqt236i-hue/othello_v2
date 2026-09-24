import * as fs from 'fs';
import * as path from 'path';

/** Reads the root `_headers` file with the subset of the Cloudflare Workers
 * Static Assets rules that this repository uses: path patterns with at most one
 * `*` splat, indented `Name: value` lines, `#` comments. Query strings never
 * take part in matching, as on the edge. Local servers use this so a smoke test
 * sees the same Cache-Control as production. */

export type StaticAssetHeaderRule = Readonly<{ pattern: string; headers: Readonly<Record<string, string>> }>;

/** Default for static assets without a matching rule (Cloudflare documentation). */
export const DEFAULT_STATIC_ASSET_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

export function parseStaticAssetHeaders(text: string): StaticAssetHeaderRule[] {
    const rules: Array<{ pattern: string; headers: Record<string, string> }> = [];
    for (const rawLine of String(text || '').split(/\r?\n/)) {
        if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
        if (!/^\s/.test(rawLine)) {
            const pattern = rawLine.trim();
            if (!pattern.startsWith('/')) throw new Error(`_headers pattern must be a path: ${pattern}`);
            if ((pattern.match(/\*/g) || []).length > 1) throw new Error(`_headers pattern may contain one splat: ${pattern}`);
            rules.push({ pattern, headers: {} });
            continue;
        }
        const current = rules[rules.length - 1];
        const separator = rawLine.indexOf(':');
        if (!current || separator < 0) throw new Error(`Invalid _headers line: ${rawLine}`);
        const name = rawLine.slice(0, separator).trim().toLowerCase();
        const value = rawLine.slice(separator + 1).trim();
        current.headers[name] = current.headers[name] ? `${current.headers[name]}, ${value}` : value;
    }
    return rules.map((rule) => Object.freeze({ pattern: rule.pattern, headers: Object.freeze({ ...rule.headers }) }));
}

export function matchesStaticAssetPattern(pattern: string, pathname: string): boolean {
    const splat = pattern.indexOf('*');
    if (splat < 0) return pattern === pathname;
    const prefix = pattern.slice(0, splat), suffix = pattern.slice(splat + 1);
    return pathname.length >= prefix.length + suffix.length && pathname.startsWith(prefix) && pathname.endsWith(suffix);
}

/** Headers for a request path; matching rules combine and repeated names join with a comma. */
export function resolveStaticAssetHeaders(rules: readonly StaticAssetHeaderRule[], pathname: string): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const rule of rules) {
        if (!matchesStaticAssetPattern(rule.pattern, pathname)) continue;
        for (const [name, value] of Object.entries(rule.headers)) {
            headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
        }
    }
    return headers;
}

export function loadStaticAssetHeaders(rootDir: string): StaticAssetHeaderRule[] {
    const file = path.join(rootDir, '_headers');
    return fs.existsSync(file) ? parseStaticAssetHeaders(fs.readFileSync(file, 'utf8')) : [];
}
