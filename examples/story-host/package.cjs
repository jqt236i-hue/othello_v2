const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('release/CardReversiStory');
fs.mkdirSync(out,{recursive:true});
fs.cpSync('node_modules/electron/dist',out,{recursive:true});
const app=path.join(out,'resources/app');fs.mkdirSync(app,{recursive:true});
for(const file of ['package.json','main.cjs','preload.cjs','storage.cjs'])fs.copyFileSync(file,path.join(app,file));
fs.cpSync('web',path.join(app,'web'),{recursive:true});
fs.cpSync('node_modules/@card-reversi/battle',path.join(app,'node_modules/@card-reversi/battle'),{recursive:true});
console.log(out);
