const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rankExchangeTickers, KNOWN_EXCHANGE_IDS } = require('../background.js');

function ticker(identifier, volumeUsd, extra = {}) {
    return { market: { identifier, name: identifier }, converted_volume: { usd: volumeUsd }, ...extra };
}

test('ranks known exchanges before unknown ones, regardless of volume', () => {
    const tickers = [
        ticker('some-obscure-exchange', 999999999), // huge volume, but not in KNOWN_EXCHANGE_IDS
        ticker('kraken', 100)
    ];
    const result = rankExchangeTickers(tickers, 10);
    assert.equal(result[0].market.identifier, 'kraken');
    assert.equal(result[1].market.identifier, 'some-obscure-exchange');
});

test('sorts known exchanges among themselves by volume descending', () => {
    const tickers = [
        ticker('kraken', 100),
        ticker('binance', 500),
        ticker('gdax', 300)
    ];
    const result = rankExchangeTickers(tickers, 10);
    assert.deepEqual(result.map(t => t.market.identifier), ['binance', 'gdax', 'kraken']);
});

test('sorts unknown exchanges among themselves by volume descending, after all known ones', () => {
    const tickers = [
        ticker('obscure-a', 50),
        ticker('binance', 10),
        ticker('obscure-b', 200)
    ];
    const result = rankExchangeTickers(tickers, 10);
    assert.deepEqual(result.map(t => t.market.identifier), ['binance', 'obscure-b', 'obscure-a']);
});

test('deduplicates multiple pairs on the same exchange, keeping only the highest-volume one', () => {
    const tickers = [
        ticker('binance', 100, { base: 'BTC', target: 'USDC' }),
        ticker('binance', 900, { base: 'BTC', target: 'USDT' }),
        ticker('binance', 50, { base: 'BTC', target: 'EUR' })
    ];
    const result = rankExchangeTickers(tickers, 10);
    assert.equal(result.length, 1);
    assert.equal(result[0].target, 'USDT');
});

test('falls back to unknown exchanges to fill the limit when there are too few known ones (e.g. a coin not listed on any major exchange)', () => {
    const tickers = Array.from({ length: 5 }, (_, i) => ticker(`obscure-${i}`, 100 - i));
    const result = rankExchangeTickers(tickers, 10);
    assert.equal(result.length, 5);
    assert.deepEqual(result.map(t => t.market.identifier), ['obscure-0', 'obscure-1', 'obscure-2', 'obscure-3', 'obscure-4']);
});

test('respects the limit, counting known and unknown exchanges together', () => {
    const tickers = [
        ...KNOWN_EXCHANGE_IDS.slice(0, 3).map((id, i) => ticker(id, 1000 - i)),
        ...Array.from({ length: 10 }, (_, i) => ticker(`obscure-${i}`, 100 - i))
    ];
    const result = rankExchangeTickers(tickers, 5);
    assert.equal(result.length, 5);
    // the 3 known exchanges, then the 2 highest-volume unknown ones
    assert.deepEqual(result.map(t => t.market.identifier).slice(0, 3), KNOWN_EXCHANGE_IDS.slice(0, 3));
    assert.deepEqual(result.map(t => t.market.identifier).slice(3), ['obscure-0', 'obscure-1']);
});

test('skips tickers with no market.identifier instead of throwing', () => {
    const tickers = [{ converted_volume: { usd: 100 } }, ticker('kraken', 50)];
    const result = rankExchangeTickers(tickers, 10);
    assert.equal(result.length, 1);
    assert.equal(result[0].market.identifier, 'kraken');
});

test('treats a missing/zero volume as 0, not NaN or a crash', () => {
    const tickers = [{ market: { identifier: 'kraken' } }, ticker('binance', 0)];
    const result = rankExchangeTickers(tickers, 10);
    assert.equal(result.length, 2);
});

test('returns an empty array for missing/malformed input instead of throwing', () => {
    assert.deepEqual(rankExchangeTickers(null, 10), []);
    assert.deepEqual(rankExchangeTickers(undefined, 10), []);
    assert.deepEqual(rankExchangeTickers([], 10), []);
});

test('KNOWN_EXCHANGE_IDS has no duplicate entries', () => {
    assert.equal(new Set(KNOWN_EXCHANGE_IDS).size, KNOWN_EXCHANGE_IDS.length);
});
