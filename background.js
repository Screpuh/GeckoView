// this file can run API calls to coingecko when triggered by the content script.
// importScripts (pulling in settings.js for getGeckoViewSettings/GV_DEFAULT_SETTINGS) is a
// service-worker-only global, undefined in the Node test runner, hence the guard.
if (typeof importScripts === 'function') {
    importScripts('settings.js');
}

// CoinGecko's Pro plan requires a different host than the free Demo plan, not just a different
// header - sending a Pro key to the Demo host (or vice versa) just fails auth. See
// https://docs.coingecko.com/reference/authentication (Pro) and
// https://docs.coingecko.com/demo/reference/authentication (Demo).
const COINGECKO_DEMO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_PRO_BASE_URL = 'https://pro-api.coingecko.com/api/v3';

// No key (or an unset/unknown apiKeyType) always falls back to the public Demo host, which also
// works unauthenticated.
function getCoinGeckoBaseUrl(apiKeyType) {
    return apiKeyType === 'pro' ? COINGECKO_PRO_BASE_URL : COINGECKO_DEMO_BASE_URL;
}

// Builds the fetch() options for a CoinGecko request, attaching the user's own API key (see
// settings.js) under the header name that matches their key type when one is set. Pulled out as
// its own function so it's testable without needing a real chrome.storage/fetch.
function buildCoinGeckoFetchOptions(apiKey, apiKeyType) {
    const trimmedKey = (apiKey || '').trim();
    if (!trimmedKey) {
        return undefined;
    }
    const headerName = apiKeyType === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key';
    return { headers: { [headerName]: trimmedKey } };
}

// Friendly messages for the HTTP status codes CoinGecko's docs call out as meaningful
// (https://docs.coingecko.com/docs/errors-and-rate-limits). Anything not listed here (including
// 404, which /coins/{id} uses for "coin not found" - an expected signal that triggers the search
// fallback below, not a real error) falls through to the existing response-body-based handling
// unchanged.
const COINGECKO_HTTP_ERROR_MESSAGES = {
    401: 'Your CoinGecko API key looks invalid, or doesn’t match the key type selected in the GeckoView popup (Demo keys need "Demo", Pro keys need "Pro").',
    403: 'CoinGecko blocked this request. If you’re using an API key, double-check it and its key type in the GeckoView popup.',
    408: 'The request to CoinGecko timed out. Check your connection and try again.',
    429: 'CoinGecko rate limit reached. Wait a bit and try again, or add your own API key in the GeckoView popup for a higher limit.',
    500: 'CoinGecko is having a server issue right now. Try again shortly.',
    503: 'CoinGecko is temporarily unavailable (maintenance or an outage). Try again shortly.'
};

// Marks an Error as one of our own friendly, already-user-facing messages, so the top-level
// .catch() below can tell it apart from a raw network/parsing failure (see coinGeckoError()).
function coinGeckoError(message) {
    const error = new Error(message);
    error.isGeckoViewError = true;
    return error;
}

// Parses a CoinGecko fetch() response, rejecting with a friendly message for the handful of HTTP
// statuses above instead of letting their (possibly absent/malformed) JSON body reach the normal
// data.error handling. Used in place of `response => response.json()` at every CoinGecko fetch.
function parseCoinGeckoResponse(response) {
    return response.json().catch(() => ({})).then(data => {
        const friendlyError = COINGECKO_HTTP_ERROR_MESSAGES[response.status];
        if (friendlyError) {
            return Promise.reject(coinGeckoError(friendlyError));
        }
        return data;
    });
}

// A real /coins/{id} response always has these. Guards against treating some other response
// shape as a successful coin lookup - e.g. an error body that doesn't carry a top-level `error`
// field (not every CoinGecko error response does), which would otherwise get cached and sent to
// the content script as "success", crashing templates.js deep inside buildHtmlResponse().
function isValidCoinData(data) {
    return !!data && !data.error && typeof data.id === 'string' && !!data.market_data && !!data.links;
}

// /news and /insights both return a plain JSON array on success (see
// https://docs.coingecko.com/reference/news, https://docs.coingecko.com/reference/insights), so
// this is shared between the two fetchCoinNews/fetchCoinInsights handlers below. Rejects (same
// convention as parseCoinGeckoResponse/coinGeckoError) when the body isn't actually an array -
// e.g. an unmapped error status whose body doesn't carry the top-level `error` field either.
function fetchCoinGeckoJsonArray(url, fetchOptions) {
    return fetch(url, fetchOptions)
        .then(parseCoinGeckoResponse)
        .then(data => {
            if (!Array.isArray(data)) {
                return Promise.reject(coinGeckoError((data && data.error) || 'CoinGecko returned an unexpected response. Please try again.'));
            }
            return data;
        });
}

