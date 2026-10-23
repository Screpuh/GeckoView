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

// Expose for the Node test runner (no-op in the browser extension context, where `module` is undefined).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sleep, calculatePercentageOfTotal, formatCirculatingPercentage, escapeHtml, displayPrice, formatDateOrEmpty };
}
