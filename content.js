// This script will run on the page and will be responsible for fetching the data from the coingecko api.
// Depends on helpers from utils.js and templates.js, loaded first — see manifest.json.
window.onload = function() {
    // This code will run when the entire page has finished loading, including stylesheets, images, etc.
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

        const observer = new MutationObserver(handleMutation);
        observer.observe(targetElement, {
            childList: true,      // Watch for changes in child elements
            subtree: true,        // Watch all descendants of targetElement
            attributes: true,     // Watch for attribute changes
            characterData: true   // Watch for changes in text content of targetElement
        });

        // Optionally, trigger the initial handling function
        handleMutation([], observer); // Initial run
    }

    setupMutationObserver();
};

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

    // if the coin we found is a crypto, then we will fetch the data from coingecko
    if(type && type.textContent == 'Crypto' && target) {
        geckoViewDiv.innerHTML = buildLoaderHtmlResponse();

        chrome.runtime.sendMessage({ action: 'fetchCoinData', coin: target.textContent }, response => {
            if (!response.success) {
                const test =  buildHtmlErrorResponse(response);
                geckoViewDiv.innerHTML = test;
                return;
            }

            const test =  buildHtmlResponse(response.data);
            geckoViewDiv.innerHTML = test;

        });
    } else {
        const test =  buildHtmlHeaderResponse();
        geckoViewDiv.innerHTML = test;
    }
}
