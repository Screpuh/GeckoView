// This script will run on the page and will be responsible for fetching the data from the coingecko api.
// Depends on helpers from utils.js and templates.js, loaded first — see manifest.json.

// Set once the MutationObserver is attached, so updateCryptoContent() can stop it (see
// isExtensionContextValid() below) once the extension context is gone and retrying is pointless.
let geckoViewObserver = null;

// Current settings (see settings.js), used by updateCryptoContent() to decide which stat rows to
// render. Starts at the defaults so nothing is unexpectedly hidden before the real settings load.
let geckoViewSettings = GV_DEFAULT_SETTINGS;

// The last successfully-fetched coin, and which tab is currently showing. Both reset whenever a
// new successful/failed fetch starts (see updateCryptoContent()), so a stale News/Insights click
// response from a symbol the user has since navigated away from can never render over new data.
let currentCoinData = null;
let activeTab = 'stats';

// Height of #gv-tab-content, in px - see setupTabContentResize() below. Lives at module scope
// (not stored on any element) so a drag's chosen height survives updateCryptoContent()/renderTab()
// reassigning innerHTML on every symbol/tab change within this page load; it intentionally does
// NOT persist across a full page reload - this is an ad hoc "make more room right now" control,
// not a setting.
let gvTabContentHeight = 360;
const GV_MIN_TAB_CONTENT_HEIGHT = 120;
const GV_MAX_TAB_CONTENT_HEIGHT = 900;

window.onload = function() {
    // This code will run when the entire page has finished loading, including stylesheets, images, etc.
    getGeckoViewSettings().then(settings => {
        geckoViewSettings = settings;

        // Independent of the widget's own enabled/disabled state below - a user might want this
        // even with the widget turned off, or vice versa.
        if (settings.autoCloseAdBlockerPopup) {
            setupAdBlockerPopupAutoClose();
        }

        // The master on/off toggle only takes effect on page load (toggling it in the popup while
        // this tab is open needs a refresh) - unlike the per-stat toggles below, which apply live.
        if (!settings.enabled) {
            return;
        }

        const existingDiv = document.querySelector('.widgetbar-page.active');
        if (!existingDiv) {
            return;
        }
        const newDiv = document.createElement('div');

        newDiv.id = 'crypto-info-geckoview';
        newDiv.innerHTML = buildHtmlHeaderResponse();
        existingDiv.insertBefore(newDiv, existingDiv.firstChild);
        setupTabContentResize(newDiv);

        // Attached once, here, rather than re-attached on every re-render: newDiv itself is never
        // replaced (only its innerHTML is, on every updateCryptoContent()/renderTab() call), so a
        // listener on it survives those re-renders. Event delegation handles clicks on the tab
        // buttons/exchange rows that don't exist yet at the time this listener is attached.
        newDiv.addEventListener('click', event => {
            // Scrolling #gv-tab-content doesn't help reach TradingView's own watchlist/other
            // panels below GeckoView - confirmed live that their real scroll container around all
            // of this (.widgetbar-pagescontent) has overflow-y: hidden with a fixed height, so
            // anything pushed past it is genuinely unreachable. Collapsing instead hides
            // everything but the header (see the .gv-collapsed CSS, templates.js) - toggled on
            // newDiv itself (never replaced, only its innerHTML is), so it survives re-renders the
            // same way the resize height in setupTabContentResize() does.
            if (event.target.closest('#gv-collapse-toggle')) {
                newDiv.classList.toggle('gv-collapsed');
                return;
            }

            const tabButton = event.target.closest('[data-gv-tab]');
            if (tabButton) {
                renderTab(tabButton.dataset.gvTab);
                return;
            }

            const exchangeLink = event.target.closest('.gv-exchange-item[data-gv-base]');
            // Only take over a plain left-click; a modified click (open in new tab/window, etc.)
            // falls through to the native <a href> behavior untouched.
            if (exchangeLink && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                openExchangeTickerLink(
                    exchangeLink.dataset.gvExchangeName,
                    exchangeLink.dataset.gvBase,
                    exchangeLink.dataset.gvTarget,
                    exchangeLink.getAttribute('href')
                );
                return;
            }

            // Trending rows are plain <button>s (no href to modifier-click through to - see
            // buildTrendingTabContent()), so there's no native-behavior case to leave alone here.
            const trendingItem = event.target.closest('.gv-trending-item[data-gv-trending-coin-id]');
            if (trendingItem) {
                openTrendingCoinChart(trendingItem.dataset.gvTrendingCoinId, trendingItem);
            }
        });

        updateCryptoContent();

        function handleMutation(mutationsList, observer) {
            mutationsList.forEach(mutation => {

                // we have to wait a bit for the changes to load so we can fetch the data from the html
                sleep(500).then(() => {
                    updateCryptoContent();
                });
            });
        }

        // Function to set up MutationObserver on the target element
        function setupMutationObserver() {
            const targetElement = document.querySelector('#header-toolbar-symbol-search');
            if (!targetElement) {
                return;
            }

            geckoViewObserver = new MutationObserver(handleMutation);
            geckoViewObserver.observe(targetElement, {
                childList: true,      // Watch for changes in child elements
                subtree: true,        // Watch all descendants of targetElement
                attributes: true,     // Watch for attribute changes
                characterData: true   // Watch for changes in text content of targetElement
            });

            // Optionally, trigger the initial handling function
            handleMutation([], geckoViewObserver); // Initial run
        }

        setupMutationObserver();
    });

    // Live-apply per-stat visibility changes made in the popup, without needing a page refresh.
    // Harmless no-op if the widget was never injected (enabled: false, or updateCryptoContent
    // bails out immediately since #crypto-info-geckoview doesn't exist).
    watchGeckoViewSettings(settings => {
        geckoViewSettings = settings;
        updateCryptoContent();
    });
};

