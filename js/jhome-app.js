import { projectsView } from './ui/ProjectsView.js?v=2';
import { storiesView } from './ui/StoriesView.js?v=2';
import { blogView } from './ui/BlogView.js?v=2';
import { academyView } from './ui/AcademyView.js?v=2';
import { adminSystemView } from './ui/AdminSystemView.js?v=2';

// Jhome App Management Logic
const JhomeApp = {
  currentTab: 'blog',

  showTab(tabId, clickedEl) {
    this.currentTab = tabId;

    // Update active button state — safely without relying on global 'event'
    document.querySelectorAll('.jhome-tab-btn').forEach(btn => btn.classList.remove('active'));
    if (clickedEl) {
      clickedEl.classList.add('active');
    } else {
      const activeBtn = document.querySelector(`.jhome-tab-btn[onclick*="'${tabId}'"]`);
      if (activeBtn) activeBtn.classList.add('active');
    }

    // Hide all tabs then show the selected one
    document.querySelectorAll('.jhome-tab').forEach(tab => tab.style.display = 'none');
    const tabEl = document.getElementById(`jhome-tab-${tabId}`);
    if (tabEl) tabEl.style.display = 'block';
    else { console.warn('Tab not found: jhome-tab-' + tabId); return; }

    // Load data based on tab
    if (tabId === 'blog')           this.loadPosts();
    if (tabId === 'stories')        this.loadStories();
    if (tabId === 'messages')       this.loadMessages();
    if (tabId === 'newsletter')     this.loadNewsletter();
    if (tabId === 'academy-courses') this.renderCourses();
    if (tabId === 'pages')          this.loadPageContent('home');
    if (tabId === 'projects')       this.loadProjects();
    if (tabId === 'students')       this.loadUsers();
    if (tabId === 'requests')       this.loadEnrollmentRequests();
    if (tabId === 'bank-accounts')  this.loadBankAccounts();
  },

  // ── Page Content Management ──
  pageSchemas: {
    'home': {
      title: 'الرئيسية',
      fields: [
        { key: 'heroTitle', label: 'العنوان الرئيسي (مؤسسة Jhome)', type: 'text' },
        { key: 'heroSubtitle', label: 'الوصف تحت العنوان', type: 'text' },
        { key: 'servicesTitle', label: 'عنوان قسم الخدمات', type: 'text' },
        { key: 'sudanFreeTitle', label: 'عنوان بطاقة سودان فري', type: 'text' },
        { key: 'sudanFreeDesc', label: 'وصف تطبيق سودان فري', type: 'textarea' }
      ]
    },
    'about': {
      title: 'من نحن',
      fields: [
        { key: 'aboutHeroTitle', label: 'عنوان غلاف الصفحة', type: 'text' },
        { key: 'aboutStory', label: 'قصتنا', type: 'textarea' },
        { key: 'value1_title', label: 'عنوان القيمة الأولى', type: 'text' },
        { key: 'value1_desc', label: 'وصف القيمة الأولى', type: 'textarea' },
        { key: 'value2_title', label: 'عنوان القيمة الثانية', type: 'text' },
        { key: 'value2_desc', label: 'وصف القيمة الثانية', type: 'textarea' },
        { key: 'value3_title', label: 'عنوان القيمة الثالثة', type: 'text' },
        { key: 'value3_desc', label: 'وصف القيمة الثالثة', type: 'textarea' }
      ]
    },
    'projects': {
      title: 'مشاريعنا',
      fields: [
        { key: 'projectsTitle', label: 'عنوان الصفحة (مشاريعنا)', type: 'text' },
        { key: 'projectsSubtitle', label: 'وصف الصفحة', type: 'text' },
        { key: 'app1_title', label: 'اسم التطبيق الأول', type: 'text' },
        { key: 'app1_desc', label: 'وصف التطبيق الأول', type: 'textarea' },
        { key: 'tool1_title', label: 'اسم الأداة الأولى', type: 'text' },
        { key: 'tool1_desc', label: 'وصف الأداة الأولى', type: 'textarea' }
      ]
    },
    'sudan-free': {
      title: 'سودان فري',
      fields: [
        { key: 'sfHeroTitle', label: 'العنوان الرئيسي', type: 'text' },
        { key: 'sfHeroDesc', label: 'الوصف الرئيسي', type: 'textarea' },
        { key: 'sfCustomerDesc', label: 'قسم "أنا زبون"', type: 'textarea' },
        { key: 'sfWorkerDesc', label: 'قسم "أنا حرفي"', type: 'textarea' },
        { key: 'sfStoreDesc', label: 'قسم "أنا صاحب متجر"', type: 'textarea' },
        { key: 'appDownloadLink', label: 'رابط تحميل التطبيق', type: 'text', dir: 'ltr' }
      ]
    },
    'contact': {
      title: 'تواصل معنا',
      fields: [
        { key: 'contactTitle', label: 'العنوان', type: 'text' },
        { key: 'contactEmail', label: 'البريد الإلكتروني', type: 'text', dir: 'ltr' },
        { key: 'contactPhone', label: 'رقم الهاتف', type: 'text', dir: 'ltr' },
        { key: 'contactAddress', label: 'العنوان (المقر)', type: 'text' }
      ]
    }
  },

  currentPageKey: null,

  async loadPageContent(pageKey) {
    this.currentPageKey = pageKey;
    const schema = this.pageSchemas[pageKey];
    if (!schema) return;

    document.getElementById('jhome-page-editor-title').textContent = `تعديل صفحة: ${schema.title}`;
    const body = document.getElementById('jhome-page-editor-body');
    body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    document.getElementById('jhome-page-editor-actions').style.display = 'none';

    try {
      const docSnap = await jhomeDb.collection('pageContent').doc(pageKey).get();
      let sectionsData = {};
      if (docSnap.exists) {
        sectionsData = docSnap.data().sections || {};
      }

      const html = schema.fields.map(f => {
        const val = sectionsData[f.key] || '';
        const dir = f.dir ? `dir="${f.dir}"` : '';
        if (f.type === 'textarea') {
          return `
            <div style="margin-bottom:15px;">
              <label style="display:block; margin-bottom:5px; font-weight:bold; font-size:14px;">${f.label}</label>
              <textarea id="page-field-${f.key}" class="text-input" style="width:100%; min-height:80px; resize:vertical;" ${dir}>${val}</textarea>
            </div>
          `;
        } else {
          return `
            <div style="margin-bottom:15px;">
              <label style="display:block; margin-bottom:5px; font-weight:bold; font-size:14px;">${f.label}</label>
              <input type="text" id="page-field-${f.key}" class="text-input" style="width:100%;" value="${val}" ${dir}>
            </div>
          `;
        }
      }).join('');

      body.innerHTML = html;
      document.getElementById('jhome-page-editor-actions').style.display = 'block';

    } catch(e) {
      console.error('Error loading page content:', e);
      body.innerHTML = '<p class="empty-state" style="color:var(--danger)">فشل جلب بيانات الصفحة.</p>';
    }
  },

  async savePageContent() {
    if (!this.currentPageKey) return;
    const schema = this.pageSchemas[this.currentPageKey];
    if (!schema) return;

    const sections = {};
    schema.fields.forEach(f => {
      const el = document.getElementById(`page-field-${f.key}`);
      if (el) {
        sections[f.key] = el.value.trim();
      }
    });

    try {
      document.getElementById('jhome-page-editor-actions').style.opacity = '0.5';
      document.getElementById('jhome-page-editor-actions').style.pointerEvents = 'none';
      
      const updatePageFn = firebase.app("jhome").functions().httpsCallable('api_v1_cms_content');
      await updatePageFn({
        apiVersion: 'v1',
        action: 'save',
        entity: 'page',
        payload: {
          id: this.currentPageKey,
          ...sections
        }
      });

      showToast('تم حفظ التعديلات بنجاح!', 'success');
    } catch(e) {
      console.error('Error saving page content:', e);
      showToast('فشل حفظ التعديلات. تأكد من الصلاحيات.', 'error');
    } finally {
      document.getElementById('jhome-page-editor-actions').style.opacity = '1';
      document.getElementById('jhome-page-editor-actions').style.pointerEvents = 'auto';
    }
  },

  // ============================================
  // ── Jhome Academy (Courses) ──
  // ============================================
  async renderCourses() {
    await academyView.renderCourses();
  },

  async addCourse(e) {
    await academyView.addCourse(e);
  },

  showCourseModal() {
    document.getElementById('jhome-course-modal').style.display = 'flex';
  },

  async deleteCourse(id) {
    await academyView.deleteCourse(id);
  },

  openCourse(id) {
    academyView.openCourse(id);
  },

  async renderCourseRequests() {
    await academyView.renderRequests();
  },

  async approveCourseRequest(reqId, studentName) {
    await academyView.approveCourseRequest(reqId, studentName);
  },

  async rejectCourseRequest(reqId) {
    await academyView.rejectCourseRequest(reqId);
  },

  async renderCourseUsers() {
    await academyView.renderUsers();
  },

  async addCourseInstructor(e) {
    await academyView.addCourseInstructor(e);
  },

  async deleteCourseUser(userId) {
    await academyView.deleteCourseUser(userId);
  },

  // ── Blog / Posts ──
  async loadPosts() {
    const tbody = document.getElementById('jhome-posts-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">⏳ جاري التحميل...</td></tr>';
    try {
      // Use a simple get() without orderBy to avoid requiring a composite index
      const snap = await jhomeDb.collection('posts').get();

      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد مقالات منشورة حتى الآن</td></tr>';
        return;
      }

      // Sort client-side by publishedAt descending
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a, b) => {
        const aT = a.publishedAt?.toDate ? a.publishedAt.toDate().getTime() : (a.publishedAt ? new Date(a.publishedAt).getTime() : 0);
        const bT = b.publishedAt?.toDate ? b.publishedAt.toDate().getTime() : (b.publishedAt ? new Date(b.publishedAt).getTime() : 0);
        return bT - aT;
      });

      tbody.innerHTML = docs.map(p => {
        const date = p.publishedAt
          ? (p.publishedAt.toDate ? p.publishedAt.toDate().toLocaleDateString('ar-EG') : new Date(p.publishedAt).toLocaleDateString('ar-EG'))
          : '—';
        const cover = p.coverImage
          ? `<img src="${p.coverImage}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;">`
          : `<div style="width:50px;height:50px;border-radius:8px;background:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:bold;color:#fff;">J</div>`;
        return `
          <tr>
            <td>${cover}</td>
            <td><strong>${p.title || '—'}</strong><br><small style="color:var(--text-muted)">${p.authorName || 'إدارة Jhome'}</small></td>
            <td><span class="role-badge role-freelancer">${p.category || 'عام'}</span></td>
            <td><span class="report-status ${p.status === 'published' ? 'reviewed' : 'pending'}">${p.status === 'published' ? 'منشور' : 'مسودة'}</span></td>
            <td>${date}</td>
            <td><button class="btn btn-sm btn-danger" onclick="JhomeApp.deletePost('${p.id}')">حذف</button></td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error('Error loading posts:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:red;">⚠️ خطأ في التحميل: ${e.message}</td></tr>`;
    }
  },

  async deletePost(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المقال نهائياً؟')) return;
    try {
      await jhomeDb.collection('posts').doc(id).delete();
      showToast('تم الحذف بنجاح', 'success');
      this.loadPosts();
    } catch (e) {
      showToast('حدث خطأ أثناء الحذف', 'error');
    }
  },

  showPostModal() {
    document.getElementById('jpost-title').value = '';
    document.getElementById('jpost-slug').value = '';
    document.getElementById('jpost-excerpt').value = '';
    document.getElementById('jpost-content').value = '';
    document.getElementById('jpost-cover-url').value = '';
    document.getElementById('jpost-cover-file').value = '';
    document.getElementById('jpost-category').value = '';
    document.getElementById('jpost-featured').checked = false;
    document.getElementById('jhome-post-modal').style.display = 'flex';
  },

  async uploadJhomeImage(file, folder) {
    if (!file) return null;
    const ref = firebase.app('jhome').storage().ref(`${folder}/${Date.now()}_${file.name}`);
    const snapshot = await ref.put(file);
    return await snapshot.ref.getDownloadURL();
  },

  async savePost() {
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
      showToast('الرجاء إدخال العنوان، الرابط، والمحتوى الأساسي', 'error');
      return;
    }

    try {
      showToast('جاري حفظ المقال...', 'success');
      if (file) {
        coverImage = await this.uploadJhomeImage(file, 'posts');
      }

      await jhomeDb.collection('posts').add({
        title,
        slug,
        excerpt,
        content,
        coverImage,
        category,
        isFeatured,
        status: 'published',
        views: 0,
        publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('تم نشر المقال بنجاح!', 'success');
      AdminApp.closeModal('jhome-post-modal');
      this.loadPosts();
    } catch (e) {
      console.error('Error saving post:', e);
      showToast('خطأ أثناء حفظ المقال: ' + e.message, 'error');
    }
  },

  // ── Stories ──
  async loadStories() {
    try {
      // Load published stories
      const pubSnap = await jhomeDb.collection('successStories').where('isPublished', '==', true).get();
      const pubTbody = document.getElementById('jhome-stories-tbody');
      
      if (pubSnap.empty) {
        pubTbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد قصص نجاح</td></tr>';
      } else {
        pubTbody.innerHTML = pubSnap.docs.map(doc => {
          const s = doc.data();
          return `
            <tr>
              <td><img src="${s.coverImage || s.personAvatar || 'https://via.placeholder.com/150'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"></td>
              <td><strong>${s.personName || s.title}</strong></td>
              <td>${s.personRole || '—'}</td>
              <td>${s.keyAchievement || '—'}</td>
              <td>
                <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteStory('${doc.id}')">حذف</button>
              </td>
            </tr>
          `;
        }).join('');
      }

      // Load pending submissions
      const subSnap = await jhomeDb.collection('storySubmissions').where('status', '==', 'pending').get();
      const subList = document.getElementById('jhome-story-submissions-list');
      
      if (subSnap.empty) {
        subList.innerHTML = '<p class="empty-state">لا توجد تقديمات جديدة بانتظار المراجعة</p>';
      } else {
        subList.innerHTML = subSnap.docs.map(doc => {
          const sub = doc.data();
          return `
            <div class="verify-card" style="padding:15px; margin-bottom:15px;">
              <h4>${sub.title || 'قصة نجاح'}</h4>
              <p><strong>من:</strong> ${sub.submitterName} - ${sub.submitterEmail} (${sub.submitterPhone})</p>
              ${sub.profileLink ? `<p><strong>رابط الحرفي:</strong> <a href="${encodeURI(sub.profileLink)}" target="_blank" style="color:var(--primary);text-decoration:underline;">${sub.profileLink}</a></p>` : ''}
              <p style="margin-top:10px; background:var(--bg-body); padding:10px; border-radius:8px;">${sub.story}</p>
              <div style="margin-top:10px; display:flex; gap:10px;">
                <button class="btn btn-sm btn-success" onclick="JhomeApp.approveStorySubmission('${doc.id}')">اعتماد ونشر</button>
                <button class="btn btn-sm btn-danger" onclick="JhomeApp.rejectStorySubmission('${doc.id}')">رفض</button>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (e) {
      console.error('Error loading stories:', e);
      showToast('خطأ في جلب القصص: ' + e.message, 'error');
    }
  },

  async approveStorySubmission(id) {
    if (!confirm('سيتم نشر هذه القصة للعلن، هل أنت موافق؟')) return;
    try {
      // In a real app, you might want a modal to let admin edit before publishing.
      // For now, we update status to approved.
      await jhomeDb.collection('storySubmissions').doc(id).update({ status: 'approved' });
      showToast('تم الموافقة على القصة', 'success');
      this.loadStories();
    } catch(e) {
      showToast('خطأ', 'error');
    }
  },

  async rejectStorySubmission(id) {
    if (!confirm('هل تريد رفض وحذف هذا التقديم؟')) return;
    try {
      await jhomeDb.collection('storySubmissions').doc(id).update({ status: 'rejected' });
      showToast('تم الرفض', 'success');
      this.loadStories();
    } catch(e) {
      showToast('خطأ', 'error');
    }
  },

  async deleteStory(id) {
    if (!confirm('هل أنت متأكد من حذف القصة؟')) return;
    await jhomeDb.collection('successStories').doc(id).delete();
    this.loadStories();
  },

  showStoryModal() {
    document.getElementById('jstory-person').value = '';
    document.getElementById('jstory-role').value = '';
    document.getElementById('jstory-achievement').value = '';
    document.getElementById('jstory-content').value = '';
    document.getElementById('jstory-freelancer-link').value = '';
    document.getElementById('jstory-linkedin-link').value = '';
    document.getElementById('jstory-twitter-link').value = '';
    document.getElementById('jstory-github-link').value = '';
    document.getElementById('jstory-cover-url').value = '';
    document.getElementById('jstory-cover-file').value = '';
    document.getElementById('jhome-story-modal').style.display = 'flex';
  },

  async saveStory() {
    const title = document.getElementById('jstory-person').value.trim(); // used as personName/title
    const personRole = document.getElementById('jstory-role').value.trim();
    const keyAchievement = document.getElementById('jstory-achievement').value.trim();
    const story = document.getElementById('jstory-content').value.trim();
    const freelancerLink = document.getElementById('jstory-freelancer-link').value.trim();
    const linkedinLink = document.getElementById('jstory-linkedin-link').value.trim();
    const twitterLink = document.getElementById('jstory-twitter-link').value.trim();
    const githubLink = document.getElementById('jstory-github-link').value.trim();
    let coverImage = document.getElementById('jstory-cover-url').value.trim();
    
    const fileInput = document.getElementById('jstory-cover-file');
    const file = fileInput.files[0];

    if (!title || !story) {
      showToast('الرجاء إدخال اسم الشخص وتفاصيل القصة', 'error');
      return;
    }

    try {
      showToast('جاري الحفظ والرفع...', 'success');
      if (file) {
        coverImage = await this.uploadJhomeImage(file, 'successStories');
      }

      await jhomeDb.collection('successStories').add({
        title,
        personName: title,
        personRole,
        keyAchievement,
        story,
        coverImage,
        personAvatar: coverImage,
        freelancerLink,
        socialLinks: {
            linkedin: linkedinLink,
            twitter: twitterLink,
            github: githubLink
        },
        isPublished: true,
        category: 'general',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('تم نشر قصة النجاح بنجاح!', 'success');
      AdminApp.closeModal('jhome-story-modal');
      this.loadStories();
    } catch (e) {
      console.error('Error saving story:', e);
      showToast('خطأ أثناء حفظ القصة: ' + e.message, 'error');
    }
  },

  // ── Messages ──
  async loadMessages() { await adminSystemView.loadMessages(); },
  async markMessageRead(id) { await adminSystemView.markMessageRead(id); },

  // ── Newsletter ──
  async loadNewsletter() { await adminSystemView.loadNewsletter(); },

  // ── Academy Students (Users) ──
  async loadUsers() { await adminSystemView.loadUsers(); },
  showUserModal() { adminSystemView.showUserModal(); },
  async saveUser() { await adminSystemView.saveUser(); },
  async deleteUser(id) { await adminSystemView.deleteUser(id); },

  // ── Enrollment Requests ──
  async loadEnrollmentRequests() { await adminSystemView.loadEnrollmentRequests(); },
  showRequestDetails(id, detailsJson) {
    try {
      const data = JSON.parse(decodeURIComponent(detailsJson));
      const sName = (data.student && data.student.name) ? data.student.name : (data.name || '—');
      const sEmail = (data.student && data.student.email) ? data.student.email : (data.email || '—');
      const sPhone = (data.student && data.student.phone) ? data.student.phone : (data.phone || '—');
      const sCity = (data.student && data.student.city) ? data.student.city : '—';
      const sEdu = (data.student && data.student.education) ? data.student.education : '—';
      const sReason = (data.student && data.student.reason) ? data.student.reason : '—';
      const cTitle = data.courseTitle || data.courseName || data.courseId || 'عام';
      const receipt = (data.payment && data.payment.receiptUrl) ? data.payment.receiptUrl : data.receiptUrl;

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; text-align: right;">
          <div class="modal-header">
            <h3>تفاصيل طلب الانضمام</h3>
            <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
          </div>
          <div class="modal-body" style="line-height: 1.8;">
            <p><strong>اسم الطالب:</strong> ${sName}</p>
            <p><strong>رقم الهاتف:</strong> <span dir="ltr">${sPhone}</span></p>
            <p><strong>البريد الإلكتروني:</strong> <span dir="ltr">${sEmail}</span></p>
            <p><strong>المدينة:</strong> ${sCity}</p>
            <p><strong>المستوى التعليمي:</strong> ${sEdu}</p>
            <p><strong>سبب الانضمام:</strong> ${sReason}</p>
            <hr>
            <p><strong>الدورة المطلوبة:</strong> ${cTitle}</p>
            <p><strong>طبيعة الدورة:</strong> ${data.type === 'paid' ? 'مدفوعة' : 'مجانية'}</p>
            ${receipt ? `<p><strong>إيصال الدفع:</strong> <br><a href="${receipt}" target="_blank"><img src="${receipt}" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 10px;" alt="الإيصال"/></a></p>` : ''}
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } catch(e) {
      console.error(e);
      alert('خطأ في عرض التفاصيل');
    }
  },
  approveRequest(id, name, email) { adminSystemView.approveRequest(id, name, email); },
  async rejectRequest(id) { await adminSystemView.rejectRequest(id); },
  async deleteRequest(id) { await adminSystemView.deleteRequest(id); },

  // ── Bank Accounts ──
  async loadBankAccounts() { await adminSystemView.loadBankAccounts(); },
  showBankAccountModal() { adminSystemView.showBankAccountModal(); },
  async saveBankAccount() { await adminSystemView.saveBankAccount(); },
  async deleteBankAccount(id) { await adminSystemView.deleteBankAccount(id); }

};

// ── Hook into AdminApp navigation — safe version ──
// jhome-app.js is a module (loads async). We must wait for AdminApp to be ready.
function hookJhomeNavigation() {
  if (!window.AdminApp || typeof window.AdminApp.navigateTo !== 'function') {
    // AdminApp not ready yet — retry after a short delay
    setTimeout(hookJhomeNavigation, 100);
    return;
  }

  // Only patch once
  if (window.AdminApp._jhomePatched) return;
  window.AdminApp._jhomePatched = true;

  const _orig = window.AdminApp.navigateTo.bind(window.AdminApp);
  window.AdminApp.navigateTo = function(page) {
    _orig(page);
    if (page === 'jhome') {
      // Load the default or current tab when entering Jhome section
      setTimeout(() => JhomeApp.showTab(JhomeApp.currentTab), 50);
    }
  };
}

document.addEventListener('DOMContentLoaded', hookJhomeNavigation);

window.JhomeApp = JhomeApp;
