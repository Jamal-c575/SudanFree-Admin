/**
 * StatsModule — Dashboard KPI Cards & Statistics Analytics Page
 * Uses canonical Sudan state keys from `AvyraCatalogs.SUDAN_STATES` ('الخرطوم', 'الجزيرة', etc.)
 * and renders Users by Country alongside Users by Sudan State.
 */
(function () {
  const StatsModule = {
    async getCount(query) {
      try {
        if (typeof query.count === 'function') {
          const agg = await query.count().get();
          return agg.data().count || 0;
        }
        const snap = await query.get();
        return snap.size;
      } catch (e) {
        return 0;
      }
    },

    async loadDashboard() {
      const grid = document.getElementById('stats-grid');
      if (!grid) return;

      const activeCC = window.AdminApp?.activeCountry || 'ALL';
      const byCC = (col) => (activeCC && activeCC !== 'ALL')
        ? col.where('countryCode', '==', activeCC)
        : col;

      const [
        usersCount,
        verifiedCount,
        proCount,
        postsCount,
        ordersCount,
        unionsCount,
        requestsCount,
        adsCount
      ] = await Promise.all([
        this.getCount(byCC(db.collection('users'))),
        this.getCount(byCC(db.collection('users')).where('isVerified', '==', true)),
        this.getCount(byCC(db.collection('users')).where('isPremium', '==', true)),
        this.getCount(byCC(db.collection('posts'))),
        this.getCount(byCC(db.collection('orders'))),
        this.getCount(byCC(db.collection('unions'))),
        this.getCount(byCC(db.collection('requests'))),
        this.getCount(db.collection('ads').where('isActive', '==', true))
      ]);

      const stats = [
        { icon: 'people', label: 'إجمالي المستخدمين', value: usersCount, color: '#104D9E', page: 'users' },
        { icon: 'verified', label: 'الحسابات الموثقة', value: verifiedCount, color: '#109B78', page: 'verification' },
        { icon: 'workspace_premium', label: 'مشتركو Pro', value: proCount, color: '#F2A33C', page: 'subscriptions' },
        { icon: 'article', label: 'المنشورات', value: postsCount, color: '#2E7DD1', page: 'posts' },
        { icon: 'shopping_bag', label: 'طلبات المتاجر', value: ordersCount, color: '#109B78', page: 'orders' },
        { icon: 'groups', label: 'النقابات المهنية', value: unionsCount, color: '#104D9E', page: 'unions' },
        { icon: 'assignment', label: 'طلبات الخدمات', value: requestsCount, color: '#F2A33C', page: 'requests' },
        { icon: 'campaign', label: 'الإعلانات النشطة', value: adsCount, color: '#2E7DD1', page: 'ads' }
      ];

      grid.innerHTML = stats.map(s => `
        <div class="stat-card" style="cursor:pointer;" onclick="AdminApp.navigateTo('${escapeAttr(s.page)}')">
          <div class="stat-icon" style="background:${s.color}22;color:${s.color}">
            <span class="material-icons-outlined">${s.icon}</span>
          </div>
          <div>
            <div class="stat-value">${escapeHtml(s.value)}</div>
            <div class="stat-label">${escapeHtml(s.label)}</div>
          </div>
        </div>
      `).join('');
    },

    async loadStatistics() {
      try {
        const total = await this.getCount(db.collection('users'));
        const rolesToCount = ['client', 'freelancer', 'techService', 'privateService', 'shop', 'admin'];
        const byRole = {};
        await Promise.all(rolesToCount.map(async (role) => {
          byRole[role] = await this.getCount(db.collection('users').where('role', '==', role));
        }));

        const [verified, online, proUsers, unionsTotal, squadsTotal, ordersTotal] = await Promise.all([
          this.getCount(db.collection('users').where('isVerified', '==', true)),
          this.getCount(db.collection('users').where('lastActive', '>=', new Date(Date.now() - 300000))),
          this.getCount(db.collection('users').where('isPremium', '==', true)),
          this.getCount(db.collection('unions')),
          this.getCount(db.collection('squads')),
          this.getCount(db.collection('orders'))
        ]);

        const detailedEl = document.getElementById('stats-grid-detailed');
        if (detailedEl) {
          detailedEl.innerHTML = [
            { icon: 'people', label: 'إجمالي المستخدمين', value: total, color: '#104D9E' },
            { icon: 'verified', label: 'موثقون', value: verified, color: '#109B78' },
            { icon: 'circle', label: 'متصلون الآن', value: online, color: '#109B78' },
            { icon: 'workspace_premium', label: 'مشتركو Pro', value: proUsers, color: '#F2A33C' },
            { icon: 'person', label: 'عملاء', value: byRole.client || 0, color: '#2E7DD1' },
            { icon: 'construction', label: 'خدمات فنية (حرفيون)', value: byRole.freelancer || 0, color: '#F2A33C' },
            { icon: 'store', label: 'متاجر', value: byRole.shop || 0, color: '#109B78' },
            { icon: 'code', label: 'خدمات تقنية', value: byRole.techService || 0, color: '#2E7DD1' },
            { icon: 'room_service', label: 'خدمات خاصة', value: byRole.privateService || 0, color: '#F2A33C' },
            { icon: 'groups', label: 'النقابات / الفرق', value: `${unionsTotal} / ${squadsTotal}`, color: '#104D9E' },
            { icon: 'shopping_bag', label: 'طلبات المتاجر', value: ordersTotal, color: '#109B78' }
          ].map(s => `
            <div class="stat-card">
              <div class="stat-icon" style="background:${s.color}22;color:${s.color}">
                <span class="material-icons-outlined">${s.icon}</span>
              </div>
              <div>
                <div class="stat-value">${escapeHtml(s.value)}</div>
                <div class="stat-label">${escapeHtml(s.label)}</div>
              </div>
            </div>
          `).join('');
        }

        // Role Doughnut Chart
        const roleCtx = document.getElementById('roleChart');
        if (roleCtx && typeof Chart !== 'undefined') {
          if (window.roleChartInstance) window.roleChartInstance.destroy();
          window.roleChartInstance = new Chart(roleCtx, {
            type: 'doughnut',
            data: {
              labels: Object.keys(byRole).map(k => (typeof ROLE_NAMES !== 'undefined' ? ROLE_NAMES[k] : null) || k),
              datasets: [{
                data: Object.values(byRole),
                backgroundColor: ['#104D9E', '#109B78', '#2E7DD1', '#F2A33C', '#D94A58', '#868F9E']
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'left', labels: { color: '#A7B1C4' } } }
            }
          });
        }

        // 7-Day Growth Line Chart
        const now = new Date();
        const dayPromises = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - (6 - i));
          d.setHours(0, 0, 0, 0);
          const nextDay = new Date(d);
          nextDay.setDate(nextDay.getDate() + 1);

          dayPromises.push(
            this.getCount(
              db.collection('users')
                .where('createdAt', '>=', d)
                .where('createdAt', '<', nextDay)
            ).then(count => ({
              index: i,
              dateStr: d.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short' }),
              count
            }))
          );
        }
        const dayResults = (await Promise.all(dayPromises)).sort((a, b) => a.index - b.index);

        const growthCtx = document.getElementById('growthChart');
        if (growthCtx && typeof Chart !== 'undefined') {
          if (window.growthChartInstance) window.growthChartInstance.destroy();
          window.growthChartInstance = new Chart(growthCtx, {
            type: 'line',
            data: {
              labels: dayResults.map(d => d.dateStr),
              datasets: [{
                label: 'مستخدمون جدد',
                data: dayResults.map(d => d.count),
                borderColor: '#2E7DD1',
                backgroundColor: 'rgba(46, 125, 209, 0.18)',
                fill: true,
                tension: 0.35
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(167,177,196,0.12)' }, ticks: { color: '#A7B1C4' } },
                x: { grid: { display: false }, ticks: { color: '#A7B1C4' } }
              }
            }
          });
        }

        // Canonical Sudan States Distribution (FIXED: using canonical keys without 'ولاية ')
        const canonicalStates = window.AvyraCatalogs
          ? AvyraCatalogs.SUDAN_STATES
          : ['الخرطوم', 'الجزيرة', 'البحر الأحمر', 'نهر النيل', 'شمال كردفان', 'كسلا', 'القضارف', 'الشمالية', 'سنار', 'النيل الأبيض'];

        const byState = {};
        await Promise.all(canonicalStates.map(async (st) => {
          const count = await this.getCount(db.collection('users').where('state', '==', st));
          if (count > 0) byState[st] = count;
        }));

        const stateEl = document.getElementById('stats-by-region');
        if (stateEl) {
          const entries = Object.entries(byState).sort((a, b) => b[1] - a[1]);
          if (entries.length > 0) {
            stateEl.innerHTML = '<div class="bar-chart">' + entries.map(([state, count]) => {
              const pct = total ? Math.max(6, Math.round((count / total) * 100)) : 6;
              return `
                <div class="bar-row">
                  <span class="bar-label">${escapeHtml(state)}</span>
                  <div class="bar-track">
                    <div class="bar-fill" style="width:${pct}%;background:var(--primary)">${escapeHtml(count)}</div>
                  </div>
                </div>
              `;
            }).join('') + '</div>';
          } else {
            stateEl.innerHTML = '<p class="empty-state">لا توجد بيانات للمناطق حالياً</p>';
          }
        }

        // Users by Country Distribution
        const topCountries = ['SD', 'EG', 'SA', 'AE', 'QA', 'KW', 'OM', 'JO', 'LY', 'GB', 'US'];
        const byCountry = {};
        await Promise.all(topCountries.map(async (cc) => {
          const count = await this.getCount(db.collection('users').where('countryCode', '==', cc));
          if (count > 0) byCountry[cc] = count;
        }));

        const countryEl = document.getElementById('stats-by-country');
        if (countryEl) {
          const entries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);
          if (entries.length > 0) {
            countryEl.innerHTML = '<div class="bar-chart">' + entries.map(([cc, count]) => {
              const pct = total ? Math.max(6, Math.round((count / total) * 100)) : 6;
              const label = window.AvyraCatalogs ? AvyraCatalogs.getCountryName(cc) : cc;
              return `
                <div class="bar-row">
                  <span class="bar-label">${escapeHtml(label)}</span>
                  <div class="bar-track">
                    <div class="bar-fill" style="width:${pct}%;background:var(--success)">${escapeHtml(count)}</div>
                  </div>
                </div>
              `;
            }).join('') + '</div>';
          } else {
            countryEl.innerHTML = '<p class="empty-state">لا توجد بيانات للدول حالياً (أو جميع الحسابات الافتراضية في السودان SD)</p>';
          }
        }
      } catch (error) {
        console.error('Error loading statistics:', error);
      }
    }
  };

  window.StatsModule = StatsModule;
})();
