const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COINGECKO_HTTP_ERROR_MESSAGES, parseCoinGeckoResponse } = require('../background.js');

// Minimal stand-in for the fetch() Response object - only status/json() are used by
// parseCoinGeckoResponse.
function fakeResponse(status, body) {
    return {
        status,
        json: () => (body === undefined ? Promise.reject(new Error('not JSON')) : Promise.resolve(body))
    };
}

test('every documented CoinGecko error status has a non-empty, distinct friendly message', () => {
    // https://docs.coingecko.com/docs/errors-and-rate-limits
    for (const status of [401, 403, 408, 429, 500, 503]) {
        assert.ok(
            Object.prototype.hasOwnProperty.call(COINGECKO_HTTP_ERROR_MESSAGES, status),
            `no friendly message mapped for HTTP ${status}`
        );
        assert.ok(COINGECKO_HTTP_ERROR_MESSAGES[status].length > 0);
    }
});

test('rejects with the friendly message for a mapped error status, ignoring the body', async () => {
    const response = fakeResponse(429, { some: 'unrelated body' });
    await assert.rejects(
        parseCoinGeckoResponse(response),
        err => err.message === COINGECKO_HTTP_ERROR_MESSAGES[429] && err.isGeckoViewError === true
    );
});

test('rejects with the friendly message even when the error body is not valid JSON', async () => {
    const response = fakeResponse(500, undefined); // .json() rejects, simulating an empty/non-JSON body
    await assert.rejects(
        parseCoinGeckoResponse(response),
        err => err.message === COINGECKO_HTTP_ERROR_MESSAGES[500]
    );
});

test('resolves with the parsed body for a 200 response (no special handling)', async () => {
    const response = fakeResponse(200, { id: 'bitcoin' });
    const data = await parseCoinGeckoResponse(response);
    assert.deepEqual(data, { id: 'bitcoin' });
});

test('resolves (does not reject) for a 404 - "coin not found" is an expected signal, not an error', async () => {
    const response = fakeResponse(404, { error: 'coin not found' });
    const data = await parseCoinGeckoResponse(response);
    assert.deepEqual(data, { error: 'coin not found' });
});

test('resolves for an unmapped error status, leaving it to the caller’s data.error handling', async () => {
    const response = fakeResponse(418, { error: 'teapot' });
    const data = await parseCoinGeckoResponse(response);
    assert.deepEqual(data, { error: 'teapot' });
});
