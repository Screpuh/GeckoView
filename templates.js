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
                --gv-up: #16a34a;
                --gv-up-bg: #e9f9ef;
                --gv-down: #e04b4b;
                --gv-down-bg: #fdeaea;
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
                --gv-up: #3dd68c;
                --gv-up-bg: rgba(61, 214, 140, 0.15);
                --gv-down: #f26868;
                --gv-down-bg: rgba(242, 104, 104, 0.15);
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

            #crypto-info-geckoview .gv-price-row {
                display: flex;
                align-items: baseline;
                gap: 8px;
                margin-top: 6px;
            }

            #crypto-info-geckoview .gv-price {
                font-size: 19px;
                font-weight: 700;
                color: var(--gv-text);
            }

            #crypto-info-geckoview .gv-price-change {
                font-size: 12px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 4px;
                flex-shrink: 0;
            }

            #crypto-info-geckoview .gv-price-change--up {
                color: var(--gv-up);
                background: var(--gv-up-bg);
            }

            #crypto-info-geckoview .gv-price-change--down {
                color: var(--gv-down);
                background: var(--gv-down-bg);
            }

            #crypto-info-geckoview .gv-price-change--na {
                color: var(--gv-text-muted);
                background: var(--gv-pill-bg);
            }

            #crypto-info-geckoview .gv-sparkline-wrap {
                margin: 10px 0 2px;
            }

            #crypto-info-geckoview .gv-sparkline {
                display: block;
                width: 100%;
                height: 36px;
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

// Renders CoinGecko's 7-day hourly price series (market_data.sparkline_in_7d.price) as a plain
// SVG polyline, colored to match the 24h trend direction shown in the price-change badge next
// to it. Returns '' when there's no usable price series (missing field, too few points, etc.)
// — buildSparklinePoints (utils.js) is what actually decides "usable".
function buildSparklineSvg(prices, isUp) {
    const width = 100;
    const height = 36;
    const points = buildSparklinePoints(prices, width, height);
    if (!points) {
        return '';
    }

    const strokeVar = isUp ? 'var(--gv-up)' : 'var(--gv-down)';
    return `
        <div class="gv-sparkline-wrap">
            <svg class="gv-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <polyline points="${points}" fill="none" stroke="${strokeVar}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
            </svg>
        </div>
    `;
}

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

function buildHtmlResponse(data) {
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

    // CoinGecko's own "is this up or down" number (24h %). Used for both the badge and to color
    // the sparkline, so the two always agree even if the 7-day trend line disagrees with the 24h one.
    const currentPrice = data.market_data.current_price && data.market_data.current_price.usd;
    const priceChangePct = data.market_data.price_change_percentage_24h;
    const hasChangePct = typeof priceChangePct === 'number' && Number.isFinite(priceChangePct);
    const isUp = !hasChangePct || priceChangePct >= 0;
    const changeClass = !hasChangePct ? 'gv-price-change--na' : (isUp ? 'gv-price-change--up' : 'gv-price-change--down');
    const changeText = !hasChangePct ? 'N/A' : `${priceChangePct >= 0 ? '+' : ''}${priceChangePct.toFixed(2)}%`;

    const sparklinePrices = data.market_data.sparkline_in_7d && data.market_data.sparkline_in_7d.price;
    const sparklineSvg = buildSparklineSvg(sparklinePrices, isUp);

    return `
        ${buildGeckoViewStyles()}
        ${buildWidgetHeader({
            image: data.image.thumb,
            id: data.id,
            name: data.name,
            symbol: data.symbol.toUpperCase(),
            rank: data.market_cap_rank
        })}
        <div class="gv-price-row">
            <span class="gv-price">${displayPrice(currentPrice)}</span>
            <span class="gv-price-change ${changeClass}">${changeText}</span>
        </div>
        ${sparklineSvg}
        ${linksRow}

        <div class="gv-section-title">Key stats</div>
        <div class="gv-stats">
            <div class="gv-stat-row">
                <span class="gv-stat-row__label">Market cap</span>
                <span class="gv-stat-row__value">${formatUsdOrNA(data.market_data.market_cap.usd)}</span>
            </div>
            <div class="gv-stat-row">
                <span class="gv-stat-row__label">Fully diluted valuation</span>
                <span class="gv-stat-row__value">${formatUsdOrNA(data.market_data.fully_diluted_valuation.usd)}</span>
            </div>
            <div class="gv-stat-row">
                <span class="gv-stat-row__label">24h total volume</span>
                <span class="gv-stat-row__value">${formatUsdOrNA(data.market_data.total_volume.usd)}</span>
            </div>
            <div class="gv-stat-row">
                <span class="gv-stat-row__label">Total supply</span>
                <span class="gv-stat-row__value">${formatNumberOrNA(data.market_data.total_supply)}</span>
            </div>
            <div class="gv-stat-row">
                <span class="gv-stat-row__label">Circulating supply</span>
                <span class="gv-stat-row__value">${formatNumberOrNA(data.market_data.circulating_supply)}${circulatingPercentage}</span>
            </div>
            <div class="gv-stat-row">
                <span class="gv-stat-row__label">ATL / ATH</span>
                <span class="gv-stat-row__value">${displayPrice(data.market_data.atl.usd)} / ${displayPrice(data.market_data.ath.usd)}</span>
            </div>
        </div>
    `;
}
