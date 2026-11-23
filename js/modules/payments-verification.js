/**
 * PaymentsVerificationModule — Manages:
 * 1. Global & Per-Country Payment Methods (`admin_settings/payment_methods`)
 * 2. Verification Fee Settings (`admin_settings/verification_settings`)
 * 3. Account Verification Queue (`verification_requests`) — strictly updating ONLY `['status', 'reviewedAt']`
 * 4. Manual OTP Delivery Queue (`otp_codes`) — accurate WhatsApp/SMS channel detection
 */
(function () {
  const PaymentsVerificationModule = {
    methods: [],
    editingMethodIndex: -1,
    verificationSettings: {
      isFeeRequired: true,
      defaultFee: 2000,
      defaultCurrency: 'SDG',
      defaultMethods: ['bank_transfer'],
      countryFees: {}
    },
    verificationsData: [],
    otpData: [],
    selectedOtpLangs: {},
    _verifUnsub: null,
    _otpUnsub: null,

    initPaymentSelects() {
      const countryFilter = document.getElementById('payment-country-filter');
      const modalCountry = document.getElementById('payment-country');
      const verifCurrency = document.getElementById('verif-default-currency');
      const cfCountry = document.getElementById('verif-cf-country');
      const cfCurrency = document.getElementById('verif-cf-currency');

      if (window.AvyraCatalogs) {
        const countryOpts = `<option value="ALL">عالمي (جميع الدول - ALL)</option>` +
          AvyraCatalogs.COUNTRIES.map(c =>
            `<option value="${escapeAttr(c.code)}">${escapeHtml(c.nameAr)} (${escapeHtml(c.code)})</option>`
          ).join('');

        if (modalCountry && modalCountry.options.length <= 1) {
          modalCountry.innerHTML = countryOpts;
        }
        if (countryFilter && countryFilter.options.length <= 1) {
          countryFilter.innerHTML = `<option value="">كل الدول</option>` + countryOpts;
        }
        if (cfCountry && cfCountry.options.length <= 1) {
          cfCountry.innerHTML = AvyraCatalogs.COUNTRIES.map(c =>
            `<option value="${escapeAttr(c.code)}">${escapeHtml(c.nameAr)} (${escapeHtml(c.code)})</option>`
          ).join('');
        }

        const curOpts = AvyraCatalogs.CURRENCIES.map(cur =>
          `<option value="${escapeAttr(cur.code)}">${escapeHtml(cur.code)} — ${escapeHtml(cur.nameAr)}</option>`
        ).join('');
        if (verifCurrency && verifCurrency.options.length <= 1) verifCurrency.innerHTML = curOpts;
        if (cfCurrency && cfCurrency.options.length <= 1) cfCurrency.innerHTML = curOpts;
      }
    },

    // ── Payment Methods (`admin_settings/payment_methods`) ──
    async loadMethods() {
      this.initPaymentSelects();
      const grid = document.getElementById('payment-methods-grid');
      if (!grid) return;
      grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

      try {
        const snap = await db.collection('admin_settings').doc('payment_methods').get();
        this.methods = snap.exists ? (snap.data().methods || []) : [];
        this.renderMethods();
      } catch (e) {
        console.error('Error loading payment methods:', e);
        grid.innerHTML = '<div class="empty-state" style="color:var(--danger)">فشل تحميل حسابات الدفع</div>';
      }

      await this.loadVerificationSettings();
    },

    renderMethods() {
      const grid = document.getElementById('payment-methods-grid');
      if (!grid) return;

      const filterCountry = document.getElementById('payment-country-filter')?.value || '';
      const filtered = this.methods
        .map((m, idx) => ({ ...m, _idx: idx }))
        .filter(m => !filterCountry || (m.countryCode || 'SD') === filterCountry);

      if (!filtered.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">لا توجد حسابات دفع مطابقة.</div>';
        return;
      }

      grid.innerHTML = filtered.map(m => {
        const cc = m.countryCode || 'SD';
        const countryLabel = cc === 'ALL'
          ? 'عالمي (ALL)'
          : (window.AvyraCatalogs ? AvyraCatalogs.getCountryName(cc) : cc);
        const typeObj = window.AvyraCatalogs
          ? AvyraCatalogs.PAYMENT_TYPES.find(t => t.id === (m.type || 'bank_transfer'))
          : null;
        const typeLabel = typeObj ? typeObj.labelAr : (m.type || 'تحويل بنكي');
        const currencies = Array.isArray(m.supportedCurrencies) && m.supportedCurrencies.length
          ? m.supportedCurrencies.join(', ')
          : 'SDG';

        return `
          <div class="card" style="padding:18px; border-top:4px solid var(--primary); margin-bottom:0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <div>
                <div style="font-weight:800; font-size:16px; color:var(--text-primary);">${escapeHtml(m.bankName)}</div>
                <small style="color:var(--primary-light); font-weight:700;">${escapeHtml(typeLabel)}</small>
              </div>
              <span class="chip chip-primary">${escapeHtml(countryLabel)}</span>
            </div>
            <div style="color:var(--text-secondary); margin-bottom:6px; font-size:14px;">
              <strong>اسم الحساب:</strong> ${escapeHtml(m.accountName)}
            </div>
            <div style="color:var(--text-secondary); margin-bottom:6px; font-size:14px;">
              <strong>رقم الحساب:</strong> <span dir="ltr" style="font-family:monospace; color:var(--text-primary);">${escapeHtml(m.accountNumber)}</span>
            </div>
            <div style="color:var(--text-secondary); margin-bottom:6px; font-size:13px;">
              <strong>العملات المدعومة:</strong> ${escapeHtml(currencies)}
            </div>
            ${m.instructions ? `<div style="color:var(--text-muted); font-size:13px; margin-bottom:10px; background:var(--bg-surface-2); padding:8px; border-radius:8px;">${escapeHtml(m.instructions)}</div>` : ''}
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
              <button class="btn btn-sm btn-ghost" onclick="PaymentSettingsApp.openEditModal(${m._idx})">
                <span class="material-icons-outlined" style="font-size:16px;">edit</span> تعديل
              </button>
              <button class="btn btn-sm btn-danger" onclick="PaymentSettingsApp.deleteMethod(${m._idx})">
                <span class="material-icons-outlined" style="font-size:16px;">delete</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    },

    openAddModal() {
      this.initPaymentSelects();
      this.editingMethodIndex = -1;
      const titleEl = document.getElementById('payment-modal-title');
      if (titleEl) titleEl.textContent = 'إضافة وسيلة دفع جديدة';

      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      setVal('payment-id', '');
      setVal('payment-bank', '');
      setVal('payment-name', '');
      setVal('payment-number', '');
      setVal('payment-country', 'SD');
      setVal('payment-type', 'bank_transfer');
      setVal('payment-currencies', 'SDG');
      setVal('payment-instructions', '');

      const modal = document.getElementById('payment-modal');
      if (modal) modal.style.display = 'flex';
    },

    openEditModal(index) {
      this.initPaymentSelects();
      const m = this.methods[index];
      if (!m) return;
      this.editingMethodIndex = index;

      const titleEl = document.getElementById('payment-modal-title');
      if (titleEl) titleEl.textContent = 'تعديل وسيلة الدفع';

      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      setVal('payment-id', String(index));
      setVal('payment-bank', m.bankName || '');
      setVal('payment-name', m.accountName || '');
      setVal('payment-number', m.accountNumber || '');
      setVal('payment-country', m.countryCode || 'SD');
      setVal('payment-type', m.type || 'bank_transfer');
      setVal('payment-currencies', Array.isArray(m.supportedCurrencies) ? m.supportedCurrencies.join(', ') : 'SDG');
      setVal('payment-instructions', m.instructions || '');

      const modal = document.getElementById('payment-modal');
      if (modal) modal.style.display = 'flex';
    },

    async saveMethod(e) {
      if (e && e.preventDefault) e.preventDefault();
      const bankName = document.getElementById('payment-bank')?.value.trim() || '';
      const accountName = document.getElementById('payment-name')?.value.trim() || '';
      const accountNumber = document.getElementById('payment-number')?.value.trim() || '';
      const countryCode = document.getElementById('payment-country')?.value || 'SD';
      const type = document.getElementById('payment-type')?.value || 'bank_transfer';
      const currenciesRaw = document.getElementById('payment-currencies')?.value || 'SDG';
      const instructions = document.getElementById('payment-instructions')?.value.trim() || '';

      if (!bankName || !accountName || !accountNumber) {
        showToast('يرجى ملء اسم البنك واسم ورقم الحساب', 'error');
        return;
      }

      const supportedCurrencies = currenciesRaw
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      const methodObj = {
        bankName,
        accountName,
        accountNumber,
        countryCode,
        type,
        supportedCurrencies: supportedCurrencies.length ? supportedCurrencies : ['SDG'],
        instructions
      };

      try {
        const docRef = db.collection('admin_settings').doc('payment_methods');
        const snap = await docRef.get();
        const methods = snap.exists ? (snap.data().methods || []) : [];

        if (this.editingMethodIndex >= 0 && this.editingMethodIndex < methods.length) {
          methods[this.editingMethodIndex] = methodObj;
        } else {
          methods.push(methodObj);
        }

        await docRef.set({ methods }, { merge: true });
        if (window.AdminApp) AdminApp.closeModal('payment-modal');
        showToast('تم حفظ وسيلة الدفع بنجاح', 'success');
        await this.loadMethods();
      } catch (err) {
        console.error(err);
        showToast('فشل في الحفظ: ' + err.message, 'error');
      }
    },

    async deleteMethod(index) {
      const confirmed = await AdminDialog.confirm({
        title: 'حذف وسيلة الدفع',
        message: 'هل أنت متأكد من حذف حساب الدفع هذا؟',
        confirmText: 'حذف',
        danger: true
      });
      if (!confirmed) return;

      try {
        const docRef = db.collection('admin_settings').doc('payment_methods');
        const snap = await docRef.get();
        const methods = snap.exists ? (snap.data().methods || []) : [];
        methods.splice(index, 1);
        await docRef.set({ methods }, { merge: true });
        showToast('تم حذف وسيلة الدفع', 'success');
        await this.loadMethods();
      } catch (err) {
        showToast('فشل الحذف: ' + err.message, 'error');
      }
    },

    // ── Verification Settings (`admin_settings/verification_settings`) ──
    async loadVerificationSettings() {
      this.initPaymentSelects();
      try {
        const doc = await db.collection('admin_settings').doc('verification_settings').get();
        if (doc.exists) {
          const d = doc.data() || {};
          const rawCountryFees = d.countryFees && typeof d.countryFees === 'object' ? d.countryFees : {};
          const normalizedCountryFees = {};
          for (const [k, v] of Object.entries(rawCountryFees)) {
            const val = Number(v.amount ?? v.fee ?? 0);
            normalizedCountryFees[k] = {
              ...v,
              amount: val,
              fee: val,
              currency: v.currency || 'USD',
              isFeeRequired: v.isFeeRequired !== false,
              allowedMethods: Array.isArray(v.allowedMethods) ? v.allowedMethods : ['sms', 'whatsapp', 'email'],
              methods: Array.isArray(v.methods) ? v.methods : ['bank_transfer', 'wallet']
            };
          }
          this.verificationSettings = {
            isFeeRequired: d.isFeeRequired !== false,
            defaultFee: typeof d.defaultFee === 'number' ? d.defaultFee : (typeof d.defaultAmount === 'number' ? d.defaultAmount : 2000),
            defaultAmount: typeof d.defaultAmount === 'number' ? d.defaultAmount : (typeof d.defaultFee === 'number' ? d.defaultFee : 2000),
            defaultCurrency: d.defaultCurrency || 'SDG',
            defaultMethods: Array.isArray(d.defaultMethods) ? d.defaultMethods : ['bank_transfer'],
            countryFees: normalizedCountryFees
          };
        }
        this.renderVerificationSettings();
      } catch (e) {
        console.error('Error loading verification_settings:', e);
      }
    },

    renderVerificationSettings() {
      const s = this.verificationSettings;
      const feeReqEl = document.getElementById('verif-fee-required');
      const defFeeEl = document.getElementById('verif-default-fee');
      const defCurEl = document.getElementById('verif-default-currency');
      if (feeReqEl) feeReqEl.value = s.isFeeRequired ? 'true' : 'false';
      if (defFeeEl) defFeeEl.value = s.defaultFee;
      if (defCurEl) defCurEl.value = s.defaultCurrency || 'SDG';

      const tbody = document.getElementById('verif-country-fees-tbody');
      if (!tbody) return;
      const entries = Object.entries(s.countryFees || {});
      if (!entries.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">لا توجد تخصيصات رسوم حسب الدولة (يتم استخدام الرسوم الافتراضية).</td></tr>';
        return;
      }

      tbody.innerHTML = entries.map(([cc, cfg]) => {
        const countryLabel = window.AvyraCatalogs ? AvyraCatalogs.getCountryName(cc) : cc;
        const displayFee = cfg.amount ?? cfg.fee ?? 0;
        return `
          <tr>
            <td><strong>${escapeHtml(countryLabel)}</strong></td>
            <td>${escapeHtml(displayFee)}</td>
            <td><span class="chip">${escapeHtml(cfg.currency || 'USD')}</span></td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="PaymentSettingsApp.removeCountryFee('${escapeAttr(cc)}')">
                <span class="material-icons-outlined" style="font-size:16px;">delete</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    },

    async saveVerificationSettings() {
      const isFeeRequired = document.getElementById('verif-fee-required')?.value === 'true';
      const defaultFee = Number(document.getElementById('verif-default-fee')?.value || 0);
      const defaultCurrency = document.getElementById('verif-default-currency')?.value || 'SDG';

      this.verificationSettings.isFeeRequired = isFeeRequired;
      this.verificationSettings.defaultFee = defaultFee;
      this.verificationSettings.defaultAmount = defaultFee;
      this.verificationSettings.defaultCurrency = defaultCurrency;

      // Ensure every countryFee entry has both amount and fee for complete mobile compatibility
      if (this.verificationSettings.countryFees) {
        for (const [k, v] of Object.entries(this.verificationSettings.countryFees)) {
          const val = Number(v.amount ?? v.fee ?? 0);
          this.verificationSettings.countryFees[k] = {
            ...v,
            amount: val,
            fee: val,
            currency: v.currency || defaultCurrency,
            isFeeRequired: v.isFeeRequired !== false,
            allowedMethods: Array.isArray(v.allowedMethods) ? v.allowedMethods : ['sms', 'whatsapp', 'email'],
            methods: Array.isArray(v.methods) ? v.methods : ['bank_transfer', 'wallet']
          };
        }
      }

      try {
        await db.collection('admin_settings').doc('verification_settings').set({
          ...this.verificationSettings,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        showToast('تم حفظ إعدادات رسوم التوثيق بنجاح', 'success');
      } catch (e) {
        showToast('فشل حفظ إعدادات التوثيق: ' + e.message, 'error');
      }
    },

    async addCountryFee() {
      const cc = document.getElementById('verif-cf-country')?.value;
      const fee = Number(document.getElementById('verif-cf-fee')?.value || 0);
      const currency = document.getElementById('verif-cf-currency')?.value || 'USD';
      if (!cc) return;

      this.verificationSettings.countryFees = this.verificationSettings.countryFees || {};
      this.verificationSettings.countryFees[cc] = {
        amount: fee,
        fee: fee,
        currency: currency,
        isFeeRequired: true,
        allowedMethods: ['sms', 'whatsapp', 'email'],
        methods: ['bank_transfer', 'wallet']
      };
      this.renderVerificationSettings();
      await this.saveVerificationSettings();
    },

    async removeCountryFee(cc) {
      if (!this.verificationSettings.countryFees) return;
      delete this.verificationSettings.countryFees[cc];
      this.renderVerificationSettings();
      await this.saveVerificationSettings();
    },

    // ── Account Verification Requests (`verification_requests`) ──
    listenVerifications() {
      if (this._verifUnsub) this._verifUnsub();
      this._verifUnsub = db.collection('verification_requests')
        .where('status', '==', 'pending')
        .onSnapshot(async snap => {
          const badge = document.getElementById('verification-badge');
          if (badge) {
            badge.textContent = snap.size;
            badge.style.display = snap.size > 0 ? 'inline' : 'none';
          }

          const requestsWithUsers = await Promise.all(snap.docs.map(async doc => {
            const request = { id: doc.id, ...doc.data() };
            try {
              const user = window.PrivateUserHelper
                ? await PrivateUserHelper.fetchUserWithPrivate(request.userId)
                : ((await db.collection('users').doc(request.userId).get()).data() || {});
              return { ...request, user: user || {} };
            } catch (e) {
              return { ...request, user: {} };
            }
          }));

          this.verificationsData = requestsWithUsers;
          this.displayVerifications(requestsWithUsers);

          const dashEl = document.getElementById('dashboard-pending-verifications');
          if (!dashEl) return;
          if (snap.empty) {
            dashEl.innerHTML = '<p class="empty-state">لا توجد طلبات توثيق معلقة</p>';
            return;
          }
          dashEl.innerHTML = requestsWithUsers.slice(0, 4).map(req => {
            const u = req.user || {};
            const avatar = safeUrl(u.profileImageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=104D9E&color=fff`;
            return `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-glass)">
                <img style="width:40px;height:40px;border-radius:50%;object-fit:cover" src="${escapeAttr(avatar)}" alt="">
                <div style="flex:1">
                  <strong>${escapeHtml(u.name || 'مستخدم')}</strong>
                  ${u.isVerified ? ' <span class="verified-badge material-icons-outlined" style="font-size:16px;">verified</span>' : ''}
                  <br><small style="color:var(--text-muted)">${escapeHtml(ROLE_NAMES[u.role] || u.role || '')}</small>
                </div>
                <button class="btn btn-sm btn-primary" onclick="AdminApp.navigateTo('verification')">مراجعة</button>
              </div>
            `;
          }).join('');
        }, err => console.error('Verification listener error:', err));
    },

    displayVerifications(requests) {
      const el = document.getElementById('verification-list');
      if (!el) return;
      if (!requests || !requests.length) {
        el.innerHTML = '<p class="empty-state">لا توجد طلبات توثيق معلقة</p>';
        return;
      }

      el.innerHTML = requests.map(req => {
        const u = req.user || {};
        const sub = req.submittedData || {};
        const idCardUrl = safeUrl(sub.idCardUrl || u.idCardUrl);
        const selfieUrl = safeUrl(sub.verificationSelfieUrl || u.verificationSelfieUrl);
        const receiptUrl = safeUrl(sub.receiptUrl || req.receiptUrl);
        const avatar = safeUrl(u.profileImageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'U')}&background=104D9E&color=fff`;
        const countryCode = u.countryCode || sub.countryCode || 'SD';

        return `
          <div class="verify-card">
            <div class="verify-card-header">
              <img src="${escapeAttr(avatar)}" alt="">
              <div class="verify-card-info" style="flex:1;">
                <h4>
                  ${escapeHtml(u.name || 'مستخدم')}
                  ${u.isVerified ? ' <span class="verified-badge material-icons-outlined">verified</span>' : ''}
                </h4>
                <p>${escapeHtml(ROLE_NAMES[u.role] || u.role || '')} — ${escapeHtml(countryCode)} ${escapeHtml(u.state || '')} ${escapeHtml(u.locality || '')}</p>
                <p dir="ltr" style="text-align:right;">${escapeHtml(u.phoneNumber || u.email || '')}</p>
              </div>
            </div>
            <div class="verify-card-body">
              <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:6px;">
                ${idCardUrl ? `
                  <div style="flex:1; min-width:130px;">
                    <p style="margin:0 0 6px; font-size:13px; font-weight:700;">إثبات الهوية:</p>
                    <img class="verify-id-image" style="max-height:160px;" src="${escapeAttr(idCardUrl)}" onclick="AdminApp.previewImage('${escapeAttr(idCardUrl)}')" alt="صورة الهوية">
                  </div>` : '<p class="empty-state" style="padding:12px;">لم تُرفق صورة هوية</p>'}
                ${selfieUrl ? `
                  <div style="flex:1; min-width:130px;">
                    <p style="margin:0 0 6px; font-size:13px; font-weight:700;">صورة السيلفي:</p>
                    <img class="verify-id-image" style="max-height:160px;" src="${escapeAttr(selfieUrl)}" onclick="AdminApp.previewImage('${escapeAttr(selfieUrl)}')" alt="صورة السيلفي">
                  </div>` : ''}
                ${receiptUrl ? `
                  <div style="flex:1; min-width:130px;">
                    <p style="margin:0 0 6px; font-size:13px; font-weight:700;">إيصال الرسوم:</p>
                    <img class="verify-id-image" style="max-height:160px;" src="${escapeAttr(receiptUrl)}" onclick="AdminApp.previewImage('${escapeAttr(receiptUrl)}')" alt="إيصال الدفع">
                  </div>` : ''}
              </div>
              ${sub.paymentMethod ? `<p style="margin-top:8px; font-size:13px;"><strong>طريقة الدفع:</strong> ${escapeHtml(sub.paymentMethod)} ${sub.feeAmount ? `(${escapeHtml(sub.feeAmount)} ${escapeHtml(sub.feeCurrency || '')})` : ''}</p>` : ''}
              ${sub.notes ? `<p style="margin-top:6px; font-size:13px;"><strong>ملاحظات:</strong> ${escapeHtml(sub.notes)}</p>` : ''}
            </div>
            <div class="verify-card-actions">
              <button class="btn btn-success btn-sm" onclick="AdminApp.approveVerification('${escapeAttr(req.id)}')">
                <span class="material-icons-outlined">check</span> قبول وتوثيق
              </button>
              <button class="btn btn-danger btn-sm" onclick="AdminApp.rejectVerification('${escapeAttr(req.id)}')">
                <span class="material-icons-outlined">close</span> رفض
              </button>
              ${req.userId ? `<button class="btn btn-ghost btn-sm" onclick="AdminApp.showUserDetail('${escapeAttr(req.userId)}')">ملف المستخدم</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    },

    filterVerificationsList() {
      const search = (document.getElementById('verification-search')?.value || '').toLowerCase();
      const activeCC = window.AdminApp?.activeCountry || 'ALL';
      if (!this.verificationsData) return;
      let filtered = this.verificationsData;
      if (activeCC !== 'ALL' && window.AvyraCatalogs) {
        filtered = filtered.filter(req => {
          const cc = req.user?.countryCode || req.submittedData?.countryCode || 'SD';
          return AvyraCatalogs.matchesCountry(cc, activeCC);
        });
      }
      if (!search) {
        this.displayVerifications(filtered);
        return;
      }
      filtered = filtered.filter(req => {
        const u = req.user || {};
        return (u.name || '').toLowerCase().includes(search) ||
               (u.email || '').toLowerCase().includes(search) ||
               (u.phoneNumber || '').toLowerCase().includes(search) ||
               (u.state || '').toLowerCase().includes(search);
      });
      this.displayVerifications(filtered);
    },

    async approveVerification(requestId) {
      const confirmed = await AdminDialog.confirm({
        title: 'توثيق الحساب',
        message: 'هل تريد قبول طلب التوثيق ومنح شارة التوثيق الرسمية لهذا الحساب؟',
        confirmText: 'توثيق الحساب'
      });
      if (!confirmed) return;

      try {
        const requestDoc = await db.collection('verification_requests').doc(requestId).get();
        if (!requestDoc.exists) {
          showToast('طلب التوثيق غير موجود', 'error');
          return;
        }
        const requestData = requestDoc.data();
        const userId = requestData.userId;

        // STRICT SCHEMA: firestore.rules lines 1395-1398 allows ONLY ['status', 'reviewedAt']
        await db.collection('verification_requests').doc(requestId).update({
          status: 'approved',
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('users').doc(userId).update({
          isVerified: true,
          verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
          verificationStatus: 'verified',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('notifications').add({
          userId,
          type: 'system',
          title: 'تم توثيق حسابك بنجاح',
          message: 'تهانينا! تمت مراجعة مستنداتك وتوثيق حسابك رسمياً في منصة AVYRA.',
          isRead: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (window.PrivateUserHelper) PrivateUserHelper.invalidate(userId);
        showToast('تم توثيق الحساب بنجاح', 'success');
      } catch (error) {
        console.error('Error approving verification:', error);
        showToast('حدث خطأ أثناء توثيق الحساب: ' + error.message, 'error');
      }
    },

    async rejectVerification(requestId) {
      const confirmed = await AdminDialog.confirm({
        title: 'رفض طلب التوثيق',
        message: 'هل أنت متأكد من رفض طلب التوثيق هذا؟',
        confirmText: 'رفض الطلب',
        danger: true
      });
      if (!confirmed) return;

      try {
        const requestDoc = await db.collection('verification_requests').doc(requestId).get();
        if (!requestDoc.exists) {
          showToast('طلب التوثيق غير موجود', 'error');
          return;
        }
        const requestData = requestDoc.data();
        const userId = requestData.userId;

        // STRICT SCHEMA: firestore.rules lines 1395-1398 allows ONLY ['status', 'reviewedAt']
        await db.collection('verification_requests').doc(requestId).update({
          status: 'rejected',
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('users').doc(userId).update({
          verificationStatus: 'rejected',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('notifications').add({
          userId,
          type: 'system',
          title: 'تحديث بخصوص طلب التوثيق',
          message: 'عذراً، تعذر قبول طلب التوثيق. يرجى التأكد من وضوح صورة الهوية والمحاولة مجدداً.',
          isRead: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (window.PrivateUserHelper) PrivateUserHelper.invalidate(userId);
        showToast('تم رفض طلب التوثيق', 'info');
      } catch (error) {
        console.error('Error rejecting verification:', error);
        showToast('حدث خطأ أثناء رفض الطلب: ' + error.message, 'error');
      }
    },

    // ── Manual OTP Queue (`otp_codes`) ──
    otpTemplates: {
      ar: { name: 'العربية', isRtl: true, msg: (code) => `كود التحقق الخاص بك في منصة AVYRA هو: ${code}\n\nهذا الكود صالح لمدة 24 ساعة. الرجاء عدم مشاركته مع أحد.` },
      en: { name: 'English', isRtl: false, msg: (code) => `Your AVYRA verification code is: ${code}\n\nThis code is valid for 24 hours. Please do not share it with anyone.` },
      fr: { name: 'Français', isRtl: false, msg: (code) => `Votre code de vérification pour AVYRA est : ${code}\n\nCe code est valide pendant 24 heures. Veuillez ne le partager avec personne.` },
      sw: { name: 'Kiswahili', isRtl: false, msg: (code) => `Nambari yako ya uthibitisho ya AVYRA ni: ${code}\n\nNambari hii ni halali kwa saa 24. Tafadhali usimshirikishe mtu yeyote.` },
      es: { name: 'Español', isRtl: false, msg: (code) => `Su código de verificación de AVYRA es: ${code}\n\nEste código es válido por 24 horas. Por favor, no lo comparta con nadie.` },
      de: { name: 'Deutsch', isRtl: false, msg: (code) => `Ihr AVYRA-Bestätigungscode lautet: ${code}\n\nDieser Code ist 24 Stunden lang gültig. Bitte teilen Sie ihn mit niemandem.` },
      tr: { name: 'Türkçe', isRtl: false, msg: (code) => `AVYRA doğrulama kodunuz: ${code}\n\nBu kod 24 saat geçerlidir. Lütfen kimseyle paylaşmayın.` },
      ru: { name: 'Русский', isRtl: false, msg: (code) => `Ваш проверочный код AVYRA: ${code}\n\nЭтот код действителен в течение 24 часов. Пожалуйста, никому его не сообщайте.` },
      zh: { name: '简体中文', isRtl: false, msg: (code) => `您的 AVYRA 验证码是：${code}\n\n此验证码在 24 小时内有效。请勿与他人分享。` },
      hi: { name: 'हिन्दी', isRtl: false, msg: (code) => `आपका AVYRA सत्यापन कोड है: ${code}\n\nयह कोड 24 घंटे के लिए वैध है। कृपया इसे किसी के साथ साझा न करें।` },
      ur: { name: 'اردو', isRtl: true, msg: (code) => `منصہ AVYRA کے لیے آپ کا تصدیقی کوڈ ہے: ${code}\n\nیہ کوڈ 24 گھنٹے کے لیے کارآمد ہے۔ براہ کرم اسے کسی کے ساتھ شیئر نہ کریں۔` },
      id: { name: 'Bahasa Indonesia', isRtl: false, msg: (code) => `Kode verifikasi AVYRA Anda adalah: ${code}\n\nKode ini berlaku selama 24 jam. Harap jangan bagikan kepada siapa pun.` }
    },

    listenOtpRequests() {
      if (this._otpUnsub) this._otpUnsub();
      this._otpUnsub = db.collection('otp_codes')
        .where('deliveryStatus', '==', 'pending_admin')
        .onSnapshot(snap => {
          const badge = document.getElementById('otp-badge');
          if (snap.empty) {
            if (badge) badge.style.display = 'none';
            this.otpData = [];
            this.displayOtpRequests([]);
            return;
          }
          if (badge) {
            badge.textContent = snap.size;
            badge.style.display = 'inline';
          }
          const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          requests.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          this.otpData = requests;
          this.displayOtpRequests(requests);

          // إثراء الطلبات تلقائياً باللغة واسم المستخدم من ملف المستخدم إن لم تكن مسجلة مسبقاً
          requests.forEach(req => {
            if ((!req.language || !req.userName) && req.userId) {
              db.collection('users').doc(req.userId).get().then(uDoc => {
                if (uDoc.exists) {
                  const uData = uDoc.data();
                  let changed = false;
                  if (!req.language && (uData.preferredLanguage || uData.language)) {
                    req.language = uData.preferredLanguage || uData.language;
                    changed = true;
                  }
                  if (!req.userName && uData.name) {
                    req.userName = uData.name;
                    changed = true;
                  }
                  if (changed) {
                    this.displayOtpRequests(this.otpData);
                  }
                }
              }).catch(() => {});
            }
          });
        }, err => console.error('Error listening to OTP requests:', err));
    },

    changeOtpLang(reqId, lang) {
      this.selectedOtpLangs[reqId] = lang;
      this.displayOtpRequests(this.otpData);
    },

    async copyOtpMessage(reqId) {
      const req = (this.otpData || []).find(r => r.id === reqId);
      if (!req) return;
      const phoneRaw = String(req.phoneNumber || '');
      const detectedLang = req.language || (phoneRaw.startsWith('+249') || phoneRaw.startsWith('+20') || phoneRaw.startsWith('+966') || phoneRaw.startsWith('+971') ? 'ar' : 'en');
      const currentLang = this.selectedOtpLangs[req.id] || detectedLang || 'ar';
      const template = this.otpTemplates[currentLang] || this.otpTemplates.ar;
      const msg = template.msg(String(req.otp || ''));
      try {
        await navigator.clipboard.writeText(msg);
        showToast('تم نسخ نص الرسالة المترجمة بنجاح', 'success');
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = msg;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('تم نسخ نص الرسالة المترجمة بنجاح', 'success');
      }
    },

    displayOtpRequests(requests) {
      const el = document.getElementById('otp-list');
      if (!el) return;
      if (!requests || !requests.length) {
        el.innerHTML = '<p class="empty-state">لا توجد طلبات أكواد تحقق معلقة حالياً</p>';
        return;
      }

      el.innerHTML = requests.map(req => {
        const timeStr = timeAgo(req.createdAt);
        const channel = String(req.method || req.channel || 'whatsapp').toLowerCase();
        const isSms = channel === 'sms';
        const phoneRaw = String(req.phoneNumber || '');
        const phoneForWa = phoneRaw.replace(/^\+/, '').replace(/[^0-9]/g, '');
        const otpCode = String(req.otp || '');
        const userName = req.userName || req.name || null;

        // اكتشاف لغة المستخدم من حسابه أو من لغة التطبيق أو من كود الدولة
        const detectedLang = req.language || (phoneRaw.startsWith('+249') || phoneRaw.startsWith('+20') || phoneRaw.startsWith('+966') || phoneRaw.startsWith('+971') ? 'ar' : 'en');
        const currentLang = this.selectedOtpLangs[req.id] || detectedLang || 'ar';
        const template = this.otpTemplates[currentLang] || this.otpTemplates.ar;
        const isRtl = template.isRtl !== false;
        const rawMsg = template.msg(otpCode);
        const msgEncoded = encodeURIComponent(rawMsg);

        const link = isSms
          ? `sms:${phoneRaw}?body=${msgEncoded}`
          : `https://wa.me/${phoneForWa}?text=${msgEncoded}`;
        const btnClass = isSms ? 'btn-primary' : 'btn-success';
        const iconName = isSms ? 'sms' : 'chat';
        const channelNameAr = isSms ? 'رسالة نصية (SMS)' : 'واتساب (WhatsApp)';

        const langOptions = Object.entries(this.otpTemplates).map(([code, info]) => {
          const isSelected = code === currentLang;
          const isAppLang = code === detectedLang;
          const label = `${info.name} (${code.toUpperCase()})${isAppLang ? ' ⭐ لغة التطبيق' : ''}`;
          return `<option value="${escapeAttr(code)}" ${isSelected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('');

        return `
          <div class="card" style="margin-bottom:16px;">
            <div class="card-body">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                <div>
                  <strong>رقم الهاتف: <span dir="ltr">${escapeHtml(phoneRaw)}</span></strong>
                  ${userName ? `<div style="font-size:13px; color:var(--text-secondary); margin-top:3px;">المستخدم: <strong>${escapeHtml(userName)}</strong></div>` : ''}
                </div>
                <span class="report-status pending">بانتظار الإرسال</span>
              </div>
              <div class="detail-grid">
                <div class="detail-item">
                  <div class="label">كود التحقق (OTP)</div>
                  <div class="value" style="font-size:24px; font-weight:800; letter-spacing:4px; color:var(--primary-light); font-family:monospace;">${escapeHtml(otpCode)}</div>
                </div>
                <div class="detail-item">
                  <div class="label">قناة الإرسال</div>
                  <div class="value" style="color:${isSms ? 'var(--primary-light)' : 'var(--success)'};">${escapeHtml(channelNameAr)}</div>
                </div>
              </div>

              <!-- اختيار لغة الرسالة المترجمة حسب تفضيل المستخدم في التطبيق -->
              <div style="margin-top:14px; padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span class="material-icons-outlined" style="font-size:18px; color:var(--primary-light);">translate</span>
                    <strong style="font-size:12px;">لغة الرسالة:</strong>
                  </div>
                  <select style="font-size:12px; padding:4px 8px; border-radius:6px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color);"
                          onchange="PaymentsVerificationModule.changeOtpLang('${escapeAttr(req.id)}', this.value)">
                    ${langOptions}
                  </select>
                </div>
                <div style="font-size:12px; color:var(--text-secondary); line-height:1.5; white-space:pre-wrap; direction:${isRtl ? 'rtl' : 'ltr'}; text-align:${isRtl ? 'right' : 'left'}; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px; border:1px dashed var(--border-color);">
${escapeHtml(rawMsg)}
                </div>
              </div>

              <div style="margin-top:10px; font-size:12px; color:var(--text-muted);">تاريخ الطلب: ${escapeHtml(timeStr)}</div>
            </div>
            <div class="card-footer" style="display:flex; gap:8px; flex-wrap:wrap;">
              <a href="${escapeAttr(link)}" target="_blank" rel="noopener" class="btn ${btnClass} btn-sm" style="flex:1; min-width:140px;"
                 onclick="PaymentsVerificationModule.promptOtpConfirm('${escapeAttr(req.id)}', '${escapeAttr(channel)}')">
                <span class="material-icons-outlined" style="font-size:18px;">${iconName}</span>
                إرسال عبر ${isSms ? 'SMS' : 'واتساب'}
              </a>
              <button class="btn btn-secondary btn-sm" onclick="PaymentsVerificationModule.copyOtpMessage('${escapeAttr(req.id)}')">
                <span class="material-icons-outlined" style="font-size:18px;">content_copy</span>
                نسخ الرسالة
              </button>
              <button class="btn btn-ghost btn-sm" onclick="AdminApp.markOtpSent('${escapeAttr(req.id)}', '${escapeAttr(channel)}')">
                <span class="material-icons-outlined" style="font-size:18px;">done_all</span>
                تأكيد الإرسال
              </button>
            </div>
          </div>
        `;
      }).join('');
    },

    filterOtpList() {
      const search = (document.getElementById('otp-search')?.value || '').toLowerCase();
      if (!this.otpData) return;
      if (!search) {
        this.displayOtpRequests(this.otpData);
        return;
      }
      const filtered = this.otpData.filter(req =>
        String(req.phoneNumber || '').toLowerCase().includes(search) ||
        String(req.otp || '').toLowerCase().includes(search)
      );
      this.displayOtpRequests(filtered);
    },

    promptOtpConfirm(requestId, channel = 'whatsapp') {
      setTimeout(() => {
        this.markOtpSent(requestId, channel);
      }, 1200);
    },

    async markOtpSent(requestId, channel = 'whatsapp') {
      const isSms = String(channel).toLowerCase() === 'sms';
      const channelAr = isSms ? 'رسالة نصية (SMS)' : 'الواتساب';
      const confirmed = await AdminDialog.confirm({
        title: 'تأكيد إرسال الكود',
        message: `هل قمت بإرسال كود التحقق للمستخدم عبر ${channelAr} بنجاح؟`,
        confirmText: 'نعم، تم الإرسال'
      });
      if (!confirmed) return;

      try {
        await db.collection('otp_codes').doc(requestId).update({
          deliveryStatus: 'sent',
          sentAt: firebase.firestore.FieldValue.serverTimestamp(),
          sentByAdmin: true
        });
        showToast('تم تحديد كود التحقق كمُرسل بنجاح', 'success');
      } catch (error) {
        console.error('Error marking OTP as sent:', error);
        showToast('حدث خطأ أثناء التحديث: ' + error.message, 'error');
      }
    }
  };

  window.PaymentsVerificationModule = PaymentsVerificationModule;
  window.PaymentSettingsApp = PaymentsVerificationModule;
})();
