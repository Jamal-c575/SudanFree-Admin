/**
 * SubscriptionsModule — Unified Pro Subscriptions Hub:
 * 1. Paid Subscriptions (`subscriptions`) with Receipt preview & configurable duration
 * 2. 5,000-Point Pro Reward Requests (`subscription_requests`)
 * 3. Active Pro Subscribers (`users` where `isPremium == true`) with Extend & Revoke actions
 */
(function () {
  const SubscriptionsModule = {
    currentTab: 'paid',
    currentSubId: null,
    currentUserId: null,
    paidList: [],
    pointRequests: [],
    proUsers: [],

    switchTab(tab, btnEl) {
      this.currentTab = tab;
      document.querySelectorAll('#page-subscriptions .sub-tab-btn').forEach(b => {
        const active = b.dataset.tab === tab || b === btnEl;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('#page-subscriptions .sub-tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `sub-panel-${tab}`);
      });

      if (tab === 'paid') this.loadSubscriptions();
      if (tab === 'points') this.loadPointRequests();
      if (tab === 'pro-users') this.loadProUsers();
    },

    async updateBadge() {
      try {
        const [paidPending, pointsPending] = await Promise.all([
          db.collection('subscriptions').where('status', '==', 'pending').get().then(s => s.size).catch(() => 0),
          db.collection('subscription_requests').where('status', '==', 'pending').get().then(s => s.size).catch(() => 0)
        ]);
        const total = paidPending + pointsPending;
        const badge = document.getElementById('subscriptions-badge');
        if (badge) {
          badge.textContent = total;
          badge.style.display = total > 0 ? 'inline' : 'none';
        }
      } catch (_) {}
    },

    // ── Sub-Tab 1: Paid Subscriptions (`subscriptions`) ──
    async loadSubscriptions() {
      const tbody = document.getElementById('subscriptions-table-body');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('subscriptions').orderBy('createdAt', 'desc').limit(100).get();
        this.paidList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.updateBadge();

        if (!this.paidList.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد طلبات اشتراك مدفوعة حالياً</td></tr>';
          return;
        }

        tbody.innerHTML = this.paidList.map(sub => {
          const dateStr = formatDateTime(sub.createdAt);
          const status = sub.status || 'pending';
          const statusLabel = status === 'pending' ? 'قيد المراجعة' : (status === 'active' ? 'مفعل' : 'مرفوض');
          const statusClass = status === 'active' ? 'reviewed' : (status === 'rejected' ? 'rejected' : 'pending');
          const receiptUrl = safeUrl(sub.receiptUrl);

          let actions = '';
          if (status === 'pending') {
            actions = `
              <button class="btn btn-sm btn-primary" onclick="SubscriptionAdminApp.viewReceipt('${escapeAttr(sub.id)}', '${escapeAttr(receiptUrl)}', '${escapeAttr(sub.userId || '')}')">
                <span class="material-icons-outlined" style="font-size:16px;">fact_check</span> مراجعة وتفعيل
              </button>
            `;
          } else {
            actions = `<span class="report-status ${statusClass}">${escapeHtml(statusLabel)}</span>`;
          }

          return `
            <tr>
              <td>${escapeHtml(dateStr)}</td>
              <td>
                <button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(sub.userId || '')}')">
                  <span class="material-icons-outlined" style="font-size:16px;">person</span> ${escapeHtml(sub.userName || 'عرض المستخدم')}
                </button>
              </td>
              <td><strong>${escapeHtml(sub.plan || 'Pro')}</strong> ${sub.amount ? `(${escapeHtml(sub.amount)} ${escapeHtml(sub.currency || 'SDG')})` : ''}</td>
              <td>
                ${receiptUrl ? `
                  <button class="btn btn-sm btn-ghost" onclick="SubscriptionAdminApp.viewReceipt('${escapeAttr(sub.id)}', '${escapeAttr(receiptUrl)}', '${escapeAttr(sub.userId || '')}')">
                    <span class="material-icons-outlined" style="font-size:16px;">receipt_long</span> معاينة الإيصال
                  </button>` : '<span style="color:var(--text-muted)">لا يوجد</span>'}
              </td>
              <td><span class="report-status ${statusClass}">${escapeHtml(statusLabel)}</span></td>
              <td>${actions}</td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        console.error('Error loading subscriptions:', e);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--danger)">حدث خطأ: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    viewReceipt(subId, url, userId) {
      this.currentSubId = subId;
      this.currentUserId = userId;
      const imgEl = document.getElementById('receipt-img-view');
      if (imgEl) {
        imgEl.src = safeUrl(url) || '';
        imgEl.style.display = url ? 'block' : 'none';
      }
      const durEl = document.getElementById('sub-approve-duration');
      if (durEl) durEl.value = '30';
      const modal = document.getElementById('receipt-modal');
      if (modal) modal.style.display = 'flex';
    },

    async approveCurrentSubscription() {
      const subId = this.currentSubId;
      const userId = this.currentUserId;
      if (!subId || !userId) return;

      const days = Number(document.getElementById('sub-approve-duration')?.value || 30);
      const validUntil = new Date(Date.now() + days * 86400000);
      const btn = document.getElementById('approve-sub-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'جاري التفعيل...'; }

      try {
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
          subscriptionExpiry: firebase.firestore.Timestamp.fromDate(validUntil),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          userId,
          type: 'system',
          title: 'تم تفعيل اشتراك Pro بنجاح',
          message: `تهانينا! تم تفعيل باقة Pro على حسابك لمدة ${days} يوماً.`,
          isRead: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        showToast('تم تفعيل اشتراك Pro بنجاح', 'success');
        if (window.AdminApp) AdminApp.closeModal('receipt-modal');
        await this.loadSubscriptions();
      } catch (e) {
        console.error(e);
        showToast('فشل تفعيل الاشتراك: ' + e.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span class="material-icons-outlined">check</span> موافقة وتفعيل';
        }
      }
    },

    async rejectCurrentSubscription() {
      const subId = this.currentSubId;
      const userId = this.currentUserId;
      if (!subId) return;

      const confirmed = await AdminDialog.confirm({
        title: 'رفض طلب الاشتراك',
        message: 'هل أنت متأكد من رفض طلب الاشتراك هذا؟',
        confirmText: 'رفض الطلب',
        danger: true
      });
      if (!confirmed) return;

      const btn = document.getElementById('reject-sub-btn');
      if (btn) btn.disabled = true;

      try {
        await db.collection('subscriptions').doc(subId).update({
          status: 'rejected',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (userId) {
          await db.collection('notifications').add({
            userId,
            type: 'system',
            title: 'تحديث بخصوص طلب اشتراك Pro',
            message: 'عذراً، تم رفض إيصال الاشتراك المرفق. يرجى التحقق من الإيصال وإعادة المحاولة.',
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        showToast('تم رفض طلب الاشتراك', 'info');
        if (window.AdminApp) AdminApp.closeModal('receipt-modal');
        await this.loadSubscriptions();
      } catch (e) {
        showToast('فشل الرفض: ' + e.message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    },

    // ── Sub-Tab 2: 5000-Point Pro Reward Requests (`subscription_requests`) ──
    async loadPointRequests() {
      const tbody = document.getElementById('point-subscriptions-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        const snap = await db.collection('subscription_requests').limit(100).get();
        this.pointRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.pointRequests.sort((a, b) => (b.requestedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
        this.updateBadge();

        if (!this.pointRequests.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد طلبات استبدال نقاط باشتراك Pro حالياً</td></tr>';
          return;
        }

        tbody.innerHTML = this.pointRequests.map(req => {
          const dateStr = formatDateTime(req.requestedAt || req.createdAt);
          const status = req.status || 'pending';
          const statusLabel = status === 'pending' ? 'بانتظار المراجعة' : (status === 'approved' ? 'تم التفعيل' : 'مرفوض');
          const statusClass = status === 'approved' ? 'reviewed' : (status === 'rejected' ? 'rejected' : 'pending');
          const pts = req.pointsAtRequest ?? req.points ?? 5000;

          return `
            <tr>
              <td>${escapeHtml(dateStr)}</td>
              <td>
                <strong>${escapeHtml(req.userName || 'مستخدم')}</strong><br>
                <small style="color:var(--text-muted)">${escapeHtml(ROLE_NAMES[req.userRole] || req.userRole || '')}</small>
              </td>
              <td><span class="chip chip-primary">${escapeHtml(pts)} نقطة</span></td>
              <td>${escapeHtml(req.rewardType || 'اشتراك Pro مجاني (شهر)')}</td>
              <td><span class="report-status ${statusClass}">${escapeHtml(statusLabel)}</span></td>
              <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  ${status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="SubscriptionsModule.approvePointRequest('${escapeAttr(req.id)}', '${escapeAttr(req.userId || '')}')">
                      <span class="material-icons-outlined" style="font-size:16px;">check</span> تفعيل Pro
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="SubscriptionsModule.rejectPointRequest('${escapeAttr(req.id)}', '${escapeAttr(req.userId || '')}')">
                      <span class="material-icons-outlined" style="font-size:16px;">close</span> رفض
                    </button>
                  ` : ''}
                  ${req.userId ? `<button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(req.userId)}')">الملف</button>` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } catch (e) {
        console.error('Error loading subscription_requests:', e);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--danger)">خطأ في التحميل: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    async approvePointRequest(reqId, userId) {
      const confirmed = await AdminDialog.confirm({
        title: 'تفعيل مكافأة Pro بالنقاط',
        message: 'هل تريد الموافقة على استبدال النقاط وتفعيل اشتراك Pro لمدة 30 يوماً لهذا المستخدم؟',
        confirmText: 'تفعيل Pro'
      });
      if (!confirmed) return;

      try {
        const validUntil = new Date(Date.now() + 30 * 86400000);
        const batch = db.batch();

        batch.update(db.collection('subscription_requests').doc(reqId), {
          status: 'approved',
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (userId) {
          batch.update(db.collection('users').doc(userId), {
            isPremium: true,
            subscriptionExpiry: firebase.firestore.Timestamp.fromDate(validUntil),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          batch.set(db.collection('notifications').doc(), {
            userId,
            type: 'system',
            title: 'تم تفعيل مكافأة اشتراك Pro!',
            message: 'تهانينا! تمت الموافقة على طلب استبدال النقاط وتفعيل اشتراك Pro على حسابك لمدة 30 يوماً.',
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        await batch.commit();
        showToast('تم تفعيل مكافأة اشتراك Pro بنجاح', 'success');
        await this.loadPointRequests();
      } catch (e) {
        showToast('فشل التفعيل: ' + e.message, 'error');
      }
    },

    async rejectPointRequest(reqId, userId) {
      const confirmed = await AdminDialog.confirm({
        title: 'رفض طلب المكافأة',
        message: 'هل أنت متأكد من رفض طلب استبدال النقاط هذا؟',
        confirmText: 'رفض',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('subscription_requests').doc(reqId).update({
          status: 'rejected',
          reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (userId) {
          await db.collection('notifications').add({
            userId,
            type: 'system',
            title: 'طلب مكافأة اشتراك Pro',
            message: 'عذراً، تعذر قبول طلب استبدال النقاط باشتراك Pro في الوقت الحالي.',
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        showToast('تم رفض الطلب', 'info');
        await this.loadPointRequests();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    },

    // ── Sub-Tab 3 & Standalone Page: Active Pro Users (`users` where `isPremium == true`) ──
    async loadProUsers() {
      const tbody1 = document.getElementById('pro-users-table-body');
      const tbody2 = document.getElementById('sub-pro-users-tbody');
      const loadingHtml = '<tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
      if (tbody1) tbody1.innerHTML = loadingHtml;
      if (tbody2) tbody2.innerHTML = loadingHtml;

      try {
        const snap = await db.collection('users').where('isPremium', '==', true).limit(150).get();
        this.proUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (!this.proUsers.length) {
          const emptyHtml = '<tr><td colspan="6" class="empty-state">لا يوجد مشتركون نشطون في خطة Pro حالياً</td></tr>';
          if (tbody1) tbody1.innerHTML = emptyHtml;
          if (tbody2) tbody2.innerHTML = emptyHtml;
          return;
        }

        const rowsHtml = this.proUsers.map(u => {
          const expiryStr = u.subscriptionExpiry ? formatDateTime(u.subscriptionExpiry) : 'غير محدد';
          const joinedStr = formatDateTime(u.createdAt);
          return `
            <tr>
              <td>
                <strong>${escapeHtml(u.name || 'مستخدم')}</strong>
                ${u.isVerified ? ' <span class="verified-badge material-icons-outlined" style="font-size:16px;">verified</span>' : ''}
              </td>
              <td>${getRoleBadge(u.role)}</td>
              <td dir="ltr" style="text-align:right;">${escapeHtml(u.phoneNumber || u.email || '—')}</td>
              <td><span class="chip chip-primary">${escapeHtml(expiryStr)}</span></td>
              <td>${escapeHtml(joinedStr)}</td>
              <td>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button class="btn btn-sm btn-ghost" onclick="AdminApp.showUserDetail('${escapeAttr(u.id)}')">عرض الملف</button>
                  <button class="btn btn-sm btn-primary" onclick="SubscriptionsModule.extendProUser('${escapeAttr(u.id)}')">+30 يوم</button>
                  <button class="btn btn-sm btn-danger" onclick="SubscriptionsModule.revokeProUser('${escapeAttr(u.id)}')">إلغاء Pro</button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        if (tbody1) tbody1.innerHTML = rowsHtml;
        if (tbody2) tbody2.innerHTML = rowsHtml;
      } catch (e) {
        console.error('Error loading pro users:', e);
        const errHtml = `<tr><td colspan="6" class="empty-state" style="color:var(--danger)">خطأ: ${escapeHtml(e.message)}</td></tr>`;
        if (tbody1) tbody1.innerHTML = errHtml;
        if (tbody2) tbody2.innerHTML = errHtml;
      }
    },

    async extendProUser(uid) {
      const confirmed = await AdminDialog.confirm({
        title: 'تمديد اشتراك Pro',
        message: 'هل تريد تمديد اشتراك Pro لهذا المستخدم لمدة 30 يوماً إضافية؟',
        confirmText: 'تمديد 30 يوماً'
      });
      if (!confirmed) return;

      try {
        const doc = await db.collection('users').doc(uid).get();
        const currentExp = doc.exists && doc.data().subscriptionExpiry?.toDate
          ? doc.data().subscriptionExpiry.toDate()
          : new Date();
        const baseDate = currentExp > new Date() ? currentExp : new Date();
        const nextExp = new Date(baseDate.getTime() + 30 * 86400000);

        await db.collection('users').doc(uid).update({
          isPremium: true,
          subscriptionExpiry: firebase.firestore.Timestamp.fromDate(nextExp),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('تم تمديد اشتراك Pro لمدة 30 يوماً', 'success');
        await this.loadProUsers();
      } catch (e) {
        showToast('خطأ في التمديد: ' + e.message, 'error');
      }
    },

    async revokeProUser(uid) {
      const confirmed = await AdminDialog.confirm({
        title: 'إلغاء اشتراك Pro',
        message: 'هل أنت متأكد من إلغاء باقة Pro عن هذا المستخدم؟',
        confirmText: 'إلغاء الاشتراك',
        danger: true
      });
      if (!confirmed) return;

      try {
        await db.collection('users').doc(uid).update({
          isPremium: false,
          subscriptionExpiry: null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('تم إلغاء اشتراك Pro', 'info');
        await this.loadProUsers();
      } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
      }
    }
  };

  // Wire receipt modal buttons once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const approveBtn = document.getElementById('approve-sub-btn');
    const rejectBtn = document.getElementById('reject-sub-btn');
    if (approveBtn) {
      approveBtn.onclick = () => SubscriptionsModule.approveCurrentSubscription();
    }
    if (rejectBtn) {
      rejectBtn.onclick = () => SubscriptionsModule.rejectCurrentSubscription();
    }
  });

  window.SubscriptionsModule = SubscriptionsModule;
  window.SubscriptionAdminApp = SubscriptionsModule;
  window.ProUsersAdminApp = SubscriptionsModule;
})();
