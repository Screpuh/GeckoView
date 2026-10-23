const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// Same VM-sandbox technique as newsInsights.test.js: background.js expects settings.js's helpers
// as globals (loaded via importScripts in the real extension) and chrome.*/fetch from the browser
// runtime, so loading both files into a controlled sandbox with those mocked exercises the real
// fetchCoinExchanges handling in background.js, not a reimplementation of it.
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

function tickerFixture(n) {
    return Array.from({ length: n }, (_, i) => ({
        market: { name: `Exchange ${i}` },
        base: 'BTC',
        target: 'USDT',
        converted_last: { usd: 81000 + i },
        converted_volume: { usd: (100 - i) * 1000000 },
        trade_url: `https://example.com/${i}`
    }));
}

test('fetchCoinExchanges works keyless (no Pro-gating, unlike News/Insights)', async () => {
    const sandbox = createSandbox({
        apiKey: '', apiKeyType: 'demo',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve({ name: 'Bitcoin', tickers: tickerFixture(3) }) })
    });
    const result = await send(sandbox, { action: 'fetchCoinExchanges', coinId: 'bitcoin' });
    assert.equal(result.success, true);
    assert.equal(result.data.length, 3);
});

test('fetchCoinExchanges calls /coins/{id}/tickers?order=volume_desc on the correct host for the key type', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-demo-key', apiKeyType: 'demo',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve({ name: 'Bitcoin', tickers: tickerFixture(1) }) })
    });
    await send(sandbox, { action: 'fetchCoinExchanges', coinId: 'bitcoin' });
    assert.equal(sandbox.calls.length, 1);
    assert.equal(sandbox.calls[0].url, 'https://api.coingecko.com/api/v3/coins/bitcoin/tickers?order=volume_desc');
    assert.equal(sandbox.calls[0].options.headers['x-cg-demo-api-key'], 'my-demo-key');
});

test('fetchCoinExchanges uses the Pro host/header for a Pro key, same as the main coin fetch', async () => {
    const sandbox = createSandbox({
        apiKey: 'my-pro-key', apiKeyType: 'pro',
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve({ name: 'Bitcoin', tickers: tickerFixture(1) }) })
    });
    await send(sandbox, { action: 'fetchCoinExchanges', coinId: 'bitcoin' });
    assert.equal(sandbox.calls[0].url, 'https://pro-api.coingecko.com/api/v3/coins/bitcoin/tickers?order=volume_desc');
    assert.equal(sandbox.calls[0].options.headers['x-cg-pro-api-key'], 'my-pro-key');
});

test('fetchCoinExchanges caps results at 10 even when CoinGecko returns more', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve({ name: 'Bitcoin', tickers: tickerFixture(37) }) })
    });
    const result = await send(sandbox, { action: 'fetchCoinExchanges', coinId: 'bitcoin' });
    assert.equal(result.success, true);
    assert.equal(result.data.length, 10);
});

test('fetchCoinExchanges caches results per coin id (a second call for the same coin does not re-fetch)', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve({ name: 'Bitcoin', tickers: tickerFixture(2) }) })
    });
    await send(sandbox, { action: 'fetchCoinExchanges', coinId: 'bitcoin' });
    await send(sandbox, { action: 'fetchCoinExchanges', coinId: 'bitcoin' });
    assert.equal(sandbox.calls.length, 1);
});

test('fetchCoinExchanges resolves with an empty list, not an error, when there are no tickers', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 200, json: () => Promise.resolve({ name: 'Obscure Coin', tickers: [] }) })
    });
    const result = await send(sandbox, { action: 'fetchCoinExchanges', coinId: 'obscure-coin' });
    assert.equal(result.success, true);
    assert.deepEqual(result.data, []);
});

test('fetchCoinExchanges surfaces the friendly rate-limit message for a 429 response', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 429, json: () => Promise.resolve({}) })
    });
    const result = await send(sandbox, { action: 'fetchCoinExchanges', coinId: 'bitcoin' });
    assert.equal(result.success, false);
    assert.ok(result.error.toLowerCase().includes('rate limit'));
});

test('fetchCoinExchanges reports an unexpected-response error when the body has no tickers array', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 400, json: () => Promise.resolve({ status: { error_code: 400, error_message: 'bad request' } }) })
    });
    const result = await send(sandbox, { action: 'fetchCoinExchanges', coinId: 'bitcoin' });
    assert.equal(result.success, false);
    assert.ok(result.error);
});
