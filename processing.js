// processing.js
document.addEventListener('DOMContentLoaded', async () => {
    const statusText = document.getElementById('status-text');

    const photosBase64 = JSON.parse(localStorage.getItem('capturedPhotos'));
    const templateFile = localStorage.getItem('selectedTemplate');

    if (!photosBase64 || !templateFile) {
        statusText.innerText = 'Error: Data foto atau template tidak ditemukan!';
        return;
    }

    try {
        statusText.innerText = 'Menggabungkan foto ke template...';
        
        const result = await window.electronAPI.processImages({ photosBase64, templateFile });

        if (result.success) {
            statusText.innerText = 'Berhasil! Menampilkan hasil...';
            localStorage.setItem('finalPrintPath', result.printPath);
            localStorage.setItem('finalGifPath', result.gifPath);
            localStorage.setItem('finalQrCode', result.qrCodeDataUrl); // <-- Simpan data QR Code
            
            setTimeout(() => {
                window.location.href = 'result.html';
            }, 1500);

        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        statusText.innerText = `Terjadi Kesalahan: ${error.message}`;
        console.error('Processing error:', error);
    }
});