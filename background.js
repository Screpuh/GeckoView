// this file can run API calls to coingecko when triggerd by the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fetchCoinData') {

        const exchange = message.exchange.toLowerCase();
        let coin = message.coin;
        coin = formatTradingPair(coin, exchange);
        
        fetch(`https://api.coingecko.com/api/v3/coins/${coin}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                if (data.error === 'coin not found') {
                    // Try searching by name
                    return fetch(`https://api.coingecko.com/api/v3/search?query=${coin}`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.error) {
                                sendResponse({ success: false, error: data.error });
                                return;
                            }

                            if (data.coins.length === 0) {
                                sendResponse({ success: false, error: 'No search results found' });
                                return;
                            } else {
                                for(let i = 0; i < data.coins.length; i++) {
                                    if(data.coins[i].symbol.toLowerCase() == coin) {
                                        const newCoinId = data.coins[i].api_symbol;
                                        return fetch(`https://api.coingecko.com/api/v3/coins/${newCoinId}`)
                                            .then(response => response.json())
                                            .then(data => {
                                                if (data.error) {
                                                    sendResponse({ success: false, error: data.error });
                                                    return;
                                                }

                                                sendResponse({ success: true, data });
                                            });
                                    } else if (data.coins[i].name.toLowerCase() == coin) {
                                        const newCoinId = data.coins[i].api_symbol;
                                        return fetch(`https://api.coingecko.com/api/v3/coins/${newCoinId}`)
                                            .then(response => response.json())
                                            .then(data => {
                                                if (data.error) {
                                                    sendResponse({ success: false, error: data.error });
                                                    return;
                                                }

                                                sendResponse({ success: true, data });
                                            });
                                    }
                                }
                            }
                        });
                }

                sendResponse({ success: false, error: 'No search results found'});
                return;
            }
            sendResponse({ success: true, data });
        }).catch(error => {
            sendResponse({ success: false, 'error': 'An error has occurred. Please attempt your request again.'} );
        });
            
        return true;
    }
});


// check which exchange to see what format the trading pair is in and return the coin in a format that coingecko can understand
function formatTradingPair(pair, exchange) {
    if (['binance', 'binance us', 'bitfinex', 'bitstamp', 'coinbase', 'gemeni', 'kraken', 'mexc', 'poloniex', 'kucoin'].includes(exchange)) {
        let parts = pair.split(' / ');
        let coin = parts[0].toLowerCase();

        coin = coin.replace(' ', '-');

        return coin;
    } else if (['bybit'].includes(exchange)) {
        let parts = pair.split(' ');
        let coin = parts[0].toLowerCase();
        
        const suffix = 'usdt';
        if (coin.endsWith(suffix)) {
            coin = coin.slice(0, -suffix.length);
        }

        return coin;
    } else if(['cryptocom', 'gateio', 'okx'].includes(exchange)) {
        let parts = pair.split('/');
        let coin = parts[0].toLowerCase();

        coin = coin.replace(' ', '-');

        return coin;
    } else {
        // we can alway try this as a last resort. most exchanges use this format
        let parts = pair.split(' / ');
        let coin = parts[0].toLowerCase();

        return coin;
    }

}