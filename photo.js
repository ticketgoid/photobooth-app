// photo.js
const sessionVideo = document.getElementById('session-video');
const sessionHeading = document.getElementById('session-heading');
const sessionCountdown = document.getElementById('session-countdown');
const canvas = document.getElementById('canvas');
const frameContainer = document.getElementById('frame-container');
const miniLiveView = document.getElementById('mini-live-view');

const TOTAL_PHOTOS_REQUIRED = 3;
const INTERVAL_SECONDS = 10;
let photos = [null, null, null];
let templateConfig = null;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function calculateStyle(position, size, templateMetadata) {
    const templateNaturalWidth = templateMetadata.width;
    const templateNaturalHeight = templateMetadata.height;
    const top = (position.top / templateNaturalHeight) * 100;
    const left = (position.left / templateNaturalWidth) * 100;
    const width = (size.width / templateNaturalWidth) * 100;
    const height = (size.height / templateNaturalHeight) * 100;
    return { top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` };
}

async function loadTemplateData() {
    const selectedTemplateFile = localStorage.getItem('selectedTemplate');
    if (!selectedTemplateFile) {
        alert('Error: Template tidak ditemukan!');
        return false;
    }
    const allTemplates = await window.electronAPI.getTemplates();
    templateConfig = allTemplates[selectedTemplateFile];
    if (!templateConfig || !templateConfig.metadata) {
        alert(`Error: Konfigurasi atau metadata untuk ${selectedTemplateFile} tidak ditemukan! Harap unggah ulang template.`);
        return false;
    }
    frameContainer.style.backgroundImage = `url('file:///${templateConfig.path.replace(/\\/g, '/')}')`;
    return true;
}

// --- FUNGSI startCamera DIPERBAIKI ---
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        
        // Pastikan kedua elemen video ada sebelum digunakan
        if (sessionVideo && miniLiveView) {
            sessionVideo.srcObject = stream;
            miniLiveView.srcObject = stream;
            
            // Tunggu sebentar untuk memastikan video siap, lalu mulai alur kerja
            setTimeout(mainWorkflow, 500);
        } else {
            throw new Error("Elemen video tidak ditemukan di halaman.");
        }
    } catch (err) {
        console.error("Gagal mengakses kamera:", err);
        alert(`Tidak bisa mengakses kamera. Pastikan tidak ada aplikasi lain yang menggunakan dan izin sudah diberikan.\nError: ${err.name}`);
    }
}

function takePhoto() {
    const context = canvas.getContext('2d');
    canvas.width = sessionVideo.videoWidth;
    canvas.height = sessionVideo.videoHeight;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(sessionVideo, 0, 0, canvas.width, canvas.height);
    context.setTransform(1, 0, 0, 1, 0, 0);
    const photoDataUrl = canvas.toDataURL('image/jpeg');
    const emptySlotIndex = photos.findIndex(slot => slot === null);
    if (emptySlotIndex !== -1) {
        photos[emptySlotIndex] = photoDataUrl;
        updateLivePreview(emptySlotIndex, photoDataUrl);
    }
}

function updateLivePreview(index, photoDataUrl) {
    const position = templateConfig.positions[index];
    const size = templateConfig.photoSize;
    const oldPreview = document.getElementById(`preview-img-${index}`);
    if (oldPreview) { oldPreview.remove(); }
    const previewDiv = document.createElement('div');
    previewDiv.id = `preview-img-${index}`;
    previewDiv.className = 'live-photo-preview';
    previewDiv.style.backgroundImage = `url(${photoDataUrl})`;
    const style = calculateStyle(position, size, templateConfig.metadata);
    previewDiv.style.top = style.top;
    previewDiv.style.left = style.left;
    previewDiv.style.width = style.width;
    previewDiv.style.height = style.height;
    frameContainer.appendChild(previewDiv);
}

function positionMiniLiveView(index) {
    const position = templateConfig.positions[index];
    const size = templateConfig.photoSize;
    const style = calculateStyle(position, size, templateConfig.metadata);
    miniLiveView.style.top = style.top;
    miniLiveView.style.left = style.left;
    miniLiveView.style.width = style.width;
    miniLiveView.style.height = style.height;
    miniLiveView.style.display = 'block';
}

async function runCountdown(isFirstPhoto) {
    const duration = isFirstPhoto ? 3 : INTERVAL_SECONDS;
    for (let i = duration; i > 0; i--) {
        sessionCountdown.innerText = i;
        await sleep(1000);
    }
    sessionCountdown.innerText = "SMILE!";
    await sleep(1000);
    sessionCountdown.innerText = "";
}

async function mainWorkflow() {
    const templateReady = await loadTemplateData();
    if (!templateReady) return;
    for (let i = 0; i < TOTAL_PHOTOS_REQUIRED; i++) {
        const isTheVeryFirstPhoto = (i === 0);
        positionMiniLiveView(i);
        sessionHeading.innerText = `Siap untuk foto ke-${i + 1}?`;
        await sleep(2000);
        sessionHeading.innerText = '';
        await runCountdown(isTheVeryFirstPhoto);
        takePhoto();
    }
    miniLiveView.style.display = 'none';
    if(sessionVideo.srcObject) {
        sessionVideo.srcObject.getTracks().forEach(track => track.stop());
    }
    localStorage.setItem('capturedPhotos', JSON.stringify(photos));
    window.location.href = 'preview.html';
}

startCamera();