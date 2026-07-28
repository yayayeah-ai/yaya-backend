/* ============================================================
   雅雅的工作台 v2.5 - Core Application
   Mobile-first PWA with cute pastel style
   Features: Expenses, Work Logs, Birthdays, Savings Goals,
   Smart Form (natural language fill)
   ============================================================ */

/* ===== Constants ===== */
const DEFAULT_CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '住房', '医疗', '教育', '通讯', '其他'];
const DEFAULT_BACKEND_URL = 'https://yaya-backend-21za.onrender.com';

// 分类关键词映射，让智能填写更准确地自动归类
const CATEGORY_KEYWORDS = {
  '餐饮': ['午饭', '晚饭', '早饭', '早餐', '午餐', '晚餐', '饭', '吃', '餐', '奶茶', '咖啡', '外卖', '零食', '宵夜', '水果', '面包', '蛋糕', '火锅', '烧烤', '麦当劳', '肯德基', '星巴克', '食堂', '米线', '面条', '粉', '饺子', '汉堡', '披萨', '寿司', '饮料', '水', '茶', '酒'],
  '交通': ['打车', '地铁', '公交', '出租车', '滴滴', '加油', '停车', '高铁', '火车', '飞机', '机票', '滴滴', '单车', '骑行', '充值', 'ETC', '过路费', '油费'],
  '购物': ['买', '淘宝', '京东', '拼多多', '衣服', '鞋', '包', '化妆品', '护肤', '纸巾', '日用品', '超市', '快递', '邮费'],
  '娱乐': ['电影', '游戏', 'KTV', '唱歌', '网吧', '门票', '旅游', '酒店', '剧本杀', '密室', '演唱会', '会员', 'VIP', '视频'],
  '住房': ['房租', '水电', '物业', '燃气', '宽带', '电费', '水费'],
  '医疗': ['药', '医院', '看病', '挂号', '体检', '诊所', '牙医'],
  '教育': ['书', '课程', '培训', '学费', '考试', '报名', '学习', '网课'],
  '通讯': ['话费', '流量', '充值', '月租', '手机']
};
const WORK_TYPES = [
  { value: 'new', label: '新功能' },
  { value: 'bug', label: 'Bug修复' },
  { value: 'refactor', label: '重构' },
  { value: 'optimize', label: '性能优化' },
  { value: 'doc', label: '文档' },
  { value: 'deploy', label: '部署' },
  { value: 'meeting', label: '会议/沟通' },
  { value: 'other', label: '其他' }
];
const CAT_ICONS = {
  '餐饮': '🍔', '交通': '🚗', '购物': '🛍️', '娱乐': '🎮',
  '住房': '🏠', '医疗': '💊', '教育': '📚', '通讯': '📱', '其他': '📦'
};

/* ===== Store (Data Layer) ===== */
const Store = {
  KEYS: {
    expenses: 'yaya_expenses_v2',
    worklogs: 'yaya_worklogs_v2',
    birthdays: 'yaya_birthdays',
    savings: 'yaya_savings',
    accounts: 'yaya_accounts',
    settings: 'yaya_settings_v2_5'
  },

  get(key, def) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : def;
    } catch (e) {
      return def;
    }
  },

  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },

  // --- Expenses ---
  getExpenses() {
    return this.get(this.KEYS.expenses, []);
  },

  addExpense(data) {
    const list = this.getExpenses();
    list.unshift({ id: this.uid(), ...data, createdAt: Date.now() });
    this.set(this.KEYS.expenses, list);
    return list;
  },

  deleteExpense(id) {
    const list = this.getExpenses().filter(e => e.id !== id);
    this.set(this.KEYS.expenses, list);
    return list;
  },

  // --- Work Logs ---
  getWorkLogs() {
    return this.get(this.KEYS.worklogs, []);
  },

  addWorkLog(data) {
    const list = this.getWorkLogs();
    list.unshift({ id: this.uid(), ...data, createdAt: Date.now() });
    this.set(this.KEYS.worklogs, list);
    return list;
  },

  deleteWorkLog(id) {
    const list = this.getWorkLogs().filter(e => e.id !== id);
    this.set(this.KEYS.worklogs, list);
    return list;
  },

  // --- Birthdays ---
  getBirthdays() {
    return this.get(this.KEYS.birthdays, []);
  },

  addBirthday(data) {
    const list = this.getBirthdays();
    list.unshift({ id: this.uid(), ...data, createdAt: Date.now() });
    this.set(this.KEYS.birthdays, list);
    return list;
  },

  deleteBirthday(id) {
    const list = this.getBirthdays().filter(e => e.id !== id);
    this.set(this.KEYS.birthdays, list);
    return list;
  },

  // --- Savings Goals ---
  getSavings() {
    return this.get(this.KEYS.savings, []);
  },

  addSaving(data) {
    const list = this.getSavings();
    list.unshift({ id: this.uid(), ...data, createdAt: Date.now() });
    this.set(this.KEYS.savings, list);
    return list;
  },

  updateSaving(id, updates) {
    const list = this.getSavings().map(s => s.id === id ? { ...s, ...updates } : s);
    this.set(this.KEYS.savings, list);
    return list;
  },

  deleteSaving(id) {
    const list = this.getSavings().filter(e => e.id !== id);
    this.set(this.KEYS.savings, list);
    return list;
  },

  // --- Accounts (Asset Management) ---
  getAccounts() {
    return this.get(this.KEYS.accounts, []);
  },

  addAccount(data) {
    const list = this.getAccounts();
    list.unshift({ id: this.uid(), ...data, createdAt: Date.now() });
    this.set(this.KEYS.accounts, list);
    return list;
  },

  updateAccount(id, updates) {
    const list = this.getAccounts().map(a => a.id === id ? { ...a, ...updates } : a);
    this.set(this.KEYS.accounts, list);
    return list;
  },

  deleteAccount(id) {
    const list = this.getAccounts().filter(a => a.id !== id);
    this.set(this.KEYS.accounts, list);
    return list;
  },

  // --- Settings ---
  getSettings() {
    const defaults = {
      categories: DEFAULT_CATEGORIES,
      pageMonitor: false,
      pushEnabled: false,
      backendUrl: DEFAULT_BACKEND_URL
    };
    return { ...defaults, ...this.get(this.KEYS.settings, {}) };
  },

  saveSettings(settings) {
    this.set(this.KEYS.settings, settings);
  },

  // --- Utility ---
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  exportData() {
    return {
      version: '2.12',
      exportedAt: new Date().toISOString(),
      expenses: this.getExpenses(),
      worklogs: this.getWorkLogs(),
      birthdays: this.getBirthdays(),
      savings: this.getSavings(),
      accounts: this.getAccounts(),
      settings: this.getSettings()
    };
  },

  importData(data) {
    if (!data || typeof data !== 'object') throw new Error('数据格式错误');
    if (data.expenses) this.set(this.KEYS.expenses, data.expenses);
    if (data.worklogs) this.set(this.KEYS.worklogs, data.worklogs);
    if (data.birthdays) this.set(this.KEYS.birthdays, data.birthdays);
    if (data.savings) this.set(this.KEYS.savings, data.savings);
    if (data.accounts) this.set(this.KEYS.accounts, data.accounts);
    if (data.countdowns) this.set(this.KEYS.savings, []); // ignore old countdowns
    if (data.settings) this.set(this.KEYS.settings, data.settings);
  },

  clearAll() {
    localStorage.removeItem(this.KEYS.expenses);
    localStorage.removeItem(this.KEYS.worklogs);
    localStorage.removeItem(this.KEYS.birthdays);
    localStorage.removeItem(this.KEYS.savings);
    localStorage.removeItem(this.KEYS.accounts);
    localStorage.removeItem(this.KEYS.settings);
  }
};

