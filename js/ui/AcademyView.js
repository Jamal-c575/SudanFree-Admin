import { jhomeRepository } from '../repositories/JhomeRepository.js';

export class AcademyView {
    constructor() {
        this.coursesGrid = document.getElementById('courses-list-tbody');
        this.requestsTbody = document.getElementById('course-requests-tbody');
        this.studentsTbody = document.getElementById('course-students-tbody');
        this.instructorsTbody = document.getElementById('course-instructors-tbody');
        this.activeCourseId = null;
    }

    async load() {
        await this.renderCourses();
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

    async openCourse(id) {
        if (typeof window.showToast === 'function') window.showToast('جاري فتح تفاصيل الدورة...', 'info');
        
        const course = this.courses.find(c => c.id === id);
        if (!course) return;

        // Set header details
        document.getElementById('detail-course-title').innerText = course.title || 'دورة بدون اسم';
        document.getElementById('detail-course-status').innerText = course.status === 'published' ? 'منشورة' : 'قيد المراجعة';

        document.getElementById('academy-courses-list').style.display = 'none';
        document.getElementById('academy-course-details').style.display = 'block';

        // Set the active course ID for requests and users
        this.activeCourseId = id;
        
        // Render sub-lists
        this.switchCourseTab('overview');
        await this.renderRequests();
        await this.renderCourseUsers();
        await this.renderCurriculum();
    }

    switchCourseTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.course-tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.course-details-tabs .btn').forEach(el => el.classList.replace('btn-primary', 'btn-ghost'));
        
        // Show selected tab
        document.getElementById(`course-tab-${tabName}`).style.display = 'block';
        const activeBtn = document.getElementById(`btn-tab-${tabName}`);
        if(activeBtn) {
            activeBtn.classList.replace('btn-ghost', 'btn-primary');
        }
    }

    closeCourseDetails() {
        this.activeCourseId = null;
        document.getElementById('academy-course-details').style.display = 'none';
        document.getElementById('academy-courses-list').style.display = 'block';
    }

