console.log('Content script loaded');

// document.addEventListener('click', (event) => {
//     console.log('Click event detected');
//     const selectedCoin = getSelectedCoinFromTradingView();
//     // if (selectedCoin) {
//     //   chrome.runtime.sendMessage({ action: 'fetchCoinData', coin: selectedCoin });
//     // }
// });
  
// function getSelectedCoinFromTradingView() {
//     // Implementation to detect selected coin on TradingView
//     // This will be specific to how TradingView displays the selected coin
//     console.log('Getting selected coin from TradingView');
//     return "bitcoin"; // Example
// }

function getDetailsAdditionalSecondary() {
    const detailsAdditionalSecondary = document.querySelector('[data-name="details-additional-secondary"]');
    return detailsAdditionalSecondary ? detailsAdditionalSecondary.textContent : 'Not found';
  }
  
  // Function to handle changes in 'details-additional-secondary'
  function handleChanges(mutationsList) {
    console.log('Mutation detected');
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const newDetailsAdditionalSecondary = getDetailsAdditionalSecondary();
        console.log('Updated Additional Secondary Text:', newDetailsAdditionalSecondary);
        // You can perform any action you need here
      }
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
  
  // Set up the MutationObserver
  const observer = new MutationObserver(handleChanges);
  
//   sleep(4000).then(() => {

//   const targetNode = document.querySelector('[data-name="details-additional-secondary"]');
//   const textContent = targetNode.textContent;
//   console.log('Target Node:', textContent);
//   if (targetNode) {
//     const config = { childList: true, subtree: true, characterData: true };
//     observer.observe(targetNode, config);
//     console.log('Initial Additional Secondary Text:', getDetailsAdditionalSecondary());
//   } else {
//     console.log('Element not found');
//   }

// });

