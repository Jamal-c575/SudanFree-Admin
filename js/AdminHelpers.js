/**
 * AdminHelpers.js
 * Utility module for image upload zones, previews, and Firebase Storage uploads.
 * Used across all forms in the SudanFree-Admin dashboard.
 */

const AdminHelpers = {

  /**
   * Show a single image preview inside an upload zone.
   * @param {string} fileInputId - ID of the hidden <input type="file">
   * @param {string} previewId   - ID of the preview container div
   * @param {string} zoneId      - ID of the .img-upload-zone div
   */
  previewSingleImg(fileInputId, previewId, zoneId) {
    const fileInput = document.getElementById(fileInputId);
    const preview   = document.getElementById(previewId);
    const zone      = document.getElementById(zoneId);

    if (!fileInput || !fileInput.files[0]) return;
    const file = fileInput.files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.style.display = 'block';
      preview.innerHTML = `
        <div style="position:relative; display:inline-block; width:100%;">
          <img src="${e.target.result}" class="img-upload-preview-single" alt="">
          <button type="button" onclick="AdminHelpers.clearSingleImg('${fileInputId}','${previewId}','${zoneId}')"
            style="position:absolute;top:6px;right:6px;background:var(--danger);color:#fff;border:none;border-radius:50%;
                   width:28px;height:28px;cursor:pointer;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;">
            &times;
          </button>
          <p style="margin:6px 0 0;font-size:12px;color:var(--text-muted);text-align:center;">${file.name}</p>
        </div>`;
      if (zone) {
        zone.classList.add('has-image');
        zone.style.pointerEvents = 'none';
      }
    };
    reader.readAsDataURL(file);
  },

  clearSingleImg(fileInputId, previewId, zoneId) {
    const fileInput = document.getElementById(fileInputId);
    const preview   = document.getElementById(previewId);
    const zone      = document.getElementById(zoneId);
    if (fileInput)  fileInput.value = '';
    if (preview)    { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (zone)       { zone.classList.remove('has-image'); zone.style.pointerEvents = ''; }
  },

  /**
   * Show multiple image previews as chips (for ads multi-upload).
   */
  previewImgUpload(fileInputId, previewId, zoneId) {
    const fileInput = document.getElementById(fileInputId);
    const preview   = document.getElementById(previewId);
    const zone      = document.getElementById(zoneId);

    if (!fileInput || !fileInput.files.length) return;

    preview.style.display = 'flex';
    preview.innerHTML = '';

    Array.from(fileInput.files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const chip = document.createElement('div');
        chip.className = 'img-preview-chip';
        chip.innerHTML = `
          <img src="${e.target.result}" alt="${file.name}" title="${file.name}">
          <button type="button" class="remove-img" onclick="this.closest('.img-preview-chip').remove()">&times;</button>`;
        preview.appendChild(chip);
      };
      reader.readAsDataURL(file);
    });

    if (zone) zone.classList.add('has-image');
  },

  /**
   * Upload a single file to the main SudanFree Firebase Storage.
   */
  async uploadToStorage(file, folder = 'uploads') {
    const user = firebase.auth().currentUser;
    const uid  = user ? user.uid : 'admin';
    const ext  = file.name.split('.').pop();
    const name = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const ref  = firebase.storage().ref().child(`${folder}/${uid}/${name}`);
    const snap = await ref.put(file);
    return await snap.ref.getDownloadURL();
  },

  /**
   * Upload a single file to the Jhome Firebase app's storage.
   */
  async uploadToJhomeStorage(file, folder = 'uploads') {
    const ext  = file.name.split('.').pop();
    const name = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const ref  = firebase.app('jhome').storage().ref().child(`${folder}/${name}`);
    const snap = await ref.put(file);
    return await snap.ref.getDownloadURL();
  },

  /** Setup drag-and-drop for all .img-upload-zone elements */
  initDragDrop() {
    document.querySelectorAll('.img-upload-zone').forEach(zone => {
      if (zone._ddInit) return;
      zone._ddInit = true;
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const input = zone.querySelector('input[type="file"]');
        if (!input) return;
        const dt = new DataTransfer();
        Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      });
    });
  }
};

window.AdminHelpers = AdminHelpers;

document.addEventListener('DOMContentLoaded', () => AdminHelpers.initDragDrop());
document.addEventListener('click', () => setTimeout(() => AdminHelpers.initDragDrop(), 150));
