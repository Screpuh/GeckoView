const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// background.js expects settings.js's helpers as globals (loaded via importScripts in the real
// extension) and chrome.*/fetch from the browser runtime. Loading both files into one controlled
// VM sandbox with chrome/fetch mocked exercises the actual fetchCoinNews/fetchCoinInsights
// handling in background.js, not a reimplementation of it.
function createSandbox({ apiKey = '', apiKeyType = 'demo', fetchImpl } = {}) {
    const storage = { apiKey, apiKeyType };
    const calls = [];
    const sandbox = {
        console,
        fetch: (url, options) => {
            calls.push({ url, options });
            return fetchImpl ? fetchImpl(url, options) : Promise.reject(new Error('fetchImpl not provided'));
        },
        chrome: {
            runtime: { onMessage: { addListener: (fn) => { sandbox.listener = fn; } } },
            storage: {
                sync: { get: (defaults, cb) => cb(Object.assign({}, defaults, storage)) },
                onChanged: { addListener: () => {} }
            }
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../settings.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8'), sandbox);
    sandbox.calls = calls;
    return sandbox;
}

function send(sandbox, message) {
    return new Promise(resolve => sandbox.listener(message, null, resolve));
}

test('fetchCoinNews shows a Pro upsell without fetching when there is no key', async () => {
    const sandbox = createSandbox({ apiKey: '', apiKeyType: 'demo' });
    const result = await send(sandbox, { action: 'fetchCoinNews', coinId: 'bitcoin' });
    assert.equal(result.success, false);
    assert.equal(result.requiresPro, true);
    assert.equal(sandbox.calls.length, 0);
});

test('fetchCoinNews shows a Pro upsell without fetching for a Demo-type key (Demo can’t use this endpoint at all)', async () => {
    const sandbox = createSandbox({ apiKey: 'my-demo-key', apiKeyType: 'demo' });
    const result = await send(sandbox, { action: 'fetchCoinNews', coinId: 'bitcoin' });
    assert.equal(result.success, false);
    assert.equal(result.requiresPro, true);
    assert.equal(sandbox.calls.length, 0);
});

test('fetchCoinNews calls the Pro news endpoint with coin_id and the Pro header for a Pro key', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-pro-key', apiKeyType: 'pro',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve([{ title: 'A', url: 'https://x', source_name: 'S' }]) })
    });
    const result = await send(sandbox, { action: 'fetchCoinNews', coinId: 'bitcoin' });
    assert.equal(result.success, true);
    assert.deepEqual(result.data, [{ title: 'A', url: 'https://x', source_name: 'S' }]);
    assert.equal(sandbox.calls.length, 1);
    assert.equal(sandbox.calls[0].url, 'https://pro-api.coingecko.com/api/v3/news?coin_id=bitcoin&per_page=10');
    // Compared field-by-field, not via deepEqual: the options object is created inside the VM
    // sandbox's separate realm, so it has a different Object constructor than this test file's -
    // deepStrictEqual (what assert/strict's deepEqual uses) fails on that even when the plain
    // field values are identical.
    assert.equal(sandbox.calls[0].options.headers['x-cg-pro-api-key'], 'my-pro-key');
});

test('fetchCoinNews caches results per coin id (a second call for the same coin does not re-fetch)', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-pro-key', apiKeyType: 'pro',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve([]) })
    });
    await send(sandbox, { action: 'fetchCoinNews', coinId: 'bitcoin' });
    await send(sandbox, { action: 'fetchCoinNews', coinId: 'bitcoin' });
    assert.equal(sandbox.calls.length, 1);
});

test('fetchCoinInsights calls the Pro insights endpoint for a Pro key', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-pro-key', apiKeyType: 'pro',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve([{ title: 'T', description: 'D' }]) })
    });
    const result = await send(sandbox, { action: 'fetchCoinInsights', coinId: 'ethereum' });
    assert.equal(result.success, true);
    assert.equal(sandbox.calls[0].url, 'https://pro-api.coingecko.com/api/v3/insights?coin_id=ethereum&per_page=10');
});

test('fetchCoinNews surfaces the friendly rate-limit message for a 429 response', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-pro-key', apiKeyType: 'pro',
        fetchImpl: () => Promise.resolve({ status: 429, json: () => Promise.resolve({}) })
    });
    const result = await send(sandbox, { action: 'fetchCoinNews', coinId: 'bitcoin' });
    assert.equal(result.success, false);
    assert.ok(result.error.toLowerCase().includes('rate limit'));
});

test('fetchCoinNews resolves with an empty list, not an error, when there are no articles', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-pro-key', apiKeyType: 'pro',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve([]) })
    });
    const result = await send(sandbox, { action: 'fetchCoinNews', coinId: 'bitcoin' });
    assert.equal(result.success, true);
    assert.deepEqual(result.data, []);
});

test('fetchCoinInsights reports an unexpected-response error for a non-array body that slips past validation', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-pro-key', apiKeyType: 'pro',
        fetchImpl: () => Promise.resolve({ status: 400, json: () => Promise.resolve({ status: { error_code: 400, error_message: 'bad request' } }) })
    });
    const result = await send(sandbox, { action: 'fetchCoinInsights', coinId: 'bitcoin' });
    assert.equal(result.success, false);
    assert.ok(result.error);
});
