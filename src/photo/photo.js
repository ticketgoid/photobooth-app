document.addEventListener('DOMContentLoaded', async () => {
    // === DOM ELEMENTS ===
    const templateStage = document.getElementById('template-stage');
    const frameOverlay = document.getElementById('frame-overlay');
    const miniVideo = document.getElementById('mini-video');
    const mainVideo = document.getElementById('main-video');
    
    const overlayInfo = document.getElementById('overlay-info');
    const countdownText = document.getElementById('countdown-text');
    const statusText = document.getElementById('status-text');
    const controlsArea = document.getElementById('controls-area');
    const btnStart = document.getElementById('btn-start');
    const btnMirror = document.getElementById('btn-mirror');
    const getReadyOverlay = document.getElementById('get-ready-overlay');

    const canvas = document.getElementById('capture-canvas');
    const ctx = canvas.getContext('2d');

    // === DATA ===
    const selectedId = localStorage.getItem('selectedTemplate');
    if (!selectedId) return alert("Error: No Template Selected");

    const allTemplates = await window.electronAPI.getTemplates();
    const config = allTemplates[selectedId];
    
    // [MODIFIKASI] Load data lama jika ada (untuk Retake)
    let capturedPhotos = [null, null, null]; // Default kosong
    let capturedVideos = [null, null, null]; // Path video
    
    // Cek apakah ini sesi retake?
    const existingPhotos = localStorage.getItem('capturedPhotos');
    if (existingPhotos) {
        capturedPhotos = JSON.parse(existingPhotos);
        // Load video paths juga jika ada
        const existingVideos = localStorage.getItem('capturedVideos');
        if(existingVideos) capturedVideos = JSON.parse(existingVideos);
    } else {
        // Jika sesi baru, pastikan slot disesuaikan dengan jumlah posisi di template
        capturedPhotos = new Array(config.positions.length).fill(null);
        capturedVideos = new Array(config.positions.length).fill(null);
    }

    let currentSlotIndex = 0;
    const slots = config.positions || [];
    let isMirrored = true;
    let mediaRecorder;
    let recordedChunks = [];

    // === INIT ===
    async function init() {
        frameOverlay.src = `file:///${config.path}`;
        
        // Render foto yang sudah ada (jika retake)
        capturedPhotos.forEach((photo, idx) => {
            if(photo) showStaticResult(idx, photo);
        });

        // Setup Ukuran Stage
        const targetPanelWidth = window.innerWidth * 0.25; 
        const targetPanelHeight = window.innerHeight;
        const natW = config.metadata.width;
        const natH = config.metadata.height;
        const scale = Math.min((targetPanelWidth * 0.9) / natW, (targetPanelHeight * 0.9) / natH);

        templateStage.style.width = `${natW * scale}px`;
        templateStage.style.height = `${natH * scale}px`;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 1280, height: 720 }, 
                audio: false 
            });
            
            mainVideo.srcObject = stream;
            miniVideo.srcObject = stream;
            
            // Setup Recorder untuk Live Video
            setupMediaRecorder(stream);

            mainVideo.onloadedmetadata = () => {
                mainVideo.play();
                miniVideo.play();
                
                const loader = document.getElementById('camera-loader');
                if(loader) {
                    loader.style.transition = "opacity 0.5s";
                    loader.style.opacity = "0";
                    setTimeout(() => loader.remove(), 500);
                }
            };

            updateMirrorVisuals();

        } catch (e) {
            alert("Kamera Error: " + e.message);
            const loader = document.getElementById('camera-loader');
            if(loader) loader.style.display = 'none';
        }
    }

    function setupMediaRecorder(stream) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            recordedChunks = [];
            
            // Simpan Video ke File System via Main Process
            const buffer = await blob.arrayBuffer();
            const result = await window.electronAPI.saveTempVideo({ 
                buffer: new Uint8Array(buffer), 
                index: currentSlotIndex 
            });
            
            if(result.success) {
                capturedVideos[currentSlotIndex] = result.path;
            }
        };
    }

    // === MIRROR LOGIC ===
    function updateMirrorVisuals() {
        const transformValue = isMirrored ? "scaleX(-1)" : "scaleX(1)";
        mainVideo.style.transform = transformValue;
        miniVideo.style.transform = transformValue;
        
        if (isMirrored) {
            btnMirror.innerHTML = '<i class="fas fa-exchange-alt"></i> Mirror: ON';
            btnMirror.classList.add('active');
        } else {
            btnMirror.innerHTML = '<i class="fas fa-exchange-alt"></i> Mirror: OFF';
            btnMirror.classList.remove('active');
        }
    }

    btnMirror.onclick = () => {
        isMirrored = !isMirrored;
        updateMirrorVisuals();
    };

    // === START FLOW LOGIC ===
    btnStart.onclick = async () => {
        controlsArea.style.display = 'none';
        getReadyOverlay.style.display = 'flex';
        await new Promise(r => setTimeout(r, 100));
        
        const previewPanel = document.getElementById('preview-panel');
        previewPanel.style.display = 'flex'; 
        
        // Fit ulang karena panel muncul
        const panelW = previewPanel.clientWidth;
        const panelH = previewPanel.clientHeight;
        const natW = config.metadata.width;
        const natH = config.metadata.height;
        const scale = Math.min((panelW * 0.9) / natW, (panelH * 0.9) / natH);
        templateStage.style.width = `${natW * scale}px`;
        templateStage.style.height = `${natH * scale}px`;

        await new Promise(r => setTimeout(r, 2000));
        getReadyOverlay.style.display = 'none';
        startSession();
    };

    // Helper Koordinat
    function getScaledRect(slotData) {
        const currentW = templateStage.clientWidth;
        const scale = currentW / config.metadata.width;
        return {
            top: slotData.top * scale,
            left: slotData.left * scale,
            width: slotData.width * scale,
            height: slotData.height * scale
        };
    }

    function moveMiniVideoToSlot(index) {
        if (index >= slots.length) {
            miniVideo.style.display = 'none';
            return;
        }
        const slot = slots[index];
        const rect = getScaledRect(slot);

        miniVideo.style.top = `${rect.top}px`;
        miniVideo.style.left = `${rect.left}px`;
        miniVideo.style.width = `${rect.width}px`;
        miniVideo.style.height = `${rect.height}px`;
        miniVideo.style.display = 'block';
    }

    // === CAPTURE ===
    function capture() {
        canvas.width = mainVideo.videoWidth;
        canvas.height = mainVideo.videoHeight;
        ctx.save();
        if (isMirrored) {
            ctx.scale(-1, 1);
            ctx.drawImage(mainVideo, -canvas.width, 0, canvas.width, canvas.height);
        } else {
            ctx.scale(1, 1);
            ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        capturedPhotos[currentSlotIndex] = dataUrl; // Simpan di index yang benar
        showStaticResult(currentSlotIndex, dataUrl);
    }

    function showStaticResult(index, imgUrl) {
        const slot = slots[index];
        const rect = getScaledRect(slot);
        
        // Hapus preview lama jika ada (untuk kasus retake)
        const old = document.getElementById(`captured-${index}`);
        if(old) old.remove();

        const imgDiv = document.createElement('div');
        imgDiv.id = `captured-${index}`;
        imgDiv.className = 'captured-slot';
        imgDiv.style.backgroundImage = `url(${imgUrl})`;
        imgDiv.style.top = `${rect.top}px`;
        imgDiv.style.left = `${rect.left}px`;
        imgDiv.style.width = `${rect.width}px`;
        imgDiv.style.height = `${rect.height}px`;
        templateStage.appendChild(imgDiv);
    }

    // === SESSION LOOP ===
    async function startSession() {
        const totalTakes = slots.length;
        overlayInfo.style.display = 'flex'; 

        for (let i = 0; i < totalTakes; i++) {
            currentSlotIndex = i;
            
            // [LOGIKA RETAKE] Jika foto di slot ini sudah ada, skip!
            if (capturedPhotos[i] !== null) {
                continue;
            }

            moveMiniVideoToSlot(i);
            
            statusText.style.display = 'block';
            statusText.innerText = `Gaya ${i + 1}`;
            
            // [BARU] Mulai Rekam Video (Live Clip)
            if (mediaRecorder.state === 'inactive') mediaRecorder.start();

            // Countdown
            for (let c = 3; c > 0; c--) {
                countdownText.innerText = c;
                countdownText.style.transform = "scale(1)";
                countdownText.style.transition = "transform 0.2s";
                requestAnimationFrame(() => countdownText.style.transform = "scale(1.2)");
                await new Promise(r => setTimeout(r, 1000));
            }
            
            // Stop Rekam Video TEPAT sebelum cekrek
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();

            countdownText.innerText = ""; 
            
            capture(); 
            
            await new Promise(r => setTimeout(r, 500));
        }

        finishSession();
    }

    async function finishSession() {
        // Simpan Data untuk Halaman Review
        localStorage.setItem('capturedPhotos', JSON.stringify(capturedPhotos));
        localStorage.setItem('capturedVideos', JSON.stringify(capturedVideos));

        // Delay sedikit
        await new Promise(r => setTimeout(r, 1000));

        // [PERBAIKAN] Redirect ke Review Page yang baru dibuat
        window.location.href = '../review/review.html';
    }

    init();
});