import { jhomeRepository } from '../repositories/JhomeRepository.js';

export class AcademyView {
    constructor() {
        this.coursesGrid = document.getElementById('courses-list-tbody');
        this.requestsTbody = document.getElementById('course-requests-tbody');
        this.usersTbody = document.getElementById('course-users-tbody');
    }

    async load() {
        await this.renderCourses();
        await this.renderRequests();
        await this.renderUsers();
    }

    async renderCourses() {
        const grid = document.getElementById('courses-list-tbody');
        if (!grid) {
            console.log("[DEBUG] courses-list-tbody is null in renderCourses!");
            return;
        }
        try {
            console.log("[DEBUG] Fetching courses...");
            const courses = await jhomeRepository.getCourses();
            console.log("[DEBUG] Fetched courses length:", courses.length);
            if (courses.length === 0) {
                grid.innerHTML = '<tr><td colspan="4" class="empty-state">لا توجد دورات حالياً</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            courses.forEach(c => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border)';
                tr.dataset.id = c.id;
                tr.innerHTML = `
                    <td style="padding: 1rem;">
                      <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${c.thumbnail || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">
                        <strong>${c.title}</strong>
                      </div>
                    </td>
                    <td style="padding: 1rem;">${c.duration} أيام</td>
                    <td style="padding: 1rem;">
                      <span class="badge ${c.status === 'active' ? 'bg-success' : 'bg-warning'}">${c.status === 'active' ? 'نشط' : 'قيد المراجعة'}</span>
                    </td>
                    <td style="padding: 1rem; display:flex; gap:10px;">
                        <button class="btn btn-sm btn-ghost" onclick="JhomeApp.openCourse('${c.id}')"><span class="material-icons-outlined">visibility</span> التفاصيل</button>
                        <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteCourse('${c.id}')"><span class="material-icons-outlined">delete</span></button>
                    </td>
                `;
                fragment.appendChild(tr);
            });
            grid.innerHTML = '';
            grid.appendChild(fragment);
            console.log("[DEBUG] Rendered courses to DOM.");
        } catch(e) {
            console.error("[DEBUG] Error in renderCourses:", e);
        }
    }

    async addCourse(e) {
        e.preventDefault();
        
        try {
            if (typeof window.showToast === 'function') window.showToast('جاري إنشاء الدورة...', 'success');
            
            const fileInput = document.getElementById('jcourse-cover-file');
            let thumbnail = '';
            if (fileInput && fileInput.files[0]) {
                if (window.AdminHelpers) {
                    thumbnail = await AdminHelpers.uploadToJhomeStorage(fileInput.files[0], 'courses');
                } else if (window.JhomeApp && window.JhomeApp.uploadJhomeImage) {
                    thumbnail = await window.JhomeApp.uploadJhomeImage(fileInput.files[0], 'courses');
                }
            }

            const title = document.getElementById('jcourse-title').value;
            const description = document.getElementById('jcourse-desc').value;
            const instructor = document.getElementById('jcourse-instructor-name').value;
            const instructorEmail = document.getElementById('jcourse-instructor-email').value;
            const instructorSpecialty = document.getElementById('jcourse-instructor-specialty').value;
            const instructorBio = document.getElementById('jcourse-instructor-bio').value;
            const isPaid = document.getElementById('jcourse-is-paid').checked;
            const duration = document.getElementById('jcourse-duration').value;
            const status = document.getElementById('jcourse-status').value;

            await jhomeRepository.addCourse({
                title: title || '',
                description: description || '',
                instructor: instructor || '',
                instructorEmail: instructorEmail || '',
                instructorSpecialty: instructorSpecialty || '',
                instructorBio: instructorBio || '',
                isPaid: isPaid || false,
                duration: duration || '',
                status: status || 'open',
                thumbnail: thumbnail
            });

            if (typeof window.showToast === 'function') window.showToast('تمت إضافة الدورة بنجاح', 'success');
            if (window.AdminApp) window.AdminApp.closeModal('jhome-course-modal');
            
            document.getElementById('jcourse-title').value = '';
            document.getElementById('jcourse-desc').value = '';
            document.getElementById('jcourse-instructor-name').value = '';
            document.getElementById('jcourse-instructor-email').value = '';
            document.getElementById('jcourse-instructor-specialty').value = '';
            document.getElementById('jcourse-instructor-bio').value = '';
            document.getElementById('jcourse-duration').value = '';
            document.getElementById('jcourse-cover-file').value = '';
            const preview = document.getElementById('jcourse-img-preview');
            if (preview) preview.style.display = 'none';
            const uploadZone = document.getElementById('jcourse-upload-zone');
            if (uploadZone) uploadZone.style.display = 'block';

            await this.renderCourses();
        } catch(err) {
            console.error(err);
            if (typeof window.showToast === 'function') window.showToast('خطأ أثناء الإضافة', 'error');
        }
    }

    async deleteCourse(id) {
        if(!confirm('هل أنت متأكد من حذف هذه الدورة؟ سيتم حذف جميع الدروس المتعلقة بها أيضاً.')) return;
        try {
            await jhomeRepository.deleteCourse(id);
            if (typeof window.showToast === 'function') window.showToast('تم حذف الدورة', 'success');
            await this.renderCourses();
        } catch(e) {
            console.error(e);
        }
    }

    openCourse(id) {
        if (typeof window.showToast === 'function') window.showToast('سيتم توجيهك لإدارة الدورة...');
        window.open(`../course-room.html?id=${id}&admin=true`, '_blank');
    }

    async renderRequests() {
        if (!this.requestsTbody) return;
        try {
            const requests = await jhomeRepository.getCourseRequests();
            if (requests.length === 0) {
                this.requestsTbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد طلبات اشتراك حالياً</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            requests.forEach(r => {
                const date = r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate().toLocaleDateString('ar-EG') : new Date(r.createdAt).toLocaleDateString('ar-EG')) : '—';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.studentName || '—'}</strong><br><small class="text-muted">${r.studentPhone || '—'}</small></td>
                    <td>${r.courseTitle || '—'}</td>
                    <td>${date}</td>
                    <td><span class="report-status ${r.status === 'approved' ? 'reviewed' : (r.status === 'rejected' ? 'rejected' : 'pending')}">
                        ${r.status === 'approved' ? 'مقبول' : (r.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة')}
                    </span></td>
                    <td>
                      ${r.receiptUrl ? `<a href="${r.receiptUrl}" target="_blank" class="btn btn-sm btn-ghost">عرض الإيصال</a>` : 'لا يوجد'}
                    </td>
                    <td>
                      ${r.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="JhomeApp.approveCourseRequest('${r.id}', '${r.studentName}')">قبول</button>
                        <button class="btn btn-sm btn-danger" onclick="JhomeApp.rejectCourseRequest('${r.id}')">رفض</button>
                      ` : ''}
                    </td>
                `;
                fragment.appendChild(tr);
            });
            this.requestsTbody.innerHTML = '';
            this.requestsTbody.appendChild(fragment);
        } catch(e) {
            console.error(e);
        }
    }

    async approveCourseRequest(reqId, studentName) {
        if (!confirm(`هل أنت متأكد من قبول طلب ${studentName}؟`)) return;
        try {
            await jhomeRepository.approveCourseRequest(reqId);
            if (typeof window.showToast === 'function') window.showToast('تم قبول الطلب', 'success');
            await this.renderRequests();
        } catch(e) {
            console.error(e);
        }
    }

    async rejectCourseRequest(reqId) {
        if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
        try {
            await jhomeRepository.rejectCourseRequest(reqId);
            if (typeof window.showToast === 'function') window.showToast('تم رفض الطلب');
            await this.renderRequests();
        } catch(e) {
            console.error(e);
        }
    }

    async renderUsers() {
        if (!this.usersTbody) return;
        try {
            const users = await jhomeRepository.getCourseUsers();
            if (users.length === 0) {
                this.usersTbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا يوجد مستخدمين/مدربين حالياً</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            users.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${u.name || '—'}</strong></td>
                    <td>${u.email || '—'}</td>
                    <td><span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-freelancer'}">${u.role === 'admin' ? 'مدرب/مشرف' : 'طالب'}</span></td>
                    <td>${u.password || '—'}</td>
                    <td>
                      <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteCourseUser('${u.id}')">حذف</button>
                    </td>
                `;
                fragment.appendChild(tr);
            });
            this.usersTbody.innerHTML = '';
            this.usersTbody.appendChild(fragment);
        } catch(e) {
            console.error(e);
        }
    }

    async addCourseInstructor(e) {
        e.preventDefault();
        const form = e.target;
        try {
            await jhomeRepository.addCourseInstructor({
                name: form.querySelector('input[placeholder="الاسم الكامل"]').value,
                email: form.querySelector('input[placeholder="البريد الإلكتروني"]').value,
                password: form.querySelector('input[placeholder="كلمة المرور"]').value,
                role: 'admin'
            });
            
            if (typeof window.showToast === 'function') window.showToast('تم إضافة المدرب بنجاح', 'success');
            if (window.AdminApp) window.AdminApp.closeModal('jhome-add-instructor-modal');
            form.reset();
            await this.renderUsers();
        } catch(err) {
            console.error(err);
            if (typeof window.showToast === 'function') window.showToast('حدث خطأ', 'error');
        }
    }

    async deleteCourseUser(userId) {
        if (!confirm('حذف هذا المستخدم من النظام الأكاديمي؟')) return;
        try {
            await jhomeRepository.deleteCourseUser(userId);
            if (typeof window.showToast === 'function') window.showToast('تم الحذف');
            await this.renderUsers();
        } catch(e) {
            console.error(e);
        }
    }
}

export const academyView = new AcademyView();
