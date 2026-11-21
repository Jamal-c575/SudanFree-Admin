/**
 * AdminDialog — Non-blocking accessible modal dialogs using native HTML <dialog>.
 * Follows modern-web-guidance `dialog` guidelines:
 * - No redundant role="dialog" or aria-modal
 * - aria-labelledby pointing at the dialog heading
 * - Uses dialog.showModal() and <form method="dialog">
 * - Resets dialog.returnValue = '' on close
 * - autofocus on safe action (Cancel) for destructive confirmations
 */
(function () {
  const AdminDialog = {
    _activeResolve: null,
    _mode: 'confirm',

    _ensureDialog() {
      let dlg = document.getElementById('avyra-confirm-dialog');
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'avyra-confirm-dialog';
        dlg.className = 'avyra-dialog';
        dlg.setAttribute('aria-labelledby', 'avyra-dialog-title');
        dlg.setAttribute('closedby', 'any');
        dlg.innerHTML = `
          <form method="dialog" class="avyra-dialog-card" id="avyra-dialog-form">
            <div class="avyra-dialog-header">
              <span class="material-icons-outlined avyra-dialog-icon" id="avyra-dialog-icon">help_outline</span>
              <h3 id="avyra-dialog-title">تأكيد الإجراء</h3>
            </div>
            <div class="avyra-dialog-body">
              <p id="avyra-dialog-message"></p>
              <div id="avyra-dialog-input-wrap" style="display:none; margin-top:14px;">
                <input type="text" id="avyra-dialog-input" class="text-input" style="width:100%;" autocomplete="off">
              </div>
            </div>
            <div class="avyra-dialog-footer">
              <button type="submit" class="btn btn-ghost btn-sm" id="avyra-dialog-cancel" value="cancel">إلغاء</button>
              <button type="submit" class="btn btn-primary btn-sm" id="avyra-dialog-confirm" value="confirm">تأكيد</button>
            </div>
          </form>
        `;
        document.body.appendChild(dlg);
      }

      if (!dlg._avyraBound) {
        dlg._avyraBound = true;

        dlg.addEventListener('close', () => {
          const ret = dlg.returnValue;
          dlg.returnValue = '';
          this._resolveResult(ret === 'confirm');
        });

        // Fallback light-dismiss where closedBy is not natively supported
        if (!('closedBy' in HTMLDialogElement.prototype)) {
          const outside = (e) => {
            const r = dlg.getBoundingClientRect();
            return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          };
          let pressedOutside = false;
          dlg.addEventListener('pointerdown', (e) => { pressedOutside = outside(e); });
          dlg.addEventListener('pointerup', (e) => {
            if (pressedOutside && outside(e) && dlg.open) {
              dlg.close('cancel');
            }
          });
        }
      }
      return dlg;
    },

    _resolveResult(confirmed) {
      const inputEl = document.getElementById('avyra-dialog-input');
      const resolve = this._activeResolve;
      this._activeResolve = null;

      if (typeof resolve === 'function') {
        if (this._mode === 'prompt') {
          resolve(confirmed ? (inputEl ? inputEl.value : '') : null);
        } else {
          resolve(Boolean(confirmed));
        }
      }
    },

    /**
     * Show a confirmation dialog.
     * @param {Object|string} options
     * @returns {Promise<boolean>}
     */
    confirm(options) {
      const opts = typeof options === 'string' ? { message: options } : (options || {});
      const title = opts.title || 'تأكيد الإجراء';
      const message = opts.message || 'هل أنت متأكد من المتابعة؟';
      const confirmText = opts.confirmText || 'تأكيد';
      const cancelText = opts.cancelText || 'إلغاء';
      const danger = Boolean(opts.danger);

      const dlg = this._ensureDialog();
      this._mode = 'confirm';

      dlg.querySelector('#avyra-dialog-title').textContent = title;
      dlg.querySelector('#avyra-dialog-message').textContent = message;
      dlg.querySelector('#avyra-dialog-input-wrap').style.display = 'none';

      const iconEl = dlg.querySelector('#avyra-dialog-icon');
      iconEl.textContent = danger ? 'warning_amber' : 'help_outline';
      iconEl.style.color = danger ? 'var(--danger)' : 'var(--primary-light)';

      const confirmBtn = dlg.querySelector('#avyra-dialog-confirm');
      confirmBtn.textContent = confirmText;
      confirmBtn.className = `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`;

      const cancelBtn = dlg.querySelector('#avyra-dialog-cancel');
      cancelBtn.textContent = cancelText;

      // Put autofocus on the safe action (Cancel) for destructive confirmations
      cancelBtn.toggleAttribute('autofocus', danger);
      confirmBtn.toggleAttribute('autofocus', !danger);

      return new Promise((resolve) => {
        this._activeResolve = resolve;
        dlg.returnValue = '';
        if (typeof dlg.showModal === 'function') {
          try {
            if (!dlg.open) dlg.showModal();
          } catch (_) {
            dlg.setAttribute('open', '');
          }
        } else {
          dlg.setAttribute('open', '');
        }
        (danger ? cancelBtn : confirmBtn).focus();
      });
    },

    /**
     * Show a prompt dialog with a text input.
     * @param {Object} options
     * @returns {Promise<string|null>}
     */
    prompt(options = {}) {
      const title = options.title || 'إدخال بيانات';
      const message = options.message || '';
      const placeholder = options.placeholder || '';
      const defaultValue = options.defaultValue || '';
      const confirmText = options.confirmText || 'حفظ';
      const cancelText = options.cancelText || 'إلغاء';
      const danger = Boolean(options.danger);

      const dlg = this._ensureDialog();
      this._mode = 'prompt';

      dlg.querySelector('#avyra-dialog-title').textContent = title;
      dlg.querySelector('#avyra-dialog-message').textContent = message;

      const wrap = dlg.querySelector('#avyra-dialog-input-wrap');
      const inputEl = dlg.querySelector('#avyra-dialog-input');
      wrap.style.display = 'block';
      inputEl.placeholder = placeholder;
      inputEl.value = defaultValue;

      const iconEl = dlg.querySelector('#avyra-dialog-icon');
      iconEl.textContent = danger ? 'report_problem' : 'edit_note';
      iconEl.style.color = danger ? 'var(--danger)' : 'var(--primary-light)';

      const confirmBtn = dlg.querySelector('#avyra-dialog-confirm');
      confirmBtn.textContent = confirmText;
      confirmBtn.className = `btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`;

      const cancelBtn = dlg.querySelector('#avyra-dialog-cancel');
      cancelBtn.textContent = cancelText;

      return new Promise((resolve) => {
        this._activeResolve = resolve;
        dlg.returnValue = '';
        if (typeof dlg.showModal === 'function') {
          try {
            if (!dlg.open) dlg.showModal();
          } catch (_) {
            dlg.setAttribute('open', '');
          }
        } else {
          dlg.setAttribute('open', '');
        }
        inputEl.focus();
      });
    }
  };

  window.AdminDialog = AdminDialog;
})();