// Lets #gv-tab-content be resized by dragging #gv-resize-handle below it, the same way
// TradingView's own watchlist/detail panels can be - see buildResizeHandle() (templates.js) for
// why this is self-built rather than hooked into TradingView's own (undocumented, internal)
// resize mechanism. The height is applied as a CSS custom property on `geckoViewDiv` itself
// (#crypto-info-geckoview, the outer div that's never replaced - only its innerHTML is, on every
// re-render), not on #gv-tab-content directly, so it survives those re-renders without needing to
// be reapplied on each one; buildGeckoViewStyles() reads it via `var(--gv-tab-content-height,
// 360px)`. Delegated on `geckoViewDiv` the same way the click listener in window.onload is, since
// the handle itself doesn't exist yet at the time this is attached (it's part of the HTML
// innerHTML sets later).
function setupTabContentResize(geckoViewDiv) {
    geckoViewDiv.style.setProperty('--gv-tab-content-height', `${gvTabContentHeight}px`);

    geckoViewDiv.addEventListener('mousedown', event => {
        const handle = event.target.closest('#gv-resize-handle');
        if (!handle) {
            return;
        }
        event.preventDefault();

        const contentEl = geckoViewDiv.querySelector('#gv-tab-content');
        const startY = event.clientY;
        const startHeight = contentEl ? contentEl.getBoundingClientRect().height : gvTabContentHeight;
        handle.classList.add('gv-resize-handle--active');

        const onMouseMove = moveEvent => {
            const requested = startHeight + (moveEvent.clientY - startY);
            gvTabContentHeight = Math.min(GV_MAX_TAB_CONTENT_HEIGHT, Math.max(GV_MIN_TAB_CONTENT_HEIGHT, requested));
            geckoViewDiv.style.setProperty('--gv-tab-content-height', `${gvTabContentHeight}px`);
        };

        const onMouseUp = () => {
            handle.classList.remove('gv-resize-handle--active');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// Auto-dismisses TradingView's own "Ad blocker detected" upgrade-nag dialog the moment it
// appears. TradingView renders it (and other unrelated upgrade prompts) into a shared portal
// container (#overlap-manager-root) as data-dialog-name="gopro" - that attribute alone isn't
// specific enough, so isAdBlockerDialogText() (utils.js) checks the dialog's own text before this
// touches anything, leaving other "upgrade to Pro" prompts the user might actually want alone.
// Confirmed against the live dialog: [data-qa-id="promo-dialog-close-button"] is TradingView's own
// close button, so clicking it runs their own dismiss/cleanup logic rather than us just hiding or
// removing the element (which could leave e.g. a scroll-lock body class stuck behind).
function setupAdBlockerPopupAutoClose() {
    function tryCloseAdBlockerDialog() {
        const dialog = document.querySelector('[data-dialog-name="gopro"]');
        if (!dialog || !isAdBlockerDialogText(dialog.textContent)) {
            return;
        }

        const closeButton = dialog.querySelector('[data-qa-id="promo-dialog-close-button"]');
        if (closeButton) {
            closeButton.click();
        }
    }

    const observer = new MutationObserver(tryCloseAdBlockerDialog);
    observer.observe(document.body, { childList: true, subtree: true });

    tryCloseAdBlockerDialog(); // in case it's already open by the time this runs
}

// Clicking an Exchanges-tab row ideally jumps straight to that exact pair on TradingView's own
// chart (e.g. "COINBASE:BTCUSD") IN PLACE - exactly like clicking a result in TradingView's own
// symbol-search box does: no new tab, no reload, drawings/indicators preserved - rather than out
// to the exchange's own website. There's no official way to do either half of this:
//
// 1. Resolving a CoinGecko ticker (exchange + base/target) to a TradingView symbol calls
//    symbol-search.tradingview.com/symbol_search/v3/ - an undocumented endpoint found by watching
//    TradingView's own search box make network requests, not a published API. It could change or
//    disappear without notice.
// 2. Actually switching the chart to that symbol in place calls
//    `window._exposed_chartWidgetCollection.setSymbol(tvSymbol)` - confirmed live to be exactly
//    what TradingView's own search-result click does, by hooking the real method and watching
//    TradingView's own UI call it. This is NOT the documented Charting Library embed API (that's a
//    different, published thing for third-party embeds) - it's an undocumented, minified internal
//    object on the main site itself, reverse-engineered by runtime inspection, with zero stability
//    guarantee: it can change shape or disappear on any TradingView deploy, not just a redesign.
//    Two separate blind guesses at its argument shape each caused real, live-confirmed breakage:
//    a guessed 2nd-argument object unexpectedly popped open TradingView's own search dialog, and a
//    guessed 3rd-argument callback (an earlier version of this code passed one, on the wrong
//    assumption that `setSymbol` takes a completion callback) made TradingView's own code crash
//    trying to call `.hasModel()` on that function - the real signature is
//    `setSymbol(symbol, linkingGroupIndex, chartWidgetOverride)`, no callback at all, and a
//    function in that 3rd slot gets treated as a chart-widget object to filter alongside the real
//    ones. Omitting both optional arguments (as done now) lets them default to the current linking
//    group and the active chart widget - exactly what's wanted here - and its actual effect is
//    still verified against the DOM (see the injected function below) rather than trusted on
//    faith, since a second real TradingView UI click during testing didn't even route through the
//    same method.
//
// `_exposed_chartWidgetCollection` lives on the PAGE's own `window`, in the page's main JS world -
// content scripts run in an *isolated* world with their own separate `window` that cannot see it
// (confirmed live: directly reading `window._exposed_chartWidgetCollection` from this file is
// always undefined, even though the identical-looking read succeeds from the page's own console).
// Reaching it needs `chrome.scripting.executeScript(..., { world: 'MAIN' })`, which only the
// background service worker can call (content scripts have no `chrome.scripting` access) - hence
// the `switchTradingViewSymbol` message to `background.js` below, which runs the injected function
// in the page's real world and relays back whether the DOM confirms it worked.
//
// On any failure anywhere in this chain (network error, no symbol-search match, endpoint
// changed/gone, `_exposed_chartWidgetCollection` missing/reshaped, or the switch not visibly
// taking effect) this falls back to the ticker's own `fallbackUrl` (`trade_url`) - exactly the
// pre-feature behavior, opened the same way the native link click would have. There is
// deliberately no other fallback (e.g. opening the resolved TradingView symbol in a new tab): the
// in-place switch or nothing is the whole point of this feature.
function openExchangeTickerLink(exchangeName, base, target, fallbackUrl) {
    const openFallback = () => {
        if (fallbackUrl) {
            window.open(fallbackUrl, '_blank', 'noopener');
        }
    };

    if (!isExtensionContextValid()) {
        openFallback();
        return;
    }

    const query = `${normalizeTickerSymbol(base)}${normalizeTickerSymbol(target)}`;
    if (!query) {
        openFallback();
        return;
    }

    fetch(`https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(query)}&hl=1&lang=en&domain=production`)
        .then(response => response.ok ? response.json() : Promise.reject(new Error('symbol search failed')))
        .then(data => {
            const tvSymbol = findTradingViewSymbolMatch(data.symbols, exchangeName, base, target);
            if (!tvSymbol) {
                openFallback();
                return;
            }
            trySwitchSymbolInPlace(tvSymbol, query).then(switched => {
                if (!switched) {
                    openFallback();
                }
            });
        })
        .catch(openFallback);
}

// Asks background.js to run the in-page switch in the page's main JS world (see
// openExchangeTickerLink() above for why). Wrapped in try/catch since
// chrome.runtime.sendMessage can throw synchronously if the extension context has just been
// invalidated, same as elsewhere in this file. Resolves `false` (never rejects) on any failure -
// message channel error, background.js reporting the switch didn't verify, or an exception - so
// callers can treat this as a plain yes/no.
function trySwitchSymbolInPlace(tvSymbol, wantedSymbol) {
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage({ action: 'switchTradingViewSymbol', tvSymbol, wantedSymbol }, response => {
                resolve(!chrome.runtime.lastError && !!response && response.success === true);
            });
        } catch (e) {
            resolve(false);
        }
    });
}

// Trending rows don't know their target exchange up front (see buildTrendingTabContent() -
// trending is global, not about any one coin's tickers the way the Exchanges tab already has
// them loaded). This resolves one by reusing the same ranked-exchanges fetch the Exchanges tab
// uses (fetchCoinExchanges/rankExchangeTickers, background.js), taking the top-ranked ticker as
// "this coin's top exchange", then handing off to openExchangeTickerLink() for the actual
// resolve-to-TradingView-symbol-and-switch-in-place work - no need to duplicate any of that here.
// Falls back to the coin's own CoinGecko page (not any particular exchange) when there are no
// tickers at all to pick a "top" one from, or anything else about this fails.
function openTrendingCoinChart(coinId, buttonEl) {
    const openCoinGeckoFallback = () => {
        window.open(`https://www.coingecko.com/en/coins/${encodeURIComponent(coinId)}`, '_blank', 'noopener');
    };

    if (!isExtensionContextValid()) {
        openCoinGeckoFallback();
        return;
    }

    if (buttonEl) {
        buttonEl.disabled = true;
    }

    try {
        chrome.runtime.sendMessage({ action: 'fetchCoinExchanges', coinId }, response => {
            if (buttonEl) {
                buttonEl.disabled = false;
            }

            if (chrome.runtime.lastError || !response || !response.success || !Array.isArray(response.data) || response.data.length === 0) {
                openCoinGeckoFallback();
                return;
            }

            const topTicker = response.data[0];
            const market = topTicker.market || {};
            openExchangeTickerLink(market.name, topTicker.base, topTicker.target, topTicker.trade_url);
        });
    } catch (error) {
        if (buttonEl) {
            buttonEl.disabled = false;
        }
        openCoinGeckoFallback();
    }
}

// Chrome tears down a content script's connection to the extension when the extension is
// reloaded/updated/removed while the page is still open ("Extension context invalidated").
// There is no way to recover without a full page reload, so this is checked before every fetch
// attempt and used to stop the MutationObserver, instead of retrying and failing on every
// subsequent symbol change.
function isExtensionContextValid() {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

function updateCryptoContent() {
    // TradingView's "details" panel is identified by data-qa-id attributes, not the hashed
    // CSS classes/data-name attributes used elsewhere on the page — those change on every
    // TradingView frontend build, but these QA hooks have stayed stable across redesigns so far.
    const type = document.querySelector('[data-qa-id="details-element industry"]');
    const target = document.querySelector('[data-qa-id="details-element symbol"]');
    const geckoViewDiv = document.querySelector('#crypto-info-geckoview');

    if (!geckoViewDiv) {
        return;
    }

    if (!isExtensionContextValid()) {
        geckoViewDiv.innerHTML = buildHtmlErrorResponse({ error: 'GeckoView was updated — refresh this page to keep using it.' });
        if (geckoViewObserver) {
            geckoViewObserver.disconnect();
        }
        return;
    }

    // if the coin we found is a crypto, then we will fetch the data from coingecko
    if(type && type.textContent == 'Crypto' && target) {
        currentCoinData = null;
        activeTab = 'stats';
        geckoViewDiv.innerHTML = buildLoaderHtmlResponse();

        try {
            chrome.runtime.sendMessage({ action: 'fetchCoinData', coin: target.textContent }, response => {
                if (chrome.runtime.lastError) {
                    geckoViewDiv.innerHTML = buildHtmlErrorResponse({ error: 'GeckoView was updated — refresh this page to keep using it.' });
                    return;
                }

                if (!response.success) {
                    const test =  buildHtmlErrorResponse(response);
                    geckoViewDiv.innerHTML = test;
                    return;
                }

                // Guards against any unexpected/malformed CoinGecko response shape reaching the
                // templates: without this, a thrown error here happens *before* geckoViewDiv.innerHTML
                // is reassigned, leaving the widget stuck on the loading spinner forever instead of
                // showing an error.
                try {
                    geckoViewDiv.innerHTML = buildHtmlResponse(response.data, geckoViewSettings);
                    currentCoinData = response.data;
                } catch (renderError) {
                    geckoViewDiv.innerHTML = buildHtmlErrorResponse({ error: 'Could not display this coin’s data (unexpected response format).' });
                }

            });
        } catch (error) {
            // chrome.runtime.sendMessage throws synchronously when the context is invalidated
            // mid-call (isExtensionContextValid() above only catches it ahead of time).
            geckoViewDiv.innerHTML = buildHtmlErrorResponse({ error: 'GeckoView was updated — refresh this page to keep using it.' });
        }
    } else {
        currentCoinData = null;
        activeTab = 'trending';
        geckoViewDiv.innerHTML = buildHtmlHeaderResponse();
        // There's nothing coin-specific to show without a recognized crypto symbol, but Trending
        // is global (see the Trending architecture note) - buildHtmlHeaderResponse() already
        // includes its tab button/content area, so render it immediately rather than leaving that
        // area empty until a click that nothing on screen invites.
        renderTab('trending');
    }
}

// Config for every tab beyond "stats" (which always renders instantly from already-fetched coin
// data, no fetch needed). `requiresPro: true` (News/Insights) means content.js checks client-side
// for a Pro-type key before ever sending the message, so a Demo/no-key user's click never fires a
// doomed request against an endpoint their key can't use; Exchanges has no such gate (works for
// everyone, including keyless - see the handleExchangesRequest() comment in background.js for why
// Derivatives isn't a tab here at all). `global: true` (Trending) means this tab isn't about
// whatever coin is currently on screen at all - see the Trending architecture note - so renderTab()
// below skips the "needs currentCoinData"/per-coin-id staleness rules the other (per-coin) tabs need.
const GV_LAZY_TAB_CONFIG = {
    exchanges: { action: 'fetchCoinExchanges', requiresPro: false, global: false, label: 'Exchanges', build: buildExchangesTabContent },
    news: { action: 'fetchCoinNews', requiresPro: true, global: false, label: 'News', build: buildNewsTabContent },
    insights: { action: 'fetchCoinInsights', requiresPro: true, global: false, label: 'Insights', build: buildInsightsTabContent },
    trending: { action: 'fetchTrending', requiresPro: false, global: true, label: 'Trending', build: buildTrendingTabContent }
};

// Switches the widget's tab content area to `tabId`. "stats" re-renders instantly from the
// already-fetched coin data; every other tab is fetched lazily on first click (background.js
// caches the result per coin - or, for Trending, the one shared result - so flipping back later
// is still fast).
function renderTab(tabId) {
    const geckoViewDiv = document.querySelector('#crypto-info-geckoview');
    const tabConfig = tabId === 'stats' ? null : GV_LAZY_TAB_CONFIG[tabId];
    const isGlobalTab = tabId !== 'stats' && !!tabConfig && tabConfig.global;
    if (!geckoViewDiv || (!isGlobalTab && !currentCoinData)) {
        return;
    }

    activeTab = tabId;
    geckoViewDiv.querySelectorAll('[data-gv-tab]').forEach(button => {
        button.classList.toggle('gv-tab--active', button.dataset.gvTab === tabId);
    });

    const contentEl = geckoViewDiv.querySelector('#gv-tab-content');
    if (!contentEl) {
        return;
    }

    if (tabId === 'stats') {
        contentEl.innerHTML = buildKeyStatsTabContent(currentCoinData, geckoViewSettings);
        return;
    }

    if (!tabConfig) {
        return;
    }

    if (tabConfig.requiresPro) {
        const hasProKey = geckoViewSettings.apiKeyType === 'pro' && !!(geckoViewSettings.apiKey || '').trim();
        if (!hasProKey) {
            contentEl.innerHTML = buildProUpsell(tabConfig.label);
            return;
        }
    }

    // Per-coin tabs key their request/staleness check on the coin that was active when the fetch
    // started; a global tab like Trending has no such coin, so it's just keyed on the tab itself.
    const coinId = isGlobalTab ? null : currentCoinData.id;
    contentEl.innerHTML = buildLoaderFragment();

    if (!isExtensionContextValid()) {
        contentEl.innerHTML = `<p class="gv-error">GeckoView was updated — refresh this page to keep using it.</p>`;
        return;
    }

    try {
        chrome.runtime.sendMessage({ action: tabConfig.action, coinId }, response => {
            // The user may have switched tabs (or, for a per-coin tab, symbols) while this was in
            // flight - only apply a stale response if it's still relevant to what's on screen now.
            const stillRelevant = isGlobalTab
                ? activeTab === tabId
                : (activeTab === tabId && !!currentCoinData && currentCoinData.id === coinId);
            if (!stillRelevant) {
                return;
            }

            const freshContentEl = document.querySelector('#crypto-info-geckoview #gv-tab-content');
            if (!freshContentEl) {
                return;
            }

            if (chrome.runtime.lastError) {
                freshContentEl.innerHTML = `<p class="gv-error">GeckoView was updated — refresh this page to keep using it.</p>`;
                return;
            }

            if (!response.success) {
                freshContentEl.innerHTML = `<p class="gv-error">${escapeHtml(response.error || 'Something went wrong.')}</p>`;
                return;
            }

            freshContentEl.innerHTML = tabConfig.build(response.data);
        });
    } catch (error) {
        contentEl.innerHTML = `<p class="gv-error">GeckoView was updated — refresh this page to keep using it.</p>`;
    }
}
