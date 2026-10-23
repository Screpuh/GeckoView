const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// templates.js is a classic script (no module.exports) that expects utils.js's helpers
// (escapeHtml, displayPrice, formatCirculatingPercentage, formatDateOrEmpty) as globals - loading
// both into one VM context mirrors how manifest.json loads them as sibling content scripts.
// Function declarations from both files land on the context object, so T.buildXyz(...) works;
// internal consts (GV_TABS, GV_ICON_*, etc.) stay closed over inside those functions regardless.
function loadTemplates() {
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../utils.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../templates.js'), 'utf8'), sandbox);
    return sandbox;
}

const T = loadTemplates();

test('buildCategoriesRow returns an empty string when there are no categories', () => {
    assert.equal(T.buildCategoriesRow([]), '');
    assert.equal(T.buildCategoriesRow(null), '');
    assert.equal(T.buildCategoriesRow(undefined), '');
});

test('buildCategoriesRow renders a pill per category when under the cap', () => {
    const html = T.buildCategoriesRow(['Layer 1 (L1)', 'Smart Contract Platform']);
    assert.ok(html.includes('Layer 1 (L1)'));
    assert.ok(html.includes('Smart Contract Platform'));
    assert.ok(!html.includes('more'));
});

test('buildCategoriesRow caps the number of pills and adds a "+N more" indicator past the cap', () => {
    const categories = Array.from({ length: 10 }, (_, i) => `Category ${i + 1}`);
    const html = T.buildCategoriesRow(categories);
    for (let i = 1; i <= 6; i++) {
        assert.ok(html.includes(`Category ${i}<`), `missing Category ${i}`);
    }
    for (let i = 7; i <= 10; i++) {
        assert.ok(!html.includes(`Category ${i}<`), `should not render Category ${i}`);
    }
    assert.ok(html.includes('+4 more'));
});

test('buildCategoriesRow drops non-string/blank entries before counting/capping', () => {
    const html = T.buildCategoriesRow(['DeFi', '', null, 42, '   ']);
    assert.ok(html.includes('DeFi'));
    assert.ok(!html.includes('more')); // only one valid entry, well under the cap
});

test('buildCategoriesRow escapes category text', () => {
    const html = T.buildCategoriesRow(['<script>alert(1)</script>']);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
});

test('buildTabsNav includes all four tabs and marks only the active one', () => {
    const html = T.buildTabsNav('news');
    assert.ok(html.includes('data-gv-tab="stats"'));
    assert.ok(html.includes('data-gv-tab="exchanges"'));
    assert.ok(html.includes('data-gv-tab="news"'));
    assert.ok(html.includes('data-gv-tab="insights"'));
    assert.ok(html.includes('gv-tab--active" data-gv-tab="news"'));
    assert.ok(!html.includes('gv-tab--active" data-gv-tab="stats"'));
});

test('buildProUpsell names the feature and links to CoinGecko pricing', () => {
    const html = T.buildProUpsell('News');
    assert.ok(html.includes('News'));
    assert.ok(html.includes('coingecko.com'));
});

test('buildNewsTabContent shows an empty-state message for no/missing articles', () => {
    assert.ok(T.buildNewsTabContent([]).includes('No recent news'));
    assert.ok(T.buildNewsTabContent(null).includes('No recent news'));
    assert.ok(T.buildNewsTabContent(undefined).includes('No recent news'));
});

test('buildNewsTabContent renders title/url/source/date for each article', () => {
    const html = T.buildNewsTabContent([
        { title: 'Big News', url: 'https://example.com/a', source_name: 'Example', posted_at: '2026-01-01T00:00:00Z' }
    ]);
    assert.ok(html.includes('Big News'));
    assert.ok(html.includes('https://example.com/a'));
    assert.ok(html.includes('Example'));
});

test('buildNewsTabContent escapes article fields (untrusted CoinGecko data)', () => {
    const html = T.buildNewsTabContent([{ title: '<img onerror=alert(1)>', url: 'https://example.com', source_name: 'x' }]);
    assert.ok(!html.includes('<img onerror'));
});

test('buildExchangesTabContent shows an empty-state message for no/missing tickers', () => {
    assert.ok(T.buildExchangesTabContent([]).includes('No exchange listings'));
    assert.ok(T.buildExchangesTabContent(null).includes('No exchange listings'));
    assert.ok(T.buildExchangesTabContent(undefined).includes('No exchange listings'));
});