    async renderRequests() {
        if (!this.requestsTbody || !this.activeCourseId) return;
        try {
            const requests = await jhomeRepository.getCourseRequests(this.activeCourseId);
            if (requests.length === 0) {
                this.requestsTbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد طلبات اشتراك حالياً</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            requests.forEach(r => {
                const date = r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate().toLocaleDateString('ar-EG') : new Date(r.createdAt).toLocaleDateString('ar-EG')) : '—';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.requestNumber || '—'}</strong></td>
                    <td><strong>${r.fullName || '—'}</strong></td>
                    <td><small class="text-muted" dir="ltr">${r.phone || '—'}</small></td>
                    <td>${date}</td>
                    <td><span class="report-status ${r.status === 'approved' ? 'reviewed' : (r.status === 'rejected' ? 'rejected' : 'pending')}">
                        ${r.status === 'approved' ? 'مقبول' : (r.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة')}
                    </span></td>
                    <td>
                      ${r.receiptUrl ? `<a href="${r.receiptUrl}" target="_blank" class="btn btn-sm btn-ghost">عرض الإيصال</a>` : 'لا يوجد'}
                    </td>
                    <td>
                      ${r.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="JhomeApp.approveCourseRequest('${r.id}', '${r.fullName ? r.fullName.replace(/'/g, "\\'") : 'الطالب'}')">قبول</button>
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

    async renderCourseUsers() {
        if (!this.studentsTbody || !this.activeCourseId) return;
        try {
            const users = await jhomeRepository.getCourseUsers(this.activeCourseId);
            const students = users.filter(u => u.role === 'student');
            const instructors = users.filter(u => u.role === 'admin' || u.role === 'instructor');

            if (students.length === 0) {
                this.studentsTbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا يوجد طلاب حالياً</td></tr>';
            } else {
                const fragment = document.createDocumentFragment();
                students.forEach(u => {
                    const date = u.createdAt ? (u.createdAt.toDate ? u.createdAt.toDate().toLocaleDateString('ar-EG') : new Date(u.createdAt).toLocaleDateString('ar-EG')) : '—';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${u.studentId || u.username || '—'}</strong></td>
                        <td>${u.username || '—'}</td>
                        <td>${date}</td>
                        <td>${u.lastLogin ? new Date(u.lastLogin.toDate()).toLocaleString('ar-EG') : 'لم يسجل دخول بعد'}</td>
                        <td>
                          <button class="btn btn-sm btn-primary" onclick="JhomeApp.openStudentDetails('${u.id}')">التفاصيل</button>
                        </td>
                    `;
                    fragment.appendChild(tr);
                });
                this.studentsTbody.innerHTML = '';
                this.studentsTbody.appendChild(fragment);
            }

            if (this.instructorsTbody) {
                if (instructors.length === 0) {
                    this.instructorsTbody.innerHTML = '<tr><td colspan="4" class="empty-state">لا يوجد مدربون/مشرفون حالياً</td></tr>';
                } else {
                    const frag2 = document.createDocumentFragment();
                    instructors.forEach(u => {
                        const date = u.createdAt ? (u.createdAt.toDate ? u.createdAt.toDate().toLocaleDateString('ar-EG') : new Date(u.createdAt).toLocaleDateString('ar-EG')) : '—';
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><strong>${u.name || '—'}</strong></td>
                            <td>${u.username || u.email || '—'}</td>
                            <td>${date}</td>
                            <td>
                              <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteCourseUser('${u.id}')">حذف</button>
                            </td>
                        `;
                        frag2.appendChild(tr);
                    });
                    this.instructorsTbody.innerHTML = '';
                    this.instructorsTbody.appendChild(frag2);
                }
            }
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
            form.reset();
            await this.renderCourseUsers();
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
            await this.renderCourseUsers();
        } catch(e) {
            console.error(e);
        }
    }

    // --- Tab Utilities ---

    filterRequests() {
        const filterVal = document.getElementById('course-requests-filter').value;
        const tbody = document.getElementById('course-requests-tbody');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            if (row.classList.contains('empty-state')) return;
            const statusSpan = row.querySelector('.report-status');
            const receiptLink = row.querySelector('a[href]');
            let isVisible = true;
            
            if (filterVal === 'pending' && (!statusSpan || !statusSpan.classList.contains('pending'))) isVisible = false;
            if (filterVal === 'approved' && (!statusSpan || !statusSpan.classList.contains('reviewed'))) isVisible = false;
            if (filterVal === 'rejected' && (!statusSpan || !statusSpan.classList.contains('rejected'))) isVisible = false;
            if (filterVal === 'paid' && !receiptLink) isVisible = false;
            if (filterVal === 'unpaid' && receiptLink) isVisible = false;

            row.style.display = isVisible ? '' : 'none';
        });
    }

    searchStudents() {
        const searchVal = document.getElementById('students-search').value.toLowerCase();
        const tbody = document.getElementById('course-students-tbody');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            if (row.classList.contains('empty-state')) return;
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchVal) ? '' : 'none';
        });
    }

    sortStudents() {
        const sortVal = document.getElementById('students-sort').value;
        const tbody = document.getElementById('course-students-tbody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr:not(.empty-state)'));
        if (rows.length === 0) return;

        rows.sort((a, b) => {
            // Very simple sorting logic based on the text content. 
            // In a real app, you'd re-render the sorted array from the state.
            const textA = a.cells[2].textContent; // date
            const textB = b.cells[2].textContent;
            if (sortVal === 'date_asc') return textA.localeCompare(textB);
            return textB.localeCompare(textA);
        });

        tbody.innerHTML = '';
        rows.forEach(r => tbody.appendChild(r));
    }

    printStudents() {
        const printContent = document.getElementById('print-area').innerHTML;
        const originalContent = document.body.innerHTML;
        document.body.innerHTML = `<div><h1 style="text-align:center;">قائمة الطلاب المقبولين</h1>${printContent}</div>`;
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload(); // Quick way to restore event listeners
    }

    exportStudentsExcel() {
        const table = document.getElementById('students-table');
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        
        for (const row of table.rows) {
            let rowData = [];
            for (const cell of row.cells) {
                // Ignore the details button column
                if(cell.cellIndex === 4) continue;
                rowData.push('"' + cell.innerText.replace(/"/g, '""') + '"');
            }
            csvContent += rowData.join(",") + "\r\n";
        }
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "students.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Student Details Modal ---
    
    async openStudentDetails(credId) {
        if (typeof window.showToast === 'function') window.showToast('جاري جلب بيانات الطالب...', 'info');
        
        try {
            const credDoc = await jhomeRepository.db.collection('courses_credentials').doc(credId).get();
            if (!credDoc.exists) return;
            const credData = credDoc.data();
            this.currentStudentCredId = credId;
            this.currentStudentCredData = credData;

            let reqData = {};
            if (credData.requestId) {
                const reqDoc = await jhomeRepository.db.collection('enrollmentRequests').doc(credData.requestId).get();
                if (reqDoc.exists) reqData = reqDoc.data();
            }

            document.getElementById('sd-name').textContent = reqData.fullName || credData.name || '—';
            document.getElementById('sd-email').textContent = reqData.email || '—';
            document.getElementById('sd-phone').textContent = reqData.phone || '—';
            document.getElementById('sd-location').textContent = (reqData.country || '—') + '، ' + (reqData.city || '—');
            document.getElementById('sd-date').textContent = credData.createdAt ? new Date(credData.createdAt.toDate()).toLocaleDateString('ar-EG') : '—';
            document.getElementById('sd-payment').textContent = reqData.paymentStatus === 'paid' ? 'مدفوع' : 'مجاني';
            
            document.getElementById('sd-username').textContent = credData.username || '—';
            document.getElementById('sd-password').textContent = credData.password || '—';
            document.getElementById('sd-last-login').textContent = credData.lastLogin ? new Date(credData.lastLogin.toDate()).toLocaleString('ar-EG') : 'لم يسجل دخول بعد';
            document.getElementById('sd-login-count').textContent = credData.loginCount || 0;

            const receiptContainer = document.getElementById('sd-receipt-container');
            if (reqData.receiptUrl) {
                receiptContainer.innerHTML = `<a href="${reqData.receiptUrl}" target="_blank"><img src="${reqData.receiptUrl}" style="max-width: 100%; max-height: 200px; border-radius: 8px;"></a>`;
            } else {
                receiptContainer.innerHTML = '<p class="text-muted">لا يوجد إيصال</p>';
            }

            document.getElementById('student-details-modal').classList.add('active');
        } catch(e) {
            console.error(e);
            if (typeof window.showToast === 'function') window.showToast('فشل جلب البيانات', 'error');
        }
    }

    copyStudentCredentials() {
        if (!this.currentStudentCredData) return;
        const text = `بيانات الدخول للدورة:\nاسم المستخدم: ${this.currentStudentCredData.username}\nكلمة المرور: ${this.currentStudentCredData.password}\nالرابط: https://sudanfree.net/course-room.html`;
        navigator.clipboard.writeText(text).then(() => {
            if (typeof window.showToast === 'function') window.showToast('تم النسخ بنجاح', 'success');
        });
    }

    // --- Certificate Generator Skeleton ---
    
    async openCertificateModal() {
        if (!this.currentStudentCredData || !this.activeCourseId) {
            if (typeof window.showToast === 'function') window.showToast('يرجى تحديد الطالب والدورة أولاً', 'error');
            return;
        }

        // 1. Fetch Course details to get supervisor and course name
        let courseName = "غير محدد";
        let supervisorName = "غير محدد";
        try {
            const cDoc = await jhomeRepository.db.collection('courses').doc(this.activeCourseId).get();
            if (cDoc.exists) {
                const cData = cDoc.data();
                courseName = cData.title || courseName;
                supervisorName = cData.instructorName || supervisorName; // Usually stored as instructorId/Name
            }
        } catch(e) { console.error("Failed to fetch course data", e); }

        // 2. Fetch original request details for location and education
        let educationLevel = "غير محدد";
        let location = "غير محدد";
        let studentName = this.currentStudentCredData.name || "غير محدد";
        
        try {
            if (this.currentStudentCredData.requestId) {
                const reqDoc = await jhomeRepository.db.collection('enrollmentRequests').doc(this.currentStudentCredData.requestId).get();
                if (reqDoc.exists) {
                    const rData = reqDoc.data();
                    educationLevel = rData.educationLevel || educationLevel;
                    location = (rData.country || '') + (rData.city ? '، ' + rData.city : '');
                    studentName = rData.fullName || studentName;
                }
            }
        } catch(e) { console.error("Failed to fetch request data", e); }

        // 3. Populate form
        document.getElementById('cert-student-name').value = studentName;
        document.getElementById('cert-course-name').value = courseName;
        document.getElementById('cert-education').value = educationLevel;
        document.getElementById('cert-location').value = location;
        document.getElementById('cert-supervisor').value = supervisorName;
        document.getElementById('cert-score').value = ""; // Wait for admin input

        // 4. Open Modal
        document.getElementById('certificate-generator-modal').classList.add('active');
    }

    generateCertificate() {
        const score = document.getElementById('cert-score').value;
        if (!score || score < 0 || score > 100) {
            if (typeof window.showToast === 'function') window.showToast('يرجى إدخال نسبة مئوية صحيحة بين 0 و 100', 'error');
            return;
        }

        // Logic is paused here until design is received.
        if (typeof window.showToast === 'function') {
            window.showToast('الهيكل البرمجي جاهز. سيتم تفعيل التوليد الفعلي بعد استلام تصميم الشهادة.', 'success');
        }
        
        // document.getElementById('certificate-generator-modal').classList.remove('active');
    }

    async regenerateStudentPassword() {
        if (!confirm('هل أنت متأكد من تغيير كلمة مرور الطالب؟')) return;
        if (!this.currentStudentCredId) return;
        
        try {
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let newPassword = "";
            for (let i = 0; i < 8; i++) {
                newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            await jhomeRepository.db.collection('courses_credentials').doc(this.currentStudentCredId).update({
                password: newPassword, // TODO: Hash
                mustChangePassword: true
            });

            if (typeof window.showToast === 'function') window.showToast('تم تغيير كلمة المرور بنجاح', 'success');
            
            document.getElementById('sd-password').textContent = newPassword;
            this.currentStudentCredData.password = newPassword;
            
            await this.renderCourseUsers();
        } catch(e) {
            console.error(e);
        }
    }

    async deleteStudentAccount() {
        if (!confirm('سيتم حذف حساب هذا الطالب. هل أنت متأكد؟')) return;
        if (!this.currentStudentCredId) return;

        try {
            await jhomeRepository.deleteCourseUser(this.currentStudentCredId);
            if (typeof window.showToast === 'function') window.showToast('تم حذف الطالب بنجاح');
            document.getElementById('student-details-modal').classList.remove('active');
            await this.renderCourseUsers();
        } catch(e) {
            console.error(e);
        }
    }

    // --- Curriculum Builder ---

    async renderCurriculum() {
        const container = document.getElementById('curriculum-builder-container');
        if (!container || !this.activeCourseId) return;

        try {
            const sections = await jhomeRepository.getCurriculumSections(this.activeCourseId);
            if (sections.length === 0) {
                container.innerHTML = '<div class="empty-state">لا يوجد محتوى في المنهج حالياً. ابدأ بإضافة قسم.</div>';
                return;
            }

            let html = '';
            for (const section of sections) {
                const lessons = await jhomeRepository.getCurriculumLessons(section.id);
                html += `
                    <div class="card" style="margin-bottom: 15px; border-right: 4px solid var(--primary);">
                        <div class="card-header" style="display:flex; justify-content:space-between; background:#f9f9f9;">
                            <h4 style="margin:0;">${section.title}</h4>
                            <div>
                                <button class="btn btn-sm btn-ghost" onclick="JhomeApp.openAddLessonModal('${section.id}')">+ إضافة درس</button>
                                <button class="btn btn-sm btn-ghost" onclick="JhomeApp.editCurriculumSection('${section.id}', '${section.title.replace(/'/g, "\\'")}')"><span class="material-icons-outlined">edit</span></button>
                                <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteCurriculumSection('${section.id}')"><span class="material-icons-outlined">delete</span></button>
                            </div>
                        </div>
                        <div class="card-body" style="padding: 10px;">
                            ${lessons.length === 0 ? '<p class="text-muted text-sm">لا توجد دروس في هذا القسم.</p>' : `
                            <ul style="list-style:none; padding:0; margin:0;">
                                ${lessons.map(l => `
                                <li style="display:flex; justify-content:space-between; padding: 10px; border-bottom: 1px solid var(--border); align-items:center;">
                                    <div>
                                        <span class="badge bg-secondary" style="margin-left:8px;">${this.translateLessonType(l.type)}</span>
                                        ${l.title} 
                                        ${l.isPreview ? '<span class="badge bg-success" style="margin-right:8px;">مجاني</span>' : ''}
                                    </div>
                                    <div>
                                        <button class="btn btn-sm btn-ghost" onclick="JhomeApp.deleteCurriculumLesson('${l.id}')"><span class="material-icons-outlined">delete</span></button>
                                    </div>
                                </li>`).join('')}
                            </ul>`}
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;
        } catch(e) {
            console.error(e);
            container.innerHTML = '<div class="empty-state text-danger">حدث خطأ أثناء تحميل المنهج.</div>';
        }
    }

    translateLessonType(type) {
        const types = {
            'video': 'فيديو', 'pdf': 'PDF', 'article': 'مقال',
            'audio': 'صوت', 'zip': 'ملف مضغوط', 'attachment': 'مرفق',
            'link': 'رابط خارجي', 'quiz': 'اختبار', 'assignment': 'واجب'
        };
        return types[type] || type;
    }

    openAddSectionModal() {
        document.getElementById('jhome-section-form').reset();
        document.getElementById('js-section-id').value = '';
        if (window.AdminApp) window.AdminApp.openModal('jhome-section-modal');
    }

    editCurriculumSection(id, title) {
        document.getElementById('js-section-id').value = id;
        document.getElementById('js-section-title').value = title;
        if (window.AdminApp) window.AdminApp.openModal('jhome-section-modal');
    }

    async saveCurriculumSection(e) {
        e.preventDefault();
        const title = document.getElementById('js-section-title').value;
        const id = document.getElementById('js-section-id').value;

        try {
            if (id) {
                await jhomeRepository.db.collection('curriculum_sections').doc(id).update({ title });
            } else {
                await jhomeRepository.addCurriculumSection(this.activeCourseId, title);
            }
            if (typeof window.showToast === 'function') window.showToast('تم حفظ القسم بنجاح', 'success');
            if (window.AdminApp) window.AdminApp.closeModal('jhome-section-modal');
            await this.renderCurriculum();
        } catch(err) {
            console.error(err);
            if (typeof window.showToast === 'function') window.showToast('خطأ أثناء حفظ القسم', 'error');
        }
    }

    async deleteCurriculumSection(id) {
        if (!confirm('هل أنت متأكد من حذف هذا القسم؟ سيتم حذف جميع الدروس بداخله.')) return;
        try {
            await jhomeRepository.deleteCurriculumSection(id);
            if (typeof window.showToast === 'function') window.showToast('تم حذف القسم', 'success');
            await this.renderCurriculum();
        } catch(e) {
            console.error(e);
        }
    }

    openAddLessonModal(sectionId) {
        document.getElementById('jhome-lesson-form').reset();
        document.getElementById('jl-lesson-id').value = '';
        document.getElementById('jl-section-id').value = sectionId;
        this.toggleLessonTypeFields();
        if (window.AdminApp) window.AdminApp.openModal('jhome-lesson-modal');
    }

    toggleLessonTypeFields() {
        const type = document.getElementById('jl-type').value;
        const sourceType = document.querySelector('input[name="jl_source_type"]:checked').value;

        const sourceContainer = document.getElementById('jl-source-type-container');
        const uploadContainer = document.getElementById('jl-upload-container');
        const linkContainer = document.getElementById('jl-link-container');
        const articleContainer = document.getElementById('jl-article-container');

        // Reset display
        sourceContainer.style.display = 'none';
        uploadContainer.style.display = 'none';
        linkContainer.style.display = 'none';
        articleContainer.style.display = 'none';

        if (['video', 'audio', 'pdf', 'zip', 'attachment'].includes(type)) {
            sourceContainer.style.display = 'block';
            if (sourceType === 'upload') {
                uploadContainer.style.display = 'block';
            } else {
                linkContainer.style.display = 'block';
            }
        } else if (type === 'article') {
            articleContainer.style.display = 'block';
        } else if (type === 'link') {
            linkContainer.style.display = 'block';
        }
        // Quiz & Assignment forms can be expanded later
    }

    async saveCurriculumLesson(e) {
        e.preventDefault();
        const sectionId = document.getElementById('jl-section-id').value;
        const title = document.getElementById('jl-title').value;
        const type = document.getElementById('jl-type').value;
        const isPreview = document.getElementById('jl-is-preview').checked;
        const sourceType = document.querySelector('input[name="jl_source_type"]:checked')?.value || 'link';

        const btn = document.getElementById('jl-submit-btn');
        btn.disabled = true;
        btn.textContent = 'جاري الحفظ...';

        try {
            let contentUrl = '';
            let contentText = '';

            if (['video', 'audio', 'pdf', 'zip', 'attachment'].includes(type)) {
                if (sourceType === 'upload') {
                    const fileInput = document.getElementById('jl-file');
                    if (fileInput.files.length > 0) {
                        const file = fileInput.files[0];
                        // Upload with progress
                        if (window.AdminHelpers && window.AdminHelpers.uploadWithProgress) {
                            contentUrl = await window.AdminHelpers.uploadWithProgress(file, \`courses/\${this.activeCourseId}/lessons\`, (progress) => {
                                document.getElementById('jl-upload-progress').style.display = 'block';
                                document.getElementById('jl-progress-bar').style.width = progress + '%';
                            });
                        } else {
                            // Fallback
                            contentUrl = await window.AdminHelpers.uploadToJhomeStorage(file, \`courses/\${this.activeCourseId}/lessons\`);
                        }
                    }
                } else {
                    contentUrl = document.getElementById('jl-external-link').value;
                }
            } else if (type === 'link') {
                contentUrl = document.getElementById('jl-external-link').value;
            } else if (type === 'article') {
                contentText = document.getElementById('jl-article-content').value;
            }

            await jhomeRepository.addCurriculumLesson(sectionId, this.activeCourseId, {
                title,
                type,
                contentUrl,
                contentText,
                sourceType,
                isPreview
            });

            if (typeof window.showToast === 'function') window.showToast('تمت إضافة الدرس بنجاح', 'success');
            if (window.AdminApp) window.AdminApp.closeModal('jhome-lesson-modal');
            await this.renderCurriculum();
        } catch(err) {
            console.error(err);
            if (typeof window.showToast === 'function') window.showToast('خطأ أثناء الحفظ', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'حفظ الدرس';
            document.getElementById('jl-upload-progress').style.display = 'none';
        }
    }

    async deleteCurriculumLesson(id) {
        if (!confirm('هل أنت متأكد من حذف هذا الدرس؟')) return;
        try {
            await jhomeRepository.db.collection('curriculum_lessons').doc(id).delete();
            if (typeof window.showToast === 'function') window.showToast('تم الحذف بنجاح', 'success');
            await this.renderCurriculum();
        } catch(e) {
            console.error(e);
        }
    }

    openCourseSettingsModal() {
        if (!this.activeCourseId) return;
        // Fetch current setting
        jhomeRepository.db.collection('courses').doc(this.activeCourseId).get().then(doc => {
            if(doc.exists) {
                const unlockSystem = doc.data().unlockSystem || 'section_based';
                document.getElementById('jcs-unlock-system').value = unlockSystem;
                if (window.AdminApp) window.AdminApp.openModal('jhome-course-settings-modal');
            }
        });
    }

    async saveCourseSettings(e) {
        e.preventDefault();
        const unlockSystem = document.getElementById('jcs-unlock-system').value;
        try {
            await jhomeRepository.db.collection('courses').doc(this.activeCourseId).update({ unlockSystem });
            if (typeof window.showToast === 'function') window.showToast('تم حفظ الإعدادات', 'success');
            if (window.AdminApp) window.AdminApp.closeModal('jhome-course-settings-modal');
        } catch(e) {
            console.error(e);
        }
    }
}

export const academyView = new AcademyView();
