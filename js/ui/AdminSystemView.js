import { adminDataRepository } from '../repositories/AdminDataRepository.js';

export class AdminSystemView {
    constructor() {
        this.usersTbody = document.getElementById('jhome-users-tbody');
        this.bankTbody = document.getElementById('jhome-bank-accounts-tbody');
        this.messagesList = document.getElementById('jhome-messages-list');
        this.newsletterTbody = document.getElementById('jhome-newsletter-tbody');
    }

    async load() {
        await this.loadUsers();
        await this.loadBankAccounts();
        await this.loadMessages();
        await this.loadNewsletter();
        await this.loadEnrollmentRequests();
    }

    // ── Messages ──
    async loadMessages() {
        if (!this.messagesList) return;
        try {
            const messages = await adminDataRepository.getMessages();
            if (messages.length === 0) {
                this.messagesList.innerHTML = '<p class="empty-state">لا توجد رسائل تواصل جديدة</p>';
                return;
            }

            const fragment = document.createDocumentFragment();
            messages.forEach(m => {
                const isNew = m.status === 'new' || !m.status;
                const div = document.createElement('div');
                div.className = 'verify-card';
                div.style.cssText = `padding:15px; margin-bottom:15px; border-left: 4px solid ${isNew ? 'var(--primary)' : 'var(--border)'}`;
                
                const date = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString('ar-EG') : '';
                
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                      <h4 style="margin:0;">${m.subject || 'بدون عنوان'} ${isNew ? '<span class="report-status pending">جديد</span>' : ''}</h4>
                      <small style="color:var(--text-muted)">${date}</small>
                    </div>
                    <p style="margin:8px 0; font-size:13px;"><strong>من:</strong> ${m.name} &lt;${m.email}&gt; | 📞 ${m.phone || 'غير محدد'}</p>
                    <p style="background:var(--bg-body); padding:10px; border-radius:8px;">${m.message}</p>
                    <div style="margin-top:10px; display:flex; gap:10px;">
                      ${isNew ? `<button class="btn btn-sm btn-success" onclick="JhomeApp.markMessageRead('${m.id}')">تعليم كمقروء</button>` : ''}
                      <a href="mailto:${m.email}?subject=رد بخصوص رسالتك لمؤسسة Jhome" class="btn btn-sm btn-primary">الرد عبر الإيميل</a>
                    </div>
                `;
                fragment.appendChild(div);
            });
            this.messagesList.innerHTML = '';
            this.messagesList.appendChild(fragment);
        } catch (e) {
            console.error('Error loading messages:', e);
        }
    }

    async markMessageRead(id) {
        try {
            await adminDataRepository.markMessageRead(id);
            await this.loadMessages();
        } catch(e) {}
    }

    // ── Newsletter ──
    async loadNewsletter() {
        if (!this.newsletterTbody) return;
        try {
            const subs = await adminDataRepository.getNewsletterSubscribers();
            if (subs.length === 0) {
                this.newsletterTbody.innerHTML = '<tr><td colspan="3" class="empty-state">لا يوجد مشتركون بعد</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            subs.forEach(n => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                  <td><strong>${n.email}</strong></td>
                  <td>${n.name || '—'}</td>
                  <td><span class="report-status ${(n.isActive !== false) ? 'reviewed' : 'dismissed'}">${(n.isActive !== false) ? 'نشط' : 'ملغى'}</span></td>
                `;
                fragment.appendChild(tr);
            });
            this.newsletterTbody.innerHTML = '';
            this.newsletterTbody.appendChild(fragment);
        } catch(e) {
            console.error(e);
        }
    }

