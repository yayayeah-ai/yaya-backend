const assert = require('assert/strict');
const { app, storage } = require('../server');

function cookieFrom(response) {
  return response.headers.get('set-cookie').split(';')[0];
}

async function jsonRequest(baseUrl, path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, data: await response.json() };
}

async function run() {
  await storage.init();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const first = await jsonRequest(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { email: 'first@example.com', password: 'password-123', displayName: '第一位用户' }
    });
    assert.equal(first.response.status, 201);
    const firstCookie = cookieFrom(first.response);

    const second = await jsonRequest(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { email: 'second@example.com', password: 'password-456', displayName: '第二位用户' }
    });
    assert.equal(second.response.status, 201);
    const secondCookie = cookieFrom(second.response);

    const saved = await jsonRequest(baseUrl, '/api/data', {
      method: 'PUT',
      cookie: firstCookie,
      body: {
        workspaceId: 'yaya',
        revision: 0,
        data: { expenses: [{ id: 'expense-1', amount: 18 }], birthdays: [{ id: 'birthday-1' }] }
      }
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.data.revision, 1);

    const firstData = await jsonRequest(baseUrl, '/api/data?workspaceId=yaya', { cookie: firstCookie });
    assert.equal(firstData.data.data.expenses.length, 1);
    assert.equal(firstData.data.data.birthdays.length, 1);

    const otherUser = await jsonRequest(baseUrl, '/api/data?workspaceId=yaya', { cookie: secondCookie });
    assert.equal(otherUser.data.revision, 0);
    assert.equal(otherUser.data.data.expenses.length, 0);

    const otherWorkspace = await jsonRequest(baseUrl, '/api/data?workspaceId=xiaoxiao', { cookie: firstCookie });
    assert.equal(otherWorkspace.data.revision, 0);

    const conflict = await jsonRequest(baseUrl, '/api/data', {
      method: 'PUT',
      cookie: firstCookie,
      body: { workspaceId: 'yaya', revision: 0, data: { expenses: [] } }
    });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.data.code, 'SYNC_CONFLICT');
    assert.equal(conflict.data.revision, 1);

    const anonymous = await jsonRequest(baseUrl, '/api/data?workspaceId=yaya');
    assert.equal(anonymous.response.status, 401);
    console.log('Auth, user isolation, workspace isolation, full sync, and conflict checks passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