/* ===== Lunar Calendar Helper ===== */
const LunarCalendar = {
  available: typeof Lunar !== 'undefined' && typeof Solar !== 'undefined',

  solarToLunar(year, month, day) {
    if (!this.available) return null;
    try {
      const solar = Solar.fromYmd(year, month, day);
      const lunar = solar.getLunar();
      return {
        year: lunar.getYear(),
        month: lunar.getMonth(),
        day: lunar.getDay()
      };
    } catch (e) {
      return null;
    }
  },

  lunarToSolar(year, month, day) {
    if (!this.available) return null;
    try {
      const lunar = Lunar.fromYmd(year, month, day);
      const solar = lunar.getSolar();
      return {
        year: solar.getYear(),
        month: solar.getMonth(),
        day: solar.getDay()
      };
    } catch (e) {
      return null;
    }
  },

  getNextLunarDate(month, day) {
    if (!this.available) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    let solar = this.lunarToSolar(currentYear, month, day);
    if (!solar) return null;
    let date = new Date(solar.year, solar.month - 1, solar.day);

    if (date < today) {
      solar = this.lunarToSolar(currentYear + 1, month, day);
      if (!solar) return null;
      date = new Date(solar.year, solar.month - 1, solar.day);
    }

    return date;
  },

  formatLunarDate(month, day) {
    const months = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
    const days = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
                  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
    return `${months[month - 1]}月${days[day - 1]}`;
  }
};

/* ===== UI Helpers ===== */
const UI = {
  toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      el.style.transition = 'all 0.2s ease';
      setTimeout(() => el.remove(), 200);
    }, 2500);
  },

  formatMoney(n) {
    return '¥' + Number(n).toFixed(2);
  },

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  },

  formatDateFull(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  todayStr() {
    return this.formatDateFull(new Date());
  },

  nowMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了雅雅 🌙';
    if (hour < 11) return '早上好雅雅 ☀️';
    if (hour < 14) return '中午好雅雅 🍱';
    if (hour < 18) return '下午好雅雅 🌤️';
    return '晚上好雅雅 🌆';
  }
};

/* ===== Navigation ===== */
function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`.bottom-nav .nav-item[data-view="${view}"]`);
  if (navEl) navEl.classList.add('active');

  if (view === 'dashboard') renderDashboard();
  if (view === 'expenses') renderExpenses();
  if (view === 'worklog') renderWorkLog();
  if (view === 'birthdays') renderBirthdays();
  if (view === 'savings') renderSavings();
  if (view === 'settings') renderSettings();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===== Dashboard ===== */
function renderDashboard() {
  document.getElementById('greeting-time').textContent = UI.getGreeting();
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  document.getElementById('today-date').textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekdays[now.getDay()]}`;

  const expenses = Store.getExpenses();
  const worklogs = Store.getWorkLogs();
  const birthdays = Store.getBirthdays();
  const savings = Store.getSavings();
  const accounts = Store.getAccounts();
  const today = UI.todayStr();
  const monthStr = UI.nowMonthStr();

  // Today's spending
  const todayExpenses = expenses.filter(e => e.date === today);
  const todayTotal = todayExpenses.reduce((s, e) => s + Number(e.amount), 0);
  document.getElementById('dash-today-spending').textContent = UI.formatMoney(todayTotal);

  // This month's spending
  const monthExpenses = expenses.filter(e => e.date.startsWith(monthStr));
  const monthTotal = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  document.getElementById('dash-month-spending').textContent = UI.formatMoney(monthTotal);

  // Upcoming birthdays
  const upcoming = getUpcomingBirthdays(7);
  document.getElementById('dash-upcoming-events').textContent = upcoming.length;
  renderUpcomingList(upcoming);

  // Asset & savings preview
  renderDashSavings(accounts, savings);

  // Recent work logs
  renderRecentWorklogs(worklogs);
}

function getUpcomingBirthdays(daysAhead) {
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  Store.getBirthdays().forEach(b => {
    const nextDate = Birthday.getNextDate(b);
    if (!nextDate) return;
    const daysUntil = Math.round((nextDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0 && daysUntil <= daysAhead) {
      result.push({
        title: b.name,
        subtitle: b.type === 'lunar'
          ? `阴历 ${LunarCalendar.formatLunarDate(b.lunarMonth, b.lunarDay)}（${UI.formatDateFull(nextDate)}）`
          : UI.formatDateFull(nextDate),
        daysUntil,
        icon: '🎂',
        color: 'pink'
      });
    }
  });

  return result.sort((a, b) => a.daysUntil - b.daysUntil);
}

function renderUpcomingList(upcoming) {
  const container = document.getElementById('dash-upcoming-list');
  if (upcoming.length === 0) {
    container.innerHTML = '<p class="empty-hint">近期没有生日 🌸</p>';
    return;
  }

  container.innerHTML = upcoming.slice(0, 5).map(item => `
    <div class="dash-event-item ${item.color}">
      <span class="dash-event-icon">${item.icon}</span>
      <div class="dash-event-info">
        <div class="dash-event-title">${UI.escapeHtml(item.title)}</div>
        <div class="dash-event-subtitle">${UI.escapeHtml(item.subtitle)}</div>
      </div>
      <div class="dash-event-days">
        <span>${item.daysUntil}</span>
        <small>天后</small>
      </div>
    </div>
  `).join('');
}

function renderDashSavings(accounts, savings) {
  const container = document.getElementById('dash-savings-list');

  const totalAssets = accounts.filter(a => a.type === 'asset').reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const totalLiab = accounts.filter(a => a.type === 'liability').reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const netWorth = totalAssets - totalLiab;

  const totalTarget = savings.reduce((sum, s) => sum + (Number(s.target) || 0), 0);
  const totalSaved = savings.reduce((sum, s) => sum + (Number(s.saved) || 0), 0);
  const pct = totalTarget > 0 ? Math.min(100, Math.round(totalSaved / totalTarget * 100)) : 0;
  const isComplete = pct >= 100;

  let html = '';

  // Net worth section
  if (accounts.length > 0) {
    html += `
      <div class="dash-asset-overview">
        <div class="dash-asset-row">
          <span class="dash-asset-label">💎 净资产</span>
          <span class="dash-asset-value">${UI.formatMoney(netWorth)}</span>
        </div>
        <div class="dash-asset-sub-row">
          <span>💰 资产 ${UI.formatMoney(totalAssets)}</span>
          <span>💸 负债 ${UI.formatMoney(totalLiab)}</span>
        </div>
      </div>
    `;
  }

  // Savings progress section
  if (savings.length > 0) {
    html += `
      <div class="dash-saving-overview" style="${accounts.length > 0 ? 'margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);' : ''}">
        <div class="dash-saving-overview-header">
          <span class="dash-saving-overview-name">🎯 存钱计划</span>
          <span class="dash-saving-overview-pct ${isComplete ? 'complete' : ''}">${isComplete ? '🎉 已完成' : pct + '%'}</span>
        </div>
        <div class="savings-progress-wrap" style="height: 12px; margin: 8px 0;">
          <div class="savings-progress-bar ${isComplete ? 'complete' : ''}" style="width: ${pct}%"></div>
        </div>
        <div class="dash-saving-overview-amounts">
          <span>已存 <strong>${UI.formatMoney(totalSaved)}</strong></span>
          <span>目标 ${UI.formatMoney(totalTarget)}</span>
        </div>
      </div>
    `;
  }

  if (!html) {
    html = '<p class="empty-hint">还没有添加账户哦</p>';
  }

  container.innerHTML = html;
}

function renderRecentWorklogs(worklogs) {
  const container = document.getElementById('dash-recent-worklogs');
  if (worklogs.length === 0) {
    container.innerHTML = '<p class="empty-hint">还没有工作记录哦 💼</p>';
    return;
  }

  const groups = groupWorkLogs(worklogs.slice(0, 20));
  const recentGroups = Object.values(groups).slice(0, 2);

  container.innerHTML = recentGroups.map(g => {
    const latest = g.entries[0];
    const typeObj = WORK_TYPES.find(t => t.value === latest.type) || WORK_TYPES[7];
    return `
      <div class="dash-worklog-item">
        <div class="dash-worklog-project">${UI.escapeHtml(g.project)}</div>
        <div class="dash-worklog-meta">${UI.escapeHtml(g.client)} · ${g.entries.length} 条记录</div>
        <div class="dash-worklog-latest">
          <span class="entry-type type-${latest.type}">${typeObj.label}</span>
          <span>${UI.escapeHtml(latest.description.substring(0, 40))}${latest.description.length > 40 ? '...' : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== Expenses ===== */
function initExpenseForm() {
  const settings = Store.getSettings();

  const catSelect = document.getElementById('exp-category');
  catSelect.innerHTML = settings.categories.map(c => `<option value="${c}">${c}</option>`).join('');

  const filterCat = document.getElementById('exp-filter-category');
  filterCat.innerHTML = '<option value="">全部分类</option>' +
    settings.categories.map(c => `<option value="${c}">${c}</option>`).join('');

  document.getElementById('exp-date').value = UI.todayStr();

  // 事件监听只绑定一次，防止切换视图后重复提交
  const form = document.getElementById('expense-form');
  if (form.dataset.initialized === 'true') return;
  form.dataset.initialized = 'true';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('exp-amount').value);
    if (!amount || amount <= 0) {
      UI.toast('请输入有效金额', 'error');
      return;
    }
    const data = {
      amount: amount,
      category: document.getElementById('exp-category').value,
      date: document.getElementById('exp-date').value,
      note: document.getElementById('exp-note').value.trim()
    };
    Store.addExpense(data);
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-note').value = '';
    document.getElementById('exp-amount').focus();
    UI.toast('记账成功 ✨', 'success');
    renderExpenseList();
  });

  document.getElementById('exp-filter-month').addEventListener('change', renderExpenseList);
  document.getElementById('exp-filter-category').addEventListener('change', renderExpenseList);
}

