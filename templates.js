// HTML template builders for the GeckoView widget panel. Depends on the helpers in utils.js
// (escapeHtml, displayPrice, formatCirculatingPercentage) being loaded first — see manifest.json.

// Shared widget header, used by every response variant below. When `coin` is omitted this
// renders the plain "GeckoView" title (default/loading/error states); when provided it renders
// the coin's logo, name, symbol and market cap rank instead (successful data state).
function buildWidgetHeader(coin) {
    const titleContent = coin ? `
                <span class="logo-d0vVmGvT container-M1mz4quA">
                    <span class="logo-M1mz4quA">
                        <img crossorigin="" decoding="async" src="${escapeHtml(coin.image)}">
                    </span>
                </span>

                <span class="title-ZJX9Rmzv">
                    <a style="color: black;" title="" href="https://www.coingecko.com/en/coins/${escapeHtml(coin.id)}" target="_blank">
                        ${escapeHtml(coin.name)} (${escapeHtml(coin.symbol)})

                        <span class="widget-rank">#${coin.rank ? coin.rank : '?'}</span>
                    </a>
                </span>` : `
                <span class="title-ZJX9Rmzv">
                    GeckoView
                </span>`;

    const coingeckoLink = coin ? `https://www.coingecko.com/en/coins/${escapeHtml(coin.id)}` : `https://www.coingecko.com/`;

    return `
        <div class="widgetHeader-X9EuSe_t">
            <div class="container-ZJX9Rmzv">
                ${titleContent}

                <div class="groupWrap-ZJX9Rmzv hasDisabledSet-ZJX9Rmzv">
                    <span class="coingecko">
                        <a title="" href="${coingeckoLink}" target="_blank">
                            <img alt="" style="width:25px;" loading="lazy" fetchpriority="high" class="" src="https://3936590801-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FuBDUa2ODcAkHHV15nEGc%2Ficon%2FdxukYF8Wxc39yBmmdpey%2FCoinGecko%20Logo.svg?alt=media&amp;token=cc062811-ede6-4788-815a-576f31cd16f9">
                        </a>
                    </span>
                </div>
            </div>
        </div>
    `;
}

function buildHtmlHeaderResponse() {
    return `
        <style>
            .widget-rank {
                background-color: rgb(241 245 249 / var(--tw-bg-opacity));
                --tw-bg-opacity: 1;
                padding-left: .375rem;
                padding-right: .375rem;
                padding-top: .125rem;
                padding-bottom: .125rem;
            }
        </style>

        ${buildWidgetHeader()}
        `;
}

function buildHtmlErrorResponse(data) {
    return `
        <style>
            .error {
                color: red;
                margin: 14px;
            }
        </style>

        ${buildWidgetHeader()}

        <div class="widgetbar-widgetbody" style="height: 80px;">
            <div class="container-Tv7LSjUz">
                <p class="error">Error fetching coin data: ${escapeHtml(data.error)}</p>
            </div>
        </div>
        `;
}

