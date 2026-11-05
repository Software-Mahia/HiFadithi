import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(
  readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

function client({
  url = 'https://staff.example.com',
  dev = false,
  fetch,
} = {}) {
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    process: { env: { EXPO_PUBLIC_API_URL: url } },
    __DEV__: dev,
    fetch,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  return exports.api;
}

test('authenticated requests send bearer credentials and omit cookies', async () => {
  let request;
  const api = client({
    fetch: async (...args) => {
      request = args;
      return Response.json({ user: { role: 'researcher' } });
    },
  });
  const result = await api('/api/auth/me/', { token: 'test-session' });
  assert.equal(result.user.role, 'researcher');
  assert.equal(request[0], 'https://staff.example.com/api/auth/me/');
  assert.equal(request[1].headers.Authorization, 'Bearer test-session');
  assert.equal(request[1].credentials, 'omit');
  assert.equal(request[1].method, 'GET');
});

test('sign-in sends JSON without adding credentials to the URL', async () => {
  let request;
  const api = client({
    fetch: async (...args) => {
      request = args;
      return Response.json({ token: 'test-session' });
    },
  });
  await api('/api/auth/sign-in/', {
    body: { email: 'staff@example.com', password: 'test-password' },
  });
  assert.equal(request[1].method, 'POST');
  assert.equal(request[1].headers['Content-Type'], 'application/json');
  assert.equal(request[1].headers.Authorization, undefined);
  assert.equal(JSON.parse(request[1].body).password, 'test-password');
  assert.ok(!request[0].includes('test-password'));
});

test('release builds refuse HTTP before sending a password', async () => {
  const api = client({
    url: 'http://example.com',
    fetch: () => assert.fail('must not fetch'),
  });
  await assert.rejects(
    api('/api/auth/sign-in/', { body: { password: 'test-password' } }),
    /secure connection/,
  );
});

test('local development allows an emulator HTTP address', async () => {
  const api = client({
    url: 'http://10.0.2.2:8000/',
    dev: true,
    fetch: async (url) => {
      assert.equal(url, 'http://10.0.2.2:8000/api/auth/me/');
      return Response.json({ ok: true });
    },
  });
  assert.equal((await api('/api/auth/me/')).ok, true);
});

test('authentication and throttle errors retain their HTTP status', async () => {
  for (const status of [401, 403, 429]) {
    const api = client({
      fetch: async () =>
        Response.json({ error: { message: 'Request denied.' } }, { status }),
    });
    await assert.rejects(
      api('/api/auth/me/'),
      (error) => error.status === status && error.message === 'Request denied.',
    );
  }
});

test('network failures and malformed responses produce a retryable message', async () => {
  for (const fetch of [
    async () => {
      throw new Error('internal connection detail');
    },
    async () => new Response('<html>error</html>'),
  ]) {
    await assert.rejects(
      client({ fetch })('/api/auth/me/'),
      /Check your connection and try again/,
    );
  }
});

test('missing configuration fails before any request', async () => {
  await assert.rejects(
    client({ url: '', fetch: () => assert.fail('must not fetch') })(
      '/api/auth/me/',
    ),
    /not configured/,
  );
});