function renderExpenses() {
  document.getElementById('exp-filter-month').value = UI.nowMonthStr();
  initExpenseForm();
  renderExpenseList();
}

function renderExpenseList() {
  const container = document.getElementById('expense-list');
  const summary = document.getElementById('exp-summary');
  let expenses = Store.getExpenses();

  const filterMonth = document.getElementById('exp-filter-month').value;
  const filterCat = document.getElementById('exp-filter-category').value;

  if (filterMonth) {
    expenses = expenses.filter(e => e.date.startsWith(filterMonth));
  }
  if (filterCat) {
    expenses = expenses.filter(e => e.category === filterCat);
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  summary.textContent = `共 ${expenses.length} 笔 · 合计 ${UI.formatMoney(total)}`;

  if (expenses.length === 0) {
    container.innerHTML = '<p class="empty-hint">暂无消费记录，记一笔吧 ✨</p>';
    return;
  }

  container.innerHTML = expenses.map(e => {
    const icon = CAT_ICONS[e.category] || '📦';
    const note = e.note || e.category;
    return `
      <div class="expense-item">
        <div class="expense-icon">${icon}</div>
        <div class="expense-info">
          <div class="expense-note">${UI.escapeHtml(note)}</div>
          <div class="expense-meta">${e.category} · ${UI.formatDate(e.date)}</div>
        </div>
        <div class="expense-amount">${UI.formatMoney(e.amount)}</div>
        <button class="expense-delete" data-action="delete-expense" data-id="${e.id}" aria-label="删除">×</button>
      </div>
    `;
  }).join('');
}

/* ===== Work Log ===== */
function initWorkLogForm() {
  const typeSelect = document.getElementById('wl-type');
  typeSelect.innerHTML = WORK_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('');

  document.getElementById('wl-date').value = UI.todayStr();

  const worklogs = Store.getWorkLogs();
  const projects = [...new Set(worklogs.map(w => w.project))].sort();
  document.getElementById('project-list').innerHTML =
    projects.map(p => `<option value="${UI.escapeHtml(p)}">`).join('');

  // 事件监听只绑定一次
  const form = document.getElementById('worklog-form');
  if (form.dataset.initialized === 'true') return;
  form.dataset.initialized = 'true';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      project: document.getElementById('wl-project').value.trim(),
      client: document.getElementById('wl-client').value.trim(),
      type: document.getElementById('wl-type').value,
      date: document.getElementById('wl-date').value,
      description: document.getElementById('wl-description').value.trim()
    };
    if (!data.project || !data.client || !data.description) {
      UI.toast('请填写必填项', 'error');
      return;
    }
    Store.addWorkLog(data);
    document.getElementById('worklog-form').reset();
    document.getElementById('wl-date').value = UI.todayStr();
    UI.toast('工作记录已保存 💾', 'success');
    renderWorkLogList();
    initWorkLogForm();
  });

  document.getElementById('wl-search').addEventListener('input', renderWorkLogList);
}

function renderWorkLog() {
  initWorkLogForm();
  renderWorkLogList();
}

