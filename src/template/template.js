document.addEventListener('DOMContentLoaded', async () => {
    // === DOM REFERENCES ===
    const views = {
        user: document.getElementById('user-view'),
        dashboard: document.getElementById('admin-dashboard'),
        editor: document.getElementById('admin-editor')
    };

    // User Elements
    const userCarousel = document.getElementById('user-carousel');
    const btnUserAction = document.getElementById('btn-user-action');

    // Admin Dashboard Elements
    const adminCarousel = document.getElementById('admin-carousel');
    const btnExitAdmin = document.getElementById('btn-exit-admin');
    const btnUpload = document.getElementById('btn-upload');

    // Admin Editor Elements
    const editorStage = document.getElementById('editor-stage');
    const templateImg = document.getElementById('template-img');
    const slotsLayer = document.getElementById('slots-layer');
    const chkVisible = document.getElementById('chk-visible');
    
    // Editor Toolbar Buttons
    const btnAddSlot = document.getElementById('btn-add-slot');
    const btnClearSlots = document.getElementById('btn-clear-slots');
    const btnSaveTemplate = document.getElementById('btn-save-template');
    const btnDeleteTemplate = document.getElementById('btn-delete-template');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');

    // === STATE ===
    let isAdmin = new URLSearchParams(window.location.search).get('mode') === 'admin';
    let templates = {}; 
    let editingId = null; // ID template yang sedang diedit
    let selectedUserId = null; // ID template yang dipilih user
    let currentScale = 1;
    const ASPECT_RATIO = 4/3; 

    // === INIT ===
    await loadData();

    async function loadData() {
        templates = await window.electronAPI.getTemplates();
        
        if (isAdmin) {
            showView('dashboard');
            renderAdminDashboard();
        } else {
            showView('user');
            renderUserCarousel();
        }
    }

    function showView(viewName) {
        Object.values(views).forEach(el => el.style.display = 'none');
        views[viewName].style.display = 'flex';
    }

    // =======================================================
    // 1. LOGIC USER VIEW
    // =======================================================
    
    // [BARU] Tombol Back ke Landing
    btnBackLanding.onclick = () => {
        window.location.href = '../landing/landing.html';
    };

    function renderUserCarousel() {
        userCarousel.innerHTML = '';
        const keys = Object.keys(templates);
        
        if (keys.length === 0) {
            userCarousel.innerHTML = '<h3 style="color:#666">Belum ada frame tersedia</h3>';
            return;
        }

        keys.forEach(fileName => {
            const t = templates[fileName];
            if (!t.visible) return; // Skip hidden

        // Format Harga (Default 15000 jika belum diatur)
            const price = t.price || 15000;
            const priceString = new Intl.NumberFormat('id-ID').format(price);

            const item = document.createElement('div');
            item.className = 'carousel-item';
            // [BARU] Struktur item dengan Harga
            item.innerHTML = `
                <img src="file:///${t.path}" loading="lazy" draggable="false">
                <div class="price-label">Rp ${priceString}</div>
            `;
            
            item.onclick = () => {
                // Highlight logic
                document.querySelectorAll('#user-carousel .carousel-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                item.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                
                selectedUserId = fileName;
                
                // Update Button
                if (!t.positions || t.positions.length === 0) {
                    btnUserAction.innerText = "Frame Rusak (Hubungi Admin)";
                    btnUserAction.className = "btn-action disabled";
                    btnUserAction.disabled = true;
                } else {
                    btnUserAction.innerText = "Yuk Foto!";
                    btnUserAction.className = "btn-action active";
                    btnUserAction.disabled = false;
                }
            };
            userCarousel.appendChild(item);
        });
    }

// [BARU] Klik Tombol Lanjut -> Ke PAYMENT
    btnUserAction.onclick = () => {
        if (selectedUserId) {
            localStorage.setItem('selectedTemplate', selectedUserId);
            localStorage.setItem('selectedPrice', selectedPrice); // Simpan Harga untuk Payment.js
            window.location.href = '../payment/payment.html'; // Pindah ke Payment
        }
    };

    // =======================================================
    // 2. LOGIC ADMIN DASHBOARD
    // =======================================================
    function renderAdminDashboard() {
        const uploadBtnEl = adminCarousel.querySelector('.add-new-card');
        adminCarousel.innerHTML = '';
        adminCarousel.appendChild(uploadBtnEl);
        Object.keys(templates).forEach(fileName => {
            const t = templates[fileName];
            const item = document.createElement('div');
            item.className = 'carousel-item';
            let badge = (!t.visible) ? '<span class="status-badge">Hidden</span>' : '';
            // Tampilkan harga di dashboard admin juga
            const price = t.price || 15000; 
            item.innerHTML = `${badge}<img src="file:///${t.path}"><div class="price-label" style="font-size:1rem; color:#666;">Rp ${price}</div>`;
            item.onclick = () => openEditor(fileName);
            adminCarousel.appendChild(item);
        });
    }

    // Tombol Save & Exit (Kembali ke Landing)
    btnExitAdmin.onclick = () => {
        window.location.href = '../landing/landing.html';
    };

    // Tombol Upload Baru
    btnUpload.onclick = async () => {
        const path = await window.electronAPI.openFileDialog();
        if (path) {
            // Default price 15000 saat upload baru
            const res = await window.electronAPI.saveNewTemplate({ 
                tempPath: path, configData: { positions: [], visible: true, price: 15000 } 
            });
            if(res.success) { await loadData(); openEditor(Object.keys(res.newTemplate)[0]); }
        }
    };

    // =======================================================
    // 3. LOGIC ADMIN EDITOR
    // =======================================================
    function openEditor(fileName) {
        editingId = fileName;
        const data = templates[fileName];
        showView('editor');
        
        templateImg.src = `file:///${data.path}`;
        chkVisible.checked = data.visible !== false;
        
        // [BARU] Isi Input Harga
        inpPrice.value = data.price || 15000;

        templateImg.onload = () => {
            fitStageToScreen(data.metadata.width, data.metadata.height);
            renderSlots(data.positions || []);
        };
    }

    function fitStageToScreen(naturalW, naturalH) {
        // Hitung area workspace yang tersedia
        const workspace = document.getElementById('editor-workspace');
        // Padding safety
        const maxW = workspace.clientWidth - 40; 
        const maxH = workspace.clientHeight - 40;

        const scaleX = maxW / naturalW;
        const scaleY = maxH / naturalH;
        currentScale = Math.min(scaleX, scaleY, 0.9); // Max 90% zoom

        editorStage.style.width = `${naturalW * currentScale}px`;
        editorStage.style.height = `${naturalH * currentScale}px`;
    }

    function renderSlots(positions) {
        slotsLayer.innerHTML = '';
        positions.forEach((pos, idx) => addSlotBox(idx, pos));
    }

    function reindexSlots() {
        Array.from(slotsLayer.children).forEach((box, i) => {
            box.querySelector('.slot-number').innerText = i + 1;
        });
    }

    function addSlotBox(index, pos = null) {
        const box = document.createElement('div');
        box.className = 'slot-box';
        
        const num = document.createElement('span');
        num.className = 'slot-number';
        num.innerText = index + 1;
        box.appendChild(num);

        const delBtn = document.createElement('div');
        delBtn.className = 'delete-slot-btn';
        delBtn.innerText = '×';
        delBtn.onclick = (e) => { e.stopPropagation(); box.remove(); reindexSlots(); };
        box.appendChild(delBtn);

        const dot = document.createElement('div');
        dot.className = 'resize-dot';
        box.appendChild(dot);

        // Posisi & Ukuran
        let w = pos ? pos.width * currentScale : 160;
        let h = pos ? pos.height * currentScale : 120;
        let t = pos ? pos.top * currentScale : 20;
        let l = pos ? pos.left * currentScale : 20;

        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
        box.style.top = `${t}px`;
        box.style.left = `${l}px`;

        setupInteract(box, dot);
        slotsLayer.appendChild(box);
    }

    // Logic Drag & Resize (Sama seperti sebelumnya)
    function setupInteract(box, dot) {
        box.addEventListener('mousedown', (e) => {
            if(e.target !== box && e.target.className !== 'slot-number') return;
            e.stopPropagation();
            const startX = e.clientX, startY = e.clientY;
            const startT = parseInt(box.style.top), startL = parseInt(box.style.left);
            slotsLayer.appendChild(box); // Bring to front

            const move = (ev) => {
                box.style.top = `${startT + (ev.clientY - startY)}px`;
                box.style.left = `${startL + (ev.clientX - startX)}px`;
            };
            const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
            window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
        });

        dot.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const startX = e.clientX, startW = parseInt(box.style.width);
            const move = (ev) => {
                let nw = Math.max(50, startW + (ev.clientX - startX));
                box.style.width = `${nw}px`;
                box.style.height = `${nw / ASPECT_RATIO}px`;
            };
            const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
            window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
        });


    }

    // === EDITOR ACTIONS ===
    
    // Tambah Slot
    btnAddSlot.onclick = () => addSlotBox(slotsLayer.children.length);
    
    // Reset Slot
    btnClearSlots.onclick = () => { if(confirm("Hapus semua kotak?")) slotsLayer.innerHTML = ''; };

    // Hapus Template
    btnDeleteTemplate.onclick = async () => {
        if(confirm("Hapus file template ini secara permanen?")) {
            await window.electronAPI.deleteTemplate({fileName: editingId});
            delete templates[editingId];
            showView('dashboard'); // Balik ke dashboard
            renderAdminDashboard();
        }
    };

    // Batal Edit
    btnCancelEdit.onclick = () => {
        showView('dashboard');
    };

    // [BARU] SIMPAN DATA (Termasuk Harga)
    btnSaveTemplate.onclick = async () => {
        if (!editingId) return;
        
        const positions = Array.from(slotsLayer.children).map(box => ({
            top: Math.round(parseInt(box.style.top) / currentScale),
            left: Math.round(parseInt(box.style.left) / currentScale),
            width: Math.round(parseInt(box.style.width) / currentScale),
            height: Math.round(parseInt(box.style.height) / currentScale)
        }));

        const configData = {
            positions: positions,
            visible: chkVisible.checked,
            price: parseInt(inpPrice.value) || 15000 // Simpan harga
        };

        const res = await window.electronAPI.updateTemplateConfig({ fileName: editingId, configData });
        
        if (res.success) {
            templates[editingId] = { ...templates[editingId], ...configData };
            showView('dashboard');
            renderAdminDashboard(); 
        } else {
            alert("Gagal: " + res.error);
        }
    };
});