const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getCachedCoinData, setCachedCoinData, COIN_DATA_CACHE_TTL_MS } = require('../background.js');

// Each test uses its own coin id as the cache key, since coinDataCache is a module-level
// singleton shared across every test in this file (and whatever else requires background.js).

test('getCachedCoinData returns null for a coin that was never cached', () => {
    assert.equal(getCachedCoinData('never-cached-coin'), null);
});

test('setCachedCoinData then getCachedCoinData returns the same data back', () => {
    const data = { id: 'bitcoin', name: 'Bitcoin' };
    setCachedCoinData('cache-roundtrip-coin', data, 1000);
    assert.deepEqual(getCachedCoinData('cache-roundtrip-coin', 1000), data);
});

test('a cached entry is still returned just before the TTL expires', () => {
    const data = { id: 'ethereum' };
    setCachedCoinData('cache-fresh-coin', data, 1000);
    assert.deepEqual(getCachedCoinData('cache-fresh-coin', 1000 + COIN_DATA_CACHE_TTL_MS), data);
});

test('a cached entry expires and is evicted once the TTL has passed', () => {
    const data = { id: 'ethereum' };
    setCachedCoinData('cache-expired-coin', data, 1000);
    assert.equal(getCachedCoinData('cache-expired-coin', 1000 + COIN_DATA_CACHE_TTL_MS + 1), null);
    // confirm it was actually evicted, not just reported stale: re-querying at the original
    // timestamp (which would have been a hit before expiry) is now also a miss
    assert.equal(getCachedCoinData('cache-expired-coin', 1000), null);
});
