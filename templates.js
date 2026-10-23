// HTML template builders for the GeckoView widget panel. Depends on the helpers in utils.js
// (escapeHtml, displayPrice, formatCirculatingPercentage, formatCompactUsd, formatDateOrEmpty)
// being loaded first — see manifest.json.
//
// Styling note: this is a fully self-contained design (its own "gv-*" classes and CSS custom
// properties), not styled by piggybacking on TradingView's own CSS classes. TradingView's class
// names are build-hashed and regenerate on every frontend deploy, so depending on them for
// styling breaks silently (this happened once already — see git history). The only thing we
// still read from TradingView is `html[data-theme]` ("light"/"dark"), which has stayed stable
// across redesigns, to pick a matching color scheme.

// Shared CSS for every widget state (header/loading/error/data). Returned as its own <style>
// block and included once per render, since each state fully replaces the widget's innerHTML.
function buildGeckoViewStyles() {
    return `
        <style>
            #crypto-info-geckoview {
                --gv-text: #131722;
                --gv-text-muted: #787b86;
                --gv-border: #e0e3eb;
                --gv-pill-bg: #f0f3fa;
                --gv-pill-bg-hover: #e3e9f2;
                --gv-accent: #2962ff;
                --gv-danger: #e04b4b;
                font-family: -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Helvetica, Arial, sans-serif;
                font-size: 13px;
                line-height: 1.4;
                color: var(--gv-text);
                padding: 12px 16px 16px;
                border-bottom: 1px solid var(--gv-border);
            }

            html[data-theme="dark"] #crypto-info-geckoview {
                --gv-text: #d1d4dc;
                --gv-text-muted: #868993;
                --gv-border: #2a2e39;
                --gv-pill-bg: #2a2e39;
                --gv-pill-bg-hover: #363a45;
            }

            #crypto-info-geckoview * {
                box-sizing: border-box;
            }

            #crypto-info-geckoview .gv-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            #crypto-info-geckoview .gv-header__identity {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
            }

            #crypto-info-geckoview .gv-header__title {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                font-weight: 600;
                color: var(--gv-text);
                text-decoration: none;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            #crypto-info-geckoview .gv-header__title:hover {
                color: var(--gv-accent);
            }

            #crypto-info-geckoview .gv-header__logo {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            #crypto-info-geckoview .gv-header__symbol {
                color: var(--gv-text-muted);
                font-weight: 400;
            }

            #crypto-info-geckoview .gv-header__rank {
                font-size: 11px;
                font-weight: 600;
                color: var(--gv-text-muted);
                background: var(--gv-pill-bg);
                border-radius: 4px;
                padding: 1px 6px;
                flex-shrink: 0;
            }

            #crypto-info-geckoview .gv-header__coingecko {
                flex-shrink: 0;
                display: flex;
                opacity: 0.7;
                transition: opacity .15s;
            }

            #crypto-info-geckoview .gv-header__coingecko:hover {
                opacity: 1;
            }

            #crypto-info-geckoview .gv-header__coingecko img {
                width: 18px;
                height: 18px;
                display: block;
            }

            #crypto-info-geckoview .gv-links {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 12px;
            }

            #crypto-info-geckoview .gv-links a {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                color: var(--gv-text);
                text-decoration: none;
                background: var(--gv-pill-bg);
                border-radius: 6px;
                padding: 4px 9px;
                transition: background .15s;
            }

            #crypto-info-geckoview .gv-links a:hover {
                background: var(--gv-pill-bg-hover);
            }

            #crypto-info-geckoview .gv-links svg {
                width: 13px;
                height: 13px;
                flex-shrink: 0;
            }

            #crypto-info-geckoview .gv-categories {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 10px;
            }

            #crypto-info-geckoview .gv-category {
                font-size: 11px;
                color: var(--gv-text-muted);
                background: var(--gv-pill-bg);
                border-radius: 10px;
                padding: 2px 8px;
            }

            #crypto-info-geckoview .gv-category--more {
                font-style: italic;
            }

            #crypto-info-geckoview .gv-tabs {
                display: flex;
                gap: 14px;
                margin: 14px 0 10px;
                border-bottom: 1px solid var(--gv-border);
            }

            #crypto-info-geckoview .gv-tab {
                appearance: none;
                background: none;
                border: none;
                border-bottom: 2px solid transparent;
                padding: 0 0 7px;
                margin: 0;
                font: inherit;
                font-size: 12px;
                font-weight: 600;
                color: var(--gv-text-muted);
                cursor: pointer;
            }

            #crypto-info-geckoview .gv-tab:hover {
                color: var(--gv-text);
            }

            #crypto-info-geckoview .gv-tab--active {
                color: var(--gv-text);
                border-bottom-color: var(--gv-accent);
            }

            #crypto-info-geckoview .gv-upsell {
                padding: 16px 0;
                text-align: center;
            }

            #crypto-info-geckoview .gv-upsell p {
                margin: 0 0 8px;
                font-size: 12px;
                color: var(--gv-text-muted);
            }

            #crypto-info-geckoview .gv-upsell a {
                color: var(--gv-accent);
                font-size: 12px;
                text-decoration: none;
            }

            #crypto-info-geckoview .gv-upsell a:hover {
                text-decoration: underline;
            }

            #crypto-info-geckoview .gv-empty-state {
                font-size: 12px;
                color: var(--gv-text-muted);
                padding: 16px 0;
                margin: 0;
                text-align: center;
            }

            #crypto-info-geckoview .gv-exchange-list {
                display: flex;
                flex-direction: column;
            }

            #crypto-info-geckoview .gv-news-list,
            #crypto-info-geckoview .gv-insights-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            #crypto-info-geckoview .gv-news-item {
                display: block;
                text-decoration: none;
                color: inherit;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--gv-border);
            }

            #crypto-info-geckoview .gv-news-item:last-child,
            #crypto-info-geckoview .gv-insight-item:last-child {
                border-bottom: none;
                padding-bottom: 0;
            }

            #crypto-info-geckoview .gv-news-item__title,
            #crypto-info-geckoview .gv-insight-item__title {
                display: block;
                font-size: 12.5px;
                font-weight: 600;
                color: var(--gv-text);
                margin-bottom: 2px;
            }

            #crypto-info-geckoview .gv-news-item:hover .gv-news-item__title {
                color: var(--gv-accent);
            }

            #crypto-info-geckoview .gv-news-item__meta,
            #crypto-info-geckoview .gv-insight-item__meta {
                display: block;
                font-size: 11px;
                color: var(--gv-text-muted);
            }

            #crypto-info-geckoview .gv-exchange-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 0;
                border-bottom: 1px solid var(--gv-border);
                text-decoration: none;
                color: inherit;
            }

            #crypto-info-geckoview .gv-exchange-item:last-child {
                border-bottom: none;
                padding-bottom: 0;
            }

            #crypto-info-geckoview .gv-exchange-item__logo {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                flex-shrink: 0;
                object-fit: cover;
                background: var(--gv-pill-bg);
            }

            #crypto-info-geckoview .gv-exchange-item__main {
                display: flex;
                flex-direction: column;
                min-width: 0;
                flex: 1;
            }

            #crypto-info-geckoview .gv-exchange-item__name {
                font-size: 12.5px;
                font-weight: 600;
                color: var(--gv-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            #crypto-info-geckoview .gv-exchange-item:hover .gv-exchange-item__name {
                color: var(--gv-accent);
            }

            #crypto-info-geckoview .gv-exchange-item__pair {
                font-size: 11px;
                color: var(--gv-text-muted);
            }

            #crypto-info-geckoview .gv-exchange-item__values {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                flex-shrink: 0;
                text-align: right;
            }

            #crypto-info-geckoview .gv-exchange-item__price {
                font-size: 12.5px;
                font-weight: 600;
                color: var(--gv-text);
            }

            #crypto-info-geckoview .gv-exchange-item__volume {
                font-size: 11px;
                color: var(--gv-text-muted);
            }

            #crypto-info-geckoview .gv-insight-item {
                padding-bottom: 10px;
                border-bottom: 1px solid var(--gv-border);
            }

            #crypto-info-geckoview .gv-insight-item__desc {
                font-size: 12px;
                color: var(--gv-text);
                margin: 0 0 2px;
                line-height: 1.4;
            }

            #crypto-info-geckoview .gv-section-title {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: .03em;
                color: var(--gv-text-muted);
                margin: 16px 0 4px;
            }

            #crypto-info-geckoview .gv-stats {
                display: flex;
                flex-direction: column;
            }

            #crypto-info-geckoview .gv-stat-row {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 12px;
                padding: 7px 0;
                border-bottom: 1px solid var(--gv-border);
            }

            #crypto-info-geckoview .gv-stat-row:last-child {
                border-bottom: none;
            }

            #crypto-info-geckoview .gv-stat-row__label {
                font-size: 12px;
                color: var(--gv-text-muted);
                flex-shrink: 0;
            }

            #crypto-info-geckoview .gv-stat-row__value {
                font-size: 12.5px;
                font-weight: 600;
                color: var(--gv-text);
                text-align: right;
                word-break: break-word;
            }

            #crypto-info-geckoview .gv-loader-wrap {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px 0;
            }

            #crypto-info-geckoview .gv-loader {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                border: 3px solid var(--gv-border);
                border-top-color: var(--gv-accent);
                animation: gv-spin .8s linear infinite;
            }

            @keyframes gv-spin {
                to { transform: rotate(360deg); }
            }

            #crypto-info-geckoview .gv-error {
                color: var(--gv-danger);
                font-size: 12px;
                padding: 12px 0 0;
            }
        </style>
    `;
}

