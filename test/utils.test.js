const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    calculatePercentageOfTotal, formatCirculatingPercentage, escapeHtml, displayPrice,
    formatCompactUsd, formatDateOrEmpty, isAdBlockerDialogText,
    normalizeTickerSymbol, findTradingViewSymbolMatch
} = require('../utils.js');

test('calculatePercentageOfTotal computes a floored percentage', () => {
    assert.equal(calculatePercentageOfTotal(19000000, 21000000), 90);
    assert.equal(calculatePercentageOfTotal(1, 3), 33);
});

test('calculatePercentageOfTotal returns null when total is missing or zero', () => {
    assert.equal(calculatePercentageOfTotal(100, 0), null);
    assert.equal(calculatePercentageOfTotal(100, null), null);
    assert.equal(calculatePercentageOfTotal(100, undefined), null);
});

test('formatCirculatingPercentage formats a known percentage', () => {
    assert.equal(formatCirculatingPercentage(19000000, 21000000), ' (90%)');
});

test('formatCirculatingPercentage omits the suffix when total is unknown', () => {
    assert.equal(formatCirculatingPercentage(19000000, null), '');
});

test('escapeHtml neutralizes HTML-significant characters', () => {
    assert.equal(
        escapeHtml('<img src=x onerror=alert(1)> & "quoted" \'single\''),
        '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot; &#39;single&#39;'
    );
});

test('escapeHtml treats null/undefined as empty string', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml stringifies non-string values', () => {
    assert.equal(escapeHtml(42), '42');
});

test('displayPrice formats prices >= $1 with no decimals', () => {
    assert.equal(displayPrice(69000), '$69,000');
});

test('displayPrice formats small prices (< $1) with 4 decimals', () => {
    assert.equal(displayPrice(0.5), '$0.5000');
});

test('displayPrice formats very small prices (< $0.01) with 8 decimals', () => {
    assert.equal(displayPrice(0.000001234), '$0.00000123');
});

test('displayPrice returns N/A for a missing price', () => {
    assert.equal(displayPrice(null), 'N/A');
    assert.equal(displayPrice(undefined), 'N/A');
});

