const midtransClient = require('midtrans-client'); // [BARU]
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const os = require('os');
const qrcode = require('qrcode');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer'); // Opsional jika belum install, bisa dikomentari

// --- KONFIGURASI PATH ---
const getAppPath = (folder) => {
    const p = path.join(app.getPath('userData'), folder);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    return p;
};

// Lokasi penyimpanan data
const TEMPLATE_CONFIG_PATH = path.join(getAppPath('config'), 'templates.json');
const USER_TEMPLATES_PATH = getAppPath('user_templates');
const OUTPUT_PATH = getAppPath('outputs');

// --- INISIALISASI DATA ---
let templateConfigs = {};
if (fs.existsSync(TEMPLATE_CONFIG_PATH)) {
    templateConfigs = JSON.parse(fs.readFileSync(TEMPLATE_CONFIG_PATH));
}

function saveConfig() {
    fs.writeFileSync(TEMPLATE_CONFIG_PATH, JSON.stringify(templateConfigs, null, 2));
}

const MIDTRANS_SERVER_KEY = 'Mid-server-xXmapfVff14t6mjFDbh0uA5K'; 

const coreApi = new midtransClient.CoreApi({
    isProduction: false,
    serverKey: MIDTRANS_SERVER_KEY,
    clientKey: 'Mid-client-bm1UIHZ9NBwbp1QW' // Opsional untuk Core API
});

// --- IPC HANDLERS PEMBAYARAN ---

// 1. Buat Transaksi QRIS
ipcMain.handle('create-qris-transaction', async (event, amount) => {
    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const parameter = {
        payment_type: "qris",
        transaction_details: {
            order_id: orderId,
            gross_amount: amount // Harga dari parameter (nanti bisa dinamis)
        },
        qris: {
            acquirer: "gopay" // Di sandbox biasanya pakai simulator gopay
        }
    };

    try {
        const chargeResponse = await coreApi.charge(parameter);
        
        // Midtrans Core API mengembalikan URL gambar QRIS atau String QR
        // Biasanya ada di actions, atau qr_string
        // Untuk QRIS, biasanya kita dapat 'qr_string' yang harus kita render jadi gambar,
        // ATAU 'actions' yang berisi URL gambar.
        
        // Kita cari action 'generate-qr-code'
        const qrAction = chargeResponse.actions.find(a => a.name === 'generate-qr-code');
        
        if (qrAction) {
            // Jika Midtrans kasih URL gambar langsung
            return { 
                success: true, 
                orderId: orderId, 
                qrUrl: qrAction.url, // URL gambar QR dari Midtrans
                rawResponse: chargeResponse
            };
        } else {
            // Fallback: Jika dapat string, kita generate sendiri pakai library 'qrcode'
            // (Pastikan logic qrcode ada di sini jika midtrans cuma kasih string)
            return { success: false, error: "Gagal mendapatkan QR Code URL" };
        }

    } catch (e) {
        console.error("Midtrans Error:", e.message);
        return { success: false, error: e.message };
    }
});

// 2. Cek Status Transaksi
ipcMain.handle('check-payment-status', async (event, orderId) => {
    try {
        const statusResponse = await coreApi.transaction.status(orderId);
        // Status yang kita cari adalah 'settlement' (berhasil bayar)
        // atau 'capture' (untuk kartu kredit), tapi QRIS pakai settlement.
        return {
            success: true,
            status: statusResponse.transaction_status // 'settlement', 'pending', 'expire', dll
        };
    } catch (e) {
        // Jika order ID belum ditemukan (mungkin delay), anggap pending/error ringan
        return { success: false, error: e.message };
    }
});

// --- WINDOW MANAGEMENT ---
let mainWindow;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        fullscreen: true, // Ubah false jika ingin mode windowed saat dev
        kiosk: false,     // Ubah true untuk mode kiosk produksi
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Mulai dari Landing Page (perhatikan path-nya masuk ke folder landing)
    mainWindow.loadFile(path.join(__dirname, 'landing', 'landing.html')); 
}

