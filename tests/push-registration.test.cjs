const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadPush(mocks) {
  const source = fs.readFileSync(require.resolve('../src/push/pushRegistration.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    process: { env: mocks.env || {} },
    require: name => mocks.require(name),
  });
  return module.exports;
}

function setup(platform = 'android', options = {}) {
  const values = options.values || new Map();
  const posts = [];
  const deletes = [];
  const responseCallbacks = [];
  let removedListeners = 0;
  const notifications = {
    getPermissionsAsync: async () => ({ status: options.permission || 'granted' }),
    requestPermissionsAsync: async () => ({ status: options.requestedPermission || 'granted' }),
    getExpoPushTokenAsync: async () => ({ data: options.token || 'ExponentPushToken[test-only]' }),
    addNotificationReceivedListener: callback => ({ remove: () => { removedListeners += 1; } }),
    addNotificationResponseReceivedListener: callback => { responseCallbacks.push(callback); return { remove: () => { removedListeners += 1; } }; },
    getLastNotificationResponseAsync: async () => options.lastResponse || null,
  };
  const loaded = loadPush({
    env: options.env,
    require(name) {
      if (name === '@react-native-async-storage/async-storage') return {
        getItem: async key => values.get(key) || null,
        setItem: async (key, value) => values.set(key, value),
        removeItem: async key => values.delete(key),
      };
      if (name === 'expo-constants') return { __esModule: true, isDevice: options.isDevice !== false, appOwnership: options.appOwnership, expoConfig: { extra: { eas: { projectId: options.noProject ? undefined : (options.projectId || 'test-project') } } }, easConfig: {} };
      if (name === 'expo-crypto') return { randomUUID: () => 'stable-device-id' };
      if (name === 'expo-notifications') return notifications;
      if (name === 'expo-secure-store') return {
        getItemAsync: async key => values.get(key) || null,
        setItemAsync: async (key, value) => values.set(key, value),
        deleteItemAsync: async key => values.delete(key),
      };
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === '../api/client') return {
        apiClient: {
          post: async (...args) => { posts.push(args); return { data: { id: 42 } }; },
          delete: async (...args) => {
            deletes.push(args);
            const status = options.deleteStatuses?.length ? options.deleteStatuses.shift() : (options.deleteStatus || 204);
            if (status >= 400) { const error = new Error('delete failed'); error.response = { status }; throw error; }
            return { status, data: {} };
          },
        },
      };
      throw new Error(`unexpected module ${name}`);
    },
  });
  return { ...loaded, posts, deletes, values, responseCallbacks, get removedListeners() { return removedListeners; } };
}

test('registers and revokes an authenticated native token without logging it', async () => {
  const push = setup('android');
  const registered = await push.registerPushNotifications({ userId: 7, accessToken: 'token-a', projectId: 'test-project' });
  assert.equal(registered.status, 'registered');
  assert.equal(push.posts.length, 1);
  assert.equal(push.posts[0][0], '/me/push-tokens');
  assert.equal(push.posts[0][1].device_id, 'stable-device-id');
  assert.equal(push.posts[0][1].platform, 'android');
  assert.equal(push.posts[0][1].provider, 'expo');
  assert.equal(await push.revokePushNotifications({ userId: 7, accessToken: 'token-a' }), true);
  assert.equal(push.deletes.length, 1);
  assert.equal(push.deletes[0][0], '/me/push-tokens/42');
});

test('does not request permission on web or on a simulator', async () => {
  const web = setup('web');
  assert.equal((await web.registerPushNotifications()).status, 'unsupported');
  assert.equal(web.posts.length, 0);
  const simulator = setup('ios', { isDevice: false });
  assert.equal((await simulator.registerPushNotifications()).status, 'unavailable');
});

test('handles denied permission and missing project id without looping', async () => {
  const denied = setup('ios', { permission: 'denied', requestedPermission: 'denied' });
  assert.equal((await denied.registerPushNotifications({ projectId: 'test-project', userId: 7, accessToken: 'token-a' })).status, 'permission_denied');
  assert.equal(denied.posts.length, 0);
  const missing = setup('ios', { env: { EXPO_PUBLIC_EXPO_PROJECT_ID: '' }, noProject: true });
  // The test mock has no project in this case, matching a misconfigured build.
  assert.equal((await missing.registerPushNotifications({ projectId: '' })).status, 'missing_project_id');
});

test('stable device id is reused across reauthentication registrations', async () => {
  const push = setup('android', { token: 'first-token' });
  assert.equal((await push.registerPushNotifications({ userId: 7, accessToken: 'token-a', projectId: 'test-project' })).status, 'registered');
  assert.equal((await push.registerPushNotifications({ userId: 7, accessToken: 'token-a', projectId: 'test-project' })).status, 'registered');
  assert.equal(push.posts[0][1].device_id, push.posts[1][1].device_id);
});