function buildLoaderHtmlResponse() {
    return `
        <style>
        .loader {
                    margin: auto;
                    border: 5px solid #f3f3f3;
                    border-top: 5px solid #555;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    animation: spin 2s linear infinite;
                    -webkit-animation: spin 1s linear infinite;
                }

            /* Safari */
            @-webkit-keyframes spin {
            0% { -webkit-transform: rotate(0deg); }
            100% { -webkit-transform: rotate(360deg); }
            }

            @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
            }
        </style>

        ${buildWidgetHeader()}

        <div class="widgetbar-widgetbody" style="height: 180px;">
            <div class="container-Tv7LSjUz">
                <div class="loader"></div>
            </div>
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

    const twitter = twitterHandle ? `<a target="_blank" href="https://x.com/${escapeHtml(twitterHandle)}" tabindex="-1" class="button-vll9ujXF">
                    <img alt="" class="tv-footer-socials__icon-image" src="/static/bundles/ui-lib/icons/28px-filled/social-icons/x-twitter-color-off.svg" loading="lazy" height="18" width="18">
                    Twitter
                </a>` : ``;
    const homepage = homepageUrl ? `<a target="_blank" href="${escapeHtml(homepageUrl)}" tabindex="-1" class="button-vll9ujXF">
                    <svg width="18" height="18" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M12.1 4.69a9.54 9.54 0 0 1 3.8 0c.52 1.13.95 2.65 1.23 4.42a12.5 12.5 0 0 1-6.26 0c.28-1.77.71-3.29 1.23-4.42Zm-1.84.57a9.52 9.52 0 0 0-3.04 2.08c.63.51 1.38.95 2.2 1.3.22-1.25.5-2.39.84-3.38Zm-1.05 4.9c-1.1-.42-2.1-.98-2.95-1.67a9.46 9.46 0 0 0 0 11.03c.86-.68 1.86-1.24 2.96-1.66a33.91 33.91 0 0 1 0-7.7Zm.22 9.23c-.82.34-1.56.78-2.2 1.28a9.52 9.52 0 0 0 3.03 2.07 21.2 21.2 0 0 1-.83-3.35Zm2.67 3.92a17.46 17.46 0 0 1-1.23-4.4 12.2 12.2 0 0 1 6.26 0 17.46 17.46 0 0 1-1.23 4.4 9.54 9.54 0 0 1-3.8 0Zm5.64-.57a9.52 9.52 0 0 0 3.03-2.07 9.62 9.62 0 0 0-2.2-1.28 21.2 21.2 0 0 1-.83 3.35Zm1.04-4.88c1.1.42 2.1.98 2.95 1.66a9.46 9.46 0 0 0 .01-11.03c-.85.7-1.85 1.25-2.95 1.67a33.93 33.93 0 0 1 0 7.7Zm-1.45-7.25a14.06 14.06 0 0 1-6.66 0 32.64 32.64 0 0 0 0 6.8 13.74 13.74 0 0 1 6.66 0 32.62 32.62 0 0 0 0-6.8Zm1.24-1.98a9.1 9.1 0 0 0 2.2-1.29 9.52 9.52 0 0 0-3.03-2.08c.34 1 .62 2.13.83 3.37ZM14 3a11 11 0 1 0 0 22 11 11 0 0 0 0-22Z" fill="currentColor"></path></svg>
                    Website
                </a>` : ``;
    const telegram = telegramId ? ` <a target="_blank" href="https://t.me/${escapeHtml(telegramId)}" tabindex="-1" class="button-vll9ujXF">
                    <img alt="" class="tv-footer-socials__icon-image" src="/static/bundles/ui-lib/icons/28px-filled/social-icons/telegram-color-off.svg" loading="lazy" height="18" width="18">
                    Telegram
                </a>` : ``;
    const discord = discordUrl ? ` <a target="_blank" href="${escapeHtml(discordUrl)}" tabindex="-1" class="button-vll9ujXF">
                    <img alt="" class="tv-footer-socials__icon-image" src="/static/bundles/ui-lib/icons/28px-filled/social-icons/discord-color-off.svg" loading="lazy" height="18" width="18">
                    Discord
                </a>` : ``;

    return `

        <style>
            .widget-rank {
                background-color: rgb(241 245 249 / var(--tw-bg-opacity));
                --tw-bg-opacity: 1;
                padding-left: .375rem;
                padding-right: .375rem;
                padding-top: .125rem;
                padding-bottom: .125rem;
            }
        </style>

        ${buildWidgetHeader({
            image: data.image.thumb,
            id: data.id,
            name: data.name,
            symbol: data.symbol.toUpperCase(),
            rank: data.market_cap_rank
        })}

        <div class="widgetWrapper-BSF4XTsE">
            <div class="buttonContainer-vll9ujXF" data-name="details-more-technicals-button">
                ${homepage}
                ${twitter}
                ${telegram}
                ${discord}
            </div>
        </div>

        <div class="widgetbar-widgetbody" style="height: 180px;">
            <div class="container-Tv7LSjUz">

                <div class="widgetWrapper-BSF4XTsE" data-name="details-key-stats">
                    <div class="container-Wrldc8m4 title-KSzJG6_A">
                        <span>Key stats</span>
                    </div>
                    <div class="items-KSzJG6_A">
                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>Market cap</span>
                            </div>
                            <span class="data-cXDWtdxq">‪${formatUsdOrNA(data.market_data.market_cap.usd)}‬</span>
                        </div>

                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>Fully diluted valuation</span>
                            </div>
                            <span class="data-cXDWtdxq">‪${formatUsdOrNA(data.market_data.fully_diluted_valuation.usd)}‬</span>
                        </div>

                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>24h Total Volume</span>
                            </div>
                            <span class="data-cXDWtdxq">‪${formatUsdOrNA(data.market_data.total_volume.usd)}‬</span>
                        </div>

                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>Total supply</span>
                            </div>
                            <span class="data-cXDWtdxq">‪${formatNumberOrNA(data.market_data.total_supply)}‬</span>
                        </div>

                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>Circulating supply</span>
                            </div>
                            <span class="data-cXDWtdxq">‪${formatNumberOrNA(data.market_data.circulating_supply)}${formatCirculatingPercentage(data.market_data.circulating_supply, data.market_data.total_supply)}‬</span>
                        </div>

                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>ATL / ATH</span>
                            </div>
                            <span class="data-cXDWtdxq">
                                ‪
                                    <span title="All time low">${displayPrice(data.market_data.atl.usd)}</span>
                                    /
                                    <span title="All time high">${displayPrice(data.market_data.ath.usd)}</span>
                                ‬
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;
}
