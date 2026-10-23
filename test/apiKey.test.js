const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCoinGeckoFetchOptions, getCoinGeckoBaseUrl } = require('../background.js');

test('buildCoinGeckoFetchOptions returns undefined (plain anonymous fetch) when there is no key', () => {
    assert.equal(buildCoinGeckoFetchOptions('', 'demo'), undefined);
    assert.equal(buildCoinGeckoFetchOptions(null, 'demo'), undefined);
    assert.equal(buildCoinGeckoFetchOptions(undefined, 'demo'), undefined);
});

test('buildCoinGeckoFetchOptions returns undefined for a key that is only whitespace', () => {
    assert.equal(buildCoinGeckoFetchOptions('   ', 'demo'), undefined);
});

test('buildCoinGeckoFetchOptions attaches a demo key under x-cg-demo-api-key', () => {
    assert.deepEqual(buildCoinGeckoFetchOptions('my-demo-key', 'demo'), {
        headers: { 'x-cg-demo-api-key': 'my-demo-key' }
    });
});

test('buildCoinGeckoFetchOptions attaches a pro key under x-cg-pro-api-key, not the demo header', () => {
    assert.deepEqual(buildCoinGeckoFetchOptions('my-pro-key', 'pro'), {
        headers: { 'x-cg-pro-api-key': 'my-pro-key' }
    });
});

test('buildCoinGeckoFetchOptions treats a missing/unknown apiKeyType as demo', () => {
    assert.deepEqual(buildCoinGeckoFetchOptions('my-key', undefined), {
        headers: { 'x-cg-demo-api-key': 'my-key' }
    });
});

test('buildCoinGeckoFetchOptions trims surrounding whitespace from the key', () => {
    assert.deepEqual(buildCoinGeckoFetchOptions('  my-demo-key  ', 'demo'), {
        headers: { 'x-cg-demo-api-key': 'my-demo-key' }
    });
});

test('getCoinGeckoBaseUrl returns the free/Demo host by default', () => {
    assert.equal(getCoinGeckoBaseUrl('demo'), 'https://api.coingecko.com/api/v3');
    assert.equal(getCoinGeckoBaseUrl(undefined), 'https://api.coingecko.com/api/v3');
    assert.equal(getCoinGeckoBaseUrl('something-unrecognized'), 'https://api.coingecko.com/api/v3');
});

test('getCoinGeckoBaseUrl returns the Pro host only for apiKeyType "pro"', () => {
    assert.equal(getCoinGeckoBaseUrl('pro'), 'https://pro-api.coingecko.com/api/v3');
});
