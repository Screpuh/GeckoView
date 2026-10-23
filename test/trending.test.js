const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// Same VM-sandbox technique as exchanges.test.js: background.js expects settings.js's helpers as
// globals (loaded via importScripts in the real extension) and chrome.*/fetch from the browser
// runtime, so loading both files into a controlled sandbox with those mocked exercises the real
// fetchTrending handling in background.js, not a reimplementation of it.
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

// Real /search/trending shape (trimmed): coins is an array of { item: {...} } wrappers, not a
// plain array of coins - background.js is responsible for unwrapping that, see
// handleTrendingRequest().
function trendingFixture(n) {
    return {
        coins: Array.from({ length: n }, (_, i) => ({
            item: {
                id: `coin-${i}`,
                name: `Coin ${i}`,
                symbol: `c${i}`,
                market_cap_rank: i + 1,
                thumb: `https://example.com/${i}.png`,
                data: { price: i + 1, price_change_percentage_24h: { usd: i } }
            }
        })),
        nfts: [],
        categories: []
    };
}

test('fetchTrending works keyless (no Pro-gating, like Exchanges)', async () => {
    const sandbox = createSandbox({
        apiKey: '', apiKeyType: 'demo',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve(trendingFixture(3)) })
    });
    const result = await send(sandbox, { action: 'fetchTrending' });
    assert.equal(result.success, true);
    assert.equal(result.data.length, 3);
});

test('fetchTrending unwraps each coins[].item into a plain coin array', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve(trendingFixture(1)) })
    });
    const result = await send(sandbox, { action: 'fetchTrending' });
    assert.equal(result.data[0].id, 'coin-0');
    assert.equal(result.data[0].name, 'Coin 0');
    assert.equal(result.data[0].data.price, 1);
});

test('fetchTrending calls /search/trending on the correct host for the key type, with no coin id in the URL', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-demo-key', apiKeyType: 'demo',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve(trendingFixture(1)) })
    });
    await send(sandbox, { action: 'fetchTrending' });
    assert.equal(sandbox.calls.length, 1);
    assert.equal(sandbox.calls[0].url, 'https://api.coingecko.com/api/v3/search/trending');
    assert.equal(sandbox.calls[0].options.headers['x-cg-demo-api-key'], 'my-demo-key');
});

test('fetchTrending uses the Pro host/header for a Pro key, same as the other endpoints', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-pro-key', apiKeyType: 'pro',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve(trendingFixture(1)) })
    });
    await send(sandbox, { action: 'fetchTrending' });
    assert.equal(sandbox.calls[0].url, 'https://pro-api.coingecko.com/api/v3/search/trending');
    assert.equal(sandbox.calls[0].options.headers['x-cg-pro-api-key'], 'my-pro-key');
});

test('fetchTrending caches the single shared result (a second call does not re-fetch)', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve(trendingFixture(2)) })
    });
    await send(sandbox, { action: 'fetchTrending' });
    await send(sandbox, { action: 'fetchTrending' });
    assert.equal(sandbox.calls.length, 1);
});

test('fetchTrending surfaces the friendly rate-limit message for a 429 response', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 429, json: () => Promise.resolve({}) })
    });
    const result = await send(sandbox, { action: 'fetchTrending' });
    assert.equal(result.success, false);
    assert.ok(result.error.toLowerCase().includes('rate limit'));
});

test('fetchTrending reports an unexpected-response error when the body has no coins array', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 400, json: () => Promise.resolve({ status: { error_code: 400, error_message: 'bad request' } }) })
    });
    const result = await send(sandbox, { action: 'fetchTrending' });
    assert.equal(result.success, false);
    assert.ok(result.error);
});
