const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GV_DEFAULT_SETTINGS, GV_STAT_OPTIONS } = require('../settings.js');

// Boolean settings that get their own hand-written checkbox in popup.html (not one generated
// from GV_STAT_OPTIONS, which is only for the widget's Key stats rows).
const NON_STAT_BOOLEAN_SETTINGS = ['enabled', 'autoCloseAdBlockerPopup', 'showCategories'];

test('GV_DEFAULT_SETTINGS has a boolean "enabled" master toggle', () => {
    assert.equal(typeof GV_DEFAULT_SETTINGS.enabled, 'boolean');
});

test('GV_DEFAULT_SETTINGS has a boolean "autoCloseAdBlockerPopup" toggle', () => {
    assert.equal(typeof GV_DEFAULT_SETTINGS.autoCloseAdBlockerPopup, 'boolean');
});

test('GV_DEFAULT_SETTINGS has a boolean "showCategories" toggle, defaulting to hidden', () => {
    assert.equal(typeof GV_DEFAULT_SETTINGS.showCategories, 'boolean');
    assert.equal(GV_DEFAULT_SETTINGS.showCategories, false);
});

test('every GV_STAT_OPTIONS key has a matching boolean default in GV_DEFAULT_SETTINGS', () => {
    // Guards against adding a popup checkbox for a setting that isn't defaulted anywhere
    // (it would then show as "undefined"/unchecked in storage.sync.get's defaults merge).
    for (const option of GV_STAT_OPTIONS) {
        assert.ok(
            Object.prototype.hasOwnProperty.call(GV_DEFAULT_SETTINGS, option.key),
            `GV_DEFAULT_SETTINGS is missing a default for "${option.key}"`
        );
        assert.equal(typeof GV_DEFAULT_SETTINGS[option.key], 'boolean');
    }
});

test('every boolean GV_DEFAULT_SETTINGS key other than "enabled" has a popup checkbox', () => {
    // The inverse of the above: a stat default with no GV_STAT_OPTIONS entry would be a setting
    // nobody can ever change from the popup. Non-boolean settings (e.g. "apiKey") get their own
    // dedicated input in popup.html/popup.js instead of a checkbox, so they're excluded here.
    const optionKeys = new Set(GV_STAT_OPTIONS.map(o => o.key));
    for (const key of Object.keys(GV_DEFAULT_SETTINGS)) {
        if (NON_STAT_BOOLEAN_SETTINGS.includes(key) || typeof GV_DEFAULT_SETTINGS[key] !== 'boolean') {
            continue;
        }
        assert.ok(optionKeys.has(key), `"${key}" has a default but no GV_STAT_OPTIONS entry`);
    }
});

test('apiKey defaults to an empty string (no key / anonymous requests)', () => {
    assert.equal(GV_DEFAULT_SETTINGS.apiKey, '');
});

test('apiKeyType defaults to "demo"', () => {
    assert.equal(GV_DEFAULT_SETTINGS.apiKeyType, 'demo');
});