// --- IPC HANDLERS (Komunikasi Frontend <-> Backend) ---

ipcMain.handle('get-templates', () => templateConfigs);

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png'] }]
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('save-new-template', async (event, { tempPath, configData }) => {
    try {
        const metadata = await sharp(tempPath).metadata();
        const fileName = `tpl-${Date.now()}.png`;
        const newPath = path.join(USER_TEMPLATES_PATH, fileName);
        
        // Copy file ke folder aplikasi
        fs.copyFileSync(tempPath, newPath);
        
        // Simpan config awal
        templateConfigs[fileName] = {
            path: newPath,
            visible: true,
            metadata: { width: metadata.width, height: metadata.height },
            positions: configData.positions || []
        };
        saveConfig();
        
        return { success: true, newTemplate: { [fileName]: templateConfigs[fileName] } };
    } catch (error) {
        console.error(error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-template-config', async (event, { fileName, configData }) => {
        if (templateConfigs[fileName]) {
            // Update posisi, visibility, DAN HARGA
            templateConfigs[fileName].positions = configData.positions;
            if (configData.visible !== undefined) templateConfigs[fileName].visible = configData.visible;
            
            // [BARU] Simpan Harga
            if (configData.price !== undefined) templateConfigs[fileName].price = parseInt(configData.price);
            
            saveConfig();
            return { success: true };
        }
        return { success: false, error: 'Template tidak ditemukan' };
    });

ipcMain.handle('delete-template', async (event, { fileName }) => {
    if (templateConfigs[fileName]) {
        try {
            if (fs.existsSync(templateConfigs[fileName].path)) {
                fs.unlinkSync(templateConfigs[fileName].path);
            }
            delete templateConfigs[fileName];
            saveConfig();
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    }
    return { success: false };
});

ipcMain.on('exit-app', () => app.quit());

// --- CORE IMAGE PROCESSING ---
ipcMain.handle('process-images', async (event, { photosBase64, templateFile }) => {
    try {
        const config = templateConfigs[templateFile];
        if (!config) throw new Error("Config template hilang");

        // 1. Siapkan Canvas Dasar (Sesuai ukuran template)
        const { width, height } = config.metadata;
        
        // 2. Resize setiap foto sesuai SLOT-nya masing-masing
        const compositeOperations = await Promise.all(photosBase64.map(async (base64, index) => {
            // Ambil data posisi untuk slot ke-index
            // Fallback ke default jika data slot kurang (tapi harusnya tidak karena visual editor)
            const slot = config.positions[index] || { width: 400, height: 300, top: 0, left: 0 };
            
            const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            
            // Resize tepat sesuai kotak yang digambar admin
            const resized = await sharp(buffer)
                .resize({
                    width: slot.width,
                    height: slot.height,
                    fit: 'cover', // Pastikan foto memenuhi kotak (crop jika perlu)
                    position: 'center'
                })
                .toBuffer();

            return { input: resized, top: slot.top, left: slot.left };
        }));

        // 3. Tambahkan Template Frame di paling atas (Overlay)
        compositeOperations.push({ input: config.path, top: 0, left: 0 });

        // 4. Render Final
        const outputFilename = `print-${Date.now()}.png`;
        const outputPath = path.join(OUTPUT_PATH, outputFilename);

        await sharp({
            create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
        })
        .composite(compositeOperations)
        .png()
        .toFile(outputPath);

        // 5. Generate QR Code (Dummy URL for now)
        const qrCodeDataUrl = await qrcode.toDataURL(`http://localhost:3000/download/${outputFilename}`);

        return { 
            success: true, 
            printPath: outputPath,
            qrCode: qrCodeDataUrl
        };

    } catch (error) {
        console.error("Processing Error:", error);
        return { success: false, error: error.message };
    }
});

// --- APP LIFECYCLE ---
app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });