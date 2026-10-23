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
- `background.js` — Service worker. Listens for a `fetchCoinData` message from
  the content script, calls the CoinGecko API (`/coins/{id}`, falling back to
  `/search?query=` when the direct lookup 404s), and sends the result back via
  `sendResponse`. The `chrome.runtime.onMessage.addListener` registration is
  guarded with `typeof chrome !== 'undefined'` so the file can also be
  `require()`'d from the Node test runner. `formatTradingPair` is exported via
  a `typeof module !== 'undefined'` guard for the same reason (no-op in the
  browser).
- `utils.js` — Small, dependency-free pure helpers shared by `templates.js`
  and `content.js`: `sleep`, `calculatePercentageOfTotal`,
  `formatCirculatingPercentage`, `escapeHtml`, `displayPrice`. Also exported
  via a `typeof module` guard for Node tests.
- `settings.js` — Settings schema (`GV_DEFAULT_SETTINGS`, `GV_STAT_OPTIONS`)
  and `chrome.storage.sync` helpers (`getGeckoViewSettings`,
  `setGeckoViewSetting`, `watchGeckoViewSettings`). Loaded by both the
  content-script bundle and `popup.html`, so `content.js`/`templates.js` and
  `popup.js` always agree on what settings exist and default to. Only the
  two data structures are exported for Node tests — the `chrome.storage.*`
  wrappers aren't unit tested (no `chrome` mock), same tradeoff as the
  `chrome.runtime` listener in `background.js`.
- `templates.js` — All HTML-building functions for the injected widget panel
  (`buildHtmlHeaderResponse`, `buildHtmlErrorResponse`,
  `buildLoaderHtmlResponse`, `buildHtmlResponse`), sharing one
  `buildWidgetHeader(coin)` helper for the header/CoinGecko-link markup common
  to all four states. `buildHtmlResponse(data, settings)` uses
  `isStatVisible()`/`buildStatRow()` to conditionally include each Key
  stats row based on `settings` (see `settings.js`); omitting `settings`
  entirely shows every stat, so existing callers/tests are unaffected.
- `content.js` — Runs on TradingView chart pages. Reads settings on load via
  `getGeckoViewSettings()` and bails out entirely if `enabled` is false (the
  master toggle only takes effect on page load/refresh). Otherwise watches
  the symbol-search toolbar with a `MutationObserver`, detects when the
  selected instrument is a crypto asset, asks `background.js` for CoinGecko
  data, and renders the result via the template functions from
  `templates.js`, passing the current settings through so stat visibility
  matches the popup. Also calls `watchGeckoViewSettings()` to re-render
  immediately when a per-stat toggle changes in the popup, without needing a
  refresh (cheap since it just hits the `background.js` cache). Contains
  only DOM-watching/orchestration logic — no HTML templates or pure
  utilities live here.
- `popup.html` / `popup.js` — The toolbar popup, now a real settings UI: a
  master "Show on TradingView" toggle plus one checkbox per
  `GV_STAT_OPTIONS` entry (built dynamically, so adding a stat option only
  requires touching `settings.js`). Persists via `chrome.storage.sync`
  (syncs across the user's signed-in Chrome profiles; trivial data volume,
  well under sync quotas). MV3's popup CSP disallows inline `<script>`, so
  all logic lives in `popup.js`, loaded after `settings.js`.
- `icon-16.png` / `icon-48.png` / `icon-128.png` — extension icons.
- `test/` — Node (`node:test`) unit tests for the pure functions in
  `utils.js`, for `formatTradingPair`/the response cache in `background.js`,
  and a schema-consistency check for `settings.js`
  (`GV_DEFAULT_SETTINGS`/`GV_STAT_OPTIONS` keys must match both ways,
  catching a popup checkbox with no default or vice versa). Run with
  `npm test` (or `node --test`). No DOM/`chrome.*`/HTML-template logic is
  tested here — that would need a browser/DOM harness, which this project
  doesn't have.
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
- **`host_permissions` declared for api.coingecko.com.** The background
  fetch also happens to work without this (CoinGecko's API sends permissive
  CORS headers), but declaring it is correct MV3 practice and protects
  against CoinGecko tightening CORS in the future.
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
- Only the pure helper functions have test coverage — the DOM-watching logic
  in `content.js` and the HTML templates in `templates.js` are untested
  (would need a browser/DOM test harness).
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