// Generic (non-brand) line icons for the social link row, 24x24 viewBox, stroke-based.
const GV_ICON_WEBSITE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"></path></svg>`;
const GV_ICON_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5L5 19"></path></svg>`;
const GV_ICON_SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>`;
const GV_ICON_CHAT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;

// Shared widget header, used by every response variant below. When `coin` is omitted this
// renders the plain "GeckoView" title (default/loading/error states); when provided it renders
// the coin's logo, name, symbol and market cap rank instead (successful data state).
function buildWidgetHeader(coin) {
    const identity = coin ? `
                <a class="gv-header__title" href="https://www.coingecko.com/en/coins/${escapeHtml(coin.id)}" target="_blank" title="${escapeHtml(coin.name)}">
                    <img class="gv-header__logo" src="${escapeHtml(coin.image)}" alt="">
                    <span>${escapeHtml(coin.name)}</span>
                    <span class="gv-header__symbol">${escapeHtml(coin.symbol)}</span>
                </a>
                <span class="gv-header__rank">#${coin.rank ? coin.rank : '?'}</span>` : `
                <span class="gv-header__title">GeckoView</span>`;

    const coingeckoLink = coin ? `https://www.coingecko.com/en/coins/${escapeHtml(coin.id)}` : `https://www.coingecko.com/`;

    return `
        <div class="gv-header">
            <div class="gv-header__identity">${identity}
            </div>
            <a class="gv-header__coingecko" href="${coingeckoLink}" target="_blank" title="View on CoinGecko">
                <img src="https://3936590801-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FuBDUa2ODcAkHHV15nEGc%2Ficon%2FdxukYF8Wxc39yBmmdpey%2FCoinGecko%20Logo.svg?alt=media&amp;token=cc062811-ede6-4788-815a-576f31cd16f9" alt="">
            </a>
        </div>
    `;
}

