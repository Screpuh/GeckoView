// this file can run API calls to coingecko when triggered by the content script.
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

        fetch(`https://api.coingecko.com/api/v3/coins/${coin}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                if (data.error === 'coin not found') {
                    // Try searching by name
                    return fetch(`https://api.coingecko.com/api/v3/search?query=${coin}`)
                        .then(response => response.json())
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
                                        return fetch(`https://api.coingecko.com/api/v3/coins/${newCoinId}`)
                                            .then(response => response.json())
                                            .then(data => {
                                                if (data.error) {
                                                    sendResponse({ success: false, error: data.error });
                                                    return;
                                                }

                                                setCachedCoinData(coin, data);
                                                sendResponse({ success: true, data });
                                            });
                                    } else if (data.coins[i].name.toLowerCase() == coin) {
                                        const newCoinId = data.coins[i].api_symbol;
                                        return fetch(`https://api.coingecko.com/api/v3/coins/${newCoinId}`)
                                            .then(response => response.json())
                                            .then(data => {
                                                if (data.error) {
                                                    sendResponse({ success: false, error: data.error });
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

                sendResponse({ success: false, error: 'No search results found'});
                return;
            }
            setCachedCoinData(coin, data);
            sendResponse({ success: true, data });
        }).catch(error => {
            sendResponse({ success: false, 'error': 'An error has occurred. Please attempt your request again.'} );
        });
            
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
const COIN_DATA_CACHE_TTL_MS = 60 * 1000;
const coinDataCache = new Map();

function getCachedCoinData(coin, now = Date.now()) {
    const entry = coinDataCache.get(coin);
    if (!entry) {
        return null;
    }
    if (now - entry.timestamp > COIN_DATA_CACHE_TTL_MS) {
        coinDataCache.delete(coin);
        return null;
    }
    return entry.data;
}

function setCachedCoinData(coin, data, now = Date.now()) {
    coinDataCache.set(coin, { data, timestamp: now });
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
    module.exports = { formatTradingPair, getCachedCoinData, setCachedCoinData, COIN_DATA_CACHE_TTL_MS };
}