const fs=require('node:fs'),path=require('node:path');
const packageRoot=path.dirname(require.resolve('@card-reversi/battle')).replace(/[\\/]lib[\\/]game[\\/]battle$/,'');
fs.mkdirSync('web/vendor',{recursive:true});
fs.copyFileSync('index.html','web/index.html');
fs.copyFileSync(path.join(packageRoot,'host.mjs'),'web/vendor/host.mjs');
fs.cpSync(path.join(packageRoot,'browser'),'web/vendor/browser',{recursive:true});
