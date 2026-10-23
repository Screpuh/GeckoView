// Shared settings schema + chrome.storage.sync helpers. Classic script (no import/export),
// loaded by both the content script bundle (manifest.json content_scripts) and popup.html, so
// content.js/templates.js and popup.js always agree on what settings exist and what they default to.

const GV_DEFAULT_SETTINGS = {
    enabled: true,
    // Auto-dismisses TradingView's own "Ad blocker detected" upgrade-nag dialog as soon as it
    // appears (see content.js's setupAdBlockerPopupAutoClose). Unrelated to the widget above -
    // kept as its own setting so it can be used independently of `enabled`.
    autoCloseAdBlockerPopup: true,
    // Optional CoinGecko API key (from https://www.coingecko.com/en/developers/dashboard). Demo
    // (free) and Pro (paid) keys use different hosts and header names - see
    // https://docs.coingecko.com/reference/authentication (Pro) vs
    // https://docs.coingecko.com/demo/reference/authentication (Demo) - and aren't distinguishable
    // by format, so apiKeyType is a separate, explicit setting rather than something we guess at.
    // '' means "no key / anonymous requests" (background.js then ignores apiKeyType entirely).
    apiKey: '',
    apiKeyType: 'demo', // 'demo' | 'pro'
    showMarketCap: true,
    showFullyDilutedValuation: true,
    showTotalVolume: true,
    showTotalSupply: true,
    showCirculatingSupply: true,
    showAthAtl: true
};

// Drives the per-stat checkboxes in popup.html: label text + which GV_DEFAULT_SETTINGS key it
// controls. Keeping this list and GV_DEFAULT_SETTINGS in sync (same keys) is covered by a test.
const GV_STAT_OPTIONS = [
    { key: 'showMarketCap', label: 'Market cap' },
    { key: 'showFullyDilutedValuation', label: 'Fully diluted valuation' },
    { key: 'showTotalVolume', label: '24h total volume' },
    { key: 'showTotalSupply', label: 'Total supply' },
    { key: 'showCirculatingSupply', label: 'Circulating supply' },
    { key: 'showAthAtl', label: 'ATL / ATH' }
];

// Resolves with the current settings. chrome.storage.sync.get's "defaults object" overload fills
// in anything not yet stored with GV_DEFAULT_SETTINGS automatically, so a first run (nothing
// saved yet) behaves exactly like every stat being explicitly enabled.
function getGeckoViewSettings() {
    return new Promise(resolve => {
        chrome.storage.sync.get(GV_DEFAULT_SETTINGS, resolve);
    });
}

function setGeckoViewSetting(key, value) {
    return new Promise(resolve => {
        chrome.storage.sync.set({ [key]: value }, resolve);
    });
}

// Re-invokes `callback` with the fresh settings whenever they change in another extension page
// (e.g. the popup), so a TradingView tab that's already open can react immediately instead of
// needing a refresh.
function watchGeckoViewSettings(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') {
            return;
        }
        getGeckoViewSettings().then(callback);
    });
}

// Expose for the Node test runner (no-op in the browser extension context, where `module` is undefined).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GV_DEFAULT_SETTINGS, GV_STAT_OPTIONS };
}