function groupWorkLogs(worklogs) {
  const groups = {};
  worklogs.forEach(w => {
    if (!groups[w.project]) {
      groups[w.project] = { project: w.project, client: w.client, entries: [] };
    }
    groups[w.project].entries.push(w);
  });

  Object.values(groups).forEach(g => {
    g.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  return Object.values(groups).sort((a, b) => {
    const aMax = Math.max(...a.entries.map(e => new Date(e.date).getTime()));
    const bMax = Math.max(...b.entries.map(e => new Date(e.date).getTime()));
    return bMax - aMax;
  });
}

function renderWorkLogList() {
  const container = document.getElementById('worklog-list');
  let worklogs = Store.getWorkLogs();

  const search = document.getElementById('wl-search').value.trim().toLowerCase();
  if (search) {
    worklogs = worklogs.filter(w =>
      w.project.toLowerCase().includes(search) ||
      w.client.toLowerCase().includes(search) ||
      w.description.toLowerCase().includes(search)
    );
  }

  if (worklogs.length === 0) {
    container.innerHTML = '<p class="empty-hint">暂无工作记录，添加第一条吧 📝</p>';
    return;
  }

  const groups = groupWorkLogs(worklogs);

  container.innerHTML = groups.map(g => `
    <div class="project-group">
      <div class="project-header">
        <span class="project-icon">📁</span>
        <span class="project-name">${UI.escapeHtml(g.project)}</span>
        <span class="project-client">${UI.escapeHtml(g.client)}</span>
        <span class="project-count">${g.entries.length} 条</span>
      </div>
      <div class="project-entries">
        ${g.entries.map(w => {
          const typeObj = WORK_TYPES.find(t => t.value === w.type) || WORK_TYPES[7];
          return `
            <div class="entry-item">
              <div class="entry-header">
                <span class="entry-type type-${w.type}">${typeObj.label}</span>
                <span class="entry-date">${UI.formatDate(w.date)}</span>
                <button class="entry-delete" data-action="delete-worklog" data-id="${w.id}" aria-label="删除">×</button>
              </div>
              <div class="entry-desc">${UI.escapeHtml(w.description)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

/* ===== Birthdays ===== */
let birthdayTab = 'upcoming';

function initBirthdayForm() {
  document.getElementById('bd-date').value = UI.todayStr();

  // 事件监听只绑定一次
  const form = document.getElementById('birthday-form');
  if (form.dataset.initialized === 'true') return;
  form.dataset.initialized = 'true';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const dateVal = document.getElementById('bd-date').value;
    if (!dateVal) return;

    const [year, month, day] = dateVal.split('-').map(Number);
    const type = document.getElementById('bd-type').value;
    const data = {
      name: document.getElementById('bd-name').value.trim(),
      type: type,
      notes: document.getElementById('bd-notes').value.trim()
    };

    if (type === 'solar') {
      data.month = month;
      data.day = day;
    } else {
      const lunar = LunarCalendar.solarToLunar(year, month, day);
      if (!lunar) {
        UI.toast('阴历换算失败', 'error');
        return;
      }
      data.lunarYear = lunar.year;
      data.lunarMonth = lunar.month;
      data.lunarDay = lunar.day;
      data.month = month;
      data.day = day;
    }

    Store.addBirthday(data);
    document.getElementById('birthday-form').reset();
    document.getElementById('bd-date').value = UI.todayStr();
    UI.toast('生日已添加 🎂', 'success');
    renderBirthdayList();
    PushNotification.syncData();
  });

  document.querySelectorAll('.birthday-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.birthday-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      birthdayTab = btn.dataset.tab;
      renderBirthdayList();
    });
  });
}

const Birthday = {
  getAll() {
    return Store.getBirthdays();
  },

  getNextDate(birthday) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (birthday.type === 'solar') {
      const currentYear = today.getFullYear();
      let date = new Date(currentYear, birthday.month - 1, birthday.day);
      if (date < today) {
        date = new Date(currentYear + 1, birthday.month - 1, birthday.day);
      }
      return date;
    } else {
      return LunarCalendar.getNextLunarDate(birthday.lunarMonth, birthday.lunarDay);
    }
  }
};

function renderBirthdays() {
  initBirthdayForm();
  renderBirthdayList();
}

function renderBirthdayList() {
  const container = document.getElementById('birthday-list');
  const all = Store.getBirthdays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (all.length === 0) {
    container.innerHTML = '<p class="empty-hint">还没有好友生日，添加第一个吧 🎂</p>';
    return;
  }

  let items = all.map(b => {
    const nextDate = Birthday.getNextDate(b);
    const daysUntil = nextDate ? Math.round((nextDate - today) / (1000 * 60 * 60 * 24)) : 999;
    return { ...b, nextDate, daysUntil };
  });

  if (birthdayTab === 'upcoming') {
    items = items.filter(b => b.daysUntil <= 30).sort((a, b) => a.daysUntil - b.daysUntil);
  } else {
    items = items.sort((a, b) => a.daysUntil - b.daysUntil);
  }

  if (items.length === 0) {
    container.innerHTML = '<p class="empty-hint">30 天内没有即将到来的生日</p>';
    return;
  }

  container.innerHTML = items.map(b => {
    const dateText = b.type === 'lunar'
      ? `阴历 ${LunarCalendar.formatLunarDate(b.lunarMonth, b.lunarDay)} · 阳历 ${UI.formatDateFull(b.nextDate)}`
      : `阳历 ${UI.formatDateFull(b.nextDate)}`;
    const daysText = b.daysUntil === 0 ? '今天' : `${b.daysUntil} 天后`;
    const notes = b.notes ? `<div class="birthday-date">💭 ${UI.escapeHtml(b.notes)}</div>` : '';
    return `
      <div class="birthday-item">
        <div class="birthday-avatar">🎂</div>
        <div class="birthday-info">
          <div class="birthday-name">${UI.escapeHtml(b.name)} ${b.type === 'lunar' ? '🌙' : '☀️'}</div>
          <div class="birthday-date">${dateText}</div>
          ${notes}
        </div>
        <div class="birthday-count">
          <div class="birthday-days">${daysText}</div>
        </div>
        <button class="birthday-delete" data-action="delete-birthday" data-id="${b.id}" aria-label="删除">×</button>
      </div>
    `;
  }).join('');
}

/* ===== Asset Management ===== */
let accountEditId = null;
let assetTab = 'assets';

function initAssetTabs() {
  document.querySelectorAll('.asset-tabs .tab-btn').forEach(btn => {
    if (btn.dataset.initialized === 'true') return;
    btn.dataset.initialized = 'true';
    btn.addEventListener('click', () => {
      document.querySelectorAll('.asset-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      assetTab = btn.dataset.assetTab;
      document.querySelectorAll('.asset-tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`asset-tab-${assetTab}`).classList.add('active');
    });
  });
}

function initAccountForm() {
  const form = document.getElementById('account-form');
  if (form.dataset.initialized === 'true') return;
  form.dataset.initialized = 'true';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const balance = parseFloat(document.getElementById('ac-balance').value);
    if (isNaN(balance)) {
      UI.toast('请输入有效金额', 'error');
      return;
    }
    const data = {
      name: document.getElementById('ac-name').value.trim(),
      type: document.getElementById('ac-type').value,
      balance: Math.abs(balance),
      notes: document.getElementById('ac-notes').value.trim()
    };
    if (!data.name) {
      UI.toast('请输入账户名称', 'error');
      return;
    }
    Store.addAccount(data);
    document.getElementById('account-form').reset();
    UI.toast('账户已添加 ✨', 'success');
    renderAccountList();
    renderAssetOverview();
    renderDashboard();
  });
}

