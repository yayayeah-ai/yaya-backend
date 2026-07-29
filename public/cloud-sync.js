(function () {
  const CloudSync = {
    user: null,
    revision: 0,
    timer: null,
    syncing: false,
    dirty: false,
    suspended: false,
    profileTimer: null,
    profileRefreshing: false,

    get apiUrl() {
      const configured = Store.getSettings().backendUrl || DEFAULT_BACKEND_URL;
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ||
          location.hostname.endsWith('.onrender.com')) {
        return location.origin;
      }
      return configured.replace(/\/+$/, '');
    },

    async request(path, options = {}) {
      const response = await fetch(`${this.apiUrl}${path}`, {
        credentials: 'include',
        cache: 'no-store',
        ...options,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || `请求失败（${response.status}）`);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    },

    bindUI() {
      document.querySelectorAll('[data-auth-mode]').forEach(button => {
        button.addEventListener('click', () => this.setMode(button.dataset.authMode));
      });
      document.getElementById('auth-form').addEventListener('submit', event => {
        event.preventDefault();
        this.submitAuth();
      });
      document.getElementById('profile-form')?.addEventListener('submit', event => {
        event.preventDefault();
        this.saveProfile();
      });
      document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());
      window.addEventListener('online', () => {
        this.flush();
        this.refreshProfile();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.refreshProfile();
      });
    },

    setMode(mode) {
      const registering = mode === 'register';
      document.querySelectorAll('[data-auth-mode]').forEach(button => {
        button.classList.toggle('active', button.dataset.authMode === mode);
      });
      document.querySelector('.auth-name-field').classList.toggle('d-none', !registering);
      document.getElementById('auth-display-name').required = registering;
      document.getElementById('auth-password').autocomplete = registering ? 'new-password' : 'current-password';
      document.getElementById('auth-submit').textContent = registering ? '创建账号' : '登录';
      document.getElementById('auth-form').dataset.mode = mode;
      document.getElementById('auth-error').textContent = '';
    },

    async restore() {
      this.setMode('login');
      try {
        const result = await this.request('/api/auth/me');
        await this.onAuthenticated(result.user);
      } catch (error) {
        if (error.status !== 401) {
          document.getElementById('auth-error').textContent = '暂时无法连接服务器，请稍后刷新';
        }
      }
    },

    async submitAuth() {
      const form = document.getElementById('auth-form');
      const mode = form.dataset.mode || 'login';
      const submit = document.getElementById('auth-submit');
      const errorBox = document.getElementById('auth-error');
      submit.disabled = true;
      submit.textContent = mode === 'register' ? '正在创建…' : '正在登录…';
      errorBox.textContent = '';
      try {
        const result = await this.request(`/api/auth/${mode}`, {
          method: 'POST',
          body: JSON.stringify({
            email: document.getElementById('auth-email').value,
            password: document.getElementById('auth-password').value,
            displayName: document.getElementById('auth-display-name').value
          })
        });
        await this.onAuthenticated(result.user);
      } catch (error) {
        errorBox.textContent = error.message;
      } finally {
        submit.disabled = false;
        submit.textContent = mode === 'register' ? '创建账号' : '登录';
      }
    },

    hasLocalContent() {
      const data = Store.exportData();
      return ['expenses', 'worklogs', 'birthdays', 'savings', 'accounts']
        .some(key => Array.isArray(data[key]) && data[key].length > 0);
    },

    applyIdentity(user) {
      const fallbackName = WORKSPACE_ID === 'xiaoxiao' ? '笑笑' : '雅雅';
      const displayName = String(user?.displayName || '').trim() || fallbackName;
      this.user = { ...user, displayName };
      window.currentDisplayName = displayName;
      document.title = `${displayName}的工作台`;
      document.querySelector('meta[name="apple-mobile-web-app-title"]')
        ?.setAttribute('content', `${displayName}的工作台`);
      document.querySelectorAll('[data-workbench-title]').forEach(element => {
        element.textContent = `${displayName}的工作台`;
      });
      const accountName = document.getElementById('account-display-name');
      const profileInput = document.getElementById('profile-display-name');
      if (accountName) accountName.textContent = displayName;
      if (profileInput && document.activeElement !== profileInput) profileInput.value = displayName;
      const greeting = document.getElementById('greeting-time');
      if (greeting && typeof UI !== 'undefined') greeting.textContent = UI.getGreeting();
    },

    async saveProfile() {
      if (!this.user) return;
      const input = document.getElementById('profile-display-name');
      const button = document.getElementById('btn-save-profile');
      const message = document.getElementById('profile-message');
      const displayName = input.value.trim();
      button.disabled = true;
      message.textContent = '正在保存…';
      message.className = 'profile-message';
      try {
        const result = await this.request('/api/auth/profile', {
          method: 'PATCH',
          body: JSON.stringify({ displayName })
        });
        this.applyIdentity(result.user);
        message.textContent = '昵称已同步到所有设备';
        message.className = 'profile-message success';
      } catch (error) {
        message.textContent = error.message;
        message.className = 'profile-message error';
      } finally {
        button.disabled = false;
      }
    },

    async refreshProfile() {
      if (!this.user || this.profileRefreshing) return;
      this.profileRefreshing = true;
      try {
        const result = await this.request('/api/auth/me');
        if (result.user?.displayName !== this.user.displayName) {
          this.applyIdentity(result.user);
          const message = document.getElementById('profile-message');
          if (message) {
            message.textContent = '昵称已从其他设备更新';
            message.className = 'profile-message success';
          }
        }
      } catch (error) {
        if (error.status === 401) location.reload();
      } finally {
        this.profileRefreshing = false;
      }
    },

    startProfileRefresh() {
      clearInterval(this.profileTimer);
      this.profileTimer = setInterval(() => this.refreshProfile(), 20000);
    },

    async onAuthenticated(user) {
      this.applyIdentity(user);
      document.getElementById('account-email').textContent = user.email;
      this.setStatus('正在同步云端数据…', 'syncing');
      const cloud = await this.request(`/api/data?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`);
      this.revision = cloud.revision;
      if (cloud.revision === 0 && this.hasLocalContent()) {
        await this.flush(true);
      } else if (cloud.revision > 0) {
        this.suspended = true;
        Store.importData(cloud.data);
        this.suspended = false;
      }
      this.setStatus('已同步到云端', 'synced');
      document.getElementById('auth-screen').classList.add('hidden');
      window.startWorkbench?.();
      this.startProfileRefresh();
    },

    setStatus(text, state = '') {
      const element = document.getElementById('cloud-sync-status');
      if (!element) return;
      element.textContent = text;
      element.className = `cloud-sync-status ${state}`.trim();
    },

    schedule() {
      if (this.suspended || !this.user) return;
      this.dirty = true;
      this.setStatus(
        navigator.onLine ? '等待同步…' : '离线保存，联网后自动同步',
        navigator.onLine ? 'syncing' : 'offline'
      );
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), 900);
    },

    async flush(force = false) {
      if (!this.user || this.syncing || (!this.dirty && !force)) return false;
      if (!navigator.onLine) {
        this.setStatus('离线保存，联网后自动同步', 'offline');
        return false;
      }
      this.syncing = true;
      this.dirty = false;
      this.setStatus('正在同步…', 'syncing');
      try {
        const result = await this.request('/api/data', {
          method: 'PUT',
          body: JSON.stringify({
            workspaceId: WORKSPACE_ID,
            revision: this.revision,
            data: Store.exportData()
          })
        });
        this.revision = result.revision;
        this.setStatus(`已同步到云端 · 版本 ${this.revision}`, 'synced');
        return true;
      } catch (error) {
        if (error.status === 409 && error.payload?.data) {
          this.revision = error.payload.revision;
          this.suspended = true;
          Store.importData(error.payload.data);
          this.suspended = false;
          this.setStatus('已载入另一台设备的最新数据', 'synced');
          UI?.toast?.('检测到另一台设备的新数据，已载入云端版本', 'info');
        } else {
          this.dirty = true;
          this.setStatus('同步失败，将自动重试', 'offline');
        }
        return false;
      } finally {
        this.syncing = false;
      }
    },

    async logout() {
      if (!confirm('确定退出当前账号吗？本机数据同步后会被清除。')) return;
      clearInterval(this.profileTimer);
      await this.flush(true);
      try {
        await this.request('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        console.error('Logout error:', error);
      }
      this.suspended = true;
      Store.clearAll();
      this.suspended = false;
      location.reload();
    }
  };

  window.CloudSync = CloudSync;
  document.addEventListener('DOMContentLoaded', () => {
    CloudSync.bindUI();
    CloudSync.restore();
  });
})();
