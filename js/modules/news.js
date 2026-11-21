/**
 * NewsModule — News Management (`news` collection)
 * Supports filtering by country, category, and source (`isAiGenerated`),
 * creating official AVYRA news articles with image upload, previewing, and deleting.
 */
(function () {
  const NewsModule = {
    allNews: [],

    initSelects() {
      const countryFilter = document.getElementById('news-country-filter');
      const modalCountry = document.getElementById('news-country');
      const catFilter = document.getElementById('news-category-filter');
      const modalCat = document.getElementById('news-category');

      if (window.AvyraCatalogs) {
        const countryOpts = AvyraCatalogs.COUNTRIES.map(c =>
          `<option value="${escapeAttr(c.code)}">${escapeHtml(c.nameAr)} (${escapeHtml(c.code)})</option>`
        ).join('');
        if (countryFilter && countryFilter.options.length <= 1) {
          countryFilter.innerHTML = `<option value="">كل الدول</option><option value="ALL">عالمي (ALL)</option>` + countryOpts;
        }
        if (modalCountry && modalCountry.options.length <= 1) {
          modalCountry.innerHTML = `<option value="SD">السودان (SD)</option><option value="ALL">عالمي (ALL)</option>` + countryOpts;
        }

        const catOpts = AvyraCatalogs.NEWS_CATEGORIES.map(cat =>
          `<option value="${escapeAttr(cat)}">${escapeHtml(cat)}</option>`
        ).join('');
        if (catFilter && catFilter.options.length <= 1) {
          catFilter.innerHTML = `<option value="">كل التصنيفات</option>` + catOpts;
        }
        if (modalCat && modalCat.options.length <= 1) {
          modalCat.innerHTML = catOpts;
        }
      }
    },

    async loadNews() {
      this.initSelects();
      const tbody = document.getElementById('news-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('news').orderBy('publishedAt', 'desc').limit(100).get();
        this.allNews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.filterNews();
      } catch (e) {
        console.error('Error loading news:', e);
        // Fallback without orderBy if index/field varies
        try {
          const fallbackSnap = await db.collection('news').limit(100).get();
          this.allNews = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.filterNews();
        } catch (err2) {
          tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:var(--danger)">خطأ في تحميل الأخبار: ${escapeHtml(err2.message)}</td></tr>`;
        }
      }
    },

    filterNews() {
      const search = (document.getElementById('news-search')?.value || '').toLowerCase();
      const country = document.getElementById('news-country-filter')?.value ||
                      (window.AdminApp?.activeCountry !== 'ALL' ? window.AdminApp?.activeCountry : '');
      const category = document.getElementById('news-category-filter')?.value || '';
      const source = document.getElementById('news-source-filter')?.value || '';

      let list = this.allNews;
      if (search) {
        list = list.filter(n =>
          (n.title || '').toLowerCase().includes(search) ||
          (n.content || '').toLowerCase().includes(search) ||
          (n.authorName || '').toLowerCase().includes(search)
        );
      }
      if (country && window.AvyraCatalogs) {
        list = list.filter(n => AvyraCatalogs.matchesCountry(n.countryCode, country, true));
      }
      if (category) {
        list = list.filter(n => (n.category || 'عام') === category);
      }
      if (source === 'ai') {
        list = list.filter(n => Boolean(n.isAiGenerated));
      } else if (source === 'official') {
        list = list.filter(n => !n.isAiGenerated);
      }

      this.renderNews(list);
    },

    renderNews(list) {
      const tbody = document.getElementById('news-tbody');
      if (!tbody) return;

      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد أخبار مطابقة للبحث</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(n => {
        const img = safeUrl(n.imageUrl);
        const dateStr = formatDateTime(n.publishedAt || n.createdAt);
        const isAi = Boolean(n.isAiGenerated);
        const likes = n.likesCount ?? (Array.isArray(n.likes) ? n.likes.length : 0);
        const comments = n.commentsCount ?? 0;

        return `
          <tr>
            <td>
              ${img
                ? `<img src="${escapeAttr(img)}" style="width:52px;height:42px;border-radius:8px;object-fit:cover;cursor:pointer;" onclick="AdminApp.previewImage('${escapeAttr(img)}')" alt="">`
                : `<div style="width:52px;height:42px;border-radius:8px;background:var(--primary-tint);display:flex;align-items:center;justify-content:center;color:var(--primary-light);font-weight:800;">AV</div>`}
            </td>
            <td>
              <strong>${escapeHtml(n.title || 'بدون عنوان')}</strong><br>
              <small style="color:var(--text-muted)">${escapeHtml(n.authorName || n.sourceName || 'إدارة AVYRA')}</small>
            </td>
            <td><span class="chip chip-primary">${escapeHtml(n.category || 'عام')}</span></td>
            <td><span class="chip">${escapeHtml(n.countryCode || 'SD')}</span></td>
            <td>
              <span class="report-status ${isAi ? 'info' : 'reviewed'}">
                ${isAi ? 'تلقائي (AI)' : 'رسمي / مجتمع'}
              </span>
            </td>
            <td>
              <small style="color:var(--text-secondary)">
                إعجاب: ${escapeHtml(likes)} | تعليق: ${escapeHtml(comments)}<br>
                ${escapeHtml(dateStr)}
              </small>
            </td>
            <td>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-sm btn-danger" onclick="NewsModule.deleteNews('${escapeAttr(n.id)}')">
                  <span class="material-icons-outlined" style="font-size:16px;">delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    },

    openCreateModal() {
      this.initSelects();
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      setVal('news-title', '');
      setVal('news-content', '');
      setVal('news-image-url', '');
      setVal('news-source-url', '');
      const fileEl = document.getElementById('news-image-file');
      if (fileEl) fileEl.value = '';

      const modal = document.getElementById('create-news-modal');
      if (modal) modal.style.display = 'flex';
    },

    async createNews(e) {
      if (e && e.preventDefault) e.preventDefault();
      const title = document.getElementById('news-title')?.value.trim() || '';
      const category = document.getElementById('news-category')?.value || 'عام';
      const countryCode = document.getElementById('news-country')?.value || 'SD';
      const content = document.getElementById('news-content')?.value.trim() || '';
      let imageUrl = document.getElementById('news-image-url')?.value.trim() || '';
      const sourceUrl = document.getElementById('news-source-url')?.value.trim() || '';
      const fileInput = document.getElementById('news-image-file');

      if (!title || !content) {
        showToast('يرجى إدخال عنوان الخبر ومحتواه', 'error');
        return;
      }

      try {
        if (fileInput && fileInput.files && fileInput.files[0] && window.AdminHelpers) {
          showToast('جاري رفع صورة الخبر...', 'info');
          imageUrl = await AdminHelpers.uploadToStorage(fileInput.files[0], 'news');
        }

        const adminUid = auth.currentUser ? auth.currentUser.uid : 'admin';
        const now = firebase.firestore.FieldValue.serverTimestamp();

        await db.collection('news').add({
          title,
          content,
          category,
          countryCode,
          imageUrl: imageUrl || '',
          sourceUrl: sourceUrl || '',
          sourceName: 'AVYRA الرسمي',
          authorId: adminUid,
          authorName: 'إدارة AVYRA',
          isAiGenerated: false,
          likes: [],
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          publishedAt: now,
          createdAt: now
        });

        showToast('تم نشر الخبر الرسمي بنجاح', 'success');
        if (window.AdminApp) AdminApp.closeModal('create-news-modal');
        await this.loadNews();
      } catch (err) {
        console.error('Error creating news:', err);
        showToast('فشل نشر الخبر: ' + err.message, 'error');
      }
    },

    async deleteNews(id) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف الخبر',
        message: 'هل أنت متأكد من حذف هذا الخبر نهائياً؟',
        confirmText: 'حذف الخبر',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('news').doc(id).delete();
        showToast('تم حذف الخبر بنجاح');
        await this.loadNews();
      } catch (e) {
        showToast('فشل الحذف: ' + e.message, 'error');
      }
    }
  };

  window.NewsModule = NewsModule;
})();
