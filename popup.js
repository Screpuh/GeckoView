// Populates and persists the GeckoView settings form. Depends on settings.js
// (GV_STAT_OPTIONS, getGeckoViewSettings, setGeckoViewSetting) loaded first — see popup.html.

document.addEventListener('DOMContentLoaded', () => {
    const enabledCheckbox = document.getElementById('gv-enabled');
    const statOptionsContainer = document.getElementById('gv-stat-options');

    enabledCheckbox.addEventListener('change', () => {
        setGeckoViewSetting('enabled', enabledCheckbox.checked);
    });

    // Build one checkbox row per GV_STAT_OPTIONS entry, so the popup always matches whatever
    // stats templates.js actually knows how to show/hide - no separate list to keep in sync.
    GV_STAT_OPTIONS.forEach(option => {
        const checkboxId = `gv-stat-${option.key}`;

        const row = document.createElement('div');
        row.className = 'gv-row';

        const label = document.createElement('label');
        label.setAttribute('for', checkboxId);
        label.textContent = option.label;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.addEventListener('change', () => {
            setGeckoViewSetting(option.key, checkbox.checked);
        });

        row.appendChild(label);
        row.appendChild(checkbox);
        statOptionsContainer.appendChild(row);
    });

    getGeckoViewSettings().then(settings => {
        enabledCheckbox.checked = settings.enabled;
        GV_STAT_OPTIONS.forEach(option => {
            document.getElementById(`gv-stat-${option.key}`).checked = settings[option.key];
        });
    });
});