test('buildExchangesTabContent renders exchange/pair/price/volume for each ticker as a link', () => {
    const html = T.buildExchangesTabContent([{
        market: { name: 'Binance' }, base: 'BTC', target: 'USDT',
        converted_last: { usd: 81656 }, converted_volume: { usd: 4062283991 },
        trade_url: 'https://www.binance.com/trade/BTC_USDT'
    }]);
    assert.ok(html.includes('Binance'));
    assert.ok(html.includes('BTC/USDT'));
    assert.ok(html.includes('https://www.binance.com/trade/BTC_USDT'));
    assert.ok(html.includes('$81,656'));
    assert.ok(html.includes('$4.1B'));
    assert.ok(html.includes('<a class="gv-exchange-item"'));
});

test('buildExchangesTabContent falls back to a non-link row when trade_url is missing', () => {
    const html = T.buildExchangesTabContent([{ market: { name: 'Example' }, base: 'BTC', target: 'USDT' }]);
    assert.ok(html.includes('<div class="gv-exchange-item">'));
    assert.ok(!html.includes('<a class="gv-exchange-item"'));
});

test('buildExchangesTabContent omits price/volume from the meta line when absent', () => {
    const html = T.buildExchangesTabContent([{ market: { name: 'Example' }, base: 'BTC', target: 'USDT' }]);
    assert.ok(!html.includes('Vol'));
});

test('buildExchangesTabContent escapes untrusted CoinGecko fields', () => {
    const html = T.buildExchangesTabContent([{
        market: { name: '<img onerror=alert(1)>' }, base: 'BTC', target: 'USDT',
        trade_url: 'https://example.com'
    }]);
    assert.ok(!html.includes('<img onerror'));
});

test('buildInsightsTabContent shows an empty-state message for no/missing insights', () => {
    assert.ok(T.buildInsightsTabContent([]).includes('No insights'));
    assert.ok(T.buildInsightsTabContent(null).includes('No insights'));
});

test('buildInsightsTabContent renders title/description for each insight', () => {
    const html = T.buildInsightsTabContent([{ title: 'Trend', description: 'Something notable happened.', posted_at: '2026-01-01T00:00:00Z' }]);
    assert.ok(html.includes('Trend'));
    assert.ok(html.includes('Something notable happened.'));
});

test('buildInsightsTabContent omits description/meta lines when absent instead of rendering empty tags', () => {
    const html = T.buildInsightsTabContent([{ title: 'No extras' }]);
    assert.ok(!html.includes('gv-insight-item__desc'));
    assert.ok(!html.includes('gv-insight-item__meta'));
});

test('buildKeyStatsTabContent shows an empty-state message when every stat is hidden', () => {
    const data = { market_data: {
        market_cap: { usd: 1 }, fully_diluted_valuation: { usd: 1 }, total_volume: { usd: 1 },
        total_supply: 1, circulating_supply: 1, atl: { usd: 1 }, ath: { usd: 1 }
    } };
    const allHidden = {
        showMarketCap: false, showFullyDilutedValuation: false, showTotalVolume: false,
        showTotalSupply: false, showCirculatingSupply: false, showAthAtl: false
    };
    assert.ok(T.buildKeyStatsTabContent(data, allHidden).includes('No stats selected'));
});

test('buildKeyStatsTabContent tolerates a completely missing market_data', () => {
    const html = T.buildKeyStatsTabContent({}, undefined);
    assert.ok(html.includes('N/A'));
});

test('buildHtmlResponse includes categories and the tabs nav, with "stats" active by default', () => {
    const data = {
        id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', image: { thumb: 'https://example.com/t.png' },
        market_cap_rank: 1, categories: ['Layer 1 (L1)'],
        links: { twitter_screen_name: null, homepage: [], telegram_channel_identifier: '', chat_url: [] },
        market_data: {
            market_cap: { usd: 1 }, fully_diluted_valuation: { usd: 1 }, total_volume: { usd: 1 },
            total_supply: 1, circulating_supply: 1, atl: { usd: 1 }, ath: { usd: 1 }
        }
    };
    const html = T.buildHtmlResponse(data);
    assert.ok(html.includes('Layer 1 (L1)'));
    assert.ok(html.includes('gv-tab--active" data-gv-tab="stats"'));
    assert.ok(html.includes('id="gv-tab-content"'));
});

test('buildHtmlResponse omits the categories row entirely when there are none', () => {
    const data = {
        id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', image: { thumb: 'https://example.com/t.png' },
        market_cap_rank: 1, categories: [],
        links: {}, market_data: { market_cap: {}, fully_diluted_valuation: {}, total_volume: {}, atl: {}, ath: {} }
    };
    const html = T.buildHtmlResponse(data);
    assert.ok(!html.includes('<div class="gv-categories">'));
});
