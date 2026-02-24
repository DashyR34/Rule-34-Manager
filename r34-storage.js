// ==UserScript==
// @name         R34 - Storage & Config
// @namespace    http://tampermonkey.net/
// @version      2.14
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_log
// @grant        GM_addValueChangeListener
// @require      https://github.com/PRO-2684/GM_config/releases/download/v1.2.2/config.min.js
// ==/UserScript==

(function () {
    "use strict";

    const Config = new GM_config({
        holdDelay: { name: "Hold-to-preview delay (ms)", type: "int", value: 350, min: 100, max: 2000 },
        animSpeed: { name: "Preview animation speed (seconds)", type: "float", value: 0.75, min: 0.2, max: 2.0 },
        infiniteScroll: { name: "Enable infinite scroll", type: "checkbox", value: true },
        preloadPages: { name: "Infinite scroll preload pages", type: "int", value: 1, min: 1, max: 5 }
    });

    GM_registerMenuCommand("⚙️ Manager Settings", () => Config.open());

    // Auto-reload when infinite scroll toggle changes
    GM_addValueChangeListener("infiniteScroll", () => location.reload());

    const getConfig = (key, fallback) => {
        try { return Config.get(key); } catch (e) { return fallback; }
    };

    function safeExec(fn, name = "unknown") {
        try { return fn(); } catch (e) {
            GM_log(`[R34-STORAGE ERROR] ${name}: ${e.message}\n${e.stack}`);
            console.error(`[R34 Storage] ${name} failed:`, e);
            return null;
        }
    }

    const Storage = {
        cache: new Map(),
        dirty: new Set(),
        timer: null,

        get: (key, defaultValue = null) => {
            if (Storage.cache.has(key)) return Storage.cache.get(key);
            try {
                const raw = GM_getValue(key);
                const value = raw !== undefined ? JSON.parse(raw) : defaultValue;
                Storage.cache.set(key, value);
                return value;
            } catch (e) {
                Storage.cache.set(key, defaultValue);
                return defaultValue;
            }
        },

        set: (key, value) => {
            Storage.cache.set(key, value);
            Storage.dirty.add(key);
            Storage.debounceFlush();
        },

        debounceFlush() {
            if (Storage.timer) clearTimeout(Storage.timer);
            Storage.timer = setTimeout(Storage.flush, 180);
        },

        flush() {
            for (let key of Storage.dirty) {
                try {
                    GM_setValue(key, JSON.stringify(Storage.cache.get(key)));
                } catch (e) {}
            }
            Storage.dirty.clear();
        },

        delete: (key) => {
            Storage.cache.delete(key);
            Storage.dirty.delete(key);
            GM_deleteValue(key);
        }
    };

    // Expose to other modules
    window.R34Storage = Storage;
    window.R34Config = { get: getConfig };
    window.R34SafeExec = safeExec;
})();
