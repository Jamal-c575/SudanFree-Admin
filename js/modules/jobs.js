/**
 * JobsModule — Comprehensive Management for:
 * 1. Projects & Jobs (`jobs`) — Filter by Country, Status (`open`, `inProgress`, `completed`, `cancelled`), Search, Update Status, Delete
 * 2. Freelancer Proposals (`proposals`) — View proposals, status, cover letter, and link to job/freelancer
 * 3. Active 24h Stories (`stories`) — View user stories by country, preview media, and delete
 * 4. Job Payments / Escrow (`payments`) — Monitor project payment transactions and update status
 */
(function () {
  const JobsModule = {
    currentTab: 'jobs',
    allJobs: [],
    allProposals: [],
    allStories: [],
    allPayments: [],

    initSelects() {
      const countrySel = document.getElementById('jobs-country-filter');
      if (countrySel && countrySel.options.length <= 1 && window.AvyraCatalogs) {
        countrySel.innerHTML = `<option value="">كل الدول</option>` +
          AvyraCatalogs.COUNTRIES.map(c =>
            `<option value="${escapeAttr(c.code)}">${escapeHtml(c.nameAr)} (${escapeHtml(c.code)})</option>`
          ).join('');
      }
      const activeCC = window.AdminApp?.activeCountry || 'ALL';
      if (countrySel && activeCC !== 'ALL') {
        countrySel.value = activeCC;
      }
    },

    switchTab(tab, btnEl) {
      this.currentTab = tab;
      document.querySelectorAll('#page-jobs .sub-tab-btn').forEach(b => {
        const active = b.dataset.tab === tab || b === btnEl;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('#page-jobs .sub-tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `jobs-panel-${tab}`);
      });

      if (tab === 'jobs') this.loadJobs();
      if (tab === 'proposals') this.loadProposals();
      if (tab === 'stories') this.loadStories();
      if (tab === 'payments') this.loadPayments();
    },

    async loadAll() {
      this.initSelects();
      await this.loadJobs();
    },

    // ── Sub-Tab 1: Jobs (`jobs`) ──
    async loadJobs() {
      this.initSelects();
      const tbody = document.getElementById('jobs-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        let snap;
        try {
          snap = await db.collection('jobs').orderBy('createdAt', 'desc').limit(100).get();
        } catch (_) {
          snap = await db.collection('jobs').limit(100).get();
        }
        this.allJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.filterJobs();
      } catch (e) {
        console.error('Error loading jobs:', e);
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:var(--danger)">خطأ في تحميل المشاريع: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    filterJobs() {
      const search = (document.getElementById('jobs-search')?.value || '').toLowerCase();
      const country = document.getElementById('jobs-country-filter')?.value ||
                      (window.AdminApp?.activeCountry !== 'ALL' ? window.AdminApp?.activeCountry : '');
      const status = document.getElementById('jobs-status-filter')?.value || '';

      let list = this.allJobs;
      if (country && window.AvyraCatalogs) {
        list = list.filter(j => AvyraCatalogs.matchesCountry(j.countryCode, country));
      }
      if (status) {
        list = list.filter(j => (j.status || 'open') === status);
      }
      if (search) {
        list = list.filter(j =>
          (j.title || '').toLowerCase().includes(search) ||
          (j.description || '').toLowerCase().includes(search) ||
          (j.clientName || '').toLowerCase().includes(search) ||
          (j.assignedFreelancerName || '').toLowerCase().includes(search)
        );
      }
      this.renderJobs(list);
    },

    renderJobs(list) {
      const tbody = document.getElementById('jobs-tbody');
      if (!tbody) return;

      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد مشاريع أو وظائف مطابقة للفلتر الحالي</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(j => {
        const meta = window.AvyraCatalogs
          ? AvyraCatalogs.getJobStatusMeta(j.status)
          : { labelAr: j.status || 'مفتوح', badgeClass: 'info' };
        const budget = j.budgetMax
          ? `${j.budgetMin || 0} - ${j.budgetMax} ${j.currency || 'SDG'}`
          : `${j.budgetMin || j.budget || 0} ${j.currency || 'SDG'}`;
        const dateStr = formatDateTime(j.createdAt);

        return `
          <tr>
            <td>
              <strong>${escapeHtml(j.title || 'مشروع بدون عنوان')}</strong>
              ${j.isUrgent ? ' <span class="report-status rejected" style="font-size:12px;">عاجل</span>' : ''}
              <br><small style="color:var(--text-muted)">${escapeHtml((j.description || '').substring(0, 70))}</small>
            </td>
            <td>
              <strong>${escapeHtml(j.clientName || 'عميل')}</strong>
              ${j.assignedFreelancerName ? `<br><small style="color:var(--primary-light)">المنفذ: ${escapeHtml(j.assignedFreelancerName)}</small>` : ''}
            </td>
            <td><span class="chip">${escapeHtml(j.countryCode || 'SD')}</span> ${escapeHtml(j.category || 'عام')}</td>
            <td><strong>${escapeHtml(budget)}</strong><br><small style="color:var(--text-muted)">العروض: ${escapeHtml(j.proposalsCount || 0)}</small></td>
            <td><span class="report-status ${escapeAttr(meta.badgeClass)}">${escapeHtml(meta.labelAr)}</span></td>
            <td>${escapeHtml(dateStr)}</td>
            <td>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${j.clientId ? `<button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(j.clientId)}')">العميل</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="JobsModule.deleteJob('${escapeAttr(j.id)}')">
                  <span class="material-icons-outlined" style="font-size:16px;">delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    },

    async deleteJob(jobId) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف المشروع',
        message: 'هل أنت متأكد من حذف هذا المشروع نهائياً؟',
        confirmText: 'حذف المشروع',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('jobs').doc(jobId).delete();
        showToast('تم حذف المشروع بنجاح');
        await this.loadJobs();
      } catch (e) {
        showToast('فشل الحذف: ' + e.message, 'error');
      }
    },

    // ── Sub-Tab 2: Proposals (`proposals`) ──
    async loadProposals() {
      const tbody = document.getElementById('proposals-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('proposals').limit(100).get();
        this.allProposals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.allProposals.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        if (!this.allProposals.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد عروض مقدمة على المشاريع حالياً</td></tr>';
          return;
        }

        tbody.innerHTML = this.allProposals.map(p => {
          const st = p.status || 'pending';
          const stText = st === 'accepted' ? 'مقبول' : (st === 'rejected' ? 'مرفوض' : 'قيد الانتظار');
          const stClass = st === 'accepted' ? 'reviewed' : (st === 'rejected' ? 'rejected' : 'pending');

          return `
            <tr>
              <td><strong>${escapeHtml(p.freelancerName || 'مستقل')}</strong></td>
              <td><div style="max-width:340px;">${escapeHtml((p.coverLetter || '').substring(0, 120))}</div></td>
              <td><strong>${escapeHtml(p.bidAmount || p.price || 0)} ${escapeHtml(p.currency || 'SDG')}</strong></td>
              <td><span class="report-status ${stClass}">${escapeHtml(stText)}</span></td>
              <td>${escapeHtml(formatDateTime(p.createdAt))}</td>
              <td>
                ${p.freelancerId ? `<button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(p.freelancerId)}')">ملف المستقل</button>` : '—'}
              </td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    // ── Sub-Tab 3: Stories (`stories`) ──
    async loadStories() {
      const el = document.getElementById('stories-grid');
      if (!el) return;
      el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

      try {
        const snap = await db.collection('stories').limit(100).get();
        let stories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const activeCC = window.AdminApp?.activeCountry || 'ALL';
        if (activeCC !== 'ALL' && window.AvyraCatalogs) {
          stories = stories.filter(s => AvyraCatalogs.matchesCountry(s.countryCode, activeCC));
        }

        this.allStories = stories;
        if (!stories.length) {
          el.innerHTML = '<p class="empty-state">لا توجد يوميات (Stories) نشطة حالياً</p>';
          return;
        }

        el.innerHTML = stories.map(s => {
          const mediaUrl = safeUrl(s.mediaUrl || s.imageUrl);
          const avatar = safeUrl(s.userImageUrl || s.userImage) || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.userName || 'U')}&background=104D9E&color=fff`;
          const viewersCount = Array.isArray(s.viewers) ? s.viewers.length : 0;

          return `
            <div class="verify-card">
              <div class="verify-card-header">
                <img src="${escapeAttr(avatar)}" alt="">
                <div class="verify-card-info">
                  <h4>${escapeHtml(s.userName || 'مستخدم')}</h4>
                  <p>${escapeHtml(timeAgo(s.createdAt))} — المشاهدات: ${escapeHtml(viewersCount)}</p>
                </div>
              </div>
              <div class="verify-card-body">
                ${mediaUrl ? `<img class="verify-id-image" style="max-height:180px;" src="${escapeAttr(mediaUrl)}" onclick="AdminApp.previewImage('${escapeAttr(mediaUrl)}')" alt="">` : ''}
                ${s.caption ? `<p style="margin-top:8px;">${escapeHtml(s.caption)}</p>` : ''}
              </div>
              <div class="verify-card-actions">
                ${s.userId ? `<button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(s.userId)}')">المستخدم</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="JobsModule.deleteStory('${escapeAttr(s.id)}')">
                  <span class="material-icons-outlined">delete</span> حذف القصة
                </button>
              </div>
            </div>
          `;
        }).join('');
      } catch (e) {
        el.innerHTML = `<p class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</p>`;
      }
    },

    async deleteStory(storyId) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف القصة (Story)',
        message: 'هل أنت متأكد من حذف هذه القصة نهائياً؟',
        confirmText: 'حذف القصة',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('stories').doc(storyId).delete();
        showToast('تم حذف القصة بنجاح');
        await this.loadStories();
      } catch (e) {
        showToast('فشل الحذف: ' + e.message, 'error');
      }
    },

    // ── Sub-Tab 4: Project Payments (`payments`) ──
    async loadPayments() {
      const tbody = document.getElementById('job-payments-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('payments').limit(100).get();
        this.allPayments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!this.allPayments.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد معاملات دفع مشاريع مسجلة</td></tr>';
          return;
        }

        tbody.innerHTML = this.allPayments.map(pay => {
          const st = pay.status || 'pending';
          const stClass = st === 'completed' || st === 'released' ? 'reviewed' : (st === 'cancelled' ? 'rejected' : 'pending');
          return `
            <tr>
              <td><span style="font-family:monospace;">#${escapeHtml(pay.id.substring(0, 8))}</span></td>
              <td><strong>${escapeHtml(pay.amount || 0)} ${escapeHtml(pay.currency || 'SDG')}</strong></td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(pay.clientId || '')}')">العميل</button>
                <button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(pay.freelancerId || '')}')">المستقل</button>
              </td>
              <td><span class="report-status ${stClass}">${escapeHtml(st)}</span></td>
              <td>${escapeHtml(formatDateTime(pay.createdAt))}</td>
              <td>
                ${st === 'pending' ? `
                  <button class="btn btn-sm btn-success" onclick="JobsModule.updatePaymentStatus('${escapeAttr(pay.id)}', 'completed')">اعتماد الدفع</button>
                ` : '—'}
              </td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    async updatePaymentStatus(paymentId, status) {
      const confirmed = await AdminDialog.confirm({
        title: 'تحديث حالة دفعة المشروع',
        message: 'هل تريد اعتماد وتأكيد هذه الدفعة؟',
        confirmText: 'اعتماد'
      });
      if (!confirmed) return;

      try {
        await db.collection('payments').doc(paymentId).update({
          status,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('تم تحديث حالة الدفعة بنجاح');
        await this.loadPayments();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    }
  };

  window.JobsModule = JobsModule;
})();
