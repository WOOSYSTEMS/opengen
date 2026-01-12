const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  requestMediaAccess: (type) => ipcRenderer.invoke('request-media-access', type)
});
