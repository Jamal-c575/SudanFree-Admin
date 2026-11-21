/**
 * OrdersModule — Store Orders Management (`orders` collection)
 * Lists orders sorted by `createdAtMs` desc, filters by status (`pending`, `confirmed`, `shipped`, `delivered`, `cancelled`)
 * and buyer/seller/phone search, shows order details modal, and updates status + timeline.
 */
(function () {
  const OrdersModule = {
    allOrders: [],
    currentOrder: null,

    async loadOrders() {
      const tbody = document.getElementById('orders-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

      try {
        let snap;
        try {
          snap = await db.collection('orders').orderBy('createdAtMs', 'desc').limit(100).get();
        } catch (_) {
          snap = await db.collection('orders').limit(100).get();
        }
        this.allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.allOrders.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        this.filterOrders();
      } catch (e) {
        console.error('Error loading orders:', e);
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:var(--danger)">خطأ في تحميل طلبات المتاجر: ${escapeHtml(e.message)}</td></tr>`;
      }
    },

    filterOrders() {
      const search = (document.getElementById('orders-search')?.value || '').toLowerCase();
      const status = document.getElementById('orders-status-filter')?.value || '';
      const activeCC = window.AdminApp?.activeCountry || 'ALL';

      let list = this.allOrders;
      if (activeCC !== 'ALL' && window.AvyraCatalogs) {
        list = list.filter(o => AvyraCatalogs.matchesCountry(o.countryCode, activeCC));
      }
      if (status) {
        list = list.filter(o => (o.status || 'pending') === status);
      }
      if (search) {
        list = list.filter(o =>
          (o.id || '').toLowerCase().includes(search) ||
          (o.buyerName || '').toLowerCase().includes(search) ||
          (o.buyerPhone || '').toLowerCase().includes(search) ||
          (o.sellerName || '').toLowerCase().includes(search)
        );
      }
      this.renderOrders(list);
    },

    renderOrders(list) {
      const tbody = document.getElementById('orders-tbody');
      if (!tbody) return;

      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد طلبات متاجر مطابقة</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(o => {
        const meta = window.AvyraCatalogs
          ? AvyraCatalogs.getOrderStatusMeta(o.status)
          : { labelAr: o.status || 'قيد الانتظار', badgeClass: 'pending' };
        const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
        const total = typeof o.totalPrice === 'number' ? o.totalPrice.toLocaleString() : (o.totalPrice || 0);
        const currency = o.currency || 'SDG';
        const dateStr = formatDateTime(o.createdAtMs || o.createdAt);

        return `
          <tr>
            <td><span style="font-family:monospace; font-weight:700;">#${escapeHtml(o.id.substring(0, 8))}</span></td>
            <td>
              <strong>${escapeHtml(o.buyerName || 'عميل')}</strong><br>
              <small dir="ltr" style="color:var(--text-muted)">${escapeHtml(o.buyerPhone || '')}</small>
            </td>
            <td><strong>${escapeHtml(o.sellerName || 'متجر')}</strong></td>
            <td><strong>${escapeHtml(total)} ${escapeHtml(currency)}</strong> (${escapeHtml(itemsCount)} منتج)</td>
            <td><span class="report-status ${escapeAttr(meta.badgeClass)}">${escapeHtml(meta.labelAr)}</span></td>
            <td>${escapeHtml(dateStr)}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="OrdersModule.showOrderDetail('${escapeAttr(o.id)}')">
                <span class="material-icons-outlined" style="font-size:16px;">visibility</span> التفاصيل
              </button>
            </td>
          </tr>
        `;
      }).join('');
    },

    showOrderDetail(orderId) {
      const o = this.allOrders.find(x => x.id === orderId);
      if (!o) return;
      this.currentOrder = o;

      const body = document.getElementById('order-detail-body');
      if (!body) return;

      const items = Array.isArray(o.items) ? o.items : [];
      const itemsHtml = items.length
        ? items.map(it => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-glass);">
              <div>
                <strong>${escapeHtml(it.title || it.name || 'منتج')}</strong>
                <small style="color:var(--text-muted)"> × ${escapeHtml(it.quantity || 1)}</small>
              </div>
              <strong>${escapeHtml(it.price || 0)} ${escapeHtml(o.currency || 'SDG')}</strong>
            </div>
          `).join('')
        : '<p class="empty-state" style="padding:10px;">لا توجد تفاصيل عناصر</p>';

      const statusOpts = (window.AvyraCatalogs ? AvyraCatalogs.ORDER_STATUSES : []).map(s =>
        `<option value="${escapeAttr(s.id)}" ${o.status === s.id ? 'selected' : ''}>${escapeHtml(s.labelAr)}</option>`
      ).join('');

      body.innerHTML = `
        <div class="detail-grid" style="margin-bottom:16px;">
          <div class="detail-item">
            <div class="label">المشتري (العميل)</div>
            <div class="value">${escapeHtml(o.buyerName || '—')}</div>
            <small dir="ltr" style="color:var(--text-secondary)">${escapeHtml(o.buyerPhone || '')}</small>
          </div>
          <div class="detail-item">
            <div class="label">المتجر (البائع)</div>
            <div class="value">${escapeHtml(o.sellerName || '—')}</div>
          </div>
          <div class="detail-item">
            <div class="label">طريقة الدفع / المرجع</div>
            <div class="value">${escapeHtml(o.paymentMethod || 'نقداً عند الاستلام')}</div>
            ${o.transactionRef ? `<small style="color:var(--primary-light)">مرجع: ${escapeHtml(o.transactionRef)}</small>` : ''}
          </div>
          <div class="detail-item">
            <div class="label">عنوان التوصيل</div>
            <div class="value">${escapeHtml(o.deliveryAddress || o.state || '—')}</div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>المنتجات المطلوبة</h3></div>
          <div class="card-body">${itemsHtml}</div>
        </div>

        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding-top:10px; border-top:1px solid var(--border-glass);">
          <label style="font-weight:700;">تحديث حالة الطلب:</label>
          <select id="order-detail-status-select" class="filter-select" style="flex:1;">
            ${statusOpts}
          </select>
          <button class="btn btn-primary btn-sm" onclick="OrdersModule.updateOrderStatus('${escapeAttr(o.id)}')">
            <span class="material-icons-outlined" style="font-size:16px;">save</span> حفظ الحالة
          </button>
        </div>
      `;

      const modal = document.getElementById('order-detail-modal');
      if (modal) modal.style.display = 'flex';
    },

    async updateOrderStatus(orderId) {
      const nextStatus = document.getElementById('order-detail-status-select')?.value;
      if (!nextStatus) return;

      const o = this.allOrders.find(x => x.id === orderId);
      const timeline = Array.isArray(o?.timeline) ? [...o.timeline] : [];
      timeline.push({
        status: nextStatus,
        timestampMs: Date.now(),
        note: 'تم تحديث الحالة بواسطة الإدارة'
      });

      try {
        await db.collection('orders').doc(orderId).update({
          status: nextStatus,
          updatedAtMs: Date.now(),
          timeline
        });
        showToast('تم تحديث حالة الطلب بنجاح', 'success');
        if (window.AdminApp) AdminApp.closeModal('order-detail-modal');
        await this.loadOrders();
      } catch (e) {
        showToast('فشل تحديث حالة الطلب: ' + e.message, 'error');
      }
    }
  };

  window.OrdersModule = OrdersModule;
})();
