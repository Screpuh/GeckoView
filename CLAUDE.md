# CLAUDE.md

Guidance for Claude Code (and future contributors) working in this repository.

## What this is

GeckoView is a Chrome extension (Manifest V3) that injects CoinGecko market data
(market cap, volume, supply, ATH/ATL, social links) into the TradingView chart
UI. It is a small, dependency-free extension: no build step, no package manager,
no test runner. Everything ships as raw files loaded directly by Chrome.

## File map

- `manifest.json` — MV3 manifest. Registers the background service worker,
  `host_permissions` for `api.coingecko.com`, the `storage` permission (for
  `chrome.storage.sync` settings), the content scripts (matches
  `https://www.tradingview.com/chart/*`, loaded in order `settings.js` →
  `utils.js` → `templates.js` → `content.js`), and the popup/icons for the
  toolbar action.
- `background.js` — Service worker. `importScripts('settings.js')` (guarded
  for Node, where `importScripts` doesn't exist) pulls in
  `getGeckoViewSettings` for the API key. Listens for a `fetchCoinData`
  message from the content script, calls the CoinGecko API (`/coins/{id}`,
  falling back to `/search?query=` when the direct lookup 404s) against
  whichever host/header the user's `apiKey`/`apiKeyType` settings resolve to
  (see `getCoinGeckoBaseUrl`/`buildCoinGeckoFetchOptions`), maps the HTTP
  error statuses CoinGecko's docs call out to friendly messages (see
  `COINGECKO_HTTP_ERROR_MESSAGES`/`parseCoinGeckoResponse`), and sends the
  result back via `sendResponse`. The `chrome.runtime.onMessage.addListener`
  registration is guarded with `typeof chrome !== 'undefined'` so the file
  can also be `require()`'d from the Node test runner. Also handles
  `fetchCoinNews`/`fetchCoinInsights` (see the Categories/tabs architecture
  note) via a shared `handleListEndpointRequest()` helper and a generic
  `createTtlCache()` factory (the same TTL-`Map` shape as the coin-data
  cache, reused for `newsCache`/`insightsCache`). Pure/testable pieces
  (`formatTradingPair`, the caches, the API key/URL/error helpers) are
  exported via a `typeof module !== 'undefined'` guard for the same reason
  (no-op in the browser).
- `utils.js` — Small, dependency-free pure helpers shared by `templates.js`
  and `content.js`: `sleep`, `calculatePercentageOfTotal`,
  `formatCirculatingPercentage`, `escapeHtml`, `displayPrice`,
  `formatDateOrEmpty` (news/insights timestamps). Also exported via a
  `typeof module` guard for Node tests.
- `settings.js` — Settings schema (`GV_DEFAULT_SETTINGS`, `GV_STAT_OPTIONS`)
  and `chrome.storage.sync` helpers (`getGeckoViewSettings`,
  `setGeckoViewSetting`, `watchGeckoViewSettings`). Includes `apiKey` (string,
  default `''`) and `apiKeyType` (`'demo'` | `'pro'`, default `'demo'`) for
  the optional user-supplied CoinGecko API key — see the API key
  architecture note below. Loaded by both the content-script bundle, by
  `background.js` (via `importScripts`), and by `popup.html`, so all four
  always agree on what settings exist and default to. Only the two data
  structures are exported for Node tests — the `chrome.storage.*` wrappers
  aren't unit tested (no `chrome` mock), same tradeoff as the
  `chrome.runtime` listener in `background.js`.
- `templates.js` — All HTML-building functions for the injected widget panel
  (`buildHtmlHeaderResponse`, `buildHtmlErrorResponse`,
  `buildLoaderHtmlResponse`, `buildHtmlResponse`), sharing one
  `buildWidgetHeader(coin)` helper for the header/CoinGecko-link markup common
  to all four states. `buildHtmlResponse(data, settings)` renders the coin
  header, social links, `buildCategoriesRow()` (CoinGecko's `categories`
  array, capped at `GV_MAX_VISIBLE_CATEGORIES` with a "+N more" indicator —
  see the Categories/tabs architecture note), `buildTabsNav('stats')`, and
  the "Key stats" tab's content via `buildKeyStatsTabContent()`
  (`isStatVisible()`/`buildStatRow()` conditionally include each row based
  on `settings`, see `settings.js`; omitting `settings` shows every stat).
  `buildNewsTabContent()`/`buildInsightsTabContent()`/`buildProUpsell()`
  render the other two tabs, called lazily from `content.js` on tab click,
  not from `buildHtmlResponse()` itself.
