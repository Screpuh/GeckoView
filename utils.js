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

// Converts a series of prices into an SVG polyline "x,y x,y ..." points string, scaled to fit
// a width x height box (minus padding on every side). Non-finite entries (CoinGecko's
// sparkline_in_7d occasionally contains null/NaN gaps) are dropped before scaling. Returns null
// when there are fewer than 2 usable points to draw a line through.
function buildSparklinePoints(values, width, height, padding = 2) {
    if (!Array.isArray(values)) {
        return null;
    }

    const clean = values.filter(v => typeof v === 'number' && Number.isFinite(v));
    if (clean.length < 2) {
        return null;
    }

    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const range = max - min || 1; // flat line (min === max): avoid dividing by zero
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    const step = innerWidth / (clean.length - 1);

    return clean
        .map((v, i) => {
            const x = padding + i * step;
            const y = padding + innerHeight - ((v - min) / range) * innerHeight;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
}

// Expose for the Node test runner (no-op in the browser extension context, where `module` is undefined).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sleep, calculatePercentageOfTotal, formatCirculatingPercentage, escapeHtml, displayPrice, buildSparklinePoints };
}
