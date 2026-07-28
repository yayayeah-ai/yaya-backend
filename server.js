const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const { Lunar, Solar } = require('lunar-javascript');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', service: 'yaya-backend', version: '2.0', time: new Date().toISOString() });
});

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BHpqLgc1ysKBvjlkzstkYhdOSyd1BakALaGUxBWs4RL2W70w6Lnq9SodxUfQ4SSV5lWw_DwhpXd4Bk2IRKtX9lU';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'GQ-PSniKaVkApbWJjD0agGh5i73TG9_HWFMF3C9y-84';

webpush.setVapidDetails(
  'mailto:yaya-workbench@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const DATA_FILE = path.join(__dirname, 'data.json');
const WORKSPACE_CONFIG = {
  yaya: { name: '雅雅', basePath: '' },
  xiaoxiao: { name: '笑笑', basePath: '/xiaoxiao' }
};

function emptyWorkspace() {
  return { subscriptions: [], birthdays: [], lastSync: null };
}

function normalizeData(raw) {
  if (raw && raw.workspaces) {
    for (const workspaceId of Object.keys(WORKSPACE_CONFIG)) {
      raw.workspaces[workspaceId] = {
        ...emptyWorkspace(),
        ...(raw.workspaces[workspaceId] || {})
      };
    }
    return raw;
  }

  return {
    workspaces: {
      yaya: {
        ...emptyWorkspace(),
        subscriptions: raw?.subscriptions || [],
        birthdays: raw?.birthdays || [],
        lastSync: raw?.lastSync || null
      },
      xiaoxiao: emptyWorkspace()
    }
  };
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return normalizeData(JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')));
    }
  } catch (e) {
    console.error('Load data error:', e.message);
  }
  return normalizeData(null);
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Save data error:', e.message);
  }
}

function getWorkspaceId(value) {
  return Object.prototype.hasOwnProperty.call(WORKSPACE_CONFIG, value) ? value : 'yaya';
}

function getWorkspace(data, workspaceId) {
  const id = getWorkspaceId(workspaceId);
  data.workspaces[id] ||= emptyWorkspace();
  return data.workspaces[id];
}

function getNextBirthdayDate(birthday) {
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
    const lm = birthday.lunarMonth;
    const ld = birthday.lunarDay;
    const currentYear = today.getFullYear();
    let lunar = Lunar.fromYmd(currentYear, lm, ld);
    let solar = lunar.getSolar();
    let date = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
    if (date < today) {
      lunar = Lunar.fromYmd(currentYear + 1, lm, ld);
      solar = lunar.getSolar();
      date = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
    }
    return date;
  }
}

function formatLunarDate(month, day) {
  const months = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  const days = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
  return `${months[month - 1]}月${days[day - 1]}`;
}

