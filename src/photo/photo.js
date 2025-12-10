document.addEventListener('DOMContentLoaded', async () => {
    // === DOM ELEMENTS ===
    const previewPanel = document.getElementById('preview-panel');
    const cameraPanel = document.getElementById('camera-panel');
    const templateStage = document.getElementById('template-stage');
    const frameOverlay = document.getElementById('frame-overlay');
    const miniVideo = document.getElementById('mini-video');
    const mainVideo = document.getElementById('main-video');
    
    const getReadyOverlay = document.getElementById('get-ready-overlay');
    const overlayInfo = document.getElementById('overlay-info');
    const countdownText = document.getElementById('countdown-text');
    const statusText = document.getElementById('status-text');
    const controlsArea = document.getElementById('controls-area');
    const btnStart = document.getElementById('btn-start');
    const btnMirror = document.getElementById('btn-mirror');

    const canvas = document.getElementById('capture-canvas');
    const ctx = canvas.getContext('2d');

    // === DATA ===
    const selectedId = localStorage.getItem('selectedTemplate');
    if (!selectedId) return alert("Error: No Template Selected");

    const allTemplates = await window.electronAPI.getTemplates();
    const config = allTemplates[selectedId];
    
    const capturedPhotos = []; 
    let currentSlotIndex = 0;
    const slots = config.positions || [];
    let isMirrored = true;

    // === INIT ===
    async function init() {
        frameOverlay.src = `file:///${config.path}`;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 1280, height: 720 }, 
                audio: false 
            });
            
            mainVideo.srcObject = stream;
            miniVideo.srcObject = stream;
            
            mainVideo.onloadedmetadata = () => {
                mainVideo.play();
                miniVideo.play();
                
                // Hilangkan loader awal
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
            document.getElementById('camera-loader').style.display = 'none';
        }
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
        // 1. Sembunyikan kontrol
        controlsArea.style.display = 'none';

        // 2. Tampilkan Layar "SIAP-SIAP" (Overlay Putih)
        getReadyOverlay.style.display = 'flex';

        // 3. Ubah Layout di balik layar (Menjadi Split Screen)
        // Kita beri sedikit delay agar transisi DOM render aman
        await new Promise(r => setTimeout(r, 100));
        
        previewPanel.style.display = 'flex'; // Munculkan kiri
        // cameraPanel width otomatis menyesuaikan karena flex

        // Hitung ulang ukuran template stage agar pas di panel kiri
        fitTemplateStage();

        // 4. Tunggu user bersiap (2 detik)
        await new Promise(r => setTimeout(r, 2000));

        // 5. Hilangkan layar siap-siap -> Masuk sesi foto
        getReadyOverlay.style.display = 'none';
        startSession();
    };

    function fitTemplateStage() {
        const natW = config.metadata.width;
        const natH = config.metadata.height;
        
        // Panel kiri sekarang sudah visible, jadi kita bisa ambil ukurannya
        const panelW = previewPanel.clientWidth;
        const panelH = previewPanel.clientHeight;

        const scale = Math.min((panelW * 0.9) / natW, (panelH * 0.9) / natH);

        templateStage.style.width = `${natW * scale}px`;
        templateStage.style.height = `${natH * scale}px`;
    }

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
        capturedPhotos.push(dataUrl);
        showStaticResult(currentSlotIndex, dataUrl);
    }

    function showStaticResult(index, imgUrl) {
        const slot = slots[index];
        const rect = getScaledRect(slot);
        const imgDiv = document.createElement('div');
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
        overlayInfo.style.display = 'flex'; // Munculkan overlay info

        for (let i = 0; i < totalTakes; i++) {
            currentSlotIndex = i;
            moveMiniVideoToSlot(i);
            
            // Status di pojok atas
            statusText.style.display = 'block';
            statusText.innerText = `Gaya ${i + 1}`;
            
            // Countdown
            for (let c = 3; c > 0; c--) {
                countdownText.innerText = c;
                // Efek denyut
                countdownText.style.transform = "scale(1)";
                countdownText.style.transition = "transform 0.2s";
                requestAnimationFrame(() => countdownText.style.transform = "scale(1.2)");
                
                await new Promise(r => setTimeout(r, 1000));
            }
            
            countdownText.innerText = ""; // Kosongkan saat cekrek agar tidak menutupi
            
            capture(); 
            
            // Freeze sebentar (0.5s)
            await new Promise(r => setTimeout(r, 500));
        }

        finishSession();
    }

    async function finishSession() {
        // Tampilkan teks memproses di TENGAH (Menggunakan Flexbox overlay)
        overlayInfo.style.justifyContent = 'center'; // Pindah ke tengah
        statusText.style.display = 'none'; // Sembunyikan status kecil
        
        countdownText.innerText = "MEMPROSES FOTO...";
        countdownText.style.fontSize = "3rem"; // Kecilkan font
        
        miniVideo.style.display = 'none';

        const result = await window.electronAPI.processImages({
            photosBase64: capturedPhotos,
            templateFile: selectedId
        });

        if (result.success) {
            countdownText.innerText = "SELESAI!";
            await new Promise(r => setTimeout(r, 1000));
            window.location.href = '../landing/landing.html'; 
        } else {
            alert("Gagal memproses: " + result.error);
            window.location.href = '../landing/landing.html';
        }
    }

    init();
});