function renderAssetOverview() {
  const accounts = Store.getAccounts();
  const assets = accounts.filter(a => a.type === 'asset').reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const liabilities = accounts.filter(a => a.type === 'liability').reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const netWorth = assets - liabilities;

  const netEl = document.getElementById('net-worth-value');
  const assetEl = document.getElementById('total-assets-value');
  const liabEl = document.getElementById('total-liabilities-value');
  if (netEl) netEl.textContent = UI.formatMoney(netWorth);
  if (assetEl) assetEl.textContent = UI.formatMoney(assets);
  if (liabEl) liabEl.textContent = UI.formatMoney(liabilities);
}

function renderAccountList() {
  const container = document.getElementById('account-list');
  if (!container) return;
  const accounts = Store.getAccounts();

  if (accounts.length === 0) {
    container.innerHTML = '<p class="empty-hint">还没有添加账户，添加第一个吧 📊</p>';
    return;
  }

  const assetAccounts = accounts.filter(a => a.type === 'asset');
  const liabilityAccounts = accounts.filter(a => a.type === 'liability');

  let html = '';

  if (assetAccounts.length > 0) {
    html += '<div class="account-group-label">💰 资产账户</div>';
    html += assetAccounts.map(a => renderAccountItem(a)).join('');
  }

  if (liabilityAccounts.length > 0) {
    html += '<div class="account-group-label liability-label">💸 负债账户</div>';
    html += liabilityAccounts.map(a => renderAccountItem(a)).join('');
  }

  container.innerHTML = html;
}

function renderAccountItem(a) {
  const isLiability = a.type === 'liability';
  const notes = a.notes ? `<div class="account-notes">💭 ${UI.escapeHtml(a.notes)}</div>` : '';
  const isEditing = accountEditId === a.id;

  if (isEditing) {
    return `
      <div class="account-item editing">
        <div class="account-edit-row">
          <input type="text" class="account-edit-name" id="ac-edit-name-${a.id}" value="${UI.escapeHtml(a.name)}" placeholder="账户名称">
        </div>
        <div class="account-edit-row">
          <input type="number" class="account-edit-balance" id="ac-edit-balance-${a.id}" step="0.01" value="${a.balance}" placeholder="金额" inputmode="decimal">
          <button type="button" class="btn btn-primary btn-sm" data-action="save-account" data-id="${a.id}">保存</button>
          <button type="button" class="btn btn-outline btn-sm" data-action="cancel-account-edit">取消</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="account-item ${isLiability ? 'liability' : ''}">
      <div class="account-info">
        <div class="account-name">${UI.escapeHtml(a.name)}</div>
        ${notes}
      </div>
      <div class="account-right">
        <div class="account-balance ${isLiability ? 'liability-color' : 'asset-color'}">${isLiability ? '-' : ''}${UI.formatMoney(a.balance)}</div>
        <div class="account-actions">
          <button type="button" class="btn-icon" data-action="edit-account" data-id="${a.id}" aria-label="编辑">✏️</button>
          <button type="button" class="btn-icon" data-action="delete-account" data-id="${a.id}" aria-label="删除">🗑️</button>
        </div>
      </div>
    </div>
  `;
}

/* ===== Savings Goals ===== */
let savingEditId = null;

function initSavingsForm() {
  // 事件监听只绑定一次
  const form = document.getElementById('savings-form');
  if (form.dataset.initialized === 'true') return;
  form.dataset.initialized = 'true';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const target = parseFloat(document.getElementById('sg-target').value);
    if (!target || target <= 0) {
      UI.toast('请输入有效目标金额', 'error');
      return;
    }
    const data = {
      name: document.getElementById('sg-name').value.trim(),
      target: target,
      saved: parseFloat(document.getElementById('sg-saved').value) || 0,
      notes: document.getElementById('sg-notes').value.trim()
    };
    Store.addSaving(data);
    document.getElementById('savings-form').reset();
    UI.toast('存钱目标已添加 🌟', 'success');
    renderSavingsList();
  });
}

function renderSavings() {
  initAssetTabs();
  initAccountForm();
  renderAssetOverview();
  renderAccountList();
  initSavingsForm();
  renderSavingsList();
}

function renderSavingsList() {
  const container = document.getElementById('savings-list');
  const items = Store.getSavings();

  if (items.length === 0) {
    container.innerHTML = '<p class="empty-hint">还没有存钱目标，添加第一个吧 🎯</p>';
    return;
  }

  container.innerHTML = items.map(s => {
    const target = Number(s.target) || 0;
    const saved = Number(s.saved) || 0;
    const pct = target > 0 ? Math.min(100, Math.round(saved / target * 100)) : 0;
    const isComplete = pct >= 100;
    const notes = s.notes ? `<div class="savings-meta" style="margin-top: 6px;">💭 ${UI.escapeHtml(s.notes)}</div>` : '';

    const editInput = savingEditId === s.id ? `
      <div class="savings-input-row">
        <input type="number" id="saving-add-${s.id}" step="0.01" placeholder="输入金额" inputmode="decimal">
        <button type="button" class="btn btn-primary btn-sm" data-action="save-saving-add" data-id="${s.id}">存入</button>
        <button type="button" class="btn btn-outline btn-sm" data-action="cancel-saving-add">取消</button>
      </div>
    ` : `
      <div class="savings-actions">
        <button type="button" class="btn btn-primary" data-action="add-to-saving" data-id="${s.id}">➕ 存入</button>
        <button type="button" class="btn btn-outline" data-action="reset-saving" data-id="${s.id}">归零</button>
      </div>
    `;

    return `
      <div class="savings-item">
        <div class="savings-info">
          <div class="savings-header">
            <div class="savings-name">${UI.escapeHtml(s.name)}</div>
            <div class="savings-amount">
              <div class="savings-current ${isComplete ? 'complete' : ''}">${UI.formatMoney(saved)}</div>
              <div class="savings-target">/ ${UI.formatMoney(target)}</div>
            </div>
          </div>
          <div class="savings-progress-wrap">
            <div class="savings-progress-bar ${isComplete ? 'complete' : ''}" style="width: ${pct}%"></div>
          </div>
          <div class="savings-meta">
            <span>${isComplete ? '🎉 已完成' : `已完成 ${pct}%`}</span>
          </div>
          ${notes}
          ${editInput}
        </div>
        <button class="savings-delete" data-action="delete-saving" data-id="${s.id}" aria-label="删除">×</button>
      </div>
    `;
  }).join('');
}

