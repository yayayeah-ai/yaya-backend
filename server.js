const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const webpush = require('web-push');
const cron = require('node-cron');
const { Lunar } = require('lunar-javascript');
const { createStorage, normalizeWorkspaceId } = require('./storage');

const app = express();
const storage = createStorage();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const COOKIE_NAME = 'yaya_session';
const SESSION_DAYS = 30;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const WORKSPACE_CONFIG = {
  yaya: { name: '雅雅', basePath: '' },
  xiaoxiao: { name: '笑笑', basePath: '/xiaoxiao' }
};

const CRON_SECRET = process.env.CRON_SECRET;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:yaya-workbench@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn('VAPID keys are not configured; push notifications are disabled.');
}

app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'yaya-backend',
    version: '3.1',
    database: process.env.DATABASE_URL ? 'postgresql' : 'memory',
    pushConfigured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
    time: new Date().toISOString()
  });
});

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id || user.userId,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt
  };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

async function issueSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await storage.createSession(hashToken(token), userId, expiresAt);
  setSessionCookie(res, token);
}

async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (token) req.session = await storage.getSession(hashToken(token));
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.session) {
    return res.status(401).json({ error: '请先登录', code: 'AUTH_REQUIRED' });
  }
  next();
}

app.use(optionalAuth);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '尝试次数过多，请稍后再试' }
});

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: '密码需要 8–128 个字符' });
    }
    if (!displayName || displayName.length > 30) {
      return res.status(400).json({ error: '昵称需要 1–30 个字符' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await storage.createUser({ email, displayName, passwordHash });
    await issueSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: '该邮箱已经注册' });
    }
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const user = await storage.findUserByEmail(email);
    const valid = user && await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: '邮箱或密码不正确' });
    }
    await issueSession(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (token) await storage.deleteSession(hashToken(token));
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.session) });
});

