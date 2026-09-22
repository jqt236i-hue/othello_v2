const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('storyStorage',{load:()=>ipcRenderer.invoke('story:load'),save:value=>ipcRenderer.invoke('story:save',value)});