/* ===== Settings ===== */
function renderSettings() {
  renderCategoryTags();
  renderDataStats();

  const settings = Store.getSettings();

  // Page monitor toggle
  const monitorToggle = document.getElementById('setting-monitor');
  monitorToggle.checked = settings.pageMonitor;
  monitorToggle.onchange = () => {
    settings.pageMonitor = monitorToggle.checked;
    Store.saveSettings(settings);
    PageMonitor.updateState();
    UI.toast(settings.pageMonitor ? '支付检测已开启' : '支付检测已关闭', 'info');
  };

  // Push notification toggle
  const pushToggle = document.getElementById('setting-push');
  const backendUrlInput = document.getElementById('setting-backend-url');
  pushToggle.checked = settings.pushEnabled || false;
  backendUrlInput.value = settings.backendUrl || DEFAULT_BACKEND_URL;
  const pushActions = document.getElementById('push-actions');
  if (pushActions) pushActions.style.display = settings.pushEnabled ? 'flex' : 'none';

  backendUrlInput.onchange = () => {
    settings.backendUrl = backendUrlInput.value.trim().replace(/\/+$/, '');
    Store.saveSettings(settings);
    UI.toast('服务器地址已保存', 'success');
  };

  pushToggle.onchange = async () => {
    settings.pushEnabled = pushToggle.checked;
    Store.saveSettings(settings);
    if (pushToggle.checked) {
      UI.toast('正在开启推送...', 'info');
      const ok = await PushNotification.ensureSubscription();
      if (ok) {
        UI.toast('推送已开启！每天 21:00 提醒记账，生日提前 7 天提醒', 'success');
      } else {
        settings.pushEnabled = false;
        Store.saveSettings(settings);
        pushToggle.checked = false;
      }
    } else {
      await PushNotification.disable();
      UI.toast('推送已关闭', 'info');
    }
    PushNotification.updateUI();
  };

  // Test push button
  const testBtn = document.getElementById('btn-test-push');
  if (testBtn) {
    testBtn.onclick = () => PushNotification.testPush();
  }

  // Sync now button
  const syncBtn = document.getElementById('btn-sync-now');
  if (syncBtn) {
    syncBtn.onclick = async () => {
      UI.toast('正在同步...', 'info');
      const ok = await PushNotification.syncData();
      UI.toast(ok ? '生日数据已同步到云端' : '同步失败，请检查服务器地址', ok ? 'success' : 'error');
    };
  }

  // Add category
  document.getElementById('btn-add-category').onclick = () => {
    const input = document.getElementById('new-category');
    const val = input.value.trim();
    if (!val) return;
    const s = Store.getSettings();
    if (s.categories.includes(val)) {
      UI.toast('该分类已存在', 'error');
      return;
    }
    s.categories.push(val);
    Store.saveSettings(s);
    input.value = '';
    renderCategoryTags();
    UI.toast('分类已添加', 'success');
  };

  // Export
  document.getElementById('btn-export').onclick = () => {
    const data = Store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yaya-workbench-${UI.todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('数据已导出 📤', 'success');
  };

  // Import
  document.getElementById('btn-import-trigger').onclick = () => {
    document.getElementById('import-file').click();
  };
  document.getElementById('import-file').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        Store.importData(data);
        UI.toast('数据导入成功 📥', 'success');
        PushNotification.syncData();
        renderSettings();
        navigate('dashboard');
      } catch (err) {
        UI.toast('导入失败：文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Clear
  document.getElementById('btn-clear').onclick = () => {
    if (confirm('确定要清空所有数据吗？此操作不可撤销！\n\n建议先导出备份。')) {
      Store.clearAll();
      UI.toast('所有数据已清空', 'info');
      renderSettings();
      navigate('dashboard');
    }
  };
}

function renderCategoryTags() {
  const settings = Store.getSettings();
  const container = document.getElementById('category-tags');
  container.innerHTML = settings.categories.map(cat => `
    <span class="tag">
      ${CAT_ICONS[cat] || '📦'} ${UI.escapeHtml(cat)}
      <button class="tag-remove" data-action="delete-category" data-cat="${UI.escapeHtml(cat)}" aria-label="删除">×</button>
    </span>
  `).join('');
}

function renderDataStats() {
  const expenses = Store.getExpenses();
  const worklogs = Store.getWorkLogs();
  const birthdays = Store.getBirthdays();
  const savings = Store.getSavings();
  const accounts = Store.getAccounts();
  const settings = Store.getSettings();
  document.getElementById('data-stats').innerHTML =
    `数据概览：${expenses.length} 笔消费 · ${worklogs.length} 条工作记录 · ${birthdays.length} 个生日 · ${accounts.length} 个账户 · ${savings.length} 个存钱目标 · ${settings.categories.length} 个分类`;
}

/* ===== Natural Language Parser (自然语言解析) ===== */
const Parser = {
  parseExpense(text) {
    // 支持的格式：午饭20元、奶茶18块、午饭20、花了100吃饭、20午饭、支付35.5
    const patterns = [
      // 文字+金额+单位：午饭20元、奶茶18块
      /(.+?)(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱)/,
      // 花了/支付/付款/消费 + 金额(+单位) + 备注
      /(?:花了|支付|付款|消费)(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱)?\s*(.*)/,
      // 金额+单位+备注：35.5元午饭
      /(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱)\s*(.*)/,
      // 文字+金额（无单位）：午饭20、打车15.5
      /([\u4e00-\u9fa5a-zA-Z][\u4e00-\u9fa5a-zA-Z\s]*?)\s*(\d+(?:\.\d{1,2})?)$/,
      // 金额+文字（无单位）：20午饭
      /(\d+(?:\.\d{1,2})?)\s*([\u4e00-\u9fa5a-zA-Z][\u4e00-\u9fa5a-zA-Z\s]*)/
    ];

    for (const p of patterns) {
      const m = text.match(p);
      if (!m) continue;

      let amount, note;
      if (m[2] && isNaN(Number(m[1]))) {
        // 第一个捕获组是文字，第二个是金额
        note = m[1].trim();
        amount = parseFloat(m[2]);
      } else {
        // 第一个捕获组是金额
        amount = parseFloat(m[1]);
        note = (m[2] || '').trim();
      }

      if (!amount || amount <= 0 || amount > 1000000) continue;
      // 无单位模式下金额不能太大（避免误匹配年份等）
      const hasUnit = text.match(/元|块|块钱|花了|支付|付款|消费/);
      if (!hasUnit && amount > 50000) continue;

      // Determine category from note using keyword mapping
      const settings = Store.getSettings();
      const categories = settings.categories;
      let category = categories[categories.length - 1] || '其他';
      const searchText = (note || text).toLowerCase();

      // 先用关键词映射表匹配
      for (const cat of categories) {
        const keywords = CATEGORY_KEYWORDS[cat];
        if (keywords) {
          for (const kw of keywords) {
            if (searchText.includes(kw.toLowerCase())) {
              category = cat;
              break;
            }
          }
        }
        if (category === cat) break;
      }

      // 如果关键词没匹配到，再用分类名本身匹配
      if (category === (categories[categories.length - 1] || '其他')) {
        for (const cat of categories) {
          if (searchText.includes(cat.toLowerCase())) {
            category = cat;
            break;
          }
        }
      }

      // Clean note of category word if it equals category
      if (note === category) note = '';

      return { amount, category, date: UI.todayStr(), note };
    }
    return null;
  },

  parseBirthday(text) {
    // 支持的格式：
    //   笑笑生日2000.10.06阴历、笑笑2000年10月6日阴历
    //   笑笑2000-10-6阳历、小雅1995年5月20日
    //   笑笑生日10月6日阴历（无年份默认2000）
    // 先提取日期部分（支持多种分隔符）
    const dateMatch = text.match(/(\d{4})?\s*[年.\-/]?\s*(\d{1,2})\s*[月.\-/]\s*(\d{1,2})\s*[日号]?\s*(阴历|农历|阳历|公历|新历)?/);
    if (!dateMatch) return null;

    const year = dateMatch[1] ? parseInt(dateMatch[1]) : 2000;
    const month = parseInt(dateMatch[2]);
    const day = parseInt(dateMatch[3]);
    const typeHint = (dateMatch[4] || '').trim();
    const type = typeHint.includes('阴') || typeHint.includes('农') ? 'lunar' : 'solar';

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    // 从日期之前提取名字
    const beforeDate = text.substring(0, dateMatch.index).trim();
    let name = beforeDate
      .replace(/^(添加|加一下|记一下|记录)\s*/, '')
      .replace(/生日\s*$/, '')
      .replace(/的\s*$/, '')
      .trim();
    // 去掉残留的"生日"
    name = name.replace(/生日/g, '').trim();

    if (!name) return null;

    const data = { name, type, notes: '' };

    if (type === 'solar') {
      // 阳历：直接用输入的月日
      data.month = month;
      data.day = day;
      data.year = year;
    } else {
      // 阴历：用户输入的月日就是阴历月日，直接存储
      data.lunarYear = year;
      data.lunarMonth = month;
      data.lunarDay = day;
      // 计算对应的阳历日期用于显示
      const solar = LunarCalendar.lunarToSolar(year, month, day);
      if (solar) {
        data.month = solar.month;
        data.day = solar.day;
        data.year = solar.year;
      } else {
        // 库未加载，用原始日期做 fallback
        data.month = month;
        data.day = day;
        data.year = year;
      }
    }

    return data;
  }
};

/* ===== Smart Form (自然语言智能填表) ===== */
const SmartForm = {
  init() {
    // 给每个表单的智能输入栏绑定事件
    document.querySelectorAll('.smart-fill-bar').forEach(bar => {
      const form = bar.dataset.form;
      const input = bar.querySelector('.smart-fill-input');
      const btn = bar.querySelector('.smart-fill-btn');

      if (!form || !input) return;

      const handler = () => {
        const text = input.value.trim();
        if (!text) return;
        const ok = this.fillForm(form, text);
        if (ok) input.value = '';
      };

      btn.addEventListener('click', handler);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handler();
        }
      });
    });
  },

  fillForm(formType, text) {
    try {
      if (formType === 'expense') return this.fillExpense(text);
      if (formType === 'birthday') return this.fillBirthday(text);
    } catch (err) {
      console.error('智能填表错误:', err);
      UI.toast('智能填写出错了：' + (err.message || ''), 'error');
    }
    return false;
  },

  fillExpense(text) {
    const expense = Parser.parseExpense(text);
    if (!expense) {
      UI.toast('没看懂，试试输入「午饭20」或「奶茶18元」', 'error');
      return false;
    }
    document.getElementById('exp-amount').value = expense.amount;
    // 尝试匹配分类
    const catSelect = document.getElementById('exp-category');
    for (const opt of catSelect.options) {
      if (opt.value === expense.category) { opt.selected = true; break; }
    }
    document.getElementById('exp-note').value = expense.note || '';
    document.getElementById('exp-date').value = expense.date;
    UI.toast(`✨ 已填入：${expense.amount}元 ${expense.category}，点击记一笔确认`, 'success');
    return true;
  },

  fillBirthday(text) {
    const birthday = Parser.parseBirthday(text);
    if (!birthday) {
      UI.toast('没看懂，试试输入「笑笑2000.10.06阴历」', 'error');
      return false;
    }
    document.getElementById('bd-name').value = birthday.name;
    const typeSelect = document.getElementById('bd-type');
    typeSelect.value = birthday.type;

    // 设置日期输入框（YYYY-MM-DD）
    // parseBirthday 统一返回 year/month/day（阴历已转换为阳历）
    const mm = String(birthday.month).padStart(2, '0');
    const dd = String(birthday.day).padStart(2, '0');
    document.getElementById('bd-date').value = `${birthday.year}-${mm}-${dd}`;

    UI.toast(`✨ 已填入：${birthday.name} ${birthday.type === 'lunar' ? '阴历' : '阳历'}生日，点击添加确认`, 'success');
    return true;
  }
};

