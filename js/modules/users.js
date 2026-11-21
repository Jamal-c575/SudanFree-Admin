/**
 * UsersModule — Manages:
 * 1. Paginated Users list (`users`) with country, role, state, verified, and online filters
 * 2. User Detail Modal enriched via `PrivateUserHelper.fetchUserWithPrivate` (shows private `email`, `phoneNumber`, `whatsappNumber`, `idCardUrl`, `bankAccounts`, `walletBalance`)
 * 3. Dual-write Ban/Unban via `PrivateUserHelper.updateBanDual` (`users/{uid}` + `users/{uid}/private/main`)
 * 4. Banned Users & Banned Devices (`banned_devices`) sub-tabs
 * 5. Account Deletion Requests (`deletion_requests`)
 * 6. Success Stories (`success_stories`)
 * 7. Admins Management (`users` where `role == 'admin'`)
 */
(function () {
  const UsersModule = {
    allUsers: [],
    lastUserDoc: null,
    isLoadingUsers: false,
    hasMoreUsers: true,
    usersObserver: null,
    globalUserStatsInterval: null,
    searchDebounceTimeout: null,
    lastOnlineFilterState: undefined,
    bannedUsersData: [],
    bannedDevicesData: [],
    currentBannedTab: 'users',

    initUserFilters() {
      const countrySel = document.getElementById('users-country-filter');
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
      this.onUserCountryFilterChange();
    },

    onUserCountryFilterChange() {
      const countrySel = document.getElementById('users-country-filter');
      const stateSel = document.getElementById('users-state-filter');
      if (!stateSel || !window.AvyraCatalogs) return;
      const cc = countrySel?.value || (window.AdminApp?.activeCountry !== 'ALL' ? window.AdminApp?.activeCountry : 'SD');
      const regions = AvyraCatalogs.getRegionsForCountry(cc || 'SD');
      const currentVal = stateSel.value;
      stateSel.innerHTML = `<option value="">كل المناطق / الولايات</option>` +
        regions.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
      if (currentVal && regions.includes(currentVal)) {
        stateSel.value = currentVal;
      }
    },

    async updateGlobalUserStats() {
      const totalEl = document.getElementById('global-users-count');
      const onlineEl = document.getElementById('global-online-count');
      const verifiedEl = document.getElementById('global-verified-count');

      try {
        const fiveMinutesAgo = new Date(Date.now() - 300000);
        AdminApp.getCount(db.collection('users'))
          .then(count => { if (totalEl) totalEl.textContent = count; })
          .catch(() => { if (totalEl) totalEl.textContent = '—'; });

        AdminApp.getCount(db.collection('users').where('lastActive', '>=', fiveMinutesAgo))
          .then(count => { if (onlineEl) onlineEl.textContent = count; })
          .catch(() => { if (onlineEl) onlineEl.textContent = '—'; });

        AdminApp.getCount(db.collection('users').where('isVerified', '==', true))
          .then(count => { if (verifiedEl) verifiedEl.textContent = count; })
          .catch(() => { if (verifiedEl) verifiedEl.textContent = '—'; });
      } catch (e) {
        console.error('Error updating global user stats:', e);
      }
    },

    async loadUsers() {
      this.initUserFilters();
      this.lastUserDoc = null;
      this.hasMoreUsers = true;
      this.allUsers = [];
      const tbody = document.getElementById('users-tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
      }

      this.updateGlobalUserStats();
      if (this.globalUserStatsInterval) clearInterval(this.globalUserStatsInterval);
      this.globalUserStatsInterval = setInterval(() => this.updateGlobalUserStats(), 60000);

      await this.fetchMoreUsers();
      this.setupUsersObserver();
    },

    async fetchMoreUsers() {
      if (this.isLoadingUsers || !this.hasMoreUsers) return;
      this.isLoadingUsers = true;

      const tbody = document.getElementById('users-tbody');
      if (tbody && this.allUsers.length > 0) {
        const tr = document.createElement('tr');
        tr.id = 'users-loading-row';
        tr.innerHTML = '<td colspan="7" style="text-align:center;"><div class="loading-spinner" style="display:inline-block; transform:scale(0.5);"><div class="spinner"></div></div></td>';
        tbody.appendChild(tr);
      }

      try {
        const onlineFilter = document.getElementById('users-online-filter')?.value || '';
        let query = db.collection('users');

        if (onlineFilter === 'true') {
          const fiveMinsAgo = firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 300000));
          query = query.where('lastActive', '>=', fiveMinsAgo).orderBy('lastActive', 'desc');
        } else {
          query = query.orderBy('createdAt', 'desc');
        }

        query = query.limit(50);
        if (this.lastUserDoc) {
          query = query.startAfter(this.lastUserDoc);
        }

        const snap = await query.get();
        const loadingRow = document.getElementById('users-loading-row');
        if (loadingRow) loadingRow.remove();

        if (snap.empty) {
          this.hasMoreUsers = false;
          this.isLoadingUsers = false;
          if (this.allUsers.length === 0 && tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا يوجد مستخدمون</td></tr>';
          }
          return;
        }

        this.lastUserDoc = snap.docs[snap.docs.length - 1];
        const newUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.allUsers = [...this.allUsers, ...newUsers];

        if (snap.docs.length < 50) {
          this.hasMoreUsers = false;
        }
        this.isLoadingUsers = false;
        this.filterUsers(true);
      } catch (e) {
        this.isLoadingUsers = false;
        console.error('Error fetching users:', e);
      }
    },

    setupUsersObserver() {
      if (this.usersObserver) {
        this.usersObserver.disconnect();
      }
      let sentinel = document.getElementById('users-sentinel');
      if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'users-sentinel';
        sentinel.style.height = '20px';
        const container = document.querySelector('#page-users .table-container');
        if (container) container.appendChild(sentinel);
      }
      if (typeof IntersectionObserver === 'function' && sentinel) {
        this.usersObserver = new IntersectionObserver((entries) => {
          if (entries[0]?.isIntersecting && this.hasMoreUsers && !this.isLoadingUsers) {
            this.fetchMoreUsers();
          }
        }, { root: null, rootMargin: '100px' });
        this.usersObserver.observe(sentinel);
      }
    },

    isOnline(u) {
      if (!u || !u.lastActive) return false;
      const d = u.lastActive.toDate ? u.lastActive.toDate() : new Date(u.lastActive);
      return (Date.now() - d.getTime()) < 300000;
    },

    renderUsers(users) {
      const onlineCount = users.filter(u => this.isOnline(u)).length;
      const countEl = document.getElementById('users-count');
      if (countEl) {
        countEl.innerHTML = `
          <div style="display:flex; gap:20px; align-items:center;">
            <span>إجمالي المعروض: ${escapeHtml(users.length)} مستخدم</span>
            <span class="chip chip-primary">
              <span class="status-dot status-online" style="margin:0;"></span> متصل حالياً: ${escapeHtml(onlineCount)}
            </span>
          </div>
        `;
      }
      const tbody = document.getElementById('users-tbody');
      if (!tbody) return;
      if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا يوجد مستخدمون مطابقون</td></tr>';
        return;
      }

      tbody.innerHTML = users.map(u => {
        const avatar = safeUrl(u.profileImageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=104D9E&color=fff`;
        const cc = u.countryCode ? `[${escapeHtml(u.countryCode)}] ` : '';
        return `
          <tr>
            <td><img class="user-avatar" src="${escapeAttr(avatar)}" alt=""></td>
            <td>
              <strong>${escapeHtml(u.name || 'مستخدم')}</strong>
              ${u.isVerified ? ' <span class="verified-badge material-icons-outlined">verified</span>' : ''}
              ${u.isPremium ? ' <span class="chip chip-primary" style="font-size:12px;padding:1px 6px;">Pro</span>' : ''}
              <br><small style="color:var(--text-muted)">${escapeHtml(u.email || u.phoneNumber || '')}</small>
            </td>
            <td>${getRoleBadge(u.role)}</td>
            <td>${cc}${escapeHtml(u.state || '—')}<br><small style="color:var(--text-muted)">${escapeHtml(u.locality || '')}</small></td>
            <td><strong>${escapeHtml((u.rating || 0).toFixed(1))}</strong> / 5</td>
            <td><span class="status-dot ${this.isOnline(u) ? 'status-online' : 'status-offline'}"></span>${this.isOnline(u) ? 'متصل' : 'غير متصل'}</td>
            <td><button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(u.id)}')">عرض</button></td>
          </tr>
        `;
      }).join('');
    },

    filterUsers(immediate = false) {
      if (!immediate) {
        clearTimeout(this.searchDebounceTimeout);
        this.searchDebounceTimeout = setTimeout(() => this.executeFilter(), 450);
      } else {
        clearTimeout(this.searchDebounceTimeout);
        this.executeFilter();
      }
    },

    async executeFilter() {
      const searchRaw = document.getElementById('users-search')?.value || '';
      const search = searchRaw.trim();
      const searchLower = searchRaw.toLowerCase();
      const country = document.getElementById('users-country-filter')?.value || '';
      const role = document.getElementById('users-role-filter')?.value || '';
      const state = document.getElementById('users-state-filter')?.value || '';
      const verified = document.getElementById('users-verified-filter')?.value || '';
      const online = document.getElementById('users-online-filter')?.value || '';

      if (this.lastOnlineFilterState === undefined) {
        this.lastOnlineFilterState = online;
      }
      if (this.lastOnlineFilterState !== online) {
        this.lastOnlineFilterState = online;
        await this.loadUsers();
        return;
      }

      if (search) {
        const tbody = document.getElementById('users-tbody');
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
        }
        let query;
        if (search.includes('@')) {
          query = db.collection('users').where('email', '==', search);
        } else if (/^[+0-9]/.test(search)) {
          query = db.collection('users').where('phoneNumber', '==', search);
        } else {
          query = db.collection('users')
            .where('name', '>=', search)
            .where('name', '<=', search + '\uf8ff');
        }

        try {
          const snap = await query.limit(50).get();
          const serverResults = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const localMatches = this.allUsers.filter(u =>
            (u.name || '').toLowerCase().includes(searchLower) ||
            (u.email || '').toLowerCase().includes(searchLower) ||
            (u.phoneNumber || '').includes(searchLower)
          );

          const mergedMap = new Map();
          localMatches.forEach(u => mergedMap.set(u.id, u));
          serverResults.forEach(u => mergedMap.set(u.id, u));
          let results = Array.from(mergedMap.values());

          if (country) results = results.filter(u => (u.countryCode || 'SD') === country);
          if (role) results = results.filter(u => u.role === role);
          if (state) results = results.filter(u => u.state === state);
          if (verified) results = results.filter(u => String(u.isVerified || false) === verified);
          if (online === 'true') results = results.filter(u => this.isOnline(u));

          this.renderUsers(results);
        } catch (e) {
          console.error('Search error:', e);
          this.renderUsers([]);
        }
        return;
      }

      let filtered = this.allUsers;
      if (country) filtered = filtered.filter(u => (u.countryCode || 'SD') === country);
      if (role) filtered = filtered.filter(u => u.role === role);
      if (state) filtered = filtered.filter(u => u.state === state);
      if (verified) filtered = filtered.filter(u => String(u.isVerified || false) === verified);
      if (online === 'true') filtered = filtered.filter(u => this.isOnline(u));
      this.renderUsers(filtered);
    },

    // ── User Detail Modal (Enriched with `users/{uid}/private/main`) ──
    async showUserDetail(id) {
      if (!id) return;
      const modal = document.getElementById('user-modal');
      const nameEl = document.getElementById('modal-user-name');
      const bodyEl = document.getElementById('modal-user-body');
      if (!modal || !bodyEl) return;

      nameEl.textContent = 'جاري تحميل بيانات المستخدم...';
      bodyEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
      modal.style.display = 'flex';

      let baseUser = this.allUsers.find(x => x.id === id) ||
                     (this.bannedUsersData || []).find(x => x.id === id) ||
                     null;

      const u = window.PrivateUserHelper
        ? await PrivateUserHelper.fetchUserWithPrivate(id, baseUser)
        : baseUser;

      if (!u) {
        showToast('لم يتم العثور على بيانات المستخدم', 'error');
        AdminApp.closeModal('user-modal');
        return;
      }

      nameEl.textContent = u.name || 'مستخدم';
      const avatar = safeUrl(u.profileImageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=104D9E&color=fff`;
      const idCardUrl = safeUrl(u.idCardUrl);
      const bankAccounts = Array.isArray(u.bankAccounts) ? u.bankAccounts : [];

      const banksHtml = bankAccounts.length
        ? bankAccounts.map(b =>
            `<div style="font-size:13px;"><strong>${escapeHtml(b.bankName || 'بنك')}:</strong> ${escapeHtml(b.accountName || '')} (<span dir="ltr">${escapeHtml(b.accountNumber || '')}</span>)</div>`
          ).join('')
        : '—';

      bodyEl.innerHTML = `
        <div class="user-detail-header">
          <img src="${escapeAttr(avatar)}" alt="">
          <div>
            <h4>
              ${escapeHtml(u.name || 'مستخدم')}
              ${u.isVerified ? ' <span class="verified-badge material-icons-outlined">verified</span>' : ''}
            </h4>
            <p style="color:var(--text-secondary)">
              ${escapeHtml(ROLE_NAMES[u.role] || u.role || '')} — ${escapeHtml(u.countryCode || 'SD')} / ${escapeHtml(u.state || 'غير محدد')}
            </p>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><div class="label">البريد الإلكتروني</div><div class="value" dir="ltr">${escapeHtml(u.email || '—')}</div></div>
          <div class="detail-item"><div class="label">رقم الهاتف</div><div class="value" dir="ltr">${escapeHtml(u.phoneNumber || '—')}</div></div>
          <div class="detail-item"><div class="label">رقم واتساب</div><div class="value" dir="ltr">${escapeHtml(u.whatsappNumber || u.phoneNumber || '—')}</div></div>
          <div class="detail-item"><div class="label">التقييم</div><div class="value">${escapeHtml((u.rating || 0).toFixed(1))} / 5 (${escapeHtml(u.reviewsCount || 0)} تقييم)</div></div>
          <div class="detail-item"><div class="label">الأعمال المنجزة</div><div class="value">${escapeHtml(u.completedJobs || 0)}</div></div>
          <div class="detail-item"><div class="label">المحلية</div><div class="value">${escapeHtml(u.locality || '—')}</div></div>
          <div class="detail-item"><div class="label">المهارات</div><div class="value">${escapeHtml((u.skills || []).join('، ') || '—')}</div></div>
          <div class="detail-item"><div class="label">حالة التوثيق</div><div class="value">${escapeHtml(u.verificationStatus || (u.isVerified ? 'verified' : 'none'))}</div></div>
          <div class="detail-item"><div class="label">الرصيد / النقاط</div><div class="value">${escapeHtml(u.walletBalance || 0)} SDG | ${escapeHtml(u.points || 0)} نقطة</div></div>
          <div class="detail-item"><div class="label">حالة الحساب</div><div class="value">${u.isBanned ? '<span style="color:var(--danger);font-weight:800;">محظور</span>' : '<span style="color:var(--success);font-weight:800;">نشط</span>'}</div></div>
          <div class="detail-item full-width"><div class="label">الحسابات البنكية المسجلة</div><div class="value">${banksHtml}</div></div>
          ${idCardUrl ? `<div class="detail-item full-width"><div class="label">صورة الهوية</div><div class="value"><img src="${escapeAttr(idCardUrl)}" style="max-height:140px;border-radius:8px;cursor:pointer;" onclick="AdminApp.previewImage('${escapeAttr(idCardUrl)}')" alt="الهوية"></div></div>` : ''}
        </div>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-glass);display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-sm ${u.isVerified ? 'btn-warning' : 'btn-success'}" onclick="AdminApp.toggleUserVerification('${escapeAttr(u.id)}', ${Boolean(u.isVerified)})" style="flex:1;">
            <span class="material-icons-outlined">${u.isVerified ? 'verified_user' : 'verified'}</span>
            ${u.isVerified ? 'نزع شارة التوثيق' : 'توثيق الحساب'}
          </button>
          <button class="btn btn-sm ${u.isBanned ? 'btn-success' : 'btn-danger'}" onclick="AdminApp.toggleUserBan('${escapeAttr(u.id)}', ${Boolean(u.isBanned)})" style="flex:1;">
            <span class="material-icons-outlined">${u.isBanned ? 'check_circle' : 'block'}</span>
            ${u.isBanned ? 'فك الحظر' : 'حظر المستخدم'}
          </button>
          <button class="btn btn-sm btn-primary" onclick="AdminApp.showPersonalNotifForm('${escapeAttr(u.id)}')" style="flex:1;">
            <span class="material-icons-outlined">send</span> تنبيه خاص
          </button>
        </div>
        <div id="personal-notif-form-${escapeAttr(u.id)}" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border-glass);">
          <h4 style="margin-bottom:10px;font-size:14px;">إرسال تنبيه شخصي</h4>
          <input type="text" id="personal-notif-title-${escapeAttr(u.id)}" class="text-input" placeholder="عنوان التنبيه" style="margin-bottom:8px;">
          <textarea id="personal-notif-body-${escapeAttr(u.id)}" class="text-input textarea" placeholder="نص التنبيه..."></textarea>
          <button class="btn btn-primary btn-sm" onclick="AdminApp.sendPersonalNotification('${escapeAttr(u.id)}')" style="margin-top:8px;">
            <span class="material-icons-outlined" style="font-size:16px;">send</span> إرسال التنبيه
          </button>
        </div>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-glass);">
          <h4 style="margin-bottom:10px;font-size:14px;">ترويج هذا المستخدم في الصفحة الرئيسية</h4>
          <textarea id="promo-text-input" class="text-input textarea" placeholder="اكتب نصاً ترويجياً مميزاً يظهر في الصفحة الرئيسية..."></textarea>
          <div style="display:flex;align-items:center;gap:10px;margin-top:10px;">
            <label style="font-size:13px;font-weight:700;">مدة الترويج:</label>
            <select id="promo-duration" class="filter-select">
              <option value="7">أسبوع</option>
              <option value="14">أسبوعان</option>
              <option value="30" selected>شهر</option>
              <option value="90">3 أشهر</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="AdminApp.promoteUser('${escapeAttr(u.id)}')" style="margin-right:auto;">
              <span class="material-icons-outlined" style="font-size:16px;">campaign</span> نشر الترويج
            </button>
          </div>
        </div>
      `;
    },

    async promoteUser(userId) {
      const promoText = document.getElementById('promo-text-input')?.value.trim() || '';
      if (!promoText) {
        showToast('يرجى كتابة نص ترويجي أولاً', 'error');
        return;
      }
      const confirmed = await AdminDialog.confirm({
        title: 'نشر ترويج المستخدم',
        message: 'هل تريد نشر هذا الترويج في الصفحة الرئيسية للتطبيق؟',
        confirmText: 'نشر الترويج'
      });
      if (!confirmed) return;

      const days = parseInt(document.getElementById('promo-duration')?.value, 10) || 30;
      const expiry = new Date(Date.now() + days * 86400000);
      try {
        await db.collection('promotions').add({
          userId,
          promoText,
          isActive: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          expiryDate: firebase.firestore.Timestamp.fromDate(expiry)
        });
        showToast('تم نشر الترويج بنجاح! سيظهر في الصفحة الرئيسية.', 'success');
        AdminApp.closeModal('user-modal');
      } catch (e) {
        showToast('حدث خطأ: ' + e.message, 'error');
      }
    },

    showPersonalNotifForm(userId) {
      const form = document.getElementById('personal-notif-form-' + userId);
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    },

    async sendPersonalNotification(userId) {
      const title = document.getElementById('personal-notif-title-' + userId)?.value.trim() || '';
      const body = document.getElementById('personal-notif-body-' + userId)?.value.trim() || '';
      if (!title || !body) {
        showToast('يرجى ملء العنوان والمحتوى', 'error');
        return;
      }
      const confirmed = await AdminDialog.confirm({
        title: 'إرسال تنبيه خاص',
        message: 'هل تريد إرسال هذا التنبيه الشخصي للمستخدم؟',
        confirmText: 'إرسال'
      });
      if (!confirmed) return;

      try {
        await db.collection('notifications').add({
          userId,
          title,
          message: body,
          type: 'system',
          isRead: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          relatedId: 'personal_admin_notification'
        });
        showToast('تم إرسال التنبيه الشخصي بنجاح', 'success');
        document.getElementById('personal-notif-title-' + userId).value = '';
        document.getElementById('personal-notif-body-' + userId).value = '';
        document.getElementById('personal-notif-form-' + userId).style.display = 'none';
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    async toggleUserVerification(userId, isCurrentlyVerified) {
      const confirmed = await AdminDialog.confirm({
        title: isCurrentlyVerified ? 'نزع شارة التوثيق' : 'توثيق الحساب',
        message: isCurrentlyVerified
          ? 'هل أنت متأكد من نزع شارة التوثيق عن هذا المستخدم؟'
          : 'هل أنت متأكد من توثيق حساب هذا المستخدم رسمياً؟',
        confirmText: isCurrentlyVerified ? 'نزع التوثيق' : 'توثيق الحساب',
        danger: isCurrentlyVerified
      });
      if (!confirmed) return;

      try {
        const updateData = {
          isVerified: !isCurrentlyVerified,
          verificationStatus: !isCurrentlyVerified ? 'verified' : 'none',
          verifiedAt: !isCurrentlyVerified ? firebase.firestore.FieldValue.serverTimestamp() : null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(userId).update(updateData);
        await db.collection('notifications').add({
          userId,
          type: 'system',
          title: !isCurrentlyVerified ? 'تم توثيق حسابك بنجاح' : 'إلغاء شارة التوثيق',
          message: !isCurrentlyVerified
            ? 'تهانينا! تم توثيق حسابك رسمياً من قبل إدارة AVYRA.'
            : 'تم نزع شارة التوثيق عن حسابك بواسطة الإدارة.',
          isRead: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (window.PrivateUserHelper) PrivateUserHelper.invalidate(userId);
        showToast(!isCurrentlyVerified ? 'تم توثيق حساب المستخدم بنجاح' : 'تم نزع شارة التوثيق');
        AdminApp.closeModal('user-modal');
        await this.loadUsers();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    async toggleUserBan(userId, isCurrentlyBanned) {
      let reason = null;
      if (!isCurrentlyBanned) {
        reason = await AdminDialog.prompt({
          title: 'حظر المستخدم',
          message: 'أدخل سبب حظر هذا المستخدم (سيتم تطبيقه على ملفه العام والخاص):',
          placeholder: 'مثال: مخالفة شروط الاستخدام أو احتيال',
          defaultValue: 'مخالفة شروط الاستخدام',
          confirmText: 'حظر الحساب',
          danger: true
        });
        if (reason === null) return;
      } else {
        const confirmed = await AdminDialog.confirm({
          title: 'فك الحظر عن المستخدم',
          message: 'هل أنت متأكد من رفع الحظر وإعادة تفعيل هذا الحساب؟',
          confirmText: 'فك الحظر'
        });
        if (!confirmed) return;
      }

      try {
        if (window.PrivateUserHelper) {
          await PrivateUserHelper.updateBanDual(userId, {
            isBanned: !isCurrentlyBanned,
            banReason: reason || 'مخالفة شروط الاستخدام',
            bannedBy: auth.currentUser ? auth.currentUser.uid : null
          });
        } else {
          await db.collection('users').doc(userId).update({
            isBanned: !isCurrentlyBanned,
            banReason: !isCurrentlyBanned ? (reason || 'مخالفة شروط الاستخدام') : null
          });
        }

        showToast(isCurrentlyBanned ? 'تم فك الحظر بنجاح' : 'تم حظر المستخدم بنجاح');
        AdminApp.closeModal('user-modal');
        await this.loadUsers();
        if (AdminApp.currentPage === 'banned') {
          await this.loadBannedUsers();
        }
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    // ── Banned Users & Banned Devices (`banned_devices`) ──
    switchBannedTab(tab, btnEl) {
      this.currentBannedTab = tab;
      document.querySelectorAll('#page-banned .sub-tab-btn').forEach(b => {
        const active = b.dataset.tab === tab || b === btnEl;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('#page-banned .sub-tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `banned-panel-${tab}`);
      });

      if (tab === 'users') this.loadBannedUsers();
      if (tab === 'devices') this.loadBannedDevices();
    },

    async loadBannedUsers() {
      const tbody = document.getElementById('banned-tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
      }
      try {
        const snap = await db.collection('users').where('isBanned', '==', true).get();
        this.bannedUsersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.displayBannedUsers(this.bannedUsersData);
      } catch (e) {
        console.error('Error loading banned users:', e);
      }
    },

    displayBannedUsers(banned) {
      const tbody = document.getElementById('banned-tbody');
      if (!tbody) return;
      if (!banned || !banned.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا يوجد مستخدمون محظورون حالياً</td></tr>';
        return;
      }
      tbody.innerHTML = banned.map(u => {
        const avatar = safeUrl(u.profileImageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=D94A58&color=fff`;
        const bannedAt = formatDateTime(u.bannedAt || u.updatedAt);
        return `
          <tr>
            <td><img class="user-avatar" src="${escapeAttr(avatar)}" alt=""></td>
            <td>
              <strong>${escapeHtml(u.name || 'مستخدم')}</strong>
              ${u.isVerified ? ' <span class="verified-badge material-icons-outlined" style="font-size:16px;">verified</span>' : ''}
              <br><small style="color:var(--text-muted)">${escapeHtml(u.email || u.phoneNumber || '')}</small>
            </td>
            <td style="color:var(--danger);font-weight:700;">${escapeHtml(u.banReason || 'مخالفة الشروط والأحكام')}</td>
            <td>${escapeHtml(bannedAt)}</td>
            <td>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(u.id)}')">عرض الملف</button>
                <button class="btn btn-sm btn-success" onclick="AdminApp.toggleUserBan('${escapeAttr(u.id)}', true)">فك الحظر</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    },

    filterBannedUsers() {
      const search = (document.getElementById('banned-search')?.value || '').toLowerCase();
      if (!this.bannedUsersData) return;
      if (!search) {
        this.displayBannedUsers(this.bannedUsersData);
        return;
      }
      const filtered = this.bannedUsersData.filter(u =>
        (u.name || '').toLowerCase().includes(search) ||
        (u.email || '').toLowerCase().includes(search) ||
        (u.phoneNumber || '').toLowerCase().includes(search)
      );
      this.displayBannedUsers(filtered);
    },

    async loadBannedDevices() {
      const tbody = document.getElementById('banned-devices-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="4"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('banned_devices').limit(100).get();
        this.bannedDevicesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!this.bannedDevicesData.length) {
          tbody.innerHTML = '<tr><td colspan="4" class="empty-state">لا توجد أجهزة محظورة حالياً</td></tr>';
          return;
        }
        tbody.innerHTML = this.bannedDevicesData.map(dev => `
          <tr>
            <td><span style="font-family:monospace;font-weight:700;">${escapeHtml(dev.deviceId || dev.id)}</span></td>
            <td>${escapeHtml(dev.reason || 'حظر جهاز')}</td>
            <td>${escapeHtml(formatDateTime(dev.bannedAt || dev.createdAt))}</td>
            <td>
              <button class="btn btn-sm btn-success" onclick="UsersModule.unbanDevice('${escapeAttr(dev.id)}')">
                إلغاء حظر الجهاز
              </button>
            </td>
          </tr>
        `).join('');
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    async banDevicePrompt() {
      const deviceId = await AdminDialog.prompt({
        title: 'حظر معرف جهاز (Device ID)',
        message: 'أدخل معرف الجهاز المراد حظره من استخدام التطبيق:',
        placeholder: 'Device ID...',
        confirmText: 'حظر الجهاز',
        danger: true
      });
      if (!deviceId || !deviceId.trim()) return;

      try {
        const cleanId = deviceId.trim();
        await db.collection('banned_devices').doc(cleanId).set({
          deviceId: cleanId,
          reason: 'حظر إداري',
          bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
          bannedBy: auth.currentUser ? auth.currentUser.uid : null
        });
        showToast('تم حظر الجهاز بنجاح', 'success');
        await this.loadBannedDevices();
      } catch (e) {
        showToast('فشل حظر الجهاز: ' + e.message, 'error');
      }
    },

    async unbanDevice(deviceId) {
      const confirmed = await AdminDialog.confirm({
        title: 'رفع حظر الجهاز',
        message: `هل تريد إلغاء الحظر عن الجهاز (${deviceId})؟`,
        confirmText: 'رفع الحظر'
      });
      if (!confirmed) return;

      try {
        await db.collection('banned_devices').doc(deviceId).delete();
        showToast('تم رفع الحظر عن الجهاز', 'success');
        await this.loadBannedDevices();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    // ── Success Stories (`success_stories`) ──
    async loadSuccessStories() {
      const filter = document.getElementById('success-stories-filter')?.value || 'pending';
      const tbody = document.getElementById('success-stories-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="5"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('success_stories').where('status', '==', filter).limit(50).get();
        const stories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        stories.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        if (!stories.length) {
          tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد قصص نجاح في هذا القسم</td></tr>';
          return;
        }

        tbody.innerHTML = stories.map(s => {
          const dateStr = formatDateTime(s.createdAt);
          const avatar = safeUrl(s.userImage) || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.userName || 'U')}&background=104D9E&color=fff`;
          let actions = '';
          if (filter === 'pending') {
            actions = `
              <button class="btn btn-sm btn-success" onclick="AdminApp.updateSuccessStoryStatus('${escapeAttr(s.id)}', 'approved')">قبول</button>
              <button class="btn btn-sm btn-danger" onclick="AdminApp.updateSuccessStoryStatus('${escapeAttr(s.id)}', 'rejected')">رفض</button>
            `;
          } else if (filter === 'approved') {
            actions = `<button class="btn btn-sm btn-danger" onclick="AdminApp.updateSuccessStoryStatus('${escapeAttr(s.id)}', 'rejected')">إلغاء القبول</button>`;
          } else {
            actions = `<button class="btn btn-sm btn-primary" onclick="AdminApp.updateSuccessStoryStatus('${escapeAttr(s.id)}', 'approved')">قبول القصة</button>`;
          }

          return `
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img src="${escapeAttr(avatar)}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;" alt="">
                  <strong>${escapeHtml(s.userName || 'مستخدم')}</strong>
                </div>
              </td>
              <td><strong>${escapeHtml(s.title || '')}</strong></td>
              <td><div style="max-width:320px; max-height:80px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(s.content || '')}</div></td>
              <td>${escapeHtml(dateStr)}</td>
              <td><div style="display:flex; gap:8px;">${actions}</div></td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:var(--danger)">خطأ في التحميل</td></tr>`;
      }
    },

    async updateSuccessStoryStatus(id, status) {
      const confirmed = await AdminDialog.confirm({
        title: 'تحديث حالة قصة النجاح',
        message: 'هل أنت متأكد من تغيير حالة هذه القصة؟',
        confirmText: 'تأكيد'
      });
      if (!confirmed) return;

      try {
        await db.collection('success_stories').doc(id).update({
          status,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('تم تحديث حالة القصة بنجاح');
        await this.loadSuccessStories();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    // ── Account Deletions (`deletion_requests`) ──
    async loadDeletions() {
      const el = document.getElementById('deletions-list');
      if (!el) return;
      try {
        const snap = await db.collection('deletion_requests').orderBy('createdAt', 'desc').limit(200).get();
        const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        await this.renderDeletions(requests);

        const pending = requests.filter(r => (r.status || 'pending') === 'pending').length;
        const badge = document.getElementById('deletions-badge');
        if (badge) {
          badge.textContent = pending;
          badge.style.display = pending > 0 ? 'inline' : 'none';
        }
      } catch (e) {
        console.error('Error loading deletions:', e);
      }
    },

    async renderDeletions(requests) {
      const el = document.getElementById('deletions-list');
      if (!el) return;
      if (!requests.length) {
        el.innerHTML = '<p class="empty-state">لا توجد طلبات حذف حسابات معلقة</p>';
        return;
      }

      const enriched = await Promise.all(requests.map(async r => {
        let user = {};
        try {
          if (r.userId) {
            const uDoc = await db.collection('users').doc(r.userId).get();
            if (uDoc.exists) user = uDoc.data() || {};
          }
        } catch (_) {}
        return { ...r, _user: user };
      }));

      el.innerHTML = enriched.map(r => {
        const u = r._user || {};
        const avatar = safeUrl(u.profileImageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name || u.name || 'U')}&background=D94A58&color=fff`;
        const jobTitle = u.jobTitle || (u.skills || []).join('، ') || ROLE_NAMES[u.role] || '';
        const location = [u.locality, u.state].filter(Boolean).join(' — ');
        const st = r.status || 'pending';
        const stText = st === 'approved' ? 'تم الحذف' : (st === 'rejected' ? 'مرفوض' : 'معلق');
        const stClass = st === 'approved' ? 'reviewed' : (st === 'rejected' ? 'rejected' : 'pending');

        return `
          <div class="verify-card">
            <div class="verify-card-header">
              <img src="${escapeAttr(avatar)}" alt="">
              <div class="verify-card-info">
                <h4>${escapeHtml(r.name || u.name || 'مستخدم')}</h4>
                <p>${escapeHtml(r.email || u.email || 'بدون بريد')}${jobTitle ? ' — ' + escapeHtml(jobTitle) : ''}</p>
                ${location ? `<p>${escapeHtml(location)}</p>` : ''}
              </div>
              <span class="report-status ${stClass}" style="margin-right:auto;">${stText}</span>
            </div>
            <div class="verify-card-body">
              <p style="margin:0 0 6px;"><strong>السبب:</strong> ${escapeHtml(r.reason || 'لم يُذكر')}</p>
              <p style="margin:0;color:var(--text-muted);font-size:13px;">${escapeHtml(timeAgo(r.createdAt))}</p>
            </div>
            <div class="verify-card-actions">
              ${st === 'pending' ? `
                <button class="btn btn-sm btn-danger" onclick="AdminApp.approveDeletion('${escapeAttr(r.id)}', '${escapeAttr(r.userId || '')}')"><span class="material-icons-outlined">delete</span> موافقة وحذف</button>
                <button class="btn btn-sm btn-ghost" onclick="AdminApp.rejectDeletion('${escapeAttr(r.id)}')"><span class="material-icons-outlined">close</span> رفض الطلب</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    },

    async approveDeletion(reqId, userId) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف حساب المستخدم نهائياً',
        message: 'هل أنت متأكد من حذف حساب هذا المستخدم نهائياً؟ ستُحذف جميع بياناته ولا يمكن التراجع.',
        confirmText: 'حذف الحساب نهائياً',
        danger: true
      });
      if (!confirmed) return;

      try {
        const result = await deleteUserAccount({ userId });
        if (result?.data?.success) {
          await db.collection('deletion_requests').doc(reqId).update({
            status: 'approved',
            processedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast('تمت الموافقة وحذف بيانات المستخدم بنجاح');
          await this.loadDeletions();
          await this.loadUsers();
        } else {
          throw new Error('تعذر حذف الحساب من الخادم');
        }
      } catch (e) {
        showToast('حدث خطأ أثناء الحذف: ' + (e.message || e), 'error');
      }
    },

    async rejectDeletion(reqId) {
      const confirmed = await AdminDialog.confirm({
        title: 'رفض طلب الحذف',
        message: 'هل تريد رفض طلب حذف الحساب؟',
        confirmText: 'رفض الطلب'
      });
      if (!confirmed) return;

      try {
        await db.collection('deletion_requests').doc(reqId).update({
          status: 'rejected',
          processedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('تم رفض طلب الحذف');
        await this.loadDeletions();
      } catch (e) {
        showToast('حدث خطأ: ' + e.message, 'error');
      }
    },

    // ── Admins Management ──
    async loadAdmins() {
      const tbody = document.getElementById('admins-tbody');
      if (!tbody) return;
      try {
        const snap = await db.collection('users').where('role', '==', 'admin').get();
        if (snap.empty) {
          tbody.innerHTML = '<tr><td colspan="3" class="empty-state">لا يوجد مشرفون</td></tr>';
          return;
        }
        const currentUid = auth.currentUser ? auth.currentUser.uid : '';
        tbody.innerHTML = snap.docs.map(d => {
          const a = d.data();
          const isMe = d.id === currentUid;
          const isSuperAdmin = a.email === 'ja5009006@gmail.com';
          return `
            <tr>
              <td>
                <strong>${escapeHtml(a.name || 'مشرف')}</strong>
                ${isMe ? ' <span class="chip chip-primary">(أنت)</span>' : ''}
                ${isSuperAdmin ? ' <span class="chip">المالك</span>' : ''}
              </td>
              <td dir="ltr" style="text-align:right;">${escapeHtml(a.email || '')}</td>
              <td>
                ${(!isMe && !isSuperAdmin)
                  ? `<button class="btn btn-sm btn-danger" onclick="AdminApp.removeAdmin('${escapeAttr(d.id)}')">إزالة الصلاحية</button>`
                  : '—'}
              </td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        console.error('Error loading admins:', e);
      }
    },

    async createAdmin() {
      const email = document.getElementById('new-admin-email')?.value.trim() || '';
      const pass = document.getElementById('new-admin-pass')?.value.trim() || '';
      const name = document.getElementById('new-admin-name')?.value.trim() || '';

      if (!email || pass.length < 6 || !name) {
        showToast('الرجاء إدخال بيانات صحيحة (كلمة المرور 6 أحرف على الأقل)', 'error');
        return;
      }

      try {
        showToast('جاري إنشاء حساب المشرف...', 'info');
        if (!window.secondaryApp) {
          window.secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
        }
        const cred = await window.secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
        await db.collection('users').doc(cred.user.uid).set({
          email,
          name,
          role: 'admin',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await window.secondaryApp.auth().signOut();

        showToast('تم إنشاء حساب المشرف بنجاح', 'success');
        document.getElementById('new-admin-email').value = '';
        document.getElementById('new-admin-pass').value = '';
        document.getElementById('new-admin-name').value = '';
        await this.loadAdmins();
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
          const upgrade = await AdminDialog.confirm({
            title: 'البريد مسجل مسبقاً',
            message: 'هذا البريد الإلكتروني مسجل بالفعل. هل تريد ترقية حسابه إلى مشرف؟',
            confirmText: 'ترقية إلى مشرف'
          });
          if (upgrade) {
            const snap = await db.collection('users').where('email', '==', email).get();
            if (!snap.empty) {
              await db.collection('users').doc(snap.docs[0].id).update({ role: 'admin', name });
              showToast('تمت ترقية الحساب إلى مشرف بنجاح', 'success');
              await this.loadAdmins();
            } else {
              showToast('لم يتم العثور على وثيقة المستخدم في Firestore', 'error');
            }
          }
        } else {
          showToast('خطأ: ' + e.message, 'error');
        }
      }
    },

    async removeAdmin(uid) {
      const confirmed = await AdminDialog.confirm({
        title: 'إزالة صلاحية المشرف',
        message: 'هل أنت متأكد من إزالة صلاحية الإشراف عن هذا المستخدم؟',
        confirmText: 'إزالة الصلاحية',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('users').doc(uid).update({ role: 'client' });
        showToast('تمت إزالة الصلاحية بنجاح');
        await this.loadAdmins();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    }
  };

  window.UsersModule = UsersModule;
})();
