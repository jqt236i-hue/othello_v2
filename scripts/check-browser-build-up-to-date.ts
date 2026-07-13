import * as fs from 'fs';
import * as path from 'path';
import buildModuleRegistry = require('./build-module-registry');
const { buildRegistry } = buildModuleRegistry;
import syncBrowserScriptVersionsModule = require('./sync-browser-script-versions');
const { syncBrowserScriptVersions } = syncBrowserScriptVersionsModule;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface BrowserBuildCheckResult {
    ok: boolean;
    code: number;
    message: string;
}

function checkBrowserBuildUpToDate(rootDirInput?: string): BrowserBuildCheckResult {
    const rootDir = rootDirInput ? path.resolve(String(rootDirInput)) : process.cwd();
    const registryPath = path.join(rootDir, 'public', 'module-registry.js');
    const optionalRegistryPath = path.join(rootDir, 'public', 'module-registry.optional.js');
    if (!fs.existsSync(registryPath)) {
        return {
            ok: false,
            code: 2,
            message: `[check-browser-build] committed module registry not found: ${registryPath}`
        };
    }

    const registryResult = buildRegistry({
        rootDir,
        write: false,
        log: false,
        syncScriptVersions: false,
        splitRegistries: true
    });
    if (!registryResult) {
        return {
            ok: false,
            code: 2,
            message: `[check-browser-build] dist directory not found: ${path.join(rootDir, 'dist')}`
        };
    }

    const currentRegistry = fs.readFileSync(registryPath, 'utf8');
    if (currentRegistry !== registryResult.startupContent) {
        return {
            ok: false,
            code: 1,
            message: '[check-browser-build] module registry is stale. Run `npm run build:browser`.'
        };
    }

    if (!fs.existsSync(optionalRegistryPath)) {
        return {
            ok: false,
            code: 1,
            message: '[check-browser-build] optional module registry is stale. Run `npm run build:browser`.'
        };
    }
    const currentOptionalRegistry = fs.readFileSync(optionalRegistryPath, 'utf8');
    if (currentOptionalRegistry !== registryResult.optionalContent) {
        return {
            ok: false,
            code: 1,
            message: '[check-browser-build] optional module registry is stale. Run `npm run build:browser`.'
        };
    }

    for (const [group, groupPath] of Object.entries(registryResult.groupOutFiles)) {
        const expectedGroupContent = (registryResult.groupContents as Record<string, string>)[group];
        if (!fs.existsSync(groupPath) || fs.readFileSync(groupPath, 'utf8') !== expectedGroupContent) {
            return {
                ok: false,
                code: 1,
                message: `[check-browser-build] optional ${group} module registry is stale. Run \`npm run build:browser\`.`
            };
        }
    }

    const indexPath = path.join(rootDir, 'index.html');
    const currentIndexHtml = fs.readFileSync(indexPath, 'utf8');
    const syncResult = syncBrowserScriptVersions({ rootDir, write: false });
    if (currentIndexHtml !== syncResult.html) {
        return {
            ok: false,
            code: 1,
            message: '[check-browser-build] index.html script versions are stale. Run `npm run build:browser`.'
        };
    }

    return {
        ok: true,
        code: 0,
        message: '[check-browser-build] browser build assets up-to-date'
    };
}

if (require.main === module) {
    const result = checkBrowserBuildUpToDate();
    if (result.ok) {
        console.log(result.message);
    } else {
        console.error(result.message);
    }
    process.exit(result.code);
}

export = {
    checkBrowserBuildUpToDate
};
