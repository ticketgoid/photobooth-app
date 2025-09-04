// retake.js
const sessionVideo = document.getElementById('session-video');
const sessionHeading = document.getElementById('session-heading');
const sessionCountdown = document.getElementById('session-countdown');
const canvas = document.getElementById('canvas');
const frameContainer = document.getElementById('frame-container');
const miniLiveView = document.getElementById('mini-live-view');

const RETAKE_COUNTDOWN_SECONDS = 5;
let photos = [null, null, null];
let templateConfig = null;
let slotsToRetake = [];

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

async function loadDataForRetake() {
    const photosData = localStorage.getItem('capturedPhotos');
    if (photosData) {
        photos = JSON.parse(photosData);
        photos.forEach((photo, index) => {
            if (photo === null) {
                slotsToRetake.push(index);
            }
        });
    }
    const selectedTemplateFile = localStorage.getItem('selectedTemplate');
    if (!selectedTemplateFile) { alert('Error: Template tidak ditemukan!'); return false; }
    const allTemplates = await window.electronAPI.getTemplates();
    templateConfig = allTemplates[selectedTemplateFile];
    if (!templateConfig || !templateConfig.metadata) { alert(`Error: Konfigurasi atau metadata untuk ${selectedTemplateFile} tidak ditemukan!`); return false; }
    frameContainer.style.backgroundImage = `url('file:///${templateConfig.path.replace(/\\/g, '/')}')`;
    photos.forEach((photoData, index) => {
        if (photoData) {
            updateLivePreview(index, photoData);
        }
    });
    return true;
}

// --- FUNGSI startCamera DIPERBAIKI ---
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        
        if (sessionVideo && miniLiveView) {
            sessionVideo.srcObject = stream;
            miniLiveView.srcObject = stream;
            
            setTimeout(mainWorkflow, 500);
        } else {
            throw new Error("Elemen video tidak ditemukan di halaman.");
        }
    } catch (err) {
        console.error("Gagal mengakses kamera:", err);
        alert(`Tidak bisa mengakses kamera. Pastikan tidak ada aplikasi lain yang menggunakan dan izin sudah diberikan.\nError: ${err.name}`);
    }
}

function takePhoto(slotIndex) {
    const context = canvas.getContext('2d');
    canvas.width = sessionVideo.videoWidth;
    canvas.height = sessionVideo.videoHeight;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(sessionVideo, 0, 0, canvas.width, canvas.height);
    context.setTransform(1, 0, 0, 1, 0, 0);
    const photoDataUrl = canvas.toDataURL('image/jpeg');
    photos[slotIndex] = photoDataUrl;
    updateLivePreview(slotIndex, photoDataUrl);
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

async function runCountdown() {
    for (let i = RETAKE_COUNTDOWN_SECONDS; i > 0; i--) {
        sessionCountdown.innerText = i;
        await sleep(1000);
    }
    sessionCountdown.innerText = "SMILE!";
    await sleep(1000);
    sessionCountdown.innerText = "";
}

async function mainWorkflow() {
    const dataReady = await loadDataForRetake();
    if (!dataReady || slotsToRetake.length === 0) {
        window.location.href = 'preview.html';
        return;
    }
    for (const slotIndex of slotsToRetake) {
        positionMiniLiveView(slotIndex);
        sessionHeading.innerText = `Ulangi foto ke-${slotIndex + 1}`;
        await sleep(2000);
        sessionHeading.innerText = '';
        await runCountdown();
        takePhoto(slotIndex);
    }
    miniLiveView.style.display = 'none';
    if(sessionVideo.srcObject) {
        sessionVideo.srcObject.getTracks().forEach(track => track.stop());
    }
    localStorage.setItem('capturedPhotos', JSON.stringify(photos));
    window.location.href = 'preview.html';
}

startCamera();