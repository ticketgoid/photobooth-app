document.addEventListener('DOMContentLoaded', () => {
    const photoContainer = document.getElementById('photo-strip-container');
    const videoContainer = document.getElementById('video-strip-container');
    const gifPlayer = document.getElementById('gif-player');
    
    const btnPrint = document.getElementById('btn-print');
    const btnRetake = document.getElementById('btn-retake');
    const retakeCountSpan = document.getElementById('retake-count');

    // Ambil data dari LocalStorage
    let photos = JSON.parse(localStorage.getItem('capturedPhotos')) || [];
    let videos = JSON.parse(localStorage.getItem('capturedVideos')) || [];
    
    // Status hapus (Array of booleans)
    let deletedIndices = new Array(photos.length).fill(false);

    function renderMedia() {
        photoContainer.innerHTML = '';
        videoContainer.innerHTML = '';
        let deletedCount = 0;

        photos.forEach((photoUrl, index) => {
            // --- 1. RENDER FOTO ---
            const pCard = document.createElement('div');
            pCard.className = `media-card ${deletedIndices[index] ? 'selected-delete' : ''}`;
            
            if (photoUrl) {
                pCard.innerHTML = `
                    <img src="${photoUrl}">
                    <div class="delete-overlay" onclick="toggleDelete(${index})">
                        <i class="fas ${deletedIndices[index] ? 'fa-undo' : 'fa-trash'}"></i>
                    </div>
                `;
            } else {
                // Slot Kosong (belum difoto ulang)
                pCard.style.background = '#ddd';
                pCard.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;color:#888;">Retake</div>';
            }
            photoContainer.appendChild(pCard);

            // --- 2. RENDER VIDEO ---
            const vCard = document.createElement('div');
            vCard.className = `media-card ${deletedIndices[index] ? 'selected-delete' : ''}`;
            
            if (videos[index]) {
                // Video perlu path absolut
                const vidPath = `file:///${videos[index]}`;
                vCard.innerHTML = `
                    <video src="${vidPath}" autoplay loop muted></video>
                `;
            } else {
                vCard.style.background = '#ddd';
            }
            videoContainer.appendChild(vCard);

            if (deletedIndices[index]) deletedCount++;
        });

        updateButtons(deletedCount);
        playGifPreview(deletedIndices);
    }

    // Fungsi Toggle Hapus
    window.toggleDelete = (index) => {
        deletedIndices[index] = !deletedIndices[index];
        renderMedia();
    };

    function updateButtons(count) {
        retakeCountSpan.innerText = count;
        if (count > 0) {
            btnRetake.style.display = 'block';
            btnPrint.style.display = 'none';
        } else {
            btnRetake.style.display = 'none';
            btnPrint.style.display = 'block';
        }
    }

    // Logic Tombol Retake
    btnRetake.onclick = () => {
        // Hapus data asli sesuai yang dicentang
        deletedIndices.forEach((isDeleted, idx) => {
            if (isDeleted) {
                photos[idx] = null;
                videos[idx] = null;
            }
        });

        // Simpan balik ke Storage
        localStorage.setItem('capturedPhotos', JSON.stringify(photos));
        localStorage.setItem('capturedVideos', JSON.stringify(videos));

        // Kembali ke Photo Page
        window.location.href = '../photo/photo.html';
    };

    // Logic Tombol Cetak
    btnPrint.onclick = () => {
        window.location.href = '../processing/processing.html';
    };

    // --- GIF PREVIEW SIMPLES ---
    let gifInterval;
    function playGifPreview(excludeIndices) {
        if (gifInterval) clearInterval(gifInterval);
        
        // Filter foto yang tidak dihapus
        const activePhotos = photos.filter((_, idx) => !excludeIndices[idx] && photos[idx]);
        
        if (activePhotos.length === 0) {
            gifPlayer.src = '';
            return;
        }

        let i = 0;
        gifPlayer.src = activePhotos[0];
        
        if (activePhotos.length > 1) {
            gifInterval = setInterval(() => {
                i = (i + 1) % activePhotos.length;
                gifPlayer.src = activePhotos[i];
            }, 500); // Speed 0.5s
        }
    }

    renderMedia();
});