// News and Insights (https://docs.coingecko.com/reference/news,
// https://docs.coingecko.com/reference/insights) both require a paid CoinGecko plan (Analyst,
// Lite, Pro, or Enterprise) and only exist on the Pro host - a Demo key or no key can't use them
// at all, regardless of apiKeyType. content.js already checks this client-side before ever
// sending fetchCoinNews/fetchCoinInsights (so a non-Pro user never triggers a doomed request),
// this is just defense in depth against a stale/raced settings read reaching here anyway.
function handleListEndpointRequest(message, sendResponse, { pathSegment, cache, featureLabel }) {
    const coinId = message.coinId;
    const cached = cache.get(coinId);
    if (cached) {
        sendResponse({ success: true, data: cached });
        return;
    }

    getGeckoViewSettings().then(settings => {
        if (settings.apiKeyType !== 'pro' || !(settings.apiKey || '').trim()) {
            sendResponse({ success: false, requiresPro: true, error: `${featureLabel} requires a paid CoinGecko plan (Analyst, Lite, Pro, or Enterprise).` });
            return;
        }

        const fetchOptions = buildCoinGeckoFetchOptions(settings.apiKey, 'pro');
        fetchCoinGeckoJsonArray(`${COINGECKO_PRO_BASE_URL}/${pathSegment}?coin_id=${encodeURIComponent(coinId)}&per_page=10`, fetchOptions)
            .then(data => {
                cache.set(coinId, data);
                sendResponse({ success: true, data });
            })
            .catch(error => {
                const message = (error && error.isGeckoViewError)
                    ? error.message
                    : 'Could not reach CoinGecko. Check your internet connection and try again.';
                sendResponse({ success: false, error: message });
            });
    });
}

// The chrome.* APIs only exist in the extension runtime, not in the Node test runner,
// so this registration is skipped there (see test/formatTradingPair.test.js).
if (typeof chrome !== 'undefined') {
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fetchCoinData') {

        const coin = formatTradingPair(message.coin);

        const cached = getCachedCoinData(coin);
        if (cached) {
            sendResponse({ success: true, data: cached });
            return true;
        }

        getGeckoViewSettings().then(settings => {
            const fetchOptions = buildCoinGeckoFetchOptions(settings.apiKey, settings.apiKeyType);
            const baseUrl = getCoinGeckoBaseUrl(settings.apiKeyType);

            fetch(`${baseUrl}/coins/${coin}`, fetchOptions)
            .then(parseCoinGeckoResponse)
            .then(data => {
                if (data.error) {
                    if (data.error === 'coin not found') {
                        // Try searching by name
                        return fetch(`${baseUrl}/search?query=${coin}`, fetchOptions)
                            .then(parseCoinGeckoResponse)
                            .then(data => {
                                if (data.error) {
                                    sendResponse({ success: false, error: data.error });
                                    return;
                                }

                                if (data.coins.length === 0) {
                                    sendResponse({ success: false, error: 'No search results found' });
                                    return;
                                } else {
                                    for(let i = 0; i < data.coins.length; i++) {
                                        if(data.coins[i].symbol.toLowerCase() == coin) {
                                            const newCoinId = data.coins[i].api_symbol;
                                            return fetch(`${baseUrl}/coins/${newCoinId}`, fetchOptions)
                                                .then(parseCoinGeckoResponse)
                                                .then(data => {
                                                    if (!isValidCoinData(data)) {
                                                        sendResponse({ success: false, error: data.error || 'CoinGecko returned an unexpected response. Please try again.' });
                                                        return;
                                                    }

                                                    setCachedCoinData(coin, data);
                                                    sendResponse({ success: true, data });
                                                });
                                        } else if (data.coins[i].name.toLowerCase() == coin) {
                                            const newCoinId = data.coins[i].api_symbol;
                                            return fetch(`${baseUrl}/coins/${newCoinId}`, fetchOptions)
                                                .then(parseCoinGeckoResponse)
                                                .then(data => {
                                                    if (!isValidCoinData(data)) {
                                                        sendResponse({ success: false, error: data.error || 'CoinGecko returned an unexpected response. Please try again.' });
                                                        return;
                                                    }

                                                    setCachedCoinData(coin, data);
                                                    sendResponse({ success: true, data });
                                                });
                                        }
                                    }

                                    // none of the search results matched the coin we were looking for
                                    sendResponse({ success: false, error: 'No matching coin found in search results' });
                                }
                            });
                    }

                    // CoinGecko's own error text (not reached for 'coin not found' - handled above)
                    sendResponse({ success: false, error: data.error });
                    return;
                }

                if (!isValidCoinData(data)) {
                    sendResponse({ success: false, error: 'CoinGecko returned an unexpected response. Please try again.' });
                    return;
                }

                setCachedCoinData(coin, data);
                sendResponse({ success: true, data });
            }).catch(error => {
                // Our own HTTP-status-derived messages (coinGeckoError()) are already friendly
                // and user-facing; anything else is a raw network/parsing failure (offline, DNS,
                // CORS, etc.) with no useful message of its own.
                const message = (error && error.isGeckoViewError)
                    ? error.message
                    : 'Could not reach CoinGecko. Check your internet connection and try again.';
                sendResponse({ success: false, error: message });
            });
        });

        return true;
    }

    if (message.action === 'fetchCoinNews') {
        handleListEndpointRequest(message, sendResponse, { pathSegment: 'news', cache: newsCache, featureLabel: 'News' });
        return true;
    }

    if (message.action === 'fetchCoinInsights') {
        handleListEndpointRequest(message, sendResponse, { pathSegment: 'insights', cache: insightsCache, featureLabel: 'Insights' });
        return true;
    }
});
}


