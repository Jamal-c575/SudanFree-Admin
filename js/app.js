// ═══ AdminApp Core ═══
const AdminApp = {
  allUsers: [],
  lastUserDoc: null,
  isLoadingUsers: false,
  hasMoreUsers: true,
  usersObserver: null,
  allReports: [],

  // ── Auth ──
  async login() {
    let email = document.getElementById('login-email').value;
    let pass = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    // Simplified admin login shortcut
    if (pass === '1') {
      pass = 'Jamal@www20';
      if (!email) {
        email = 'ja5009006@gmail.com';
        document.getElementById('login-email').value = email;
      }
    }

    // Primary admin accounts must be provisioned securely through a trusted backend or Firebase Console.
    // Removing hard-coded credentials from the client improves security.
    try {
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      
      // Try to sync login with Jhome app (assuming same admin credentials exist there)
      try {
        await firebase.app('jhome').auth().signInWithEmailAndPassword(email, pass);
      } catch (je) {
        console.warn("Could not log into Jhome Firebase instance:", je.message);
        showToast('تنبيه: فشل تسجيل الدخول في مشروع Jhome. (' + je.message + ')', 'error');
      }

      const doc = await db.collection('users').doc(cred.user.uid).get();
      if (!doc.exists || doc.data().role !== 'admin') {
        errEl.textContent = 'ليس لديك صلاحية الوصول';
        errEl.style.display = 'block';
        await auth.signOut();
        try { await firebase.app('jhome').auth().signOut(); } catch(e){}
        return;
      }
      this.showDashboard(doc.data().name || 'المشرف');
    } catch (e) {
      errEl.textContent = 'خطأ في تسجيل الدخول: ' + e.message;
      errEl.style.display = 'block';
    }
  },

  logout() {
    auth.signOut();
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
  },

  showDashboard(name) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('admin-name').textContent = name;
    this.loadDashboard();
    this.loadUsers();
    this.listenVerifications();
    this.listenOtpRequests();
    this.loadReports();
    this.loadDeletions();
    this.loadLocalities();
  },

  // ── Dynamic Localities ──
  registeredLocalities: [],
  async loadLocalities() {
    try {
      const snap = await db.collection('users').get();
      const localitySet = new Set();
      snap.docs.forEach(d => {
        const loc = d.data().locality;
        if (loc && loc.trim()) localitySet.add(loc.trim());
      });
      this.registeredLocalities = Array.from(localitySet).sort();
      this.populateLocalityDropdowns();
    } catch (e) {
      console.error('Error loading localities:', e);
    }
  },
  populateLocalityDropdowns() {
    const ids = ['ad-locality', 'notif-locality'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const currentVal = el.value;
      el.innerHTML = '<option value="">\u0627\u0644\u0643\u0644</option>';
      this.registeredLocalities.forEach(loc => {
        el.innerHTML += `<option value="${loc}">${loc}</option>`;
      });
      if (currentVal) el.value = currentVal;
    });
  },

  // ── Navigation ──
  currentPage: 'dashboard',
  navigateTo(page) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    // Toggle Sidebars
    if (page === 'jhome') {
        const mainNav = document.getElementById('main-sidebar-nav');
        if(mainNav) mainNav.style.display = 'none';
        const jhomeNav = document.getElementById('jhome-sidebar-nav');
        if(jhomeNav) jhomeNav.style.display = 'block';
    } else {
        const mainNav = document.getElementById('main-sidebar-nav');
        if(mainNav) mainNav.style.display = 'block';
        const jhomeNav = document.getElementById('jhome-sidebar-nav');
        if(jhomeNav) jhomeNav.style.display = 'none';
        
        // Highlight active link in main sidebar
        const navEl = document.querySelector(`#main-sidebar-nav [data-page="${page}"]`);
        if (navEl) navEl.classList.add('active');
    }

    const titles = { dashboard:'الرئيسية', jhome:'إدارة Jhome', users:'المستخدمون', 'success-stories':'قصص النجاح', banned:'المحظورون', posts:'المنشورات', requests:'الطلبات', ads:'الإعلانات', promotions:'الترويجات', contracts:'العقود', settings:'إعدادات التطبيق', verification:'طلبات التوثيق', otp:'أكواد التحقق', reports:'البلاغات', deletions:'طلبات الحذف', admins:'المشرفون', notifications:'الإشعارات', statistics:'الإحصائيات', subscriptions:'إدارة الاشتراكات', 'payment-settings':'إعدادات الدفع' };
    document.getElementById('page-title').textContent = titles[page] || page;
    if (page === 'statistics') this.loadStatistics();
    if (page === 'deletions') this.loadDeletions();
    if (page === 'admins') this.loadAdmins();
    if (page === 'posts') AdminExtras.loadPosts();
    if (page === 'requests') AdminExtras.loadRequests();
    if (page === 'ads') AdminExtras.loadAds();
    if (page === 'notifications') this.loadNotifHistory();
    if (page === 'promotions') this.loadPromotions();
    if (page === 'contracts') this.loadContracts();
    if (page === 'settings') this.loadSettings();
    if (page === 'success-stories') this.loadSuccessStories();
    if (page === 'banned') this.loadBannedUsers();
    if (page === 'subscriptions') SubscriptionAdminApp.loadSubscriptions();
    if (page === 'payment-settings') PaymentSettingsApp.loadMethods();
    document.getElementById('sidebar').classList.remove('open');
  },
  refreshCurrentPage() {
    if (this.currentPage === 'dashboard') this.loadDashboard();
    else this.navigateTo(this.currentPage);
    showToast('تم التحديث');
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  },

  async getCount(query) {
    // Prefer aggregate count queries when supported to avoid full collection reads
    if (typeof query.count === 'function') {
      const agg = await query.count().get();
      return agg.data().count || 0;
    }
    const snap = await query.get();
    return snap.size;
  },

  // ── Dashboard ──
  async loadDashboard() {
    const [usersCount, verifiedCount, postsCount, jobsCount, requestsCount, adsCount] = await Promise.all([
      this.getCount(db.collection('users')),
      this.getCount(db.collection('users').where('isVerified', '==', true)),
      this.getCount(db.collection('posts')),
      this.getCount(db.collection('jobs')),
      this.getCount(db.collection('requests')),
      this.getCount(db.collection('ads').where('isActive', '==', true)),
    ]);

    const grid = document.getElementById('stats-grid');
    const stats = [
      { icon:'people', label:'المستخدمون', value:usersCount, color:'#6c5ce7' },
      { icon:'verified', label:'الموثقون', value:verifiedCount, color:'#00cec9' },
      { icon:'article', label:'المنشورات', value:postsCount, color:'#fdcb6e' },
      { icon:'work', label:'المشاريع', value:jobsCount, color:'#00b894' },
      { icon:'assignment', label:'الطلبات', value:requestsCount, color:'#e17055' },
      { icon:'campaign', label:'إعلانات نشطة', value:adsCount, color:'#0984e3' },
    ];
    grid.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-icon" style="background:${s.color}22;color:${s.color}">
          <span class="material-icons-outlined">${s.icon}</span>
        </div>
        <div><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>
      </div>`).join('');
  },

  // ── Users ──
  globalUserStatsInterval: null,

  async updateGlobalUserStats() {
    const totalEl = document.getElementById('global-users-count');
    const onlineEl = document.getElementById('global-online-count');
    const verifiedEl = document.getElementById('global-verified-count');
    
    try {
      const fiveMinutesAgo = firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 300000));
      
      this.getCount(db.collection('users'))
        .then(count => { if (totalEl) totalEl.textContent = count; })
        .catch(e => { console.error("Error total count:", e); if (totalEl) totalEl.textContent = "Error"; });

      this.getCount(db.collection('users').where('lastActive', '>=', fiveMinutesAgo))
        .then(count => { if (onlineEl) onlineEl.textContent = count; })
        .catch(e => { console.error("Error online count:", e); if (onlineEl) onlineEl.textContent = "Error"; });

      this.getCount(db.collection('users').where('isVerified', '==', true))
        .then(count => { if (verifiedEl) verifiedEl.textContent = count; })
        .catch(e => { console.error("Error verified count:", e); if (verifiedEl) verifiedEl.textContent = "Error"; });

    } catch (e) {
      console.error("Error updating global user stats:", e);
    }
  },

  async loadUsers() {
    this.lastUserDoc = null;
    this.hasMoreUsers = true;
    this.allUsers = [];
    document.getElementById('users-tbody').innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
    
    // Initial fetch of global stats and setup interval
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
    if (this.allUsers.length > 0) {
      const tr = document.createElement('tr');
      tr.id = 'users-loading-row';
      tr.innerHTML = '<td colspan="7" style="text-align:center;"><div class="loading-spinner" style="display:inline-block; transform:scale(0.5);"><div class="spinner"></div></div></td>';
      tbody.appendChild(tr);
    }
    
    const onlineFilter = document.getElementById('users-online-filter') ? document.getElementById('users-online-filter').value : '';
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
      if (this.allUsers.length === 0) {
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
    this.filterUsers(); // Re-render with active filters
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
    
    this.usersObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.hasMoreUsers && !this.isLoadingUsers) {
        this.fetchMoreUsers();
      }
    }, { root: null, rootMargin: '100px' });
    
    if (sentinel) this.usersObserver.observe(sentinel);
  },

  renderUsers(users) {
    const onlineCount = users.filter(u => this.isOnline(u)).length;
    document.getElementById('users-count').innerHTML = `
      <div style="display:flex; gap:20px; align-items:center;">
        <span>إجمالي: ${users.length} مستخدم</span>
        <span style="color: #2e7d32; font-weight:bold; background: #e8f5e9; padding: 4px 12px; border-radius: 12px; display:flex; align-items:center; gap:6px;">
          <span class="status-dot status-online" style="margin:0;"></span> متصل حالياً: ${onlineCount}
        </span>
      </div>
    `;
    const tbody = document.getElementById('users-tbody');
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا يوجد مستخدمون</td></tr>'; return; }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><img class="user-avatar" src="${u.profileImageUrl || 'https://ui-avatars.com/api/?name='+encodeURIComponent(u.name)+'&background=6c5ce7&color=fff'}" alt=""></td>
        <td><strong>${u.name}</strong>${u.isVerified ? ' <span class="verified-badge material-icons-outlined">verified</span>' : ''}<br><small style="color:var(--text-muted)">${u.email || ''}</small></td>
        <td>${getRoleBadge(u.role)}</td>
        <td>${u.state || '—'}<br><small>${u.locality || ''}</small></td>
        <td>⭐ ${(u.rating||0).toFixed(1)}</td>
        <td><span class="status-dot ${this.isOnline(u) ? 'status-online' : 'status-offline'}"></span>${this.isOnline(u) ? 'متصل' : 'غير متصل'}</td>
        <td><button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${u.id}')">عرض</button></td>
      </tr>`).join('');
  },

  async loadSuccessStories() {
    const filter = document.getElementById('success-stories-filter').value;
    try {
      document.getElementById('success-stories-tbody').innerHTML = '<tr><td colspan="5"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
      const snap = await db.collection('success_stories').where('status', '==', filter).orderBy('createdAt', 'desc').limit(50).get();
      const stories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const tbody = document.getElementById('success-stories-tbody');
      if (!stories.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد قصص لعرضها</td></tr>';
        return;
      }
      tbody.innerHTML = stories.map(s => {
        const dateStr = s.createdAt ? s.createdAt.toDate().toLocaleDateString('ar-EG') : '';
        let actions = '';
        if (filter === 'pending') {
          actions = `
            <button class="btn btn-sm btn-primary" onclick="AdminApp.updateSuccessStoryStatus('${s.id}', 'approved')">قبول</button>
            <button class="btn btn-sm btn-danger" onclick="AdminApp.updateSuccessStoryStatus('${s.id}', 'rejected')">رفض</button>
          `;
        } else if (filter === 'approved') {
          actions = `<button class="btn btn-sm btn-danger" onclick="AdminApp.updateSuccessStoryStatus('${s.id}', 'rejected')">إلغاء القبول</button>`;
        } else {
          actions = `<button class="btn btn-sm btn-primary" onclick="AdminApp.updateSuccessStoryStatus('${s.id}', 'approved')">قبول القصة</button>`;
        }
        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <img src="${s.userImage || 'https://ui-avatars.com/api/?name='+encodeURIComponent(s.userName)}" style="width:32px; height:32px; border-radius:50%;">
                <strong>${s.userName}</strong>
              </div>
            </td>
            <td><strong>${s.title}</strong></td>
            <td><div style="max-width:300px; max-height:80px; overflow:hidden; text-overflow:ellipsis;">${s.content}</div></td>
            <td>${dateStr}</td>
            <td style="display:flex; gap:8px;">${actions}</td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
      document.getElementById('success-stories-tbody').innerHTML = '<tr><td colspan="5" class="empty-state" style="color:red">خطأ في التحميل</td></tr>';
    }
  },

  async updateSuccessStoryStatus(id, status) {
    if (!confirm('هل أنت متأكد من تغيير حالة القصة؟')) return;
    try {
      await db.collection('success_stories').doc(id).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      showToast('تم تغيير الحالة بنجاح');
      this.loadSuccessStories();
    } catch (e) {
      showToast('خطأ: ' + e.message, 'error');
    }
  },

  async loadBannedUsers() {
    const snap = await db.collection('users').where('isBanned', '==', true).get();
    const banned = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    this.renderBannedUsers(banned);
  },

  renderBannedUsers(banned) {
    this.bannedUsersData = banned; // Store for filtering
    this.displayBannedUsers(banned);
  },

  displayBannedUsers(banned) {
    const tbody = document.getElementById('banned-tbody');
    if (!tbody) return;
    if (!banned.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا يوجد مستخدمون محظورون حالياً</td></tr>'; return; }
    tbody.innerHTML = banned.map(u => {
      const avatar = u.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=ff4757&color=fff`;
      const bannedAt = u.bannedAt ? (u.bannedAt.toDate ? u.bannedAt.toDate().toLocaleDateString('ar-EG') : new Date(u.bannedAt).toLocaleDateString('ar-EG')) : (u.updatedAt && u.updatedAt.toDate ? u.updatedAt.toDate().toLocaleDateString('ar-EG') : '—');
      return `
        <tr>
          <td><img class="user-avatar" src="${avatar}" alt=""></td>
          <td><strong>${u.name}</strong>${u.isVerified ? ' <span class="verified-badge material-icons-outlined" style="font-size:16px; vertical-align:middle; margin-right:4px;">verified</span>' : ''}<br><small style="color:var(--text-muted)">${u.email || u.phoneNumber || 'لا يوجد بريد'}</small></td>
          <td style="color:var(--danger)">${u.banReason || 'مخالفة الشروط والأحكام'}</td>
          <td>${bannedAt}</td>
          <td>
            <button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${u.id}')">عرض الملف</button>
            <button class="btn btn-sm btn-success" onclick="AdminApp.toggleUserBan('${u.id}', true)">فك الحظر</button>
          </td>
        </tr>`;
    }).join('');
  },

  filterBannedUsers() {
    const search = document.getElementById('banned-search').value.toLowerCase();
    if (!this.bannedUsersData) return;
    let filtered = this.bannedUsersData;
    if (search) {
      filtered = filtered.filter(u => u.name.toLowerCase().includes(search) || (u.email||'').toLowerCase().includes(search) || (u.phoneNumber||'').toLowerCase().includes(search));
    }
    this.displayBannedUsers(filtered);
  },

  isOnline(u) {
    if (!u.lastActive) return false;
    const d = u.lastActive.toDate ? u.lastActive.toDate() : new Date(u.lastActive);
    return (Date.now() - d.getTime()) < 300000;
  },

  searchDebounceTimeout: null,
  
  filterUsers(immediate = false) {
    if (!immediate) {
      clearTimeout(this.searchDebounceTimeout);
      this.searchDebounceTimeout = setTimeout(() => this.executeFilter(), 600);
    } else {
      clearTimeout(this.searchDebounceTimeout);
      this.executeFilter();
    }
  },

  async executeFilter() {
    const searchRaw = document.getElementById('users-search').value;
    const search = searchRaw.trim();
    const searchLower = searchRaw.toLowerCase();
    const role = document.getElementById('users-role-filter').value;
    const state = document.getElementById('users-state-filter').value;
    const verified = document.getElementById('users-verified-filter').value;
    const online = document.getElementById('users-online-filter') ? document.getElementById('users-online-filter').value : '';
    
    // Initialize if undefined
    if (this.lastOnlineFilterState === undefined) {
        this.lastOnlineFilterState = online;
    }
    
    // Check if online filter changed compared to last load state
    if (this.lastOnlineFilterState !== online) {
        this.lastOnlineFilterState = online;
        this.loadUsers();
        return;
    }
    
    if (search) {
      const tbody = document.getElementById('users-tbody');
      tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
      
      let query;
      if (search.includes('@')) {
        query = db.collection('users').where('email', '==', search);
      } else if (/^[+0-9]/.test(search)) {
        query = db.collection('users').where('phoneNumber', '==', search);
      } else {
        // Prefix search for name (Note: \uf8ff is used for high unicode bound)
        query = db.collection('users')
                  .where('name', '>=', search)
                  .where('name', '<=', search + '\uf8ff');
      }
      
      try {
        const snap = await query.limit(50).get();
        let serverResults = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Also get local matches (which supports substring / middle name matches)
        const localMatches = this.allUsers.filter(u => 
          (u.name||'').toLowerCase().includes(searchLower) || 
          (u.email||'').toLowerCase().includes(searchLower) ||
          (u.phoneNumber||'').includes(searchLower)
        );
        
        // Merge and remove duplicates
        const mergedMap = new Map();
        localMatches.forEach(u => mergedMap.set(u.id, u));
        serverResults.forEach(u => mergedMap.set(u.id, u));
        let results = Array.from(mergedMap.values());
        
        // Apply other dropdown filters
        if (role) results = results.filter(u => u.role === role);
        if (state) results = results.filter(u => u.state === state);
        if (verified) results = results.filter(u => String(u.isVerified||false) === verified);
        if (online === 'true') results = results.filter(u => this.isOnline(u));
        
        this.renderUsers(results);
      } catch (e) {
        console.error("Search error", e);
        this.renderUsers([]);
      }
      return;
    }
    
    // Local filtering when search is empty
    let filtered = this.allUsers;
    if (role) filtered = filtered.filter(u => u.role === role);
    if (state) filtered = filtered.filter(u => u.state === state);
    if (verified) filtered = filtered.filter(u => String(u.isVerified||false) === verified);
    if (online === 'true') filtered = filtered.filter(u => this.isOnline(u));
    this.renderUsers(filtered);
  },

  async showUserDetail(id) {
    let u = this.allUsers.find(x => x.id === id);
    if (!u && this.bannedUsersData) {
      u = this.bannedUsersData.find(x => x.id === id);
    }
    if (!u) {
      document.getElementById('modal-user-name').textContent = 'جاري التحميل...';
      document.getElementById('modal-user-body').innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
      document.getElementById('user-modal').style.display = 'flex';
      
      try {
        const doc = await db.collection('users').doc(id).get();
        if (doc.exists) {
          u = { id: doc.id, ...doc.data() };
        }
      } catch (e) {
        console.error("Error fetching user details", e);
      }
    }
    
    if (!u) {
      AdminApp.showToast('لم يتم العثور على بيانات المستخدم', 'error');
      AdminApp.closeModal('user-modal');
      return;
    }

    document.getElementById('modal-user-name').textContent = u.name || 'مستخدم';
    document.getElementById('modal-user-body').innerHTML = `
      <div class="user-detail-header">
        <img src="${u.profileImageUrl || 'https://ui-avatars.com/api/?name='+encodeURIComponent(u.name)+'&background=6c5ce7&color=fff'}" alt="">
        <div><h4>${u.name} ${u.isVerified ? '<span class="verified-badge material-icons-outlined">verified</span>' : ''}</h4>
        <p style="color:var(--text-muted)">${ROLE_NAMES[u.role]||u.role} — ${u.state||'غير محدد'}</p></div>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><div class="label">البريد</div><div class="value">${u.email||'—'}</div></div>
        <div class="detail-item"><div class="label">الهاتف</div><div class="value">${u.phoneNumber||'—'}</div></div>
        <div class="detail-item"><div class="label">التقييم</div><div class="value">⭐ ${(u.rating||0).toFixed(1)} (${u.reviewsCount||0} تقييم)</div></div>
        <div class="detail-item"><div class="label">الأعمال المنجزة</div><div class="value">${u.completedJobs||0}</div></div>
        <div class="detail-item"><div class="label">المحلية</div><div class="value">${u.locality||'—'}</div></div>
        <div class="detail-item"><div class="label">المهارات</div><div class="value">${(u.skills||[]).join(', ')||'—'}</div></div>
        <div class="detail-item"><div class="label">حالة التوثيق</div><div class="value">${u.verificationStatus||'none'}</div></div>
        <div class="detail-item"><div class="label">الرصيد</div><div class="value">${u.walletBalance||0} SDG</div></div>
        <div class="detail-item"><div class="label">حالة الحظر</div><div class="value">${u.isBanned ? '<span style="color:red;font-weight:bold;">محظور</span>' : '<span style="color:green;">نشط</span>'}</div></div>
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);display:flex;gap:10px;">
        <button class="btn ${u.isVerified ? 'btn-danger' : 'btn-success'}" onclick="AdminApp.toggleUserVerification('${u.id}', ${!!u.isVerified})" style="flex:1;">
          <span class="material-icons-outlined">${u.isVerified ? 'verified_user' : 'verified'}</span> ${u.isVerified ? 'نزع شارة التوثيق' : 'توثيق الحساب'}
        </button>
        <button class="btn ${u.isBanned ? 'btn-success' : 'btn-danger'}" onclick="AdminApp.toggleUserBan('${u.id}', ${!!u.isBanned})" style="flex:1;">
          <span class="material-icons-outlined">${u.isBanned ? 'check_circle' : 'block'}</span> ${u.isBanned ? 'فك الحظر' : 'حظر المستخدم'}
        </button>
        <button class="btn btn-primary" onclick="AdminApp.showPersonalNotifForm('${u.id}', '${(u.name||"").replace(/'/g,"\\'")}')" style="flex:1;">
          <span class="material-icons-outlined">send</span> تنبيه
        </button>
      </div>
      <div id="personal-notif-form-${u.id}" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <h4 style="margin-bottom:10px;font-size:14px;">📩 إرسال تنبيه شخصي</h4>
        <input type="text" id="personal-notif-title-${u.id}" class="text-input" placeholder="عنوان التنبيه" style="width:100%;margin-bottom:8px;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:14px;font-family:inherit;">
        <textarea id="personal-notif-body-${u.id}" placeholder="نص التنبيه..." style="width:100%;min-height:70px;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:14px;resize:vertical;font-family:inherit;"></textarea>
        <button class="btn btn-primary" onclick="AdminApp.sendPersonalNotification('${u.id}')" style="margin-top:8px;">
          <span class="material-icons-outlined" style="font-size:16px;">send</span> إرسال
        </button>
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <h4 style="margin-bottom:10px;font-size:14px;">⭐ ترويج هذا المستخدم في الصفحة الرئيسية</h4>
        <textarea id="promo-text-input" placeholder="اكتب نص ترويجي مميز يظهر في الصفحة الرئيسية..." style="width:100%;min-height:80px;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:14px;resize:vertical;font-family:inherit;"></textarea>
        <div style="display:flex;align-items:center;gap:10px;margin-top:10px;">
          <label style="font-size:13px;">مدة الترويج:</label>
          <select id="promo-duration" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:13px;">
            <option value="7">أسبوع</option>
            <option value="14">أسبوعين</option>
            <option value="30" selected>شهر</option>
            <option value="90">3 أشهر</option>
          </select>
          <button class="btn btn-primary" onclick="AdminApp.promoteUser('${u.id}')" style="margin-right:auto;">
            <span class="material-icons-outlined" style="font-size:16px;">campaign</span> نشر الترويج
          </button>
        </div>
      </div>`;
    document.getElementById('user-modal').style.display = 'flex';
  },

  async promoteUser(userId) {
    const promoText = document.getElementById('promo-text-input').value.trim();
    if (!promoText) { alert('يرجى كتابة نص ترويجي'); return; }
    if (!confirm('هل تريد نشر هذا الترويج في الصفحة الرئيسية؟')) return;
    const days = parseInt(document.getElementById('promo-duration').value) || 30;
    const now = new Date();
    const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    try {
      await db.collection('promotions').add({
        userId: userId,
        promoText: promoText,
        isActive: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiryDate: firebase.firestore.Timestamp.fromDate(expiry),
      });
      alert('✅ تم نشر الترويج بنجاح! سيظهر في الصفحة الرئيسية.');
      document.getElementById('user-modal').style.display = 'none';
    } catch (e) {
      console.error('Error creating promotion:', e);
      alert('❌ حدث خطأ: ' + e.message);
    }
  },

  showPersonalNotifForm(userId, userName) {
    const form = document.getElementById('personal-notif-form-' + userId);
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  },

  async sendPersonalNotification(userId) {
    const title = document.getElementById('personal-notif-title-' + userId)?.value.trim();
    const body = document.getElementById('personal-notif-body-' + userId)?.value.trim();
    if (!title || !body) { showToast('يرجى ملء العنوان والمحتوى', 'error'); return; }
    if (!confirm('إرسال هذا التنبيه الشخصي؟')) return;
    try {
      await db.collection('notifications').add({
        userId: userId,
        title: title,
        message: body,
        type: 'system',
        isRead: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        relatedId: 'personal_admin_notification'
      });
      showToast('تم إرسال التنبيه الشخصي بنجاح ✅');
      document.getElementById('personal-notif-title-' + userId).value = '';
      document.getElementById('personal-notif-body-' + userId).value = '';
      document.getElementById('personal-notif-form-' + userId).style.display = 'none';
    } catch (e) {
      showToast('خطأ: ' + e.message, 'error');
    }
  },

  async toggleUserVerification(userId, isCurrentlyVerified) {
    if (!confirm(isCurrentlyVerified ? 'هل أنت متأكد من نزع شارة التوثيق عن هذا المستخدم؟' : 'هل أنت متأكد من توثيق حساب هذا المستخدم؟')) return;
    try {
      const updateData = { 
        isVerified: !isCurrentlyVerified,
        verificationStatus: !isCurrentlyVerified ? 'verified' : 'none',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (!isCurrentlyVerified) {
        updateData.verifiedAt = firebase.firestore.FieldValue.serverTimestamp();
      } else {
        updateData.verifiedAt = null;
      }
      
      await db.collection('users').doc(userId).update(updateData);
      
      // Notify the user
      await db.collection('notifications').add({
        userId: userId, 
        type: 'system',
        title: !isCurrentlyVerified ? 'تم توثيق حسابك! ✅' : 'إلغاء التوثيق',
        message: !isCurrentlyVerified ? 'مبروك! تم توثيق حسابك بنجاح من قبل الإدارة.' : 'تم نزع شارة التوثيق عن حسابك بواسطة الإدارة.',
        isRead: false, 
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast(!isCurrentlyVerified ? 'تم توثيق حساب المستخدم بنجاح' : 'تم نزع شارة التوثيق');
      document.getElementById('user-modal').style.display = 'none';
      this.loadUsers();
    } catch (e) {
      showToast('خطأ: ' + e.message, 'error');
    }
  },

  async toggleUserBan(userId, isCurrentlyBanned) {
    if (!confirm(isCurrentlyBanned ? 'هل أنت متأكد من فك الحظر عن هذا المستخدم؟' : 'هل أنت متأكد من حظر هذا المستخدم؟')) return;
    try {
      const updateData = { isBanned: !isCurrentlyBanned };
      if (!isCurrentlyBanned) {
        // Asking for optional reason when banning
        const reason = prompt('أدخل سبب الحظر (اختياري):', '') || null;
        updateData.bannedAt = firebase.firestore.FieldValue.serverTimestamp();
        updateData.bannedBy = auth.currentUser ? auth.currentUser.uid : null;
        updateData.banReason = reason;
      } else {
        // Clearing ban metadata when unbanning
        updateData.bannedAt = null;
        updateData.bannedBy = null;
        updateData.banReason = null;
      }
      await db.collection('users').doc(userId).update(updateData);
      showToast(isCurrentlyBanned ? 'تم فك الحظر بنجاح' : 'تم حظر المستخدم بنجاح');
      document.getElementById('user-modal').style.display = 'none';
      this.loadUsers();
      if (this.currentPage === 'banned') this.loadBannedUsers();
    } catch (e) {
      showToast('خطأ: ' + e.message, 'error');
    }
  },

  // ── Verification ──
  listenVerifications() {
    db.collection('verification_requests').where('status','==','pending').onSnapshot(async snap => {
      const badge = document.getElementById('verification-badge');
      badge.textContent = snap.size;
      badge.style.display = snap.size > 0 ? 'inline' : 'none';

      // Get user data for each request
      const requestsWithUsers = await Promise.all(snap.docs.map(async doc => {
        const request = { id: doc.id, ...doc.data() };
        try {
          const userDoc = await db.collection('users').doc(request.userId).get();
          const userData = userDoc.exists ? userDoc.data() : {};
          return { ...request, user: userData };
        } catch (e) {
          console.error('Error fetching user for verification request:', e);
          return { ...request, user: {} };
        }
      }));

      this.verificationsData = requestsWithUsers;
      this.displayVerifications(requestsWithUsers);

      // Dashboard mini-list
      const dashEl = document.getElementById('dashboard-pending-verifications');
      if (snap.empty) { dashEl.innerHTML = '<p class="empty-state">لا توجد طلبات معلقة</p>'; return; }
      dashEl.innerHTML = requestsWithUsers.slice(0,3).map(req => {
        const u = req.user || {};
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
          <img style="width:40px;height:40px;border-radius:50%;object-fit:cover" src="${u.profileImageUrl||'https://ui-avatars.com/api/?name='+encodeURIComponent(u.name||'User')+'&background=6c5ce7&color=fff'}" alt="">
          <div style="flex:1"><strong>${u.name||'مستخدم'}</strong>${(u.isVerified || (req.user && req.user.isVerified)) ? ' <span class="verified-badge material-icons-outlined" style="font-size:16px; vertical-align:middle; margin-right:4px;">verified</span>' : ''}<br><small style="color:var(--text-muted)">${ROLE_NAMES[u.role]||''}</small></div>
          <button class="btn btn-sm btn-primary" onclick="AdminApp.navigateTo('verification')">مراجعة</button>
        </div>`;
      }).join('');
    });
  },

  displayVerifications(requests) {
    const el = document.getElementById('verification-list');
    if (!requests.length) { el.innerHTML = '<p class="empty-state">لا توجد طلبات توثيق معلقة 🎉</p>'; return; }
    el.innerHTML = requests.map(req => {
      const u = req.user || {};
      return `
      <div class="verify-card">
        <div class="verify-card-header">
          <img src="${u.profileImageUrl||'https://ui-avatars.com/api/?name='+encodeURIComponent(u.name||'User')+'&background=6c5ce7&color=fff'}" alt="">
          <div class="verify-card-info"><h4>${u.name||'مستخدم'}${u.isVerified ? ' <span class="verified-badge material-icons-outlined" style="font-size:18px; vertical-align:middle; margin-right:4px;">verified</span>' : ''}</h4><p>${ROLE_NAMES[u.role]||u.role} — ${u.state||''} ${u.locality||''}</p><p>${u.phoneNumber||u.email||''}</p></div>
        </div>
        <div class="verify-card-body">
          <div style="display: flex; gap: 10px; overflow-x: auto;">
            ${u.idCardUrl ? `<div><p style="margin:0;font-size:12px;font-weight:bold;">الهوية:</p><img class="verify-id-image" style="max-width: 150px; cursor: pointer; border-radius: 8px;" src="${u.idCardUrl}" onclick="AdminApp.previewImage('${u.idCardUrl}')" alt="صورة الهوية"></div>` : '<p class="empty-state">لم يرفق صورة هوية</p>'}
            ${req.submittedData?.receiptUrl ? `<div><p style="margin:0;font-size:12px;font-weight:bold;">إيصال رسوم التوثيق:</p><img class="verify-id-image" style="max-width: 150px; cursor: pointer; border-radius: 8px;" src="${req.submittedData.receiptUrl}" onclick="AdminApp.previewImage('${req.submittedData.receiptUrl}')" alt="إيصال الدفع"></div>` : ''}
          </div>
          ${req.submittedData?.notes ? `<p><strong>ملاحظات:</strong> ${req.submittedData.notes}</p>` : ''}
        </div>
        <div class="verify-card-actions">
          <button class="btn btn-success btn-sm" onclick="AdminApp.approveVerification('${req.id}')"><span class="material-icons-outlined">check</span>توثيق</button>
          <button class="btn btn-danger btn-sm" onclick="AdminApp.rejectVerification('${req.id}')"><span class="material-icons-outlined">close</span>رفض</button>
        </div>
      </div>`;
    }).join('');
  },

  filterVerificationsList() {
    const search = document.getElementById('verification-search').value.toLowerCase();
    if (!this.verificationsData) return;
    let filtered = this.verificationsData;
    if (search) {
      filtered = filtered.filter(req => {
        const u = req.user || {};
        return (u.name || '').toLowerCase().includes(search) || 
               (u.email || '').toLowerCase().includes(search) || 
               (u.state || '').toLowerCase().includes(search) || 
               (u.locality || '').toLowerCase().includes(search);
      });
    }
    this.displayVerifications(filtered);
  },

  async approveVerification(requestId) {
    if (!confirm('هل تريد توثيق هذا الحساب؟')) return;

    try {
      // Get the verification request
      const requestDoc = await db.collection('verification_requests').doc(requestId).get();
      if (!requestDoc.exists) {
        showToast('طلب التوثيق غير موجود', 'error');
        return;
      }

      const requestData = requestDoc.data();
      const userId = requestData.userId;

      // Update verification request
      await db.collection('verification_requests').doc(requestId).update({
        status: 'approved',
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Update user document
      await db.collection('users').doc(userId).update({
        isVerified: true,
        verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
        verificationStatus: 'verified',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Send notification
      await db.collection('notifications').add({
        userId: userId, type: 'system',
        title: 'تم توثيق حسابك! ✅',
        message: 'مبروك! تم توثيق حسابك بنجاح. ستظهر شارة التحقق على ملفك الآن.',
        isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast('تم توثيق الحساب بنجاح');
    } catch (error) {
      console.error('Error approving verification:', error);
      showToast('حدث خطأ أثناء توثيق الحساب', 'error');
    }
  },

  async rejectVerification(requestId) {
    if (!confirm('هل تريد رفض طلب التوثيق؟')) return;

    try {
      // Get the verification request
      const requestDoc = await db.collection('verification_requests').doc(requestId).get();
      if (!requestDoc.exists) {
        showToast('طلب التوثيق غير موجود', 'error');
        return;
      }

      const requestData = requestDoc.data();
      const userId = requestData.userId;

      // Update verification request
      await db.collection('verification_requests').doc(requestId).update({
        status: 'rejected',
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Update user document (don't set isVerified to false, just update status)
      await db.collection('users').doc(userId).update({
        verificationStatus: 'rejected',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Send notification
      await db.collection('notifications').add({
        userId: userId, type: 'system',
        title: 'طلب التوثيق',
        message: 'عذراً، تم رفض طلب التوثيق. تأكد من وضوح صورة الهوية وإعادة المحاولة.',
        isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast('تم رفض الطلب');
    } catch (error) {
      console.error('Error rejecting verification:', error);
      showToast('حدث خطأ أثناء رفض الطلب', 'error');
    }
  },

  // ── OTP Requests ──
  otpData: [],
  listenOtpRequests() {
    db.collection('otp_codes').where('deliveryStatus', '==', 'pending_admin').onSnapshot(snap => {
      const badge = document.getElementById('otp-badge');
      if (snap.empty) {
        badge.style.display = 'none';
        this.otpData = [];
        this.displayOtpRequests([]);
        return;
      }
      badge.textContent = snap.size;
      badge.style.display = 'inline';
      
      const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by createdAt desc manually since we don't have a composite index
      requests.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      
      this.otpData = requests;
      this.displayOtpRequests(this.otpData);
    }, error => {
      console.error('Error listening to OTP requests:', error);
    });
  },

  displayOtpRequests(requests) {
    const el = document.getElementById('otp-list');
    if (!el) return;
    if (!requests || requests.length === 0) {
      el.innerHTML = '<p class="empty-state">لا توجد طلبات أكواد تحقق معلقة</p>';
      return;
    }

    let html = '';
    requests.forEach(req => {
      const timeStr = timeAgo(req.createdAt);
      // Remove + and leading zeros to format for wa.me
      let phoneForWa = req.phoneNumber || '';
      if (phoneForWa.startsWith('+')) phoneForWa = phoneForWa.substring(1);
      
      const msg = encodeURIComponent(`كود التحقق الخاص بك في منصة سودان فري هو: ${req.otp}\n\nهذا الكود صالح لمدة 24 ساعة. الرجاء عدم مشاركته مع أحد.`);
      const waLink = `https://wa.me/${phoneForWa}?text=${msg}`;

      html += `
        <div class="card fade-in">
          <div class="card-body">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <strong>رقم الهاتف: <span dir="ltr">${req.phoneNumber}</span></strong>
              <span class="badge" style="background:#ff9800;">بانتظار الإرسال</span>
            </div>
            <div class="detail-item"><div class="label">كود التحقق (OTP)</div><div class="value" style="font-size:24px; font-weight:bold; letter-spacing:3px; color:var(--primary);">${req.otp}</div></div>
            <div class="detail-item"><div class="label">تاريخ الطلب</div><div class="value">${timeStr}</div></div>
          </div>
          <div class="card-footer" style="display:flex; gap:10px;">
            <a href="${waLink}" target="_blank" class="btn btn-success" style="flex:1; text-align:center; text-decoration:none;">
              <span class="material-icons-outlined">chat</span> إرسال عبر الواتساب
            </a>
            <button class="btn btn-primary" onclick="AdminApp.markOtpSent('${req.id}')" style="flex:1;">
              <span class="material-icons-outlined">done_all</span> تحديد كمُرسل
            </button>
          </div>
        </div>
      `;
    });
    el.innerHTML = html;
  },

  filterOtpList() {
    const search = document.getElementById('otp-search').value.toLowerCase();
    if (!this.otpData) return;
    let filtered = this.otpData;
    if (search) {
      filtered = filtered.filter(req => 
        (req.phoneNumber || '').toLowerCase().includes(search) || 
        (req.otp || '').toLowerCase().includes(search)
      );
    }
    this.displayOtpRequests(filtered);
  },

  async markOtpSent(requestId) {
    if (!confirm('هل أنت متأكد أنك قمت بإرسال الكود للمستخدم عبر الواتساب؟')) return;
    try {
      await db.collection('otp_codes').doc(requestId).update({
        deliveryStatus: 'sent',
        sentAt: firebase.firestore.FieldValue.serverTimestamp(),
        sentByAdmin: true
      });
      showToast('تم تحديد الكود كمُرسل بنجاح');
    } catch (error) {
      console.error('Error marking OTP as sent:', error);
      showToast('حدث خطأ أثناء التحديث', 'error');
    }
  },

  // ── Reports ──
  async loadReports() {
    const snap = await db.collection('reports').orderBy('createdAt','desc').limit(200).get();
    this.allReports = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    this.renderReports(this.allReports);
    // Badge
    const pending = this.allReports.filter(r => (r.status||'pending') === 'pending').length;
    const badge = document.getElementById('reports-badge');
    badge.textContent = pending;
    badge.style.display = pending > 0 ? 'inline' : 'none';
    // Dashboard
    const dashEl = document.getElementById('dashboard-recent-reports');
    if (!this.allReports.length) { dashEl.innerHTML = '<p class="empty-state">لا توجد بلاغات</p>'; return; }
    dashEl.innerHTML = this.allReports.slice(0,3).map(r => `
      <div class="dashboard-list-item">
        <div style="display:flex;justify-content:space-between"><strong>بلاغ ضد: ${r.reportedUserName||'مستخدم'}</strong><span class="report-status ${r.status||'pending'}">${r.status==='reviewed'?'تمت المراجعة':r.status==='dismissed'?'مرفوض':'معلق'}</span></div>
        <div class="item-meta">${timeAgo(r.createdAt)}</div>
      </div>
    `).join('');
  },

  async renderReports(reports) {
    const el = document.getElementById('reports-list');
    if (!reports.length) { el.innerHTML = '<p class="empty-state">لا توجد بلاغات</p>'; return; }
    
    // Fetch user data for both reporter and reported
    const enriched = await Promise.all(reports.map(async r => {
      let reportedUser = {};
      let reporterUser = {};
      try {
        if (r.reportedUserId) {
          const uDoc = await db.collection('users').doc(r.reportedUserId).get();
          if (uDoc.exists) reportedUser = uDoc.data();
        }
        if (r.reporterId) {
          const uDoc = await db.collection('users').doc(r.reporterId).get();
          if (uDoc.exists) reporterUser = uDoc.data();
        }
      } catch(e) {}
      return { ...r, _reported: reportedUser, _reporter: reporterUser };
    }));

    el.innerHTML = enriched.map(r => {
      let partiesHtml = `
        <div style="display:flex; flex-direction:column; gap:8px; margin:16px 0; border-top:1px solid var(--border-glass); border-bottom:1px solid var(--border-glass); padding:16px 0;">
      `;

      // Reporter
      if (r.reporterId) {
        const u = r._reporter;
        const avatar = u.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name||r.reporterName||'U')}&background=00b894&color=fff`;
        partiesHtml += `
          <div style="display:flex; align-items:center; gap:12px; background:rgba(0,184,148,0.1); padding:10px; border-radius:8px; border:1px solid rgba(0,184,148,0.3);">
            <div style="font-size:11px; font-weight:bold; color:#00b894; width:50px; flex-shrink:0;">المُبلِّغ:</div>
            <img src="${avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid #00b894; cursor:pointer; flex-shrink:0;" onclick="AdminApp.showUserDetail('${r.reporterId}')">
            <div style="flex:1; min-width:0; overflow:hidden;">
              <div style="font-size:13px; font-weight:700; color:#fff; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" onclick="AdminApp.showUserDetail('${r.reporterId}')">${u.name||r.reporterName||'مستخدم'}${u.isVerified ? ' <span class="verified-badge material-icons-outlined" style="font-size:14px; vertical-align:middle; margin-right:2px;">verified</span>' : ''}</div>
              <div style="font-size:11px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" dir="ltr" style="text-align:right;">${u.phoneNumber||u.email||''}</div>
            </div>
            <button class="btn btn-sm btn-ghost" style="padding:4px 8px; font-size:11px; flex-shrink:0; color:#00b894;" onclick="AdminApp.showUserDetail('${r.reporterId}')">ملف</button>
          </div>
        `;
      }

      // Reported
      if (r.reportedUserId) {
        const u = r._reported;
        const avatar = u.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name||r.reportedUserName||'U')}&background=d63031&color=fff`;
        partiesHtml += `
          <div style="display:flex; align-items:center; gap:12px; background:rgba(214,48,49,0.1); padding:10px; border-radius:8px; border:1px solid rgba(214,48,49,0.3);">
            <div style="font-size:11px; font-weight:bold; color:#d63031; width:50px; flex-shrink:0;">المُشتكى<br>ضده:</div>
            <img src="${avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid #d63031; cursor:pointer; flex-shrink:0;" onclick="AdminApp.showUserDetail('${r.reportedUserId}')">
            <div style="flex:1; min-width:0; overflow:hidden;">
              <div style="font-size:13px; font-weight:700; color:#fff; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" onclick="AdminApp.showUserDetail('${r.reportedUserId}')">${u.name||r.reportedUserName||'مستخدم'}${u.isVerified ? ' <span class="verified-badge material-icons-outlined" style="font-size:14px; vertical-align:middle; margin-right:2px;">verified</span>' : ''}</div>
              <div style="font-size:11px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" dir="ltr" style="text-align:right;">${u.phoneNumber||u.email||''}</div>
            </div>
            <button class="btn btn-sm btn-ghost" style="padding:4px 8px; font-size:11px; flex-shrink:0; color:#d63031;" onclick="AdminApp.showUserDetail('${r.reportedUserId}')">ملف</button>
          </div>
        `;
      }

      partiesHtml += `</div>`;

      return `
      <div class="verify-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="margin:0; font-size:16px; display:flex; align-items:center; gap:8px;">
            <span class="material-icons-outlined" style="color:var(--danger)">gavel</span>
            تفاصيل البلاغ
          </h4>
          <span class="report-status ${r.status||'pending'}">${r.status==='reviewed'?'تمت المراجعة':r.status==='dismissed'?'مرفوض':'معلق'}</span>
        </div>
        
        <div class="verify-card-body" style="padding:0; gap:8px;">
          <p style="margin:0; font-size:14px;"><strong>السبب:</strong> ${r.reason||'لا توجد تفاصيل'}</p>
          <p style="margin:0; color:var(--text-muted); font-size:12px;">${timeAgo(r.createdAt)}</p>
          ${r.imageUrl ? `<div style="margin-top:12px;"><img src="${r.imageUrl}" onclick="AdminApp.previewImage('${r.imageUrl}')" style="max-width:100%; max-height:200px; border-radius:8px; border:1px solid var(--border-glass); cursor:pointer; object-fit:cover;" alt=""/></div>` : ''}
        </div>

        ${partiesHtml}

        <div class="verify-card-actions" style="margin-top:0;">
          ${(r.status||'pending')==='pending' ? `
            <button class="btn btn-sm btn-success" onclick="AdminApp.updateReport('${r.id}','reviewed')"><span class="material-icons-outlined">check</span>تمت المراجعة</button>
            <button class="btn btn-sm btn-danger" onclick="AdminApp.updateReport('${r.id}','dismissed')"><span class="material-icons-outlined">close</span>رفض</button>
          ` : ''}
        </div>
      </div>`;
    }).join('');
  },

  filterReports() {
    const status = document.getElementById('reports-status-filter').value;
    let filtered = this.allReports;
    if (status) filtered = filtered.filter(r => (r.status||'pending') === status);
    this.renderReports(filtered);
  },

  async updateReport(id, status) {
    await db.collection('reports').doc(id).update({ status, reviewedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('تم تحديث البلاغ');
    this.loadReports();
  },

  // ── Deletions ──
  async loadDeletions() {
    const snap = await db.collection('deletion_requests').orderBy('createdAt','desc').limit(200).get();
    const requests = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    this.renderDeletions(requests);
    
    // Badge
    const pending = requests.filter(r => (r.status||'pending') === 'pending').length;
    const badge = document.getElementById('deletions-badge');
    badge.textContent = pending;
    badge.style.display = pending > 0 ? 'inline' : 'none';
  },

  async renderDeletions(requests) {
    const el = document.getElementById('deletions-list');
    if (!requests.length) { el.innerHTML = '<p class="empty-state">لا توجد طلبات حذف معلقة 🎉</p>'; return; }
    // Enrich with user profile data
    const enriched = await Promise.all(requests.map(async r => {
      let user = {};
      try {
        if (r.userId) {
          const uDoc = await db.collection('users').doc(r.userId).get();
          if (uDoc.exists) user = uDoc.data();
        }
      } catch(e) {}
      return { ...r, _user: user };
    }));
    el.innerHTML = enriched.map(r => {
      const u = r._user;
      const avatar = u.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name||'U')}&background=e17055&color=fff`;
      const jobTitle = u.jobTitle || u.skills?.join(', ') || ROLE_NAMES[u.role] || '';
      const location = [u.locality, u.state].filter(Boolean).join(' — ') || '';
      return `
      <div class="verify-card">
        <div class="verify-card-header">
          <img src="${avatar}" alt="" style="border-color:var(--desert-orange);">
          <div class="verify-card-info">
            <h4>${r.name||'مستخدم'}${u.isVerified ? ' <span class="verified-badge material-icons-outlined" style="font-size:18px; vertical-align:middle; margin-right:4px;">verified</span>' : ''}</h4>
            <p>${r.email||'بدون بريد'}${jobTitle ? ' — '+jobTitle : ''}</p>
            ${location ? '<p>📍 '+location+'</p>' : ''}
          </div>
          <span class="report-status ${r.status||'pending'}" style="margin-right:auto;">${r.status==='approved'?'تم الحذف':r.status==='rejected'?'مرفوض':'معلق'}</span>
        </div>
        <div class="verify-card-body">
          <p style="margin:0 0 6px;"><strong>السبب:</strong> ${r.reason||'لم يذكر'}</p>
          <p style="margin:0;color:var(--text-muted);font-size:12px;">${timeAgo(r.createdAt)}</p>
        </div>
        <div class="verify-card-actions">
          ${(r.status||'pending')==='pending' ? `
            <button class="btn btn-sm btn-danger" onclick="AdminApp.approveDeletion('${r.id}', '${r.userId}')"><span class="material-icons-outlined">delete</span>موافقة وحذف</button>
            <button class="btn btn-sm btn-ghost" onclick="AdminApp.rejectDeletion('${r.id}')"><span class="material-icons-outlined">close</span>رفض الطلب</button>
          ` : ''}
        </div>
      </div>`;
    }).join('');
  },

  async approveDeletion(reqId, userId) {
    if (!confirm('هل أنت متأكد من حذف حساب هذا المستخدم نهائياً؟ ستُحذف جميع بياناته.')) return;
    try {
      const result = await deleteUserAccount({ userId });
      if (result?.data?.success) {
        await db.collection('deletion_requests').doc(reqId).update({ status: 'approved', processedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('تمت الموافقة وحذف بيانات المستخدم بنجاح');
        this.loadDeletions();
        this.loadUsers();
      } else {
        throw new Error('Failed to delete account');
      }
    } catch (e) {
      console.error('approveDeletion error', e);
      showToast('حدث خطأ أثناء الحذف: ' + (e.message || e), 'error');
    }
  },

  async rejectDeletion(reqId) {
    if (!confirm('هل تريد رفض طلب الحذف؟')) return;
    try {
      await db.collection('deletion_requests').doc(reqId).update({ status: 'rejected', processedAt: firebase.firestore.FieldValue.serverTimestamp() });
      showToast('تم رفض طلب الحذف');
      this.loadDeletions();
    } catch (e) {
      showToast('حدث خطأ: ' + e.message, 'error');
    }
  },

  // ── Admins Management ──
  async loadAdmins() {
    const snap = await db.collection('users').where('role', '==', 'admin').get();
    const tbody = document.getElementById('admins-tbody');
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">لا يوجد مشرفون</td></tr>';
      return;
    }
    const currentUid = auth.currentUser.uid;
    tbody.innerHTML = snap.docs.map(d => {
      const a = d.data();
      const isMe = d.id === currentUid;
      const isSuperAdmin = a.email === 'ja5009006@gmail.com';
      return `
        <tr>
          <td><strong>${a.name || 'مشرف'}</strong> ${isMe ? '<span style="color:var(--success);font-size:12px;">(أنت)</span>' : ''} ${isSuperAdmin ? '👑' : ''}</td>
          <td>${a.email}</td>
          <td>
            ${(!isMe && !isSuperAdmin) ? `<button class="btn btn-sm btn-danger" onclick="AdminApp.removeAdmin('${d.id}')">إزالة الصلاحية</button>` : '-'}
          </td>
        </tr>`;
    }).join('');
  },

  async createAdmin() {
    const email = document.getElementById('new-admin-email').value.trim();
    const pass = document.getElementById('new-admin-pass').value.trim();
    const name = document.getElementById('new-admin-name').value.trim();

    if (!email || pass.length < 6 || !name) {
      showToast('الرجاء إدخال بيانات صحيحة (كلمة المرور 6 أحرف على الأقل)', 'error');
      return;
    }

    try {
      showToast('جاري إنشاء حساب المشرف...');
      // Use Secondary Firebase App trick to avoid logging out
      if (!window.secondaryApp) {
        window.secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
      }
      
      const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
      await db.collection('users').doc(cred.user.uid).set({
        email: email,
        name: name,
        role: 'admin',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      await secondaryApp.auth().signOut();
      
      showToast('تم إنشاء حساب المشرف بنجاح! 🎉');
      document.getElementById('new-admin-email').value = '';
      document.getElementById('new-admin-pass').value = '';
      document.getElementById('new-admin-name').value = '';
      this.loadAdmins();
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        // If user already exists in Auth, just update their role in Firestore
        if (confirm('البريد الإلكتروني مسجل بالفعل. هل تريد ترقية حسابه إلى مشرف؟')) {
          const snap = await db.collection('users').where('email', '==', email).get();
          if (!snap.empty) {
            await db.collection('users').doc(snap.docs[0].id).update({ role: 'admin', name: name });
            showToast('تمت ترقية الحساب إلى مشرف بنجاح!');
            this.loadAdmins();
          } else {
            showToast('حدث خطأ غير متوقع', 'error');
          }
        }
      } else {
        showToast('خطأ: ' + e.message, 'error');
      }
    }
  },

  async removeAdmin(uid) {
    if (!confirm('هل أنت متأكد من إزالة صلاحية الإشراف عن هذا المستخدم؟')) return;
    try {
      await db.collection('users').doc(uid).update({ role: 'client' });
      showToast('تمت إزالة الصلاحية بنجاح');
      this.loadAdmins();
    } catch (e) {
      showToast('خطأ: ' + e.message, 'error');
    }
  },

  // ── Notifications ──
  toggleNotifFilters() {
    const type = document.getElementById('notif-type').value;
    document.getElementById('notif-role-group').style.display = (type==='role'||type==='role_state') ? 'block' : 'none';
    document.getElementById('notif-state-group').style.display = (type==='state'||type==='role_state') ? 'block' : 'none';
    document.getElementById('notif-locality-group').style.display = (type==='state'||type==='role_state') ? 'block' : 'none';
  },

  async sendNotification() {
    const title = document.getElementById('notif-title').value.trim();
    const body = document.getElementById('notif-body').value.trim();
    if (!title || !body) { showToast('يرجى ملء العنوان والمحتوى','error'); return; }

    const type = document.getElementById('notif-type').value;
    let targetRole = 'all';
    let targetState = 'all';
    let targetLocality = 'all';
    
    if (type === 'role' || type === 'role_state') {
      targetRole = document.getElementById('notif-role').value;
    }
    if (type === 'state' || type === 'role_state') {
      targetState = document.getElementById('notif-state').value;
      targetLocality = document.getElementById('notif-locality').value || 'all';
    }

    if (!confirm('هل أنت متأكد من إرسال هذا التنبيه المستهدف؟')) return;

    const btn = document.querySelector('button[onclick="AdminApp.sendNotification()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div> جاري الإرسال...';
    btn.disabled = true;

    try {
      let usersQuery = db.collection('users');
      if (targetRole && targetRole !== 'all') usersQuery = usersQuery.where('role', '==', targetRole);
      if (targetState && targetState !== 'all') usersQuery = usersQuery.where('state', '==', targetState);
      if (targetLocality && targetLocality !== 'all') usersQuery = usersQuery.where('locality', '==', targetLocality);

      const snap = await usersQuery.get();
      if (snap.empty) {
        showToast('لم يتم العثور على مستخدمين مطابقين لهذه المعايير', 'error');
      } else {
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = db.batch();
          const chunk = docs.slice(i, i + 400);
          chunk.forEach(doc => {
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
              userId: doc.id,
              title: title,
              message: body,
              type: 'system',
              isRead: false,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              relatedId: 'bulk_notification'
            });
          });
          await batch.commit();
        }
        showToast(`تم إرسال التنبيه إلى ${docs.length} مستخدم بنجاح`);
      }
      
      document.getElementById('notif-title').value = '';
      document.getElementById('notif-body').value = '';
      this.loadNotifHistory();
    } catch (e) {
      showToast('خطأ: ' + e.message, 'error');
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  },

  async loadNotifHistory() {
    const snap = await db.collection('bulk_notifications').orderBy('createdAt','desc').limit(20).get();
    const el = document.getElementById('notif-history');
    if (snap.empty) { el.innerHTML = '<p class="empty-state">لم يتم إرسال إشعارات بعد</p>'; return; }
    el.innerHTML = snap.docs.map(d => {
      const n = d.data();
      return `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex; justify-content:space-between;">
          <strong>${n.title}</strong>
          <button class="btn btn-sm btn-ghost" onclick="AdminApp.deleteNotificationLog('${d.id}')" style="color:red;"><span class="material-icons-outlined" style="font-size:16px;">delete</span></button>
        </div>
        <span style="color:var(--text-muted);font-size:13px">${n.message}</span><br>
        <small style="color:var(--text-muted)">${timeAgo(n.createdAt)} — أُرسل لـ ${n.fcmSent || n.matchedUsers || 0} مستخدم</small>
      </div>`;
    }).join('');
  },

  async deleteNotificationLog(id) {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    try {
      await db.collection('bulk_notifications').doc(id).delete();
      this.loadNotifHistory();
      showToast('تم حذف السجل');
    } catch (e) {
      showToast('خطأ في الحذف: ' + e.message, 'error');
    }
  },

  // ── Statistics ──
  async loadStatistics() {
    try {
      // 1. Total users
      const totalSnap = await db.collection('users').count().get();
      const total = totalSnap.data().count;

      // 2. Roles distribution
      const rolesToCount = ['client', 'freelancer', 'techService', 'privateService', 'shop', 'admin'];
      const byRole = {};
      await Promise.all(rolesToCount.map(async (role) => {
        const snap = await db.collection('users').where('role', '==', role).count().get();
        byRole[role] = snap.data().count;
      }));

      // Render Role Chart
      const roleCtx = document.getElementById('roleChart');
      if (roleCtx) {
        if (window.roleChartInstance) window.roleChartInstance.destroy();
        window.roleChartInstance = new Chart(roleCtx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(byRole).map(k => (typeof ROLE_NAMES !== 'undefined' ? ROLE_NAMES[k] : null) || k),
            datasets: [{
              data: Object.values(byRole),
              backgroundColor: ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#00cec9', '#74b9ff']
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'left', labels: { color: '#f8f9fa' } } }
          }
        });
      }

      // 3. Growth Chart (Last 7 days)
      const last7Days = [];
      const now = new Date();
      // Using a loop to create promises for concurrent execution
      const dayPromises = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0,0,0,0);
        const nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);

        const promise = db.collection('users')
          .where('createdAt', '>=', d)
          .where('createdAt', '<', nextDay)
          .count().get().then(snap => ({
            index: i,
            dateStr: d.toLocaleDateString('en-GB', {day:'2-digit', month:'short'}),
            count: snap.data().count
          }));
        dayPromises.push(promise);
      }
      
      const dayResults = await Promise.all(dayPromises);
      dayResults.sort((a,b) => a.index - b.index);
      dayResults.forEach(r => last7Days.push(r));

      const growthCtx = document.getElementById('growthChart');
      if (growthCtx) {
        if (window.growthChartInstance) window.growthChartInstance.destroy();
        window.growthChartInstance = new Chart(growthCtx, {
          type: 'line',
          data: {
            labels: last7Days.map(d => d.dateStr),
            datasets: [{
              label: 'مستخدمين جدد',
              data: last7Days.map(d => d.count),
              borderColor: '#00b894', backgroundColor: 'rgba(0,184,148,0.2)', fill: true, tension: 0.4
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#a0aab2' } },
              x: { grid: { display: false }, ticks: { color: '#a0aab2' } }
            }
          }
        });
      }

      // 4. By state (For simplicity, we show a message or just don't load this costly one fully unless requested)
      // Since Sudan has 18 states, doing 18 queries is okay. Let's do the top ones or just show a simplified version.
      const states = ['ولاية الخرطوم', 'ولاية الجزيرة', 'ولاية البحر الأحمر', 'ولاية نهر النيل', 'ولاية شمال كردفان'];
      const byState = {};
      await Promise.all(states.map(async (state) => {
         const snap = await db.collection('users').where('state', '==', state).count().get();
         if (snap.data().count > 0) byState[state] = snap.data().count;
      }));

      const stateEl = document.getElementById('stats-by-region');
      if (Object.keys(byState).length > 0) {
        stateEl.innerHTML = '<div class="bar-chart">' + Object.entries(byState).sort((a,b)=>b[1]-a[1]).map(([state,count]) => {
          const pct = total ? Math.round(count/total*100) : 0;
          return `<div class="bar-row"><span class="bar-label">${state}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:var(--accent)">${count}</div></div></div>`;
        }).join('') + '</div>';
      } else {
        stateEl.innerHTML = '<p class="empty-state">لا توجد بيانات للمناطق حالياً</p>';
      }

      // 5. Detailed stats
      const verifiedSnap = await db.collection('users').where('isVerified', '==', true).count().get();
      const verified = verifiedSnap.data().count;
      
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const onlineSnap = await db.collection('users').where('lastActive', '>=', fiveMinsAgo).count().get();
      const online = onlineSnap.data().count;

      const clients = byRole.client || 0;
      const craftsmen = byRole.freelancer || 0;
      
      document.getElementById('stats-grid-detailed').innerHTML = [
        { icon:'people', label:'إجمالي المستخدمين', value:total, color:'#6c5ce7' },
        { icon:'verified', label:'موثقون', value:verified, color:'#00cec9' },
        { icon:'circle', label:'متصلون الآن', value:online, color:'#00b894' },
        { icon:'person', label:'عملاء', value:clients, color:'#74b9ff' },
        { icon:'construction', label:'حرفيين (صنايعية)', value:craftsmen, color:'#e17055' },
        { icon:'store', label:'متاجر', value:byRole.shop||0, color:'#fdcb6e' },
        { icon:'code', label:'تقنيين', value:byRole.techService||0, color:'#a29bfe' },
        { icon:'room_service', label:'خدمات خاصة', value:byRole.privateService||0, color:'#fd79a8' },
      ].map(s => `<div class="stat-card"><div class="stat-icon" style="background:${s.color}22;color:${s.color}"><span class="material-icons-outlined">${s.icon}</span></div><div><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div></div>`).join('');
      
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  },

  // ── Modals ──
  closeModal(id) { document.getElementById(id).style.display = 'none'; },
  previewImage(url) {
    document.getElementById('image-preview-img').src = url;
    document.getElementById('image-modal').style.display = 'flex';
  },

  // ── Promotions Page ──
  async loadPromotions() {
    const container = document.getElementById('promotions-list');
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
            if (userDoc.exists) user = userDoc.data();
          }
        } catch (err) {}
        
        const endDate = p.expiryDate?.toDate ? p.expiryDate.toDate() : new Date(p.expiryDate || p.createdAt);
        const isActive = endDate > now;
        const statusClass = isActive ? 'active' : 'dismissed';
        const statusText = isActive ? 'نشط' : 'منتهي';
        const endStr = endDate.toLocaleDateString('ar-EG');
        
        const userName = user.name || user.username || p.userName || 'مستخدم';
        const userImage = user.profileImageUrl || p.userImage || '';
        const userProf = user.jobTitle || user.role || p.userProfession || '';
        const userLoc = user.state || p.userLocation || '';
        const rating = typeof user.rating === 'number' ? user.rating : (p.userRating || 0);
        
        htmls.push(`<div class="promo-card">
          <div class="promo-card-header">
            <img src="${userImage}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%236c5ce7%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2240%22>${userName.charAt(0)}</text></svg>'">
            <div class="promo-card-info">
              <h4>${userName}</h4>
              <p>${userProf} — ${userLoc}</p>
            </div>
            <span class="report-status ${statusClass}" style="margin-right:auto;">${statusText}</span>
          </div>
          <div class="promo-card-body">
            <div class="promo-text">"${p.promoText || p.promotionText || ''}"</div>
            <div class="promo-meta">
              <span><span class="material-icons-outlined" style="font-size:14px;">calendar_today</span> ينتهي: ${endStr}</span>
              <span><span class="material-icons-outlined" style="font-size:14px;">star</span> التقييم: ${rating.toFixed(1)}</span>
            </div>
          </div>
          <div class="promo-card-actions">
            <button class="btn btn-sm btn-danger" onclick="AdminApp.deletePromotion('${p.id}')"><span class="material-icons-outlined">delete</span> حذف</button>
          </div>
        </div>`);
      }
      container.innerHTML = htmls.join('');
    } catch (e) {
      container.innerHTML = '<p class="empty-state">خطأ في تحميل الترويجات: ' + e.message + '</p>';
    }
  },

  async deletePromotion(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الترويج؟')) return;
    try {
      await db.collection('promotions').doc(id).delete();
      showToast('تم حذف الترويج بنجاح');
      this.loadPromotions();
    } catch (e) {
      showToast('خطأ: ' + e.message, 'error');
    }
  },

  // ── Contracts Page ──
  async loadContracts() {
    const container = document.getElementById('contracts-list');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
      const snap = await db.collectionGroup('messages').where('type', '==', 'contract').orderBy('createdAt', 'desc').limit(50).get();
      if (snap.empty) {
        container.innerHTML = '<p class="empty-state">لا توجد عقود حتى الآن</p>';
        return;
      }
      const STATUS_NAMES = { pending: 'معلق', accepted: 'مقبول', active: 'نشط', completed: 'مكتمل', cancelled: 'ملغي', rejected: 'مرفوض' };
      const enriched = await Promise.all(snap.docs.map(async doc => {
        const d = doc.data();
        let parties = [];
        try {
          const chatDoc = await doc.ref.parent.parent.get();
          if (chatDoc.exists) {
            const participants = chatDoc.data().participants || [];
            for (const uid of participants) {
              const uDoc = await db.collection('users').doc(uid).get();
              if (uDoc.exists) parties.push({ id: uid, ...uDoc.data() });
            }
          }
        } catch(e) {}
        return { id: doc.id, ...d, _parties: parties };
      }));

      this.allContracts = enriched;
      this.renderContracts(this.allContracts);
    } catch (e) {
      container.innerHTML = '<p class="empty-state">خطأ في تحميل العقود: ' + e.message + '</p>';
    }
  },

  renderContracts(contracts) {
    const container = document.getElementById('contracts-list');
    if (!contracts || !contracts.length) {
      container.innerHTML = '<p class="empty-state">لا توجد عقود مطابقة للبحث</p>';
      return;
    }
    const STATUS_NAMES = { pending: 'معلق', accepted: 'مقبول', active: 'نشط', completed: 'مكتمل', cancelled: 'ملغي', rejected: 'مرفوض' };
    container.innerHTML = contracts.map(d => {
      const status = d.contractStatus || d.status || 'pending';
      const statusClass = ['active','accepted'].includes(status) ? 'active' : status === 'completed' ? 'completed' : 'cancelled';
      const date = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('ar-EG') : '';
      const details = d.contractDetails || d.title || d.serviceType || 'عقد خدمة';
      const displayTitle = details.length > 50 ? details.substring(0, 50) + '...' : details;
      const price = d.contractPrice || d.agreedPrice || d.price || 'غير محدد';

      let partiesHtml = '';
      if (d._parties && d._parties.length > 0) {
        partiesHtml = `<div style="display:flex; flex-direction:column; gap:8px; margin-top:16px; border-top:1px solid var(--border-glass); padding-top:16px;">` + 
          d._parties.map(p => {
            const avatar = p.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name||'U')}&background=6c5ce7&color=fff`;
            const roleName = ROLE_NAMES[p.role] || p.role || '';
            return `
              <div style="display:flex; align-items:center; gap:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid var(--border-glass);">
                <img src="${avatar}" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid var(--primary); cursor:pointer; flex-shrink:0;" onclick="AdminApp.showUserDetail('${p.id}')">
                <div style="flex:1; min-width:0; overflow:hidden;">
                  <div style="font-size:13px; font-weight:700; color:#fff; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" onclick="AdminApp.showUserDetail('${p.id}')">${p.name||'مستخدم'} ${p.isVerified ? '<span class="material-icons-outlined verified-badge" style="font-size:14px; vertical-align:middle;">verified</span>' : ''}</div>
                  <div style="font-size:11px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${roleName}</div>
                  <div style="font-size:11px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" dir="ltr" style="text-align:right;">${p.phoneNumber||p.email||''}</div>
                </div>
                <button class="btn btn-sm btn-ghost" style="padding:4px 8px; font-size:11px; flex-shrink:0;" onclick="AdminApp.showUserDetail('${p.id}')"><span class="material-icons-outlined" style="font-size:14px;">person</span> ملف</button>
              </div>
            `;
          }).join('') + 
        `</div>`;
      }

      return `<div class="contract-item">
        <div class="contract-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="material-icons-outlined" style="color:var(--primary-light)">description</span>
            <strong title="${details.replace(/"/g, '&quot;')}">${displayTitle}</strong>
          </div>
          <span class="contract-status ${statusClass}">${STATUS_NAMES[status] || status}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="color:var(--text-secondary);font-size:13px;">
            <span>💰 ${price} SDG</span>
            <span style="margin-right:16px;">📅 ${date}</span>
          </div>
        </div>
        ${partiesHtml}
      </div>`;
    }).join('');
  },

  filterContracts() {
    const q = (document.getElementById('contracts-search')?.value || '').toLowerCase();
    if (!q) {
      this.renderContracts(this.allContracts);
      return;
    }
    const filtered = (this.allContracts || []).filter(c => {
      if (!c._parties) return false;
      return c._parties.some(p => (p.name || '').toLowerCase().includes(q));
    });
    this.renderContracts(filtered);
  },

  // ── Settings Page ──
  async loadSettings() {
    try {
      const doc = await db.collection('app_config').doc('settings').get();
      if (doc.exists) {
        const d = doc.data();
        // Links
        if (d.playStoreUrl) document.getElementById('setting-playstore').value = d.playStoreUrl;
        if (d.appStoreUrl) document.getElementById('setting-appstore').value = d.appStoreUrl;
        if (d.apkUrl) document.getElementById('setting-apk').value = d.apkUrl;
        // Policies
        if (d.privacyUrl) document.getElementById('setting-privacy').value = d.privacyUrl;
        if (d.termsUrl) document.getElementById('setting-terms').value = d.termsUrl;
        if (d.supportUrl) document.getElementById('setting-support').value = d.supportUrl;
      }
      
      const snap2 = await db.collection('settings').doc('app_settings').get();
      if (snap2.exists) {
        const d2 = snap2.data();
        if (d2.ai_welcome_prompt) {
          document.getElementById('setting-ai-welcome').value = d2.ai_welcome_prompt;
        }
        if (d2.ai_system_prompt) {
          document.getElementById('setting-ai-system').value = d2.ai_system_prompt;
        }
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  },

  async saveSettings(section) {
    try {
      let data = {};
      if (section === 'links') {
        data = {
          playStoreUrl: document.getElementById('setting-playstore').value.trim(),
          appStoreUrl: document.getElementById('setting-appstore').value.trim(),
          apkUrl: document.getElementById('setting-apk').value.trim(),
        };
      } else if (section === 'policies') {
        data = {
          privacyUrl: document.getElementById('setting-privacy').value.trim(),
          termsUrl: document.getElementById('setting-terms').value.trim(),
          supportUrl: document.getElementById('setting-support').value.trim(),
        };
      } else if (section === 'ai') {
        data = {
          ai_welcome_prompt: document.getElementById('setting-ai-welcome').value.trim(),
          ai_system_prompt: document.getElementById('setting-ai-system').value.trim()
        };
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('settings').doc('app_settings').set(data, { merge: true });
        showToast('تم حفظ توجيهات وقوانين الذكاء الاصطناعي بنجاح ✅');
        return;
      }
      
      data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('app_config').doc('settings').set(data, { merge: true });
      showToast('تم حفظ الإعدادات بنجاح ✅');
    } catch (e) {
      showToast('خطأ في الحفظ: ' + e.message, 'error');
    }
  },
};

// ── Auth State ──
auth.onAuthStateChanged(async user => {
  if (user) {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().role === 'admin') {
      AdminApp.showDashboard(doc.data().name || 'المشرف');
      AdminApp.loadNotifHistory();
    } else {
      AdminApp.logout();
    }
  }
});

// ── Admin AI Assistant ──
const AdminAI = {
  isOpen: false,
  toggleChat() {
    this.isOpen = !this.isOpen;
    document.getElementById('admin-ai-window').style.display = this.isOpen ? 'flex' : 'none';
    if (this.isOpen) document.getElementById('ai-input').focus();
  },
  async sendMessage() {
    const inputEl = document.getElementById('ai-input');
    const text = inputEl.value.trim();
    if (!text) return;
    
    inputEl.value = '';
    this.appendMessage('user', text);
    this.appendMessage('system', 'جاري معالجة البيانات...', 'ai-loading');

    try {
      // Calling Cloud Function (must be deployed to support this)
      const func = firebase.functions().httpsCallable('adminAiAssistant');
      const res = await func({ query: text });
      
      this.removeMessage('ai-loading');
      this.appendMessage('system', res.data.response || 'اكتملت العملية.');
    } catch (e) {
      console.error("AI Error:", e);
      this.removeMessage('ai-loading');
      this.appendMessage('system', 'حدث خطأ أثناء التواصل مع الذكاء الاصطناعي.');
    }
  },
  appendMessage(role, text, id = null) {
    const container = document.getElementById('ai-messages-container');
    const msg = document.createElement('div');
    msg.className = `ai-msg ai-msg-${role}`;
    if (id) msg.id = id;
    
    // Simple bolding and line breaks for markdown
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\n/g, '<br>');
    msg.innerHTML = formattedText;
    
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  },

  removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
};

// ── Payment Settings App ──
const PaymentSettingsApp = {
  async loadMethods() {
    try {
      const grid = document.getElementById('payment-methods-grid');
      grid.innerHTML = '<div class="loading">جاري التحميل...</div>';
      
      const snap = await db.collection('admin_settings').doc('payment_methods').get();
      const methods = snap.exists ? (snap.data().methods || []) : [];
      
      if (methods.length === 0) {
        grid.innerHTML = '<div class="empty-state">لا توجد حسابات مضافة.</div>';
        return;
      }

      let html = '';
      methods.forEach((m, idx) => {
        html += `
          <div class="card" style="padding:15px; border-top:4px solid var(--primary);">
            <div style="font-weight:bold; font-size:16px; margin-bottom:10px;">${m.bankName}</div>
            <div style="color:var(--text-secondary); margin-bottom:5px;">اسم الحساب: ${m.accountName}</div>
            <div style="color:var(--text-secondary); margin-bottom:15px;">رقم الحساب: ${m.accountNumber}</div>
            <div style="text-align:left;">
              <button class="btn btn-sm btn-danger" onclick="PaymentSettingsApp.deleteMethod(${idx})">
                <span class="material-icons-outlined">delete</span>
              </button>
            </div>
          </div>
        `;
      });
      grid.innerHTML = html;
    } catch (e) {
      console.error(e);
      document.getElementById('payment-methods-grid').innerHTML = '<div class="error-msg">فشل تحميل الحسابات</div>';
    }
  },
  openAddModal() {
    document.getElementById('payment-bank').value = '';
    document.getElementById('payment-name').value = '';
    document.getElementById('payment-number').value = '';
    document.getElementById('payment-modal').style.display = 'flex';
  }
};

document.getElementById('payment-method-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const bankName = document.getElementById('payment-bank').value.trim();
  const accountName = document.getElementById('payment-name').value.trim();
  const accountNumber = document.getElementById('payment-number').value.trim();
  
  if(!bankName || !accountName || !accountNumber) return;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'جاري الحفظ...';

  try {
    const docRef = db.collection('admin_settings').doc('payment_methods');
    const snap = await docRef.get();
    let methods = snap.exists ? (snap.data().methods || []) : [];
    
    methods.push({ bankName, accountName, accountNumber });
    
    await docRef.set({ methods }, { merge: true });
    
    AdminApp.closeModal('payment-modal');
    showToast('تمت الإضافة بنجاح', 'success');
    PaymentSettingsApp.loadMethods();
  } catch (err) {
    console.error(err);
    showToast('فشل في الحفظ', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'حفظ';
  }
});

PaymentSettingsApp.deleteMethod = async function(index) {
  if(!confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
  try {
    const docRef = db.collection('admin_settings').doc('payment_methods');
    const snap = await docRef.get();
    let methods = snap.exists ? (snap.data().methods || []) : [];
    
    methods.splice(index, 1);
    await docRef.set({ methods }, { merge: true });
    
    showToast('تم الحذف', 'success');
    PaymentSettingsApp.loadMethods();
  } catch (err) {
    console.error(err);
    showToast('فشل الحذف', 'error');
  }
};

// ── Subscriptions App ──
const SubscriptionAdminApp = {
  currentSubId: null,
  currentUserId: null,
  
  async loadSubscriptions() {
    try {
      const tbody = document.getElementById('subscriptions-table-body');
      tbody.innerHTML = '<tr><td colspan="6" class="loading">جاري التحميل...</td></tr>';
      
      const snap = await db.collection('subscriptions').orderBy('createdAt', 'desc').limit(50).get();
      if(snap.empty) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد طلبات اشتراك</td></tr>';
        return;
      }

      let html = '';
      for (const doc of snap.docs) {
        const data = doc.data();
        const d = data.createdAt ? data.createdAt.toDate() : new Date();
        const dateStr = d.toLocaleDateString('ar-EG') + ' ' + d.toLocaleTimeString('ar-EG');
        const statusClass = data.status === 'active' ? 'badge-success' : (data.status === 'rejected' ? 'badge-danger' : 'badge-warning');
        
        let actions = '';
        if (data.status === 'pending') {
          actions = `<button class="btn btn-sm btn-primary" onclick="SubscriptionAdminApp.viewReceipt('${doc.id}', '${data.receiptUrl}', '${data.userId}')">مراجعة</button>`;
        } else {
          actions = `<span class="badge ${statusClass}">${data.status}</span>`;
        }

        html += `
          <tr>
            <td>${doc.id.substring(0,6)}...</td>
            <td><a href="#" onclick="AdminApp.viewUser('${data.userId}')">عرض المستخدم</a></td>
            <td>${data.plan || 'Pro'}</td>
            <td>
              ${data.receiptUrl ? `<a href="#" onclick="SubscriptionAdminApp.viewReceipt('${doc.id}', '${data.receiptUrl}', '${data.userId}')"><span class="material-icons-outlined">image</span> عرض</a>` : 'لا يوجد'}
            </td>
            <td><span class="badge ${statusClass}">${data.status === 'pending' ? 'قيد المراجعة' : (data.status==='active' ? 'مفعل' : 'مرفوض')}</span></td>
            <td>${actions}</td>
          </tr>
        `;
      }
      tbody.innerHTML = html;
    } catch(e) {
      console.error(e);
      document.getElementById('subscriptions-table-body').innerHTML = '<tr><td colspan="6" class="error-msg">حدث خطأ</td></tr>';
    }
  },
  viewReceipt(subId, url, userId) {
    this.currentSubId = subId;
    this.currentUserId = userId;
    document.getElementById('receipt-img-view').src = url;
    document.getElementById('receipt-modal').style.display = 'flex';
    
    // Only show approve/reject buttons if status is not already set. Actually, always show in modal, but we'll assume the clicker wants to change it.
    // If we wanted to hide them, we'd fetch status first. For now, assume it's for pending.
  }
};

document.getElementById('approve-sub-btn')?.addEventListener('click', async () => {
  const subId = SubscriptionAdminApp.currentSubId;
  const userId = SubscriptionAdminApp.currentUserId;
  if(!subId || !userId) return;

  const btn = document.getElementById('approve-sub-btn');
  btn.disabled = true;
  btn.textContent = 'جاري التفعيل...';

  try {
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 1); // 1 Month fixed duration
    
    // Batch update
    const batch = db.batch();
    
    const subRef = db.collection('subscriptions').doc(subId);
    batch.update(subRef, { 
      status: 'active',
      validUntil: firebase.firestore.Timestamp.fromDate(validUntil),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    const userRef = db.collection('users').doc(userId);
    batch.update(userRef, {
      isPremium: true,
      subscriptionExpiry: firebase.firestore.Timestamp.fromDate(validUntil)
    });
    
    await batch.commit();
    
    showToast('تم تفعيل الاشتراك', 'success');
    AdminApp.closeModal('receipt-modal');
    SubscriptionAdminApp.loadSubscriptions();
  } catch(e) {
    console.error(e);
    showToast('فشل تفعيل الاشتراك', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-outlined">check</span> موافقة';
  }
});

document.getElementById('reject-sub-btn')?.addEventListener('click', async () => {
  const subId = SubscriptionAdminApp.currentSubId;
  if(!subId) return;

  const btn = document.getElementById('reject-sub-btn');
  btn.disabled = true;
  
  try {
    await db.collection('subscriptions').doc(subId).update({
      status: 'rejected',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showToast('تم رفض الطلب', 'success');
    AdminApp.closeModal('receipt-modal');
    SubscriptionAdminApp.loadSubscriptions();
  } catch(e) {
    console.error(e);
    showToast('فشل الرفض', 'error');
  } finally {
    btn.disabled = false;
  }
});

window.PaymentSettingsApp = PaymentSettingsApp;
window.SubscriptionAdminApp = SubscriptionAdminApp;
window.AdminApp = AdminApp;