- `content.js` — Runs on TradingView chart pages. Reads settings on load via
  `getGeckoViewSettings()` and bails out entirely if `enabled` is false (the
  master toggle only takes effect on page load/refresh). Otherwise watches
  the symbol-search toolbar with a `MutationObserver`, detects when the
  selected instrument is a crypto asset, asks `background.js` for CoinGecko
  data, and renders the result via the template functions from
  `templates.js`, passing the current settings through so stat visibility
  matches the popup. Also calls `watchGeckoViewSettings()` to re-render
  immediately when a per-stat toggle changes in the popup, without needing a
  refresh (cheap since it just hits the `background.js` cache). Attaches one
  delegated click listener on the widget's root div (survives re-renders,
  since only its `innerHTML` is reassigned) to drive `renderTab()` — see the
  Categories/tabs architecture note. Contains only DOM-watching/orchestration
  logic — no HTML templates or pure utilities live here.
- `popup.html` / `popup.js` — The toolbar popup, now a real settings UI: a
  master "Show on TradingView" toggle, one checkbox per `GV_STAT_OPTIONS`
  entry (built dynamically, so adding a stat option only requires touching
  `settings.js`), and an optional CoinGecko API key field with a Demo/Pro
  key-type `<select>` next to it. Persists via `chrome.storage.sync` (syncs
  across the user's signed-in Chrome profiles; trivial data volume, well
  under sync quotas). MV3's popup CSP disallows inline `<script>`, so all
  logic lives in `popup.js`, loaded after `settings.js`.
