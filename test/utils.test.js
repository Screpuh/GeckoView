const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculatePercentageOfTotal, formatCirculatingPercentage, escapeHtml, displayPrice, buildSparklinePoints } = require('../utils.js');

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

test('buildSparklinePoints maps values onto a width x height box', () => {
    const points = buildSparklinePoints([1, 2, 3], 100, 20, 0);
    // 3 values -> 3 "x,y" pairs, evenly spaced across the width, starting at x=0 and ending at x=100
    const pairs = points.split(' ');
    assert.equal(pairs.length, 3);
    assert.equal(pairs[0].split(',')[0], '0.00');
    assert.equal(pairs[2].split(',')[0], '100.00');
    // ascending values -> y decreases (SVG y grows downward, so the highest value has the smallest y)
    const ys = pairs.map(p => Number(p.split(',')[1]));
    assert.ok(ys[0] > ys[1] && ys[1] > ys[2]);
});

test('buildSparklinePoints handles a flat series without dividing by zero', () => {
    const points = buildSparklinePoints([5, 5, 5], 100, 20);
    assert.ok(points && !points.includes('NaN'));
});

test('buildSparklinePoints drops non-finite entries (CoinGecko sparkline gaps)', () => {
    const points = buildSparklinePoints([1, NaN, null, 3], 100, 20, 0);
    assert.equal(points.split(' ').length, 2);
});

test('buildSparklinePoints returns null when there are fewer than 2 usable points', () => {
    assert.equal(buildSparklinePoints([], 100, 20), null);
    assert.equal(buildSparklinePoints([1], 100, 20), null);
    assert.equal(buildSparklinePoints([NaN, 1], 100, 20), null);
    assert.equal(buildSparklinePoints(null, 100, 20), null);
});
