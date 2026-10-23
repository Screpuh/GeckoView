const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pickBestCoinSearchMatch } = require('../background.js');

function coin(symbol, name, market_cap_rank, extra = {}) {
    return { symbol, name, market_cap_rank, api_symbol: extra.api_symbol || symbol.toLowerCase(), ...extra };
}

test('picks the best-ranked match when several unrelated coins share a ticker (the real Dogecoin/WOO Network bug)', () => {
    // Real /search?query=doge shape (trimmed): the actual Dogecoin is rank 12, but an unrelated,
    // unranked "@DOGE" token also matches by symbol - confirmed live this was getting picked
    // instead whenever a direct /coins/{ticker} id guess happened to hit it first.
    const results = [
        coin('@doge', '@DOGE', null, { api_symbol: 'doge' }),
        coin('DOGE', 'Dogecoin', 12, { api_symbol: 'dogecoin' }),
        coin('BABYDOGE', 'Baby Doge Coin', 366, { api_symbol: 'baby-doge-coin' })
    ];
    const best = pickBestCoinSearchMatch(results, 'doge');
    assert.equal(best.api_symbol, 'dogecoin');
});

test('matches by name as well as by symbol', () => {
    const results = [coin('XYZ', 'Pepe', 50, { api_symbol: 'pepe' })];
    const best = pickBestCoinSearchMatch(results, 'pepe');
    assert.equal(best.api_symbol, 'pepe');
});

test('treats an unranked (null market_cap_rank) match as worse than any ranked one', () => {
    const results = [
        coin('woo', 'ウー', null, { api_symbol: 'woo' }),
        coin('WOO', 'WOO', 840, { api_symbol: 'woo-network' })
    ];
    const best = pickBestCoinSearchMatch(results, 'woo');
    assert.equal(best.api_symbol, 'woo-network');
});

test('ignores results that do not actually match the ticker/name at all', () => {
    const results = [
        coin('BTC', 'Bitcoin', 1, { api_symbol: 'bitcoin' }),
        coin('ETH', 'Ethereum', 2, { api_symbol: 'ethereum' })
    ];
    assert.equal(pickBestCoinSearchMatch(results, 'sol'), null);
});

test('is case-insensitive on both symbol and name', () => {
    const results = [coin('Btc', 'BITCOIN', 1, { api_symbol: 'bitcoin' })];
    assert.equal(pickBestCoinSearchMatch(results, 'btc').api_symbol, 'bitcoin');
});

test('returns null for missing/malformed input instead of throwing', () => {
    assert.equal(pickBestCoinSearchMatch(null, 'btc'), null);
    assert.equal(pickBestCoinSearchMatch(undefined, 'btc'), null);
    assert.equal(pickBestCoinSearchMatch([], 'btc'), null);
    assert.equal(pickBestCoinSearchMatch([{}, null, { symbol: null, name: null }], 'btc'), null);
});