- `icon-16.png` / `icon-48.png` / `icon-128.png` — extension icons.
- `test/` — Node (`node:test`) unit tests for: the pure functions in
  `utils.js`; `formatTradingPair`, the response caches, the API
  key/base-URL helpers, and `parseCoinGeckoResponse`'s HTTP-error mapping in
  `background.js`; a schema-consistency check for `settings.js`
  (`GV_DEFAULT_SETTINGS`/`GV_STAT_OPTIONS` keys must match both ways,
  catching a popup checkbox with no default or vice versa); the pure
  string-building functions in `templates.js` (`templates.test.js` — loads
  `utils.js` + `templates.js` together into one `vm.createContext` sandbox,
  since `templates.js` expects `utils.js`'s helpers as globals the same way
  the real content-script load order provides them; function declarations
  land on the sandbox object, so `T.buildXyz(...)` works even though the
  internal `const`s they close over don't need to be re-exposed); and the
  full `fetchCoinNews`/`fetchCoinInsights` message-handling flow in
  `background.js` (`newsInsights.test.js` — same VM-sandbox technique, with
  `chrome.storage`/`fetch` mocked, exercising the real handler instead of a
  reimplementation of it). Run with `npm test` (or `node --test`). What's
  still *not* tested here: `content.js`'s DOM-watching/click-wiring logic
  itself (not the templates it calls) — that would need a real browser/DOM,
  not just a VM sandbox. If you change that wiring, verify manually with a
  mock TradingView DOM + mocked `chrome.*` (fake `.widgetbar-page.active`,
  `#header-toolbar-symbol-search`, `data-qa-id` elements, and a
  `chrome.runtime.sendMessage` that simulates `background.js`'s responses)
  rather than assuming it works from the template tests alone.
- `package.json` — `private: true`, no runtime dependencies; exists only to
  define the `test` script. Still no bundler/build step for the extension
  itself — `content_scripts` are loaded as classic scripts.
- `LICENSE` — MIT, matching the README's license claim.
- `README.md` — user-facing install/usage docs, Chrome Web Store link.

## Architecture notes

- **Two-script split, message-passing bridge.** `content.js` cannot call the
  CoinGecko API directly with full reliability (service worker is the intended
  place for background fetches in MV3), so it sends
  `chrome.runtime.sendMessage({ action: 'fetchCoinData', coin })` and
  `background.js` replies asynchronously (`sendResponse`, with `return true` to
  keep the channel open).
- **No build tooling.** Both scripts are loaded as classic (non-module)
  scripts. Do not introduce `import`/`export` syntax without also adding a
  bundler step and updating `manifest.json` accordingly — it will silently
  break the extension otherwise.
- **DOM coupling to TradingView internals — use `data-qa-id`, not hashed
  classes.** `content.js` locates data inside TradingView's "details" widget
  (`[data-test-id-widget-type="detail"]`) using `data-qa-id` attributes:
  `[data-qa-id="details-element industry"]` (asset type, e.g. "Crypto"),
  `[data-qa-id="details-element symbol"]` (raw ticker, e.g. "BTCUSDT"), plus
  `.widgetbar-page.active` (injection point) and
  `#header-toolbar-symbol-search` (MutationObserver target for symbol
  changes). TradingView's build-hashed CSS classes (the old `.text-eFCYpbUa`,
  `[data-name="details-additional-secondary"]`,
  `span[data-name="details-exchange"]` this extension used to depend on)
  **broke entirely** in a TradingView redesign — see git history around
  2026-10-23 for the recovery. `data-qa-id` attributes look like stable QA
  test hooks rather than generated CSS-module names and survived that
  redesign, but they are still TradingView-internal and undocumented, so
  there's no guarantee against future breakage. When debugging "GeckoView
  doesn't show up" reports, re-verify these selectors against the live
  TradingView DOM first (open devtools on a TradingView chart page and
  inspect the details panel) before assuming a logic bug.
- **Unified symbol parsing, no more per-exchange branching.**
  `formatTradingPair()` in `background.js` used to have separate parsing
  branches per exchange because each exchange rendered its trading pair
  differently in the old DOM. TradingView now renders
  `details-element symbol` uniformly as `{BASE}{QUOTE}` with no separator
  across every exchange (optionally with a trailing contract suffix like
  `.P` for perpetual futures, e.g. `BTCUSDT.P`), so the exchange is no longer
  needed as input at all — `formatTradingPair(pair)` just strips the contract
  suffix and then the longest matching entry in a hardcoded
  `QUOTE_CURRENCY_SUFFIXES` list (ordered so e.g. `BUSD` is checked before
  the `USD` it ends with). New quote currencies CoinGecko-listed coins trade
  against may need adding to that list.
- **`host_permissions` declared for both CoinGecko hosts.** The background
  fetch also happens to work without this (CoinGecko's API sends permissive
  CORS headers), but declaring `api.coingecko.com` and `pro-api.coingecko.com`
  is correct MV3 practice and protects against CoinGecko tightening CORS in
  the future. Both are needed because of the Pro-vs-Demo host split below —
  omitting `pro-api.coingecko.com` would silently break Pro key users.
- **Optional user API key: Demo and Pro are a different host *and* header,
  not just a different key.** CoinGecko has three access levels
  (https://docs.coingecko.com/reference/authentication,
  https://docs.coingecko.com/demo/reference/authentication): keyless
  (anonymous, `api.coingecko.com`, no header, rate-limited per IP address
  and shared with anyone else on that IP), Demo (free key,
  `api.coingecko.com`, `x-cg-demo-api-key` header, a dedicated 100
  req/min), and Pro (paid key, `pro-api.coingecko.com`,
  `x-cg-pro-api-key` header, limit depends on plan). Demo and Pro keys
  aren't distinguishable by format, so `apiKeyType` is an explicit setting,
  not something guessed from the key string. `getCoinGeckoBaseUrl()` picks
  the host and `buildCoinGeckoFetchOptions()` picks the header; both take
  `apiKeyType` and default to the Demo/keyless host when it's missing or
  unrecognized. An empty `apiKey` always means keyless (no header at all,
  regardless of `apiKeyType`).
- **CoinGecko HTTP error handling.** `parseCoinGeckoResponse()` (used in
  place of `response => response.json()` at every CoinGecko fetch) checks
  `response.status` against `COINGECKO_HTTP_ERROR_MESSAGES` — the handful of
  statuses CoinGecko's docs
  (https://docs.coingecko.com/docs/errors-and-rate-limits) call out as
  meaningful: 401/403 (bad or mismatched key), 408 (timeout), 429 (rate
  limited — the message points the user at adding/checking their API key),
  500/503 (CoinGecko-side outage). A match rejects with a friendly,
  already-user-facing `Error` (tagged `isGeckoViewError`) instead of letting
  that status's body (which may not match the expected `{error: ...}`
  shape, or may not be valid JSON at all) reach the normal
  `data.error`-based handling. **404 is deliberately not in that map** —
  `/coins/{id}` uses it for "coin not found," which is the expected signal
  that triggers the search-by-name fallback, not a real error; an unmapped
  status (404 included) just flows through to the existing body-based
  `data.error` logic unchanged. The final `.catch()` in `background.js`
  checks the `isGeckoViewError` tag to tell "one of our friendly messages"
  apart from a raw network/fetch failure (offline, DNS, CORS) and only
  shows its own generic connectivity message for the latter.
- **Three-layer defense against a malformed "successful" CoinGecko
  response.** Not every CoinGecko error body carries the top-level `error`
  field the rest of this code checks for (e.g. an unmapped HTTP status like
  a plain 400 can come back as `{status: {error_code, error_message}}`
  instead) — that used to get treated as a successful coin lookup, cached,
  and sent to `content.js`, which crashed deep inside `buildHtmlResponse()`
  (`templates.js`) reading e.g. `data.links.twitter_screen_name`, leaving
  the widget stuck on its loading spinner forever (the crash happened
  *before* `geckoViewDiv.innerHTML` was reassigned). Fixed at three levels,
  deliberately redundant: (1) `isValidCoinData()` in `background.js` gates
  every "success" `sendResponse()`/cache write on the response actually
  looking like a coin (`id`/`market_data`/`links` all present, no `error`
  field); (2) `buildHtmlResponse()` defaults `data.links` to `{}` so it
  can't throw on that field even if something malformed still gets
  through; (3) `content.js` wraps the `buildHtmlResponse()` call in
  try/catch and falls back to a proper error message, as a general safety
  net for *any* future rendering exception, not just this one.
- **No auto-refresh/polling.** Data only refreshes on symbol change (the
  existing `MutationObserver` behavior), never on a timer — CoinGecko's
  free tier rate-limits aggressively, and this extension deliberately stays
  well under it rather than polling. Live price/24h-change were considered
  and intentionally left out too: TradingView's own chart already shows
  that, so duplicating it here would be redundant, not an improvement.
- **Short-lived response cache in `background.js`.** `getCachedCoinData` /
  `setCachedCoinData` keep successful CoinGecko responses in a plain
  in-memory `Map`, keyed by the resolved coin id, for
  `COIN_DATA_CACHE_TTL_MS` (60s). This exists because the
  `MutationObserver` can re-trigger a lookup for the same symbol in quick
  succession, which would otherwise re-fetch every time — same
  rate-limit-avoidance motivation as not auto-refreshing. It's deliberately
  not `chrome.storage`: the cache is allowed to be lost when the MV3
  service worker is evicted (idle), that just costs one extra fetch, not a
  correctness issue, so a plain `Map` is simpler and sufficient.
- **Categories row + News/Insights tabs.** `data.categories` (plain string
  array, included by default in `/coins/{id}` — no extra API call) can be
  anywhere from empty to 20+ entries; `buildCategoriesRow()` hides the whole
  row for zero, and caps rendering at `GV_MAX_VISIBLE_CATEGORIES` (6) with a
  "+N more" pill so one heavily-tagged coin can't blow out the widget's
  height. The widget has three tabs (`GV_TABS` in `templates.js`): "Key
  stats" (always available, rendered from the already-fetched coin data,
  no extra fetch), "News", and "Insights"
  (https://docs.coingecko.com/reference/news,
  https://docs.coingecko.com/reference/insights). **News/Insights require a
  paid CoinGecko plan** (Analyst/Lite/Pro/Enterprise — not Demo, not
  keyless) and only exist on the Pro host; `content.js` checks
  `apiKeyType === 'pro'` client-side before ever sending a
  `fetchCoinNews`/`fetchCoinInsights` message, showing `buildProUpsell()`
  instead for anyone else, so a non-Pro user's click never fires a doomed
  request. For Pro users, the tab's content is fetched lazily (only on
  first click, not with the main coin data) via
  `handleListEndpointRequest()` in `background.js`, which always targets
  `COINGECKO_PRO_BASE_URL` with the `x-cg-pro-api-key` header regardless of
  the user's `apiKeyType` setting (defense in depth — `content.js` already
  gated this, but a stale/raced settings read reaching `background.js`
  shouldn't be able to misfire against the wrong host) and caches results
  per coin id in `newsCache`/`insightsCache`
  (`createTtlCache(COIN_DATA_CACHE_TTL_MS)`, same TTL as coin data) so
  flipping tabs back and forth doesn't re-fetch. `content.js` tracks
  `currentCoinData`/`activeTab` at module scope and guards the async
  response against staleness (`activeTab !== tabId || currentCoinData.id
  !== coinId`) so a slow News/Insights response can't render over a symbol
  the user has since navigated away from.
- **Untrusted data rendered via `innerHTML`.** All CoinGecko response fields
  (`data.name`, `data.symbol`, `data.id`, `data.image.thumb`, social links,
  etc.) are interpolated directly into HTML strings and assigned via
  `innerHTML`. Treat any change that adds more API-sourced fields to the
  template with the same caution — these values must go through
  `escapeHtml()` in `utils.js` before being interpolated.

## Conventions

- Plain JS (ES6+), no TypeScript, no framework, no linter config present.
- Functions are declared globally within each file (no IIFE/module wrapping).
- Styling is self-contained: all widget CSS lives in
  `buildGeckoViewStyles()` in `templates.js`, scoped under `#crypto-info-geckoview`
  with `gv-*` class names and CSS custom properties — it does **not** depend
  on any TradingView CSS class existing. (An earlier version tried to
  visually blend in by reusing TradingView's own hashed widget classes; that
  broke completely — unstyled text — the moment TradingView regenerated
  those classes. Don't reintroduce that dependency.) Light/dark theming reads
  `html[data-theme]` ("light"/"dark"), which has stayed stable across
  TradingView redesigns even when their CSS classes didn't.
- Social link icons (Website/Twitter/Telegram/Discord) are inline SVGs
  defined as `GV_ICON_*` constants in `templates.js`, not hotlinked from
  TradingView's static asset paths — same reasoning as above, one less thing
  that can silently 404.
- Versioning: `manifest.json` `version` is bumped manually per release; no
  changelog file exists.

## Known gaps

- No linter or CI configured yet (tests, license, and `host_permissions` were
  added; linting was left optional and hasn't been set up).
- `content.js`'s DOM-watching/click-wiring logic itself is still untested
  (would need a browser/DOM harness) — though the template functions it
  calls, and the `background.js` message handlers it talks to, both do have
  real `node:test` coverage now (see the `test/` file-map entry above).
- Coupling to TradingView's internal DOM (`data-qa-id` attributes) is
  inherent to how this extension works and not fixable from this side —
  it's just less fragile now than the hashed CSS classes it used to depend
  on.

## Working in this repo

- `npm test` (or `node --test`) runs the unit tests in `test/` — these only
  cover the pure functions in `utils.js` and `formatTradingPair` in
  `background.js`. There is no install/build step for the extension itself.
- To test the extension end-to-end: load it unpacked in Chrome
  (`chrome://extensions` → Developer mode → Load unpacked) and visit a
  TradingView chart page.
- When editing `content.js` selectors, verify against the live TradingView DOM
  rather than assuming the hashed class names are stable.
- Keep `background.js`, `utils.js`, `templates.js`, and `content.js` loadable
  as classic scripts unless a bundler is introduced project-wide.
- If you add new pure functions to `utils.js` or `background.js`, add the
  `typeof module !== 'undefined'` export guard (see existing examples) so
  they stay testable from Node, and add a corresponding test in `test/`.
