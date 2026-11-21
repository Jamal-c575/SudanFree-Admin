/**
 * UnionsSquadsModule — Complete Unions & Squads Hub:
 * 1. Pending Union Creation Requests (`union_requests`)
 *    - CRITICAL `firebase/firestore.rules` (lines 798-803):
 *      `union_requests` update MUST ONLY touch `['status', 'reviewedAt']`
 *    - Approving checks for existing `(category, state)` union and creates `unions/{id}` with full `UnionModel.toFirestore()` fields
 * 2. Active Unions (`unions`) — list, create modal, toggle `isVerified`, delete
 * 3. Work Squads (`squads`) — list, inspect members/category/rating, delete
 */
(function () {
  const UnionsSquadsModule = {
    currentTab: 'unions',
    unionsList: [],
    requestsList: [],
    squadsList: [],

    initSelects() {
      const catSel = document.getElementById('union-category');
      const stateSel = document.getElementById('union-state');
      const countrySel = document.getElementById('union-country');

      if (catSel && window.AvyraCatalogs) {
        catSel.innerHTML = AvyraCatalogs.UNION_CATEGORIES.map(c =>
          `<option value="${escapeAttr(c.id)}">${escapeHtml(c.labelAr)}</option>`
        ).join('');
      }
      if (countrySel && countrySel.options.length <= 1 && window.AvyraCatalogs) {
        countrySel.innerHTML = AvyraCatalogs.COUNTRIES.map(c =>
          `<option value="${escapeAttr(c.code)}">${escapeHtml(c.nameAr)} (${escapeHtml(c.code)})</option>`
        ).join('');
      }
      if (stateSel && stateSel.tagName === 'SELECT' && stateSel.options.length <= 1 && window.AvyraCatalogs) {
        stateSel.innerHTML = AvyraCatalogs.SUDAN_STATES.map(s =>
          `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`
        ).join('');
      }
    },

    switchTab(tab, btnEl) {
      this.currentTab = tab;
      document.querySelectorAll('#page-unions .sub-tab-btn').forEach(b => {
        const active = b.dataset.tab === tab || b === btnEl;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('#page-unions .sub-tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `unions-panel-${tab}`);
      });

      if (tab === 'unions') this.loadUnions();
      if (tab === 'requests') this.loadUnionRequests();
      if (tab === 'squads') this.loadSquads();
    },

    async loadAll() {
      this.initSelects();
      await Promise.all([
        this.loadUnions(),
        this.loadUnionRequests()
      ]);
    },

    // ── Sub-Tab 1: Active Unions (`unions`) ──
    async loadUnions() {
      this.initSelects();
      const tbody = document.getElementById('unions-table-body');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('unions').limit(150).get();
        this.unionsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.unionsList.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));

        const activeCC = window.AdminApp?.activeCountry || 'ALL';
        const filteredUnions = (activeCC !== 'ALL' && window.AvyraCatalogs)
          ? this.unionsList.filter(u => AvyraCatalogs.matchesCountry(u.countryCode, activeCC))
          : this.unionsList;

        if (!filteredUnions.length) {
          tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد نقابات مسجلة في هذا النطاق حالياً</td></tr>';
          return;
        }

        tbody.innerHTML = filteredUnions.map(u => {
          const catName = window.AvyraCatalogs ? AvyraCatalogs.getUnionCategoryName(u.category) : (u.category || 'عام');
          const dateStr = formatDateTime(u.createdAt);
          const isVerified = u.isVerified !== false;
          const memberCount = typeof u.memberCount === 'number' ? u.memberCount : (Array.isArray(u.memberIds) ? u.memberIds.length : 0);

          return `
            <tr>
              <td>
                <strong>${escapeHtml(u.name || 'نقابة')}</strong>
                ${isVerified ? ' <span class="verified-badge material-icons-outlined" style="font-size:16px;">verified</span>' : ''}
                <br><small style="color:var(--text-muted)">${escapeHtml((u.description || '').substring(0, 65))}</small>
              </td>
              <td><span class="chip chip-primary">${escapeHtml(catName)}</span></td>
              <td>${escapeHtml(u.countryCode || 'SD')} — ${escapeHtml(u.state || 'الخرطوم')}</td>
              <td><strong>${escapeHtml(memberCount)}</strong> عضو</td>
              <td>
                <span class="report-status ${isVerified ? 'reviewed' : 'pending'}">
                  ${isVerified ? 'موثقة' : 'غير موثقة'}
                </span>
              </td>
              <td>${escapeHtml(dateStr)}</td>
              <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button class="btn btn-sm btn-ghost" onclick="UnionsAdminApp.toggleVerified('${escapeAttr(u.id)}', ${isVerified})">
                    ${isVerified ? 'إلغاء التوثيق' : 'توثيق'}
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="UnionsAdminApp.deleteUnion('${escapeAttr(u.id)}')">
                    <span class="material-icons-outlined" style="font-size:16px;">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        console.error('Error loading unions:', e);
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:var(--danger)">خطأ في تحميل النقابات: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    showCreateModal() {
      this.initSelects();
      const form = document.getElementById('create-union-form');
      if (form) form.reset();
      const modal = document.getElementById('create-union-modal');
      if (modal) modal.style.display = 'flex';
    },

    async createUnion() {
      const name = document.getElementById('union-name')?.value.trim() || '';
      const category = document.getElementById('union-category')?.value || 'general';
      const countryCode = document.getElementById('union-country')?.value || 'SD';
      const state = document.getElementById('union-state')?.value.trim() || 'الخرطوم';
      const description = document.getElementById('union-description')?.value.trim() || '';
      const rules = document.getElementById('union-rules')?.value.trim() || 'الالتزام بأخلاقيات المهنة واحترام الأعضاء.';
      let coverImageUrl = document.getElementById('union-cover-url')?.value.trim() || '';
      const fileInput = document.getElementById('union-cover-file');

      if (!name || !description || !state) {
        showToast('يرجى إدخال اسم النقابة والولاية والوصف', 'error');
        return;
      }

      try {
        if (fileInput && fileInput.files && fileInput.files[0] && window.AdminHelpers) {
          showToast('جاري رفع صورة الغلاف...', 'info');
          coverImageUrl = await AdminHelpers.uploadToStorage(fileInput.files[0], 'unions');
        }

        const adminUid = auth.currentUser ? auth.currentUser.uid : 'admin';

        // Match UnionModel.toFirestore() + firestore.rules (lines 774-785)
        await db.collection('unions').add({
          name,
          description,
          category,
          countryCode,
          state,
          adminIds: [adminUid],
          memberIds: [adminUid],
          memberCount: 1,
          coverImageUrl: coverImageUrl || '',
          logoUrl: coverImageUrl || '',
          pinnedPostId: null,
          rules,
          isVerified: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('تم إنشاء النقابة الرسمية بنجاح', 'success');
        if (window.AdminApp) AdminApp.closeModal('create-union-modal');
        await this.loadUnions();
      } catch (e) {
        console.error('Error creating union:', e);
        showToast('فشل إنشاء النقابة: ' + e.message, 'error');
      }
    },

    async toggleVerified(unionId, currentVerified) {
      try {
        await db.collection('unions').doc(unionId).update({
          isVerified: !currentVerified
        });
        showToast(!currentVerified ? 'تم توثيق النقابة' : 'تم إلغاء توثيق النقابة');
        await this.loadUnions();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    async deleteUnion(unionId) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف النقابة',
        message: 'هل أنت متأكد من حذف هذه النقابة نهائياً؟',
        confirmText: 'حذف النقابة',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('unions').doc(unionId).delete();
        showToast('تم حذف النقابة بنجاح');
        await this.loadUnions();
      } catch (e) {
        showToast('فشل الحذف: ' + e.message, 'error');
      }
    },

    // ── Sub-Tab 2: Union Creation Requests (`union_requests`) ──
    async loadUnionRequests() {
      const tbody = document.getElementById('union-requests-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('union_requests').limit(100).get();
        this.requestsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.requestsList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        const pendingCount = this.requestsList.filter(r => (r.status || 'pending') === 'pending').length;
        const badge = document.getElementById('unions-requests-badge');
        if (badge) {
          badge.textContent = pendingCount;
          badge.style.display = pendingCount > 0 ? 'inline' : 'none';
        }

        if (!this.requestsList.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد طلبات تأسيس نقابات حالياً</td></tr>';
          return;
        }

        tbody.innerHTML = this.requestsList.map(r => {
          const catName = window.AvyraCatalogs ? AvyraCatalogs.getUnionCategoryName(r.category) : (r.category || 'عام');
          const status = r.status || 'pending';
          const statusLabel = status === 'approved' ? 'تمت الموافقة' : (status === 'rejected' ? 'مرفوض' : 'بانتظار المراجعة');
          const statusClass = status === 'approved' ? 'reviewed' : (status === 'rejected' ? 'rejected' : 'pending');

          return `
            <tr>
              <td>
                <strong>${escapeHtml(r.name || 'نقابة مقترحة')}</strong><br>
                <small style="color:var(--text-muted)">${escapeHtml(r.description || '')}</small>
              </td>
              <td><span class="chip chip-primary">${escapeHtml(catName)}</span></td>
              <td>${escapeHtml(r.countryCode || 'SD')} — ${escapeHtml(r.state || 'الخرطوم')}</td>
              <td>
                <strong>${escapeHtml(r.requesterName || 'مستخدم')}</strong><br>
                <small style="color:var(--text-muted)">${escapeHtml(timeAgo(r.createdAt))}</small>
              </td>
              <td><span class="report-status ${statusClass}">${escapeHtml(statusLabel)}</span></td>
              <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  ${status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="UnionsAdminApp.approveUnionRequest('${escapeAttr(r.id)}')">
                      <span class="material-icons-outlined" style="font-size:16px;">check</span> اعتماد وتأسيس
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="UnionsAdminApp.rejectUnionRequest('${escapeAttr(r.id)}')">
                      <span class="material-icons-outlined" style="font-size:16px;">close</span> رفض
                    </button>
                  ` : ''}
                  ${r.requesterId ? `<button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(r.requesterId)}')">مقدم الطلب</button>` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        console.error('Error loading union_requests:', e);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    async approveUnionRequest(requestId) {
      const req = this.requestsList.find(x => x.id === requestId);
      if (!req) return;

      const confirmed = await AdminDialog.confirm({
        title: 'اعتماد وتأسيس النقابة',
        message: `هل تريد اعتماد وتأسيس "${req.name}" وتعيين مقدم الطلب (${req.requesterName || 'المستخدم'}) مشرفاً عليها؟`,
        confirmText: 'اعتماد وتأسيس'
      });
      if (!confirmed) return;

      try {
        // Check for duplicate active union in same (category, state)
        const dupSnap = await db.collection('unions')
          .where('category', '==', req.category || 'general')
          .where('state', '==', req.state || 'الخرطوم')
          .limit(1)
          .get();

        if (!dupSnap.empty) {
          const proceedDup = await AdminDialog.confirm({
            title: 'تنبيه: توجد نقابة مشابهة',
            message: 'توجد بالفعل نقابة لنفس التخصص في هذه الولاية. هل تريد المتابعة بإنشائها على أي حال؟',
            confirmText: 'نعم، أنشئ النقابة'
          });
          if (!proceedDup) return;
        }

        const founderUid = req.requesterId || (auth.currentUser ? auth.currentUser.uid : 'admin');

        await db.collection('unions').add({
          name: String(req.name || 'نقابة مهنية').substring(0, 120),
          description: String(req.description || 'نقابة مهنية معتمدة').substring(0, 2000),
          category: String(req.category || 'general').substring(0, 60),
          countryCode: req.countryCode || 'SD',
          state: req.state || 'الخرطوم',
          adminIds: [founderUid],
          memberIds: [founderUid],
          memberCount: 1,
          coverImageUrl: req.coverImageUrl || '',
          logoUrl: req.logoUrl || '',
          pinnedPostId: null,
          rules: req.rules || 'الالتزام بأخلاقيات المهنة واحترام الأعضاء.',
          isVerified: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // STRICT SCHEMA: firestore.rules lines 798-803 allows ONLY ['status', 'reviewedAt']
        await db.collection('union_requests').doc(requestId).update({
          status: 'approved',
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (req.requesterId) {
          await db.collection('notifications').add({
            userId: req.requesterId,
            type: 'system',
            title: 'تم اعتماد وتأسيس النقابة!',
            message: `تمت الموافقة على طلبك وتأسيس "${req.name}" رسمياً في المنصة.`,
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        showToast('تم تأسيس النقابة واعتماد الطلب بنجاح', 'success');
        await this.loadAll();
      } catch (e) {
        console.error('Error approving union request:', e);
        showToast('فشل اعتماد الطلب: ' + e.message, 'error');
      }
    },

    async rejectUnionRequest(requestId) {
      const req = this.requestsList.find(x => x.id === requestId);
      const confirmed = await AdminDialog.confirm({
        title: 'رفض طلب تأسيس النقابة',
        message: 'هل أنت متأكد من رفض هذا الطلب؟',
        confirmText: 'رفض الطلب',
        danger: true
      });
      if (!confirmed) return;

      try {
        // STRICT SCHEMA: firestore.rules lines 798-803 allows ONLY ['status', 'reviewedAt']
        await db.collection('union_requests').doc(requestId).update({
          status: 'rejected',
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (req && req.requesterId) {
          await db.collection('notifications').add({
            userId: req.requesterId,
            type: 'system',
            title: 'تحديث بخصوص طلب تأسيس النقابة',
            message: `عذراً، لم تتم الموافقة على طلب تأسيس "${req.name || 'النقابة'}".`,
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        showToast('تم رفض طلب النقابة', 'info');
        await this.loadUnionRequests();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    // ── Sub-Tab 3: Work Squads (`squads`) ──
    async loadSquads() {
      const tbody = document.getElementById('squads-table-body');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('squads').limit(100).get();
        this.squadsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (!this.squadsList.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد فرق عمل (Squads) مسجلة حالياً</td></tr>';
          return;
        }

        tbody.innerHTML = this.squadsList.map(sq => {
          const catName = window.AvyraCatalogs ? AvyraCatalogs.getSquadCategoryName(sq.category) : (sq.category || 'أخرى');
          const membersCount = Array.isArray(sq.members) ? sq.members.length : (Array.isArray(sq.memberIds) ? sq.memberIds.length : 1);
          const rating = typeof sq.rating === 'number' ? sq.rating.toFixed(1) : '5.0';

          return `
            <tr>
              <td>
                <strong>${escapeHtml(sq.name || 'فريق عمل')}</strong><br>
                <small style="color:var(--text-muted)">${escapeHtml((sq.bio || '').substring(0, 70))}</small>
              </td>
              <td><span class="chip">${escapeHtml(catName)}</span></td>
              <td>${escapeHtml(sq.countryCode || 'SD')} — ${escapeHtml(sq.state || '')} ${escapeHtml(sq.locality || '')}</td>
              <td><strong>${escapeHtml(membersCount)}</strong> عضو</td>
              <td>${escapeHtml(rating)} (${escapeHtml(sq.completedProjects || 0)} مشروع)</td>
              <td>
                <div style="display:flex; gap:8px;">
                  ${sq.leaderId ? `<button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(sq.leaderId)}')">القائد</button>` : ''}
                  <button class="btn btn-sm btn-danger" onclick="UnionsAdminApp.deleteSquad('${escapeAttr(sq.id)}')">
                    <span class="material-icons-outlined" style="font-size:16px;">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        console.error('Error loading squads:', e);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    async deleteSquad(squadId) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف فريق العمل',
        message: 'هل أنت متأكد من حذف فريق العمل (Squad) هذا نهائياً؟',
        confirmText: 'حذف الفريق',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('squads').doc(squadId).delete();
        showToast('تم حذف فريق العمل بنجاح');
        await this.loadSquads();
      } catch (e) {
        showToast('فشل الحذف: ' + e.message, 'error');
      }
    }
  };

  window.UnionsSquadsModule = UnionsSquadsModule;
  window.UnionsAdminApp = UnionsSquadsModule;
})();