function formatDateFull(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${m}月${d}日 星期${weekdays[date.getDay()]}`;
}

async function sendPush(workspaceId, subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('Push error:', e.statusCode, e.message);
    if (e.statusCode === 410 || e.statusCode === 404) {
      const data = loadData();
      const workspace = getWorkspace(data, workspaceId);
      workspace.subscriptions = workspace.subscriptions.filter(s => s.endpoint !== subscription.endpoint);
      saveData(data);
    }
    return false;
  }
}

async function sendToAll(workspaceId, payload) {
  const data = loadData();
  const workspace = getWorkspace(data, workspaceId);
  if (workspace.subscriptions.length === 0) {
    console.log(`No subscriptions for ${workspaceId}, skipping push`);
    return;
  }
  console.log(`Sending ${workspaceId} push to ${workspace.subscriptions.length} device(s):`, payload.title);
  for (const sub of workspace.subscriptions) {
    await sendPush(workspaceId, sub, payload);
  }
}

app.get('/api/health', (req, res) => {
  const data = loadData();
  const workspaceId = getWorkspaceId(req.query.workspaceId);
  const workspace = getWorkspace(data, workspaceId);
  res.json({
    status: 'ok',
    workspaceId,
    subscriptions: workspace.subscriptions.length,
    birthdays: workspace.birthdays.length,
    lastSync: workspace.lastSync
  });
});

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', (req, res) => {
  const workspaceId = getWorkspaceId(req.body?.workspaceId);
  const subscription = req.body?.subscription || req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  const data = loadData();
  const workspace = getWorkspace(data, workspaceId);
  const exists = workspace.subscriptions.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    workspace.subscriptions.push(subscription);
    saveData(data);
    console.log(`New ${workspaceId} subscription added, total:`, workspace.subscriptions.length);
  }
  res.json({ success: true, workspaceId, total: workspace.subscriptions.length });
});

app.post('/api/sync', (req, res) => {
  const { birthdays } = req.body || {};
  const workspaceId = getWorkspaceId(req.body?.workspaceId);
  if (!Array.isArray(birthdays)) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  const data = loadData();
  const workspace = getWorkspace(data, workspaceId);
  workspace.birthdays = birthdays;
  workspace.lastSync = new Date().toISOString();
  saveData(data);
  console.log(`Synced ${birthdays.length} ${workspaceId} birthdays at ${workspace.lastSync}`);
  res.json({ success: true, workspaceId, count: birthdays.length });
});

app.post('/api/test-push', async (req, res) => {
  const workspaceId = getWorkspaceId(req.body?.workspaceId);
  const config = WORKSPACE_CONFIG[workspaceId];
  await sendToAll(workspaceId, {
    title: `${config.name}的工作台测试通知`,
    body: '这是一条测试推送，如果你看到了说明推送功能正常工作！',
    icon: `${config.basePath}/icon-192.png`,
    tag: `${workspaceId}-test`
  });
  res.json({ success: true, workspaceId });
});

app.post('/api/check-birthdays', async (req, res) => {
  const workspaceId = getWorkspaceId(req.body?.workspaceId);
  const results = await checkBirthdays(workspaceId);
  res.json(results);
});

async function checkBirthdays(workspaceId) {
  const data = loadData();
  const workspace = getWorkspace(data, workspaceId);
  const config = WORKSPACE_CONFIG[workspaceId];
  if (workspace.birthdays.length === 0) {
    console.log(`No ${workspaceId} birthday data, skipping check`);
    return { workspaceId, checked: 0, sent: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const sentKeys = [];

  const todayBirthdays = [];
  const upcomingBirthdays = [];

  workspace.birthdays.forEach(b => {
    const nextDate = getNextBirthdayDate(b);
    if (!nextDate) return;
    const diffDays = Math.round((nextDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      todayBirthdays.push({ ...b, nextDate, diffDays });
    } else if (diffDays > 0 && diffDays <= 7) {
      upcomingBirthdays.push({ ...b, nextDate, diffDays });
    }
  });

  if (todayBirthdays.length > 0) {
    const names = todayBirthdays.map(b => b.name).join('、');
    const details = todayBirthdays.map(b => {
      const dateStr = formatDateFull(b.nextDate);
      const lunarStr = b.type === 'lunar'
        ? `（阴历${formatLunarDate(b.lunarMonth, b.lunarDay)}）`
        : '';
      return `${b.name} ${dateStr}${lunarStr}`;
    }).join('\n');

    await sendToAll(workspaceId, {
      title: '今天是生日！',
      body: `${names} 今天过生日！记得送上祝福`,
      icon: `${config.basePath}/icon-192.png`,
      tag: `${workspaceId}-birthday-today-${todayStr}`,
      data: { url: `${config.basePath}/#birthdays` }
    });
    console.log('Sent today birthday notification:', names);
  }

  if (upcomingBirthdays.length > 0) {
    const sorted = upcomingBirthdays.sort((a, b) => a.diffDays - b.diffDays);
    const lines = sorted.map(b => {
      const dateStr = formatDateFull(b.nextDate);
      const lunarStr = b.type === 'lunar'
        ? `（阴历${formatLunarDate(b.lunarMonth, b.lunarDay)}）`
        : '';
      return `${b.name} ${dateStr}${lunarStr} - 还有${b.diffDays}天`;
    }).join('\n');

    await sendToAll(workspaceId, {
      title: '生日提醒',
      body: `未来7天有${sorted.length}个生日即将到来`,
      icon: `${config.basePath}/icon-192.png`,
      tag: `${workspaceId}-birthday-upcoming-${todayStr}`,
      data: { url: `${config.basePath}/#birthdays` }
    });
    console.log('Sent upcoming birthday notification:', lines);
  }

  const sent = (todayBirthdays.length > 0 ? 1 : 0) + (upcomingBirthdays.length > 0 ? 1 : 0);
  return {
    workspaceId,
    checked: workspace.birthdays.length,
    sent,
    todayCount: todayBirthdays.length,
    upcomingCount: upcomingBirthdays.length
  };
}

async function sendExpenseReminder(workspaceId) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const config = WORKSPACE_CONFIG[workspaceId];

  await sendToAll(workspaceId, {
    title: '该记账啦',
    body: '今天花了多少？记一笔，别忘记',
    icon: `${config.basePath}/icon-192.png`,
    tag: `${workspaceId}-expense-${todayStr}`,
    data: { url: `${config.basePath}/#expense` }
  });
  console.log(`Sent ${workspaceId} expense reminder at`, new Date().toISOString());
}

cron.schedule('0 8 * * *', async () => {
  console.log('=== Running birthday check cron ===', new Date().toISOString());
  for (const workspaceId of Object.keys(WORKSPACE_CONFIG)) {
    await checkBirthdays(workspaceId);
  }
}, { timezone: 'Asia/Shanghai' });

cron.schedule('0 21 * * *', async () => {
  console.log('=== Running expense reminder cron ===', new Date().toISOString());
  for (const workspaceId of Object.keys(WORKSPACE_CONFIG)) {
    await sendExpenseReminder(workspaceId);
  }
}, { timezone: 'Asia/Shanghai' });

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

app.listen(PORT, HOST, () => {
  console.log(`Yaya backend running on ${HOST}:${PORT}`);
  console.log(`Cron jobs: birthday check at 08:00, expense reminder at 21:00 (Asia/Shanghai)`);
});
