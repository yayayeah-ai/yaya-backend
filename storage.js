const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const EMPTY_DATA = {
  version: '2.17',
  expenses: [],
  worklogs: [],
  birthdays: [],
  savings: [],
  accounts: [],
  settings: {}
};

function normalizeWorkspaceId(value) {
  return value === 'xiaoxiao' ? 'xiaoxiao' : 'yaya';
}

function normalizeUserData(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...EMPTY_DATA,
    ...source,
    expenses: Array.isArray(source.expenses) ? source.expenses : [],
    worklogs: Array.isArray(source.worklogs) ? source.worklogs : [],
    birthdays: Array.isArray(source.birthdays) ? source.birthdays : [],
    savings: Array.isArray(source.savings) ? source.savings : [],
    accounts: Array.isArray(source.accounts) ? source.accounts : [],
    settings: source.settings && typeof source.settings === 'object' ? source.settings : {}
  };
}

class PostgresStorage {
  constructor(connectionString) {
    const isLocal = connectionString.includes('localhost');
    let normalizedConnectionString = connectionString;

    if (!isLocal) {
      const databaseUrl = new URL(connectionString);
      // `pg` lets sslmode from the URL override the explicit ssl object. Aiven's
      // free tier uses its own CA, so remove URL-level SSL flags and keep the
      // encrypted connection configured below.
      databaseUrl.searchParams.delete('sslmode');
      databaseUrl.searchParams.delete('uselibpqcompat');
      normalizedConnectionString = databaseUrl.toString();
    }

    this.pool = new Pool({
      connectionString: normalizedConnectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS user_data (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        revision BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, workspace_id)
      );
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL,
        subscription JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
        ON push_subscriptions(user_id, workspace_id);
    `);
    await this.pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
  }

  async createUser({ email, displayName, passwordHash }) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO users (id, email, display_name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name AS "displayName", created_at AS "createdAt"`,
      [id, email, displayName, passwordHash]
    );
    return result.rows[0];
  }

