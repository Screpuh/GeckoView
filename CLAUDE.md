# CLAUDE.md

Guidance for Claude Code (and future contributors) working in this repository.

## What this is

GeckoView is a Chrome extension (Manifest V3) that injects CoinGecko market data
(market cap, volume, supply, ATH/ATL, social links) into the TradingView chart
UI. It is a small, dependency-free extension: no build step, no package manager,
no test runner. Everything ships as raw files loaded directly by Chrome.

## File map

- `manifest.json` — MV3 manifest. Registers the background service worker,
  `host_permissions` for `api.coingecko.com`, the content scripts (matches
  `https://www.tradingview.com/chart/*`, loaded in order `utils.js` →
  `templates.js` → `content.js`), and the popup/icons for the toolbar action.
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
- `templates.js` — All HTML-building functions for the injected widget panel
  (`buildHtmlHeaderResponse`, `buildHtmlErrorResponse`,
  `buildLoaderHtmlResponse`, `buildHtmlResponse`), sharing one
  `buildWidgetHeader(coin)` helper for the header/CoinGecko-link markup common
  to all four states.
- `content.js` — Runs on TradingView chart pages. Watches the symbol-search
  toolbar with a `MutationObserver`, detects when the selected instrument is a
  crypto asset, asks `background.js` for CoinGecko data, and renders the
  result via the template functions from `templates.js`. Contains only
  DOM-watching/orchestration logic — no HTML templates or pure utilities live
  here anymore.
- `popup.html` — Toolbar popup; currently a static placeholder (title only, no
  behavior).
- `icon-16.png` / `icon-48.png` / `icon-128.png` — extension icons.
- `test/` — Node (`node:test`) unit tests for the pure functions in
  `utils.js` and `formatTradingPair` in `background.js`. Run with `npm test`
  (or `node --test`). No DOM/`chrome.*`/HTML-template logic is tested here —
  that would need a browser/DOM harness, which this project doesn't have.
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
- **Price/change/sparkline all come from the single existing `/coins/{id}`
  call, no extra request.** `background.js` appends `?sparkline=true` to
  that call to get `market_data.sparkline_in_7d.price` (a ~7-day hourly
  series); `market_data.current_price.usd` and
  `market_data.price_change_percentage_24h` are already present by default.
  `buildSparklinePoints()` in `utils.js` turns the price series into SVG
  polyline points (pure/testable); `buildSparklineSvg()` in `templates.js`
  wraps that in the actual `<svg>` and colors it to match the 24h
  price-change badge. Deliberately no auto-refresh/polling was added here —
  CoinGecko's free tier rate-limits aggressively, so data only refreshes on
  symbol change (existing `MutationObserver` behavior), not on a timer.
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