/* ===== Page Monitor (Payment Detection) ===== */
const PageMonitor = {
  enabled: false,
  patterns: [
    /支付\s*[¥￥]\s*(\d+(?:\.\d{1,2})?)/,
    /(?:支付|付款|消费|订单金额).*?[¥￥]\s*(\d+(?:\.\d{1,2})?)/,
    /[¥￥]\s*(\d+(?:\.\d{1,2})?)\s*(?:元|CNY)?/
  ],
  lastDetected: null,

  init() {
    this.enabled = Store.getSettings().pageMonitor;
    this.updateState();
  },

  updateState() {
    this.enabled = Store.getSettings().pageMonitor;
  },

  start() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.enabled) {
        this.checkClipboard();
      }
    });

    if (this.enabled) {
      this.checkClipboard();
    }
  },

  async checkClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.length < 500) {
        this.scanText(text, 'clipboard');
      }
    } catch (e) {
      // Permission denied or not available
    }
  },

  scanText(text, source) {
    for (const pattern of this.patterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseFloat(match[1]);
        if (amount > 0 && amount < 1000000) {
          this.showPopup(amount, text, source);
          return;
        }
      }
    }
  },

  showPopup(amount, context, source) {
    if (this.lastDetected === amount) return;
    this.lastDetected = amount;

    const popup = document.getElementById('payment-popup');
    document.getElementById('popup-amount').textContent = UI.formatMoney(amount);
    document.getElementById('popup-context').textContent = source === 'clipboard'
      ? '从剪贴板检测到消费信息'
      : '从页面检测到消费信息';

    popup.dataset.amount = amount;
    popup.dataset.context = context;
    popup.classList.remove('hidden');
  },

  hidePopup() {
    document.getElementById('payment-popup').classList.add('hidden');
    this.lastDetected = null;
  }
};

