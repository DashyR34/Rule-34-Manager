// ==UserScript==
// @name         Manager (Rule 34)
// @namespace    http://tampermonkey.net/
// @version      2.14
// @description  Full modular version with settings, infinite scroll preload, smart paginator
// @match        https://rule34.xxx/*
// @require      https://github.com/DashyR34/Rule-34-Manager/blob/main/r34-storage.js
// @require      https://github.com/DashyR34/Rule-34-Manager/blob/main/r34-blacklist-filter.js
// @require      https://github.com/DashyR34/Rule-34-Manager/blob/main/r34-preview.js
// @require      https://github.com/DashyR34/Rule-34-Manager/blob/main/r34-ui.js
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
