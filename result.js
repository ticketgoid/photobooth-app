// result.js
document.addEventListener('DOMContentLoaded', () => {
    const resultImage = document.getElementById('result-image');
    const resultGif = document.getElementById('result-gif');
    const qrCodeContainer = document.getElementById('qr-code');
    const restartBtn = document.getElementById('restart-btn');
    
    const printPath = "file:///" + localStorage.getItem('finalPrintPath');
    const gifPath = "file:///" + localStorage.getItem('finalGifPath');
    const qrCodeDataUrl = localStorage.getItem('finalQrCode');
    
    if (printPath && gifPath) {
        resultImage.src = printPath;
        resultGif.src = gifPath;
    } else {
        document.body.innerHTML = '<h1>Gagal memuat hasil gambar.</h1>';
        return;
    }
    
    // Tampilkan QR Code dari data yang sudah jadi
    if (qrCodeDataUrl) {
        const qrImg = document.createElement('img');
        qrImg.src = qrCodeDataUrl;
        qrCodeContainer.innerHTML = '';
        qrCodeContainer.appendChild(qrImg);
    } else {
        qrCodeContainer.textContent = 'Gagal memuat QR Code.';
    }

    restartBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});