  async findUserByEmail(email) {
    const result = await this.pool.query(
      `SELECT id, email, display_name AS "displayName", password_hash AS "passwordHash",
              created_at AS "createdAt"
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  async findUserById(id) {
    const result = await this.pool.query(
      `SELECT id, email, display_name AS "displayName", created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async updateUserDisplayName(id, displayName) {
    const result = await this.pool.query(
      `UPDATE users
       SET display_name = $2
       WHERE id = $1
       RETURNING id, email, display_name AS "displayName", created_at AS "createdAt"`,
      [id, displayName]
    );
    return result.rows[0] || null;
  }

  async createSession(tokenHash, userId, expiresAt) {
    await this.pool.query(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [tokenHash, userId, expiresAt]
    );
  }

  async getSession(tokenHash) {
    const result = await this.pool.query(
      `SELECT s.user_id AS "userId", s.expires_at AS "expiresAt",
              u.email, u.display_name AS "displayName"
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  async deleteSession(tokenHash) {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async getUserData(userId, workspaceId) {
    const id = normalizeWorkspaceId(workspaceId);
    const result = await this.pool.query(
      `SELECT data, revision, updated_at AS "updatedAt"
       FROM user_data WHERE user_id = $1 AND workspace_id = $2`,
      [userId, id]
    );
    if (!result.rows[0]) {
      return { data: normalizeUserData(), revision: 0, updatedAt: null };
    }
    return {
      data: normalizeUserData(result.rows[0].data),
      revision: Number(result.rows[0].revision),
      updatedAt: result.rows[0].updatedAt
    };
  }

  async saveUserData(userId, workspaceId, data, expectedRevision) {
    const id = normalizeWorkspaceId(workspaceId);
    const normalized = normalizeUserData(data);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT revision FROM user_data
         WHERE user_id = $1 AND workspace_id = $2 FOR UPDATE`,
        [userId, id]
      );
      const currentRevision = existing.rows[0] ? Number(existing.rows[0].revision) : 0;
      if (expectedRevision !== null && expectedRevision !== currentRevision) {
        await client.query('ROLLBACK');
        return { conflict: true, current: await this.getUserData(userId, id) };
      }
      const nextRevision = currentRevision + 1;
      const result = await client.query(
        `INSERT INTO user_data (user_id, workspace_id, data, revision, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, NOW())
         ON CONFLICT (user_id, workspace_id) DO UPDATE
         SET data = EXCLUDED.data, revision = EXCLUDED.revision, updated_at = NOW()
         RETURNING revision, updated_at AS "updatedAt"`,
        [userId, id, JSON.stringify(normalized), nextRevision]
      );
      await client.query('COMMIT');
      return {
        conflict: false,
        data: normalized,
        revision: Number(result.rows[0].revision),
        updatedAt: result.rows[0].updatedAt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertSubscription(userId, workspaceId, subscription) {
    await this.pool.query(
      `INSERT INTO push_subscriptions (endpoint, user_id, workspace_id, subscription)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id, workspace_id = EXCLUDED.workspace_id,
           subscription = EXCLUDED.subscription, updated_at = NOW()`,
      [subscription.endpoint, userId, normalizeWorkspaceId(workspaceId), JSON.stringify(subscription)]
    );
  }

  async deleteSubscription(endpoint) {
    await this.pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  }

  async getUserSubscriptions(userId, workspaceId) {
    const result = await this.pool.query(
      `SELECT subscription FROM push_subscriptions
       WHERE user_id = $1 AND workspace_id = $2`,
      [userId, normalizeWorkspaceId(workspaceId)]
    );
    return result.rows.map(row => row.subscription);
  }

  async listReminderTargets() {
    const result = await this.pool.query(`
      SELECT d.user_id AS "userId", d.workspace_id AS "workspaceId", d.data,
             COALESCE(
               json_agg(s.subscription) FILTER (WHERE s.endpoint IS NOT NULL),
               '[]'::json
             ) AS subscriptions
      FROM user_data d
      LEFT JOIN push_subscriptions s
        ON s.user_id = d.user_id AND s.workspace_id = d.workspace_id
      GROUP BY d.user_id, d.workspace_id, d.data
    `);
    return result.rows.map(row => ({
      ...row,
      data: normalizeUserData(row.data),
      subscriptions: row.subscriptions || []
    }));
  }

  async stats(userId, workspaceId) {
    const [dataResult, subscriptionResult] = await Promise.all([
      this.getUserData(userId, workspaceId),
      this.getUserSubscriptions(userId, workspaceId)
    ]);
    return {
      subscriptions: subscriptionResult.length,
      birthdays: dataResult.data.birthdays.length,
      revision: dataResult.revision,
      lastSync: dataResult.updatedAt
    };
  }
}

class MemoryStorage {
  constructor() {
    this.users = new Map();
    this.userByEmail = new Map();
    this.sessions = new Map();
    this.data = new Map();
    this.subscriptions = new Map();
  }

  async init() {}

  async createUser({ email, displayName, passwordHash }) {
    if (this.userByEmail.has(email)) {
      const error = new Error('duplicate email');
      error.code = '23505';
      throw error;
    }
    const user = { id: randomUUID(), email, displayName, passwordHash, createdAt: new Date() };
    this.users.set(user.id, user);
    this.userByEmail.set(email, user.id);
    return { id: user.id, email, displayName, createdAt: user.createdAt };
  }

  async findUserByEmail(email) {
    const id = this.userByEmail.get(email);
    return id ? this.users.get(id) : null;
  }

  async findUserById(id) {
    const user = this.users.get(id);
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async updateUserDisplayName(id, displayName) {
    const user = this.users.get(id);
    if (!user) return null;
    user.displayName = displayName;
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async createSession(tokenHash, userId, expiresAt) {
    this.sessions.set(tokenHash, { userId, expiresAt });
  }

  async getSession(tokenHash) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= new Date()) return null;
    const user = await this.findUserById(session.userId);
    return user ? { userId: user.id, expiresAt: session.expiresAt, ...user } : null;
  }

  async deleteSession(tokenHash) {
    this.sessions.delete(tokenHash);
  }

  _key(userId, workspaceId) {
    return `${userId}:${normalizeWorkspaceId(workspaceId)}`;
  }

  async getUserData(userId, workspaceId) {
    const item = this.data.get(this._key(userId, workspaceId));
    return item
      ? { ...item, data: normalizeUserData(item.data) }
      : { data: normalizeUserData(), revision: 0, updatedAt: null };
  }

  async saveUserData(userId, workspaceId, data, expectedRevision) {
    const key = this._key(userId, workspaceId);
    const current = await this.getUserData(userId, workspaceId);
    if (expectedRevision !== null && expectedRevision !== current.revision) {
      return { conflict: true, current };
    }
    const saved = {
      data: normalizeUserData(data),
      revision: current.revision + 1,
      updatedAt: new Date()
    };
    this.data.set(key, saved);
    return { conflict: false, ...saved };
  }

  async upsertSubscription(userId, workspaceId, subscription) {
    this.subscriptions.set(subscription.endpoint, {
      userId,
      workspaceId: normalizeWorkspaceId(workspaceId),
      subscription
    });
  }

  async deleteSubscription(endpoint) {
    this.subscriptions.delete(endpoint);
  }

  async getUserSubscriptions(userId, workspaceId) {
    const id = normalizeWorkspaceId(workspaceId);
    return [...this.subscriptions.values()]
      .filter(item => item.userId === userId && item.workspaceId === id)
      .map(item => item.subscription);
  }

  async listReminderTargets() {
    const targets = [];
    for (const [key, item] of this.data.entries()) {
      const separator = key.lastIndexOf(':');
      const userId = key.slice(0, separator);
      const workspaceId = key.slice(separator + 1);
      targets.push({
        userId,
        workspaceId,
        data: normalizeUserData(item.data),
        subscriptions: await this.getUserSubscriptions(userId, workspaceId)
      });
    }
    return targets;
  }

  async stats(userId, workspaceId) {
    const [dataResult, subscriptions] = await Promise.all([
      this.getUserData(userId, workspaceId),
      this.getUserSubscriptions(userId, workspaceId)
    ]);
    return {
      subscriptions: subscriptions.length,
      birthdays: dataResult.data.birthdays.length,
      revision: dataResult.revision,
      lastSync: dataResult.updatedAt
    };
  }
}

function createStorage() {
  if (process.env.DATABASE_URL) {
    return new PostgresStorage(process.env.DATABASE_URL);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required in production');
  }
  console.warn('DATABASE_URL is not set; using temporary in-memory storage for local development.');
  return new MemoryStorage();
}

module.exports = {
  createStorage,
  normalizeUserData,
  normalizeWorkspaceId
};
