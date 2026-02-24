// ==UserScript==
// @name         Manager (Rule 34)
// @namespace    http://tampermonkey.net/
// @version      2.14
// @description  Full modular version with settings, infinite scroll preload, smart paginator
// @match        https://rule34.xxx/*
// @match        https://www.rule34.xxx/*
// @require      [paste raw URL or file path to r34-storage.user.js]
// @require      [r34-blacklist-filter.user.js]
// @require      [r34-preview.user.js]
// @require      [r34-ui.user.js]
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";

    function initialize() {
        window.R34BuildTagDatabase();
        const blacklistManager = new window.R34BlacklistManager();
        const filterManager = new window.R34FilterManager();
        new window.R34UIManager(filterManager, blacklistManager);
        window.addEventListener('beforeunload', () => window.R34Storage.flush());
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }
})();