/* ===== Event Delegation ===== */
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) {
    const navTarget = e.target.closest('[data-view]');
    if (navTarget) {
      e.preventDefault();
      navigate(navTarget.dataset.view);
    }
    return;
  }

  const action = target.dataset.action;

  if (action === 'delete-expense') {
    Store.deleteExpense(target.dataset.id);
    renderExpenseList();
    UI.toast('已删除', 'info');
  } else if (action === 'delete-worklog') {
    Store.deleteWorkLog(target.dataset.id);
    renderWorkLogList();
    UI.toast('已删除', 'info');
  } else if (action === 'delete-birthday') {
    Store.deleteBirthday(target.dataset.id);
    renderBirthdayList();
    UI.toast('已删除', 'info');
    PushNotification.syncData();
  } else if (action === 'delete-saving') {
    Store.deleteSaving(target.dataset.id);
    renderSavingsList();
    renderDashboard();
    UI.toast('已删除', 'info');
  } else if (action === 'delete-category') {
    const cat = target.dataset.cat;
    const settings = Store.getSettings();
    settings.categories = settings.categories.filter(c => c !== cat);
    Store.saveSettings(settings);
    renderCategoryTags();
    UI.toast('分类已删除', 'info');
  } else if (action === 'add-to-saving') {
    savingEditId = target.dataset.id;
    renderSavingsList();
    setTimeout(() => {
      const input = document.getElementById(`saving-add-${savingEditId}`);
      if (input) input.focus();
    }, 50);
  } else if (action === 'cancel-saving-add') {
    savingEditId = null;
    renderSavingsList();
  } else if (action === 'save-saving-add') {
    const id = target.dataset.id;
    const input = document.getElementById(`saving-add-${id}`);
    const amount = parseFloat(input.value);
    if (!amount || amount <= 0) {
      UI.toast('请输入有效金额', 'error');
      return;
    }
    const saving = Store.getSavings().find(s => s.id === id);
    if (saving) {
      Store.updateSaving(id, { saved: (Number(saving.saved) || 0) + amount });
      UI.toast(`已存入 ${UI.formatMoney(amount)} 🌟`, 'success');
    }
    savingEditId = null;
    renderSavingsList();
    renderDashboard();
  } else if (action === 'reset-saving') {
    const id = target.dataset.id;
    if (confirm('确定要清空已存金额吗？')) {
      Store.updateSaving(id, { saved: 0 });
      renderSavingsList();
      renderDashboard();
      UI.toast('已归零', 'info');
    }
  } else if (action === 'edit-account') {
    accountEditId = target.dataset.id;
    renderAccountList();
    setTimeout(() => {
      const input = document.getElementById(`ac-edit-name-${accountEditId}`);
      if (input) input.focus();
    }, 50);
  } else if (action === 'cancel-account-edit') {
    accountEditId = null;
    renderAccountList();
  } else if (action === 'save-account') {
    const id = target.dataset.id;
    const nameEl = document.getElementById(`ac-edit-name-${id}`);
    const balanceEl = document.getElementById(`ac-edit-balance-${id}`);
    const name = nameEl.value.trim();
    const balance = parseFloat(balanceEl.value);
    if (!name) {
      UI.toast('请输入账户名称', 'error');
      return;
    }
    if (isNaN(balance)) {
      UI.toast('请输入有效金额', 'error');
      return;
    }
    Store.updateAccount(id, { name, balance: Math.abs(balance) });
    accountEditId = null;
    renderAccountList();
    renderAssetOverview();
    renderDashboard();
    UI.toast('账户已更新 ✨', 'success');
  } else if (action === 'delete-account') {
    const id = target.dataset.id;
    if (confirm('确定要删除这个账户吗？')) {
      Store.deleteAccount(id);
      accountEditId = null;
      renderAccountList();
      renderAssetOverview();
      renderDashboard();
      UI.toast('已删除', 'info');
    }
  }
});

/* ===== Payment Popup Events ===== */
document.getElementById('popup-close').addEventListener('click', () => {
  PageMonitor.hidePopup();
});

document.getElementById('popup-log').addEventListener('click', () => {
  const popup = document.getElementById('payment-popup');
  const amount = parseFloat(popup.dataset.amount);
  if (amount) {
    Store.addExpense({
      amount: amount,
      category: Store.getSettings().categories[0] || '其他',
      date: UI.todayStr(),
      note: '快捷记账'
    });
    UI.toast(`已记账 ${UI.formatMoney(amount)} ✨`, 'success');
    PageMonitor.hidePopup();
    navigate('expenses');
  }
});

/* ===== Share Target Handling ===== */
function handleShareTarget() {
  const urlParams = new URLSearchParams(window.location.search);
  const title = urlParams.get('title') || '';
  const text = urlParams.get('text') || '';
  const sharedUrl = urlParams.get('url') || '';

  if (title || text || sharedUrl) {
    const combined = `${title} ${text} ${sharedUrl}`.trim();
    PageMonitor.scanText(combined, 'shared');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

/* ===== Initialize ===== */
const PushNotification = {
  get BACKEND_URL() {
    return Store.getSettings().backendUrl || DEFAULT_BACKEND_URL;
  },
  _subscribed: false,

  async init() {
    const settings = Store.getSettings();
    if (settings.pushEnabled) {
      await this.ensureSubscription();
    }
    this.updateUI();
  },

  async ensureSubscription() {
    if (!this.BACKEND_URL) {
      UI.toast('请先在设置中填写服务器地址', 'error');
      return false;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      UI.toast('当前浏览器不支持推送通知', 'error');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        UI.toast('需要允许通知权限才能接收提醒', 'error');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const pubKeyRes = await fetch(`${this.BACKEND_URL}/api/vapid-public-key`, { cache: 'no-store' });
        if (!pubKeyRes.ok) throw new Error(`获取推送公钥失败（${pubKeyRes.status}）`);
        const { publicKey } = await pubKeyRes.json();
        const convertedKey = this.urlBase64ToUint8Array(publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      const subscribeRes = await fetch(`${this.BACKEND_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });
      if (!subscribeRes.ok) throw new Error(`保存推送订阅失败（${subscribeRes.status}）`);

      this._subscribed = true;
      await this.syncData();
      return true;
    } catch (e) {
      console.error('Push subscription error:', e);
      UI.toast('推送订阅失败：' + e.message, 'error');
      return false;
    }
  },

  async syncData() {
    if (!this.BACKEND_URL) return false;
    try {
      const birthdays = Store.getBirthdays();
      const res = await fetch(`${this.BACKEND_URL}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthdays })
      });
      if (!res.ok) throw new Error(`同步失败（${res.status}）`);
      console.log(`Synced ${birthdays.length} birthdays to backend`);
      return true;
    } catch (e) {
      console.error('Sync error:', e);
      return false;
    }
  },

  async disable() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }
      this._subscribed = false;
    } catch (e) {
      console.error('Unsubscribe error:', e);
    }
  },

  async testPush() {
    try {
      const res = await fetch(`${this.BACKEND_URL}/api/test-push`, { method: 'POST' });
      if (!res.ok) throw new Error(`服务器返回 ${res.status}`);
      const data = await res.json();
      if (data.success) {
        UI.toast('测试推送已发送，请查看通知栏', 'success');
      } else {
        UI.toast('测试推送失败', 'error');
      }
    } catch (e) {
      UI.toast('无法连接服务器：' + e.message, 'error');
    }
  },

  updateUI() {
    const toggle = document.getElementById('setting-push');
    const actions = document.getElementById('push-actions');
    const status = document.getElementById('push-status');
    if (!toggle) return;

    const settings = Store.getSettings();
    toggle.checked = settings.pushEnabled;
    if (actions) actions.style.display = settings.pushEnabled ? 'flex' : 'none';

    if (settings.pushEnabled && this._subscribed) {
      if (status) status.textContent = '已开启。每天 21:00 提醒记账，好友生日提前 7 天 + 当天提醒。';
    } else if (settings.pushEnabled && !this._subscribed) {
      if (status) status.textContent = '正在连接推送服务...请确保已添加到主屏幕并允许通知权限。';
    } else {
      if (status) status.textContent = '开启后，每天 21:00 提醒记账，好友生日提前 7 天 + 当天提醒。需要将 App 添加到主屏幕并允许通知权限。';
    }
  },

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Bottom nav events
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.view);
    });
  });

  // Initialize smart form
  SmartForm.init();

  // Initialize page monitor
  PageMonitor.init();
  PageMonitor.start();

  // Initialize push notifications
  PushNotification.init();

  // Handle shared content
  handleShareTarget();

  // Initial render
  renderDashboard();
});
