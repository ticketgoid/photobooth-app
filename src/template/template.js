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
    const btnBackLanding = document.getElementById('btn-back-landing');

    // Admin Dashboard Elements
    const adminCarousel = document.getElementById('admin-carousel');
    const btnExitAdmin = document.getElementById('btn-exit-admin');
    const btnUpload = document.getElementById('btn-upload');

    // Admin Editor Elements
    const editorStage = document.getElementById('editor-stage');
    const templateImg = document.getElementById('template-img');
    const slotsLayer = document.getElementById('slots-layer');
    const chkVisible = document.getElementById('chk-visible');
    const inpPrice = document.getElementById('inp-price');
    const chkFree = document.getElementById('chk-free'); // [BARU]
    
    // Editor Toolbar Buttons
    const btnAddSlot = document.getElementById('btn-add-slot');
    const btnClearSlots = document.getElementById('btn-clear-slots');
    const btnSaveTemplate = document.getElementById('btn-save-template');
    const btnDeleteTemplate = document.getElementById('btn-delete-template');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');

    // === STATE ===
    let isAdmin = new URLSearchParams(window.location.search).get('mode') === 'admin';
    let templates = {}; 
    let editingId = null; 
    let selectedUserId = null; 
    let selectedPrice = 0; 
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
    
    btnBackLanding.onclick = () => {
        window.location.href = '../landing/landing.html';
    };

    function renderUserCarousel() {
        userCarousel.innerHTML = '';
        
        // Skeleton (Optional)
        for(let i=0; i<3; i++) {
            const skel = document.createElement('div');
            skel.className = 'skeleton carousel-item';
        }

        const keys = Object.keys(templates);
        if (keys.length === 0) {
            userCarousel.innerHTML = '<h3 style="color:#666">Belum ada frame tersedia</h3>';
            return;
        }

        keys.forEach(fileName => {
            const t = templates[fileName];
            if (!t.visible) return; 

            // [BARU] Logika Tampilan Harga / Gratis
            let priceDisplay = '';
            let priceClass = 'price-label';
            
            if (t.isFree) {
                priceDisplay = 'GRATIS';
                priceClass += ' free-badge'; // Nanti bisa distyle hijau di CSS kalau mau
            } else {
                const price = t.price || 15000;
                priceDisplay = `Rp ${new Intl.NumberFormat('id-ID').format(price)}`;
            }

            const item = document.createElement('div');
            item.className = 'carousel-item';
            
            item.innerHTML = `
                <img src="file:///${t.path}" loading="lazy" draggable="false">
                <div class="${priceClass}" style="${t.isFree ? 'color:#28a745; font-weight:900;' : ''}">${priceDisplay}</div>
            `;
            
            item.onclick = () => {
                document.querySelectorAll('#user-carousel .carousel-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                item.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                
                selectedUserId = fileName;
                selectedPrice = t.price || 15000;
                
                if (!t.positions || t.positions.length === 0) {
                    updateUserBtn(false, "Frame Rusak (Hubungi Admin)");
                } else {
                    // [BARU] Update Teks Tombol sesuai status Gratis/Bayar
                    if (t.isFree) {
                        updateUserBtn(true, "Mulai Foto (Gratis)");
                    } else {
                        updateUserBtn(true, `Bayar ${priceDisplay}`);
                    }
                }
            };
            userCarousel.appendChild(item);
        });
    }

    function updateUserBtn(active, text) {
        btnUserAction.innerText = text;
        if(active) {
            btnUserAction.className = "btn-action active";
            btnUserAction.disabled = false;
        } else {
            btnUserAction.className = "btn-action disabled";
            btnUserAction.disabled = true;
        }
    }

    // [BARU] LOGIKA NAVIGASI PINTAR (Bayar vs Gratis)
btnUserAction.onclick = () => {
        if (selectedUserId) {
            // [PENTING] Reset data foto lama saat memulai sesi baru
            localStorage.removeItem('capturedPhotos');
            localStorage.removeItem('capturedVideos');

            localStorage.setItem('selectedTemplate', selectedUserId);
            
            const config = templates[selectedUserId];
            
            if (config.isFree) {
                // JIKA GRATIS: Langsung ke Loading -> Foto
                window.location.href = '../loading/loading.html';
            } else {
                // JIKA BAYAR: Simpan harga, lalu ke Payment
                const finalPrice = selectedPrice || 15000;
                localStorage.setItem('selectedPrice', finalPrice); 
                window.location.href = '../payment/payment.html'; 
            }
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
            
            // Tampilan harga di admin
            let priceInfo = t.isFree ? '<span style="color:#28a745; font-weight:bold;">GRATIS</span>' : `Rp ${t.price || 15000}`;

            item.innerHTML = `
                ${badge}
                <img src="file:///${t.path}" loading="lazy" draggable="false">
                <div class="price-label" style="font-size:1rem; color:#666;">${priceInfo}</div>
                <div style="text-align:center; padding:5px; font-size:12px; color:#999;">Klik untuk Edit</div>
            `;
            item.onclick = () => openEditor(fileName);
            adminCarousel.appendChild(item);
        });
    }

    btnExitAdmin.onclick = () => window.location.href = '../landing/landing.html';
    
    btnUpload.onclick = async () => {
        const path = await window.electronAPI.openFileDialog();
        if (path) {
            // Default saat upload
            const res = await window.electronAPI.saveNewTemplate({ 
                tempPath: path, configData: { positions: [], visible: true, price: 15000, isFree: false } 
            });
            if(res.success) { await loadData(); openEditor(Object.keys(res.newTemplate)[0]); }
        }
    };

    // =======================================================
    // 3. LOGIC ADMIN EDITOR (INPUT HARGA & CHECKBOX)
    // =======================================================
    
    // [BARU] Event Listener Checkbox Gratis
    chkFree.addEventListener('change', () => {
        if (chkFree.checked) {
            inpPrice.disabled = true;
            inpPrice.value = ''; // Kosongkan visual
            inpPrice.placeholder = "Gratis";
        } else {
            inpPrice.disabled = false;
            inpPrice.value = 15000; // Kembalikan default
            inpPrice.placeholder = "Contoh: 15000";
        }
    });

    function openEditor(fileName) {
        editingId = fileName;
        const data = templates[fileName];
        showView('editor');
        
        templateImg.src = `file:///${data.path}`;
        chkVisible.checked = data.visible !== false;
        
        // [BARU] Setup Form Harga & Gratis
        chkFree.checked = data.isFree || false;
        
        if (data.isFree) {
            inpPrice.disabled = true;
            inpPrice.value = '';
            inpPrice.placeholder = "Gratis";
        } else {
            inpPrice.disabled = false;
            inpPrice.value = data.price || 15000;
        }

        templateImg.onload = () => {
            fitStageToScreen(data.metadata.width, data.metadata.height);
            renderSlots(data.positions || []);
        };
    }

    // ... (fitStageToScreen, renderSlots, reindexSlots, addSlotBox, setupInteract SAMA) ...
    // Pastikan copy-paste fungsi-fungsi visual editor tersebut dari kode sebelumnya di sini.
    function fitStageToScreen(nW, nH) { const ws = document.getElementById('editor-workspace'); const mX = ws.clientWidth-40; const mY = ws.clientHeight-40; const sX = mX/nW; const sY = mY/nH; currentScale = Math.min(sX, sY, 0.9); editorStage.style.width=`${nW*currentScale}px`; editorStage.style.height=`${nH*currentScale}px`; }
    function renderSlots(pos) { slotsLayer.innerHTML=''; pos.forEach((p,i)=>addSlotBox(i,p)); }
    function reindexSlots() { Array.from(slotsLayer.children).forEach((b,i)=>b.querySelector('.slot-number').innerText=i+1); }
    function addSlotBox(idx, pos=null) { 
        const b=document.createElement('div'); b.className='slot-box'; 
        b.innerHTML=`<span class="slot-number">${idx+1}</span><div class="delete-slot-btn">×</div><div class="resize-dot"></div>`;
        b.querySelector('.delete-slot-btn').onclick=(e)=>{e.stopPropagation();b.remove();reindexSlots();};
        let w=pos?pos.width*currentScale:160, h=pos?pos.height*currentScale:120, t=pos?pos.top*currentScale:20, l=pos?pos.left*currentScale:20;
        b.style.cssText=`width:${w}px;height:${h}px;top:${t}px;left:${l}px;`;
        setupInteract(b, b.querySelector('.resize-dot')); slotsLayer.appendChild(b);
    }
    function setupInteract(box, dot) {
        box.onmousedown=(e)=>{ if(e.target!==box && e.target.className!=='slot-number')return; e.stopPropagation(); const sX=e.clientX, sY=e.clientY, sT=parseInt(box.style.top), sL=parseInt(box.style.left); slotsLayer.appendChild(box); const mv=(ev)=>{box.style.top=`${sT+(ev.clientY-sY)}px`;box.style.left=`${sL+(ev.clientX-sX)}px`;}; const up=()=>{window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);}; window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up); };
        dot.onmousedown=(e)=>{ e.stopPropagation(); const sX=e.clientX, sW=parseInt(box.style.width); const mv=(ev)=>{let nw=Math.max(50,sW+(ev.clientX-sX));box.style.width=`${nw}px`;box.style.height=`${nw/ASPECT_RATIO}px`;}; const up=()=>{window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);}; window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up); };
    }

    // Actions
    btnAddSlot.onclick = () => addSlotBox(slotsLayer.children.length);
    btnClearSlots.onclick = () => { if(confirm("Hapus semua?")) slotsLayer.innerHTML=''; };
    btnCancelEdit.onclick = () => showView('dashboard');
    btnDeleteTemplate.onclick = async () => { if(confirm("Hapus?")) { await window.electronAPI.deleteTemplate({fileName:editingId}); delete templates[editingId]; showView('dashboard'); renderAdminDashboard(); }};

    // [BARU] SIMPAN DATA (Termasuk isFree)
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
            isFree: chkFree.checked, // Simpan status gratis
            price: chkFree.checked ? 0 : (parseInt(inpPrice.value) || 15000) // Simpan harga
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