function buildHtmlHeaderResponse() {
    return `
        ${buildGeckoViewStyles()}
        ${buildWidgetHeader()}
        `;
}

function buildHtmlErrorResponse(data) {
    return `
        ${buildGeckoViewStyles()}
        ${buildWidgetHeader()}
        <p class="gv-error">Error fetching coin data: ${escapeHtml(data.error)}</p>
        `;
}

// The spinner alone, with no header - used both for the full-widget loading state below and for
// loading just a tab's content area (content.js swaps this into #gv-tab-content on tab click).
function buildLoaderFragment() {
    return `
        <div class="gv-loader-wrap">
            <div class="gv-loader"></div>
        </div>
    `;
}

function buildLoaderHtmlResponse() {
    return `
        ${buildGeckoViewStyles()}
        ${buildWidgetHeader()}
        ${buildLoaderFragment()}
    `;
}

// A single "label ... value" row in the Key stats list. `value` is expected to already be a
// safe/formatted string (from formatUsdOrNA/formatNumberOrNA/displayPrice) - only `label` is
// escaped here since callers below pass dynamic values but hardcoded label literals.
function buildStatRow(label, value) {
    return `
            <div class="gv-stat-row">
                <span class="gv-stat-row__label">${escapeHtml(label)}</span>
                <span class="gv-stat-row__value">${value}</span>
            </div>`;
}

