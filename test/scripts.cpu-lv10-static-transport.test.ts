import fs = require('node:fs');
import path = require('node:path');
import os = require('node:os');
import crypto = require('node:crypto');
import {installLv10StaticTransport,verifyLv10StaticTransport,LV10_STATIC_TRANSPORT_VERSION} from '../scripts/cpu-lv10-static-transport';

test('loopback assets are supplied as exact recorded bytes without a TCP fallback; failures remain visible',async()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'lv10-static-test-'));
    try {
        const body=Buffer.from('export const value = "frozen bytes";');fs.writeFileSync(path.join(root,'bridge.js'),body);
        let handler:any;const page:any={route:async (_pattern:string,fn:any)=>{handler=fn;}};
        const audit=await installLv10StaticTransport(page,root,'http://127.0.0.1:8123');
        const route=(url:string)=>({request:()=>({url:()=>url,method:()=> 'GET'}),fulfill:jest.fn(),abort:jest.fn(),continue:jest.fn()});
        const ok=route('http://127.0.0.1:8123/bridge.js?v=1');await handler(ok);
        expect(ok.fulfill).toHaveBeenCalledWith(expect.objectContaining({status:200,body,contentType:'application/javascript; charset=utf-8'}));
        expect(ok.continue).not.toHaveBeenCalled();
        expect(audit.files).toEqual([{path:'bridge.js',sha256:crypto.createHash('sha256').update(body).digest('hex'),bytes:body.length}]);
        const other=route('http://127.0.0.1:8124/bridge.js');await handler(other);expect(other.continue).toHaveBeenCalled();
        const missing=route('http://127.0.0.1:8123/missing.js');await handler(missing);
        expect(missing.abort).toHaveBeenCalledWith('failed');expect(audit.failures).toHaveLength(1);
        fs.writeFileSync(path.join(root,'bridge.js'),'changed');await handler(ok);
        expect(audit.failures[1].error).toContain('changed during comparison');
        const escape=route('http://127.0.0.1:8123/..%2Foutside.js');await handler(escape);
        expect(audit.failures[2].error).toContain('escaped declared root');
    } finally {
        if(path.dirname(root)!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('lv10-static-test-'))throw Error('Unsafe cleanup');
        fs.rmSync(root,{recursive:true,force:true});
    }
});

test('acceptance checks the delivered bootstrap bytes and never hides missing or failed transport',()=>{
    const files=[{path:'index.html',sha256:'index',bytes:10},{path:'vite-dist/assets/bridge-fixture.js',sha256:'bridge',bytes:20}];
    const audit={version:LV10_STATIC_TRANSPORT_VERSION,requests:2,files,failures:[]};
    expect(()=>verifyLv10StaticTransport(audit,files)).not.toThrow();
    expect(()=>verifyLv10StaticTransport(undefined,files)).toThrow('Missing or failed');
    expect(()=>verifyLv10StaticTransport({...audit,failures:[{path:'x',error:'failure'}]},files)).toThrow('Missing or failed');
    expect(()=>verifyLv10StaticTransport({...audit,files:files.slice(0,1)},files)).toThrow('bootstrap files');
    expect(()=>verifyLv10StaticTransport(audit,[])).toThrow('differs from declaration');
    expect(()=>verifyLv10StaticTransport(audit,[{...files[0],sha256:'changed'},files[1]])).toThrow('differs from declaration');
});
