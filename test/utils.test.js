const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculatePercentageOfTotal, formatCirculatingPercentage, escapeHtml, displayPrice } = require('../utils.js');

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
