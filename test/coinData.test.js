const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// Same VM-sandbox technique as exchanges.test.js/trending.test.js: background.js expects
// settings.js's helpers as globals and chrome.*/fetch from the browser runtime, so loading both
// files into a controlled sandbox with those mocked exercises the real fetchCoinData handling,
// not a reimplementation of it. coinDataCache is a module-level singleton inside that sandbox, so
// each test below uses its own distinct ticker to avoid cross-test cache hits.
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

function searchResponse(coins) {
    return Promise.resolve({ status: 200, json: () => Promise.resolve({ coins }) });
}

test('fetchCoinData resolves via /search, not by guessing the ticker is itself a valid coin id', async () => {
    const sandbox = createSandbox({
        fetchImpl: (url) => {
            if (url.includes('/search?')) {
                return searchResponse([
                    { symbol: 'DOGE', name: 'Dogecoin', market_cap_rank: 12, api_symbol: 'dogecoin' }
                ]);
            }
            if (url.includes('/coins/dogecoin')) {
                return Promise.resolve({
                    status: 200,
                    json: () => Promise.resolve({ id: 'dogecoin', name: 'Dogecoin', market_data: {}, links: {} })
                });
            }
            return Promise.reject(new Error('unexpected url: ' + url));
        }
    });
    const result = await send(sandbox, { action: 'fetchCoinData', coin: 'DOGEUSDT' });
    assert.equal(result.success, true);
    assert.equal(result.data.id, 'dogecoin');
    // no /coins/{ticker} id-guess call should ever be made - only /search then /coins/{resolved id}
    assert.ok(!sandbox.calls.some(c => c.url.includes('/coins/doge?') || c.url.endsWith('/coins/doge')));
});

test('fetchCoinData picks the best-ranked search result, not an unrelated same-symbol token (the real Dogecoin/WOO Network bug)', async () => {
    const sandbox = createSandbox({
        fetchImpl: (url) => {
            if (url.includes('/search?')) {
                // Real-shape fixture: an obscure, unranked "@DOGE" token also matches by symbol.
                return searchResponse([
                    { symbol: '@doge', name: '@DOGE', market_cap_rank: null, api_symbol: 'doge' },
                    { symbol: 'DOGE', name: 'Dogecoin', market_cap_rank: 12, api_symbol: 'dogecoin' }
                ]);
            }
            if (url.includes('/coins/dogecoin')) {
                return Promise.resolve({
                    status: 200,
                    json: () => Promise.resolve({ id: 'dogecoin', name: 'Dogecoin', market_data: {}, links: {} })
                });
            }
            return Promise.reject(new Error('unexpected url: ' + url));
        }
    });
    const result = await send(sandbox, { action: 'fetchCoinData', coin: 'DOGEUSDT' });
    assert.equal(result.success, true);
    assert.equal(result.data.id, 'dogecoin');
});

test('fetchCoinData caches the resolved coin, keyed by the ticker (a second call does not re-fetch)', async () => {
    const sandbox = createSandbox({
        fetchImpl: (url) => {
            if (url.includes('/search?')) {
                return searchResponse([{ symbol: 'ETH', name: 'Ethereum', market_cap_rank: 2, api_symbol: 'ethereum' }]);
            }
            return Promise.resolve({
                status: 200,
                json: () => Promise.resolve({ id: 'ethereum', name: 'Ethereum', market_data: {}, links: {} })
            });
        }
    });
    await send(sandbox, { action: 'fetchCoinData', coin: 'ETHUSDT' });
    await send(sandbox, { action: 'fetchCoinData', coin: 'ETHUSDT' });
    assert.equal(sandbox.calls.length, 2); // one /search + one /coins/{id} - not four
});

test('fetchCoinData reports no match when nothing in the search results actually matches the ticker', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => searchResponse([{ symbol: 'BTC', name: 'Bitcoin', market_cap_rank: 1, api_symbol: 'bitcoin' }])
    });
    const result = await send(sandbox, { action: 'fetchCoinData', coin: 'SOMEUNKNOWNTICKERUSDT' });
    assert.equal(result.success, false);
    assert.ok(result.error);
});

test('fetchCoinData reports no results when the search itself returns nothing', async () => {
    const sandbox = createSandbox({ fetchImpl: () => searchResponse([]) });
    const result = await send(sandbox, { action: 'fetchCoinData', coin: 'NOPEUSDT' });
    assert.equal(result.success, false);
    assert.ok(result.error.toLowerCase().includes('no search results'));
});

test('fetchCoinData surfaces the friendly rate-limit message for a 429 on the search call', async () => {
    const sandbox = createSandbox({
        fetchImpl: () => Promise.resolve({ status: 429, json: () => Promise.resolve({}) })
    });
    const result = await send(sandbox, { action: 'fetchCoinData', coin: 'RATELIMITUSDT' });
    assert.equal(result.success, false);
    assert.ok(result.error.toLowerCase().includes('rate limit'));
});
