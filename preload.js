// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  exitApp: () => ipcRenderer.send('exit-app'),
  
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  processImages: (args) => ipcRenderer.invoke('process-images', args),

  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveNewTemplate: (data) => ipcRenderer.invoke('save-new-template', data),
  updateTemplateVisibility: (data) => ipcRenderer.invoke('update-template-visibility', data),
  updateTemplateConfig: (data) => ipcRenderer.invoke('update-template-config', data),
  deleteTemplate: (data) => ipcRenderer.invoke('delete-template', data) // PENAMBAHAN BARU
});