import { jhomeRepository } from '../repositories/JhomeRepository.js';

export class BlogView {
    constructor() {
        this.tbody = document.getElementById('jhome-posts-tbody');
    }

    async load() {
        if (!this.tbody) return;
        try {
            const posts = await jhomeRepository.getPosts();
            
            if (posts.length === 0) {
                this.tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد مقالات منشورة حتى الآن</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            posts.forEach(p => {
                const tr = document.createElement('tr');
                const date = p.publishedAt ? (p.publishedAt.toDate ? p.publishedAt.toDate().toLocaleDateString('ar-EG') : new Date(p.publishedAt).toLocaleDateString('ar-EG')) : '—';
                const img = p.coverImage || 'https://via.placeholder.com/150';
                const author = p.authorName || 'إدارة Jhome';
                const category = p.category || 'عام';
                const statusClass = p.status === 'published' ? 'reviewed' : 'pending';
                const statusText = p.status === 'published' ? 'منشور' : 'مسودة';

                tr.innerHTML = `
                    <td><img src="${img}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;"></td>
                    <td><strong>${p.title}</strong><br><small style="color:var(--text-muted)">${author}</small></td>
                    <td><span class="role-badge role-freelancer">${category}</span></td>
                    <td><span class="report-status ${statusClass}">${statusText}</span></td>
                    <td>${date}</td>
                    <td>
                      <button class="btn btn-sm btn-danger" onclick="JhomeApp.deletePost('${p.id}')">حذف</button>
                    </td>
                `;
                fragment.appendChild(tr);
            });

            this.tbody.innerHTML = '';
            this.tbody.appendChild(fragment);
        } catch (e) {
            console.error('Error loading posts:', e);
            if (typeof window.showToast === 'function') window.showToast('خطأ في جلب المقالات', 'error');
        }
    }

    async delete(id) {
        if (!confirm('هل أنت متأكد من حذف هذا المقال نهائياً؟')) return;
        try {
            await jhomeRepository.deletePost(id);
            if (typeof window.showToast === 'function') window.showToast('تم الحذف بنجاح', 'success');
            await this.load();
        } catch (e) {
            console.error(e);
            if (typeof window.showToast === 'function') window.showToast('حدث خطأ أثناء الحذف', 'error');
        }
    }

    showModal() {
        document.getElementById('jpost-title').value = '';
        document.getElementById('jpost-slug').value = '';
        document.getElementById('jpost-excerpt').value = '';
        document.getElementById('jpost-content').value = '';
        document.getElementById('jpost-cover-url').value = '';
        document.getElementById('jpost-cover-file').value = '';
        document.getElementById('jpost-category').value = '';
        document.getElementById('jpost-featured').checked = false;
        document.getElementById('jhome-post-modal').style.display = 'flex';
    }

    async save() {
        const title = document.getElementById('jpost-title').value.trim();
        const slug = document.getElementById('jpost-slug').value.trim();
        const excerpt = document.getElementById('jpost-excerpt').value.trim();
        const content = document.getElementById('jpost-content').value.trim();
        let coverImage = document.getElementById('jpost-cover-url').value.trim();
        const category = document.getElementById('jpost-category').value.trim();
        const isFeatured = document.getElementById('jpost-featured').checked;
        
        const fileInput = document.getElementById('jpost-cover-file');
        const file = fileInput.files[0];

        if (!title || !slug || !content) {
            if (typeof window.showToast === 'function') window.showToast('الرجاء إدخال العنوان، الرابط، والمحتوى الأساسي', 'error');
            return;
        }

        try {
            if (typeof window.showToast === 'function') window.showToast('جاري حفظ المقال...', 'success');
            
            if (file && window.JhomeApp && window.JhomeApp.uploadJhomeImage) {
                coverImage = await window.JhomeApp.uploadJhomeImage(file, 'posts');
            }

            await jhomeRepository.addPost({
                title,
                slug,
                excerpt,
                content,
                coverImage,
                category,
                isFeatured
            });

            if (typeof window.showToast === 'function') window.showToast('تم نشر المقال بنجاح!', 'success');
            if (window.AdminApp) window.AdminApp.closeModal('jhome-post-modal');
            await this.load();
        } catch (e) {
            console.error('Error saving post:', e);
            if (typeof window.showToast === 'function') window.showToast('خطأ أثناء حفظ المقال', 'error');
        }
    }
}

export const blogView = new BlogView();
