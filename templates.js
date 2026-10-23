// HTML template builders for the GeckoView widget panel. Depends on the helpers in utils.js
// (escapeHtml, displayPrice, formatCirculatingPercentage) being loaded first — see manifest.json.
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

function buildLoaderHtmlResponse() {
    return `
        ${buildGeckoViewStyles()}
        ${buildWidgetHeader()}
        <div class="gv-loader-wrap">
            <div class="gv-loader"></div>
        </div>
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

function buildHtmlResponse(data, settings) {
    let CFORMAT_USD = new Intl.NumberFormat('en-EN', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
    let CFORMAT_NR = new Intl.NumberFormat('en-EN', { minimumFractionDigits: 0 });

    const formatUsdOrNA = (value) => (value === null || value === undefined) ? 'N/A' : CFORMAT_USD.format(value);
    const formatNumberOrNA = (value) => (value === null || value === undefined) ? 'N/A' : CFORMAT_NR.format(value);

    // CoinGecko can return null/undefined/empty-string/empty-array for any of these, not just ''
    const twitterHandle = data.links.twitter_screen_name;
    const homepageUrl = data.links.homepage && data.links.homepage[0];
    const telegramId = data.links.telegram_channel_identifier;
    const discordUrl = data.links.chat_url && data.links.chat_url[0];

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

    const circulatingPercentage = formatCirculatingPercentage(data.market_data.circulating_supply, data.market_data.total_supply);

    const statRows = [
        isStatVisible(settings, 'showMarketCap') && buildStatRow('Market cap', formatUsdOrNA(data.market_data.market_cap.usd)),
        isStatVisible(settings, 'showFullyDilutedValuation') && buildStatRow('Fully diluted valuation', formatUsdOrNA(data.market_data.fully_diluted_valuation.usd)),
        isStatVisible(settings, 'showTotalVolume') && buildStatRow('24h total volume', formatUsdOrNA(data.market_data.total_volume.usd)),
        isStatVisible(settings, 'showTotalSupply') && buildStatRow('Total supply', formatNumberOrNA(data.market_data.total_supply)),
        isStatVisible(settings, 'showCirculatingSupply') && buildStatRow('Circulating supply', `${formatNumberOrNA(data.market_data.circulating_supply)}${circulatingPercentage}`),
        isStatVisible(settings, 'showAthAtl') && buildStatRow('ATL / ATH', `${displayPrice(data.market_data.atl.usd)} / ${displayPrice(data.market_data.ath.usd)}`)
    ].filter(Boolean).join('');

    const statsSection = statRows ? `
        <div class="gv-section-title">Key stats</div>
        <div class="gv-stats">${statRows}
        </div>` : ``;

    return `
        ${buildGeckoViewStyles()}
        ${buildWidgetHeader({
            image: data.image.thumb,
            id: data.id,
            name: data.name,
            symbol: data.symbol.toUpperCase(),
            rank: data.market_cap_rank
        })}
        ${linksRow}
        ${statsSection}
    `;
}
