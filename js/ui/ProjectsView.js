import { jhomeRepository } from '../repositories/JhomeRepository.js';

export class ProjectsView {
    constructor() {
        this.tbody = document.getElementById('jhome-projects-tbody');
    }

    async load() {
        if (!this.tbody) return;
        try {
            const projects = await jhomeRepository.getProjects();
            this.render(projects);
        } catch (e) {
            console.error(e);
            if (typeof window.showToast === 'function') {
                window.showToast('خطأ في جلب المشاريع', 'error');
            }
        }
    }

    render(projects) {
        if (projects.length === 0) {
            this.tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد مشاريع مضافة</td></tr>';
            return;
        }

        // Use DocumentFragment to avoid DOM thrashing (Phase 1 Performance Fix)
        const fragment = document.createDocumentFragment();

        projects.forEach(p => {
            const tr = document.createElement('tr');
            const imgUrl = p.image || 'https://via.placeholder.com/150';
            const shortDesc = p.description ? p.description.substring(0, 50) + '...' : '';
            
            tr.innerHTML = `
                <td><img src="${imgUrl}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;"></td>
                <td><strong>${p.title}</strong></td>
                <td><span class="text-muted">${shortDesc}</span></td>
                <td><a href="${p.link}" target="_blank" class="btn btn-sm btn-ghost">زيارة</a></td>
                <td>
                  <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteProject('${p.id}')">حذف</button>
                </td>
            `;
            fragment.appendChild(tr);
        });

        this.tbody.innerHTML = '';
        this.tbody.appendChild(fragment);
    }

    showModal() {
        document.getElementById('jproject-title').value = '';
        document.getElementById('jproject-desc').value = '';
        document.getElementById('jproject-link').value = '';
        document.getElementById('jproject-image').value = '';
        // Reset upload zone
        if (window.AdminHelpers) {
          AdminHelpers.clearSingleImg('jproject-image-file','jproject-img-preview','jproject-upload-zone');
        }
        document.getElementById('jhome-project-modal').style.display = 'flex';
        setTimeout(() => window.AdminHelpers && AdminHelpers.initDragDrop(), 100);
      }

    async save() {
        const title = document.getElementById('jproject-title').value.trim();
        const description = document.getElementById('jproject-desc').value.trim();
        const link = document.getElementById('jproject-link').value.trim();
        let image = document.getElementById('jproject-image').value.trim();

        // Upload image file if selected
        const fileInput = document.getElementById('jproject-image-file');
        if (fileInput && fileInput.files[0]) {
            try {
                if (typeof window.showToast === 'function') window.showToast('جاري رفع الصورة...', 'info');
                image = await AdminHelpers.uploadToJhomeStorage(fileInput.files[0], 'projects');
            } catch(uploadErr) {
                console.error('Upload error:', uploadErr);
                if (typeof window.showToast === 'function') window.showToast('فشل رفع الصورة: ' + uploadErr.message, 'error');
                return;
            }
        }

        if (!title || !description || !link) {
            if (typeof window.showToast === 'function') window.showToast('الرجاء إكمال الحقول المطلوبة (الاسم، الوصف، الرابط)', 'error');
            return;
        }
        
        try {
            await jhomeRepository.addProject({ title, description, link, image });
            if (typeof window.showToast === 'function') window.showToast('تمت إضافة المشروع بنجاح', 'success');
            if (window.AdminApp) window.AdminApp.closeModal('jhome-project-modal');
            await this.load();
        } catch(e) {
            console.error(e);
            if (typeof window.showToast === 'function') window.showToast('حدث خطأ أثناء الإضافة', 'error');
        }
      }

    async delete(id) {
        if (!confirm('حذف هذا المشروع؟')) return;
        try {
            await jhomeRepository.deleteProject(id);
            if (typeof window.showToast === 'function') window.showToast('تم الحذف', 'success');
            await this.load();
        } catch(e) {
            console.error(e);
            if (typeof window.showToast === 'function') window.showToast('حدث خطأ أثناء الحذف', 'error');
        }
    }
}

export const projectsView = new ProjectsView();
