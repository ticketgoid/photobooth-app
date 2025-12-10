const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Navigasi
    exitApp: () => ipcRenderer.send('exit-app'),
    
    // Template Management
    getTemplates: () => ipcRenderer.invoke('get-templates'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveNewTemplate: (data) => ipcRenderer.invoke('save-new-template', data),
    updateTemplateConfig: (data) => ipcRenderer.invoke('update-template-config', data),
    deleteTemplate: (data) => ipcRenderer.invoke('delete-template', data),
    
    // Core Photo Processing
    processImages: (data) => ipcRenderer.invoke('process-images', data),

    // [BARU] Fungsi Pembayaran
    createQrisTransaction: (amount) => ipcRenderer.invoke('create-qris-transaction', amount),
    checkPaymentStatus: (orderId) => ipcRenderer.invoke('check-payment-status', orderId),

    // [BARU] Fungsi Video & Review
    saveTempVideo: (data) => ipcRenderer.invoke('save-temp-video', data), // [BARU]
});