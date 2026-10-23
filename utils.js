// Shared, dependency-free helper functions used by templates.js and content.js.
// Classic script (no import/export) — loaded before the other content scripts, see manifest.json.

// This function will pause the execution of the code for the specified amount of time
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// This function will calculate the percentage of the part of the total.
// Returns null when the total is missing/zero (e.g. coins with no max supply) rather than Infinity/NaN.
function calculatePercentageOfTotal(part, total) {
    if (!total) {
        return null;
    }
    return Math.floor((part / total) * 100);
}

// Builds the "(NN%)" suffix shown next to circulating supply, or '' when the percentage is unknown.
function formatCirculatingPercentage(part, total) {
    const percentage = calculatePercentageOfTotal(part, total);
    return percentage === null ? '' : ` (${percentage}%)`;
}

// Escapes a value for safe interpolation into HTML text/attributes. CoinGecko response
// fields are not trusted input and are inserted via innerHTML, so this must run first.
function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// This function will display the price in USD format and check for small numbers
function displayPrice(price) {
    if (price === null || price === undefined) {
        return 'N/A';
    }

    let CFORMAT_USD = new Intl.NumberFormat('en-EN', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

    // if first character is 0, then it is a small number
    if (price < 1) {
        let CFORMAT_SMALL_USD = new Intl.NumberFormat('en-EN', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 });
        if (price < 0.01) {
            CFORMAT_SMALL_USD = new Intl.NumberFormat('en-EN', { style: 'currency', currency: 'USD', minimumFractionDigits: 8 });
        }

        return CFORMAT_SMALL_USD.format(price);
    } else {
        return CFORMAT_USD.format(price);
    }
}

// Formats a USD amount compactly (e.g. "$4.1B", "$65.6K") for places like the Exchanges tab's
// volume figures, where the full formatUsdOrNA-style comma-grouped number would be too wide for a
// one-line meta row. 'N/A' for a missing value, same convention as the other formatOrNA helpers.
function formatCompactUsd(value) {
    if (value === null || value === undefined) {
        return 'N/A';
    }
    return new Intl.NumberFormat('en-EN', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

// Formats an ISO 8601 timestamp (e.g. news/insights `posted_at`) as a short locale date string,
// or '' for a missing/invalid value - callers can treat '' as "omit this piece of metadata".
function formatDateOrEmpty(isoString) {
    if (!isoString) {
        return '';
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// The matching rule for content.js's TradingView ad-blocker-popup auto-closer, pulled out as its
// own pure function so it's unit-testable without a DOM. TradingView reuses the same "gopro"
// dialog container for several different upgrade prompts (data-dialog-name="gopro" alone isn't
// specific enough), so this checks the dialog's own text for "ad blocker" before content.js is
// allowed to auto-dismiss it - a generic "upgrade to Pro" prompt the user might want to see stays put.
function isAdBlockerDialogText(text) {
    return /ad blocker/i.test(text || '');
}

// CoinGecko's ticker `base`/`target` fields don't always match TradingView's own ticker symbols
// for the same asset - confirmed live that Kraken's CoinGecko ticker uses "XBT" for Bitcoin, but
// searching TradingView for "XBT..." finds nothing, while "BTC..." finds it. Only this one
// confirmed case is handled; add more here if another mismatch like it turns up.
function normalizeTickerSymbol(symbol) {
    const upper = (symbol || '').toUpperCase();
    return upper === 'XBT' ? 'BTC' : upper;
}

// Strips TradingView symbol-search's <em>...</em> highlight markup from a matched symbol/text.
function stripSearchHighlight(text) {
    return (text || '').replace(/<\/?em>/g, '');
}

function normalizeExchangeName(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Finds the TradingView symbol (e.g. "COINBASE:BTCUSD") for a CoinGecko ticker, given the results
// of a TradingView symbol-search call (https://symbol-search.tradingview.com/symbol_search/v3/?
// text=...) - see content.js's openExchangeTickerLink() for how/when this is called. Pulled out
// as its own pure function so the matching rule is unit-testable without a live fetch.
//
// CoinGecko and TradingView maintain independent exchange-id namespaces that often don't match
// (e.g. CoinGecko's "gdax" vs TradingView's "COINBASE" for the same exchange - confirmed live
// across a dozen major exchanges), so this matches on the *display* name (`exchangeName`, fuzzy,
// case/punctuation-insensitive) rather than any identifier slug, and on the exact concatenated
// base+target symbol (after normalizeTickerSymbol on each). Returns null when nothing matches -
// callers should fall back to the ticker's own trade_url rather than guessing at a symbol.
function findTradingViewSymbolMatch(results, exchangeName, base, target) {
    if (!Array.isArray(results)) {
        return null;
    }

    const wantedExchange = normalizeExchangeName(exchangeName);
    const wantedSymbol = `${normalizeTickerSymbol(base)}${normalizeTickerSymbol(target)}`;
    if (!wantedExchange || !wantedSymbol) {
        return null;
    }

    const match = results.find(result => {
        const resultExchange = normalizeExchangeName(result.exchange);
        const resultSymbol = stripSearchHighlight(result.symbol).toUpperCase();
        const exchangeMatches = resultExchange === wantedExchange
            || resultExchange.includes(wantedExchange)
            || wantedExchange.includes(resultExchange);
        return !!resultExchange && exchangeMatches && resultSymbol === wantedSymbol;
    });

    if (!match) {
        return null;
    }

    // Different result shapes carry the TradingView exchange prefix under different keys.
    const prefix = match.prefix || (match.source2 && match.source2.id) || match.source_id;
    if (!prefix) {
        return null;
    }

    return `${prefix}:${stripSearchHighlight(match.symbol)}`;
}

// Expose for the Node test runner (no-op in the browser extension context, where `module` is undefined).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sleep, calculatePercentageOfTotal, formatCirculatingPercentage, escapeHtml, displayPrice,
        formatCompactUsd, formatDateOrEmpty, isAdBlockerDialogText,
        normalizeTickerSymbol, findTradingViewSymbolMatch
    };
}
