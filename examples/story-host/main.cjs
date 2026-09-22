const {app,BrowserWindow,ipcMain} = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {createStorage} = require('./storage.cjs');
let server;
if (process.argv.includes('--smoke')) app.setPath('userData', path.join(__dirname, '.smoke-data'));
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  const storage = createStorage(path.join(app.getPath('userData'),'progress'));
  const web = path.join(__dirname,'web');
  const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
  server = http.createServer((req,res) => {
    let name; try { name = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
    const target = path.resolve(web,'.' + (name === '/' ? '/index.html' : name));
    if (!target.startsWith(web + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {res.writeHead(404).end();return;}
    res.setHeader('Content-Type',types[path.extname(target)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const window = new BrowserWindow({width:1440,height:1000,show:!process.argv.includes('--smoke'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:!process.argv.includes('--smoke')}});
  const owner = event => { if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw Error('保存の呼び出し元が不正です'); };
  ipcMain.handle('story:load',event=>{owner(event);return storage.load()});
  ipcMain.handle('story:save',(event,value)=>{owner(event);return storage.save(value)});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault()});
  window.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(origin + '/') && !details.url.startsWith('data:') && !details.url.startsWith('blob:')}));
  await window.loadURL(origin);
  if (process.argv.includes('--smoke')) {
    try {
      await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{if(document.documentElement.dataset.storyReady==='true'){clearInterval(timer);resolve(true)}else if(Date.now()-start>15000){clearInterval(timer);reject(Error(document.body.innerText))}},50)})`);
      const result = await window.webContents.executeJavaScript(`(document.getElementById('resume').hidden ? document.getElementById('start') : document.getElementById('resume')).click(); new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{const api=document.querySelector('iframe')?.contentWindow?.CardReversiBattle;if(api?.status==='active'&&!document.getElementById('save').disabled){clearInterval(timer);api.save().then(s=>resolve({phase:s.phase,seed:s.config.seed}),reject)}else if(Date.now()-start>60000){clearInterval(timer);reject(Error('battle boot timeout'))}},100)})`);
      fs.writeFileSync(path.join(__dirname,'smoke-result.json'),JSON.stringify({ok:true,result}));
      fs.writeFileSync(path.join(__dirname,'smoke.png'),(await window.webContents.capturePage()).toPNG());
      console.log('STORY_DESKTOP_SMOKE_OK'); app.exit(0);
    } catch(error) {const details=await window.webContents.executeJavaScript(`({text:document.body.innerText,frame:document.querySelector('iframe')?.contentDocument?.body?.innerText})`);fs.writeFileSync(path.join(__dirname,'smoke-result.json'),JSON.stringify({ok:false,error:String(error),details}));console.error(error);app.exit(1)}
  }
}).catch(error=>{if(process.argv.includes('--smoke'))fs.writeFileSync(path.join(__dirname,'smoke-result.json'),JSON.stringify({ok:false,error:String(error)}));console.error(error);app.exit(1)});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>server?.close());
