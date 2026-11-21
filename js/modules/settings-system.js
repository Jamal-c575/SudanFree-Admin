/**
 * SettingsSystemModule — Unified App Config, Links, Social/Share Settings, Site Control,
 * and Read-Only System Errors Viewer (`system_errors` has `allow read: if isAdmin(); allow update, delete: if false;`).
 */
(function () {
  const SettingsSystemModule = {
    systemErrors: [],

    // ── App Settings (`app_config/main`, `app_config/settings`, `settings/app_settings`) ──
    async loadSettings() {
      try {
        const [mainDoc, settingsDoc, appSettingsDoc] = await Promise.all([
          db.collection('app_config').doc('main').get().catch(() => ({ exists: false })),
          db.collection('app_config').doc('settings').get().catch(() => ({ exists: false })),
          db.collection('settings').doc('app_settings').get().catch(() => ({ exists: false }))
        ]);

        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el && val !== undefined && val !== null) el.value = val;
        };

        if (mainDoc.exists) {
          const m = mainDoc.data() || {};
          setVal('setting-min-version', m.min_version || '');
          setVal('setting-main-store-url', m.store_url || '');
        }

        if (settingsDoc.exists) {
          const d = settingsDoc.data() || {};
          setVal('setting-playstore', d.playStoreUrl || '');
          setVal('setting-appstore', d.appStoreUrl || '');
          setVal('setting-apk', d.apkUrl || '');
          setVal('setting-privacy', d.privacyUrl || '');
          setVal('setting-terms', d.termsUrl || '');
          setVal('setting-support', d.supportUrl || '');
        }

        if (appSettingsDoc.exists) {
          const d2 = appSettingsDoc.data() || {};
          setVal('setting-ai-welcome', d2.ai_welcome_prompt || '');
          setVal('setting-ai-system', d2.ai_system_prompt || '');
          setVal('setting-social-whatsapp', d2.whatsapp || '');
          setVal('setting-social-facebook', d2.facebook || '');
          setVal('setting-social-telegram', d2.telegram || '');
          setVal('setting-social-website', d2.website || '');
          setVal('setting-share-ar', d2.share_text_ar || '');
          setVal('setting-share-en', d2.share_text_en || '');
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    },

    async saveSettings(section) {
      try {
        const now = firebase.firestore.FieldValue.serverTimestamp();
        if (section === 'version') {
          const min_version = document.getElementById('setting-min-version')?.value.trim() || '1.0.0';
          const store_url = document.getElementById('setting-main-store-url')?.value.trim() || '';
          await db.collection('app_config').doc('main').set({
            min_version,
            store_url,
            updatedAt: now
          }, { merge: true });
          showToast('تم حفظ إعدادات التحديث الإجباري (app_config/main) بنجاح', 'success');
          return;
        }

        if (section === 'links') {
          await db.collection('app_config').doc('settings').set({
            playStoreUrl: document.getElementById('setting-playstore')?.value.trim() || '',
            appStoreUrl: document.getElementById('setting-appstore')?.value.trim() || '',
            apkUrl: document.getElementById('setting-apk')?.value.trim() || '',
            updatedAt: now
          }, { merge: true });
          showToast('تم حفظ روابط المتاجر بنجاح', 'success');
          return;
        }

        if (section === 'policies') {
          await db.collection('app_config').doc('settings').set({
            privacyUrl: document.getElementById('setting-privacy')?.value.trim() || '',
            termsUrl: document.getElementById('setting-terms')?.value.trim() || '',
            supportUrl: document.getElementById('setting-support')?.value.trim() || '',
            updatedAt: now
          }, { merge: true });
          showToast('تم حفظ روابط السياسات والدعم بنجاح', 'success');
          return;
        }

        if (section === 'social') {
          await db.collection('settings').doc('app_settings').set({
            whatsapp: document.getElementById('setting-social-whatsapp')?.value.trim() || '',
            facebook: document.getElementById('setting-social-facebook')?.value.trim() || '',
            telegram: document.getElementById('setting-social-telegram')?.value.trim() || '',
            website: document.getElementById('setting-social-website')?.value.trim() || '',
            share_text_ar: document.getElementById('setting-share-ar')?.value.trim() || '',
            share_text_en: document.getElementById('setting-share-en')?.value.trim() || '',
            updatedAt: now
          }, { merge: true });
          showToast('تم حفظ روابط التواصل ونصوص المشاركة بنجاح', 'success');
          return;
        }

        if (section === 'ai') {
          await db.collection('settings').doc('app_settings').set({
            ai_welcome_prompt: document.getElementById('setting-ai-welcome')?.value.trim() || '',
            ai_system_prompt: document.getElementById('setting-ai-system')?.value.trim() || '',
            updatedAt: now
          }, { merge: true });
          showToast('تم حفظ توجيهات وقوانين الذكاء الاصطناعي بنجاح', 'success');
          return;
        }
      } catch (e) {
        showToast('خطأ في الحفظ: ' + e.message, 'error');
      }
    },

    // ── Site Control (`system_settings/config`) ──
    async loadSiteControl() {
      try {
        const doc = await db.collection('system_settings').doc('config').get();
        if (doc.exists) {
          const data = doc.data() || {};
          const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
          setVal('setting-ai-enabled', data.aiEnabled !== false ? 'true' : 'false');
          setVal('setting-ai-prompt', data.aiPrompt || '');
          setVal('setting-maintenance', data.maintenanceMode === true ? 'true' : 'false');
          setVal('setting-maintenance-msg', data.maintenanceMessage || '');
          setVal('setting-announcement-enabled', data.announcementEnabled === true ? 'true' : 'false');
          setVal('setting-announcement', data.announcementMessage || '');
        }
      } catch (error) {
        console.error('Error loading system_settings/config:', error);
      }
    },

    async saveSiteControl() {
      const btn = document.querySelector('#page-site-control .btn-primary');
      if (btn) {
        btn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> جاري الحفظ...';
        btn.disabled = true;
      }
      try {
        const data = {
          aiEnabled: document.getElementById('setting-ai-enabled')?.value === 'true',
          aiPrompt: document.getElementById('setting-ai-prompt')?.value || '',
          maintenanceMode: document.getElementById('setting-maintenance')?.value === 'true',
          maintenanceMessage: document.getElementById('setting-maintenance-msg')?.value || '',
          announcementEnabled: document.getElementById('setting-announcement-enabled')?.value === 'true',
          announcementMessage: document.getElementById('setting-announcement')?.value || '',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('system_settings').doc('config').set(data, { merge: true });
        showToast('تم حفظ إعدادات تحكم النظام بنجاح', 'success');
      } catch (error) {
        showToast('حدث خطأ أثناء الحفظ: ' + error.message, 'error');
      } finally {
        if (btn) {
          btn.innerHTML = '<span class="material-icons-outlined">save</span> حفظ التغييرات';
          btn.disabled = false;
        }
      }
    },

    // ── Read-Only System Errors Viewer (`system_errors`) ──
    async loadSystemErrors() {
      const tbody = document.getElementById('system-errors-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="5"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        let snap;
        try {
          snap = await db.collection('system_errors').orderBy('timestamp', 'desc').limit(100).get();
        } catch (_) {
          snap = await db.collection('system_errors').limit(100).get();
        }
        this.systemErrors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.filterSystemErrors();
      } catch (e) {
        console.error('Error loading system_errors:', e);
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:var(--danger)">خطأ في تحميل سجل الأخطاء: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    filterSystemErrors() {
      const search = (document.getElementById('system-errors-search')?.value || '').toLowerCase();
      let list = this.systemErrors;
      if (search) {
        list = list.filter(err =>
          (err.error || err.message || '').toLowerCase().includes(search) ||
          (err.context || err.screen || '').toLowerCase().includes(search) ||
          (err.platform || '').toLowerCase().includes(search)
        );
      }
      this.renderSystemErrors(list);
    },

    renderSystemErrors(list) {
      const tbody = document.getElementById('system-errors-tbody');
      if (!tbody) return;

      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد أخطاء مسجلة في النظام</td></tr>';
        return;
      }

      // Read-only viewer (firestore.rules allows read only, no delete/update)
      tbody.innerHTML = list.map((err, idx) => {
        const msg = String(err.error || err.message || 'خطأ غير معروف');
        const ctx = err.context || err.screen || 'عام';
        const platform = err.platform || err.os || 'App';
        const timeStr = formatDateTime(err.timestamp || err.createdAt);

        return `
          <tr>
            <td>${escapeHtml(timeStr)}</td>
            <td><span class="chip">${escapeHtml(platform)}</span></td>
            <td><strong>${escapeHtml(ctx)}</strong></td>
            <td><div style="max-width:440px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:monospace; font-size:13px;">${escapeHtml(msg)}</div></td>
            <td>
              <button class="btn btn-sm btn-ghost" onclick="SettingsSystemModule.viewErrorDetail(${idx})">
                <span class="material-icons-outlined" style="font-size:16px;">code</span> التفاصيل
              </button>
            </td>
          </tr>
        `;
      }).join('');
    },

    viewErrorDetail(index) {
      const err = this.systemErrors[index];
      if (!err) return;
      const body = document.getElementById('error-detail-body');
      if (!body) return;

      body.innerHTML = `
        <div class="detail-grid" style="margin-bottom:14px;">
          <div class="detail-item"><div class="label">التوقيت</div><div class="value">${escapeHtml(formatDateTime(err.timestamp || err.createdAt))}</div></div>
          <div class="detail-item"><div class="label">المنصة / السياق</div><div class="value">${escapeHtml(err.platform || 'App')} — ${escapeHtml(err.context || 'عام')}</div></div>
        </div>
        <div class="detail-item full-width" style="margin-bottom:12px;">
          <div class="label">رسالة الخطأ</div>
          <div class="value" dir="ltr" style="font-family:monospace; font-size:13px;">${escapeHtml(err.error || err.message || '')}</div>
        </div>
        <div class="detail-item full-width">
          <div class="label">تتبع المكدس (Stack Trace)</div>
          <pre dir="ltr" style="max-height:280px; overflow:auto; font-size:13px; color:var(--text-secondary); white-space:pre-wrap; margin-top:6px;">${escapeHtml(err.stackTrace || err.stack || 'لا يوجد تتبع مكدس')}</pre>
        </div>
      `;

      const modal = document.getElementById('error-detail-modal');
      if (modal) modal.style.display = 'flex';
    }
  };

  window.SettingsSystemModule = SettingsSystemModule;
  window.SiteControl = {
    init: () => SettingsSystemModule.loadSiteControl(),
    saveSettings: () => SettingsSystemModule.saveSiteControl()
  };
})();
