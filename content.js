// This script will run on the page and will be responsible for fetching the data from the coingecko api.
// Depends on helpers from utils.js and templates.js, loaded first — see manifest.json.

// Set once the MutationObserver is attached, so updateCryptoContent() can stop it (see
// isExtensionContextValid() below) once the extension context is gone and retrying is pointless.
let geckoViewObserver = null;

// Current settings (see settings.js), used by updateCryptoContent() to decide which stat rows to
// render. Starts at the defaults so nothing is unexpectedly hidden before the real settings load.
let geckoViewSettings = GV_DEFAULT_SETTINGS;

window.onload = function() {
    // This code will run when the entire page has finished loading, including stylesheets, images, etc.
    getGeckoViewSettings().then(settings => {
        geckoViewSettings = settings;

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
        const test =  buildHtmlHeaderResponse();
        geckoViewDiv.innerHTML = test;
    }
}