window.onload = function() {
    // This code will run when the entire page has finished loading, including stylesheets, images, etc.
    console.log('Page fully loaded');
    
    function handleMutation(mutationsList, observer) {
        mutationsList.forEach(mutation => {
            console.log('Mutation type:', mutation.type);

            sleep(1000).then(() => {
            // Add your logic here to handle specific mutations
            const type = document.querySelector('[data-name="details-additional-secondary"]');
            const target  = document.querySelector('.text-eFCYpbUa');
            if(type && type.textContent == 'Crypto' && target) {
                console.log('Crypto found. lets search on coingecko');
                const exchange = document.querySelector('span[data-name="details-exchange"]').textContent;
                console.log('Exchange:', exchange);

                chrome.runtime.sendMessage({ action: 'fetchCoinData', exchange: exchange, coin: target.textContent }, response => {
                    console.log('Response from background:', response);
                    if (!response.success) {
                        console.error('Error fetching coin data:', response.error);
                        return;
                    }

                    const test =  buildHtmlResponse(response.data);
                    
                    const check = document.querySelector('#crypto-info-geckoview');

                    if (check) {
                        console.log('Element already exists');
                        check.innerHTML = test;
                        return;
                    } else {
                    
                        const existingDiv = document.querySelector('.widgetbar-page.active');
                        
                        const newDiv = document.createElement('div');
                        // add id to newDiv
                        newDiv.id = 'crypto-info-geckoview';
                        newDiv.innerHTML = test;
                        existingDiv.insertBefore(newDiv, existingDiv.firstChild);
                    }

            });     
            
            } else {
                console.log('No crypto found');
                console.log('Target:', target);
                console.log('Type:', type);
            }

        });

        });
    }
    
    // Function to set up MutationObserver on the target element
    function setupMutationObserver() {
        const targetElement = document.querySelector('#header-toolbar-symbol-search');
        if (!targetElement) {
            console.log('Target element not found.');
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
        console.log('MutationObserver set up for #header-toolbar-symbol-search');
    }
    // Usage example: Replace with your specific selector
    setupMutationObserver();
};
  
function buildHtmlResponse(data) {
    let CFORMAT_USD = new Intl.NumberFormat('en-EN', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
    let CFORMAT_NR = new Intl.NumberFormat('en-EN', { minimumFractionDigits: 0 });
    return `
        <div class="widgetHeader-X9EuSe_t">
            <div class="container-ZJX9Rmzv">
                <span class="logo-d0vVmGvT container-M1mz4quA">

                <span class="logo-M1mz4quA">
                    <img crossorigin="" decoding="async" src="${data.image.thumb}">
                </span>
                </span>
                
                <span class="title-ZJX9Rmzv">
                    <a style="color: black;" title="" href="https://www.coingecko.com/en/coins/${data.id}" target="_blank">
                        ${data.name} (${data.symbol.toUpperCase()})

                        #${data.market_cap_rank}
                    </a>
                </span>

                <div class="groupWrap-ZJX9Rmzv hasDisabledSet-ZJX9Rmzv">
                    <span class="coingecko">
                        <a title="" href="https://www.coingecko.com/en/coins/${data.id}" target="_blank">
                            <img alt="" style="width:25px;" loading="lazy" fetchpriority="high" class="" src="https://3936590801-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FuBDUa2ODcAkHHV15nEGc%2Ficon%2FdxukYF8Wxc39yBmmdpey%2FCoinGecko%20Logo.svg?alt=media&amp;token=cc062811-ede6-4788-815a-576f31cd16f9">
                        </a>
                    </span>
                </div>
            </div>
        </div>

        <div class="widgetWrapper-BSF4XTsE">
            <div class="buttonContainer-vll9ujXF" data-name="details-more-technicals-button">
                <a target="_blank" href="${data.links.homepage[0]}" tabindex="-1" class="button-vll9ujXF">
                    <svg width="18" height="18" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M12.1 4.69a9.54 9.54 0 0 1 3.8 0c.52 1.13.95 2.65 1.23 4.42a12.5 12.5 0 0 1-6.26 0c.28-1.77.71-3.29 1.23-4.42Zm-1.84.57a9.52 9.52 0 0 0-3.04 2.08c.63.51 1.38.95 2.2 1.3.22-1.25.5-2.39.84-3.38Zm-1.05 4.9c-1.1-.42-2.1-.98-2.95-1.67a9.46 9.46 0 0 0 0 11.03c.86-.68 1.86-1.24 2.96-1.66a33.91 33.91 0 0 1 0-7.7Zm.22 9.23c-.82.34-1.56.78-2.2 1.28a9.52 9.52 0 0 0 3.03 2.07 21.2 21.2 0 0 1-.83-3.35Zm2.67 3.92a17.46 17.46 0 0 1-1.23-4.4 12.2 12.2 0 0 1 6.26 0 17.46 17.46 0 0 1-1.23 4.4 9.54 9.54 0 0 1-3.8 0Zm5.64-.57a9.52 9.52 0 0 0 3.03-2.07 9.62 9.62 0 0 0-2.2-1.28 21.2 21.2 0 0 1-.83 3.35Zm1.04-4.88c1.1.42 2.1.98 2.95 1.66a9.46 9.46 0 0 0 .01-11.03c-.85.7-1.85 1.25-2.95 1.67a33.93 33.93 0 0 1 0 7.7Zm-1.45-7.25a14.06 14.06 0 0 1-6.66 0 32.64 32.64 0 0 0 0 6.8 13.74 13.74 0 0 1 6.66 0 32.62 32.62 0 0 0 0-6.8Zm1.24-1.98a9.1 9.1 0 0 0 2.2-1.29 9.52 9.52 0 0 0-3.03-2.08c.34 1 .62 2.13.83 3.37ZM14 3a11 11 0 1 0 0 22 11 11 0 0 0 0-22Z" fill="currentColor"></path></svg>
                    Website
                </a>
                <a target="_blank" href="https://x.com/${data.links.twitter_screen_name}" tabindex="-1" class="button-vll9ujXF">
                    <img alt="" class="tv-footer-socials__icon-image" src="/static/bundles/ui-lib/icons/28px-filled/social-icons/x-twitter-color-off.svg" loading="lazy" height="18" width="18">
                    Twitter
                </a>
                <a target="_blank" href="https://t.me/${data.links.telegram_channel_identifier}" tabindex="-1" class="button-vll9ujXF">
                    <img alt="" class="tv-footer-socials__icon-image" src="/static/bundles/ui-lib/icons/28px-filled/social-icons/telegram-color-off.svg" loading="lazy" height="18" width="18">
                    Telegram
                </a>
            </div>
        </div>

        

        <div class="widgetbar-widgetbody" style="contain: content;">
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
                            <span class="data-cXDWtdxq">‪${CFORMAT_USD.format(data.market_data.market_cap.usd)}‬</span>
                        </div>
                        
                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>Fully diluted valuation</span>
                            </div>
                            <span class="data-cXDWtdxq">‪${CFORMAT_USD.format(data.market_data.fully_diluted_valuation.usd)}‬</span>
                        </div>
                        
                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>24h Total Vol</span>
                            </div>
                            <span class="data-cXDWtdxq">‪${CFORMAT_USD.format(data.market_data.total_volume.usd)}‬</span>
                        </div>
                        
                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>Total supply</span>
                            </div>
                            <span class="data-cXDWtdxq">‪${CFORMAT_NR.format(data.market_data.total_supply)}‬</span>
                        </div>
                        
                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>Circulatin supply</span>
                            </div>
                            <span class="data-cXDWtdxq">‪${CFORMAT_NR.format(data.market_data.circulating_supply)} (${calculatePercentageOfTotal(data.market_data.circulating_supply, data.market_data.total_supply)}%)‬</span>
                        </div>

                        <div class="item-cXDWtdxq">
                            <div class="title-cXDWtdxq">
                                <span>ATL / ATH</span>
                            </div>
                            <span class="data-cXDWtdxq">‪ <span title="All time low">${CFORMAT_USD.format(data.market_data.atl.usd)}</span>
                     / 
                    <span title="All time high">${CFORMAT_USD.format(data.market_data.ath.usd)}</span>‬</span>
                        </div>
                    </div>
                </div>
                                
            </div>
        </div>
    `;
}

function calculatePercentageOfTotal(part, total) {
    if (total == 0) {
        return 0;
    }
    return Math.floor((part / total) * 100);
}