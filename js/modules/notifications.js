/**
 * NotificationsModule — Targeted Push & In-App Broadcast Notifications
 * Supports targeting by:
 * - Country (`targetCountry`: 'ALL' or ISO-2 country code like 'SD', 'EG', 'SA', 'AE', ...)
 * - Region / State (`targetState`: dynamically populated per selected country from `AvyraCatalogs.getRegionsForCountry`)
 * - Locality (`targetLocality`: dynamically populated for Sudan states)
 * - Profession / Account Role (`targetRole`: 'all', 'freelancer', 'techService', 'privateService', 'shop', 'client')
 * - Live Target Audience Counter (`updateTargetCountPreview`)
 */
(function () {
  const NotificationsModule = {
    initNotifSelects() {
      const countrySel = document.getElementById('notif-country');
      if (countrySel && countrySel.options.length <= 1 && window.AvyraCatalogs) {
        countrySel.innerHTML = `<option value="all">كل الدول (عالمي - ALL)</option>` +
          AvyraCatalogs.COUNTRIES.map(c =>
            `<option value="${escapeAttr(c.code)}">${escapeHtml(c.nameAr)} (${escapeHtml(c.code)})</option>`
          ).join('');
      }

      const activeCC = window.AdminApp?.activeCountry || 'ALL';
      if (countrySel && activeCC !== 'ALL' && countrySel.value === 'all') {
        countrySel.value = activeCC;
      }

      this.onNotifCountryChange();
    },

    onNotifCountryChange() {
      const country = document.getElementById('notif-country')?.value || 'all';
      const stateSel = document.getElementById('notif-state');
      if (!stateSel || !window.AvyraCatalogs) return;

      const regions = AvyraCatalogs.getRegionsForCountry(country === 'all' ? 'SD' : country);
      if (regions.length > 0) {
        stateSel.innerHTML = `<option value="all">كل المناطق / الولايات</option>` +
          regions.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
      } else {
        stateSel.innerHTML = `<option value="all">كل المناطق</option>`;
      }
      this.onNotifStateChange();
      this.updateTargetCountPreview();
    },

    onNotifStateChange() {
      const country = document.getElementById('notif-country')?.value || 'all';
      const state = document.getElementById('notif-state')?.value || 'all';
      const locSel = document.getElementById('notif-locality');
      if (!locSel || !window.AvyraCatalogs) return;

      const locs = (state !== 'all')
        ? AvyraCatalogs.getLocalitiesForRegion(country === 'all' ? 'SD' : country, state)
        : [];

      locSel.innerHTML = `<option value="">كل المحليات</option>` +
        locs.map(l => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join('');
      this.updateTargetCountPreview();
    },

    toggleNotifFilters() {
      this.initNotifSelects();
      const type = document.getElementById('notif-type')?.value || 'all';
      const countryGroup = document.getElementById('notif-country-group');
      const roleGroup = document.getElementById('notif-role-group');
      const stateGroup = document.getElementById('notif-state-group');
      const locGroup = document.getElementById('notif-locality-group');

      const showCountry = ['country', 'country_role', 'state', 'role_state'].includes(type);
      const showRole = ['role', 'country_role', 'role_state'].includes(type);
      const showState = ['state', 'role_state'].includes(type);

      if (countryGroup) countryGroup.style.display = showCountry ? 'flex' : 'none';
      if (roleGroup) roleGroup.style.display = showRole ? 'flex' : 'none';
      if (stateGroup) stateGroup.style.display = showState ? 'flex' : 'none';
      if (locGroup) locGroup.style.display = showState ? 'flex' : 'none';

      this.updateTargetCountPreview();
    },

    _getTargetingParams() {
      const type = document.getElementById('notif-type')?.value || 'all';
      let targetCountry = 'all';
      let targetRole = 'all';
      let targetState = 'all';
      let targetLocality = 'all';

      if (['country', 'country_role', 'state', 'role_state'].includes(type)) {
        targetCountry = document.getElementById('notif-country')?.value || 'all';
      }
      if (['role', 'country_role', 'role_state'].includes(type)) {
        targetRole = document.getElementById('notif-role')?.value || 'all';
      }
      if (['state', 'role_state'].includes(type)) {
        targetState = document.getElementById('notif-state')?.value || 'all';
        targetLocality = document.getElementById('notif-locality')?.value || 'all';
      }

      return { targetCountry, targetRole, targetState, targetLocality };
    },

    async updateTargetCountPreview() {
      const countEl = document.getElementById('notif-target-count');
      if (!countEl) return;

      const { targetCountry, targetRole, targetState, targetLocality } = this._getTargetingParams();
      const parts = [];
      if (targetCountry !== 'all') {
        parts.push(`الدولة: ${window.AvyraCatalogs ? AvyraCatalogs.getCountryName(targetCountry) : targetCountry}`);
      } else {
        parts.push('كل الدول');
      }
      if (targetState !== 'all') parts.push(`المنطقة: ${targetState}`);
      if (targetLocality && targetLocality !== 'all') parts.push(`المحلية: ${targetLocality}`);
      if (targetRole !== 'all') parts.push(`الفئة: ${ROLE_NAMES[targetRole] || targetRole}`);

      countEl.textContent = `الاستهداف: ${parts.join(' | ')}`;

      try {
        let q = db.collection('users');
        if (targetCountry !== 'all') q = q.where('countryCode', '==', targetCountry.toUpperCase());
        if (targetRole !== 'all') q = q.where('role', '==', targetRole);
        if (targetState !== 'all') q = q.where('state', '==', targetState);
        if (targetLocality && targetLocality !== 'all') q = q.where('locality', '==', targetLocality);

        if (window.StatsModule) {
          const c = await StatsModule.getCount(q);
          countEl.textContent = `الاستهداف: ${parts.join(' | ')} (${c} مستخدم مطابق تقريباً)`;
        }
      } catch (_) {}
    },

    async sendNotification() {
      const title = document.getElementById('notif-title')?.value.trim() || '';
      const body = document.getElementById('notif-body')?.value.trim() || '';
      if (!title || !body) {
        showToast('يرجى ملء عنوان الإشعار ومحتواه', 'error');
        return;
      }

      const { targetCountry, targetRole, targetState, targetLocality } = this._getTargetingParams();

      const confirmed = await AdminDialog.confirm({
        title: 'إرسال الإشعار الجماعي الموجه',
        message: 'هل أنت متأكد من إرسال هذا الإشعار المستهدف عبر الخادم (Push + In-App)؟',
        confirmText: 'إرسال الإشعار'
      });
      if (!confirmed) return;

      const btn = document.querySelector('button[onclick="AdminApp.sendNotification()"]');
      const oldText = btn ? btn.innerHTML : '';
      if (btn) {
        btn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> جاري الإرسال...';
        btn.disabled = true;
      }

      try {
        const sendFn = functions.httpsCallable('adminSendNotification');
        const res = await sendFn({
          title,
          message: body,
          targetCountry,
          targetRole,
          targetState,
          targetLocality
        });

        const matched = res?.data?.matchedUsers ?? res?.data?.fcmSent ?? 0;
        showToast(`تم إرسال الإشعار بنجاح (${matched} مستخدم مطابق)`, 'success');

        document.getElementById('notif-title').value = '';
        document.getElementById('notif-body').value = '';
        await this.loadNotifHistory();
      } catch (e) {
        console.error('Error sending notification:', e);
        showToast('خطأ في إرسال الإشعار: ' + e.message, 'error');
      } finally {
        if (btn) {
          btn.innerHTML = oldText;
          btn.disabled = false;
        }
      }
    },

    async loadNotifHistory() {
      this.initNotifSelects();
      const el = document.getElementById('notif-history');
      if (!el) return;
      try {
        const snap = await db.collection('bulk_notifications').orderBy('createdAt', 'desc').limit(30).get();
        if (snap.empty) {
          el.innerHTML = '<p class="empty-state">لم يتم إرسال إشعارات جماعية بعد</p>';
          return;
        }
        el.innerHTML = snap.docs.map(d => {
          const n = d.data();
          const sentCount = n.fcmSent ?? n.matchedUsers ?? 0;
          const chips = [];
          if (n.targetCountry && n.targetCountry !== 'all') chips.push(`الدولة: ${n.targetCountry}`);
          if (n.targetState && n.targetState !== 'all') chips.push(`المنطقة: ${n.targetState}`);
          if (n.targetLocality && n.targetLocality !== 'all') chips.push(`المحلية: ${n.targetLocality}`);
          if (n.targetRole && n.targetRole !== 'all') chips.push(`الفئة: ${ROLE_NAMES[n.targetRole] || n.targetRole}`);

          const chipsHtml = chips.length
            ? `<div class="chip-list" style="margin:6px 0;">${chips.map(c => `<span class="chip chip-primary">${escapeHtml(c)}</span>`).join('')}</div>`
            : `<div class="chip-list" style="margin:6px 0;"><span class="chip">عام (جميع المستخدمين)</span></div>`;

          return `
            <div style="padding:14px 0;border-bottom:1px solid var(--border-glass)">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${escapeHtml(n.title || '')}</strong>
                <button class="btn btn-sm btn-ghost" onclick="AdminApp.deleteNotificationLog('${escapeAttr(d.id)}')" style="color:var(--danger);">
                  <span class="material-icons-outlined" style="font-size:16px;">delete</span>
                </button>
              </div>
              <div style="color:var(--text-secondary);font-size:14px;margin:4px 0;">${escapeHtml(n.message || '')}</div>
              ${chipsHtml}
              <small style="color:var(--text-muted);font-size:13px;">${escapeHtml(timeAgo(n.createdAt))} — أُرسل إلى ${escapeHtml(sentCount)} مستخدم</small>
            </div>
          `;
        }).join('');
      } catch (e) {
        console.error('Error loading bulk_notifications:', e);
      }
    },

    async deleteNotificationLog(id) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف سجل الإشعار',
        message: 'هل أنت متأكد من حذف هذا السجل؟',
        confirmText: 'حذف',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('bulk_notifications').doc(id).delete();
        await this.loadNotifHistory();
        showToast('تم حذف السجل');
      } catch (e) {
        showToast('خطأ في الحذف: ' + e.message, 'error');
      }
    }
  };

  window.NotificationsModule = NotificationsModule;
})();