test('formatDateOrEmpty formats a valid ISO timestamp as a short date', () => {
    assert.equal(formatDateOrEmpty('2026-03-05T12:00:00Z'), new Date('2026-03-05T12:00:00Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
});

test('formatDateOrEmpty returns empty string for a missing/empty/invalid value', () => {
    assert.equal(formatDateOrEmpty(null), '');
    assert.equal(formatDateOrEmpty(undefined), '');
    assert.equal(formatDateOrEmpty(''), '');
    assert.equal(formatDateOrEmpty('not-a-date'), '');
});

test('isAdBlockerDialogText matches regardless of case/surrounding text', () => {
    assert.equal(isAdBlockerDialogText('Ad blocker detected'), true);
    assert.equal(isAdBlockerDialogText('AD BLOCKER DETECTED'), true);
    assert.equal(isAdBlockerDialogText('You seem to have an ad blocker enabled, please disable it.'), true);
});

test('isAdBlockerDialogText does not match an unrelated "upgrade to Pro" dialog', () => {
    assert.equal(isAdBlockerDialogText('Unlock advanced charting tools with Pro'), false);
    assert.equal(isAdBlockerDialogText(''), false);
    assert.equal(isAdBlockerDialogText(null), false);
    assert.equal(isAdBlockerDialogText(undefined), false);
});

test('formatCompactUsd formats large numbers compactly', () => {
    assert.equal(formatCompactUsd(4062283991), '$4.1B');
    assert.equal(formatCompactUsd(65629), '$65.6K');
});

test('formatCompactUsd returns N/A for a missing value', () => {
    assert.equal(formatCompactUsd(null), 'N/A');
    assert.equal(formatCompactUsd(undefined), 'N/A');
});

test('normalizeTickerSymbol maps Kraken’s "XBT" to "BTC" (confirmed live: TradingView search finds nothing for "XBT")', () => {
    assert.equal(normalizeTickerSymbol('XBT'), 'BTC');
    assert.equal(normalizeTickerSymbol('xbt'), 'BTC');
});

test('normalizeTickerSymbol uppercases and passes through anything else unchanged', () => {
    assert.equal(normalizeTickerSymbol('usdt'), 'USDT');
    assert.equal(normalizeTickerSymbol('ETH'), 'ETH');
    assert.equal(normalizeTickerSymbol(''), '');
    assert.equal(normalizeTickerSymbol(undefined), '');
});

// Fixtures below are real shapes captured from a live call to
// https://symbol-search.tradingview.com/symbol_search/v3/ (not fabricated), since CoinGecko and
// TradingView's exchange identifiers frequently don't match (e.g. CoinGecko's "gdax" vs
// TradingView's "COINBASE" for the same exchange) - this is why the match is name-based, not
// identifier-based.
const TV_SEARCH_RESULTS_FIXTURE = [
    { symbol: '<em>BTCUSD</em>', exchange: 'Coinbase', prefix: 'COINBASE', type: 'spot' },
    { symbol: '<em>BTCUSDT</em>', exchange: 'Bybit', prefix: 'BYBIT', type: 'spot' },
    { symbol: '<em>BTCUSDT</em>.P', exchange: 'Bybit', prefix: 'BYBIT', type: 'swap' },
    // OKX's real result has no "prefix" key at all - only source_id/source2.id carry it.
    { symbol: '<em>BTCUSDT</em>', exchange: 'OKX', source_id: 'OKX', source2: { id: 'OKX' }, type: 'spot' },
    { symbol: '<em>BTCUSD</em>', exchange: 'Kraken', prefix: 'KRAKEN', source_id: 'KRAKEN', type: 'spot' }
];

test('findTradingViewSymbolMatch matches by exact exchange name + concatenated symbol', () => {
    assert.equal(findTradingViewSymbolMatch(TV_SEARCH_RESULTS_FIXTURE, 'Coinbase Exchange', 'BTC', 'USD'), 'COINBASE:BTCUSD');
    assert.equal(findTradingViewSymbolMatch(TV_SEARCH_RESULTS_FIXTURE, 'Bybit', 'BTC', 'USDT'), 'BYBIT:BTCUSDT');
});

test('findTradingViewSymbolMatch falls back to source_id/source2.id when "prefix" is absent (OKX’s real shape)', () => {
    assert.equal(findTradingViewSymbolMatch(TV_SEARCH_RESULTS_FIXTURE, 'OKX', 'BTC', 'USDT'), 'OKX:BTCUSDT');
});

test('findTradingViewSymbolMatch normalizes "XBT" to "BTC" before matching (Kraken’s CoinGecko ticker base)', () => {
    assert.equal(findTradingViewSymbolMatch(TV_SEARCH_RESULTS_FIXTURE, 'Kraken', 'XBT', 'USD'), 'KRAKEN:BTCUSD');
});

test('findTradingViewSymbolMatch strips the <em> search-highlight markup from the resolved symbol', () => {
    const result = findTradingViewSymbolMatch(TV_SEARCH_RESULTS_FIXTURE, 'Coinbase', 'BTC', 'USD');
    assert.ok(!result.includes('<em>'));
});

test('findTradingViewSymbolMatch returns null when no result matches the exchange (not just any BTCUSD hit)', () => {
    assert.equal(findTradingViewSymbolMatch(TV_SEARCH_RESULTS_FIXTURE, 'Some Unlisted DEX', 'BTC', 'USD'), null);
});

test('findTradingViewSymbolMatch returns null when the exchange matches but the pair does not', () => {
    assert.equal(findTradingViewSymbolMatch(TV_SEARCH_RESULTS_FIXTURE, 'Coinbase', 'ETH', 'EUR'), null);
});

test('findTradingViewSymbolMatch returns null for missing/malformed input instead of throwing', () => {
    assert.equal(findTradingViewSymbolMatch(null, 'Coinbase', 'BTC', 'USD'), null);
    assert.equal(findTradingViewSymbolMatch([], 'Coinbase', 'BTC', 'USD'), null);
    assert.equal(findTradingViewSymbolMatch(TV_SEARCH_RESULTS_FIXTURE, '', 'BTC', 'USD'), null);
    assert.equal(findTradingViewSymbolMatch(TV_SEARCH_RESULTS_FIXTURE, 'Coinbase', '', ''), null);
});
