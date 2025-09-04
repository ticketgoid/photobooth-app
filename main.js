// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const GIFEncoder = require('gif-encoder-2');
const { createCanvas, loadImage } = require('canvas');
const express = require('express');
const os = require('os');
const qrcode = require('qrcode'); // <-- Pustaka diimpor di sini

// --- FUNGSI UNTUK MENDAPATKAN ALAMAT IP LOKAL ---
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            const { address, family, internal } = iface;
            if (family === 'IPv4' && !internal) {
                return address;
            }
        }
    }
    return 'localhost';
}

// --- SERVER SETUP ---
const PORT = 3000;
const localIp = getLocalIpAddress();
let downloadLinks = {}; // Untuk menyimpan path file

function startServer() {
    const server = express();
    
    // Sajikan file statis dari folder outputs
    server.use('/files', express.static(getAppPath('outputs')));

    // Halaman unduhan dinamis
    server.get('/download/:id', (req, res) => {
        const { id } = req.params;
        const files = downloadLinks[id];

        if (!files) {
            return res.status(404).send('Halaman tidak ditemukan atau sudah kedaluwarsa.');
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Unduh Foto Anda</title>
                <style>
                    body { font-family: sans-serif; text-align: center; background-color: #f0f2f5; padding: 20px; }
                    .container { max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                    img { max-width: 100%; border-radius: 8px; margin-bottom: 20px; }
                    a { display: inline-block; padding: 12px 25px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Hasil Foto Anda</h1>
                    <img src="${files.printUrl}" alt="Photostrip">
                    <img src="${files.gifUrl}" alt="GIF Animation">
                    <a href="${files.printUrl}" download>Unduh Foto</a>
                    <a href="${files.gifUrl}" download>Unduh GIF</a>
                </div>
            </body>
            </html>
        `);
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server berjalan di http://${localIp}:${PORT}`);
    });
}


const getAppPath = (folderName) => {
    const appPath = app.getPath('userData');
    const folderPath = path.join(appPath, folderName);
    if (!fs.existsSync(folderPath)) { fs.mkdirSync(folderPath, { recursive: true }); }
    return folderPath;
};

let templateConfigs;
const configPath = path.join(getAppPath('config'), 'templates.json');
const userTemplatesPath = getAppPath('user_templates');

function initializeTemplateConfig() {
    if (!fs.existsSync(userTemplatesPath)) {
        fs.mkdirSync(userTemplatesPath, { recursive: true });
    }
    if (!fs.existsSync(configPath)) {
        const initialConfigs = {};
        fs.writeFileSync(configPath, JSON.stringify(initialConfigs, null, 2));
        templateConfigs = initialConfigs;
    } else {
        const fileContent = fs.readFileSync(configPath);
        templateConfigs = JSON.parse(fileContent);
    }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    fullscreen: true, kiosk: true, frame: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  ipcMain.on('exit-app', () => { app.quit(); });
  ipcMain.on('toggle-fullscreen', () => { mainWindow.setFullScreen(!mainWindow.isFullScreen()); });
  ipcMain.handle('get-templates', async () => templateConfigs);
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    initializeTemplateConfig();
    startServer();
    createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('update-template-visibility', async (event, { fileName, visible }) => {
    if (templateConfigs[fileName]) {
        templateConfigs[fileName].visible = visible;
        fs.writeFileSync(configPath, JSON.stringify(templateConfigs, null, 2));
        return { success: true };
    }
    return { success: false, error: 'File tidak ditemukan' };
});

ipcMain.handle('update-template-config', async (event, { fileName, configData }) => {
    if (templateConfigs[fileName]) {
        templateConfigs[fileName].photoSize = configData.photoSize;
        templateConfigs[fileName].positions = configData.positions;
        fs.writeFileSync(configPath, JSON.stringify(templateConfigs, null, 2));
        return { success: true };
    }
    return { success: false, error: 'File tidak ditemukan' };
});

ipcMain.handle('delete-template', async (event, { fileName }) => {
    if (templateConfigs[fileName]) {
        try {
            const filePath = templateConfigs[fileName].path;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            delete templateConfigs[fileName];
            fs.writeFileSync(configPath, JSON.stringify(templateConfigs, null, 2));
            return { success: true };
        } catch (error) {
            console.error('Gagal menghapus template:', error);
            return { success: false, error: error.message };
        }
    }
    return { success: false, error: 'File tidak ditemukan' };
});

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png'] }]
    });
    if (!result.canceled) { return result.filePaths[0]; }
    return null;
});

ipcMain.handle('save-new-template', async (event, { tempPath, configData }) => {
    try {
        const fileName = `template-${Date.now()}.png`;
        const newPath = path.join(userTemplatesPath, fileName);
        fs.copyFileSync(tempPath, newPath);
        templateConfigs[fileName] = { ...configData, path: newPath, visible: true };
        fs.writeFileSync(configPath, JSON.stringify(templateConfigs, null, 2));
        return { success: true, newTemplate: { [fileName]: templateConfigs[fileName] }};
    } catch (error) {
        console.error("Gagal menyimpan template:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('process-images', async (event, args) => {
    const { photosBase64, templateFile } = args;
    try {
        const config = templateConfigs[templateFile];
        if (!config) { throw new Error(`Konfigurasi untuk template "${templateFile}" tidak ditemukan.`); }
        
        const templatePath = config.path;
        const { width, height } = await sharp(templatePath).metadata();

        const resizedPhotoBuffers = await Promise.all(photosBase64.map(b64 => {
            const buffer = Buffer.from(b64.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
            return sharp(buffer).resize({ width: config.photoSize.width, height: config.photoSize.height, fit: 'cover', position: 'center' }).toBuffer();
        }));

        const photoLayers = resizedPhotoBuffers.map((buffer, index) => ({ input: buffer, top: config.positions[index].top, left: config.positions[index].left }));
        
        const sessionId = Date.now();
        const printFileName = `print-${sessionId}.jpg`;
        const gifFileName = `gif-${sessionId}.gif`;
        
        const printOutputPath = path.join(getAppPath('outputs'), printFileName);
        const gifOutputPath = path.join(getAppPath('outputs'), gifFileName);

        const finalLayers = [ ...photoLayers, { input: templatePath, top: 0, left: 0 } ];
        
        await sharp({ create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
            .composite(finalLayers)
            .toFile(printOutputPath);

        const gifWidth = 400, gifHeight = 300;
        const canvas = createCanvas(gifWidth, gifHeight);
        const ctx = canvas.getContext('2d');
        const encoder = new GIFEncoder(gifWidth, gifHeight, 'neuquant');
        
        const writeStream = fs.createWriteStream(gifOutputPath);
        encoder.createReadStream().pipe(writeStream);
        encoder.start();
        encoder.setDelay(500);
        for (const b64 of photosBase64) {
            const image = await loadImage(b64);
            ctx.drawImage(image, 0, 0, gifWidth, gifHeight);
            encoder.addFrame(ctx);
        }
        encoder.finish();

        const downloadPageUrl = `http://${getLocalIpAddress()}:${PORT}/download/${sessionId}`;
        downloadLinks[sessionId] = {
            printUrl: `/files/${printFileName}`,
            gifUrl: `/files/${gifFileName}`
        };

        const qrCodeDataUrl = await qrcode.toDataURL(downloadPageUrl, {
            width: 150,
            margin: 1
        });
        
        return { 
            success: true, 
            printPath: printOutputPath, 
            gifPath: gifOutputPath,
            qrCodeDataUrl: qrCodeDataUrl
        };
    } catch (error) {
        console.error('Image processing failed:', error);
        return { success: false, error: error.message };
    }
});