// Short-lived in-memory cache for CoinGecko responses, keyed by the resolved coin id (the output
// of formatTradingPair, e.g. "bitcoin"). TradingView's MutationObserver can re-trigger a lookup
// for the same symbol in quick succession (e.g. flipping back and forth, or unrelated DOM churn
// in the details panel), which would otherwise re-fetch every time; this keeps repeat lookups
// within COIN_DATA_CACHE_TTL_MS free; to stay well under CoinGecko's free-tier rate limit.
// It's intentionally just a plain Map, not chrome.storage: MV3 service workers can be evicted
// when idle, which clears it, but that only costs an occasional extra fetch, not correctness.
// Shared by the coin-data, news and insights caches below (createTtlCache), since all three are
// the exact same "keyed Map with a TTL" shape.
const COIN_DATA_CACHE_TTL_MS = 60 * 1000;

function createTtlCache(ttlMs) {
    const store = new Map();
    return {
        get(key, now = Date.now()) {
            const entry = store.get(key);
            if (!entry) {
                return null;
            }
            if (now - entry.timestamp > ttlMs) {
                store.delete(key);
                return null;
            }
            return entry.data;
        },
        set(key, data, now = Date.now()) {
            store.set(key, { data, timestamp: now });
        }
    };
}

const coinDataCache = createTtlCache(COIN_DATA_CACHE_TTL_MS);
const newsCache = createTtlCache(COIN_DATA_CACHE_TTL_MS);
const insightsCache = createTtlCache(COIN_DATA_CACHE_TTL_MS);

// Thin wrappers kept for API stability (existing tests/call sites use these names directly).
function getCachedCoinData(coin, now = Date.now()) {
    return coinDataCache.get(coin, now);
}

function setCachedCoinData(coin, data, now = Date.now()) {
    coinDataCache.set(coin, data, now);
}

// TradingView's "details" panel now shows the raw ticker as `{BASE}{QUOTE}` (no separator),
// uniformly across exchanges, optionally with a trailing contract suffix like ".P" for
// perpetual futures (e.g. "BTCUSDT", "BTCUSDT.P", "ETHEUR"). Strip the contract suffix and the
// quote currency to recover the base asset ticker CoinGecko understands. Ordered longest-first,
// and with suffixes that are themselves suffixes of others (e.g. "BUSD" ends in "USD") listed
// before the shorter one, so the first match found is always the most specific one.
const QUOTE_CURRENCY_SUFFIXES = [
    'FDUSD', 'USDT', 'USDC', 'BUSD', 'TUSD', 'DAI',
    'USD', 'EUR', 'GBP', 'JPY', 'TRY', 'BRL', 'AUD',
    'BTC', 'ETH', 'BNB'
];

function formatTradingPair(pair) {
    // strip a trailing contract-type suffix, e.g. "BTCUSDT.P" (perpetual) -> "BTCUSDT"
    const symbol = pair.split('.')[0].toUpperCase();

    for (const quote of QUOTE_CURRENCY_SUFFIXES) {
        if (symbol.length > quote.length && symbol.endsWith(quote)) {
            return symbol.slice(0, -quote.length).toLowerCase();
        }
    }

    // unknown quote currency - fall back to the full symbol and let the search fallback try
    return symbol.toLowerCase();
}

// Expose for the Node test runner (no-op in the browser extension context, where `module` is undefined).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatTradingPair, getCachedCoinData, setCachedCoinData, COIN_DATA_CACHE_TTL_MS,
        buildCoinGeckoFetchOptions, getCoinGeckoBaseUrl, COINGECKO_DEMO_BASE_URL, COINGECKO_PRO_BASE_URL,
        COINGECKO_HTTP_ERROR_MESSAGES, parseCoinGeckoResponse, isValidCoinData,
        createTtlCache, newsCache, insightsCache, fetchCoinGeckoJsonArray, handleListEndpointRequest
    };
}