    // ── Users ──
    async loadUsers() {
        if (!this.usersTbody) return;
        try {
            const users = await adminDataRepository.getUsers();
            if (users.length === 0) {
                this.usersTbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا يوجد طلاب</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            users.forEach(u => {
                const tr = document.createElement('tr');
                const date = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('ar-EG') : '';
                tr.innerHTML = `
                    <td><strong>${u.name}</strong></td>
                    <td dir="ltr">${u.email}</td>
                    <td><span class="report-status reviewed">${u.role || 'student'}</span></td>
                    <td>${date}</td>
                    <td>
                      <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteUser('${u.id}')">حذف</button>
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

    showUserModal() {
        document.getElementById('juser-name').value = '';
        document.getElementById('juser-email').value = '';
        document.getElementById('juser-password').value = '';
        document.getElementById('jhome-user-modal').style.display = 'flex';
    }

    async saveUser() {
        const name = document.getElementById('juser-name').value.trim();
        const email = document.getElementById('juser-email').value.trim();
        const password = document.getElementById('juser-password').value;

        if(!name || !email || !password) {
            if (typeof window.showToast === 'function') window.showToast('الرجاء إدخال كافة البيانات', 'error');
            return;
        }

        try {
            const createUserFn = window.firebase.app("jhome").functions().httpsCallable('api_v1_users');
            const res = await createUserFn({ 
                apiVersion: 'v1', 
                action: 'create', 
                payload: { email, password, displayName: name, role: 'STUDENT' } 
            });
            
            if(res.data && res.data.uid) {
                await adminDataRepository.saveUser({ name, email, role: 'student' });
                // Also save to credentials
                const courseIdToAssign = window._currentPendingCourseId || 'all';
                await window.firebase.app('jhome').firestore().collection('courses_credentials').doc(res.data.uid).set({
                    username: email, password, role: 'student', realName: name, courseId: courseIdToAssign
                });

                if (window._currentPendingRequestId) {
                    await window.firebase.app('jhome').firestore().collection('enrollmentRequests').doc(window._currentPendingRequestId).update({ status: 'approved' });
                    window._currentPendingRequestId = null;
                    window._currentPendingCourseId = null;
                }

                if (typeof window.showToast === 'function') window.showToast('تم إنشاء حساب الطالب بنجاح', 'success');
                if (window.AdminApp) window.AdminApp.closeModal('jhome-user-modal');
                await this.loadUsers();
                await this.loadEnrollmentRequests();
            } else {
                if (typeof window.showToast === 'function') window.showToast('فشل إنشاء الحساب', 'error');
            }
        } catch(e) {
            console.error(e);
            if (typeof window.showToast === 'function') window.showToast('حدث خطأ أثناء الإنشاء', 'error');
        }
    }

    async deleteUser(id) {
        if(!confirm('هل أنت متأكد من حذف هذا الطالب بالكامل؟')) return;
        try {
            const deleteUserFn = window.firebase.app("jhome").functions().httpsCallable('api_v1_users');
            await deleteUserFn({ 
                apiVersion: 'v1', 
                action: 'delete', 
                payload: { uid: id } 
            });
            await adminDataRepository.deleteUser(id);
            await window.firebase.app('jhome').firestore().collection('courses_credentials').doc(id).delete();
            await this.loadUsers();
            if (typeof window.showToast === 'function') window.showToast('تم الحذف', 'success');
        } catch(e) {
            console.error(e);
        }
    }

    // ── Bank Accounts ──
    async loadBankAccounts() {
        if (!this.bankTbody) return;
        try {
            const accounts = await adminDataRepository.getBankAccounts();
            if (accounts.length === 0) {
                this.bankTbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد حسابات مضافة</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            accounts.forEach(b => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${b.bankName}</strong></td>
                    <td>${b.accountName}</td>
                    <td dir="ltr">${b.accountNumber}</td>
                    <td>${b.branch || '-'}</td>
                    <td><span class="text-muted">${b.notes || ''}</span></td>
                    <td>
                      <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteBankAccount('${b.id}')">حذف</button>
                    </td>
                `;
                fragment.appendChild(tr);
            });
            this.bankTbody.innerHTML = '';
            this.bankTbody.appendChild(fragment);
        } catch(e) {
            console.error(e);
        }
    }

    showBankAccountModal() {
        document.getElementById('jbank-name').value = '';
        document.getElementById('jbank-account-name').value = '';
        document.getElementById('jbank-account-number').value = '';
        document.getElementById('jbank-branch').value = '';
        document.getElementById('jbank-notes').value = '';
        document.getElementById('jhome-bank-modal').style.display = 'flex';
    }

    async saveBankAccount() {
        const bankName = document.getElementById('jbank-name').value.trim();
        const accountName = document.getElementById('jbank-account-name').value.trim();
        const accountNumber = document.getElementById('jbank-account-number').value.trim();
        const branch = document.getElementById('jbank-branch').value.trim();
        const notes = document.getElementById('jbank-notes').value.trim();

        if(!bankName || !accountName || !accountNumber) {
            if (typeof window.showToast === 'function') window.showToast('يرجى إدخال البيانات الأساسية للحساب', 'error');
            return;
        }

        try {
            await adminDataRepository.saveBankAccount({ bankName, accountName, accountNumber, branch, notes });
            if (typeof window.showToast === 'function') window.showToast('تمت إضافة الحساب بنجاح', 'success');
            if (window.AdminApp) window.AdminApp.closeModal('jhome-bank-modal');
            await this.loadBankAccounts();
        } catch(e) {
            console.error(e);
        }
    }

    async deleteBankAccount(id) {
        if(!confirm('حذف هذا الحساب؟')) return;
        try {
            await adminDataRepository.deleteBankAccount(id);
            await this.loadBankAccounts();
            if (typeof window.showToast === 'function') window.showToast('تم الحذف');
        } catch(e) {}
    }

    // ── Enrollment Requests ──
    async loadEnrollmentRequests() {
        const tbody = document.getElementById('jhome-requests-tbody');
        if (!tbody) return;
        try {
            const snap = await window.firebase.app('jhome').firestore().collection('enrollmentRequests').orderBy('createdAt', 'desc').get();
            if (snap.empty) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد طلبات انضمام جديدة</td></tr>';
                return;
            }

            const fragment = document.createDocumentFragment();
            const escapeQuote = str => {
                if (!str) return '';
                return String(str).replace(/'/g, "&apos;").replace(/"/g, "&quot;").replace(/\\/g, "\\\\");
            };

            snap.docs.forEach(doc => {
                const r = doc.data();
                const dateStr = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ar-EG') : '';
                const isPending = r.status === 'pending';
                const isApproved = r.status === 'approved';
                
                const sName = escapeQuote(r.student?.name || r.name || 'غير متوفر');
                const sEmail = escapeQuote(r.student?.email || r.email || '—');
                const sPhone = escapeQuote(r.student?.phone || r.phone || '—');
                const detailsJson = encodeURIComponent(JSON.stringify(r)).replace(/'/g, "%27");

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${sName}</strong></td>
                    <td dir="ltr">${sEmail}</td>
                    <td dir="ltr">${sPhone}</td>
                    <td><span class="report-status" style="background:var(--primary); color:#fff">${r.courseTitle || r.courseName || r.courseId || 'عام'}</span></td>
                    <td>${dateStr}</td>
                    <td><span class="report-status ${isPending ? 'pending' : (isApproved ? 'reviewed' : 'dismissed')}">${isApproved ? 'مقبول' : (r.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار')}</span></td>
                    <td>
                      <button class="btn btn-sm btn-ghost" onclick="JhomeApp.showRequestDetails('${doc.id}', '${detailsJson}')" style="margin-bottom:5px;display:inline-block;">التفاصيل</button>
                      ${isPending ? `
                        <button class="btn btn-sm btn-success" onclick="JhomeApp.approveRequest('${doc.id}', '${sName}', '${sEmail}', '${r.courseId || 'all'}', '${sPhone}')" style="margin-bottom:5px;display:inline-block;">قبول وتوليد حساب</button>
                        <button class="btn btn-sm btn-danger" onclick="JhomeApp.rejectRequest('${doc.id}')" style="margin-bottom:5px;display:inline-block;">رفض</button>
                      ` : ''}
                      <button class="btn btn-sm btn-ghost" onclick="JhomeApp.deleteRequest('${doc.id}')" style="margin-bottom:5px;display:inline-block;">حذف</button>
                    </td>
                `;
                fragment.appendChild(tr);
            });
            tbody.innerHTML = '';
            tbody.appendChild(fragment);
        } catch (e) {
            console.error(e);
        }
    }

    approveRequest(id, name, email, courseId, phone) {
        this.showUserModal();
        const nInput = document.getElementById('juser-name');
        const eInput = document.getElementById('juser-email');
        const pInput = document.getElementById('juser-password');

        if (nInput) nInput.value = name !== 'undefined' ? name : '';
        
        let finalEmail = (email !== 'undefined' && email !== '—' && email) ? email : '';
        if (!finalEmail) {
            const safePhone = (phone && phone !== '—' && phone !== 'undefined') ? phone.replace(/\\D/g, '') : Math.floor(Math.random() * 1000000);
            finalEmail = `student${safePhone}@sudanfree.com`;
        }
        if (eInput) eInput.value = finalEmail;

        const randomPassword = Math.random().toString(36).slice(-8);
        if (pInput) pInput.value = randomPassword;

        window._currentPendingRequestId = id;
        window._currentPendingCourseId = courseId;
    }

    async rejectRequest(id) {
        if(!confirm('رفض هذا الطلب؟')) return;
        try {
            await window.firebase.app('jhome').firestore().collection('enrollmentRequests').doc(id).update({ status: 'rejected' });
            this.loadEnrollmentRequests();
        } catch(e){}
    }

    async deleteRequest(id) {
        if(!confirm('حذف هذا السجل نهائياً؟')) return;
        try {
            await window.firebase.app('jhome').firestore().collection('enrollmentRequests').doc(id).delete();
            this.loadEnrollmentRequests();
        } catch(e){}
    }
}

export const adminSystemView = new AdminSystemView();
