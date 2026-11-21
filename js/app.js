/**
 * AdminApp Core Orchestrator — AVYRA Admin Dashboard
 * Wires Authentication, Theme Toggle (Dark/Light), Navigation, Real-time Badges,
 * Jhome Academy Legacy Helpers, AI Assistant, and delegates domain actions to modular scripts.
 */
const AdminApp = {
  currentPage: 'dashboard',
  activeCountry: localStorage.getItem('avyra_admin_country') || 'ALL',

  initGlobalCountrySelector() {
    const sel = document.getElementById('global-country-selector');
    if (!sel || !window.AvyraCatalogs) return;
    if (sel.options.length <= 1) {
      sel.innerHTML = `<option value="ALL">كل الدول (عالمي - ALL)</option>` +
        AvyraCatalogs.COUNTRIES.map(c =>
          `<option value="${escapeAttr(c.code)}">${escapeHtml(c.nameAr)} (${escapeHtml(c.code)})</option>`
        ).join('');
    }
    sel.value = this.activeCountry;
  },

  setActiveCountry(code) {
    this.activeCountry = code || 'ALL';
    localStorage.setItem('avyra_admin_country', this.activeCountry);

    // Sync section country filters if present
    const syncIds = [
      'users-country-filter',
      'news-country-filter',
      'ads-country-filter',
      'jobs-country-filter',
      'payment-country-filter'
    ];
    syncIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = this.activeCountry === 'ALL' ? '' : this.activeCountry;
      }
    });

    const notifCountry = document.getElementById('notif-country');
    if (notifCountry && this.activeCountry !== 'ALL') {
      notifCountry.value = this.activeCountry;
      if (window.NotificationsModule) NotificationsModule.onNotifCountryChange();
    }

    const adCountry = document.getElementById('ad-country');
    if (adCountry) {
      adCountry.value = this.activeCountry;
      if (window.ModerationModule) ModerationModule.onAdCountryChange();
    }

    if (window.UsersModule) UsersModule.onUserCountryFilterChange();
    if (window.PaymentsVerificationModule) {
      PaymentsVerificationModule.filterVerificationsList();
      PaymentsVerificationModule.renderMethods();
    }

    this.navigateTo(this.currentPage);
    const label = window.AvyraCatalogs ? AvyraCatalogs.getCountryName(this.activeCountry) : this.activeCountry;
    showToast(`تم تغيير نطاق العرض إلى: ${label}`, 'info');
  },

  // ── Toast & Modal Helpers ──
  showToast(msg, type = 'success') {
    if (typeof showToast === 'function') {
      showToast(msg, type);
    } else {
      console.log(`[Toast ${type}]`, msg);
    }
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      el.classList.remove('active');
    }
  },

  previewImage(url) {
    const safe = typeof safeUrl === 'function' ? safeUrl(url) : url;
    if (!safe) return;
    const imgEl = document.getElementById('image-preview-img');
    const modal = document.getElementById('image-modal');
    if (imgEl) imgEl.src = safe;
    if (modal) modal.style.display = 'flex';
  },

  // ── Theme Toggle (Dark Obsidian default + Light Surface mode) ──
  initTheme() {
    const saved = localStorage.getItem('avyra_admin_theme') || 'dark';
    this.applyTheme(saved);
  },

  applyTheme(theme) {
    const mode = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('avyra_admin_theme', mode);
    const iconEl = document.getElementById('theme-toggle-icon');
    if (iconEl) {
      iconEl.textContent = mode === 'dark' ? 'light_mode' : 'dark_mode';
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    this.applyTheme(current === 'dark' ? 'light' : 'dark');
  },

  // ── Authentication ──
  async login() {
    const email = document.getElementById('login-email')?.value.trim() || '';
    const pass = document.getElementById('login-password')?.value || '';
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.style.display = 'none';

    try {
      const cred = await auth.signInWithEmailAndPassword(email, pass);

      // Sync login with Jhome Firebase instance
      try {
        await firebase.app('jhome').auth().signInWithEmailAndPassword(email, pass);
      } catch (je) {
        console.warn('Could not log into Jhome Firebase instance:', je.message);
      }

      const doc = await db.collection('users').doc(cred.user.uid).get();
      if (!doc.exists || doc.data().role !== 'admin') {
        if (errEl) {
          errEl.textContent = 'ليس لديك صلاحية الوصول إلى لوحة التحكم';
          errEl.style.display = 'block';
        }
        await auth.signOut();
        try { await firebase.app('jhome').auth().signOut(); } catch (_) {}
        return;
      }
      this.showDashboard(doc.data().name || 'المشرف');
    } catch (e) {
      if (errEl) {
        errEl.textContent = 'خطأ في تسجيل الدخول: ' + e.message;
        errEl.style.display = 'block';
      }
    }
  },

  logout() {
    auth.signOut();
    try { firebase.app('jhome').auth().signOut(); } catch (_) {}
    const loginEl = document.getElementById('login-screen');
    const mainEl = document.getElementById('main-app');
    if (loginEl) loginEl.style.display = 'flex';
    if (mainEl) mainEl.style.display = 'none';
  },

  showDashboard(name) {
    const loginEl = document.getElementById('login-screen');
    const mainEl = document.getElementById('main-app');
    const nameEl = document.getElementById('admin-name');
    if (loginEl) loginEl.style.display = 'none';
    if (mainEl) mainEl.style.display = 'flex';
    if (nameEl) nameEl.textContent = name;

    this.initGlobalCountrySelector();
    this.loadDashboard();
    this.loadUsers();
    this.listenVerifications();
    this.listenOtpRequests();
    this.loadReports();
    this.loadDeletions();
    if (window.SubscriptionsModule) SubscriptionsModule.updateBadge();
    if (window.ModerationModule) ModerationModule.initAdSelects();
    if (window.NotificationsModule) NotificationsModule.initNotifSelects();
    if (window.JobsModule) JobsModule.initSelects();
  },

  // ── Navigation ──
  navigateTo(page) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    const mainNav = document.getElementById('main-sidebar-nav');
    const jhomeNav = document.getElementById('jhome-sidebar-nav');
    if (page === 'jhome') {
      if (mainNav) mainNav.style.display = 'none';
      if (jhomeNav) jhomeNav.style.display = 'flex';
    } else {
      if (mainNav) mainNav.style.display = 'flex';
      if (jhomeNav) jhomeNav.style.display = 'none';
      const navEl = document.querySelector(`#main-sidebar-nav [data-page="${page}"]`);
      if (navEl) navEl.classList.add('active');
    }

    const titles = {
      dashboard: 'الرئيسية',
      statistics: 'الإحصائيات والتحليلات',
      users: 'إدارة المستخدمين',
      verification: 'توثيق الحسابات',
      otp: 'أكواد التحقق (OTP)',
      unions: 'النقابات وفرق العمل',
      news: 'إدارة الأخبار',
      posts: 'منشورات المجتمع',
      'success-stories': 'قصص النجاح',
      orders: 'طلبات المتاجر',
      jobs: 'المشاريع والعروض واليوميات',
      requests: 'طلبات الخدمات',
      contracts: 'عقود العمل والاتفاقيات',
      subscriptions: 'إدارة اشتراكات Pro',
      'pro-users': 'مشتركو Pro',
      ads: 'إدارة الإعلانات',
      promotions: 'الترويجات المميزة',
      reports: 'البلاغات ومراجعة التقييمات',
      banned: 'المحظورون والأجهزة المحظورة',
      deletions: 'طلبات حذف الحسابات',
      'system-errors': 'سجل أخطاء النظام',
      markets: 'إدارة الأسواق والدول',
      'payment-settings': 'إعدادات الدفع ورسوم التوثيق',
      notifications: 'التنبيهات الجماعية',
      admins: 'إدارة المشرفين',
      settings: 'إعدادات وروابط التطبيق',
      'site-control': 'تحكم النظام والذكاء الاصطناعي',
      jhome: 'إدارة موقع وأكاديمية Jhome'
    };

    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[page] || page;

    if (page === 'dashboard') this.loadDashboard();
    if (page === 'statistics') this.loadStatistics();
    if (page === 'users') this.loadUsers();
    if (page === 'verification' && window.PaymentsVerificationModule) PaymentsVerificationModule.filterVerificationsList();
    if (page === 'otp' && window.PaymentsVerificationModule) PaymentsVerificationModule.filterOtpList();
    if (page === 'unions' && window.UnionsSquadsModule) UnionsSquadsModule.loadAll();
    if (page === 'news' && window.NewsModule) NewsModule.loadNews();
    if (page === 'posts' && window.ModerationModule) ModerationModule.loadPosts();
    if (page === 'success-stories') this.loadSuccessStories();
    if (page === 'orders' && window.OrdersModule) OrdersModule.loadOrders();
    if (page === 'jobs' && window.JobsModule) JobsModule.loadAll();
    if (page === 'requests' && window.ModerationModule) ModerationModule.loadRequests();
    if (page === 'contracts') this.loadContracts();
    if (page === 'subscriptions' && window.SubscriptionsModule) {
      SubscriptionsModule.loadSubscriptions();
      SubscriptionsModule.loadPointRequests();
      SubscriptionsModule.loadProUsers();
    }
    if (page === 'pro-users' && window.SubscriptionsModule) SubscriptionsModule.loadProUsers();
    if (page === 'ads' && window.ModerationModule) ModerationModule.loadAds();
    if (page === 'promotions') this.loadPromotions();
    if (page === 'reports') {
      this.loadReports();
      if (window.ModerationModule) ModerationModule.loadReviewReports();
    }
    if (page === 'banned') {
      this.loadBannedUsers();
      if (window.UsersModule) UsersModule.loadBannedDevices();
    }
    if (page === 'deletions') this.loadDeletions();
    if (page === 'system-errors' && window.SettingsSystemModule) SettingsSystemModule.loadSystemErrors();
    if (page === 'markets' && window.MarketsModule) MarketsModule.loadMarkets();
    if (page === 'payment-settings' && window.PaymentsVerificationModule) PaymentsVerificationModule.loadMethods();
    if (page === 'notifications') this.loadNotifHistory();
    if (page === 'admins') this.loadAdmins();
    if (page === 'settings') this.loadSettings();
    if (page === 'site-control' && window.SettingsSystemModule) SettingsSystemModule.loadSiteControl();

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  },

  refreshCurrentPage() {
    this.navigateTo(this.currentPage);
    showToast('تم تحديث البيانات', 'info');
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  },

  // ── Delegated Methods (Backward-Compatible Surface) ──
  getCount(query) {
    return window.StatsModule ? StatsModule.getCount(query) : query.get().then(s => s.size);
  },
  loadDashboard() {
    if (window.StatsModule) return StatsModule.loadDashboard();
  },
  loadStatistics() {
    if (window.StatsModule) return StatsModule.loadStatistics();
  },
  loadUsers() {
    if (window.UsersModule) return UsersModule.loadUsers();
  },
  filterUsers(immediate) {
    if (window.UsersModule) return UsersModule.filterUsers(immediate);
  },
  showUserDetail(uid) {
    if (window.UsersModule) return UsersModule.showUserDetail(uid);
  },
  viewUser(uid) {
    return this.showUserDetail(uid);
  },
  promoteUser(uid) {
    if (window.UsersModule) return UsersModule.promoteUser(uid);
  },
  showPersonalNotifForm(uid) {
    if (window.UsersModule) return UsersModule.showPersonalNotifForm(uid);
  },
  sendPersonalNotification(uid) {
    if (window.UsersModule) return UsersModule.sendPersonalNotification(uid);
  },
  toggleUserVerification(uid, current) {
    if (window.UsersModule) return UsersModule.toggleUserVerification(uid, current);
  },
  toggleUserBan(uid, current) {
    if (window.UsersModule) return UsersModule.toggleUserBan(uid, current);
  },
  loadBannedUsers() {
    if (window.UsersModule) return UsersModule.loadBannedUsers();
  },
  filterBannedUsers() {
    if (window.UsersModule) return UsersModule.filterBannedUsers();
  },
  loadSuccessStories() {
    if (window.UsersModule) return UsersModule.loadSuccessStories();
  },
  updateSuccessStoryStatus(id, status) {
    if (window.UsersModule) return UsersModule.updateSuccessStoryStatus(id, status);
  },
  loadDeletions() {
    if (window.UsersModule) return UsersModule.loadDeletions();
  },
  approveDeletion(reqId, userId) {
    if (window.UsersModule) return UsersModule.approveDeletion(reqId, userId);
  },
  rejectDeletion(reqId) {
    if (window.UsersModule) return UsersModule.rejectDeletion(reqId);
  },
  loadAdmins() {
    if (window.UsersModule) return UsersModule.loadAdmins();
  },
  createAdmin() {
    if (window.UsersModule) return UsersModule.createAdmin();
  },
  removeAdmin(uid) {
    if (window.UsersModule) return UsersModule.removeAdmin(uid);
  },
  listenVerifications() {
    if (window.PaymentsVerificationModule) return PaymentsVerificationModule.listenVerifications();
  },
  filterVerificationsList() {
    if (window.PaymentsVerificationModule) return PaymentsVerificationModule.filterVerificationsList();
  },
  approveVerification(reqId) {
    if (window.PaymentsVerificationModule) return PaymentsVerificationModule.approveVerification(reqId);
  },
  rejectVerification(reqId) {
    if (window.PaymentsVerificationModule) return PaymentsVerificationModule.rejectVerification(reqId);
  },
  listenOtpRequests() {
    if (window.PaymentsVerificationModule) return PaymentsVerificationModule.listenOtpRequests();
  },
  filterOtpList() {
    if (window.PaymentsVerificationModule) return PaymentsVerificationModule.filterOtpList();
  },
  markOtpSent(reqId, channel) {
    if (window.PaymentsVerificationModule) return PaymentsVerificationModule.markOtpSent(reqId, channel);
  },
  loadReports() {
    if (window.ModerationModule) return ModerationModule.loadReports();
  },
  filterReports() {
    if (window.ModerationModule) return ModerationModule.filterReports();
  },
  updateReport(id, status) {
    if (window.ModerationModule) return ModerationModule.updateReport(id, status);
  },
  filterPosts() {
    if (window.ModerationModule) return ModerationModule.filterPosts();
  },
  loadPromotions() {
    if (window.ModerationModule) return ModerationModule.loadPromotions();
  },
  deletePromotion(id) {
    if (window.ModerationModule) return ModerationModule.deletePromotion(id);
  },
  loadContracts() {
    if (window.ModerationModule) return ModerationModule.loadContracts();
  },
  filterContracts() {
    if (window.ModerationModule) return ModerationModule.filterContracts();
  },
  toggleNotifFilters() {
    if (window.NotificationsModule) return NotificationsModule.toggleNotifFilters();
  },
  sendNotification() {
    if (window.NotificationsModule) return NotificationsModule.sendNotification();
  },
  loadNotifHistory() {
    if (window.NotificationsModule) return NotificationsModule.loadNotifHistory();
  },
  deleteNotificationLog(id) {
    if (window.NotificationsModule) return NotificationsModule.deleteNotificationLog(id);
  },
  loadSettings() {
    if (window.SettingsSystemModule) return SettingsSystemModule.loadSettings();
  },
  saveSettings(section) {
    if (window.SettingsSystemModule) return SettingsSystemModule.saveSettings(section);
  },

  // ── Jhome Academy Legacy Compatibility Methods ──
  async getAcademyAccounts() {
    const snap = await jhomeDb.collection('bankAccounts').get();
    if (snap.empty) return [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async renderAcademyAccounts() {
    const list = document.getElementById('bank-accounts-list');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="4" style="text-align: center;">جاري التحميل...</td></tr>';
    const accounts = await this.getAcademyAccounts();
    if (!accounts.length) {
      list.innerHTML = '<tr><td colspan="4" style="text-align: center;">لا توجد حسابات</td></tr>';
      return;
    }
    list.innerHTML = accounts.map(acc => `
      <tr style="border-bottom: 1px solid var(--border-glass);">
        <td style="padding: 1rem;">${escapeHtml(acc.bankName)}</td>
        <td style="padding: 1rem;">${escapeHtml(acc.accountName)}</td>
        <td style="padding: 1rem; font-family: monospace;">${escapeHtml(acc.accountNumber)}</td>
        <td style="padding: 1rem;">
          <button class="btn btn-sm btn-danger" onclick="AdminApp.deleteAcademyAccount('${escapeAttr(acc.id)}')">حذف</button>
        </td>
      </tr>
    `).join('');
  },

  async addAcademyAccount(e) {
    if (e && e.preventDefault) e.preventDefault();
    const bankName = document.getElementById('new-bank-name')?.value.trim() || '';
    const accountName = document.getElementById('new-account-name')?.value.trim() || '';
    const accountNumber = document.getElementById('new-account-number')?.value.trim() || '';
    if (!bankName || !accountName || !accountNumber) return;
    await jhomeDb.collection('bankAccounts').add({ bankName, accountName, accountNumber });
    document.getElementById('add-bank-form')?.reset();
    await this.renderAcademyAccounts();
  },

  async deleteAcademyAccount(id) {
    const confirmed = await AdminDialog.confirm({
      title: 'حذف حساب الأكاديمية',
      message: 'هل أنت متأكد من حذف هذا الحساب البنكي؟',
      confirmText: 'حذف',
      danger: true
    });
    if (!confirmed) return;
    await jhomeDb.collection('bankAccounts').doc(id).delete();
    await this.renderAcademyAccounts();
  },

  async getAcademyUsers() {
    const snap = await jhomeDb.collection('academyUsers').get();
    if (snap.empty) return [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async renderAcademyUsers() {
    const list = document.getElementById('users-list');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="4" style="text-align: center;">جاري التحميل...</td></tr>';
    const users = await this.getAcademyUsers();
    if (!users.length) {
      list.innerHTML = '<tr><td colspan="4" style="text-align: center;">لا يوجد مستخدمون</td></tr>';
      return;
    }
    list.innerHTML = users.map(user => {
      const roleBadge = user.role === 'instructor'
        ? '<span class="report-status warning">مدرب / مشرف</span>'
        : '<span class="report-status info">طالب</span>';
      return `
        <tr style="border-bottom: 1px solid var(--border-glass);">
          <td style="padding: 1rem;">${escapeHtml(user.fullname)}</td>
          <td style="padding: 1rem; font-family: monospace; color: var(--primary-light);">${escapeHtml(user.username)}</td>
          <td style="padding: 1rem;">${roleBadge}</td>
          <td style="padding: 1rem;">
            <button class="btn btn-sm btn-danger" onclick="AdminApp.deleteAcademyUser('${escapeAttr(user.id)}')">حذف</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async addAcademyUser(e) {
    if (e && e.preventDefault) e.preventDefault();
    const fullname = document.getElementById('new-user-fullname')?.value.trim() || '';
    const role = document.getElementById('new-user-role')?.value || 'student';
    if (!fullname) return;
    const base = fullname.replace(/\s+/g, '').toLowerCase();
    await jhomeDb.collection('academyUsers').add({
      fullname,
      username: base,
      password: base,
      role
    });
    document.getElementById('add-user-form')?.reset();
    await this.renderAcademyUsers();
  },

  async deleteAcademyUser(id) {
    const confirmed = await AdminDialog.confirm({
      title: 'حذف مستخدم الأكاديمية',
      message: 'هل أنت متأكد من حذف هذا المستخدم؟',
      confirmText: 'حذف',
      danger: true
    });
    if (!confirmed) return;
    if (id === 'admin-1') return;
    await jhomeDb.collection('academyUsers').doc(id).delete();
    await this.renderAcademyUsers();
  }
};

// Initialize theme immediately
AdminApp.initTheme();

// ── Auth State Listener ──
auth.onAuthStateChanged(async user => {
  if (user) {
    try {
      const doc = await db.collection('users').doc(user.uid).get();
      if (doc.exists && doc.data().role === 'admin') {
        AdminApp.showDashboard(doc.data().name || 'المشرف');
        AdminApp.loadNotifHistory();
      } else {
        AdminApp.logout();
      }
    } catch (e) {
      console.error('Auth state verification error:', e);
    }
  }
});

// ── Admin AI Assistant ──
const AdminAI = {
  isOpen: false,
  toggleChat() {
    this.isOpen = !this.isOpen;
    const win = document.getElementById('admin-ai-window');
    if (win) win.style.display = this.isOpen ? 'flex' : 'none';
    if (this.isOpen) document.getElementById('ai-input')?.focus();
  },
  async sendMessage() {
    const inputEl = document.getElementById('ai-input');
    const text = inputEl?.value.trim() || '';
    if (!text) return;

    inputEl.value = '';
    this.appendMessage('user', text);
    this.appendMessage('system', 'جاري معالجة البيانات...', 'ai-loading');

    try {
      const func = functions.httpsCallable('adminAiAssistant');
      const res = await func({ query: text });
      this.removeMessage('ai-loading');
      this.appendMessage('system', res?.data?.response || 'اكتملت العملية.');
    } catch (e) {
      this.removeMessage('ai-loading');
      this.appendMessage('system', 'حدث خطأ أثناء التواصل مع المساعد الذكي.');
    }
  },
  appendMessage(role, text, id = null) {
    const container = document.getElementById('ai-messages-container');
    if (!container) return;
    const msg = document.createElement('div');
    msg.className = `ai-msg ai-msg-${role}`;
    if (id) msg.id = id;

    // Escape untrusted text before applying simple markdown bold/newlines
    const safe = escapeHtml(text);
    msg.innerHTML = safe
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  },
  removeMessage(id) {
    document.getElementById(id)?.remove();
  }
};

window.AdminAI = AdminAI;
window.AdminApp = AdminApp;