// `settings` controls which stat rows are included (see settings.js / GV_STAT_OPTIONS). A
// missing settings object, or a missing/non-false key in it, defaults to "visible" - so calling
// buildHtmlResponse(data) without settings (e.g. in tests) still renders every stat, as before.
function isStatVisible(settings, key) {
    return !settings || settings[key] !== false;
}

// A coin can have anywhere from 0 to 20+ categories (CoinGecko's `categories` field, included by
// default in /coins/{id} - no extra API call). Cap how many pills render so one heavily-tagged
// coin can't blow out the widget's height; '' (hidden section entirely) when there are none.
const GV_MAX_VISIBLE_CATEGORIES = 6;

function buildCategoriesRow(categories) {
    const clean = Array.isArray(categories) ? categories.filter(c => typeof c === 'string' && c.trim()) : [];
    if (clean.length === 0) {
        return '';
    }

    const visible = clean.slice(0, GV_MAX_VISIBLE_CATEGORIES);
    const remaining = clean.length - visible.length;
    const pills = visible.map(c => `<span class="gv-category">${escapeHtml(c)}</span>`).join('');
    const more = remaining > 0 ? `<span class="gv-category gv-category--more">+${remaining} more</span>` : '';

    return `
        <div class="gv-categories">${pills}${more}</div>`;
}

// The pill-tab nav content.js wires click handling onto (event delegation on #crypto-info-geckoview,
// which persists across re-renders - see content.js). Tabs beyond "stats" are rendered lazily:
// their content isn't fetched until clicked, so only their nav button is built here.
const GV_TABS = [
    { id: 'stats', label: 'Key stats' },
    { id: 'exchanges', label: 'Exchanges' },
    { id: 'news', label: 'News' },
    { id: 'insights', label: 'Insights' }
];

function buildTabsNav(activeTab) {
    const tabs = GV_TABS.map(tab => `<button type="button" class="gv-tab${tab.id === activeTab ? ' gv-tab--active' : ''}" data-gv-tab="${tab.id}">${escapeHtml(tab.label)}</button>`).join('');
    return `
        <div class="gv-tabs" role="tablist">${tabs}</div>`;
}

// Shown in a tab's content area instead of fetching when the user doesn't have a paid CoinGecko
// key configured (News/Insights require the Analyst/Lite/Pro/Enterprise plans - see
// https://docs.coingecko.com/reference/news and https://docs.coingecko.com/reference/insights).
// content.js checks this client-side before ever sending a fetchCoinNews/fetchCoinInsights
// message, so a non-Pro user never wastes a doomed request on it.
function buildProUpsell(featureLabel) {
    return `
        <div class="gv-upsell">
            <p>${escapeHtml(featureLabel)} requires a paid CoinGecko plan (Analyst, Lite, Pro, or Enterprise).</p>
            <a href="https://www.coingecko.com/en/api/pricing" target="_blank">See CoinGecko plans</a>
        </div>`;
}

