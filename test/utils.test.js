const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculatePercentageOfTotal, formatCirculatingPercentage, escapeHtml, displayPrice, formatDateOrEmpty, isAdBlockerDialogText } = require('../utils.js');

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
