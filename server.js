const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const { Lunar, Solar } = require('lunar-javascript');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BHpqLgc1ysKBvjlkzstkYhdOSyd1BakALaGUxBWs4RL2W70w6Lnq9SodxUfQ4SSV5lWw_DwhpXd4Bk2IRKtX9lU';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'GQ-PSniKaVkApbWJjD0agGh5i73TG9_HWFMF3C9y-84';

webpush.setVapidDetails(
  'mailto:yaya-workbench@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Load data error:', e.message);
  }
  return { subscriptions: [], birthdays: [], lastSync: null };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Save data error:', e.message);
  }
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

async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('Push error:', e.statusCode, e.message);
    if (e.statusCode === 410 || e.statusCode === 404) {
      const data = loadData();
      data.subscriptions = data.subscriptions.filter(s => s.endpoint !== subscription.endpoint);
      saveData(data);
    }
    return false;
  }
}

async function sendToAll(payload) {
  const data = loadData();
  if (data.subscriptions.length === 0) {
    console.log('No subscriptions, skipping push');
    return;
  }
  console.log(`Sending push to ${data.subscriptions.length} device(s):`, payload.title);
  for (const sub of data.subscriptions) {
    await sendPush(sub, payload);
  }
}

app.get('/api/health', (req, res) => {
  const data = loadData();
  res.json({
    status: 'ok',
    subscriptions: data.subscriptions.length,
    birthdays: data.birthdays.length,
    lastSync: data.lastSync
  });
});

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  const data = loadData();
  const exists = data.subscriptions.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    data.subscriptions.push(subscription);
    saveData(data);
    console.log('New subscription added, total:', data.subscriptions.length);
  }
  res.json({ success: true, total: data.subscriptions.length });
});

app.post('/api/sync', (req, res) => {
  const { birthdays } = req.body;
  if (!Array.isArray(birthdays)) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  const data = loadData();
  data.birthdays = birthdays;
  data.lastSync = new Date().toISOString();
  saveData(data);
  console.log(`Synced ${birthdays.length} birthdays at ${data.lastSync}`);
  res.json({ success: true, count: birthdays.length });
});

app.post('/api/test-push', async (req, res) => {
  await sendToAll({
    title: '测试通知',
    body: '这是一条测试推送，如果你看到了说明推送功能正常工作！',
    icon: '/icon-192.png',
    tag: 'test'
  });
  res.json({ success: true });
});

app.post('/api/check-birthdays', async (req, res) => {
  const results = await checkBirthdays();
  res.json(results);
});

async function checkBirthdays() {
  const data = loadData();
  if (data.birthdays.length === 0) {
    console.log('No birthday data, skipping check');
    return { checked: 0, sent: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const sentKeys = [];

  const todayBirthdays = [];
  const upcomingBirthdays = [];

  data.birthdays.forEach(b => {
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

    await sendToAll({
      title: '今天是生日！',
      body: `${names} 今天过生日！记得送上祝福`,
      icon: '/icon-192.png',
      tag: `birthday-today-${todayStr}`,
      data: { url: '/#birthdays' }
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

    await sendToAll({
      title: '生日提醒',
      body: `未来7天有${sorted.length}个生日即将到来`,
      icon: '/icon-192.png',
      tag: `birthday-upcoming-${todayStr}`,
      data: { url: '/#birthdays' }
    });
    console.log('Sent upcoming birthday notification:', lines);
  }

  const sent = todayBirthdays.length > 0 ? 1 : 0 + upcomingBirthdays.length > 0 ? 1 : 0;
  return { checked: data.birthdays.length, sent, todayCount: todayBirthdays.length, upcomingCount: upcomingBirthdays.length };
}

async function sendExpenseReminder() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const hour = today.getHours();

  await sendToAll({
    title: '该记账啦',
    body: '今天花了多少？记一笔，别忘记',
    icon: '/icon-192.png',
    tag: `expense-${todayStr}`,
    data: { url: '/#expense' }
  });
  console.log('Sent expense reminder at', new Date().toISOString());
}

cron.schedule('0 8 * * *', async () => {
  console.log('=== Running birthday check cron ===', new Date().toISOString());
  await checkBirthdays();
}, { timezone: 'Asia/Shanghai' });

cron.schedule('0 21 * * *', async () => {
  console.log('=== Running expense reminder cron ===', new Date().toISOString());
  await sendExpenseReminder();
}, { timezone: 'Asia/Shanghai' });

app.listen(PORT, () => {
  console.log(`Yaya backend running on port ${PORT}`);
  console.log(`Cron jobs: birthday check at 08:00, expense reminder at 21:00 (Asia/Shanghai)`);
});
