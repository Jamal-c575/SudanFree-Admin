import { jhomeRepository } from '../repositories/JhomeRepository.js';

export class StoriesView {
    constructor() {
        this.pubTbody = document.getElementById('jhome-stories-tbody');
        this.subList = document.getElementById('jhome-story-submissions-list');
    }

    async load() {
        await this.loadPublishedStories();
        await this.loadSubmissions();
    }

    async loadPublishedStories() {
        if (!this.pubTbody) return;
        try {
            const stories = await jhomeRepository.getPublishedStories();
            
            if (stories.length === 0) {
                this.pubTbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد قصص نجاح</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            stories.forEach(s => {
                const tr = document.createElement('tr');
                const img = s.coverImage || s.personAvatar || 'https://via.placeholder.com/150';
                const name = s.personName || s.title || '—';
                const role = s.personRole || '—';
                const achievement = s.keyAchievement || '—';

                tr.innerHTML = `
                    <td><img src="${img}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"></td>
                    <td><strong>${name}</strong></td>
                    <td>${role}</td>
                    <td>${achievement}</td>
                    <td>
                      <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteStory('${s.id}')">حذف</button>
                    </td>
                `;
                fragment.appendChild(tr);
            });
            this.pubTbody.innerHTML = '';
            this.pubTbody.appendChild(fragment);
        } catch (e) {
            console.error('Error loading published stories:', e);
            if (typeof window.showToast === 'function') window.showToast('خطأ في جلب القصص', 'error');
        }
    }

    async loadSubmissions() {
        if (!this.subList) return;
        try {
            const submissions = await jhomeRepository.getPendingSubmissions();

            if (submissions.length === 0) {
                this.subList.innerHTML = '<p class="empty-state">لا توجد تقديمات جديدة بانتظار المراجعة</p>';
                return;
            }

            const fragment = document.createDocumentFragment();
            submissions.forEach(sub => {
                const div = document.createElement('div');
                div.className = 'verify-card';
                div.style.cssText = 'padding:15px; margin-bottom:15px;';
                
                const title = sub.title || 'قصة نجاح';
                const link = sub.profileLink ? `<p><strong>رابط الحرفي:</strong> <a href="${encodeURI(sub.profileLink)}" target="_blank" style="color:var(--primary);text-decoration:underline;">${sub.profileLink}</a></p>` : '';

                div.innerHTML = `
                    <h4>${title}</h4>
                    <p><strong>من:</strong> ${sub.submitterName} - ${sub.submitterEmail} (${sub.submitterPhone})</p>
                    ${link}
                    <p style="margin-top:10px; background:var(--bg-body); padding:10px; border-radius:8px;">${sub.story}</p>
                    <div style="margin-top:10px; display:flex; gap:10px;">
                      <button class="btn btn-sm btn-success" onclick="JhomeApp.approveStorySubmission('${sub.id}')">اعتماد ونشر</button>
                      <button class="btn btn-sm btn-danger" onclick="JhomeApp.rejectStorySubmission('${sub.id}')">رفض</button>
                    </div>
                `;
                fragment.appendChild(div);
            });
            this.subList.innerHTML = '';
            this.subList.appendChild(fragment);
        } catch (e) {
            console.error('Error loading submissions:', e);
        }
    }

    async approveSubmission(id) {
        if (!confirm('سيتم نشر هذه القصة للعلن، هل أنت موافق؟')) return;
        try {
            await jhomeRepository.approveStorySubmission(id);
            if (typeof window.showToast === 'function') window.showToast('تم الموافقة على القصة', 'success');
            await this.load();
        } catch(e) {
            console.error(e);
            if (typeof window.showToast === 'function') window.showToast('خطأ', 'error');
        }
    }

    async rejectSubmission(id) {
        if (!confirm('هل تريد رفض وحذف هذا التقديم؟')) return;
        try {
            await jhomeRepository.rejectStorySubmission(id);
            if (typeof window.showToast === 'function') window.showToast('تم الرفض', 'success');
            await this.load();
        } catch(e) {
            console.error(e);
            if (typeof window.showToast === 'function') window.showToast('خطأ', 'error');
        }
    }

    async deleteStory(id) {
        if (!confirm('هل أنت متأكد من حذف القصة؟')) return;
        try {
            await jhomeRepository.deleteStory(id);
            if (typeof window.showToast === 'function') window.showToast('تم الحذف', 'success');
            await this.loadPublishedStories();
        } catch(e) {
            console.error(e);
        }
    }

    showModal() {
        document.getElementById('jstory-person').value = '';
        document.getElementById('jstory-role').value = '';
        document.getElementById('jstory-achievement').value = '';
        document.getElementById('jstory-content').value = '';
        document.getElementById('jstory-freelancer-link').value = '';
        document.getElementById('jstory-cover-url').value = '';
        document.getElementById('jstory-cover-file').value = '';
        document.getElementById('jhome-story-modal').style.display = 'flex';
    }

    async save() {
        const title = document.getElementById('jstory-person').value.trim();
        const personRole = document.getElementById('jstory-role').value.trim();
        const keyAchievement = document.getElementById('jstory-achievement').value.trim();
        const story = document.getElementById('jstory-content').value.trim();
        const freelancerLink = document.getElementById('jstory-freelancer-link').value.trim();
        let coverImage = document.getElementById('jstory-cover-url').value.trim();
        
        const fileInput = document.getElementById('jstory-cover-file');
        const file = fileInput.files[0];

        if (!title || !story) {
            if (typeof window.showToast === 'function') window.showToast('الرجاء إدخال اسم الشخص وتفاصيل القصة', 'error');
            return;
        }

        try {
            if (typeof window.showToast === 'function') window.showToast('جاري الحفظ...', 'success');
            if (file && window.JhomeApp && window.JhomeApp.uploadJhomeImage) {
                // Keep using the centralized uploader for now
                coverImage = await window.JhomeApp.uploadJhomeImage(file, 'successStories');
            }

            await jhomeRepository.addStory({
                personName: title,
                title: title,
                personRole,
                keyAchievement,
                story,
                freelancerLink,
                coverImage
            });

            if (typeof window.showToast === 'function') window.showToast('تم النشر بنجاح', 'success');
            if (window.AdminApp) window.AdminApp.closeModal('jhome-story-modal');
            await this.loadPublishedStories();
        } catch (e) {
            console.error('Error saving story:', e);
            if (typeof window.showToast === 'function') window.showToast('خطأ أثناء الحفظ', 'error');
        }
    }
}

export const storiesView = new StoriesView();