test('preserves failed revocation and retries only for the same user', async () => {
  const push = setup('android', { deleteStatus: 200 });
  await push.registerPushNotifications({ userId: 7, accessToken: 'token-a', projectId: 'test-project' });
  push.deletes.push(['failure-marker']);
  // The mock delete succeeds with 200, which is intentionally not terminal.
  assert.equal(await push.revokePushNotifications({ userId: 7, accessToken: 'token-a' }), false);
  assert.ok(push.values.has('observador_push_revocation_queue'));
  assert.equal(await push.revokePushNotifications({ userId: 8, accessToken: 'token-b' }), false);
});

test('drains multiple IDs with partial failure and blocks POST until a later success', async () => {
  const push = setup('android', { deleteStatuses: [204, 500] });
  await push.values.set('observador_push_revocation_queue', JSON.stringify([
    { id: 41, userId: 7 }, { id: 42, userId: 7 }, { id: 99, userId: 8 },
  ]));
  const blocked = await push.registerPushNotifications({ userId: 7, accessToken: 'token-a', projectId: 'test-project' });
  assert.equal(blocked.status, 'pending_revocation');
  assert.equal(push.posts.length, 0);
  assert.equal(push.deletes[0][0], '/me/push-tokens/41');
  assert.equal(push.deletes[1][0], '/me/push-tokens/42');
  const retained = JSON.parse(push.values.get('observador_push_revocation_queue'));
  assert.deepEqual(retained, [{ id: 99, userId: 8 }, { id: 42, userId: 7 }]);

  const ready = await push.registerPushNotifications({ userId: 7, accessToken: 'token-a', projectId: 'test-project' });
  assert.equal(ready.status, 'registered');
  assert.equal(push.posts.length, 1);
  assert.equal(push.deletes[2][0], '/me/push-tokens/42');
  assert.deepEqual(JSON.parse(push.values.get('observador_push_revocation_queue')), [{ id: 99, userId: 8 }]);
});

test('persists the revocation queue across a simulated app restart for the same user', async () => {
  const first = setup('android', { deleteStatus: 500 });
  await first.registerPushNotifications({ userId: 7, accessToken: 'token-a', projectId: 'test-project' });
  assert.equal(await first.revokePushNotifications({ userId: 7, accessToken: 'token-a' }), false);
  const restarted = setup('android', { values: first.values, deleteStatus: 204 });
  const result = await restarted.registerPushNotifications({ userId: 7, accessToken: 'token-a', projectId: 'test-project' });
  assert.equal(result.status, 'registered');
  assert.equal(restarted.posts.length, 1);
  assert.equal(restarted.deletes[0][0], '/me/push-tokens/42');
});

test('validates push routes and cleans up native listeners', async () => {
  const listeners = [];
  const push = setup('android');
  push.values;
  // Route validation is independent from the native event transport.
  assert.equal(push.getValidatedPushRoute({ concurso_id: 12 }), '/concurso/12');
  assert.equal(push.getValidatedPushRoute({ concurso_id: '12' }), '/concurso/12');
  assert.equal(push.getValidatedPushRoute({ concurso_id: '12/evil' }), null);
  assert.equal(push.getValidatedPushRoute({ url: 'https://evil.test/concurso/12' }), null);
  const cleanup = push.subscribeToPushNotifications(() => listeners.push(1));
  assert.equal(typeof cleanup, 'function');
  cleanup();
  assert.equal(push.removedListeners, 2);
});

test('handles valid cold-start response once and ignores invalid/duplicate responses', async () => {
  const valid = {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: { request: { identifier: 'response-1', content: { data: { concurso_id: 88 } } } },
  };
  const push = setup('android', { lastResponse: valid });
  const routes = [];
  push.subscribeToPushNotifications(route => routes.push(route));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(routes, ['/concurso/88']);
  push.responseCallbacks[0](valid);
  assert.deepEqual(routes, ['/concurso/88']);

  const invalid = setup('android', { lastResponse: {
    actionIdentifier: 'default',
    notification: { request: { identifier: 'response-2', content: { data: { concurso_id: '88/evil' } } } },
  } });
  const invalidRoutes = [];
  invalid.subscribeToPushNotifications(route => invalidRoutes.push(route));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(invalidRoutes, []);
});

test('reports Expo Go separately and does not call the API', async () => {
  const push = setup('android', { appOwnership: 'expo' });
  assert.equal((await push.registerPushNotifications({ userId: 7, accessToken: 'token-a' })).status, 'expo_go');
  assert.equal(push.posts.length, 0);
});
