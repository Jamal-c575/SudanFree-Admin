/**
 * MarketsModule — Global Markets Manager (`market_configs/{countryCode}`)
 *
 * CRITICAL `firebase/firestore.rules` (lines 1324-1338) constraint:
 * - Document ID MUST match `^[A-Z]{2}$`
 * - `request.resource.data.keys().hasOnly(['countryCode', 'isEnabled', 'currency', 'locales', 'features'])`
 *   NEVER include `updatedAt` or any extra field!
 * - `countryCode == docId`
 * - `isEnabled is bool`
 * - `currency is string && currency.size() >= 1 && currency.size() <= 8`
 * - `locales is list` of lowercase 2-letter strings (`^[a-z]{2}$`)
 * - `features is list` of strings (`^[a-z0-9_.-]{1,40}$`)
 */
(function () {
  const MarketsModule = {
    markets: [],
    isEditing: false,

    initSelects() {
      const countrySel = document.getElementById('market-country-code');
      const currencySel = document.getElementById('market-currency');
      if (countrySel && countrySel.options.length <= 1 && window.AvyraCatalogs) {
        countrySel.innerHTML = AvyraCatalogs.COUNTRIES.map(c =>
          `<option value="${escapeAttr(c.code)}">${escapeHtml(c.nameAr)} (${escapeHtml(c.code)})</option>`
        ).join('');
      }
      if (currencySel && currencySel.options.length <= 1 && window.AvyraCatalogs) {
        currencySel.innerHTML = AvyraCatalogs.CURRENCIES.map(cur =>
          `<option value="${escapeAttr(cur.code)}">${escapeHtml(cur.code)} — ${escapeHtml(cur.nameAr)} (${escapeHtml(cur.symbol)})</option>`
        ).join('');
      }
    },

    onCountryChange() {
      const countrySel = document.getElementById('market-country-code');
      const currencySel = document.getElementById('market-currency');
      if (!countrySel || !currencySel || !window.AvyraCatalogs) return;
      const defaultCur = AvyraCatalogs.getDefaultCurrencyForCountry(countrySel.value);
      if (defaultCur) currencySel.value = defaultCur;
    },

    async loadMarkets() {
      this.initSelects();
      const tbody = document.getElementById('markets-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('market_configs').get();
        this.markets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.markets.sort((a, b) => (a.countryCode || a.id).localeCompare(b.countryCode || b.id));
        this.renderMarkets();
      } catch (e) {
        console.error('Error loading market_configs:', e);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--danger)">خطأ في تحميل الأسواق: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    renderMarkets() {
      const tbody = document.getElementById('markets-tbody');
      if (!tbody) return;

      if (!this.markets.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد أسواق مضافة بعد. اضغط على "إضافة سوق جديد" أو "تهيئة السودان (SD)".</td></tr>';
        return;
      }

      tbody.innerHTML = this.markets.map(m => {
        const cc = String(m.countryCode || m.id || '').toUpperCase();
        const countryLabel = window.AvyraCatalogs ? AvyraCatalogs.getCountryName(cc) : cc;
        const currencyLabel = window.AvyraCatalogs ? AvyraCatalogs.getCurrencyLabel(m.currency) : (m.currency || 'SDG');
        const locales = Array.isArray(m.locales) ? m.locales : ['ar', 'en'];
        const features = Array.isArray(m.features) ? m.features : [];
        const isEnabled = m.isEnabled !== false;

        const featuresHtml = features.length
          ? `<div class="chip-list">${features.map(f => `<span class="chip chip-primary">${escapeHtml(f)}</span>`).join('')}</div>`
          : '<span style="color:var(--text-muted)">—</span>';

        const localesHtml = locales.map(l => `<span class="chip">${escapeHtml(l)}</span>`).join(' ');

        return `
          <tr>
            <td><strong>${escapeHtml(countryLabel)}</strong></td>
            <td><span class="chip">${escapeHtml(currencyLabel)}</span></td>
            <td>${localesHtml}</td>
            <td>${featuresHtml}</td>
            <td>
              <span class="report-status ${isEnabled ? 'reviewed' : 'dismissed'}">
                ${isEnabled ? 'مفعل' : 'معطل'}
              </span>
            </td>
            <td>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-sm btn-ghost" onclick="MarketsModule.openEditModal('${escapeAttr(cc)}')">
                  <span class="material-icons-outlined" style="font-size:16px;">edit</span> تعديل
                </button>
                <button class="btn btn-sm ${isEnabled ? 'btn-warning' : 'btn-success'}" onclick="MarketsModule.toggleMarket('${escapeAttr(cc)}')">
                  ${isEnabled ? 'تعطيل' : 'تفعيل'}
                </button>
                <button class="btn btn-sm btn-danger" onclick="MarketsModule.deleteMarket('${escapeAttr(cc)}')">
                  <span class="material-icons-outlined" style="font-size:16px;">delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    },

    openAddModal() {
      this.initSelects();
      this.isEditing = false;
      const titleEl = document.getElementById('market-modal-title');
      if (titleEl) titleEl.textContent = 'إضافة سوق دولة جديد';

      const countrySel = document.getElementById('market-country-code');
      if (countrySel) {
        countrySel.disabled = false;
        countrySel.value = 'SD';
      }
      const currencySel = document.getElementById('market-currency');
      if (currencySel) currencySel.value = 'SDG';

      const enabledSel = document.getElementById('market-is-enabled');
      if (enabledSel) enabledSel.value = 'true';

      document.querySelectorAll('.market-locale-cb').forEach(cb => {
        cb.checked = cb.value === 'ar' || cb.value === 'en';
      });
      document.querySelectorAll('.market-feature-cb').forEach(cb => {
        cb.checked = true;
      });

      const modal = document.getElementById('market-modal');
      if (modal) modal.style.display = 'flex';
    },

    openEditModal(countryCode) {
      this.initSelects();
      const cc = String(countryCode || '').toUpperCase();
      const m = this.markets.find(x => (x.countryCode || x.id) === cc);
      if (!m) return;

      this.isEditing = true;
      const titleEl = document.getElementById('market-modal-title');
      if (titleEl) titleEl.textContent = `تعديل سوق: ${cc}`;

      const countrySel = document.getElementById('market-country-code');
      if (countrySel) {
        countrySel.value = cc;
        countrySel.disabled = true;
      }
      const currencySel = document.getElementById('market-currency');
      if (currencySel) currencySel.value = m.currency || 'SDG';

      const enabledSel = document.getElementById('market-is-enabled');
      if (enabledSel) enabledSel.value = m.isEnabled !== false ? 'true' : 'false';

      const locales = Array.isArray(m.locales) ? m.locales : ['ar'];
      document.querySelectorAll('.market-locale-cb').forEach(cb => {
        cb.checked = locales.includes(cb.value);
      });

      const features = Array.isArray(m.features) ? m.features : [];
      document.querySelectorAll('.market-feature-cb').forEach(cb => {
        cb.checked = features.includes(cb.value);
      });

      const modal = document.getElementById('market-modal');
      if (modal) modal.style.display = 'flex';
    },

    async saveMarket(e) {
      if (e && e.preventDefault) e.preventDefault();
      const countrySel = document.getElementById('market-country-code');
      const currencySel = document.getElementById('market-currency');
      const enabledSel = document.getElementById('market-is-enabled');

      const countryCode = String(countrySel ? countrySel.value : '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(countryCode)) {
        showToast('رمز الدولة يجب أن يتكون من حرفين كبيرين (ISO-2)', 'error');
        return;
      }

      const currency = String(currencySel ? currencySel.value : 'USD').trim().toUpperCase();
      const isEnabled = enabledSel ? enabledSel.value === 'true' : true;

      const locales = Array.from(document.querySelectorAll('.market-locale-cb:checked'))
        .map(cb => String(cb.value).trim().toLowerCase())
        .filter(l => /^[a-z]{2}$/.test(l));

      if (!locales.length) {
        locales.push('ar');
      }

      const features = Array.from(document.querySelectorAll('.market-feature-cb:checked'))
        .map(cb => String(cb.value).trim())
        .filter(f => /^[a-z0-9_.-]{1,40}$/.test(f));

      // STRICT SCHEMA: only these 5 keys are permitted by firestore.rules
      const payload = {
        countryCode,
        isEnabled,
        currency,
        locales,
        features
      };

      try {
        await db.collection('market_configs').doc(countryCode).set(payload);
        showToast(`تم حفظ إعدادات السوق (${countryCode}) بنجاح`, 'success');
        if (window.AdminApp) AdminApp.closeModal('market-modal');
        await this.loadMarkets();
      } catch (err) {
        console.error('Error saving market_config:', err);
        showToast('فشل حفظ السوق: ' + err.message, 'error');
      }
    },

    async seedDefaultSudan() {
      const payload = {
        countryCode: 'SD',
        isEnabled: true,
        currency: 'SDG',
        locales: ['ar', 'en'],
        features: ['jobs', 'shops', 'news', 'unions', 'squads', 'community']
      };
      try {
        await db.collection('market_configs').doc('SD').set(payload);
        showToast('تمت تهيئة سوق السودان (SD) الافتراضي بنجاح', 'success');
        await this.loadMarkets();
      } catch (err) {
        showToast('خطأ في تهيئة السوق: ' + err.message, 'error');
      }
    },

    async toggleMarket(countryCode) {
      const cc = String(countryCode || '').toUpperCase();
      const m = this.markets.find(x => (x.countryCode || x.id) === cc);
      if (!m) return;

      const nextState = !(m.isEnabled !== false);
      const payload = {
        countryCode: cc,
        isEnabled: nextState,
        currency: String(m.currency || 'SDG'),
        locales: Array.isArray(m.locales) && m.locales.length ? m.locales : ['ar', 'en'],
        features: Array.isArray(m.features) ? m.features : ['jobs', 'shops', 'news', 'unions', 'squads']
      };

      try {
        await db.collection('market_configs').doc(cc).set(payload);
        showToast(nextState ? `تم تفعيل سوق ${cc}` : `تم تعطيل سوق ${cc}`);
        await this.loadMarkets();
      } catch (err) {
        showToast('خطأ في تحديث حالة السوق: ' + err.message, 'error');
      }
    },

    async deleteMarket(countryCode) {
      const cc = String(countryCode || '').toUpperCase();
      const confirmed = await AdminDialog.confirm({
        title: 'حذف السوق',
        message: `هل أنت متأكد من حذف إعدادات السوق (${cc}) نهائياً؟`,
        confirmText: 'حذف',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('market_configs').doc(cc).delete();
        showToast(`تم حذف السوق (${cc})`);
        await this.loadMarkets();
      } catch (err) {
        showToast('فشل الحذف: ' + err.message, 'error');
      }
    }
  };

  window.MarketsModule = MarketsModule;
})();