function buildNewsTabContent(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return `<p class="gv-empty-state">No recent news for this coin.</p>`;
    }

    const rows = items.map(item => {
        const meta = [item.source_name, formatDateOrEmpty(item.posted_at)].filter(Boolean).join(' · ');
        return `
            <a class="gv-news-item" href="${escapeHtml(item.url)}" target="_blank">
                <span class="gv-news-item__title">${escapeHtml(item.title)}</span>
                <span class="gv-news-item__meta">${escapeHtml(meta)}</span>
            </a>`;
    }).join('');

    return `<div class="gv-news-list">${rows}</div>`;
}

// `tickers` is the (already top-N-capped, see background.js) list from CoinGecko's
// /coins/{id}/tickers, sorted by volume - where this specific coin actually trades, not a
// generic exchange directory. market.logo needs background.js's include_exchange_logo=true param;
// falls back to a plain colored circle (no broken-image icon) when a ticker has no logo, or its
// logo URL fails to load.
function buildExchangesTabContent(tickers) {
    if (!Array.isArray(tickers) || tickers.length === 0) {
        return `<p class="gv-empty-state">No exchange listings found for this coin.</p>`;
    }

    const rows = tickers.map(ticker => {
        const market = ticker.market || {};
        const pair = [ticker.base, ticker.target].filter(Boolean).join('/');

        const priceUsd = ticker.converted_last && ticker.converted_last.usd;
        const volumeUsd = ticker.converted_volume && ticker.converted_volume.usd;

        const logo = market.logo
            ? `<img class="gv-exchange-item__logo" src="${escapeHtml(market.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
            : `<span class="gv-exchange-item__logo"></span>`;

        const content = `
                ${logo}
                <span class="gv-exchange-item__main">
                    <span class="gv-exchange-item__name">${escapeHtml(market.name || 'Unknown exchange')}</span>
                    <span class="gv-exchange-item__pair">${escapeHtml(pair)}</span>
                </span>
                <span class="gv-exchange-item__values">
                    <span class="gv-exchange-item__price">${(priceUsd === null || priceUsd === undefined) ? 'N/A' : displayPrice(priceUsd)}</span>
                    <span class="gv-exchange-item__volume">${(volumeUsd === null || volumeUsd === undefined) ? '' : `Vol ${formatCompactUsd(volumeUsd)}`}</span>
                </span>`;

        // data-gv-* carry what content.js needs to try resolving this straight to the matching
        // chart on TradingView itself on click (see openExchangeTickerLink() there), falling back
        // to this href (the exchange's own page) if that resolution fails for any reason.
        return ticker.trade_url
            ? `<a class="gv-exchange-item" href="${escapeHtml(ticker.trade_url)}" target="_blank" data-gv-exchange-name="${escapeHtml(market.name)}" data-gv-base="${escapeHtml(ticker.base)}" data-gv-target="${escapeHtml(ticker.target)}">${content}</a>`
            : `<div class="gv-exchange-item">${content}</div>`;
    }).join('');

    return `<div class="gv-exchange-list">${rows}</div>`;
}

function buildInsightsTabContent(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return `<p class="gv-empty-state">No insights available for this coin.</p>`;
    }

    const rows = items.map(item => {
        const postedDate = formatDateOrEmpty(item.posted_at);
        return `
            <div class="gv-insight-item">
                <div class="gv-insight-item__title">${escapeHtml(item.title)}</div>
                ${item.description ? `<div class="gv-insight-item__desc">${escapeHtml(item.description)}</div>` : ''}
                ${postedDate ? `<div class="gv-insight-item__meta">${escapeHtml(postedDate)}</div>` : ''}
            </div>`;
    }).join('');

    return `<div class="gv-insights-list">${rows}</div>`;
}

// The "Key stats" tab's content - pulled out of buildHtmlResponse so content.js can re-render just
// this tab (e.g. switching back from News/Insights) from already-fetched data, with no new fetch.
function buildKeyStatsTabContent(data, settings) {
    let CFORMAT_USD = new Intl.NumberFormat('en-EN', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
    let CFORMAT_NR = new Intl.NumberFormat('en-EN', { minimumFractionDigits: 0 });

    const formatUsdOrNA = (value) => (value === null || value === undefined) ? 'N/A' : CFORMAT_USD.format(value);
    const formatNumberOrNA = (value) => (value === null || value === undefined) ? 'N/A' : CFORMAT_NR.format(value);

    const marketData = data.market_data || {};
    const circulatingPercentage = formatCirculatingPercentage(marketData.circulating_supply, marketData.total_supply);

    const statRows = [
        isStatVisible(settings, 'showMarketCap') && buildStatRow('Market cap', formatUsdOrNA(marketData.market_cap && marketData.market_cap.usd)),
        isStatVisible(settings, 'showFullyDilutedValuation') && buildStatRow('Fully diluted valuation', formatUsdOrNA(marketData.fully_diluted_valuation && marketData.fully_diluted_valuation.usd)),
        isStatVisible(settings, 'showTotalVolume') && buildStatRow('24h total volume', formatUsdOrNA(marketData.total_volume && marketData.total_volume.usd)),
        isStatVisible(settings, 'showTotalSupply') && buildStatRow('Total supply', formatNumberOrNA(marketData.total_supply)),
        isStatVisible(settings, 'showCirculatingSupply') && buildStatRow('Circulating supply', `${formatNumberOrNA(marketData.circulating_supply)}${circulatingPercentage}`),
        isStatVisible(settings, 'showAthAtl') && buildStatRow('ATL / ATH', `${displayPrice(marketData.atl && marketData.atl.usd)} / ${displayPrice(marketData.ath && marketData.ath.usd)}`)
    ].filter(Boolean).join('');

    if (!statRows) {
        return `<p class="gv-empty-state">No stats selected — enable some in the GeckoView popup.</p>`;
    }

    return `
        <div class="gv-stats">${statRows}
        </div>`;
}

function buildHtmlResponse(data, settings) {
    // CoinGecko can return null/undefined/empty-string/empty-array for any of these, not just ''
    // (background.js validates `data.links` exists before calling this, but defaulting to {} here
    // too costs nothing and means this function alone can never throw on a malformed `data`).
    const links = data.links || {};
    const twitterHandle = links.twitter_screen_name;
    const homepageUrl = links.homepage && links.homepage[0];
    const telegramId = links.telegram_channel_identifier;
    const discordUrl = links.chat_url && links.chat_url[0];

    const twitter = twitterHandle ? `<a target="_blank" href="https://x.com/${escapeHtml(twitterHandle)}">${GV_ICON_X} Twitter</a>` : ``;
    const homepage = homepageUrl ? `<a target="_blank" href="${escapeHtml(homepageUrl)}">${GV_ICON_WEBSITE} Website</a>` : ``;
    const telegram = telegramId ? `<a target="_blank" href="https://t.me/${escapeHtml(telegramId)}">${GV_ICON_SEND} Telegram</a>` : ``;
    const discord = discordUrl ? `<a target="_blank" href="${escapeHtml(discordUrl)}">${GV_ICON_CHAT} Discord</a>` : ``;

    const linksRow = (homepage || twitter || telegram || discord) ? `
        <div class="gv-links">
            ${homepage}
            ${twitter}
            ${telegram}
            ${discord}
        </div>` : ``;

    return `
        ${buildGeckoViewStyles()}
        ${buildWidgetHeader({
            image: data.image && data.image.thumb,
            id: data.id,
            name: data.name,
            symbol: (data.symbol || '').toUpperCase(),
            rank: data.market_cap_rank
        })}
        ${linksRow}
        ${buildCategoriesRow(data.categories)}
        ${buildTabsNav('stats')}
        <div class="gv-tab-content" id="gv-tab-content">
            ${buildKeyStatsTabContent(data, settings)}
        </div>
    `;
}
