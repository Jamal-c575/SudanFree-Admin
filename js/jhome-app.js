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

    // Load data based on tab
    if (tabId === 'blog') this.loadPosts();
    if (tabId === 'stories') this.loadStories();
    if (tabId === 'messages') this.loadMessages();
    if (tabId === 'newsletter') this.loadNewsletter();
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
      showToast('خطأ في جلب المقالات', 'error');
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
    alert('سيتم فتح محرر نصوص متقدم لإضافة مقال هنا قريباً!');
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
      showToast('خطأ في جلب القصص', 'error');
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
    alert('سيتم فتح نافذة لإضافة قصة نجاح مؤسسية قريباً!');
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
      showToast('خطأ في جلب الرسائل', 'error');
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
  }
};

// Initialize by loading the default tab when Jhome page opens
// We hook into the AdminApp's navigation logic
const originalNavigateTo = AdminApp.navigateTo;
AdminApp.navigateTo = function(page) {
  originalNavigateTo.call(this, page);
  if (page === 'jhome') {
    JhomeApp.showTab(JhomeApp.currentTab);
  }
};