app.patch('/api/auth/profile', requireAuth, async (req, res, next) => {
  try {
    const displayName = String(req.body?.displayName || '').trim();
    if (!displayName || displayName.length > 30) {
      return res.status(400).json({ error: '昵称需要 1–30 个字符' });
    }
    const user = await storage.updateUserDisplayName(req.session.userId, displayName);
    if (!user) {
      return res.status(404).json({ error: '账号不存在' });
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/data', requireAuth, async (req, res, next) => {
  try {
    const workspaceId = normalizeWorkspaceId(req.query.workspaceId);
    const result = await storage.getUserData(req.session.userId, workspaceId);
    res.json({ workspaceId, ...result });
  } catch (error) {
    next(error);
  }
});

app.put('/api/data', requireAuth, async (req, res, next) => {
  try {
    const workspaceId = normalizeWorkspaceId(req.body?.workspaceId);
    const expectedRevision = Number.isInteger(req.body?.revision) ? req.body.revision : null;
    if (!req.body?.data || typeof req.body.data !== 'object') {
      return res.status(400).json({ error: '数据格式不正确' });
    }
    const result = await storage.saveUserData(
      req.session.userId,
      workspaceId,
      req.body.data,
      expectedRevision
    );
    if (result.conflict) {
      return res.status(409).json({
        error: '云端数据已在其他设备更新',
        code: 'SYNC_CONFLICT',
        ...result.current
      });
    }
    res.json({ success: true, workspaceId, ...result });
  } catch (error) {
    next(error);
  }
});

app.get('/api/health', requireAuth, async (req, res, next) => {
  try {
    const workspaceId = normalizeWorkspaceId(req.query.workspaceId);
    const stats = await storage.stats(req.session.userId, workspaceId);
    res.json({ status: 'ok', workspaceId, ...stats });
  } catch (error) {
    next(error);
  }
});

app.get('/api/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: '推送服务尚未配置' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', requireAuth, async (req, res, next) => {
  try {
    const workspaceId = normalizeWorkspaceId(req.body?.workspaceId);
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint) {
      return res.status(400).json({ error: '推送订阅格式不正确' });
    }
    await storage.upsertSubscription(req.session.userId, workspaceId, subscription);
    const subscriptions = await storage.getUserSubscriptions(req.session.userId, workspaceId);
    res.json({ success: true, workspaceId, total: subscriptions.length });
  } catch (error) {
    next(error);
  }
});

app.post('/api/unsubscribe', requireAuth, async (req, res, next) => {
  try {
    if (req.body?.endpoint) await storage.deleteSubscription(req.body.endpoint);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

async function sendPush(subscription, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('Push error:', error.statusCode, error.message);
    if (error.statusCode === 404 || error.statusCode === 410) {
      await storage.deleteSubscription(subscription.endpoint);
    }
    return false;
  }
}

async function sendToSubscriptions(subscriptions, payload) {
  let sent = 0;
  for (const subscription of subscriptions) {
    if (await sendPush(subscription, payload)) sent += 1;
  }
  return sent;
}

app.post('/api/test-push', requireAuth, async (req, res, next) => {
  try {
    const workspaceId = normalizeWorkspaceId(req.body?.workspaceId);
    const config = WORKSPACE_CONFIG[workspaceId];
    const subscriptions = await storage.getUserSubscriptions(req.session.userId, workspaceId);
    const sent = await sendToSubscriptions(subscriptions, {
      title: `${config.name}的工作台测试通知`,
      body: '这是一条测试推送。看到它说明消息推送工作正常！',
      icon: `${config.basePath}/icon-192.png`,
      tag: `${workspaceId}-test`,
      data: { url: `${config.basePath}/` }
    });
    res.json({ success: true, workspaceId, subscriptions: subscriptions.length, sent });
  } catch (error) {
    next(error);
  }
});

function getNextBirthdayDate(birthday) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (birthday.type === 'solar') {
    let date = new Date(today.getFullYear(), Number(birthday.month) - 1, Number(birthday.day));
    if (date < today) date.setFullYear(date.getFullYear() + 1);
    return date;
  }
  const lunarMonth = Number(birthday.lunarMonth);
  const lunarDay = Number(birthday.lunarDay);
  if (!lunarMonth || !lunarDay) return null;
  let lunar = Lunar.fromYmd(today.getFullYear(), lunarMonth, lunarDay);
  let solar = lunar.getSolar();
  let date = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
  if (date < today) {
    lunar = Lunar.fromYmd(today.getFullYear() + 1, lunarMonth, lunarDay);
    solar = lunar.getSolar();
    date = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
  }
  return date;
}

async function checkBirthdaysForTarget(target) {
  const birthdays = target.data.birthdays || [];
  if (!birthdays.length || !target.subscriptions.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const matches = birthdays
    .map(item => ({ ...item, nextDate: getNextBirthdayDate(item) }))
    .filter(item => item.nextDate)
    .map(item => ({
      ...item,
      days: Math.round((item.nextDate - today) / 86400000)
    }))
    .filter(item => item.days >= 0 && item.days <= 7)
    .sort((a, b) => a.days - b.days);
  if (!matches.length) return 0;

  const config = WORKSPACE_CONFIG[target.workspaceId];
  const todayNames = matches.filter(item => item.days === 0).map(item => item.name);
  const upcoming = matches.filter(item => item.days > 0);
  let sent = 0;
  if (todayNames.length) {
    sent += await sendToSubscriptions(target.subscriptions, {
      title: '今天有生日！',
      body: `${todayNames.join('、')}今天过生日，记得送上祝福`,
      icon: `${config.basePath}/icon-192.png`,
      tag: `${target.workspaceId}-birthday-today`,
      data: { url: `${config.basePath}/#birthdays` }
    });
  }
  if (upcoming.length) {
    sent += await sendToSubscriptions(target.subscriptions, {
      title: '生日提醒',
      body: upcoming.map(item => `${item.name}还有${item.days}天`).join('，'),
      icon: `${config.basePath}/icon-192.png`,
      tag: `${target.workspaceId}-birthday-upcoming`,
      data: { url: `${config.basePath}/#birthdays` }
    });
  }
  return sent;
}

async function runBirthdayReminders() {
  const targets = await storage.listReminderTargets();
  let sent = 0;
  for (const target of targets) sent += await checkBirthdaysForTarget(target);
  console.log(`Birthday reminder run complete: ${targets.length} user workspaces, ${sent} pushes`);
  return { targets: targets.length, sent };
}

async function runExpenseReminders() {
  const targets = await storage.listReminderTargets();
  let sent = 0;
  for (const target of targets) {
    if (!target.subscriptions.length) continue;
    const config = WORKSPACE_CONFIG[target.workspaceId];
    sent += await sendToSubscriptions(target.subscriptions, {
      title: '该记账啦',
      body: '今天花了多少？记一笔，别忘记～',
      icon: `${config.basePath}/icon-192.png`,
      tag: `${target.workspaceId}-expense-daily`,
      data: { url: `${config.basePath}/#expenses` }
    });
  }
  console.log(`Expense reminder run complete: ${targets.length} user workspaces, ${sent} pushes`);
  return { targets: targets.length, sent };
}

app.post('/api/check-birthdays', requireAuth, async (req, res, next) => {
  try {
    const workspaceId = normalizeWorkspaceId(req.body?.workspaceId);
    const data = await storage.getUserData(req.session.userId, workspaceId);
    const subscriptions = await storage.getUserSubscriptions(req.session.userId, workspaceId);
    const sent = await checkBirthdaysForTarget({
      userId: req.session.userId,
      workspaceId,
      data: data.data,
      subscriptions
    });
    res.json({ success: true, workspaceId, checked: data.data.birthdays.length, sent });
  } catch (error) {
    next(error);
  }
});

function requireCronSecret(req, res, next) {
  if (!CRON_SECRET) {
    return res.status(503).json({ error: '定时任务密钥尚未配置' });
  }
  const authorization = String(req.get('authorization') || '');
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const expectedHash = crypto.createHash('sha256').update(CRON_SECRET).digest();
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  if (!provided || !crypto.timingSafeEqual(expectedHash, providedHash)) {
    return res.status(401).json({ error: '无权执行定时任务' });
  }
  next();
}

app.post('/api/cron/:reminder', requireCronSecret, async (req, res, next) => {
  try {
    const runners = {
      birthdays: runBirthdayReminders,
      expenses: runExpenseReminders
    };
    const runReminder = runners[req.params.reminder];
    if (!runReminder) {
      return res.status(404).json({ error: '未知的提醒任务' });
    }
    const result = await runReminder();
    res.json({
      success: true,
      reminder: req.params.reminder,
      ...result,
      time: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

function scheduleReminders() {
  cron.schedule('0 8 * * *', () => runBirthdayReminders().catch(console.error), {
    timezone: 'Asia/Shanghai'
  });
  cron.schedule('0 21 * * *', () => runExpenseReminders().catch(console.error), {
    timezone: 'Asia/Shanghai'
  });
}

app.use(express.static(PUBLIC_DIR));
app.get('/xiaoxiao', (req, res) => res.redirect('/xiaoxiao/'));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: '服务器暂时遇到问题，请稍后重试' });
});

async function start() {
  await storage.init();
  scheduleReminders();
  app.listen(PORT, HOST, () => {
    console.log(`Yaya backend v3 running on ${HOST}:${PORT}`);
    console.log('Cron jobs: birthday 08:00, expense 21:00 (Asia/Shanghai)');
  });
}

if (require.main === module) {
  start().catch(error => {
    console.error('Startup failed:', error);
    process.exit(1);
  });
}

module.exports = { app, start, storage };
