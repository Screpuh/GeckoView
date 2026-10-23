const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatTradingPair } = require('../background.js');

test('formats Binance-family pairs ("BTC / USDT" style)', () => {
    assert.equal(formatTradingPair('BTC / USDT', 'binance'), 'btc');
    assert.equal(formatTradingPair('BTC / USDT', 'kraken'), 'btc');
    assert.equal(formatTradingPair('BTC / USDT', 'coinbase'), 'btc');
});

test('formats Bybit pairs ("BTCUSDT" style, no separator)', () => {
    assert.equal(formatTradingPair('BTCUSDT', 'bybit'), 'btc');
});

test('formats cryptocom/gateio/okx pairs ("BTC/USDT" style, no spaces)', () => {
    assert.equal(formatTradingPair('BTC/USDT', 'cryptocom'), 'btc');
    assert.equal(formatTradingPair('BTC/USDT', 'okx'), 'btc');
    assert.equal(formatTradingPair('BTC/USDT', 'gateio'), 'btc');
});

test('falls back to the generic "COIN / USDT" format for unknown exchanges', () => {
    assert.equal(formatTradingPair('BTC / USDT', 'some-unlisted-exchange'), 'btc');
});

test('exchange matching is case-insensitive via the caller lowercasing it', () => {
    // background.js lowercases message.exchange before calling formatTradingPair
    assert.equal(formatTradingPair('ETH / USDT', 'binance us'), 'eth');
});
