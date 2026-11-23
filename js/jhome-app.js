import { projectsView } from './ui/ProjectsView.js?v=5';
import { storiesView } from './ui/StoriesView.js?v=5';
import { blogView } from './ui/BlogView.js?v=5';
import { academyView } from './ui/AcademyView.js?v=12';
import { adminSystemView } from './ui/AdminSystemView.js?v=5';

// Jhome App Management Logic
const JhomeApp = {
  currentTab: 'blog',

  // Lazy db access — only called when a method runs, never at module load time
  get db() { return window.firebase.app('jhome').firestore(); },

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
    let tabEl = document.getElementById(`jhome-tab-${tabId}`);
    if (!tabEl && (tabId === 'media' || tabId === 'analytics')) {
      tabEl = this.createDynamicTab(tabId);
    }
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
    if (tabId === 'media')          this.loadMediaLibrary();
    if (tabId === 'analytics')      this.loadAnalytics();
  },

  async loadProjects() { await projectsView.load(); },

  // ── Page Content Management ──
  // NOTE: every field below is wired to a real `[data-dynamic="key"]` element
  // on the live site (verified in HOME-WEB). Fields that had no matching
  // element (heroTitle, servicesTitle, contactTitle/Phone/Address, the
  // sfCustomerDesc/sfWorkerDesc/sfStoreDesc trio, and the whole 'projects'
  // page) were removed rather than left silently no-op — re-add them only
  // once the corresponding HTML section exists.
  pageSchemas: {
    'home': {
      title: 'الرئيسية',
      fields: [
        { key: 'heroSubtitle', label: 'الوصف تحت العنوان الرئيسي', type: 'textarea' },
        { key: 'sudanFreeTitle', label: 'عنوان بطاقة سودان فري', type: 'text' },
        { key: 'sudanFreeDesc', label: 'وصف تطبيق سودان فري', type: 'textarea' }
      ]
    },
    'about': {
      title: 'من نحن',
      fields: [
        { key: 'vision', label: 'الرؤية', type: 'textarea' },
        { key: 'mission', label: 'الرسالة', type: 'textarea' },
        { key: 'values', label: 'القيم الجوهرية', type: 'textarea' },
        { key: 'founderName', label: 'اسم المؤسس', type: 'text' },
        { key: 'founderBio1', label: 'نبذة المؤسس (فقرة 1)', type: 'textarea' },
        { key: 'founderBio2', label: 'نبذة المؤسس (فقرة 2)', type: 'textarea' }
      ]
    },
    'sudan-free': {
      title: 'سودان فري',
      fields: [
        { key: 'sfHeroTitle', label: 'العنوان الرئيسي', type: 'text' },
        { key: 'sfHeroDesc', label: 'الوصف الرئيسي', type: 'textarea' },
        { key: 'appDownloadLink', label: 'رابط تحميل التطبيق', type: 'text', dir: 'ltr' }
      ]
    },
    'contact': {
      title: 'تواصل معنا',
      fields: [
        { key: 'contactEmail', label: 'البريد الإلكتروني', type: 'text', dir: 'ltr' }
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
      const docSnap = await this.db.collection('pageContent').doc(pageKey).get();
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
      
      // NOTE: api_v1_cms_content destructures `payload` as `{ id, data }` and
      // merges `data` directly onto the pageContent/{pageKey} doc. The reader
      // (both this admin UI and HOME-WEB's GlobalController.js) expects the
      // saved fields nested under a `sections` map, so `data` must be
      // `{ sections }` — NOT the sections spread flat into payload.
      const updatePageFn = firebase.app("jhome").functions().httpsCallable('api_v1_cms_content');
      await updatePageFn({
        apiVersion: 'v1',
        action: 'save',
        entity: 'page',
        payload: {
          id: this.currentPageKey,
          data: { sections }
        }
      });

      window.AdminApp.showToast('تم حفظ التعديلات بنجاح!', 'success');
    } catch(e) {
      console.error('Error saving page content:', e);
      window.AdminApp.showToast('فشل حفظ التعديلات. تأكد من الصلاحيات.', 'error');
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
  closeCourseDetails() {
    academyView.closeCourseDetails();
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

  // ── Academy Tab Utilities ──
  switchCourseTab(tabName) {
    academyView.switchCourseTab(tabName);
  },

  filterRequests() {
    academyView.filterRequests();
  },

  searchStudents() {
    academyView.searchStudents();
  },

  sortStudents() {
    academyView.sortStudents();
  },

  printStudents() {
    academyView.printStudents();
  },

  exportStudentsExcel() {
    academyView.exportStudentsExcel();
  },

  openStudentDetails(credId) {
    academyView.openStudentDetails(credId);
  },

  copyStudentCredentials() {
    academyView.copyStudentCredentials();
  },

  async regenerateStudentPassword() {
    await academyView.regenerateStudentPassword();
  },

  async deleteStudentAccount() {
    await academyView.deleteStudentAccount();
  },

  // ── Curriculum UI Wrappers ──
  openAddSectionModal() {
    academyView.openAddSectionModal();
  },
  editCurriculumSection(id, title) {
    academyView.editCurriculumSection(id, title);
  },
  async saveCurriculumSection(e) {
    await academyView.saveCurriculumSection(e);
  },
  async deleteCurriculumSection(id) {
    await academyView.deleteCurriculumSection(id);
  },
  openAddLessonModal(sectionId) {
    academyView.openAddLessonModal(sectionId);
  },
  toggleLessonTypeFields() {
    academyView.toggleLessonTypeFields();
  },
  async saveCurriculumLesson(e) {
    await academyView.saveCurriculumLesson(e);
  },
  async deleteCurriculumLesson(id) {
    await academyView.deleteCurriculumLesson(id);
  },
  openCourseSettingsModal() {
    academyView.openCourseSettingsModal();
  },
  async saveCourseSettings(e) {
    await academyView.saveCourseSettings(e);
  },

  // ── Helper: Create Dynamic Tab ──
  createDynamicTab(tabId) {
    let tabEl = document.getElementById(`jhome-tab-${tabId}`);
    if (tabEl) return tabEl;

    const blogTab = document.getElementById('jhome-tab-blog') || document.querySelector('.jhome-tab');
    if (!blogTab || !blogTab.parentNode) return null;

    tabEl = document.createElement('div');
    tabEl.id = `jhome-tab-${tabId}`;
    tabEl.className = 'jhome-tab';
    tabEl.style.display = 'block';
    blogTab.parentNode.appendChild(tabEl);

    // Auto-inject tab button in the header nav if missing
    const tabsBar = document.querySelector('.jhome-tabs-nav') || blogTab.parentNode.querySelector('.tabs-header') || document.querySelector('.jhome-tab-btn')?.parentNode;
    if (tabsBar && !tabsBar.querySelector(`.jhome-tab-btn[onclick*="'${tabId}'"]`)) {
      const btn = document.createElement('button');
      btn.className = 'jhome-tab-btn';
      btn.setAttribute('onclick', `JhomeApp.showTab('${tabId}', this)`);
      btn.textContent = tabId === 'media' ? 'مكتبة الوسائط' : (tabId === 'analytics' ? 'الإحصائيات' : tabId);
      tabsBar.appendChild(btn);
    }

    return tabEl;
  },

  // ── Blog / Posts Advanced Engine ──
  editingPostId: null,
  quillEditor: null,

  async ensureQuillLoaded() {
    if (window.Quill) return;
    if (!document.getElementById('quill-css')) {
      const link = document.createElement('link');
      link.id = 'quill-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
      document.head.appendChild(link);
    }
    if (!window.Quill) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.6/quill.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
  },

  async initQuillEditor() {
    await this.ensureQuillLoaded();
    const contentTextarea = document.getElementById('jpost-content');
    if (!contentTextarea) return;

    let editorContainer = document.getElementById('jpost-quill-editor');
    if (!editorContainer) {
      editorContainer = document.createElement('div');
      editorContainer.id = 'jpost-quill-editor';
      editorContainer.style.minHeight = '240px';
      editorContainer.style.direction = 'rtl';
      editorContainer.style.textAlign = 'right';
      editorContainer.style.background = '#fff';
      editorContainer.style.color = '#333';
      editorContainer.style.borderRadius = '0 0 8px 8px';

      contentTextarea.style.display = 'none';
      contentTextarea.parentNode.insertBefore(editorContainer, contentTextarea.nextSibling);
    }

    if (!this.quillEditor && window.Quill) {
      this.quillEditor = new Quill('#jpost-quill-editor', {
        theme: 'snow',
        placeholder: 'اكتب محتوى المقال بتنسيق غني هنا...',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'align': [] }, { 'direction': 'rtl' }],
            ['link', 'image', 'blockquote', 'code-block'],
            ['clean']
          ]
        }
      });
      this.quillEditor.format('direction', 'rtl');
      this.quillEditor.format('align', 'right');
    }
  },

  slugify(text) {
    return text
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0621-\u064A-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  ensurePostModalSeoFields() {
    const modalContent = document.querySelector('#jhome-post-modal .modal-content') || document.getElementById('jhome-post-modal');
    if (!modalContent || document.getElementById('jpost-seo-suite-container')) return;

    const seoContainer = document.createElement('div');
    seoContainer.id = 'jpost-seo-suite-container';
    seoContainer.style.marginTop = '15px';
    seoContainer.style.padding = '15px';
    seoContainer.style.background = 'rgba(0,128,128,0.04)';
    seoContainer.style.borderRadius = '8px';
    seoContainer.style.border = '1px solid rgba(0,128,128,0.15)';
    seoContainer.innerHTML = `
      <h4 style="margin: 0 0 10px 0; color: var(--primary, #008080);">🔍 تحسين محركات البحث (SEO Suite)</h4>
      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px;">عنوان محركات البحث (SEO Title):</label>
        <input type="text" id="jpost-seo-title" class="text-input" style="width:100%;" placeholder="العنوان الذي يظهر في نتائج بحث Google (يوصى بـ 50-60 حرف)">
      </div>
      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px;">وصف محركات البحث (Meta Description):</label>
        <textarea id="jpost-seo-desc" class="text-input" style="width:100%; min-height: 60px;" placeholder="الوصف المختصر الذي يظهر في نتائج البحث (يوصى بـ 150-160 حرف)"></textarea>
      </div>
      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px;">الكلمات المفتاحية (Tags - مفصولة بفواصل):</label>
        <input type="text" id="jpost-tags" class="text-input" style="width:100%;" placeholder="تقنية, أعمال, سودان فري">
      </div>
      <div style="display: flex; gap: 10px; margin-top: 15px; justify-content: flex-end;">
        <button type="button" class="btn btn-outline-secondary" onclick="JhomeApp.savePost('draft')">حفظ كمسودة 📝</button>
        <button type="button" class="btn btn-success" onclick="JhomeApp.savePost('published')">نشر المقال الآن 🚀</button>
      </div>
    `;

    const actionsContainer = document.querySelector('#jhome-post-modal .modal-footer') || document.querySelector('#jhome-post-modal form') || modalContent;
    actionsContainer.appendChild(seoContainer);
  },

  async loadPosts() {
    const tbody = document.getElementById('jhome-posts-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">⏳ جاري التحميل...</td></tr>';
    try {
      const snap = await this.db.collection('posts').get();

      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد مقالات منشورة حتى الآن</td></tr>';
        return;
      }

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
        const isPub = (p.status === 'published');
        return `
          <tr>
            <td>${cover}</td>
            <td><strong>${p.title || '—'}</strong><br><small style="color:var(--text-muted)">${p.authorName || 'إدارة Jhome'} | 👁 ${p.views || 0}</small></td>
            <td><span class="role-badge role-freelancer">${p.category || 'عام'}</span></td>
            <td><span class="report-status ${isPub ? 'reviewed' : 'pending'}" style="background:${isPub ? '#10B98120' : '#F59E0B20'}; color:${isPub ? '#10B981' : '#F59E0B'}; padding:3px 8px; border-radius:4px; font-weight:bold;">${isPub ? 'منشور' : 'مسودة'}</span></td>
            <td>${date}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary" style="margin-left:4px;" onclick="JhomeApp.editPost('${p.id}')">تعديل</button>
              <button class="btn btn-sm btn-danger" onclick="JhomeApp.deletePost('${p.id}')">حذف</button>
            </td>
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
      await this.db.collection('posts').doc(id).delete();
      if (typeof window.showToast === 'function') window.showToast('تم الحذف بنجاح', 'success');
      this.loadPosts();
    } catch (e) {
      if (typeof window.showToast === 'function') window.showToast('حدث خطأ أثناء الحذف', 'error');
    }
  },

  async showPostModal(editId = null) {
    this.editingPostId = editId;
    await this.initQuillEditor();
    this.ensurePostModalSeoFields();

    const titleEl = document.getElementById('jpost-title');
    const slugEl = document.getElementById('jpost-slug');
    const excerptEl = document.getElementById('jpost-excerpt');
    const coverUrlEl = document.getElementById('jpost-cover-url');
    const coverFileEl = document.getElementById('jpost-cover-file');
    const catEl = document.getElementById('jpost-category');
    const featuredEl = document.getElementById('jpost-featured');
    const seoTitleEl = document.getElementById('jpost-seo-title');
    const seoDescEl = document.getElementById('jpost-seo-desc');
    const tagsEl = document.getElementById('jpost-tags');

    // Attach auto-slug generator
    if (titleEl && slugEl) {
      titleEl.oninput = () => {
        if (!this.editingPostId && !slugEl.dataset.customized) {
          slugEl.value = this.slugify(titleEl.value);
        }
      };
      slugEl.oninput = () => {
        slugEl.dataset.customized = 'true';
      };
    }

    if (editId) {
      try {
        const doc = await this.db.collection('posts').doc(editId).get();
        if (doc.exists) {
          const data = doc.data();
          if (titleEl) titleEl.value = data.title || '';
          if (slugEl) { slugEl.value = data.slug || ''; slugEl.dataset.customized = 'true'; }
          if (excerptEl) excerptEl.value = data.excerpt || '';
          if (coverUrlEl) coverUrlEl.value = data.coverImage || '';
          if (coverFileEl) coverFileEl.value = '';
          if (catEl) catEl.value = data.category || 'تقنية';
          if (featuredEl) featuredEl.checked = !!data.isFeatured;
          if (seoTitleEl) seoTitleEl.value = data.seoTitle || '';
          if (seoDescEl) seoDescEl.value = data.seoDescription || '';
          if (tagsEl) tagsEl.value = Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || '');

          if (this.quillEditor) {
            this.quillEditor.root.innerHTML = data.content || '';
          } else {
            const contentEl = document.getElementById('jpost-content');
            if (contentEl) contentEl.value = data.content || '';
          }
        }
      } catch(e) {
        console.error('Error fetching post for edit:', e);
      }
    } else {
      if (titleEl) titleEl.value = '';
      if (slugEl) { slugEl.value = ''; delete slugEl.dataset.customized; }
      if (excerptEl) excerptEl.value = '';
      if (coverUrlEl) coverUrlEl.value = '';
      if (coverFileEl) coverFileEl.value = '';
      if (catEl) catEl.value = 'تقنية';
      if (featuredEl) featuredEl.checked = false;
      if (seoTitleEl) seoTitleEl.value = '';
      if (seoDescEl) seoDescEl.value = '';
      if (tagsEl) tagsEl.value = '';
      if (this.quillEditor) {
        this.quillEditor.setContents([]);
      } else {
        const contentEl = document.getElementById('jpost-content');
        if (contentEl) contentEl.value = '';
      }
    }

    const modal = document.getElementById('jhome-post-modal');
    if (modal) modal.style.display = 'flex';
  },

  editPost(id) {
    this.showPostModal(id);
  },

  async uploadJhomeImage(file, folder) {
    if (!file) return null;
    const ref = firebase.app('jhome').storage().ref(`${folder}/${Date.now()}_${file.name}`);
    const snapshot = await ref.put(file);
    return await snapshot.ref.getDownloadURL();
  },

  async savePost(targetStatus = 'published') {
    const title = document.getElementById('jpost-title')?.value.trim();
    const slug = document.getElementById('jpost-slug')?.value.trim();
    const excerpt = document.getElementById('jpost-excerpt')?.value.trim();
    let content = this.quillEditor ? this.quillEditor.root.innerHTML.trim() : document.getElementById('jpost-content')?.value.trim();
    let coverImage = document.getElementById('jpost-cover-url')?.value.trim();
    const category = document.getElementById('jpost-category')?.value.trim() || 'تقنية';
    const isFeatured = !!document.getElementById('jpost-featured')?.checked;
    const seoTitle = document.getElementById('jpost-seo-title')?.value.trim() || '';
    const seoDescription = document.getElementById('jpost-seo-desc')?.value.trim() || '';
    const tagsRaw = document.getElementById('jpost-tags')?.value.trim() || '';
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    const fileInput = document.getElementById('jpost-cover-file');
    const file = fileInput ? fileInput.files[0] : null;

    if (!title || !slug || !content) {
      if (typeof window.showToast === 'function') window.showToast('الرجاء إدخال العنوان، الرابط الصديق، والمحتوى الأساسي', 'error');
      return;
    }

    try {
      if (typeof window.showToast === 'function') window.showToast('جاري حفظ المقال...', 'success');
      if (file) {
        coverImage = await this.uploadJhomeImage(file, 'posts');
      }

      const postData = {
        title,
        slug,
        excerpt,
        content,
        coverImage: coverImage || '',
        category,
        tags,
        isFeatured,
        status: targetStatus,
        seoTitle,
        seoDescription,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (this.editingPostId) {
        await this.db.collection('posts').doc(this.editingPostId).update(postData);
        if (typeof window.showToast === 'function') window.showToast('✅ تم تحديث المقال بنجاح!', 'success');
      } else {
        postData.views = 0;
        postData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        postData.publishedAt = firebase.firestore.FieldValue.serverTimestamp();
        await this.db.collection('posts').add(postData);
        if (typeof window.showToast === 'function') window.showToast(targetStatus === 'published' ? '✅ تم نشر المقال بنجاح!' : '✅ تم حفظ المسودة بنجاح!', 'success');
      }

      this.editingPostId = null;
      if (window.AdminApp && typeof window.AdminApp.closeModal === 'function') {
        AdminApp.closeModal('jhome-post-modal');
      } else {
        const modal = document.getElementById('jhome-post-modal');
        if (modal) modal.style.display = 'none';
      }
      this.loadPosts();
    } catch (e) {
      console.error('Error saving post:', e);
      if (typeof window.showToast === 'function') window.showToast('خطأ أثناء حفظ المقال: ' + e.message, 'error');
    }
  },

  // ── Stories Enhanced Review Engine ──
  async loadStories() {
    try {
      const pubSnap = await this.db.collection('successStories').where('isPublished', '==', true).get();
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

      const subSnap = await this.db.collection('storySubmissions').where('status', '==', 'pending').get();
      const subList = document.getElementById('jhome-story-submissions-list');
      
      if (subSnap.empty) {
        subList.innerHTML = '<p class="empty-state">لا توجد تقديمات جديدة بانتظار المراجعة</p>';
      } else {
        subList.innerHTML = subSnap.docs.map(doc => {
          const sub = doc.data();
          return `
            <div class="verify-card" style="padding:15px; margin-bottom:15px; border-radius:10px; background:var(--bg-card, #fff); box-shadow:0 2px 6px rgba(0,0,0,0.05); border-right:4px solid #10B981;">
              <h4>${sub.title || 'قصة نجاح'}</h4>
              <p><strong>من:</strong> ${sub.submitterName || '—'} | ${sub.submitterEmail || ''} (${sub.submitterPhone || 'بدون هاتف'})</p>
              ${sub.profileLink ? `<p><strong>رابط الحرفي:</strong> <a href="${encodeURI(sub.profileLink)}" target="_blank" style="color:var(--primary);text-decoration:underline;">${sub.profileLink}</a></p>` : ''}
              <p style="margin-top:10px; background:rgba(0,0,0,0.03); padding:10px; border-radius:8px; line-height:1.6;">${sub.story}</p>
              <div style="margin-top:10px; display:flex; gap:10px;">
                <button class="btn btn-sm btn-success" onclick="JhomeApp.approveStorySubmission('${doc.id}')">اعتماد ومراجعة للنشر ✨</button>
                <button class="btn btn-sm btn-danger" onclick="JhomeApp.rejectStorySubmission('${doc.id}')">رفض</button>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (e) {
      console.error('Error loading stories:', e);
      if (window.AdminApp) window.AdminApp.showToast('خطأ في جلب القصص: ' + e.message, 'error');
    }
  },

  async approveStorySubmission(id) {
    try {
      const doc = await this.db.collection('storySubmissions').doc(id).get();
      if (!doc.exists) return;
      const sub = doc.data();
      this.showStoryApprovalModal(id, sub);
    } catch(e) {
      console.error(e);
      if (window.AdminApp) window.AdminApp.showToast('خطأ في جلب بيانات القصة', 'error');
    }
  },

  showStoryApprovalModal(id, sub) {
    let modal = document.getElementById('jhome-approve-story-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'jhome-approve-story-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px; text-align: right; direction: rtl;">
        <div class="modal-header">
          <h3>اعتماد وتجهيز قصة النجاح للنشر</h3>
          <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
        </div>
        <div class="modal-body" style="padding: 15px;">
          <div style="margin-bottom: 12px;">
            <label style="font-weight: bold; display: block; margin-bottom: 4px;">اسم صاحب القصة:</label>
            <input type="text" id="jstory-appr-name" class="text-input" style="width:100%;" value="${sub.submitterName || sub.title || ''}">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="font-weight: bold; display: block; margin-bottom: 4px;">المهنة / الدور:</label>
            <input type="text" id="jstory-appr-role" class="text-input" style="width:100%;" value="${sub.personRole || 'مستخدم SudFree'}">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="font-weight: bold; display: block; margin-bottom: 4px;">المدينة:</label>
            <input type="text" id="jstory-appr-city" class="text-input" style="width:100%;" value="${sub.city || ''}">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="font-weight: bold; display: block; margin-bottom: 4px;">الإنجاز الرئيسي (مختصر):</label>
            <input type="text" id="jstory-appr-achieve" class="text-input" style="width:100%;" placeholder="مثلاً: أنجز أكثر من 40 مشروعاً عبر المنصة" value="${sub.keyAchievement || ''}">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="font-weight: bold; display: block; margin-bottom: 4px;">نص القصة الكامل:</label>
            <textarea id="jstory-appr-content" class="text-input" style="width:100%; min-height: 120px;">${sub.story || ''}</textarea>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="font-weight: bold; display: block; margin-bottom: 4px;">رابط الملف الشخصي / الحرفي:</label>
            <input type="text" id="jstory-appr-link" class="text-input" dir="ltr" style="width:100%;" value="${sub.profileLink || sub.freelancerLink || ''}">
          </div>
        </div>
        <div class="modal-footer" style="padding: 15px; display: flex; justify-content: flex-end; gap: 10px;">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">إلغاء</button>
          <button class="btn btn-success" onclick="JhomeApp.confirmStoryApproval('${id}')">اعتماد ونشر في الموقع ✨</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async confirmStoryApproval(id) {
    const name = document.getElementById('jstory-appr-name')?.value.trim();
    const role = document.getElementById('jstory-appr-role')?.value.trim();
    const city = document.getElementById('jstory-appr-city')?.value.trim();
    const achieve = document.getElementById('jstory-appr-achieve')?.value.trim();
    const content = document.getElementById('jstory-appr-content')?.value.trim();
    const link = document.getElementById('jstory-appr-link')?.value.trim();

    if (!name || !content) {
      if (window.AdminApp) window.AdminApp.showToast('يرجى إدخال اسم صاحب القصة ونص القصة', 'error');
      return;
    }

    try {
      if (window.AdminApp) window.AdminApp.showToast('جاري الاعتماد والنشر...', 'success');
      await this.db.collection('successStories').add({
        title: name,
        personName: name,
        personRole: role || 'مستخدم SudFree',
        city: city || '',
        keyAchievement: achieve || '',
        story: content,
        freelancerLink: link || '',
        isPublished: true,
        category: 'general',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await this.db.collection('storySubmissions').doc(id).update({
        status: 'approved',
        approvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const modal = document.getElementById('jhome-approve-story-modal');
      if (modal) modal.remove();

      if (window.AdminApp) window.AdminApp.showToast('✅ تم اعتماد ونشر قصة النجاح بنجاح في الموقع!', 'success');
      this.loadStories();
    } catch(e) {
      console.error(e);
      if (window.AdminApp) window.AdminApp.showToast('حدث خطأ أثناء الاعتماد: ' + e.message, 'error');
    }
  },

  async rejectStorySubmission(id) {
    if (!confirm('هل تريد رفض هذا التقديم؟')) return;
    try {
      await this.db.collection('storySubmissions').doc(id).update({ status: 'rejected' });
      if (window.AdminApp) window.AdminApp.showToast('تم الرفض', 'success');
      this.loadStories();
    } catch(e) {
      if (window.AdminApp) window.AdminApp.showToast('خطأ', 'error');
    }
  },

  async deleteStory(id) {
    if (!confirm('هل أنت متأكد من حذف القصة؟')) return;
    await this.db.collection('successStories').doc(id).delete();
    this.loadStories();
  },

  // ── Media Library Central Hub ──
  currentMediaFilter: 'all',

  async loadMediaLibrary() {
    let tabEl = document.getElementById('jhome-tab-media');
    if (!tabEl) {
      tabEl = this.createDynamicTab('media');
    }
    if (!tabEl) return;

    tabEl.innerHTML = `
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="margin: 0 0 5px 0;">مكتبة الوسائط والصور</h2>
            <p style="margin: 0; color: var(--text-muted, #888); font-size: 13px;">إدارة واستعراض ورفع الصور لجميع أقسام الموقع والمدونة</p>
          </div>
          <div>
            <input type="file" id="jmedia-file-input" multiple accept="image/*" style="display: none;" onchange="JhomeApp.handleMediaUpload(event)">
            <button class="btn btn-primary" onclick="document.getElementById('jmedia-file-input').click()">
              <i class="icon-upload"></i> رفع صور جديدة 📤
            </button>
          </div>
        </div>

        <div id="jmedia-dropzone" style="border: 2px dashed #10B981; border-radius: 12px; padding: 25px; text-align: center; background: rgba(16,185,129,0.03); margin-bottom: 20px; cursor: pointer;"
             onclick="document.getElementById('jmedia-file-input').click()"
             ondragover="event.preventDefault(); this.style.background='rgba(16,185,129,0.08)';"
             ondragleave="this.style.background='rgba(16,185,129,0.03)';"
             ondrop="event.preventDefault(); JhomeApp.handleMediaDrop(event);">
          <div style="font-size: 28px; margin-bottom: 8px;">📁</div>
          <strong>اسحب وأفلت الصور هنا لرفعها مباشرة</strong>
          <p style="margin: 5px 0 0; font-size: 12px; color: var(--text-muted, #888);">يدعم JPG, PNG, WEBP, SVG (رفع متعدد)</p>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
          <button class="btn btn-sm ${this.currentMediaFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="JhomeApp.filterMedia('all')">الكل</button>
          <button class="btn btn-sm ${this.currentMediaFilter === 'posts' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="JhomeApp.filterMedia('posts')">المقالات (posts)</button>
          <button class="btn btn-sm ${this.currentMediaFilter === 'courses' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="JhomeApp.filterMedia('courses')">الأكاديمية (courses)</button>
          <button class="btn btn-sm ${this.currentMediaFilter === 'stories' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="JhomeApp.filterMedia('stories')">قصص النجاح (stories)</button>
          <button class="btn btn-sm ${this.currentMediaFilter === 'general' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="JhomeApp.filterMedia('general')">عام (general)</button>
        </div>

        <div id="jmedia-grid-container">
          <div style="text-align: center; padding: 40px;">⏳ جاري تحميل مكتبة الوسائط...</div>
        </div>
      </div>
    `;

    await this.fetchMediaItems();
  },

  async filterMedia(folder) {
    this.currentMediaFilter = folder;
    this.loadMediaLibrary();
  },

  async fetchMediaItems() {
    const container = document.getElementById('jmedia-grid-container');
    if (!container) return;

    try {
      let query = this.db.collection('media').orderBy('uploadedAt', 'desc').limit(60);
      if (this.currentMediaFilter !== 'all') {
        query = this.db.collection('media').where('folder', '==', this.currentMediaFilter).orderBy('uploadedAt', 'desc').limit(60);
      }

      const snap = await query.get();
      if (snap.empty) {
        container.innerHTML = '<p class="empty-state" style="text-align: center; padding: 40px; color: var(--text-muted, #888);">لا توجد صور في هذا المجلد حتى الآن</p>';
        return;
      }

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;">
          ${snap.docs.map(doc => {
            const m = doc.data();
            const dateStr = m.uploadedAt?.toDate ? m.uploadedAt.toDate().toLocaleDateString('ar-EG') : '';
            return `
              <div class="media-card" style="border: 1px solid rgba(0,0,0,0.1); border-radius: 10px; overflow: hidden; background: var(--bg-card, #fff); box-shadow: 0 2px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column;">
                <div style="height: 140px; background: #f0f0f0; overflow: hidden; position: relative;">
                  <img src="${m.url}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
                  <span style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.6); color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px;">${m.folder || 'عام'}</span>
                </div>
                <div style="padding: 10px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="font-size: 12px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${m.originalName || m.filename}">${m.originalName || m.filename || 'صورة'}</div>
                    <div style="font-size: 11px; color: var(--text-muted, #888); margin-top: 2px;">${dateStr}</div>
                  </div>
                  <div style="margin-top: 10px; display: flex; gap: 6px;">
                    <button class="btn btn-sm btn-outline-primary" style="flex: 1; font-size: 11px; padding: 4px 6px;" onclick="JhomeApp.copyMediaUrl('${m.url}')">نسخ الرابط</button>
                    <button class="btn btn-sm btn-danger" style="font-size: 11px; padding: 4px 8px;" onclick="JhomeApp.deleteMediaItem('${doc.id}', '${m.filename || ''}')">🗑️</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch(e) {
      console.error('Error fetching media:', e);
      container.innerHTML = `<p class="empty-state" style="color:red; text-align:center;">حدث خطأ أثناء تحميل الوسائط: ${e.message}</p>`;
    }
  },

  copyMediaUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
      if (window.AdminApp) window.AdminApp.showToast('تم نسخ رابط الصورة إلى الحافظة! 📋', 'success');
    }).catch(() => {
      prompt('انسخ رابط الصورة:', url);
    });
  },

  async handleMediaUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await this.processFilesUpload(files);
  },

  async handleMediaDrop(event) {
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    await this.processFilesUpload(files);
  },

  async processFilesUpload(files) {
    if (window.AdminApp) window.AdminApp.showToast(`جاري رفع ${files.length} ملف...`, 'success');
    const folder = this.currentMediaFilter === 'all' ? 'general' : this.currentMediaFilter;
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const filename = `media/${folder}/${Date.now()}_${file.name}`;
        const ref = firebase.app('jhome').storage().ref(filename);
        const snap = await ref.put(file);
        const url = await snap.ref.getDownloadURL();

        await this.db.collection('media').add({
          filename,
          originalName: file.name,
          url,
          mimeType: file.type,
          size: file.size,
          folder,
          uploadedBy: 'admin',
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      if (window.AdminApp) window.AdminApp.showToast('✅ تم رفع جميع الملفات بنجاح!', 'success');
      this.fetchMediaItems();
    } catch(e) {
      console.error('Upload error:', e);
      if (window.AdminApp) window.AdminApp.showToast('خطأ أثناء الرفع: ' + e.message, 'error');
    }
  },

  async deleteMediaItem(docId, filename) {
    if (!confirm('هل تريد حذف هذه الصورة نهائياً؟')) return;
    try {
      await this.db.collection('media').doc(docId).delete();
      if (filename) {
        try {
          await firebase.app('jhome').storage().ref(filename).delete();
        } catch(_) {}
      }
      if (window.AdminApp) window.AdminApp.showToast('تم حذف الصورة', 'success');
      this.fetchMediaItems();
    } catch(e) {
      if (window.AdminApp) window.AdminApp.showToast('فشل حذف الصورة: ' + e.message, 'error');
    }
  },

  // ── Interactive Analytics Hub (Chart.js) ──
  async loadAnalytics() {
    let tabEl = document.getElementById('jhome-tab-analytics');
    if (!tabEl) {
      tabEl = this.createDynamicTab('analytics');
    }
    if (!tabEl) return;

    tabEl.innerHTML = `
      <div style="padding: 20px;">
        <h2 style="margin: 0 0 5px 0;">لوحة تحليلات وإحصائيات المنصة</h2>
        <p style="margin: 0 0 20px 0; color: var(--text-muted, #888); font-size: 13px;">نظرة شاملة على مؤشرات الأداء، تفاعل القراء، ونمو المنصة</p>

        <!-- KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 25px;">
          <div class="kpi-card" style="background: var(--bg-card, #fff); padding: 18px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); border-right: 4px solid #10B981;">
            <div style="font-size: 12px; color: var(--text-muted, #888); font-weight: bold;">المقالات المنشورة</div>
            <div id="kpi-posts-count" style="font-size: 28px; font-weight: bold; margin-top: 6px; color: #10B981;">...</div>
          </div>
          <div class="kpi-card" style="background: var(--bg-card, #fff); padding: 18px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); border-right: 4px solid #3B82F6;">
            <div style="font-size: 12px; color: var(--text-muted, #888); font-weight: bold;">قصص النجاح</div>
            <div id="kpi-stories-count" style="font-size: 28px; font-weight: bold; margin-top: 6px; color: #3B82F6;">...</div>
          </div>
          <div class="kpi-card" style="background: var(--bg-card, #fff); padding: 18px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); border-right: 4px solid #F59E0B;">
            <div style="font-size: 12px; color: var(--text-muted, #888); font-weight: bold;">طلبات قصص معلقة</div>
            <div id="kpi-pending-stories" style="font-size: 28px; font-weight: bold; margin-top: 6px; color: #F59E0B;">...</div>
          </div>
          <div class="kpi-card" style="background: var(--bg-card, #fff); padding: 18px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); border-right: 4px solid #8B5CF6;">
            <div style="font-size: 12px; color: var(--text-muted, #888); font-weight: bold;">الرسائل الواردة</div>
            <div id="kpi-messages-count" style="font-size: 28px; font-weight: bold; margin-top: 6px; color: #8B5CF6;">...</div>
          </div>
        </div>

        <!-- Charts Container -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
          <div style="background: var(--bg-card, #fff); padding: 20px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
            <h4 style="margin: 0 0 15px 0;">📊 توزيع المقالات حسب التصنيف</h4>
            <div style="height: 260px; position: relative;">
              <canvas id="jchart-categories"></canvas>
            </div>
          </div>
          <div style="background: var(--bg-card, #fff); padding: 20px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
            <h4 style="margin: 0 0 15px 0;">📈 المقالات الأكثر قراءة وتفاعلاً</h4>
            <div style="height: 260px; position: relative;">
              <canvas id="jchart-views"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.ensureChartJsLoaded();
    await this.renderAnalyticsData();
  },

  async ensureChartJsLoaded() {
    if (window.Chart) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  async renderAnalyticsData() {
    try {
      const [postsSnap, storiesSnap, subSnap, msgSnap] = await Promise.all([
        this.db.collection('posts').get(),
        this.db.collection('successStories').get(),
        this.db.collection('storySubmissions').where('status', '==', 'pending').get(),
        this.db.collection('contactMessages').get().catch(() => ({ size: 0, docs: [] }))
      ]);

      const elP = document.getElementById('kpi-posts-count');
      const elS = document.getElementById('kpi-stories-count');
      const elSub = document.getElementById('kpi-pending-stories');
      const elM = document.getElementById('kpi-messages-count');

      if (elP) elP.textContent = postsSnap.size || 0;
      if (elS) elS.textContent = storiesSnap.size || 0;
      if (elSub) elSub.textContent = subSnap.size || 0;
      if (elM) elM.textContent = msgSnap.size || 0;

      const catCounts = {};
      const postsWithViews = [];

      postsSnap.docs.forEach(doc => {
        const d = doc.data();
        const cat = d.category || 'عام';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        postsWithViews.push({ title: d.title || 'مقال', views: d.views || 0 });
      });

      const catCtx = document.getElementById('jchart-categories');
      if (catCtx && window.Chart) {
        if (this._chartCat) this._chartCat.destroy();
        this._chartCat = new Chart(catCtx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(catCounts),
            datasets: [{
              data: Object.values(catCounts),
              backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
          }
        });
      }

      postsWithViews.sort((a, b) => b.views - a.views);
      const topPosts = postsWithViews.slice(0, 5);

      const viewsCtx = document.getElementById('jchart-views');
      if (viewsCtx && window.Chart) {
        if (this._chartViews) this._chartViews.destroy();
        this._chartViews = new Chart(viewsCtx, {
          type: 'bar',
          data: {
            labels: topPosts.map(p => p.title.length > 20 ? p.title.substring(0, 20) + '...' : p.title),
            datasets: [{
              label: 'عدد المشاهدات',
              data: topPosts.map(p => p.views),
              backgroundColor: '#10B981'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
          }
        });
      }

    } catch(e) {
      console.error('Analytics error:', e);
    }
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
      window.AdminApp.showToast('الرجاء إدخال اسم الشخص وتفاصيل القصة', 'error');
      return;
    }

    try {
      window.AdminApp.showToast('جاري الحفظ والرفع...', 'success');
      if (file) {
        coverImage = await this.uploadJhomeImage(file, 'successStories');
      }

      await this.db.collection('successStories').add({
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
      window.AdminApp.showToast('تم نشر قصة النجاح بنجاح!', 'success');
      AdminApp.closeModal('jhome-story-modal');
      this.loadStories();
    } catch (e) {
      console.error('Error saving story:', e);
      window.AdminApp.showToast('خطأ أثناء حفظ القصة: ' + e.message, 'error');
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

// Start the hook immediately. The polling mechanism will wait for AdminApp to be ready.
hookJhomeNavigation();

window.JhomeApp = JhomeApp;
