// this file can run API calls to coingecko when triggerd by the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background script received a message:', message);
    if (message.action === 'fetchCoinData') {
        console.log('Fetching data for coin:', message.coin);

        const exchange = message.exchange.toLowerCase();
        let coin = message.coin;
        coin = formatTradingPair(coin, exchange);

        console.log('NEW COIN FOUND:', coin);
        console.log('Exchange:', exchange);
        
      fetch(`https://api.coingecko.com/api/v3/coins/${coin}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error fetching coin data:', data.error);

                if (data.error === 'coin not found') {
                    // Try searching by name
                    console.log('searching for coin:', coin);
                    return fetch(`https://api.coingecko.com/api/v3/search?query=${coin}`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.error) {
                                console.error('Error fetching search results:', data.error);
                                sendResponse({ success: false, error: data.error });
                                return;
                            }

                            if (data.coins.length === 0) {
                                console.error('No search results found');
                                sendResponse({ success: false, error: 'No search results found' });
                                return;
                            } else {
                                console.log('Search results:', data);
                                for(let i = 0; i < data.coins.length; i++) {
                                    console.log('Coin:', data.coins[i].symbol.toLowerCase());
                                    console.log('CoinLooking:', coin);
                                    if(data.coins[i].symbol.toLowerCase() == coin) {
                                        console.log('Coin found:', data.coins[i]);
                                        const newCoinId = data.coins[i].api_symbol;
                                        return fetch(`https://api.coingecko.com/api/v3/coins/${newCoinId}`)
                                            .then(response => response.json())
                                            .then(data => {
                                                if (data.error) {
                                                    console.error('Error fetching coin data:', data.error);
                                                    sendResponse({ success: false, error: data.error });
                                                    return;
                                                }

                                                sendResponse({ success: true, data });
                                            });
                                    } else {
                                        console.log('Coin not found:', data.coins[i].symbol);
                                    }
                                }
                            }

                        });
                }

                sendResponse({ success: false, error: data.error });
                return;
            }
            console.log('Data received:', data);
            sendResponse({ success: true, data });
        }).catch(error => {
            console.error('Error fetching coin data:', error);
            sendResponse({ success: false, error });
        });
        
        return true;
    }
});

function formatTradingPair(pair, exchange) {
    // check if  exchange is in array
    // array = ['binance', 'bittrex']
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