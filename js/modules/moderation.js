/**
 * ModerationModule & AdminExtras — Manages:
 * 1. General Reports (`reports`) & Review Reports (`review_reports` + `reviews` via `moderateReview` Cloud Function)
 * 2. Community Posts (`posts`)
 * 3. Service Requests (`requests`)
 * 4. Multi-Media & Country/State/Locality Targeted Ads (`ads`)
 * 5. Featured User Promotions (`promotions`)
 * 6. Work Agreements / Contracts (`collectionGroup('messages')` where `type == 'contract'`)
 */
(function () {
  const ModerationModule = {
    currentReportTab: 'general',
    allReports: [],
    reviewReports: [],
    allPosts: [],
    allRequests: [],
    allAds: [],
    allContracts: [],

    initAdSelects() {
      const adCountry = document.getElementById('ad-country');
      const adsCountryFilter = document.getElementById('ads-country-filter');
      if (window.AvyraCatalogs) {
        const countryOpts = AvyraCatalogs.COUNTRIES.map(c =>
          `<option value="${escapeAttr(c.code)}">${escapeHtml(c.nameAr)} (${escapeHtml(c.code)})</option>`
        ).join('');
        if (adCountry && adCountry.options.length <= 1) {
          adCountry.innerHTML = `<option value="ALL">كل الدول (ALL)</option>` + countryOpts;
        }
        if (adsCountryFilter && adsCountryFilter.options.length <= 1) {
          adsCountryFilter.innerHTML = `<option value="">كل الدول</option><option value="ALL">عالمي (ALL)</option>` + countryOpts;
        }
      }
      const activeCC = window.AdminApp?.activeCountry || 'ALL';
      if (adCountry && activeCC !== 'ALL' && adCountry.value === 'ALL') {
        adCountry.value = activeCC;
      }
      if (adsCountryFilter && activeCC !== 'ALL' && !adsCountryFilter.value) {
        adsCountryFilter.value = activeCC;
      }
      this.onAdCountryChange();
    },

    onAdCountryChange() {
      const country = document.getElementById('ad-country')?.value || 'ALL';
      const adRegion = document.getElementById('ad-region');
      if (!adRegion || !window.AvyraCatalogs) return;
      const regions = AvyraCatalogs.getRegionsForCountry(country === 'ALL' ? 'SD' : country);
      adRegion.innerHTML = `<option value="all">كل المناطق / الولايات</option>` +
        regions.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
      this.onAdRegionChange();
    },

    onAdRegionChange() {
      const country = document.getElementById('ad-country')?.value || 'ALL';
      const state = document.getElementById('ad-region')?.value || 'all';
      const locSel = document.getElementById('ad-locality');
      if (!locSel || !window.AvyraCatalogs) return;
      const locs = state !== 'all'
        ? AvyraCatalogs.getLocalitiesForRegion(country === 'ALL' ? 'SD' : country, state)
        : [];
      locSel.innerHTML = `<option value="">كل المحليات</option>` +
        locs.map(l => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join('');
    },

    // ── Reports & Review Reports ──
    switchReportTab(tab, btnEl) {
      this.currentReportTab = tab;
      document.querySelectorAll('#page-reports .sub-tab-btn').forEach(b => {
        const active = b.dataset.tab === tab || b === btnEl;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('#page-reports .sub-tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `reports-panel-${tab}`);
      });

      if (tab === 'general') this.loadReports();
      if (tab === 'reviews') this.loadReviewReports();
    },

    async loadReports() {
      try {
        const snap = await db.collection('reports').orderBy('createdAt', 'desc').limit(150).get();
        this.allReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.renderReports(this.allReports);

        const pending = this.allReports.filter(r => (r.status || 'pending') === 'pending').length;
        const badge = document.getElementById('reports-badge');
        if (badge) {
          badge.textContent = pending;
          badge.style.display = pending > 0 ? 'inline' : 'none';
        }

        const dashEl = document.getElementById('dashboard-recent-reports');
        if (!dashEl) return;
        if (!this.allReports.length) {
          dashEl.innerHTML = '<p class="empty-state">لا توجد بلاغات</p>';
          return;
        }
        dashEl.innerHTML = this.allReports.slice(0, 4).map(r => {
          const st = r.status || 'pending';
          const stText = st === 'reviewed' ? 'تمت المراجعة' : (st === 'dismissed' ? 'مرفوض' : 'معلق');
          return `
            <div style="padding:10px 0; border-bottom:1px solid var(--border-glass);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>بلاغ ضد: ${escapeHtml(r.reportedUserName || 'مستخدم')}</strong>
                <span class="report-status ${escapeAttr(st)}">${escapeHtml(stText)}</span>
              </div>
              <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">${escapeHtml(timeAgo(r.createdAt))}</div>
            </div>
          `;
        }).join('');
      } catch (e) {
        console.error('Error loading reports:', e);
      }
    },

    async renderReports(reports) {
      const el = document.getElementById('reports-list');
      if (!el) return;
      if (!reports || !reports.length) {
        el.innerHTML = '<p class="empty-state">لا توجد بلاغات مطابقة</p>';
        return;
      }

      const enriched = await Promise.all(reports.map(async r => {
        let reportedUser = {};
        let reporterUser = {};
        try {
          if (r.reportedUserId) {
            const uDoc = await db.collection('users').doc(r.reportedUserId).get();
            if (uDoc.exists) reportedUser = uDoc.data() || {};
          }
          if (r.reporterId) {
            const uDoc = await db.collection('users').doc(r.reporterId).get();
            if (uDoc.exists) reporterUser = uDoc.data() || {};
          }
        } catch (_) {}
        return { ...r, _reported: reportedUser, _reporter: reporterUser };
      }));

      el.innerHTML = enriched.map(r => {
        const st = r.status || 'pending';
        const stText = st === 'reviewed' ? 'تمت المراجعة' : (st === 'dismissed' ? 'مرفوض' : 'معلق');
        const imgUrl = safeUrl(r.imageUrl);

        let partiesHtml = '<div style="display:flex; flex-direction:column; gap:8px; margin:14px 0; border-top:1px solid var(--border-glass); border-bottom:1px solid var(--border-glass); padding:14px 0;">';

        if (r.reporterId) {
          const u = r._reporter || {};
          const avatar = safeUrl(u.profileImageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || r.reporterName || 'U')}&background=109B78&color=fff`;
          partiesHtml += `
            <div style="display:flex; align-items:center; gap:10px; background:rgba(16,155,120,0.1); padding:10px; border-radius:10px; border:1px solid rgba(16,155,120,0.3);">
              <div style="font-size:13px; font-weight:700; color:var(--success); width:60px; flex-shrink:0;">المُبلِّغ:</div>
              <img src="${escapeAttr(avatar)}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" alt="">
              <div style="flex:1; min-width:0;">
                <div style="font-size:14px; font-weight:700;">${escapeHtml(u.name || r.reporterName || 'مستخدم')}</div>
                <div style="font-size:13px; color:var(--text-secondary);" dir="ltr">${escapeHtml(u.phoneNumber || u.email || '')}</div>
              </div>
              <button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(r.reporterId)}')">ملف</button>
            </div>
          `;
        }

        if (r.reportedUserId) {
          const u = r._reported || {};
          const avatar = safeUrl(u.profileImageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || r.reportedUserName || 'U')}&background=D94A58&color=fff`;
          partiesHtml += `
            <div style="display:flex; align-items:center; gap:10px; background:rgba(217,74,88,0.1); padding:10px; border-radius:10px; border:1px solid rgba(217,74,88,0.3);">
              <div style="font-size:13px; font-weight:700; color:var(--danger); width:60px; flex-shrink:0;">المُبلَّغ عنه:</div>
              <img src="${escapeAttr(avatar)}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" alt="">
              <div style="flex:1; min-width:0;">
                <div style="font-size:14px; font-weight:700;">${escapeHtml(u.name || r.reportedUserName || 'مستخدم')}</div>
                <div style="font-size:13px; color:var(--text-secondary);" dir="ltr">${escapeHtml(u.phoneNumber || u.email || '')}</div>
              </div>
              <button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(r.reportedUserId)}')">ملف</button>
            </div>
          `;
        }
        partiesHtml += '</div>';

        return `
          <div class="verify-card" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h4 style="margin:0; font-size:15px; display:flex; align-items:center; gap:8px;">
                <span class="material-icons-outlined" style="color:var(--danger)">gavel</span>
                تفاصيل البلاغ
              </h4>
              <span class="report-status ${escapeAttr(st)}">${escapeHtml(stText)}</span>
            </div>
            <div class="verify-card-body" style="padding:0;">
              <p style="margin:0 0 6px; font-size:14px;"><strong>السبب:</strong> ${escapeHtml(r.reason || 'لا توجد تفاصيل')}</p>
              <p style="margin:0; color:var(--text-muted); font-size:13px;">${escapeHtml(timeAgo(r.createdAt))}</p>
              ${imgUrl ? `<div style="margin-top:10px;"><img src="${escapeAttr(imgUrl)}" onclick="AdminApp.previewImage('${escapeAttr(imgUrl)}')" style="max-width:100%; max-height:180px; border-radius:8px; cursor:pointer;" alt=""></div>` : ''}
            </div>
            ${partiesHtml}
            <div class="verify-card-actions" style="padding:10px 0 0; background:transparent; border-top:none;">
              ${st === 'pending' ? `
                <button class="btn btn-sm btn-success" onclick="AdminApp.updateReport('${escapeAttr(r.id)}','reviewed')"><span class="material-icons-outlined">check</span> تمت المراجعة</button>
                <button class="btn btn-sm btn-danger" onclick="AdminApp.updateReport('${escapeAttr(r.id)}','dismissed')"><span class="material-icons-outlined">close</span> رفض</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    },

    filterReports() {
      const status = document.getElementById('reports-status-filter')?.value || '';
      const search = (document.getElementById('reports-search')?.value || '').toLowerCase();
      let filtered = this.allReports;
      if (status) filtered = filtered.filter(r => (r.status || 'pending') === status);
      if (search) {
        filtered = filtered.filter(r =>
          (r.reportedUserName || '').toLowerCase().includes(search) ||
          (r.reporterName || '').toLowerCase().includes(search) ||
          (r.reason || '').toLowerCase().includes(search)
        );
      }
      this.renderReports(filtered);
    },

    async updateReport(id, status) {
      try {
        await db.collection('reports').doc(id).update({
          status,
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('تم تحديث حالة البلاغ');
        await this.loadReports();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    // ── Review Reports (`review_reports` + `moderateReview` Cloud Function) ──
    async loadReviewReports() {
      const tbody = document.getElementById('review-reports-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('review_reports').limit(100).get();
        const rawReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const enriched = await Promise.all(rawReports.map(async rep => {
          let review = {};
          if (rep.reviewId) {
            try {
              const rDoc = await db.collection('reviews').doc(rep.reviewId).get();
              if (rDoc.exists) review = rDoc.data() || {};
            } catch (_) {}
          }
          return { ...rep, _review: review };
        }));

        this.reviewReports = enriched;
        if (!enriched.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد بلاغات تقييمات حالياً</td></tr>';
          return;
        }

        tbody.innerHTML = enriched.map(rep => {
          const rev = rep._review || {};
          const isHidden = Boolean(rev.isHidden);
          const rating = rev.rating || '—';
          const comment = rev.comment || rep.reviewText || '—';

          return `
            <tr>
              <td><strong>${escapeHtml(rev.reviewerName || 'مستخدم')}</strong></td>
              <td><span class="chip">${escapeHtml(rating)} / 5</span> ${escapeHtml(comment)}</td>
              <td>${escapeHtml(rep.reason || 'محتوى مسيء')}</td>
              <td>
                <span class="report-status ${isHidden ? 'warning' : 'reviewed'}">
                  ${isHidden ? 'مخفي' : 'ظاهر'}
                </span>
              </td>
              <td>${escapeHtml(timeAgo(rep.createdAt))}</td>
              <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  ${rep.reviewId ? `
                    <button class="btn btn-sm btn-warning" onclick="ModerationModule.moderateReview('${escapeAttr(rep.reviewId)}', '${isHidden ? 'unhide' : 'hide'}')">
                      ${isHidden ? 'إظهار التقييم' : 'إخفاء التقييم'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="ModerationModule.moderateReview('${escapeAttr(rep.reviewId)}', 'delete')">
                      حذف التقييم
                    </button>
                  ` : '<span style="color:var(--text-muted)">محذوف</span>'}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        console.error('Error loading review_reports:', e);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    async moderateReview(reviewId, action) {
      const actionLabels = { hide: 'إخفاء هذا التقييم', unhide: 'إعادة إظهار هذا التقييم', delete: 'حذف هذا التقييم نهائياً' };
      const confirmed = await AdminDialog.confirm({
        title: 'إدارة التقييم',
        message: `هل أنت متأكد من ${actionLabels[action] || action}؟`,
        confirmText: 'تأكيد',
        danger: action === 'delete'
      });
      if (!confirmed) return;

      try {
        // CRITICAL: firestore.rules forbids client writes to `reviews`; use `moderateReview` Cloud Function
        const fn = functions.httpsCallable('moderateReview');
        await fn({ reviewId, action });
        showToast('تم تنفيذ الإجراء على التقييم بنجاح', 'success');
        await this.loadReviewReports();
      } catch (e) {
        console.error('Error calling moderateReview:', e);
        showToast('فشل تنفيذ الإجراء عبر الخادم: ' + e.message, 'error');
      }
    },

    // ── Posts Management (`posts`) ──
    async loadPosts() {
      const el = document.getElementById('posts-list');
      if (!el) return;
      el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
      try {
        const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(100).get();
        this.allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.renderPosts(this.allPosts);
      } catch (e) {
        console.error('Error loading posts:', e);
        el.innerHTML = `<p class="empty-state" style="color:var(--danger)">خطأ في التحميل: ${escapeHtml(e.message)}</p>`;
      }
    },

    renderPosts(posts) {
      const countEl = document.getElementById('posts-count');
      if (countEl) countEl.textContent = `عرض ${posts.length} منشور`;
      const el = document.getElementById('posts-list');
      if (!el) return;
      if (!posts.length) {
        el.innerHTML = '<p class="empty-state">لا توجد منشورات</p>';
        return;
      }

      el.innerHTML = posts.map(p => {
        const avatar = safeUrl(p.userImage) || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.userName || 'U')}&background=104D9E&color=fff`;
        const images = (Array.isArray(p.imageUrls) ? p.imageUrls : []).map(u => safeUrl(u)).filter(Boolean);
        return `
          <div class="post-item">
            <div class="post-header">
              <div class="post-user-info">
                <img src="${escapeAttr(avatar)}" alt="">
                <div>
                  <div class="name">${escapeHtml(p.userName || 'مستخدم')}</div>
                  <div class="meta">${escapeHtml(p.state || '')} ${p.locality ? '— ' + escapeHtml(p.locality) : ''} · ${escapeHtml(timeAgo(p.createdAt))}</div>
                </div>
              </div>
              ${p.isPinned ? '<span class="report-status reviewed">مثبت</span>' : ''}
            </div>
            <div class="post-body">${escapeHtml((p.content || '').substring(0, 260))}${(p.content || '').length > 260 ? '...' : ''}</div>
            ${images.length ? `<div class="post-images">${images.map(url => `<img src="${escapeAttr(url)}" onclick="AdminApp.previewImage('${escapeAttr(url)}')" alt="">`).join('')}</div>` : ''}
            <div class="post-stats">
              <span><span class="material-icons-outlined" style="font-size:15px">favorite</span> ${escapeHtml(p.likesCount || (p.likes ? p.likes.length : 0))}</span>
              <span><span class="material-icons-outlined" style="font-size:15px">comment</span> ${escapeHtml(p.commentsCount || 0)}</span>
              <span><span class="material-icons-outlined" style="font-size:15px">share</span> ${escapeHtml(p.sharesCount || 0)}</span>
            </div>
            <div class="post-actions">
              <button class="btn btn-sm ${p.isPinned ? 'btn-warning' : 'btn-ghost'}" onclick="AdminExtras.togglePinPost('${escapeAttr(p.id)}', ${!p.isPinned})">
                <span class="material-icons-outlined" style="font-size:16px">push_pin</span>${p.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
              </button>
              <button class="btn btn-sm btn-danger" onclick="AdminExtras.deletePost('${escapeAttr(p.id)}')">
                <span class="material-icons-outlined" style="font-size:16px">delete</span>حذف
              </button>
            </div>
          </div>
        `;
      }).join('');
    },

    filterPosts() {
      const search = (document.getElementById('posts-search')?.value || '').toLowerCase();
      const filter = document.getElementById('posts-filter')?.value || '';
      const activeCC = window.AdminApp?.activeCountry || 'ALL';
      let filtered = this.allPosts;
      if (activeCC !== 'ALL' && window.AvyraCatalogs) {
        filtered = filtered.filter(p => {
          const postCC = p.geoScope?.marketCountry || p.countryCode || 'SD';
          return AvyraCatalogs.matchesCountry(postCC, activeCC);
        });
      }
      if (search) {
        filtered = filtered.filter(p =>
          (p.content || p.caption || '').toLowerCase().includes(search) ||
          (p.userName || '').toLowerCase().includes(search)
        );
      }
      if (filter === 'pinned') filtered = filtered.filter(p => p.isPinned);
      if (filter === 'reported') filtered = filtered.filter(p => (p.reportCount || 0) > 0);
      this.renderPosts(filtered);
    },

    async togglePinPost(id, pin) {
      try {
        await db.collection('posts').doc(id).update({ isPinned: pin });
        showToast(pin ? 'تم تثبيت المنشور' : 'تم إلغاء التثبيت');
        await this.loadPosts();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    async deletePost(id) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف المنشور',
        message: 'هل أنت متأكد من حذف هذا المنشور نهائياً؟',
        confirmText: 'حذف المنشور',
        danger: true
      });
      if (!confirmed) return;

      try {
        const comments = await db.collection('posts').doc(id).collection('comments').get();
        const batch = db.batch();
        comments.docs.forEach(d => batch.delete(d.ref));
        batch.delete(db.collection('posts').doc(id));
        await batch.commit();
        showToast('تم حذف المنشور');
        await this.loadPosts();
      } catch (e) {
        showToast('فشل حذف المنشور: ' + e.message, 'error');
      }
    },

    // ── Service Requests (`requests`) ──
    async loadRequests() {
      const el = document.getElementById('requests-list');
      if (!el) return;
      el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
      try {
        const snap = await db.collection('requests').orderBy('createdAt', 'desc').limit(100).get();
        this.allRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.renderRequests(this.allRequests);
      } catch (e) {
        el.innerHTML = `<p class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</p>`;
      }
    },

    renderRequests(requests) {
      const countEl = document.getElementById('requests-count');
      if (countEl) countEl.textContent = `عرض ${requests.length} طلب`;
      const el = document.getElementById('requests-list');
      if (!el) return;
      if (!requests.length) {
        el.innerHTML = '<p class="empty-state">لا توجد طلبات خدمة</p>';
        return;
      }

      el.innerHTML = requests.map(r => {
        const st = r.status || 'active';
        return `
          <div class="request-item">
            <div class="request-header">
              <div>
                <div class="report-reason">${escapeHtml(r.title || 'طلب خدمة')}</div>
                <div class="report-meta">بواسطة: ${escapeHtml(r.userName || '—')} · ${escapeHtml(r.category || '')} · ${escapeHtml(r.state || '')} · ${escapeHtml(timeAgo(r.createdAt))}</div>
              </div>
              <span class="report-status ${escapeAttr(st)}">${st === 'active' ? 'نشط' : (st === 'fulfilled' ? 'مكتمل' : escapeHtml(st))}</span>
            </div>
            <div class="request-body">${escapeHtml((r.description || '').substring(0, 220))}</div>
            <div class="post-stats">
              <span>الميزانية: ${r.budget ? escapeHtml(r.budget) + ' ج.س' : 'غير محددة'}</span>
              <span>العروض: ${escapeHtml(r.proposalsCount || 0)}</span>
            </div>
            <div class="post-actions">
              <button class="btn btn-sm btn-danger" onclick="AdminExtras.deleteRequest('${escapeAttr(r.id)}')">
                <span class="material-icons-outlined" style="font-size:16px">delete</span>حذف
              </button>
            </div>
          </div>
        `;
      }).join('');
    },

    filterRequests() {
      const search = (document.getElementById('requests-search')?.value || '').toLowerCase();
      const filter = document.getElementById('requests-filter')?.value || '';
      const activeCC = window.AdminApp?.activeCountry || 'ALL';
      let filtered = this.allRequests;
      if (activeCC !== 'ALL' && window.AvyraCatalogs) {
        filtered = filtered.filter(r => AvyraCatalogs.matchesCountry(r.countryCode, activeCC));
      }
      if (search) {
        filtered = filtered.filter(r =>
          (r.title || '').toLowerCase().includes(search) ||
          (r.description || r.text || '').toLowerCase().includes(search)
        );
      }
      if (filter) filtered = filtered.filter(r => (r.status || 'active') === filter);
      this.renderRequests(filtered);
    },

    async deleteRequest(id) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف طلب الخدمة',
        message: 'هل أنت متأكد من حذف هذا الطلب نهائياً؟',
        confirmText: 'حذف الطلب',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('requests').doc(id).delete();
        showToast('تم حذف الطلب');
        await this.loadRequests();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    // ── Ads Management (`ads`) ──
    PLACEMENT_NAMES: {
      homeBanner: 'بانر الرئيسية',
      communityFeed: 'تغذية المجتمع',
      both: 'الرئيسية والمجتمع',
      featuredService: 'خدمة مميزة',
      featuredShop: 'متجر مميز',
      strip: 'شريط إعلاني'
    },

    async loadAds() {
      this.initAdSelects();
      const el = document.getElementById('ads-list');
      if (!el) return;
      el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
      try {
        const snap = await db.collection('ads').orderBy('createdAt', 'desc').get();
        this.allAds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.renderAds(this.allAds);
      } catch (e) {
        el.innerHTML = `<p class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</p>`;
      }
    },

    renderAds(ads) {
      const el = document.getElementById('ads-list');
      if (!el) return;
      if (!ads.length) {
        el.innerHTML = '<p class="empty-state">لا توجد إعلانات</p>';
        return;
      }

      el.innerHTML = ads.map(a => {
        const isExpired = a.expiryDate && (a.expiryDate.toDate ? a.expiryDate.toDate() : new Date(a.expiryDate)) < new Date();
        const statusText = !a.isActive ? 'معطل' : (isExpired ? 'منتهي' : 'نشط');
        const statusClass = a.isActive && !isExpired ? 'reviewed' : 'dismissed';
        const placementLabel = this.PLACEMENT_NAMES[a.placement] || a.placement || 'بانر الرئيسية';
        const imgUrl = safeUrl(a.imageUrl);

        return `
          <div class="ad-item">
            ${imgUrl ? `<img src="${escapeAttr(imgUrl)}" alt="" onerror="this.style.display='none'">` : ''}
            <div class="ad-info">
              <h4>${escapeHtml(a.title)} ${a.advertiserName ? `<small style="color:var(--text-muted)">(${escapeHtml(a.advertiserName)})</small>` : ''}</h4>
              <p>${escapeHtml(a.description || '')}</p>
              <div class="ad-meta">
                <span>${escapeHtml(placementLabel)}</span>
                <span>الدولة: ${escapeHtml(a.targetCountry || 'ALL')}</span>
                <span>المنطقة: ${a.targetState === 'all' || !a.targetState ? 'الكل' : escapeHtml(a.targetState)}${a.targetLocality ? ' - ' + escapeHtml(a.targetLocality) : ''}</span>
                <span>الأولوية: ${escapeHtml(a.priority || 5)}</span>
                <span>مشاهدات: ${escapeHtml(a.impressions || 0)} | نقرات: ${escapeHtml(a.clicks || 0)}</span>
                <span class="report-status ${statusClass}">${statusText}</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <button class="btn btn-sm ${a.isActive ? 'btn-warning' : 'btn-success'}" onclick="AdminExtras.toggleAd('${escapeAttr(a.id)}', ${!a.isActive})">${a.isActive ? 'تعطيل' : 'تفعيل'}</button>
              <button class="btn btn-sm btn-danger" onclick="AdminExtras.deleteAd('${escapeAttr(a.id)}')">حذف</button>
            </div>
          </div>
        `;
      }).join('');
    },

    filterAds() {
      const placement = document.getElementById('ads-placement-filter')?.value || '';
      const country = document.getElementById('ads-country-filter')?.value ||
                      (window.AdminApp?.activeCountry !== 'ALL' ? window.AdminApp?.activeCountry : '');
      let filtered = this.allAds;
      if (placement) filtered = filtered.filter(a => a.placement === placement);
      if (country && window.AvyraCatalogs) {
        filtered = filtered.filter(a => AvyraCatalogs.matchesCountry(a.targetCountry, country, true));
      }
      this.renderAds(filtered);
    },

    async createAd() {
      const title = document.getElementById('ad-title')?.value.trim() || '';
      const desc = document.getElementById('ad-description')?.value.trim() || '';
      const advertiser = document.getElementById('ad-advertiser')?.value.trim() || '';
      const link = document.getElementById('ad-link')?.value.trim() || '';
      const placement = document.getElementById('ad-placement')?.value || 'homeBanner';
      const mediaType = document.getElementById('ad-media-type')?.value || 'image';
      const targetCountry = document.getElementById('ad-country')?.value || 'ALL';
      const region = document.getElementById('ad-region')?.value || 'all';
      const locality = document.getElementById('ad-locality')?.value || '';
      const prof = document.getElementById('ad-profession')?.value || 'all';
      const category = document.getElementById('ad-category')?.value || 'all';
      const priority = parseInt(document.getElementById('ad-priority')?.value, 10) || 5;
      const expiry = document.getElementById('ad-expiry')?.value || '';

      const fileInput = document.getElementById('ad-file-upload');
      let imageUrl = document.getElementById('ad-image')?.value.trim() || '';

      if (!title || !expiry) {
        showToast('يرجى ملء عنوان الإعلان وتاريخ الانتهاء', 'error');
        return;
      }
      if ((!fileInput || !fileInput.files.length) && !imageUrl) {
        showToast('يرجى اختيار صورة/فيديو أو وضع رابط مباشر', 'error');
        return;
      }

      try {
        const uploadedUrls = [];
        if (fileInput && fileInput.files.length > 0) {
          showToast(`جاري رفع ${fileInput.files.length} ملف...`, 'info');
          for (let i = 0; i < fileInput.files.length; i++) {
            const file = fileInput.files[i];
            const storageRef = storage.ref(`ads/${Date.now()}_${i}_${file.name}`);
            const uploadTask = await storageRef.put(file);
            const url = await uploadTask.ref.getDownloadURL();
            uploadedUrls.push(url);
          }
          imageUrl = uploadedUrls[0];
        } else if (imageUrl) {
          uploadedUrls.push(imageUrl);
        }

        const placements = placement === 'both' ? ['homeBanner', 'communityFeed'] : [placement];
        for (const pl of placements) {
          await db.collection('ads').add({
            title,
            description: desc,
            advertiserName: advertiser,
            imageUrl,
            imageUrls: uploadedUrls,
            linkUrl: link,
            placement: pl,
            mediaType,
            targetCountry,
            targetState: region,
            targetLocality: locality,
            targetRole: prof,
            targetCategory: category,
            priority,
            isActive: true,
            impressions: 0,
            clicks: 0,
            expiryDate: firebase.firestore.Timestamp.fromDate(new Date(expiry)),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        showToast('تم إنشاء الإعلان بنجاح', 'success');

        const sendNotif = await AdminDialog.confirm({
          title: 'إرسال إشعار بالإعلان',
          message: 'هل تود إرسال إشعار (Push Notification) للمستخدمين المستهدفين بهذا الإعلان؟',
          confirmText: 'إرسال إشعار',
          cancelText: 'لا، شكراً'
        });

        if (sendNotif) {
          try {
            const sendBulkNotif = functions.httpsCallable('adminSendNotification');
            const result = await sendBulkNotif({
              title: 'إعلان جديد في AVYRA',
              message: title,
              targetCountry: targetCountry || 'all',
              targetRole: prof,
              targetState: region,
              targetLocality: locality || 'all'
            });
            showToast(`تم إرسال الإشعار إلى ${result?.data?.matchedUsers || 0} مستخدم`, 'success');
          } catch (err) {
            showToast('خطأ في إرسال الإشعار: ' + err.message, 'error');
          }
        }

        ['ad-title', 'ad-description', 'ad-advertiser', 'ad-image', 'ad-link', 'ad-expiry'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        if (fileInput) fileInput.value = '';
        await this.loadAds();
      } catch (e) {
        console.error(e);
        showToast('خطأ أثناء رفع الإعلان: ' + e.message, 'error');
      }
    },

    async toggleAd(id, active) {
      try {
        await db.collection('ads').doc(id).update({ isActive: active });
        showToast(active ? 'تم تفعيل الإعلان' : 'تم تعطيل الإعلان');
        await this.loadAds();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    async deleteAd(id) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف الإعلان',
        message: 'هل أنت متأكد من حذف هذا الإعلان نهائياً؟',
        confirmText: 'حذف الإعلان',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('ads').doc(id).delete();
        showToast('تم حذف الإعلان');
        await this.loadAds();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    // ── Promotions (`promotions`) ──
    async loadPromotions() {
      const container = document.getElementById('promotions-list');
      if (!container) return;
      container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
      try {
        const now = new Date();
        const snap = await db.collection('promotions').orderBy('createdAt', 'desc').get();
        if (snap.empty) {
          container.innerHTML = '<p class="empty-state">لا توجد ترويجات حالياً</p>';
          return;
        }
        const promos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const htmls = [];
        for (const p of promos) {
          let user = {};
          try {
            if (p.userId) {
              const userDoc = await db.collection('users').doc(p.userId).get();
              if (userDoc.exists) user = userDoc.data() || {};
            }
          } catch (_) {}

          const endDate = p.expiryDate?.toDate ? p.expiryDate.toDate() : new Date(p.expiryDate || p.createdAt);
          const isActive = endDate > now;
          const statusClass = isActive ? 'reviewed' : 'dismissed';
          const statusText = isActive ? 'نشط' : 'منتهي';
          const endStr = isNaN(endDate.getTime()) ? '—' : endDate.toLocaleDateString('ar-EG');

          const userName = user.name || user.username || p.userName || 'مستخدم';
          const userImage = safeUrl(user.profileImageUrl || p.userImage) || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=104D9E&color=fff`;
          const userProf = ROLE_NAMES[user.role] || user.jobTitle || user.role || p.userProfession || '';
          const userLoc = user.state || p.userLocation || '';
          const rating = typeof user.rating === 'number' ? user.rating : (p.userRating || 0);

          htmls.push(`
            <div class="promo-card">
              <div class="promo-card-header">
                <img src="${escapeAttr(userImage)}" alt="">
                <div class="promo-card-info">
                  <h4>${escapeHtml(userName)}</h4>
                  <p>${escapeHtml(userProf)} — ${escapeHtml(userLoc)}</p>
                </div>
                <span class="report-status ${statusClass}" style="margin-right:auto;">${statusText}</span>
              </div>
              <div class="promo-card-body">
                <div class="promo-text">"${escapeHtml(p.promoText || p.promotionText || '')}"</div>
                <div class="promo-meta">
                  <span><span class="material-icons-outlined" style="font-size:15px;">calendar_today</span> ينتهي: ${escapeHtml(endStr)}</span>
                  <span><span class="material-icons-outlined" style="font-size:15px;">star</span> التقييم: ${escapeHtml(Number(rating).toFixed(1))}</span>
                </div>
              </div>
              <div class="promo-card-actions">
                <button class="btn btn-sm btn-danger" onclick="AdminApp.deletePromotion('${escapeAttr(p.id)}')">
                  <span class="material-icons-outlined">delete</span> حذف
                </button>
              </div>
            </div>
          `);
        }
        container.innerHTML = htmls.join('');
      } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:var(--danger)">خطأ في تحميل الترويجات: ${escapeHtml(e.message)}</p>`;
      }
    },

    async deletePromotion(id) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف الترويج',
        message: 'هل أنت متأكد من حذف هذا الترويج؟',
        confirmText: 'حذف',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('promotions').doc(id).delete();
        showToast('تم حذف الترويج بنجاح');
        await this.loadPromotions();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    // ── Contracts (`collectionGroup('messages')`) ──
    async loadContracts() {
      const container = document.getElementById('contracts-list');
      if (!container) return;
      container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
      try {
        const snap = await db.collectionGroup('messages')
          .where('type', '==', 'contract')
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();

        if (snap.empty) {
          container.innerHTML = '<p class="empty-state">لا توجد عقود حتى الآن</p>';
          return;
        }

        const enriched = await Promise.all(snap.docs.map(async doc => {
          const d = doc.data();
          const parties = [];
          try {
            const chatDoc = await doc.ref.parent.parent.get();
            if (chatDoc && chatDoc.exists) {
              const participants = chatDoc.data().participants || [];
              for (const uid of participants) {
                const uDoc = await db.collection('users').doc(uid).get();
                if (uDoc.exists) parties.push({ id: uid, ...uDoc.data() });
              }
            }
          } catch (_) {}
          return { id: doc.id, ...d, _parties: parties };
        }));

        this.allContracts = enriched;
        this.renderContracts(this.allContracts);
      } catch (e) {
        container.innerHTML = `<p class="empty-state" style="color:var(--danger)">خطأ في تحميل العقود: ${escapeHtml(e.message)}</p>`;
      }
    },

    renderContracts(contracts) {
      const container = document.getElementById('contracts-list');
      if (!container) return;
      if (!contracts || !contracts.length) {
        container.innerHTML = '<p class="empty-state">لا توجد عقود مطابقة للبحث</p>';
        return;
      }

      const STATUS_NAMES = {
        pending: 'معلق',
        accepted: 'مقبول',
        active: 'نشط',
        ongoing: 'جاري التنفيذ',
        completed: 'مكتمل',
        cancelled: 'ملغي',
        rejected: 'مرفوض'
      };

      container.innerHTML = contracts.map(d => {
        const status = d.contractStatus || d.status || 'pending';
        const statusClass = ['active', 'accepted', 'ongoing'].includes(status)
          ? 'active'
          : (status === 'completed' ? 'completed' : 'cancelled');
        const date = formatDateTime(d.createdAt);
        const details = String(d.contractDetails || d.title || d.serviceType || 'عقد عمل');
        const displayTitle = details.length > 55 ? details.substring(0, 55) + '...' : details;
        const price = d.contractPrice ?? d.agreedPrice ?? d.totalAmount ?? d.price ?? 'غير محدد';
        const currency = d.currency || 'SDG';

        let partiesHtml = '';
        if (Array.isArray(d._parties) && d._parties.length > 0) {
          partiesHtml = `<div style="display:flex; flex-direction:column; gap:8px; margin-top:14px; border-top:1px solid var(--border-glass); padding-top:14px;">` +
            d._parties.map(p => {
              const avatar = safeUrl(p.profileImageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || 'U')}&background=104D9E&color=fff`;
              const roleName = ROLE_NAMES[p.role] || p.role || '';
              return `
                <div style="display:flex; align-items:center; gap:10px; background:var(--bg-surface-2); padding:10px; border-radius:8px; border:1px solid var(--border-glass);">
                  <img src="${escapeAttr(avatar)}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--primary-light);" alt="">
                  <div style="flex:1; min-width:0;">
                    <div style="font-size:14px; font-weight:700;">
                      ${escapeHtml(p.name || 'مستخدم')}
                      ${p.isVerified ? ' <span class="material-icons-outlined verified-badge" style="font-size:15px;">verified</span>' : ''}
                    </div>
                    <div style="font-size:13px; color:var(--text-secondary);">${escapeHtml(roleName)}</div>
                  </div>
                  <button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(p.id)}')">ملف</button>
                </div>
              `;
            }).join('') + `</div>`;
        }

        return `
          <div class="contract-item">
            <div class="contract-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="material-icons-outlined" style="color:var(--primary-light)">handshake</span>
                <strong title="${escapeAttr(details)}">${escapeHtml(displayTitle)}</strong>
              </div>
              <span class="contract-status ${statusClass}">${escapeHtml(STATUS_NAMES[status] || status)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;color:var(--text-secondary);font-size:13px;">
              <span>المبلغ: <strong>${escapeHtml(price)} ${escapeHtml(currency)}</strong></span>
              <span>${escapeHtml(date)}</span>
            </div>
            ${partiesHtml}
          </div>
        `;
      }).join('');
    },

    filterContracts() {
      const q = (document.getElementById('contracts-search')?.value || '').toLowerCase();
      if (!q) {
        this.renderContracts(this.allContracts);
        return;
      }
      const filtered = (this.allContracts || []).filter(c => {
        if (String(c.contractDetails || c.title || '').toLowerCase().includes(q)) return true;
        if (!c._parties) return false;
        return c._parties.some(p => (p.name || '').toLowerCase().includes(q));
      });
      this.renderContracts(filtered);
    }
  };

  window.ModerationModule = ModerationModule;
  window.AdminExtras = ModerationModule;
})();
