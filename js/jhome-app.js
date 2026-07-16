// Jhome App Management Logic
const JhomeApp = {
  currentTab: 'blog',

  showTab(tabId) {
    this.currentTab = tabId;
    
    // Update active button state
    document.querySelectorAll('.jhome-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Hide all tabs
    document.querySelectorAll('.jhome-tab').forEach(tab => tab.style.display = 'none');
    
    // Show selected tab
    document.getElementById(`jhome-tab-${tabId}`).style.display = 'block';

    // Check if Jhome is authenticated
    if (!firebase.app('jhome').auth().currentUser) {
      showToast('⚠️ تحذير: حساب Jhome غير متصل! يرجى تسجيل الخروج بالكامل ثم الدخول مجدداً.', 'error');
    }

    // Load data based on tab
    if (tabId === 'blog') this.loadPosts();
    if (tabId === 'stories') this.loadStories();
    if (tabId === 'messages') this.loadMessages();
    if (tabId === 'newsletter') this.loadNewsletter();
    if (tabId === 'academy-payments') this.renderAcademyAccounts();
    if (tabId === 'academy-users') this.renderAcademyUsers();
    if (tabId === 'pages') this.loadPageContent('home'); // Default page
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
      
      const updatePageFn = firebase.app("jhome").functions().httpsCallable('adminUpdatePageContent');
      await updatePageFn({
        pageKey: this.currentPageKey,
        sections: sections
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

  // ── Blog / Posts ──
  async loadPosts() {
    try {
      const snap = await jhomeDb.collection('posts').orderBy('publishedAt', 'desc').get();
      const tbody = document.getElementById('jhome-posts-tbody');
      
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد مقالات منشورة حتى الآن</td></tr>';
        return;
      }

      tbody.innerHTML = snap.docs.map(doc => {
        const p = doc.data();
        const date = p.publishedAt ? (p.publishedAt.toDate ? p.publishedAt.toDate().toLocaleDateString('ar-EG') : new Date(p.publishedAt).toLocaleDateString('ar-EG')) : '—';
        return `
          <tr>
            <td><img src="${p.coverImage || 'https://via.placeholder.com/150'}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;"></td>
            <td><strong>${p.title}</strong><br><small style="color:var(--text-muted)">${p.authorName || 'إدارة Jhome'}</small></td>
            <td><span class="role-badge role-freelancer">${p.category || 'عام'}</span></td>
            <td><span class="report-status ${p.status === 'published' ? 'reviewed' : 'pending'}">${p.status === 'published' ? 'منشور' : 'مسودة'}</span></td>
            <td>${date}</td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="JhomeApp.deletePost('${doc.id}')">حذف</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error('Error loading posts:', e);
      showToast('خطأ في جلب المقالات: ' + e.message, 'error');
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
    document.getElementById('jstory-cover-url').value = '';
    document.getElementById('jstory-cover-file').value = '';
    document.getElementById('jhome-story-modal').style.display = 'flex';
  },

  async saveStory() {
    const title = document.getElementById('jstory-person').value.trim(); // used as personName/title
    const personRole = document.getElementById('jstory-role').value.trim();
    const keyAchievement = document.getElementById('jstory-achievement').value.trim();
    const story = document.getElementById('jstory-content').value.trim();
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
  async loadMessages() {
    try {
      const snap = await jhomeDb.collection('contactMessages').orderBy('createdAt', 'desc').get();
      const list = document.getElementById('jhome-messages-list');
      
      if (snap.empty) {
        list.innerHTML = '<p class="empty-state">لا توجد رسائل تواصل جديدة</p>';
        return;
      }

      list.innerHTML = snap.docs.map(doc => {
        const m = doc.data();
        const isNew = m.status === 'new' || !m.status;
        return `
          <div class="verify-card" style="padding:15px; margin-bottom:15px; border-left: 4px solid ${isNew ? 'var(--primary)' : 'var(--border)'}">
            <div style="display:flex; justify-content:space-between;">
              <h4 style="margin:0;">${m.subject || 'بدون عنوان'} ${isNew ? '<span class="report-status pending">جديد</span>' : ''}</h4>
              <small style="color:var(--text-muted)">${m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString('ar-EG') : ''}</small>
            </div>
            <p style="margin:8px 0; font-size:13px;"><strong>من:</strong> ${m.name} &lt;${m.email}&gt; | 📞 ${m.phone || 'غير محدد'}</p>
            <p style="background:var(--bg-body); padding:10px; border-radius:8px;">${m.message}</p>
            <div style="margin-top:10px; display:flex; gap:10px;">
              ${isNew ? `<button class="btn btn-sm btn-success" onclick="JhomeApp.markMessageRead('${doc.id}')">تعليم كمقروء</button>` : ''}
              <a href="mailto:${m.email}?subject=رد بخصوص رسالتك لمؤسسة Jhome" class="btn btn-sm btn-primary">الرد عبر الإيميل</a>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error('Error loading messages:', e);
      showToast('خطأ في جلب الرسائل: ' + e.message, 'error');
    }
  },

  async markMessageRead(id) {
    try {
      await jhomeDb.collection('contactMessages').doc(id).update({ status: 'read' });
      this.loadMessages();
    } catch(e) {}
  },

  // ── Newsletter ──
  async loadNewsletter() {
    try {
      const snap = await jhomeDb.collection('newsletter').get();
      const tbody = document.getElementById('jhome-newsletter-tbody');
      
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">لا يوجد مشتركون بعد</td></tr>';
        return;
      }

      tbody.innerHTML = snap.docs.map(doc => {
        const n = doc.data();
        return `
          <tr>
            <td><strong>${n.email}</strong></td>
            <td>${n.name || '—'}</td>
            <td><span class="report-status ${(n.isActive !== false) ? 'reviewed' : 'dismissed'}">${(n.isActive !== false) ? 'نشط' : 'ملغى'}</span></td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error('Error loading newsletter:', e);
      showToast('خطأ في جلب القائمة البريدية', 'error');
    }
  },

  // ── Academy Features ──
  getAcademyAccounts() {
    const stored = localStorage.getItem('jhome_banks');
    if (!stored) {
        const defaultBanks = [
            { id: '1', bankName: 'بنكك', accountName: 'جمال أحمد', accountNumber: '123456789' },
            { id: '2', bankName: 'فوري', accountName: 'جمال أحمد', accountNumber: '987654321' }
        ];
        localStorage.setItem('jhome_banks', JSON.stringify(defaultBanks));
        return defaultBanks;
    }
    return JSON.parse(stored);
  },
  
  saveAcademyAccounts(accounts) {
    localStorage.setItem('jhome_banks', JSON.stringify(accounts));
  },

  renderAcademyAccounts() {
    const list = document.getElementById('bank-accounts-list');
    if (!list) return;
    const accounts = this.getAcademyAccounts();
    list.innerHTML = '';
    if (accounts.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align: center;">لا توجد حسابات</td></tr>';
        return;
    }
    accounts.forEach(acc => {
        list.innerHTML += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem;">${acc.bankName}</td>
                <td style="padding: 1rem;">${acc.accountName}</td>
                <td style="padding: 1rem; font-family: monospace;">${acc.accountNumber}</td>
                <td style="padding: 1rem;">
                    <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteAcademyAccount('${acc.id}')">حذف</button>
                </td>
            </tr>
        `;
    });
  },

  addAcademyAccount(e) {
    e.preventDefault();
    const bankName = document.getElementById('new-bank-name').value;
    const accName = document.getElementById('new-account-name').value;
    const accNum = document.getElementById('new-account-number').value;
    const accounts = this.getAcademyAccounts();
    accounts.push({ id: Date.now().toString(), bankName, accountName: accName, accountNumber: accNum });
    this.saveAcademyAccounts(accounts);
    document.getElementById('add-bank-form').reset();
    this.renderAcademyAccounts();
  },

  deleteAcademyAccount(id) {
    if (confirm('حذف هذا الحساب؟')) {
        let accounts = this.getAcademyAccounts();
        accounts = accounts.filter(a => a.id !== id);
        this.saveAcademyAccounts(accounts);
        this.renderAcademyAccounts();
    }
  },

  getAcademyUsers() {
    const stored = localStorage.getItem('jhome_users');
    if (!stored) {
        const defaultUsers = [
            { id: 'admin-1', fullname: 'جمال أحمد', username: 'jamalahmed', password: 'jamalahmed', role: 'instructor' }
        ];
        localStorage.setItem('jhome_users', JSON.stringify(defaultUsers));
        return defaultUsers;
    }
    return JSON.parse(stored);
  },

  saveAcademyUsers(users) {
    localStorage.setItem('jhome_users', JSON.stringify(users));
  },

  renderAcademyUsers() {
    const list = document.getElementById('users-list');
    if (!list) return;
    const users = this.getAcademyUsers();
    list.innerHTML = '';
    if (users.length === 0) {
        list.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا يوجد مستخدمين</td></tr>';
        return;
    }
    users.forEach(user => {
        const roleBadge = user.role === 'instructor' 
            ? '<span style="background: var(--warning); color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">مدرب / مشرف</span>'
            : '<span style="background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">طالب</span>';
        
        list.innerHTML += `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem;">${user.fullname}</td>
                <td style="padding: 1rem; font-family: monospace; color: var(--primary);">${user.username}</td>
                <td style="padding: 1rem; font-family: monospace;">${user.password}</td>
                <td style="padding: 1rem;">${roleBadge}</td>
                <td style="padding: 1rem;">
                    <button class="btn btn-sm btn-danger" onclick="JhomeApp.deleteAcademyUser('${user.id}')">حذف</button>
                </td>
            </tr>
        `;
    });
  },

  addAcademyUser(e) {
    e.preventDefault();
    const fullname = document.getElementById('new-user-fullname').value;
    const role = document.getElementById('new-user-role').value;
    const base = fullname.replace(/\s+/g, '').toLowerCase();
    
    const users = this.getAcademyUsers();
    users.push({
        id: Date.now().toString(),
        fullname,
        username: base,
        password: base,
        role
    });
    this.saveAcademyUsers(users);
    document.getElementById('add-user-form').reset();
    this.renderAcademyUsers();
  },

  deleteAcademyUser(id) {
    if (confirm('حذف هذا المستخدم؟')) {
        let users = this.getAcademyUsers();
        users = users.filter(u => u.id !== id);
        this.saveAcademyUsers(users);
        this.renderAcademyUsers();
    }
  }
};

// ── Academy Form Listeners ──
document.addEventListener('DOMContentLoaded', () => {
    const addBankForm = document.getElementById('add-bank-form');
    if (addBankForm) {
        addBankForm.addEventListener('submit', (e) => JhomeApp.addAcademyAccount(e));
    }

    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) {
        addUserForm.addEventListener('submit', (e) => JhomeApp.addAcademyUser(e));
    }
});

// Initialize by loading the default tab when Jhome page opens
// We hook into the AdminApp's navigation logic
const originalNavigateTo = AdminApp.navigateTo;
AdminApp.navigateTo = function(page) {
  originalNavigateTo.call(this, page);
  if (page === 'jhome') {
    JhomeApp.showTab(JhomeApp.currentTab);
  }
};
