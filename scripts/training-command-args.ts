declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function normalizeArgs(args: any): string[] {
    return Array.isArray(args) ? args.map((one) => String(one)) : [];
}

function stripLeadingScriptArg(args: string[]): string[] {
    const normalized = normalizeArgs(args);
    if (normalized.length > 0 && /\.js$/i.test(String(normalized[0] || '').trim())) {
        return normalized.slice(1);
    }
    return normalized;
}

function collectCliFlagMap(args: string[]): Map<string, string | boolean> {
    const normalized = normalizeArgs(args);
    const map = new Map<string, string | boolean>();
    for (let i = 0; i < normalized.length; i++) {
        const token = String(normalized[i] || '').trim();
        if (!token.startsWith('--')) continue;
        const next = String(normalized[i + 1] || '').trim();
        if (next && !next.startsWith('--')) {
            map.set(token, normalized[i + 1]);
            i += 1;
            continue;
        }
        map.set(token, true);
    }
    return map;
}

function getFlagValue(flagMap: Map<string, string | boolean>, flag: string): string | boolean | undefined {
    if (!(flagMap instanceof Map)) return undefined;
    return flagMap.has(flag) ? flagMap.get(flag) : undefined;
}

function hasFlag(flagMap: Map<string, string | boolean>, flag: string): boolean {
    return getFlagValue(flagMap, flag) !== undefined;
}

export = { 
    normalizeArgs,
    stripLeadingScriptArg,
    collectCliFlagMap,
    getFlagValue,
    hasFlag
 } as any;
