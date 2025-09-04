// template.js
document.addEventListener('DOMContentLoaded', async () => {
    const templateGrid = document.getElementById('template-grid');
    const adminBtn = document.getElementById('admin-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    const customAlertModal = document.getElementById('custom-alert-modal');
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertButtons = document.getElementById('custom-alert-buttons');
    
    let currentTemplates = {};
    let editMode = null;
    let tempFilePath = null;

    function showAlert(message) {
        customAlertMessage.textContent = message;
        customAlertButtons.innerHTML = '<button id="custom-alert-ok-btn">OK</button>';
        customAlertModal.style.display = 'flex';
        document.getElementById('custom-alert-ok-btn').onclick = () => {
            customAlertModal.style.display = 'none';
        };
    }

    function showConfirmation(message, onConfirm) {
        customAlertMessage.textContent = message;
        customAlertButtons.innerHTML = `
            <button id="confirm-yes-btn" class="confirm-btn">Ya, Hapus</button>
            <button id="confirm-no-btn">Batal</button>
        `;
        customAlertModal.style.display = 'flex';
        document.getElementById('confirm-yes-btn').onclick = () => {
            customAlertModal.style.display = 'none';
            onConfirm();
        };
        document.getElementById('confirm-no-btn').onclick = () => {
            customAlertModal.style.display = 'none';
        };
    }

    function renderTemplates(templates) {
        templateGrid.innerHTML = '';
        for (const fileName in templates) {
            const template = templates[fileName];
            if (template.visible) {
                const img = document.createElement('img');
                img.src = `file:///${template.path}`;
                img.className = 'template-image';
                img.addEventListener('click', () => {
                    localStorage.setItem('selectedTemplate', fileName);
                    window.location.href = 'photo.html';
                });
                templateGrid.appendChild(img);
            }
        }
    }
    
    function renderAdminList(templates) {
        const list = document.getElementById('existing-templates-list');
        list.innerHTML = '';
        for (const fileName in templates) {
            const template = templates[fileName];
            const li = document.createElement('li');
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'template-info';
            const thumbnail = document.createElement('img');
            thumbnail.src = `file:///${template.path}`;
            thumbnail.className = 'admin-thumbnail';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = fileName;
            infoDiv.appendChild(thumbnail);
            infoDiv.appendChild(nameSpan);

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'template-controls';

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.className = 'edit-btn';
            editBtn.addEventListener('click', () => enterEditMode(fileName));

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Hapus';
            deleteBtn.className = 'delete-btn';
            deleteBtn.addEventListener('click', () => {
                showConfirmation(`Anda yakin ingin menghapus template "${fileName}"?`, async () => {
                    const result = await window.electronAPI.deleteTemplate({ fileName });
                    if (result.success) {
                        delete currentTemplates[fileName];
                        renderAdminList(currentTemplates);
                        renderTemplates(currentTemplates);
                        showAlert('Template berhasil dihapus.');
                    } else {
                        showAlert(`Gagal menghapus: ${result.error}`);
                    }
                });
            });

            const switchLabel = document.createElement('label');
            switchLabel.className = 'switch';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = template.visible;
            checkbox.addEventListener('change', async (e) => {
                await window.electronAPI.updateTemplateVisibility({ fileName, visible: e.target.checked });
                currentTemplates[fileName].visible = e.target.checked;
                renderTemplates(currentTemplates);
            });
            const sliderSpan = document.createElement('span');
            sliderSpan.className = 'slider';
            switchLabel.appendChild(checkbox);
            switchLabel.appendChild(sliderSpan);
            
            controlsDiv.appendChild(editBtn);
            controlsDiv.appendChild(deleteBtn);
            controlsDiv.appendChild(switchLabel);
            li.appendChild(infoDiv);
            li.appendChild(controlsDiv);
            list.appendChild(li);
        }
    }

    function populateForm(fileName) {
        const data = currentTemplates[fileName];
        document.getElementById('photo-width').value = data.photoSize.width;
        document.getElementById('photo-height').value = data.photoSize.height;
        document.getElementById('p1-top').value = data.positions[0].top;
        document.getElementById('p1-left').value = data.positions[0].left;
        document.getElementById('p2-top').value = data.positions[1].top;
        document.getElementById('p2-left').value = data.positions[1].left;
        document.getElementById('p3-top').value = data.positions[2].top;
        document.getElementById('p3-left').value = data.positions[2].left;
    }
    
    const backBtn = document.getElementById('back-to-add-btn');

    function clearForm() {
        document.getElementById('form-title').textContent = 'Tambah Template Baru';
        document.getElementById('upload-form-group').style.display = 'block';
        document.getElementById('save-template-btn').textContent = 'Simpan';
        // --- PERBAIKAN DI SINI ---
        // Mengosongkan nilai input secara manual, bukan dengan .reset()
        document.getElementById('photo-width').value = '';
        document.getElementById('photo-height').value = '';
        document.getElementById('p1-top').value = '';
        document.getElementById('p1-left').value = '';
        document.getElementById('p2-top').value = '';
        document.getElementById('p2-left').value = '';
        document.getElementById('p3-top').value = '';
        document.getElementById('p3-left').value = '';
        // --- AKHIR PERBAIKAN ---
        document.getElementById('file-name-display').textContent = 'Tidak ada file dipilih';
        backBtn.style.display = 'none';
        tempFilePath = null;
        editMode = null;
    }
    backBtn.addEventListener('click', clearForm);

    function enterEditMode(fileName) {
        editMode = fileName;
        populateForm(fileName);
        document.getElementById('form-title').textContent = `Edit: ${fileName}`;
        document.getElementById('upload-form-group').style.display = 'none';
        document.getElementById('save-template-btn').textContent = 'Simpan Perubahan';
        backBtn.style.display = 'block';
    }

    currentTemplates = await window.electronAPI.getTemplates();
    renderTemplates(currentTemplates);

    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 't') {
            adminBtn.style.display = 'block';
        }
    });

    adminBtn.addEventListener('click', () => {
        renderAdminList(currentTemplates);
        clearForm();
        adminModal.style.display = 'flex';
    });

    closeModalBtn.addEventListener('click', () => { adminModal.style.display = 'none'; });

    document.getElementById('upload-btn').addEventListener('click', async () => {
        tempFilePath = await window.electronAPI.openFileDialog();
        if(tempFilePath) {
            document.getElementById('file-name-display').textContent = tempFilePath.split('\\').pop().split('/').pop();
        }
    });

    document.getElementById('save-template-btn').addEventListener('click', async () => {
        const configData = {
            photoSize: {
                width: parseInt(document.getElementById('photo-width').value),
                height: parseInt(document.getElementById('photo-height').value)
            },
            positions: [
                { top: parseInt(document.getElementById('p1-top').value), left: parseInt(document.getElementById('p1-left').value) },
                { top: parseInt(document.getElementById('p2-top').value), left: parseInt(document.getElementById('p2-left').value) },
                { top: parseInt(document.getElementById('p3-top').value), left: parseInt(document.getElementById('p3-left').value) }
            ]
        };
        
        let result;
        if (editMode) {
            result = await window.electronAPI.updateTemplateConfig({ fileName: editMode, configData });
            if (result.success) {
                currentTemplates[editMode] = { ...currentTemplates[editMode], ...configData };
                showAlert('Perubahan berhasil disimpan!');
                clearForm();
            }
        } else {
            if (!tempFilePath) {
                showAlert('Pilih file template terlebih dahulu!');
                return;
            }
            result = await window.electronAPI.saveNewTemplate({ tempPath: tempFilePath, configData });
            if (result.success) {
                Object.assign(currentTemplates, result.newTemplate);
                showAlert('Template baru berhasil disimpan!');
                renderAdminList(currentTemplates);
                clearForm();
            }
        }

        if (!result.success) {
            showAlert(`Gagal: ${result.error}`);
        }
    });
});