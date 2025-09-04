// preview.js
document.addEventListener('DOMContentLoaded', async () => {
    const framePreviewContainer = document.getElementById('frame-preview-container');
    const thumbnailContainers = [
        document.getElementById('thumb-0'),
        document.getElementById('thumb-1'),
        document.getElementById('thumb-2')
    ];
    const deleteBtn = document.getElementById('delete-btn');
    const continueBtn = document.getElementById('continue-btn');

    let photos = [];
    let templateConfig = null;
    let selectedTemplateFile = '';
    let currentSlide = 0;

    // --- FUNGSI BARU: Kalkulasi Posisi Presisi ---
    function calculateStyle(position, size, templateMetadata) {
        const templateNaturalWidth = templateMetadata.width;
        const templateNaturalHeight = templateMetadata.height;
        const top = (position.top / templateNaturalHeight) * 100;
        const left = (position.left / templateNaturalWidth) * 100;
        const width = (size.width / templateNaturalWidth) * 100;
        const height = (size.height / templateNaturalHeight) * 100;
        return { top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` };
    }

    async function loadInitialData() {
        const photosData = localStorage.getItem('capturedPhotos');
        if (photosData) { photos = JSON.parse(photosData); }

        selectedTemplateFile = localStorage.getItem('selectedTemplate');
        if (!selectedTemplateFile) { alert('Error: Template tidak ditemukan!'); return; }

        const allTemplates = await window.electronAPI.getTemplates();
        templateConfig = allTemplates[selectedTemplateFile];
        if (!templateConfig || !templateConfig.metadata) { alert(`Error: Konfigurasi atau metadata untuk ${selectedTemplateFile} tidak ditemukan!`); return; }

        updateDisplay();
    }

    function updateDisplay() {
        framePreviewContainer.style.backgroundImage = `url('file:///${templateConfig.path.replace(/\\/g, '/')}')`;
        framePreviewContainer.innerHTML = '';
        thumbnailContainers.forEach(container => container.innerHTML = '');

        photos.forEach((photoData, index) => {
            const thumbContainer = thumbnailContainers[index];
            if (photoData) {
                const thumbImg = document.createElement('img');
                thumbImg.src = photoData;
                thumbImg.className = 'thumbnail-img';
                thumbContainer.appendChild(thumbImg);
            } else {
                thumbContainer.innerHTML = '<span style="font-size: 14px; color: #999;">Ambil Ulang</span>';
            }
            thumbContainer.classList.toggle('active', index === currentSlide);

            if (photoData) {
                const previewDiv = document.createElement('div');
                previewDiv.style.backgroundImage = `url(${photoData})`;
                previewDiv.style.backgroundSize = 'cover';
                previewDiv.style.backgroundPosition = 'center';
                
                const position = templateConfig.positions[index];
                const size = templateConfig.photoSize;
                
                // Gunakan fungsi kalkulasi yang sama
                const style = calculateStyle(position, size, templateConfig.metadata);
                previewDiv.style.position = 'absolute';
                previewDiv.style.top = style.top;
                previewDiv.style.left = style.left;
                previewDiv.style.width = style.width;
                previewDiv.style.height = style.height;
                
                framePreviewContainer.appendChild(previewDiv);
            }
        });
        
        deleteBtn.disabled = !photos[currentSlide];
        deleteBtn.style.opacity = deleteBtn.disabled ? 0.5 : 1;
    }

    function deleteSelectedPhoto() {
        if (photos[currentSlide]) {
            photos[currentSlide] = null;
            updateDisplay();
        }
    }

    thumbnailContainers.forEach((thumb, index) => {
        thumb.addEventListener('click', () => {
            currentSlide = index;
            updateDisplay();
        });
    });

    deleteBtn.addEventListener('click', deleteSelectedPhoto);
    
    continueBtn.addEventListener('click', () => {
        const isComplete = !photos.includes(null);
        localStorage.setItem('capturedPhotos', JSON.stringify(photos));
        
        if (isComplete) {
            window.location.href = 'processing.html';
        } else {
            window.location.href = 'retake.html';
        }
    });

    await loadInitialData();
});