const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatTradingPair } = require('../background.js');

test('strips a known quote currency suffix from a spot pair', () => {
    assert.equal(formatTradingPair('BTCUSDT'), 'btc');
    assert.equal(formatTradingPair('BTCUSD'), 'btc');
    assert.equal(formatTradingPair('ETHEUR'), 'eth');
});

test('strips a trailing contract suffix before stripping the quote currency', () => {
    // Bybit-style perpetual futures symbol, e.g. "BTCUSDT.P"
    assert.equal(formatTradingPair('BTCUSDT.P'), 'btc');
});

test('prefers the longer/more specific quote suffix over a shorter one it contains', () => {
    // "BTCBUSD" ends in both "USD" and "BUSD" - must match "BUSD", not "USD"
    assert.equal(formatTradingPair('BTCBUSD'), 'btc');
    assert.equal(formatTradingPair('BTCTUSD'), 'btc');
    assert.equal(formatTradingPair('BTCFDUSD'), 'btc');
});

test('handles a crypto-to-crypto pair (quote is another coin, not fiat/stablecoin)', () => {
    assert.equal(formatTradingPair('SOLBTC'), 'sol');
    assert.equal(formatTradingPair('USDCUSDT'), 'usdc');
});

test('is case-insensitive on input and always returns lowercase', () => {
    assert.equal(formatTradingPair('btcusdt'), 'btc');
});

test('falls back to the full lowercased symbol when no known quote currency matches', () => {
    assert.equal(formatTradingPair('UNKNOWNXYZ'), 'unknownxyz');
});
