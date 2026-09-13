import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import type { Page } from 'playwright';

export const LV10_STATIC_TRANSPORT_VERSION = 'playwright-static-files-v1';
export type Lv10StaticTransportAudit = {
    version:string; requests:number; files:{path:string;sha256:string;bytes:number}[]; failures:{path:string;error:string}[];
};

/** Deliver the declared local files without a second loopback TCP connection.
 * This changes asset transport only; no page state, game action or RNG is read. */
export async function installLv10StaticTransport(page:Page, directory:string, origin:string):Promise<Lv10StaticTransportAudit> {
    const root=path.resolve(directory),prefix=root+path.sep;
    const audit:Lv10StaticTransportAudit={version:LV10_STATIC_TRANSPORT_VERSION,requests:0,files:[],failures:[]};
    if(new URL(origin).hostname!=='127.0.0.1')throw new Error('Static comparison transport requires its loopback origin');
    const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
        '.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
        '.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon',
        '.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg'};
    await page.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.origin!==origin||request.method()!=='GET')return route.continue();
        let relative=url.pathname;
        try {
            relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
            const source=path.resolve(root,relative);
            if(!source.startsWith(prefix))throw new Error('Asset path escaped declared root');
            if(audit.requests>=8192)throw new Error('Static request limit exceeded');
            audit.requests++;
            const body=fs.readFileSync(source),sha256=crypto.createHash('sha256').update(body).digest('hex');
            const existing=audit.files.find(file=>file.path===relative);
            if(existing&&existing.sha256!==sha256)throw new Error('Asset changed during comparison');
            if(!existing){
                if(audit.files.length>=2048)throw new Error('Static file limit exceeded');
                audit.files.push({path:relative,sha256,bytes:body.length});
            }
            await route.fulfill({status:200,body,contentType:mime[path.extname(source).toLowerCase()]||'application/octet-stream'});
        } catch(error) {
            audit.failures.push({path:relative,error:String(error)});
            await route.abort('failed');
        }
    });
    return audit;
}

export function verifyLv10StaticTransport(audit:Lv10StaticTransportAudit|undefined, runtime:{path:string;sha256:string}[]):void {
    if(!audit||audit.version!==LV10_STATIC_TRANSPORT_VERSION||audit.requests<1||!audit.files.length||audit.failures.length)
        throw new Error('Missing or failed static comparison transport');
    const hashes=new Map(runtime.map(file=>[file.path.replace(/\\/g,'/'),file.sha256]));
    if(!audit.files.some(file=>file.path==='index.html')||!audit.files.some(file=>/^vite-dist\/assets\/bridge-.*\.js$/.test(file.path)))
        throw new Error('Static comparison bootstrap files were not recorded');
    for(const file of audit.files){
        const expected=hashes.get(file.path);
        const isRuntime=file.path==='index.html'||file.path.startsWith('vite-dist/')||file.path.startsWith('public/');
        if((isRuntime&&!expected)||(expected&&expected!==file.sha256))throw new Error(`Supplied runtime differs from declaration: ${file.path}`);
    }
}
